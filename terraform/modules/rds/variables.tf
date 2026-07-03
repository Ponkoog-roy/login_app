variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "private_zone_id" {
  description = "Route53 private hosted zone ID for internal DNS records"
  type        = string
}

variable "db_instance_class" {
  type = string
}

variable "db_name" {
  type = string
}

variable "db_username" {
  type = string
}

variable "allowed_security_group_id" {
  description = "Security group ID (EKS nodes) allowed to reach the database on port 5432"
  type        = string
}
