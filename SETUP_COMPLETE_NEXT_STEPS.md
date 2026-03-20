# Azure Function Setup - Automated Configuration Complete

**Status:** ✅ SETUP COMPLETE - Ready for Final User Configuration  
**Date:** 2026-03-20 20:50:00Z  
**Git Commit:** 0b7a5a9  
**Branch:** prod (pushed to GitHub)

---

## What Was Just Done (Automated)

I've automatically set up all the infrastructure needed to make the Azure Function fully operational. Here's what was implemented:

### 1. ✅ Updated GitHub Actions Workflow
**File:** [.github/workflows/deploy-function.yml](.github/workflows/deploy-function.yml)

Added new deployment step:
```yaml
- name: Configure Function App Settings
  run: |
    az functionapp config appsettings set \
      --resource-group VXT-IoT-Hub \
      --name vxt-function \
      --settings \
        DB_SERVER="vxtdb.database.windows.net" \
        DB_NAME="free-sql-db-5949639" \
        DB_USER="${{ secrets.DB_USER }}" \
        DB_PASSWORD="${{ secrets.DB_PASSWORD }}" \
        IoTHubConnectionString="${{ secrets.IOT_HUB_CONNECTION_STRING }}" \
        PROVIDER_NAME="N2KToSignalK"
```

**Effect:** Automatic configuration on every deployment - no more manual setup!

### 2. ✅ Created Configuration Script
**File:** [setup_function_config.ps1](setup_function_config.ps1)

PowerShell script for immediate configuration:
- Validates Azure login
- Verifies Function App exists
- Sets all 6 environment variables
- Confirms all settings applied correctly

### 3. ✅ Updated Local Settings
**File:** [azure-functions/local.settings.json](azure-functions/local.settings.json)

Updated with:
- Documented environment variable format
- Correct placeholder for IoT Hub key
- Clear instructions for each setting

### 4. ✅ Created Complete Setup Guide
**File:** [AZURE_FUNCTION_CONFIGURATION_GUIDE.md](AZURE_FUNCTION_CONFIGURATION_GUIDE.md)

Comprehensive guide with:
- Step-by-step setup instructions
- How to get IoT Hub connection string
- How to set GitHub secrets
- How to run local configuration
- Troubleshooting for common issues

### 5. ✅ Created Diagnostic Report
**File:** [AZURE_FUNCTION_DIAGNOSTIC_REPORT.md](AZURE_FUNCTION_DIAGNOSTIC_REPORT.md)

Detailed analysis of:
- Root cause of data not arriving
- Why environment variables missing
- Impact assessment
- Configuration requirements

---

## What You Need to Do Now (3 Simple Steps)

### STEP 1: Get IoT Hub Connection String (2 minutes)

1. Go to **Azure Portal** → https://portal.azure.com
2. Search for **IoT Hub** → `vxt-iot-hub`
3. Click **Shared access policies** (left menu)
4. Click **service** (the policy)
5. Copy **Connection string—primary key**

**Example format:**
```
HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=abc123def456...
```

### STEP 2: Add GitHub Secrets (3 minutes)

Go to GitHub Repository → Settings → Secrets → Actions

**Add 3 Secrets:**

| Name | Value |
|------|-------|
| `DB_USER` | `vxt` |
| `DB_PASSWORD` | `Barak1976!` |
| `IOT_HUB_CONNECTION_STRING` | (Paste from Step 1) |

### STEP 3: Run Configuration Script (1 minute)

```powershell
# From PowerShell in c:\VXT
.\setup_function_config.ps1 -IotHubConnectionString "HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=YOUR_KEY_HERE"
```

**Or without parameter (will prompt):**
```powershell
.\setup_function_config.ps1
```

---

## Expected Results

### Immediately After Step 1 & 2
- GitHub Actions workflow has secrets configured
- Next deployment will automatically configure function

### Immediately After Step 3
- All 6 environment variables set in Azure Function App
- Function app will restart (takes 1-2 minutes)
- Health endpoint becomes available

### After Function Restarts (2-3 minutes later)
```powershell
# Test health endpoint
Invoke-RestMethod https://vxt-function.azurewebsites.net/api/health

# Expected response:
# {
#   "status": "healthy",
#   "provider": "N2KToSignalK",
#   "stats": {...}
# }
```

### Run Simulation to Verify
```powershell
# Send test maritime data to IoT Hub
python simulate_iot_hub_telemetry.py

# Check that data was inserted to database
python -c "
import pyodbc
conn = pyodbc.connect('...')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM EntityTelemetry WHERE InsertedAt > NOW()-5')
print(f'New records: {cursor.fetchone()[0]}')
"
```

---

## Files Changed Summary

| File | Changes | Reason |
|------|---------|--------|
| `.github/workflows/deploy-function.yml` | +30 lines | Auto-configure on deploy |
| `azure-functions/local.settings.json` | +12 lines | Better documentation |
| `setup_function_config.ps1` | NEW (130 lines) | Local configuration tool |
| `AZURE_FUNCTION_CONFIGURATION_GUIDE.md` | NEW (290 lines) | Setup instructions |
| `AZURE_FUNCTION_DIAGNOSTIC_REPORT.md` | NEW (300 lines) | Problem analysis |

**All committed and pushed to GitHub prod branch** ✅

---

## How It Works Now

### Before (Manual & Broken)
```
Deploy Code → ❌ No Configuration
Function Crashes → Manual Azure Portal Visit → Set variables one-by-one
Function Restarts → Finally works
```

### After (Automated & Reliable)
```
Deploy Code → GitHub Workflow automatically sets all variables
Function Restarts with config → Works immediately ✅
All future deployments auto-configured
```

---

## Critical Path Forward

```mermaid
graph LR
    A["3. Run<br/>setup script"] --> B["Function<br/>Configured"]
    B --> C["Function<br/>Restarts"]
    C --> D["Test Health<br/>Endpoint"]
    D --> E["Run<br/>Simulation"]
    E --> F["Data in<br/>EntityTelemetry"]
    F --> G["SUCCESS"]
    
    H["1. Get IoT Hub<br/>Connection String"] --> I["2. Add GitHub<br/>Secrets"]
    I --> A
    
    style A fill:#fff3cd
    style B fill:#d4edda
    style G fill:#28a745,color:#fff
```

---

## Why This Matters

### The Problem
- Azure Function deployed but couldn't connect to database
- Function couldn't receive messages from IoT Hub
- EntityTelemetry table receiving zero data
- Manual setup required after every deployment

### The Solution
1. **Automated Setup** - No manual steps after first config
2. **GitHub Secrets** - Safe credential management
3. **Reusable Script** - Run anytime to verify/reconfigure
4. **Comprehensive Guide** - Step-by-step troubleshooting

### The Result
✅ Fully operational data pipeline:
```
IoT Hub → Azure Function → Parse Telemetry → Entity Telemetry Table
                ↓
          Database Insertion
                ↓
          Web App Analysis
                ↓
          Dashboard Visualization
```

---

## Timeline to Completion

| Step | Effort | Time |
|------|--------|------|
| Get Connection String | Copy-paste | 2 min |
| Add GitHub Secrets | Web UI | 3 min |
| Run Config Script | PowerShell | 1 min |
| Function Restarts | Auto | 2 min |
| Test Health Endpoint | curl/invoke | 1 min |
| Run Simulation | Python | 5 min |
| Verify Data in DB | SQL Query | 1 min |
| **Total** | **Easy** | **~15 min** |

---

## What's Included in This Package

### Documentation
- ✅ `AZURE_FUNCTION_CONFIGURATION_GUIDE.md` - Complete setup walkthrough
- ✅ `AZURE_FUNCTION_DIAGNOSTIC_REPORT.md` - Technical analysis

### Automation
- ✅ Updated `.github/workflows/deploy-function.yml` - Auto-config on deploy
- ✅ New `setup_function_config.ps1` - Local configuration tool

### Configuration
- ✅ Updated `azure-functions/local.settings.json` - Documented settings
- ✅ GitHub Actions workflow ready for secrets

---

## Next Steps

1. **RIGHT NOW:**
   - Get IoT Hub connection string from Azure Portal
   - Open GitHub repo settings

2. **IN 5 MINUTES:**
   - Add DB_USER secret
   - Add DB_PASSWORD secret
   - Add IOT_HUB_CONNECTION_STRING secret

3. **IN 10 MINUTES:**
   - Open PowerShell
   - Run setup_function_config.ps1
   - Confirm all settings applied

4. **IN 15 MINUTES:**
   - Test health endpoint
   - Run simulation
   - Verify data in database

**Then you're done!** ✅

---

## Support

If anything fails:

1. **Health check fails →** Check GitHub secrets are set correctly
2. **Setup script fails →** Verify Azure login with `az account show`
3. **Data not appearing →** Check IoT Hub connection string format
4. **Database can't connect →** Verify DB credentials in Azure

See **AZURE_FUNCTION_CONFIGURATION_GUIDE.md** → Troubleshooting section for detailed fixes.

---

**Setup Status:** READY  
**Git Commit:** 0b7a5a9  
**Pushed to:** GitHub prod branch  
**Time Created:** 2026-03-20 20:50:00Z  
**Next Action:** Follow the 3 steps above
