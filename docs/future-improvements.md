# Future Improvements

This assessment build intentionally keeps scope tight. Below are the
improvements a real production rollout of this platform should add next,
roughly in priority order.

## 1. Secret management via External Secrets Operator
- **What**: Replace the example Kubernetes Secret with the External Secrets
  Operator pulling live from AWS Secrets Manager.
- **Why**: Right now `backend-secret-example.yaml` is a placeholder meant
  to be replaced out-of-band; without automation someone has to remember to
  do that correctly every time credentials rotate.
- **How it helps**: Removes any human step from getting real secrets into
  the cluster, and centralizes rotation in one place (Secrets Manager).
- **Implementation**: Deploy the External Secrets Operator, define an
  `ExternalSecret` resource pointing at the Secrets Manager ARN output by
  the `rds` Terraform module, and delete the manual Secret.
- **Risk reduced**: Stale/leaked credentials sitting in cluster manifests.

## 2. Image vulnerability scanning gate
- **What**: Fail the CI/CD pipeline if a pushed image has high/critical CVEs
  (ECR scan-on-push is already enabled — this adds a gate on the result).
- **Why**: Scanning without gating means vulnerable images still get
  deployed; a human has to remember to check.
- **How it helps**: Prevents known-vulnerable images from ever reaching the
  cluster automatically.
- **Implementation**: Add a pipeline step polling
  `aws ecr describe-image-scan-findings` after push and fail the job above
  a severity threshold, or run Trivy/Grype directly in CI before push.
- **Risk reduced**: Shipping known-exploitable container images.

## 3. Monitoring and alerting (Prometheus/Grafana + Alertmanager)
- **What**: Deploy the kube-prometheus-stack for cluster + app metrics,
  dashboards, and alert rules (pod restarts, high error rate, DB connection
  saturation).
- **Why**: CloudWatch logs (already enabled via Terraform) show what
  happened after the fact; there's no proactive alerting yet.
- **How it helps**: The team finds out about problems from an alert, not
  from a customer.
- **Implementation**: Deploy Prometheus + Grafana, instrument the FastAPI
  backend with a `/metrics` endpoint, wire Alertmanager to Slack/PagerDuty.
- **Risk reduced**: Extended undetected outages.

## 4. Rollback strategy
- **What**: Formalize `kubectl rollout undo` as a documented, rehearsed
  procedure, and/or move to Argo Rollouts for automated rollback on failed
  health checks during a deploy.
- **Why**: Currently a bad deploy needs a human to notice and manually
  intervene.
- **How it helps**: Reduces mean-time-to-recovery from minutes to seconds.
- **Implementation**: Argo Rollouts with an analysis template checking
  error rate post-deploy; auto-rollback if it crosses a threshold.
- **Risk reduced**: Extended customer-facing impact from a bad release.

## 5. Helm chart
- **What**: Convert the raw `k8s/*.yaml` manifests into a Helm chart with
  values per environment.
- **Why**: Raw manifests duplicate a lot of boilerplate across
  dev/staging/production and the `sed` image-tag substitution in the
  pipeline is fragile.
- **How it helps**: One templated source of truth, environment differences
  isolated to `values-<env>.yaml`.
- **Implementation**: `helm create`, migrate existing manifests into
  templates, parameterize image tag/replica count/resource limits.
- **Risk reduced**: Config drift between environments.

## 6. Terraform remote backend hardening
- **What**: Enable S3 bucket versioning + a bucket policy restricting who
  can read/write state (it can contain secrets in plaintext, like the RDS
  password).
- **Why**: The backend is already remote with locking, but the bucket
  itself isn't yet hardened against accidental deletion or broad IAM
  access.
- **How it helps**: State becomes recoverable and access-audited.
- **Implementation**: `versioning { enabled = true }`, bucket policy scoped
  to the CI/CD role and a small admin group, and consider `sops`-encrypting
  any values before they ever reach state where possible.
- **Risk reduced**: Unrecoverable state loss or state leak.

## 7. Kubernetes autoscaling (HPA + Cluster Autoscaler)
- **What**: Add a HorizontalPodAutoscaler for both Deployments and enable
  the Cluster Autoscaler (or Karpenter) on the node group.
- **Why**: Fixed 2 replicas / fixed node count doesn't handle traffic
  spikes or save cost during quiet periods.
- **How it helps**: Automatic scale-out under load, automatic scale-in to
  save cost off-peak.
- **Implementation**: HPA targeting CPU/memory or a custom metric; Cluster
  Autoscaler tagged to the existing managed node group.
- **Risk reduced**: Both outages under load and wasted spend at idle.

## 8. Cluster upgrade strategy automation
- **What**: A documented, scheduled quarterly upgrade cadence with a
  staging-first rollout, backed by the blue/green node group approach
  already described in `terraform/README.md`.
- **Why**: Falling behind on EKS versions eventually forces an urgent,
  risky multi-version jump when AWS deprecates the old version.
- **How it helps**: Small, low-risk, predictable upgrades instead of rare
  large ones.
- **Implementation**: Calendar reminder + a checklist runbook; automate
  deprecated-API scanning (`pluto`) as a scheduled CI job.
- **Risk reduced**: Forced emergency upgrades and unplanned downtime.

## 9. Production approval gates
- **What**: The GitHub Actions `production` environment already supports
  required reviewers — turn that on, and add a manual approval step before
  the `deploy` job runs against production.
- **Why**: Right now (for the assessment) deploy runs automatically on
  every push to `main`.
- **How it helps**: A human checks the release notes/diff before anything
  reaches real users.
- **Implementation**: GitHub repo Settings → Environments → production →
  required reviewers.
- **Risk reduced**: Accidental or premature production deploys.

## 10. Private cluster (no public EKS API endpoint)
- **What**: Set `endpoint_public_access = false` on the EKS cluster and
  access it only via a bastion host, VPN, or AWS SSM Session Manager.
- **Why**: The assessment leaves public API access on for simplicity/ease
  of review; production shouldn't expose the Kubernetes API to the
  internet at all.
- **How it helps**: Removes an entire class of attack surface.
- **Implementation**: Flip the Terraform flag, stand up a bastion or use
  SSM port forwarding, update CI/CD runners to reach the API via a
  self-hosted runner inside the VPC (public GitHub-hosted runners can't
  reach a fully private endpoint).
- **Risk reduced**: Internet-facing attacks against the Kubernetes control
  plane.

## 11. WAF in front of the Ingress/ALB
- **What**: Attach AWS WAF to the ALB created by the Ingress, with managed
  rule groups (SQLi, XSS, rate limiting).
- **Why**: The frontend is the one thing intentionally exposed to the
  internet — it should have a filtering layer in front of it.
- **How it helps**: Blocks common automated attack patterns before they
  ever reach the pods.
- **Implementation**: `aws_wafv2_web_acl` + association with the ALB via
  Terraform, in the `eks` or a new `waf` module.
- **Risk reduced**: Common web exploits and basic DDoS/bot traffic.

## 12. GitOps with Argo CD
- **What**: Move deployment from "CI pipeline runs kubectl apply" to
  "Argo CD continuously reconciles the cluster against a git repo".
- **Why**: The current pipeline pushes changes; there's no continuous
  verification the cluster matches what git says it should be, and no easy
  audit trail of drift.
- **How it helps**: Any manual `kubectl edit` drift gets detected/reverted
  automatically; git becomes the single source of truth with full history.
- **Implementation**: Install Argo CD, point it at the `k8s/` (or Helm
  chart) directory, remove the `kubectl apply` step from the pipeline in
  favor of the pipeline only updating the image tag in git.
- **Risk reduced**: Configuration drift and un-auditable manual changes.

## 13. Blue/green or canary deployment
- **What**: Route a small percentage of traffic to the new version first
  (canary) or run both versions and cut over instantly (blue/green),
  instead of a rolling update to all pods at once.
- **Why**: A rolling update still means every user hits the new version
  quickly — a bad release affects everyone within minutes.
- **How it helps**: Limits blast radius of a bad release to a small
  percentage of traffic before full rollout.
- **Implementation**: Argo Rollouts or Flagger with an Ingress/service mesh
  that supports weighted traffic splitting.
- **Risk reduced**: Wide-impact bad releases.

## 14. Backup and disaster recovery
- **What**: Formal RDS automated snapshot testing (restore drills) and
  Velero for cluster-state backup.
- **Why**: Backups exist (RDS `backup_retention_period = 7`) but have never
  been tested for actual restore — an untested backup is not a real backup.
- **How it helps**: Confidence that recovery actually works under a real
  incident, with a known RTO/RPO.
- **Implementation**: Quarterly scheduled restore-to-scratch-environment
  drill; Velero for PVC/cluster object backup if stateful workloads are
  added later.
- **Risk reduced**: Data loss becoming unrecoverable during a real
  disaster.

## 15. Network policies
- **What**: Kubernetes `NetworkPolicy` resources restricting pod-to-pod
  traffic (e.g. only frontend can talk to backend, nothing else can reach
  either).
- **Why**: Right now, network segmentation only exists at the AWS security
  group layer; inside the cluster, any pod can reach any other pod by
  default.
- **How it helps**: Defense in depth — even if a pod is compromised,
  lateral movement inside the cluster is blocked.
- **Implementation**: Default-deny NetworkPolicy in the namespace, then
  explicit allow rules for frontend→backend and backend→DB egress.
- **Risk reduced**: Lateral movement from a compromised pod.

## 16. Cost optimization
- **What**: Mix of Spot instances for non-critical workloads, right-sizing
  based on actual Prometheus metrics (once #3 is in place), and S3/ECR
  lifecycle policies (ECR lifecycle is already in place).
- **Why**: Fixed on-demand `t3.medium` nodes and no usage-based sizing data
  means the platform is almost certainly over- or under-provisioned.
- **How it helps**: Lower monthly AWS spend without sacrificing
  reliability, once real metrics justify the sizing.
- **Implementation**: AWS Compute Optimizer recommendations, Karpenter with
  a spot-friendly NodePool for the frontend tier, Savings Plans for the
  stable baseline.
- **Risk reduced**: Budget overrun / wasted spend, not an availability
  risk.
