# Quick Start: Azure Function GitHub Auto-Deploy

## 5-Minute Setup

### 1. Create GitHub Repo
```bash
# Go to github.com/new
# Name: azure_function
# Visibility: Private
# Create repository
```

### 2. Add These GitHub Secrets
Go to repo **Settings → Secrets and variables → Actions**

| Secret Name | Value |
|---|---|
| **AZURE_CREDENTIALS** | JSON from `az ad sp create-for-rbac --name "vxt-function-deployer" --role Contributor` |
| **DB_PASSWORD** | Your Azure SQL password |
| **AZURE_FUNCTIONAPP_PUBLISH_PROFILE** | From `az functionapp deployment list-publishing-profiles --name vxt-telemetry-consumer --resource-group VXT-IoT-Hub --xml` |
| **IOT_HUB_CONNECTION_STRING** | From `az iot hub connection-string show --hub-name vxt-iot-hub --policy-name "service"` |

### 3. Push to New Repo
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/azure_function.git
git push origin prod
```

### 4. Verify Deployment
- Go to repo **Actions** tab
- Watch workflow run
- Should complete in 2-3 minutes
- Check: `curl https://vxt-telemetry-consumer.azurewebsites.net/api/health`

## What Happens on Every `git push origin prod`

1. ✓ GitHub triggers workflow
2. ✓ Installs Python dependencies
3. ✓ Logs into Azure with secrets
4. ✓ Creates Function App (if needed)
5. ✓ Deploys your code
6. ✓ Runs health check
7. ✓ Done! Function is live

## Troubleshooting

| Problem | Solution |
|---|---|
| Workflow not running | Push includes function code changes (workflow watches function_app.py, requirements.txt) |
| Auth fails | Verify AZURE_CREDENTIALS JSON is valid |
| Function creation fails | Storage account may not exist; create it: `az storage account create --name vxtfnstore --resource-group VXT-IoT-Hub --location northeurope --sku Standard_LRS` |
| Health check fails | Function is starting (has ~30 sec timeout); check status: `az functionapp show --name vxt-telemetry-consumer --resource-group VXT-IoT-Hub` |

## See Full Guide

For detailed steps and troubleshooting: [AZURE_FUNCTION_SETUP.md](./AZURE_FUNCTION_SETUP.md)
