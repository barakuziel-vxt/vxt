# Azure Function App Setup Checklist

## Status Summary
The GitHub Actions workflow for deploying the Azure Function App (`vxt-function`) is now fully configured and ready to deploy. The function processes IoT Hub telemetry events and stores them in Azure SQL Database.

**Last Updated**: March 21, 2026  
**Driver Update**: ✅ Switched from pymssql to mssql-python (official Microsoft driver)  
**Workflow**: ✅ [deploy-function-app.yml](.github/workflows/deploy-function-app.yml)

---

## Pre-Deployment Checklist

### ✅ GitHub Repository Setup

- [ ] **Fork/Clone repo**: https://github.com/barakuziel-vxt/vxt
- [ ] **Branch**: Create `prod` branch from `main` (workflow triggers on `prod`)
  ```bash
  git branch prod
  git push origin prod
  ```

### ✅ Azure Resources Created

| Resource | Type | Name | Status |
|----------|------|------|--------|
| Resource Group | Group | `VXT-IoT-Hub` | ✅ Exists |
| Storage Account | Storage | `vxtstorage` | ✅ Exists (required for Function App) |
| IoT Hub | Hub | `vxt-iot-hub` | ✅ Exists |
| SQL Database | Database | `vxtdb` | ✅ Exists |
| Function App | App | `vxt-function` | ⏳ Will be created by workflow |

**Verify resources**:
```powershell
# Check if resources exist
az group show --name VXT-IoT-Hub
az storage account show --name vxtstorage --resource-group VXT-IoT-Hub
az iot hub show --name vxt-iot-hub --resource-group VXT-IoT-Hub
az sql server show --name vxtdb --resource-group VXT-IoT-Hub
```

### ✅ GitHub Secrets Configuration

GitHub Actions needs 3 secrets to deploy. **This is CRITICAL**.

#### Secret 1: AZURE_CREDENTIALS (Service Principal)

1. Create Service Principal:
```powershell
# Get your subscription ID
$subscriptionId = az account show --query id -o tsv

# Create service principal with Contributor role on the resource group
az ad sp create-for-rbac `
  --name "vxt-github-actions" `
  --role Contributor `
  --scopes "/subscriptions/$subscriptionId/resourceGroups/VXT-IoT-Hub"
```

2. Copy the entire JSON output (save as JSON file locally for backup)

3. Add to GitHub:
   - Go to **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `AZURE_CREDENTIALS`
   - Value: Paste the entire JSON from step 1
   - Click **Add secret**

#### Secret 2: DB_PASSWORD (SQL Database Admin Password)

1. Your SQL Database admin password (set when creating the database)

2. Add to GitHub:
   - Go to **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `DB_PASSWORD`
   - Value: `vxtadmin` password (set during DB creation)
   - Click **Add secret**

#### Secret 3: IOT_HUB_CONNECTION_STRING (Event Hub Connection)

1. Get from Azure IoT Hub:
```powershell
# Get Event Hub-compatible endpoint (for consumer functions)
az iot hub connection-string show `
  --name vxt-iot-hub `
  --key-type primary
```

Or via Azure Portal:
- Navigate to **IoT Hub** → **vxt-iot-hub**
- Select **Built-in endpoints** (left menu)
- Copy **Event Hub-compatible connection string**
- Format: `Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...`

2. Add to GitHub:
   - Go to **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `IOT_HUB_CONNECTION_STRING`
   - Value: Paste Event Hub connection string
   - Click **Add secret**

**Verify all 3 secrets are added**:
```bash
# List secrets (doesn't show values, just names)
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/barakuziel-vxt/vxt/actions/secrets
```

### ✅ Azure SQL Database Configuration

#### Firewall Rule: Allow Azure Services
```powershell
# Create firewall rule to allow all Azure services to access SQL
az sql server firewall-rule create \
  --server vxtdb \
  --resource-group VXT-IoT-Hub \
  --name AllowAllWindowsAzureIps \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Verify
az sql server firewall-rule list \
  --server vxtdb \
  --resource-group VXT-IoT-Hub
```

#### Database User & Permissions
```powershell
# Connect to database and verify user exists
sqlcmd -S vxtdb.database.windows.net -d vxtdb -U vxtadmin -P "YourPassword" -Q "SELECT USER_NAME()"

# Via Azure CLI (if user doesn't exist, create it):
# Login to SQL with admin account
sqlcmd -S vxtdb.database.windows.net -d vxtdb -U vxtadmin -P "YourPassword" -Q "
CREATE USER vxtadmin FROM LOGIN vxtadmin;
ALTER ROLE db_owner ADD MEMBER vxtadmin;
"
```

#### EntityTelemetry Table (Required)
```sql
-- Check if table exists
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'EntityTelemetry';

-- If not exists, create it:
CREATE TABLE dbo.EntityTelemetry (
    telemetryId INT PRIMARY KEY IDENTITY(1,1),
    entityId NVARCHAR(255) NOT NULL,
    attributeName NVARCHAR(255),
    attributeValue NVARCHAR(MAX),
    timestamp DATETIME2 DEFAULT GETUTCDATE(),
    createdAt DATETIME2 DEFAULT GETUTCDATE()
);

-- Create index for faster queries
CREATE INDEX idx_entityId ON dbo.EntityTelemetry(entityId);
CREATE INDEX idx_timestamp ON dbo.EntityTelemetry(timestamp);
```

### ✅ Python Dependencies

The Function App requires these packages (in `azure-functions/requirements.txt`):

```txt
azure-functions==1.18.0         # Azure Functions SDK
azure-iot-hub==2.12.0           # IoT Hub SDK
mssql-python>=1.0.0             # Official Microsoft SQL driver ⭐ UPDATED
python-dateutil==2.8.2          # Date utilities
requests==2.31.0                # HTTP library
```

**Key Update**: Switched from `pymssql` to `mssql-python` for:
- ✅ Official Microsoft support
- ✅ No ODBC driver needed
- ✅ Faster deployment (no ODBC install)
- ✅ Future Managed Identity support

---

## Deployment Steps

### Step 1: Prepare Code Changes (Optional)
If you haven't already, make sure the Function App code is in `prod` branch:

```bash
git checkout prod
git log --oneline -5  # Verify you're on prod
```

### Step 2: Trigger Deployment (Two Options)

#### Option A: Manual Trigger (Recommended for first deployment)
1. Go to **GitHub Repository** → **Actions**
2. Find workflow: **"Deploy Azure Function"**
3. Click **"Run workflow"** dropdown
4. Select branch: `prod`
5. Click **"Run workflow"** button
6. Monitor the workflow progress

#### Option B: Automatic Trigger (After secrets are set)
Push changes to `prod` branch:
```bash
git add azure-functions/function_app.py
git commit -m "Update Function App"
git push origin prod  # Triggers workflow automatically
```

Only these files trigger the workflow:
- `azure-functions/function_app.py`
- `azure-functions/requirements.txt`
- `.github/workflows/deploy-function-app.yml`

### Step 3: Monitor Deployment

1. **In GitHub**:
   - Go to **Actions** tab
   - Click the "Deploy Azure Function" workflow run
   - Watch each step complete:
     1. ✅ Checkout code
     2. ✅ Setup Python 3.11
     3. ✅ Install dependencies
     4. ✅ Login to Azure
     5. ✅ Configure App Settings
     6. ✅ Deploy to Azure Function
     7. ✅ Test Health Endpoint

2. **Check Azure Portal**:
   - Go to **Function Apps** → **vxt-function**
   - Check **Status** (should be "Running")
   - Check **Deployment center** (latest deployment)

3. **Monitor Logs**:
   - In Azure Portal: **vxt-function** → **Monitoring** → **Log stream**
   - Or via CLI:
     ```powershell
     az webapp log tail --name vxt-function --resource-group VXT-IoT-Hub
     ```

### Step 4: Verify Success

#### Test 1: Health Endpoint
```bash
curl https://vxt-function.azurewebsites.net/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "provider": "N2KToSignalK",
  "stats": {
    "events_processed": 0,
    "records_inserted": 0,
    "records_skipped": 0,
    "errors": 0
  }
}
```

#### Test 2: Check Configuration
```powershell
# Verify environment variables are set
az functionapp config appsettings list \
  --resource-group VXT-IoT-Hub \
  --name vxt-function
```

Expected output includes:
- `PROVIDER_NAME=N2KToSignalK`
- `DB_SERVER=vxtdb.database.windows.net`
- `DB_NAME=vxtdb`
- `DB_USER=vxtadmin`
- `IoTHubConnectionString=Endpoint=sb://...` (from secret)

#### Test 3: Check Function App Status
```powershell
az functionapp show \
  --name vxt-function \
  --resource-group VXT-IoT-Hub \
  --query "state, lastModifiedTimeUtc"
```

Should return: `"Running"` and recent timestamp

---

## Troubleshooting

### Issue: Workflow Fails to Authenticate
**Error**: `InvalidArgumentsError: Could not authenticate with Azure`

**Cause**: `AZURE_CREDENTIALS` secret is missing or invalid

**Solution**:
1. Verify secret is added: **Settings** → **Secrets** → Check `AZURE_CREDENTIALS` exists
2. Verify JSON format is correct (paste the whole JSON, not partial)
3. Regenerate Service Principal if needed:
   ```powershell
   az ad app delete --id <app-id> # if using old one
   # Run the create-for-rbac command again
   ```

### Issue: Health Endpoint Returns 404
**Error**: `HTTP 404 - Not found`

**Cause**: Function app deployed but endpoint not found

**Solution**:
1. Check Function App is running: `az functionapp show --name vxt-function --resource-group VXT-IoT-Hub`
2. Health endpoint may need time to initialize (wait 30 seconds)
3. Check function logs: `az webapp log tail --name vxt-function --resource-group VXT-IoT-Hub`
4. Redeploy: Push to `prod` branch again

### Issue: Health Endpoint Returns 500
**Error**: `HTTP 500 - Internal Server Error`

**Cause**: Function code is failing (usually database connection)

**Solution**:
1. Check database is accessible:
   ```powershell
   sqlcmd -S vxtdb.database.windows.net -U vxtadmin -d vxtdb -Q "SELECT 1"
   ```

2. Check firewall rule exists:
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

4. Check app settings:
   ```powershell
   az functionapp config appsettings show \
     --name vxt-function \
     --resource-group VXT-IoT-Hub \
     --property-set DB_PASSWORD  # Should mask password
   ```

### Issue: Workflow Succeeds but Function Doesn't Work
**Symptom**: Workflow shows green checkmark, but IoT Hub messages aren't being processed

**Troubleshooting**:
1. Check IoT Hub routing rules are configured:
   ```powershell
   az iot hub route list --hub-name vxt-iot-hub
   ```

2. Send test message:
   ```bash
   # From device or simulator
   az iot device c2d-send --hub-name vxt-iot-hub --device-id <device> \
     --data "test"
   ```

3. Check Function App logs:
   ```powershell
   az webapp log tail --name vxt-function --resource-group VXT-IoT-Hub
   ```

4. Increase logging:
   ```powershell
   az functionapp config appsettings set \
     --name vxt-function \
     --resource-group VXT-IoT-Hub \
     --settings AZURE_FUNCTIONS_ENVIRONMENT=Development
   ```

### Issue: "Unable to connect: Adaptive Server is unavailable"
**Error**: Database connection error from Function

**Root Cause**: pymssql driver (old) or connection string format

**Solution** (Already applied):
- ✅ Updated to `mssql-python` official driver
- ✅ Connection uses correct format for mssql-python
- ✅ No ODBC driver needed
- ✅ Firewall rule allows Azure services

Just ensure deployment is triggered after code update.

---

## Post-Deployment Configuration

### IoT Hub Routing (Required for Function to Receive Messages)

The Function needs IoT Hub routing rules to receive messages. Configure in Azure Portal:

1. Go to **IoT Hub** → **vxt-iot-hub** → **Message routing** (left sidebar)
2. Click **Custom endpoints**
3. Add new endpoint:
   - Type: **Azure Function**
   - Name: `TelemetryProcessor`
   - Function: `vxt-function` → `telemetry_consumer`
4. Click **Create**

4. Add routing rule:
   - Name: `ProcessTelemetry`
   - Data source: **Device Telemetry Messages**
   - Endpoint: `TelemetryProcessor`
   - Query: Leave empty (or add filter like `provider='N2K'`)
   - Click **Create**

### Device Simulator (Optional, for testing)

Test the function with a simulated device:

```python
# test_device_sim.py
import asyncio
from azure.iot.device.aio import IoTHubDeviceClient
from azure.iot.device import Message
import json

async def main():
    connection_string = "HostName=vxt-iot-hub.azure-devices.net;..." 
    device_client = IoTHubDeviceClient.create_from_connection_string(connection_string)
    
    await device_client.connect()
    
    # Send test telemetry
    msg = Message(json.dumps({
        "entityId": "test123",
        "timestamp": "2026-03-21T10:00:00Z",
        "values": {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "speed": 12.5
        }
    }))
    
    await device_client.send_message(msg)
    print("Test message sent!")
    
    await device_client.disconnect()

asyncio.run(main())
```

Run with:
```bash
pip install azure-iot-device
python test_device_sim.py
```

---

## Database Schema Reference

### EntityTelemetry Table
Used to store telemetry data from IoT devices:

```sql
CREATE TABLE dbo.EntityTelemetry (
    telemetryId INT PRIMARY KEY IDENTITY(1,1),
    entityId NVARCHAR(255) NOT NULL,           -- Device ID (MMSI, UUID, etc)
    attributeName NVARCHAR(255),               -- Sensor name (speed, latitude, etc)
    attributeValue NVARCHAR(MAX),              -- Sensor value (can be JSON)
    timestamp DATETIME2,                       -- Event timestamp
    createdAt DATETIME2 DEFAULT GETUTCDATE()   -- Insert timestamp
);
```

### Query Examples
```sql
-- Get latest telemetry for a device
SELECT TOP 10 * FROM dbo.EntityTelemetry 
WHERE entityId = 'device123'
ORDER BY timestamp DESC;

-- Get average speed by device
SELECT entityId, AVG(CAST(attributeValue AS FLOAT)) as avgSpeed
FROM dbo.EntityTelemetry
WHERE attributeName = 'speed'
GROUP BY entityId;

-- Get records from last hour
SELECT * FROM dbo.EntityTelemetry
WHERE timestamp >= DATEADD(hour, -1, GETUTCDATE());
```

---

## Next Steps

1. ✅ **Setup Secrets**: Add 3 GitHub secrets (AZURE_CREDENTIALS, DB_PASSWORD, IOT_HUB_CONNECTION_STRING)
2. ✅ **Create Resources**: Function App will be auto-created by workflow
3. ✅ **Deploy**: Push to `prod` branch or manually trigger workflow
4. ✅ **Configure Routing**: Set up IoT Hub routing to send messages to Function
5. ✅ **Test**: Send test messages and verify data appears in EntityTelemetry table
6. ✅ **Monitor**: Check logs and health endpoint regularly

---

## Related Documentation

- [FUNCTION_APP_DEPLOYMENT_GUIDE.md](./FUNCTION_APP_DEPLOYMENT_GUIDE.md) - Detailed deployment guide
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) - Current deployment status
- [../azure-functions/function_app.py](../azure-functions/function_app.py) - Function source code
- [../azure-functions/requirements.txt](../azure-functions/requirements.txt) - Dependencies
- [../.github/workflows/deploy-function-app.yml](../.github/workflows/deploy-function-app.yml) - GitHub Actions workflow

