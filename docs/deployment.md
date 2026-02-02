# Deployment (overview)

1. Create GitHub repository and push code
2. Configure GitHub Secrets for Azure credentials (see infra/README)
3. Terraform will create Azure resources (Event Hubs, Function App, SQL Server)
4. GitHub Actions workflows will run `terraform plan` on PRs and `apply` on main (when configured)
5. GitHub Actions will deploy the dashboard (build) and the Azure Function artifacts

Secrets needed in GitHub:
- `AZURE_CREDENTIALS` (Service Principal JSON)
- `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP` (optional depending on workflow)

See the `infra/` README for Terraform instructions.
