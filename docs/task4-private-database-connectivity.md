# Task 4: Private Database Connectivity

This document explains how the backend connects to the database privately,
with no public exposure. The implementation lives in
`terraform/modules/rds/`, `terraform/modules/vpc/`, and
`terraform/modules/eks/` — this doc is the plain-English explanation the
assessment asks for.

Internet --->Application Load Balancer (via Ingress) ---> | EKS , Frontend Pods , Backend Pods | ----priveate vpc network only'SG:port from EKS---> WS RDS PostgreSQL |(private subnet,   |publicly_accessible| = false)


## 1. How AKS/EKS connects privately to the database

The EKS worker nodes and the RDS instance both live inside the **same VPC**,
in the **same private subnets** (`module.vpc.private_subnet_ids`). There is
no NAT, no internet path, and no VPN involved in the connection itself —
traffic from a backend pod to the database goes:

```
backend pod → node ENI (private subnet) → VPC internal routing → RDS ENI (private subnet)
```

It never leaves the VPC and never touches the Internet Gateway or NAT
Gateway. The NAT Gateway exists only so nodes can reach the internet for
things like pulling images or calling AWS APIs — it is not in the path
between the backend and the database.

## 2. Private subnet / private endpoint design

- `modules/vpc` creates 2 **public** subnets (only used for the NAT Gateway
  and the internet-facing ALB from the Ingress) and 2 **private** subnets
  across two AZs.
- EKS worker nodes (`aws_eks_node_group.this`) are launched **only** in the
  private subnets — no node ever gets a public IP.
- RDS uses a `aws_db_subnet_group` built **only** from the private subnet
  IDs, and `publicly_accessible = false` is set explicitly on the
  `aws_db_instance`. Even if someone mistakenly pointed the subnet group at
  a public subnet later, this flag still blocks AWS from attaching a public
  IP to the instance.
- This is the AWS equivalent of an Azure "private endpoint": the database
  only has a private IP, resolvable and reachable only from inside the VPC.

## 3. Private DNS requirement

- A Route53 **private hosted zone** (`internal.local`) is created and
  associated with the VPC (`aws_route53_zone.internal`, `vpc { vpc_id }`
  block) — this makes it resolvable only from inside that VPC, not from the
  public internet.
- A CNAME record `db.internal.local` points at the real RDS endpoint
  (`aws_route53_record.db`).
- The backend is configured to connect via `db.internal.local` rather than
  the raw AWS-generated RDS endpoint. This matters for two reasons:
  1. If the database fails over (Multi-AZ) or is recreated, the underlying
     endpoint can change — the stable private DNS name doesn't.
  2. It keeps the actual RDS hostname out of application config; only the
     Terraform/AWS layer needs to know it.

## 4. NSG / firewall / security group rules

Two security groups gate all traffic to the database:

- **Node security group** (`aws_security_group.node` in the `eks` module) —
  represents "traffic coming from EKS worker nodes."
- **DB security group** (`aws_security_group.db` in the `rds` module) — its
  only ingress rule allows TCP **5432** (Postgres) and only from
  `var.allowed_security_group_id`, which is wired in `main.tf` directly to
  `module.eks.node_security_group_id`.

There is no ingress rule for `0.0.0.0/0`, no rule for the public subnets,
and no rule for any other CIDR — the security group is the enforcement
point, and it references another security group rather than an IP range,
which is what makes rule #5 below true.

## 5. How only the backend can access the database

Three layers combine to guarantee this, not just one:

1. **Network layer**: the DB security group only accepts traffic from the
   node security group (see #4). Nothing outside the cluster's nodes can
   even open a TCP connection to port 5432.
2. **Kubernetes layer**: the backend Service (`backend-service.yaml`) is
   `ClusterIP` — it isn't reachable externally, and only the backend
   Deployment holds the database credentials (via `backend-secret`).
3. **No public exposure at all**: `publicly_accessible = false` means the
   database has no public IP to attack in the first place, regardless of
   security group rules — this is defense in depth on top of #4.

The frontend never receives database credentials and has no network path to
port 5432 even if it wanted to — its pods aren't covered by the node
security group's trust relationship in the DB's ingress rule (the DB SG
trusts the node SG as a whole, but the frontend has no way to reach the DB
port unless it also runs on a node in the same SG *and* has credentials,
neither of which it does).

## 6. How database credentials are stored securely

- Terraform generates the password once with `random_password` — it is
  never hand-typed or committed anywhere.
- The password is written to **AWS Secrets Manager**
  (`aws_secretsmanager_secret` / `_secret_version`), not to a `.tfvars`
  file, not to a repo, not to a Kubernetes manifest checked into git.
- `k8s/backend-secret-example.yaml` in this repo is exactly what its name
  says — an **example/placeholder** showing the shape of the Secret the
  backend expects (`DB_USER`, `DB_PASS`). In a real deployment, the actual
  credentials are pulled from Secrets Manager (e.g. via the External
  Secrets Operator — see `docs/future-improvements.md` #1) and never
  hand-written into a manifest.
- Terraform state itself will contain the password (this is unavoidable
  with `random_password` + `aws_db_instance`), which is exactly why the
  remote backend (`provider.tf`) uses an encrypted S3 bucket with access
  restricted to the CI/CD role — state is treated as sensitive, not as a
  regular file.

## 7. How to confirm the database is not publicly accessible

After `terraform apply`, verify with the AWS CLI (or console) rather than
just trusting the code:

```bash
# 1. Confirm the flag AWS itself enforces
aws rds describe-db-instances \
  --db-instance-identifier devops-assessment-<env> \
  --query "DBInstances[0].PubliclyAccessible"
# Expected: false

# 2. Confirm it has no public IP / isn't in a public subnet
aws rds describe-db-instances \
  --db-instance-identifier devops-assessment-<env> \
  --query "DBInstances[0].DBSubnetGroup.Subnets[].SubnetIdentifier"
# Cross-check each subnet ID against `terraform output` private subnet IDs —
# none should match the public subnet IDs.

# 3. Confirm the security group has no open ingress
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=devops-assessment-db-sg-*" \
  --query "SecurityGroups[0].IpPermissions"
# Expected: a single rule, port 5432, referencing the node security group
# ID as the source — no CidrIp of 0.0.0.0/0 anywhere.

# 4. Try to connect from outside the VPC (should hang/timeout, not refuse)
psql -h <rds-endpoint> -U appadmin -d appdb
# Expected: connection times out — there's no route to a private IP from
# outside the VPC at all, so this isn't even a firewall "deny", it's a
# genuine lack of a network path.

# 5. Confirm from inside the cluster it *does* work (proves it's a network
#    problem for outsiders, not a broken database)
kubectl run -it --rm debug --image=postgres:16-alpine --restart=Never -- \
  psql -h db.internal.local -U appadmin -d appdb
# Expected: connects successfully from a pod in the cluster.
```

If step 1 or 3 ever comes back different from expected, that's the signal
something was manually changed outside Terraform (config drift) and needs
investigating before anything else.
