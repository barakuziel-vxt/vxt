Terraform infra scaffold for VXT

Overview
- Provider: `azurerm` (Azure)
- Resources to provision (examples):
  - resource group
  - event hubs namespace + hub (Kafka API)
  - storage account for Functions
  - app service plan + function app
  - azure sql server + database

How to use
1. Set environment variables or use `az login` and `az account set --subscription`.
2. `cd infra`
3. `terraform init`
4. `terraform plan -out=tfplan` and `terraform apply tfplan`

Notes
- This scaffolding uses placeholders. Replace values and add modules as needed.
- Do NOT commit sensitive values. Use GitHub Secrets for CI.
