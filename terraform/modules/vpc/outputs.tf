output "vpc_id" {
  value = aws_vpc.this.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "private_zone_id" {
  description = "Route53 private hosted zone ID, used by the RDS module for private DNS"
  value       = aws_route53_zone.internal.zone_id
}
