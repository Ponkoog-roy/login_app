output "db_endpoint" {
  description = "Private RDS endpoint (only resolvable/reachable from inside the VPC)"
  value       = aws_db_instance.this.endpoint
  sensitive   = true
}

output "db_private_dns_name" {
  value = aws_route53_record.db.fqdn
}

output "secret_arn" {
  description = "ARN of the Secrets Manager secret holding DB credentials"
  value       = aws_secretsmanager_secret.db.arn
}
