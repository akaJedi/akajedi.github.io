+++
title = "Code Snippet"
date = 2025-08-19T17:53:43-07:00
draft = false
featured = false
weight = 100  # Lower weight appears first in featured sections
description = ""

tags = []
topics = []
+++

Terraform lets you preview, deploy, and clean up infrastructure with just a few commands.  
Here’s a simple end-to-end example using AWS S3.

<!--more-->

```bash
# 1. Create project folder
mkdir terraform-demo && cd terraform-demo

# 2. Create main.tf with this content:
cat > main.tf <<'EOF'
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = "us-west-2"
}

resource "aws_s3_bucket" "demo" {
  bucket = "demo-${random_id.suffix.hex}"
}

resource "random_id" "suffix" {
  byte_length = 2
}
EOF

# 3. Initialize project
terraform init

# 4. Preview changes
terraform plan

# 5. Apply changes
terraform apply -auto-approve

# 6. Verify resource
aws s3 ls | grep demo

# 7. Clean up
terraform destroy -auto-approve