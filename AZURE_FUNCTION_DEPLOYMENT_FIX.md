# Azure Function Deployment Fix - "Function host is not running"

## Problem
**Error**: "Function host is not running" when accessing https://vxt-function-dmc3h6dkaea0gpaw.northeurope-01.azurewebsites.net/

## Root Cause
The function code has **never been deployed** to the Azure Function App. The app exists but contains no Python code or function bindings.

## Solution Steps

### 1. Configure Runtime Settings (Already Done)
✅ Set `FUNCTIONS_WORKER_RUNTIME=python`
✅ Set `PYTHON_VERSION=3.11`
✅ Restarted function app

### 2. Deploy Function Code

**Option A: Zip Deployment (Recommended)**
```powershell
cd c:\VXT\azure-functions

# Create zip package
Compress-Archive -Path function_app.py, requirements.txt, local.settings.json `
  -DestinationPath "function-deploy.zip" -Force

# Deploy to Azure
az functionapp deployment source config-zip `
  --resource-group VXT-IoT-Hub `
  --name vxt-function `
  --src "c:\VXT\azure-functions\function-deploy.zip"
```

**Option B: Git Deployment**
If Git is configured, push function code:
```powershell
cd c:\VXT\azure-functions
git add .
git commit -m "Deploy Azure Function"
git push origin main
```

### 3. Verify Deployment
```powershell
# Check function app is running
az functionapp show --name vxt-function --resource-group VXT-IoT-Hub --query "state"

# Test health endpoint
curl "https://vxt-function-dmc3h6dkaea0gpaw.northeurope-01.azurewebsites.net/api/health"

# Should return: {"status": "healthy", "version": "1.0"}
```

### 4. Restart Function App
```powershell
az functionapp restart --name vxt-function --resource-group VXT-IoT-Hub
```

## What the Function Does
- **Trigger**: Event Hub (IoT Hub compatible) - listens for device messages
- **Input**: Device telemetry messages from mXzt-iot-hub
- **Processing**: 
  - Parses N2K/SignalK maritime protocol messages
  - Extracts vessel context, temperature, location, etc.
  - Enriches with entity information from database
- **Output**: Inserts records into `dbo.EntityTelemetry` table

## Testing After Deployment
1. Send test message to IoT Hub
2. Check EntityTelemetry table for new records
3. Verify function logs in Azure Portal

## Files Needed for Deployment
- `c:\VXT\azure-functions\function_app.py` - Main function code
- `c:\VXT\azure-functions\requirements.txt` - Python dependencies
- `c:\VXT\azure-functions\local.settings.json` - Settings reference
