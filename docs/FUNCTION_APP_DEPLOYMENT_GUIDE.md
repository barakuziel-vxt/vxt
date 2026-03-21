# Azure Function App Deployment Guide

## Overview
The GitHub Actions workflow (`deploy-function-app.yml`) automatically deploys the Azure Function App to handle IoT Hub events and process telemetry data into Azure SQL Database.

---

## Workflow Architecture

```
GitHub Push (prod branch)
         ↓
[1] Checkout code
         ↓
[2] Setup Python 3.11
         ↓
[3] Install Dependencies (azure-functions, pymssql, azure-iot-hub, etc.)
         ↓
[4] Login to Azure (using AZURE_CREDENTIALS secret)
         ↓
[5] Configure App Settings (environment variables at runtime)
         ↓
[6] Deploy Function App (az functionapp up with remote build)
         ↓
[7] Test Health Endpoint (5 retry attempts, 10-second intervals)
         ↓
[8] Log Success/Failure
```

---

## Components

### 1. **Trigger Files**
The workflow triggers on changes to:
- `azure-functions/function_app.py` - Main function code
- `azure-functions/requirements.txt` - Python dependencies
- `.github/workflows/deploy-function-app.yml` - Workflow file itself
- Branch: `prod` only (not main)

### 2. **Environment Variables**
```yaml
FUNCTION_APP_NAME: vxt-function
RESOURCE_GROUP: VXT-IoT-Hub
PYTHON_VERSION: '3.11'
```

### 3. **GitHub Secrets Required**

| Secret | Purpose | Example |
|--------|---------|---------|
| `AZURE_CREDENTIALS` | Azure authentication (JSON format) | Service Principal credentials |
| `DB_PASSWORD` | SQL Database admin password | Your vxtadmin password |
| `IOT_HUB_CONNECTION_STRING` | IoT Hub connection for device twin access | Connection string from IoT Hub |

---

## Setup Instructions

### Step 1: Create Azure Service Principal for GitHub

```powershell
# Using Azure CLI
az ad sp create-for-rbac `
  --name "vxt-github-actions" `
  --role Contributor `
  --scopes /subscriptions/{subscription-id}/resourceGroups/VXT-IoT-Hub
```

**Output** (copy as JSON into GitHub secret):
```json
{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "...",
  "tenantId": "..."
}
```

### Step 2: Add GitHub Secrets

1. Go to: **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Add the following:

**Secret 1: AZURE_CREDENTIALS**
- Name: `AZURE_CREDENTIALS`
- Value: Paste the JSON from Step 1
- Click **Add secret**

**Secret 2: DB_PASSWORD**
- Name: `DB_PASSWORD`
- Value: Your SQL Database admin password
- Click **Add secret**

**Secret 3: IOT_HUB_CONNECTION_STRING**
- Name: `IOT_HUB_CONNECTION_STRING`
- Value: Event Hub-compatible connection string from IoT Hub
- To find it:
  ```powershell
  az iot hub connection-string show --name vxt-iot-hub
  ```
- Click **Add secret**

### Step 3: Create Function App in Azure (if not already created)

```powershell
# Check if function app exists
az functionapp list --resource-group VXT-IoT-Hub

# If not found, create it
az functionapp create \
  --resource-group VXT-IoT-Hub \
  --consumption-plan-location northeurope \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --storage-account vxtstorage \
  --name vxt-function
```

### Step 4: Enable Function App Managed Identity (Recommended for Future)

```powershell
# Enable system-assigned managed identity
az functionapp identity assign \
  --resource-group VXT-IoT-Hub \
  --name vxt-function \
  --identities [system]

# Get Managed Identity Principal ID
az functionapp identity show \
  --resource-group VXT-IoT-Hub \
  --name vxt-function \
  --query principalId -o tsv
```

---

## Deployment Process

### Manual Trigger (if needed)
1. Go to GitHub Repository → **Actions**
2. Find **"Deploy Azure Function"** workflow
3. Click **"Run workflow"** → **"Run"**

### Automatic Trigger
Push changes to the `prod` branch affecting any of:
- `azure-functions/function_app.py`
- `azure-functions/requirements.txt`

```bash
# Example: Deploy after code changes
git checkout prod
git pull origin prod
# Make changes to function_app.py
git add azure-functions/function_app.py
git commit -m "feat: Add new trigger handler"
git push origin prod  # Triggers workflow automatically
```

---

## Workflow Stages Explained

### Stage 1: Setup & Dependencies
```yaml
- Setup Python 3.11
- Install azure-functions framework
- Install pymssql (database driver)
- Install azure-iot-hub (for device twin)
- Install additional dependencies from requirements.txt
```

### Stage 2: Azure Authentication
```yaml
- Login to Azure using AZURE_CREDENTIALS secret
- Authorize all subsequent Azure CLI commands
```

### Stage 3: Configuration
```yaml
- Set environment variables in Function App:
  • PROVIDER_NAME = "N2KToSignalK"
  • DB_SERVER = "vxtdb.database.windows.net"
  • DB_NAME = "vxtdb"
  • DB_USER = "vxtadmin"
  • DB_PASSWORD = (from secret)
  • IoTHubConnectionString = (from secret)
```

### Stage 4: Remote Deployment
```bash
cd azure-functions
az functionapp up \
  --name vxt-function \
  --resource-group VXT-IoT-Hub \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --build remote
```

This command:
- Uploads the code to Azure
- Triggers remote build on Azure servers
- Deploys the compiled function
- Starts the function app automatically

### Stage 5: Health Check
```bash
# Test 5 times, 10 seconds apart
curl https://vxt-function.azurewebsites.net/api/health
# Expected: HTTP 200 (OK)
```

---

## Configuration Details

### App Settings (Environment Variables)

These are set during deployment and read by `function_app.py`:

```python
import os

PROVIDER_NAME = os.environ.get('PROVIDER_NAME')          # N2KToSignalK
DB_SERVER = os.environ.get('DB_SERVER')                  # vxtdb.database.windows.net
DB_NAME = os.environ.get('DB_NAME')                      # vxtdb
DB_USER = os.environ.get('DB_USER')                      # vxtadmin
DB_PASSWORD = os.environ.get('DB_PASSWORD')              # Password from secret
IOT_HUB_CONNECTION_STRING = os.environ.get('IoTHubConnectionString')
```

### Azure Function Triggers

The function uses **IoT Hub Trigger** binding:
- Listens for messages from `vxt-iot-hub`
- Automatically invoked when events arrive
- Processes event payload (JSON)
- Inserts processed data into `EntityTelemetry` table

### Connection Flow

```
Raspberry Pi (Device)
    ↓ (AMQP/MQTT)
IoT Hub (vxt-iot-hub)
    ↓ (Trigger Event)
Azure Function (vxt-function)
    ↓ (SQL Connection)
Azure SQL Database (vxtdb)
    ↓
EntityTelemetry Table (data stored)
```

---

## Troubleshooting

### Issue: "Deployment completed with status 1"
**Cause**: `az functionapp up` failed, but workflow continues

**Check logs**:
```powershell
# View function app logs
az webapp log tail --name vxt-function --resource-group VXT-IoT-Hub

# Or via Azure Portal:
# 1. Go to vxt-function → Monitoring → Log stream
# 2. Look for error messages
```

### Issue: Health Check Returns HTTP 404
**Cause**: Function app is running but `/api/health` endpoint not found

**Solution**:
- Verify `function_app.py` has health check endpoint
- Check `@app.route('/api/health')` decorator is present
- Redeploy: `git push origin prod`

### Issue: Health Check Returns HTTP 500
**Cause**: Function code is failing

**Check**:
1. Database connectivity issues
2. Missing environment variables
3. Connection string format incorrect
4. Database permissions

**Debug**:
```powershell
# SSH into function app (if available)
az webapp ssh --resource-group VXT-IoT-Hub --name vxt-function

# Or check local testing:
cd azure-functions
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
python function_app.py  # Run locally
```

### Issue: "Unable to connect: Adaptive Server is unavailable"
**Cause**: Database connection failure

**Check**:
1. SQL Server firewall allows Azure services:
   ```powershell
   az sql server firewall-rule list --server vxtdb --resource-group VXT-IoT-Hub
   ```
   
2. Firewall rule `AllowAllWindowsAzureIps` should exist:
   ```powershell
   az sql server firewall-rule create \
     --server vxtdb \
     --resource-group VXT-IoT-Hub \
     --name AllowAllWindowsAzureIps \
     --start-ip-address 0.0.0.0 \
     --end-ip-address 0.0.0.0
   ```

3. Database user exists and has correct permissions

### Issue: GitHub Workflow Doesn't Trigger
**Cause**: Changes not in `prod` branch or not in trigger files

**Check**:
- Are you pushing to `prod` branch (not `main`)?
- Did you modify `azure-functions/function_app.py` or `requirements.txt`?
- Is workflow enabled? Go to GitHub → Actions → Ensure workflow is checked

**Force trigger**:
1. Go to GitHub Actions
2. Find "Deploy Azure Function"
3. Click **"Run workflow"** → **"Run"**

---

## Verifying Successful Deployment

### Check 1: Function App Status
```powershell
az functionapp show \
  --resource-group VXT-IoT-Hub \
  --name vxt-function \
  --query state
# Should return: "Running"
```

### Check 2: Health Endpoint
```powershell
curl https://vxt-function.azurewebsites.net/api/health
# Should return: HTTP 200 with JSON response
```

### Check 3: Recent Deployments
```powershell
az webapp deployment list \
  --resource-group VXT-IoT-Hub \
  --name vxt-function \
  --query "[-5:].[active, deploymentId, timestamp, author]"
# Should show recent deployment with active=true
```

### Check 4: Environment Variables
```powershell
az functionapp config appsettings list \
  --resource-group VXT-IoT-Hub \
  --name vxt-function
# Should show PROVIDER_NAME, DB_SERVER, DB_USER, etc.
```

---

## Database Connection Requirements

### Prerequisites
1. ✅ Azure SQL Database: `vxtdb` (must exist)
2. ✅ Database user: `vxtadmin` (must exist)
3. ✅ User permissions: Minimum `db_datareader` + `db_datawriter`
4. ✅ Firewall rule: Allow Azure services (0.0.0.0 - 0.0.0.0)
5. ✅ Network connectivity: Function app can reach database (same region)

### Verify Database Access
```powershell
# Test connection from local machine
$server = "vxtdb.database.windows.net"
$database = "vxtdb"
$user = "vxtadmin"
$password = "YourPassword"

sqlcmd -S $server -d $database -U $user -P $password -Q "SELECT @@VERSION"
```

---

## Performance Considerations

### Cold Start Time
- First invocation: 15-30 seconds
- Subsequent invocations: 100-500 ms
- Runtime: Python 3.11 (relatively fast)

### Scaling Behavior
- **Consumption Plan** (Y1): Auto-scales, up to 200 concurrent executions
- **Cost**: Pay per execution + storage (very cheap for light workloads)

### Optimization Tips
1. Keep `function_app.py` lightweight
2. Reuse database connections (connection pooling)
3. Minimize dependencies in `requirements.txt`
4. Use async functions for I/O-bound operations

---

## Next Steps

1. **Add Secrets** (if not done): Follow "Setup Instructions" above
2. **Test Locally** (optional): Run `python function_app.py` in `azure-functions/` directory
3. **Push to `prod`**: Deploy workflow will trigger automatically
4. **Monitor Deployment**: Check GitHub Actions workflow progress
5. **Verify Success**: Run health check endpoints

---

## Related Documentation

- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) - Current deployment state
- [../azure-functions/function_app.py](../azure-functions/function_app.py) - Function source code
- [../azure-functions/requirements.txt](../azure-functions/requirements.txt) - Dependencies
- [../.github/workflows/deploy-function-app.yml](../.github/workflows/deploy-function-app.yml) - Workflow definition

