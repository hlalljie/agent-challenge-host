terraform {
  required_version = ">= 1.10.0"

  backend "s3" {
    bucket       = "challenge-host-terraform-472876920765"
    key          = "challenge-host/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.28"
    }
  }
}
