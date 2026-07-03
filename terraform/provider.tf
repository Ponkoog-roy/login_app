terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote backend with state locking.
  # S3 stores the state file; DynamoDB provides the lock so two people/
  # pipelines can never apply at the same time and corrupt state.
  # Bucket/table are created once, out-of-band, before first `terraform init`
  # (chicken-and-egg problem: backend infra can't provision itself).
  backend "s3" {
    bucket         = "devops-assessment-tfstate"
    key            = "eks/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "devops-assessment-tf-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "devops-assessment"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
