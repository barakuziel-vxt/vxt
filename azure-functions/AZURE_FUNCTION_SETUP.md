# Azure Function Auto-Deployment Setup

## Overview

This guide shows how to set up automated deployment of the Azure Function whenever you push code to the `prod` branch.

## Architecture

```
Your Machine
  ↓
git push origin prod (azure_function repo)
  ↓
GitHub Actions Trigger
  ↓
1. Build (install dependencies)
2. Login to Azure (using AZURE_CREDENTIALS secret)
3. Create Function App (if not exists)
4. Deploy code to Function App
5. Test health endpoint
  ↓
Azure Function running and ready
```

## Step 1: Create New GitHub Repository

### Option A: In GitHub UI (Easiest)

1. Go to [github.com/new](https://github.com/new)
2. **Repository name**: `azure_function`
3. **Description**: `Azure Function for IoT Hub Telemetry Consumer`
4. **Visibility**: Private (recommended) or Public
5. **Initialize**: Don't initialize (we'll push existing code)
6. Click **Create repository**

### Option B: Via GitHub CLI

```bash
gh repo create azure_function --private --source=. --remote=origin --push
```

## Step 2: Set Up GitHub Secrets

Go to: **Settings → Secrets and variables → Actions → New repository secret**

Add these secrets:

### Required Secrets

1. **AZURE_CREDENTIALS** (most important)
   ```json
   {
     "clientId": "YOUR_APP_ID",
     "clientSecret": "YOUR_CLIENT_SECRET",
     "subscriptionId": "YOUR_SUBSCRIPTION_ID",
     "tenantId": "YOUR_TENANT_ID"
   }
   ```
   
   **How to get these:**
   ```bash
   az ad sp create-for-rbac --name "vxt-function-deployer" \
     --role Contributor \
     --scopes /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/VXT-IoT-Hub
   ```

2. **AZURE_FUNCTIONAPP_PUBLISH_PROFILE**
   ```bash
   az functionapp deployment list-publishing-profiles \
     --name vxt-telemetry-consumer \
     --resource-group VXT-IoT-Hub \
     --xml
   ```
   Copy the entire XML output as the secret value.

3. **DB_PASSWORD**
   - Your Azure SQL database password (for vxtadmin user)

4. **IOT_HUB_CONNECTION_STRING** (optional)
   ```bash
   az iot hub connection-string show \
     --hub-name vxt-iot-hub \
     --policy-name "service"
   ```

## Step 3: Add Workflow File

The workflow file is already in `.github/workflows/deploy.yml`. Just commit and push:

```bash
git add .github/
git commit -m "Add: GitHub Actions workflow for Azure Function deployment"
git push origin prod
```

## Step 4: Monitor Deployment

### Watch the workflow running

1. Go to your GitHub repo
2. Click **Actions** tab
3. You should see "Deploy Azure Function" workflow running
4. Click on it to see detailed logs

### What the workflow does

✓ **On every push to `prod` branch:**
1. Checkout code
2. Set up Python 3.11
3. Install dependencies
4. Login to Azure using secrets
5. Create Function App (if needed)
6. Configure App Settings
7. Deploy code
8. Test health endpoint (5 retries, 10 sec intervals)

### Expected success output

```
✓ Azure Function deployed and tested successfully
```

### Check deployment status

```bash
# View function app
az functionapp show --name vxt-telemetry-consumer \
  --resource-group VXT-IoT-Hub \
  --query "{name: name, state: state, url: defaultHostName}"

# View last deployment
az webapp deployment list \
  --name vxt-telemetry-consumer \
  --resource-group VXT-IoT-Hub \
  --query "[0].{timestamp: received_time, status: status}"

# View function logs
az functionapp log tail \
  --name vxt-telemetry-consumer \
  --resource-group VXT-IoT-Hub
```

## Step 5: Verify Auto-Deployment

Make a simple change to test:

```bash
# Edit function_app.py
echo "# Test comment" >> function_app.py

# Commit and push
git add function_app.py
git commit -m "Test: Trigger deployment workflow"
git push origin prod

# Watch the workflow
gh run watch --web
```

## Troubleshooting

### Workflow not triggering

**Cause**: File path doesn't match workflow trigger
```yaml
paths:
  - 'function_app.py'
  - 'requirements.txt'
  - '.github/workflows/deploy.yml'
```

**Solution**: Make sure you edit one of these files to trigger workflow

### Authentication failure

**Error**: `Error: Deployment failed. AuthenticationFailed`

**Solution**: Verify AZURE_CREDENTIALS secret:
```bash
az account show  # Should work if logged in
```

### Function app creation fails

**Error**: `ResourceNotFound` for storage account

**Solution**: Workflow creates storage automatically. If it fails:
```bash
az storage account create --name vxtfnstore \
  --resource-group VXT-IoT-Hub --location northeurope --sku Standard_LRS
```

### Health check fails

**Error**: `Function health check failed`

**Solution**: Function needs time to start (includes Python cold start). Workflow retries automatically.

Check manually:
```bash
curl https://vxt-telemetry-consumer.azurewebsites.net/api/health
```

## Security Best Practices

✓ **Secrets are encrypted** - GitHub never shows them in logs
✓ **Rotate secrets regularly** - Update every 90 days
✓ **Limit scope** - AZURE_CREDENTIALS only needs Function App access
✓ **Use service principal** - Don't use personal account credentials

## Managing Multiple Environments

### Deploy to staging first

Modify `.github/workflows/deploy.yml` to test on staging:

```yaml
env:
  FUNCTION_APP_NAME: vxt-telemetry-consumer-staging  # Staging
```

Then promote to production when tested.

## Next Steps

1. ✓ Create GitHub repo `azure_function`
2. ✓ Add GitHub secrets
3. ✓ Push code with workflow file
4. ✓ Test auto-deployment
5. Set up IoT Hub routing to point to function
6. Monitor function execution logs
7. Set up alerts for failures

## References

- [GitHub Actions for Azure](https://github.com/azure/actions)
- [Azure Functions and GitHub Actions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-continuous-deployment)
- [Azure CLI Authentication](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli)
