# Root module - wires together custom modules only (no third-party modules,
# per assessment rules). Each module lives under ./modules/<name>.

module "vpc" {
  source = "./modules/vpc"

  environment  = var.environment
  cluster_name = var.cluster_name
  vpc_cidr     = var.vpc_cidr
}

module "eks" {
  source = "./modules/eks"

  environment         = var.environment
  cluster_name        = var.cluster_name
  kubernetes_version  = var.kubernetes_version
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  public_subnet_ids   = module.vpc.public_subnet_ids
  node_instance_type  = var.node_instance_type
  node_min_size       = var.node_min_size
  node_max_size       = var.node_max_size
  node_desired_size   = var.node_desired_size
}

module "ecr" {
  source = "./modules/ecr"

  environment      = var.environment
  repository_names = ["devops-assessment-backend", "devops-assessment-frontend"]
}

module "rds" {
  source = "./modules/rds"

  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  private_zone_id       = module.vpc.private_zone_id
  db_instance_class     = var.db_instance_class
  db_name               = var.db_name
  db_username           = var.db_username
  # Only the EKS node security group may reach the database - enforced
  # by the security group rule inside the rds module.
  allowed_security_group_id = module.eks.node_security_group_id
}
