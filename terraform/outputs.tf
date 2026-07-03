output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS control plane API endpoint"
  value       = module.eks.cluster_endpoint
}

output "ecr_repository_urls" {
  description = "URLs of the ECR repositories (backend, frontend)"
  value       = module.ecr.repository_urls
}

output "vpc_id" {
  description = "ID of the VPC created for this platform"
  value       = module.vpc.vpc_id
}

output "rds_endpoint" {
  description = "Private endpoint of the RDS database (only reachable from inside the VPC)"
  value       = module.rds.db_endpoint
  sensitive   = true
}
