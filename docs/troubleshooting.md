# Troubleshooting

Brief, practical answers to common production issues on this platform.

### 1. Pod is in CrashLoopBackOff. What do you check?
- `kubectl describe pod <pod>` for the exact reason in Events (OOMKilled,
  failed probe, non-zero exit code).
- `kubectl logs <pod> --previous` to see why the *last* crashed container
  exited, since the current one may not have logged anything yet.
- Confirm the container's start command/entrypoint is correct and required
  env vars (ConfigMap/Secret) are actually present.
- Check resource limits — if the process is OOMKilled, the memory limit is
  too low for the app.

### 2. Deployment is successful, but app is not reachable. What do you check?
- `kubectl get pods -o wide` — are pods actually Running and Ready?
- `kubectl get endpoints <service>` — if empty, the Service's selector
  doesn't match the pod labels.
- `kubectl port-forward` directly to a pod to rule out the Service/Ingress
  layer entirely.
- Check the Ingress/LoadBalancer status and any security group / NACL
  blocking the path.

### 3. Difference between readiness and liveness probe?
- **Readiness** answers "can this pod currently accept traffic?" — if it
  fails, Kubernetes removes the pod from the Service's endpoints but does
  NOT restart it. Used for slow startup or temporary overload.
- **Liveness** answers "is this pod stuck/deadlocked and needs a restart?"
  — if it fails repeatedly, Kubernetes kills and restarts the container.

### 4. Docker build works locally but fails in pipeline. Why?
- Different base image cache state — the pipeline runner has no local
  layer cache, which can expose a step that silently relied on a stale
  cached layer.
- Different architecture (e.g. local Apple Silicon arm64 vs pipeline
  amd64) causing a package to fail to install or behave differently.
- Missing build secrets/credentials that exist locally (e.g. private
  registry login) but aren't configured in the pipeline.
- File path case-sensitivity differences between local OS and Linux
  runner.

### 5. Pipeline fails during Docker build. What do you check?
- Read the actual failing step's log line, not just the final error.
- Confirm the Dockerfile's base image tag still exists/is reachable from
  the runner (registry rate limits, deprecated tags).
- Check `.dockerignore` isn't excluding a file the build actually needs.
- Check disk space on the runner if the build worked before and now fails
  with a generic error.

### 6. Certificate renewal failed. What do you check?
- If using cert-manager: `kubectl describe certificate <name>` and
  `kubectl describe certificaterequest` for the exact ACME challenge error.
- DNS-01 challenge: confirm the TXT record was actually created and has
  propagated.
- HTTP-01 challenge: confirm the Ingress is routing the ACME solver path
  correctly and isn't blocked by auth or a redirect rule.
- Check rate limits on the certificate authority (Let's Encrypt has strict
  weekly limits per domain).

### 7. Ingress returns 502 or 504. What do you check?
- **502** usually means the backend pod refused the connection or crashed
  mid-request — check pod logs and readiness.
- **504** usually means the backend is too slow / not responding — check
  backend CPU/memory saturation, DB query latency, or a stuck connection
  pool.
- Confirm the Service `targetPort` matches the container's actual listening
  port.
- Check the Ingress controller's own logs, not just the app's.

### 8. Vendor SFTP connection to port 22 times out. What do you check?
- Confirm the security group / firewall on the vendor's side (and ours)
  actually allows port 22 from our egress IP.
- Confirm our outbound route path — is traffic going through a NAT
  Gateway with a known, stable public IP the vendor has allow-listed?
- Test with `nc -zv <host> 22` or `telnet` from a pod/instance in the same
  subnet to isolate network vs application-level failure.
- Check if the vendor's IP allow-list needs updating after our NAT EIP
  changed.

### 9. Terraform plan wants to recreate the cluster. What do you check?
- Read the plan output for which specific attribute is marked
  "# forces replacement".
- Common triggers: cluster name change, VPC/subnet changes that aren't
  purely additive, or a provider version bump changing how a field is
  interpreted.
- Never apply a plan that recreates a production cluster without
  understanding exactly why — see `terraform/README.md` for the full
  checklist.

### 10. How would you upgrade AKS/EKS safely?
- Upgrade the control plane one minor version at a time.
- Upgrade node groups after the control plane, preferably via a new node
  group + drain of the old one (blue/green) rather than in-place upgrade.
- Test in a non-production environment first; check deprecated API usage
  before upgrading.
- Full detail in `terraform/README.md`.

### 11. Frontend loads, but backend API calls fail. What do you check?
- Browser dev tools Network tab — is it CORS, a 4xx/5xx, or a network
  failure (DNS/connection refused)?
- Confirm `BACKEND_URL` (or Ingress path routing) actually points at the
  live backend Service.
- Confirm the backend Service has healthy endpoints
  (`kubectl get endpoints backend`).
- Check CORS configuration on the backend if the browser console shows a
  CORS error.

### 12. Backend pod is running, but database connection times out. What do you check?
- Confirm the backend pod's security group / node security group is
  allowed in the database's security group ingress rule.
- Confirm the pod is actually in a subnet with a route to the database
  (private subnet routing table).
- Confirm `DB_HOST` resolves to the correct private endpoint —
  `kubectl exec` into the pod and run `nslookup $DB_HOST`.
- Check the database isn't at max connections already.

### 13. Private DNS is not resolving database hostname. What do you check?
- Confirm the Route53 private hosted zone is associated with the correct
  VPC (`aws_route53_zone.internal` `vpc` block).
- Confirm CoreDNS in the cluster is configured to forward queries
  correctly and hasn't got a stale cache — `kubectl exec` a debug pod and
  run `nslookup db.internal.local`.
- Confirm the VPC's `enable_dns_support` and `enable_dns_hostnames` are
  both `true`.

### 14. How would you rotate database credentials safely?
- Generate the new password and write it as a new version in AWS Secrets
  Manager (never overwrite in place without a fallback).
- Update the database user's password to match.
- Roll the backend Deployment (`kubectl rollout restart deployment/backend`)
  so new pods pick up the updated Secret — with readiness probes in place,
  old pods keep serving until new ones are healthy, so there's no downtime.
- Revoke/delete the old secret version only after confirming the new one
  works.

### 15. Secrets were accidentally committed to GitHub. What do you do?
- **Rotate the secret immediately** — assume it's compromised the moment
  it hit git history, regardless of repo visibility.
- Remove it from git history (`git filter-repo` or BFG Repo-Cleaner), not
  just delete it in a new commit — a new commit alone leaves it in history.
- Force-push the cleaned history and have all collaborators re-clone.
- Add the file pattern to `.gitignore` and consider a pre-commit secret
  scanner (e.g. gitleaks, trufflehog) to catch it earlier next time.
- Audit access logs for the exposed credential to check for misuse before
  rotation.
