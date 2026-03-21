# Azure Function App - Quick Reference & Deployment Guide

## TL;DR - What You Need to Do

1. **Add 3 GitHub Secrets** (non-negotiable):
   - `AZURE_CREDENTIALS` - Service Principal JSON from Azure
   - `DB_PASSWORD` - Your SQL admin password
   - `IOT_HUB_CONNECTION_STRING` - Connection string from IoT Hub

2. **Push to `prod` branch** (or manually trigger workflow)

3. **Verify health check passes**:
   ```bash
   curl https://vxt-function.azurewebsites.net/api/health
   ```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│            IoT Hub (vxt-iot-hub)                   │
│        (Receives device telemetry)                 │
│                    │                               │
│                    ├─ Routes messages to:          │
│                    │                               │
│                    ▼                               │
│      Azure Function (vxt-function)                │
│       ├─ Trigger: IoT Hub message                 │
│       ├─ Language: Python 3.11                    │
│       └─ Action: Process & store data             │
│                    │                               │
│                    ▼                               │
│      Azure SQL Database (vxtdb)                   │
│       └─ Table: EntityTelemetry                   │
│           • entityId (device ID)                  │
│           • attributeName (sensor type)           │
│           • attributeValue (sensor reading)       │
│           • timestamp (when recorded)             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Current Status

| Component | Status | Last Update |
|-----------|--------|-------------|
| **Function App Code** | ✅ Ready | March 21, 2026 |
| **Database Driver** | ✅ Updated to mssql-python | March 21, 2026 |
| **GitHub Workflow** | ✅ Configured | March 21, 2026 |
| **GitHub Secrets** | ⏳ Pending | (You must add these) |
| **Deployment** | ⏳ Not yet triggered | (Ready when secrets added) |
| **Health Endpoint** | ⏳ Awaiting deployment | (Will be available after deploy) |

---

## Step-by-Step Deployment

### STEP 1: Get Service Principal Credentials

**Run this in PowerShell/Cloud Shell**:
```powershell
# Get subscription ID
$subscriptionId = az account show --query id -o tsv

# Create service principal
az ad sp create-for-rbac `
  --name "vxt-github-actions" `
  --role Contributor `
  --scopes "/subscriptions/$subscriptionId/resourceGroups/VXT-IoT-Hub"
```

**Output (save this JSON)**:
```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

### STEP 2: Get Database Password
```powershell
# You set this when creating the database
# It's the password for the 'vxtadmin' user
# Format: typical SQL server password
# Example: MyP@ssw0rd2024!
```

### STEP 3: Get IoT Hub Connection String
```powershell
# Get Event Hub-compatible connection string
az iot hub connection-string show `
  --name vxt-iot-hub `
  --key-type primary
```

**Output** (looks like):
```
Endpoint=sb://iothub-ns-vxt-iot-hub-xxx-xxxxxx.servicebus.windows.net/;
SharedAccessKeyName=owner;
SharedAccessKey=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=;
EntityPath=vxt-iot-hub
```

### STEP 4: Add Secrets to GitHub

1. Go to **GitHub** → Your repo → **Settings** → **Secrets and variables** → **Actions**

2. Click **"New repository secret"**

3. **Add Secret #1**:
   - Name: `AZURE_CREDENTIALS`
   - Value: Paste entire JSON from Step 1
   - Click "Add secret"

4. **Add Secret #2**:
   - Name: `DB_PASSWORD`
   - Value: Your SQL admin password (vxtadmin's password)
   - Click "Add secret"

5. **Add Secret #3**:
   - Name: `IOT_HUB_CONNECTION_STRING`
   - Value: Paste connection string from Step 3 (entire string with Endpoint=)
   - Click "Add secret"

**Verify**: You should see 3 secrets listed in the Actions secrets.

### STEP 5: Trigger Deployment

**Option A: Manual Trigger** (Recommended for first time)
1. Go to **GitHub** → **Actions**
2. Find workflow: **"Deploy Azure Function"**
3. Click **"Run workflow"** button
4. Select branch: `prod`
5. Click **"Run"** button
6. Watch it deploy (takes 2-3 minutes)

**Option B: Automatic Trigger**
Push changes to `prod` branch (these trigger the workflow):
```bash
git checkout prod
git add .
git commit -m "Deploy Function App"
git push origin prod
```

### STEP 6: Verify Deployment

**Check 1: Workflow in GitHub**
- Go to **Actions** tab
- Click the "Deploy Azure Function" run
- Watch steps complete (should all show ✅ green checks)
- Last step should test health endpoint

**Check 2: Health Endpoint**
```bash
# In PowerShell, CMD, or try online at https://httpie.io/cli

curl https://vxt-function.azurewebsites.net/api/health

# Expected response:
# {
#   "status": "healthy",
#   "provider": "N2KToSignalK",
#   "stats": {
#     "events_processed": 0,
#     "records_inserted": 0,
#     "records_skipped": 0,
#     "errors": 0
#   }
# }
```

**Check 3: Azure Portal**
- Search for **Function Apps**
- Click **vxt-function**
- Check **Status** = "Running"
- Check **Deployment center** = shows recent deployment

**Check 4: Environment Variables**
```powershell
az functionapp config appsettings list \
  --resource-group VXT-IoT-Hub \
  --name vxt-function
```

Should show:
- `PROVIDER_NAME=N2KToSignalK`
- `DB_SERVER=vxtdb.database.windows.net`
- `DB_NAME=vxtdb`
- `DB_USER=vxtadmin`
- `IoTHubConnectionString=Endpoint=sb://...`

---

## Workflow Diagram

```
You: Push/Trigger
    ↓
GitHub: Checkout code (prod branch)
    ↓
GitHub: Setup Python 3.11
    ↓
GitHub: Install dependencies (azure-functions, mssql-python, etc)
    ↓
GitHub: Login to Azure (using AZURE_CREDENTIALS secret)
    ↓
GitHub: Configure app settings (environment variables)
    ↓
GitHub: Deploy function (az functionapp up --build remote)
    ↓
Azure: Build & deploy on server
    ↓
Azure: Start function app
    ↓
GitHub: Test health endpoint (5 attempts, 10sec intervals)
    ↓
Result: ✅ Success or ❌ Failure (check logs)
```

---

## Troubleshooting Quick Fixes

### "InvalidArgumentsError: Could not authenticate"
**Fix**: Missing or invalid AZURE_CREDENTIALS secret
- Verify secret exists in GitHub
- Paste complete JSON (not partial)
- Regenerate if needed

### "Health check failed (HTTP 404)"
**Fix**: Function endpoint not found
- Wait 30 seconds (initialization time)
- Check function logs: `az webapp log tail --name vxt-function --resource-group VXT-IoT-Hub`
- Redeploy

### "Health check failed (HTTP 500)"
**Fix**: Function app crashed (usually database issue)
1. Check database is accessible:
   ```powershell
   sqlcmd -S vxtdb.database.windows.net -U vxtadmin -d vxtdb -Q "SELECT 1"
   ```
2. Check firewall:
   ```powershell
   az sql server firewall-rule show \
     --server vxtdb \
     --resource-group VXT-IoT-Hub \
     --name AllowAllWindowsAzureIps
   ```
3. Check EntityTelemetry table exists:
   ```sql
   SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
   WHERE TABLE_NAME = 'EntityTelemetry'
   ```
4. Check logs: `az webapp log tail --name vxt-function --resource-group VXT-IoT-Hub`

### "Function doesn't receive IoT Hub messages"
**Fix**: Routing not configured
1. Go to **IoT Hub** → **Message routing**
2. Create custom endpoint pointing to Function App
3. Create routing rule that sends data to that endpoint
4. Test with simulated device

---

## Database Table Check

Make sure this table exists in your database:

```sql
-- Run this query in your SQL database
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'EntityTelemetry';

-- If not found, create it:
CREATE TABLE dbo.EntityTelemetry (
    telemetryId INT PRIMARY KEY IDENTITY(1,1),
    entityId NVARCHAR(255) NOT NULL,
    attributeName NVARCHAR(255),
    attributeValue NVARCHAR(MAX),
    timestamp DATETIME2,
    createdAt DATETIME2 DEFAULT GETUTCDATE()
);
```

---

## Important Notes

1. **Branch Name**: Workflow ONLY triggers on `prod` branch, NOT `main`
2. **Secrets Visibility**: GitHub won't show secret values (security)
3. **Function Timeout**: Default 5 minutes for IoT Hub processing
4. **Cold Start**: First request takes 15-30 sec (normal for serverless)
5. **Cost**: Y1 consumption plan ≈ $0/month for light usage

---

## Useful Commands

```powershell
# View function app status
az functionapp show --name vxt-function --resource-group VXT-IoT-Hub

# View recent deployments
az webapp deployment list --name vxt-function --resource-group VXT-IoT-Hub --query "[-5:]"

# View logs
az webapp log tail --name vxt-function --resource-group VXT-IoT-Hub

# Restart function app
az functionapp restart --name vxt-function --resource-group VXT-IoT-Hub

# Check environment variables
az functionapp config appsettings list --name vxt-function --resource-group VXT-IoT-Hub
```

---

## File Locations

| File | Purpose |
|------|---------|
| [azure-functions/function_app.py](../azure-functions/function_app.py) | Main function code |
| [azure-functions/requirements.txt](../azure-functions/requirements.txt) | Python dependencies |
| [.github/workflows/deploy-function-app.yml](../.github/workflows/deploy-function-app.yml) | GitHub Actions workflow |
| [azure-functions/host.json](../azure-functions/host.json) | Azure Functions configuration |

---

## Next Steps (After Deployment)

1. ✅ Configure IoT Hub routing to send messages to Function
2. ✅ Create test device and send telemetry
3. ✅ Verify data appears in EntityTelemetry table
4. ✅ Monitor logs for any processing errors
5. ✅ Set up alerts for function failures

---

## URLS

- **Azure Portal**: https://portal.azure.com
- **GitHub Repository**: https://github.com/barakuziel-vxt/vxt
- **GitHub Actions**: https://github.com/barakuziel-vxt/vxt/actions
- **Web App**: https://vxt-web-app.azurewebsites.net
- **Function App**: https://vxt-function.azurewebsites.net

