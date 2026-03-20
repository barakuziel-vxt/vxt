# Azure Function Configuration - Complete Setup Guide

**Status:** ✅ Automated setup ready - follow these steps to complete

**Date:** 2026-03-20  
**Version:** v1.0

---

## Overview

The Azure Function v5.0 is deployed with all code files present. To enable it to process telemetry data and store it in the database, you need to configure 5 environment variables. This guide walks you through the process.

---

## 📋 What You Need to Complete

| Item | Status | Action |
|------|--------|--------|
| **IoT Hub Connection String** | ⏳ NEEDED | Get from Azure Portal |
| **GitHub Secrets** | ⏳ NEEDED | Add to GitHub repository |
| **Local Setup Script** | ✅ READY | Run PowerShell script locally |
| **Azure App Settings** | ⏳ NEEDED | Script will set automatically |

---

## Step 1: Get IoT Hub Connection String

### Location in Azure Portal

1. Open **Azure Portal** → https://portal.azure.com
2. Navigate to **IoT Hub** → `vxt-iot-hub`
3. Click **Shared access policies** (left sidebar)
4. Click **service** policy
5. Copy **Connection string—primary key**

### Expected Format

```
HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Save this value** - you'll need it in the next steps.

---

## Step 2: Set GitHub Secrets

GitHub Actions workflow requires these secrets to deploy and configure automatically:

### GitHub UI Method

1. Go to GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Create these 3 secrets:

#### Secret 1: `DB_USER`
- **Name:** `DB_USER`
- **Value:** `vxt`

#### Secret 2: `DB_PASSWORD`
- **Name:** `DB_PASSWORD`
- **Value:** `Barak1976!`

#### Secret 3: `IOT_HUB_CONNECTION_STRING`
- **Name:** `IOT_HUB_CONNECTION_STRING`
- **Value:** (Paste the connection string from Step 1)

### GitHub CLI Method (Alternative)

```powershell
# From VXT folder
gh secret set DB_USER --body "vxt"
gh secret set DB_PASSWORD --body "Barak1976!"
gh secret set IOT_HUB_CONNECTION_STRING --body "HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=..."
```

---

## Step 3: Run Local Configuration Script

Once secrets are set in GitHub, apply configuration to the Azure Function App:

### Prerequisites
- Azure CLI installed
- Logged into Azure: `az login`
- Current directory: `c:\VXT`

### Run Setup Script

```powershell
# Option 1: With IoT Hub connection string parameter
.\setup_function_config.ps1 -IotHubConnectionString "HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=..."

# Option 2: Script will prompt for connection string
.\setup_function_config.ps1
```

### Expected Output
```
✓ Logged in as: your.email@domain.com
✓ Function App found: vxt-function
✓ DB_SERVER: SET
✓ DB_NAME: SET
✓ DB_USER: SET
✓ DB_PASSWORD: SET
✓ IoTHubConnectionString: SET
✓ PROVIDER_NAME: SET

✓✓✓ All settings configured successfully! ✓✓✓
```

---

## Step 4: Verify Configuration

### Option A: Test Health Endpoint (PowerShell)

```powershell
Invoke-RestMethod -Uri "https://vxt-function.azurewebsites.net/api/health" -ErrorAction SilentlyContinue
```

**Expected Response:**
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

### Option B: Check Azure Portal

1. Function App → **Overview**
2. Should show: **Status: Running**
3. Should show: **URL: https://vxt-function.azurewebsites.net**

### Option C: Check Application Insights

1. Function App → **Monitoring** → **Application Insights**
2. Look for recent telemetry logs
3. Should see database connection attempts

---

## Step 5: Test End-to-End Data Flow

### Run IoT Hub Simulation

```powershell
# From c:\VXT
python simulate_iot_hub_telemetry.py
```

This sends test maritime telemetry data to Azure IoT Hub, which triggers the function.

### Check Database for Data

```powershell
# Query EntityTelemetry table
python -c "
import pyodbc

conn_str = 'DRIVER={ODBC Driver 17 for SQL Server};SERVER=tcp:vxtdb.database.windows.net,1433;DATABASE=free-sql-db-5949639;UID=vxt;PWD=Barak1976!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;'
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

# Count total rows
cursor.execute('SELECT COUNT(*) as total, MAX(InsertedAt) as latest FROM EntityTelemetry')
result = cursor.fetchone()
print(f'Total telemetry records: {result[0]}')
print(f'Latest insertion: {result[1]}')

conn.close()
"
```

**Expected Output:**
```
Total telemetry records: 5
Latest insertion: 2026-03-20 20:45:30.123456
```

---

## Step 6: Ongoing Automation

After you set the GitHub secrets, all future deployments will:

1. ✅ Deploy code (ZIP upload)
2. ✅ Install dependencies
3. ✅ **Automatically configure app settings** (NEW!)
4. ✅ Test health endpoint

**No manual configuration needed for future deploys!**

---

## What Changed in This Release

### Files Modified

1. **[.github/workflows/deploy-function.yml](.github/workflows/deploy-function.yml)**
   - Added: "Configure Function App Settings" step
   - Uses GitHub secrets to automatically set environment variables
   - Runs after code deployment completes

2. **[azure-functions/local.settings.json](azure-functions/local.settings.json)**
   - Updated: Added documentation comments
   - Updated: IoT Hub key placeholder clarification
   - Can now be safely checked into Git (placeholder shown)

3. **[setup_function_config.ps1](setup_function_config.ps1)** (NEW)
   - Standalone script to configure function app
   - Validates all settings are properly applied
   - Provides detailed error messages

### How It Works

**Old Flow (Manual):**
```
Push code → Workflow deploys ZIP → ❌ STOP (missing config)
→ Manually go to Azure Portal → Set each variable → Wait for restart
```

**New Flow (Automated):**
```
Push code → Workflow deploys ZIP → ✅ Automatically sets all variables
→ Function app restarts with config → Health check passes
→ IoT Hub trigger activates → Data flows to database ✅
```

---

## Troubleshooting

### Problem: "Function is returning 500 Error"

**Cause:** Database or IoT Hub credentials missing

**Fix:**
```powershell
# Re-run the setup script with correct credentials
.\setup_function_config.ps1 -IotHubConnectionString "HostName=...;SharedAccessKey=..."
```

### Problem: "No data in EntityTelemetry after simulation"

**Cause:** IoT Hub connection string incorrect

**Steps:**
1. Double-check the connection string in Azure Portal
2. Ensure `SharedAccessKey` is the full key, not truncated
3. Re-run setup script with correct value
4. Function restarts automatically (~2 minutes)
5. Re-run simulation

### Problem: "GitHub workflow fails at configuration step"

**Cause:** Secrets not set or formatted incorrectly

**Fix:**
1. Go to GitHub → Settings → Secrets
2. Verify `IOT_HUB_CONNECTION_STRING` exists
3. Verify it starts with `HostName=`
4. Re-run workflow (or push dummy commit to trigger)

### Problem: "Can't connect to database from function"

**Cause:** Database credentials wrong or network access issue

**Check:**
```powershell
# Test locally first
python -c "import pyodbc; pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=tcp:vxtdb.database.windows.net,1433;DATABASE=free-sql-db-5949639;UID=vxt;PWD=Barak1976!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;')"
```

If that fails, database credentials are wrong.

---

## Summary of Required Actions

| # | Action | Effort | Time |
|---|--------|--------|------|
| 1 | Get IoT Hub connection string from Azure Portal | 2 min | Copy-paste |
| 2 | Add 3 GitHub secrets | 3 min | GitHub UI |
| 3 | Run setup script locally | 1 min | PowerShell |
| 4 | Test health endpoint | 1 min | Verify working |
| 5 | Run simulation and verify data | 5 min | Full test |

**Total Time: ~15 minutes**

---

## What's in the Function Now

| Component | Status | Details |
|-----------|--------|---------|
| Code | ✅ Deployed | function_app.py, requirements.txt |
| Health Endpoint | ✅ Available | GET /api/health |
| IoT Hub Trigger | ⏳ Waiting | Needs IoTHubConnectionString config |
| Database Connection | ⏳ Waiting | Needs DB credentials config |
| Telemetry Processing | ⏳ Waiting | Will activate after config |
| Data Storage | ❌ No data yet | Will populate after simulation |

---

## Files Created/Modified This Session

✅ **Created:**
- `setup_function_config.ps1` - Local configuration script
- `AZURE_FUNCTION_CONFIGURATION_GUIDE.md` - This guide

✅ **Modified:**
- `.github/workflows/deploy-function.yml` - Added auto-configuration step
- `azure-functions/local.settings.json` - Updated with documentation

---

## Next Steps After Configuration

Once configuration is complete:

1. **Daily Monitoring**
   - Check health endpoint: `/api/health`
   - Monitor Application Insights logs
   - Query EntityTelemetry table for data volume

2. **Production Readiness**
   - Configure alerts on function failures
   - Set up backup credentials for database
   - Document runbook for operations team

3. **Data Flow**
   - Maritime IoT devices → Azure IoT Hub
   - Azure IoT Hub → Azure Function trigger
   - Azure Function → Parse and insert data
   - Data → EntityTelemetry table in Azure SQL
   - Analytics → Web App dashboard

---

**Status:** Configuration Ready  
**Created:** 2026-03-20 20:45:00Z  
**Version:** v1.0  
**Automated Setup:** ✅ YES
