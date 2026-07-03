# Terraform - AWS EKS Platform Provisioning

This module-based Terraform configuration provisions everything needed to run
the platform on AWS EKS: VPC/networking, the EKS cluster + node group, ECR
repositories, and a private RDS database.

All modules under `modules/` are **custom, hand-written modules** — no
third-party/registry modules are used, per the assessment rules.

## Structure

```
terraform/
  provider.tf     # AWS provider + S3/DynamoDB remote backend
  main.tf         # wires the four modules together
  variables.tf    # environment, region, cluster name, node size/count, k8s version
  outputs.tf      # cluster name, endpoint, registry URLs, VPC id
  modules/
    vpc/          # VPC, public+private subnets, NAT, IGW, route tables, private DNS zone
    eks/          # EKS cluster, managed node group, IAM roles, CloudWatch logging
    ecr/          # ECR repos with scan-on-push + lifecycle policy
    rds/          # Private PostgreSQL RDS + Secrets Manager credential storage
```

## Usage

```bash
cd terraform
terraform init
terraform plan -var="environment=dev"
terraform apply -var="environment=dev"
```

> Note: the S3 bucket (`devops-assessment-tfstate`) and DynamoDB table
> (`devops-assessment-tf-lock`) referenced in `provider.tf`'s backend block
> must exist before the first `terraform init` — they can't provision
> themselves. Create them once manually or with a tiny bootstrap
> configuration that is applied with local state.

## How to safely upgrade AKS/EKS

1. Upgrade the **control plane** first, one minor version at a time (e.g.
   1.28 → 1.29, never skip a minor version): update `kubernetes_version` in
   `variables.tf` and `terraform apply`. EKS keeps serving traffic during
   this — the control plane is managed/HA by AWS.
2. Upgrade **node groups** after the control plane, ideally by creating a
   new node group on the new version and draining the old one (blue/green),
   rather than upgrading nodes in place. This avoids any workload downtime.
3. Before upgrading, check the AWS EKS version release notes for deprecated
   APIs and run `kubectl convert`/`pluto`/`kubent` against manifests to
   catch anything using a removed API version.
4. Always upgrade a non-production environment first and run smoke tests.

## How to add or resize node pools

- **Resize** (change instance count): adjust `node_min_size` /
  `node_max_size` / `node_desired_size` and `terraform apply`. The managed
  node group handles the scale-out/in with no manual EC2 work.
- **Add a new pool** (e.g. a GPU or spot pool): copy the `aws_eks_node_group`
  resource in `modules/eks/main.tf`, give it a new `node_group_name`, and
  point workloads at it with a `nodeSelector`/taint in Kubernetes.

## How to maintain Terraform state

- State lives in S3 with **encryption at rest** and **DynamoDB locking**, so
  concurrent applies from different laptops or pipeline runs can't corrupt
  it.
- Nobody applies from a local machine against production — only the CI/CD
  pipeline's service role does, so state changes are always tied to a commit.
- `terraform state list` / `terraform state show <resource>` for inspecting
  state without risking a destructive command.
- Enable S3 bucket versioning on the state bucket so a bad state file can be
  rolled back.

## How to avoid downtime during cluster changes

- Node group `update_config.max_unavailable = 1` ensures only one node is
  replaced at a time during a node group update.
- Pod Disruption Budgets (not yet in this repo — see
  `docs/future-improvements.md`) should be added so Kubernetes never evicts
  every replica of a Deployment at once during node draining.
- Apply changes to a non-production environment first.

## How to separate dev, staging, and production

Two supported approaches, either works:
1. **Terraform workspaces** — `terraform workspace new staging`, then the
   `var.environment` value and any `terraform.workspace`-based naming keeps
   resources distinct under the same backend key prefix.
2. **Separate state per environment (preferred for this project)** — a
   different backend `key` per environment (e.g.
   `eks/dev/terraform.tfstate`, `eks/production/terraform.tfstate`) and a
   `dev.tfvars` / `staging.tfvars` / `production.tfvars` file per
   environment, applied with `terraform apply -var-file=production.tfvars`.
   This fully isolates blast radius — a mistake in dev can never touch
   production state.

## How to handle secrets outside Terraform code

- The RDS module generates the database password with `random_password` and
  immediately stores it in **AWS Secrets Manager** — application code and
  CI/CD read it from Secrets Manager, never from a `.tfvars` file or
  hardcoded value.
- No `.tfvars` file containing secrets is ever committed (`.gitignore`
  excludes `*.tfvars`).
- The AWS credentials Terraform itself runs with come from the CI/CD
  pipeline's OIDC-federated role, not static access keys.

## What to check if Terraform wants to recreate the cluster

`terraform plan` showing a cluster **replacement** (not just an update) is a
red flag — this would cause real downtime. Checklist:
1. Run `terraform plan` and read exactly which argument is forcing
   replacement (marked with `# forces replacement` in the plan output).
2. Common causes: changing `vpc_config.subnet_ids` in a way that isn't a
   pure addition, changing the cluster `name`, or changing a field the AWS
   provider treats as immutable.
3. If the diff is only cosmetic (e.g. provider version bump changed how a
   field is represented), compare against the previous provider version's
   behavior — sometimes a `terraform state show` confirms nothing really
   changed and the plan is a false positive from a provider upgrade.
4. Never blindly `apply` a plan that recreates the cluster in production —
   confirm the reason first, and if it's unavoidable, plan a maintenance
   window and a blue/green cluster cutover instead of an in-place recreate.
