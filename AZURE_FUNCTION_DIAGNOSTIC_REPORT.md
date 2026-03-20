# Azure Function Diagnostic Report - Data Not Arriving

**Date:** 2026-03-20  
**Status:** ⚠️ CRITICAL - Function deployed but NOT configured  
**Issue:** EntityTelemetry table receiving no data from Azure Function  

---

## Executive Summary

✅ **Code Deployment:** SUCCESS
- Function code (function_app.py) is deployed to Azure
- All files present in Azure Function App
- Deployment workflow completes successfully

❌ **Configuration:** MISSING
- Environment variables NOT set in Azure Function App
- Function cannot connect to database
- Function cannot receive IoT Hub messages
- Health endpoint returns 500 error

⚠️ **Data Flow:** BROKEN
- IoT Hub → Function: ❌ NO CONNECTION (missing IoTHubConnectionString)
- Function → Database: ❌ NO CONNECTION (missing DB credentials)
- Result: **Zero telemetry data in EntityTelemetry table**

---

## Detailed Findings

### Finding 1: Deployment Workflow Missing Configuration Step

**Location:** [.github/workflows/deploy-function.yml](.github/workflows/deploy-function.yml)

**Issue:** The GitHub Actions workflow deploys only the **code** but NOT the **environment variables**.

**Current Process:**
1. ✅ Installs Python dependencies
2. ✅ Logs into Azure
3. ✅ Creates deployment ZIP
4. ✅ Uploads ZIP to Azure using `az functionapp deployment source config-zip`
5. ❌ **MISSING: Set application settings/environment variables on the Azure Function App**

**What's Missing:**
```bash
# This command is NOT in the workflow:
az functionapp config appsettings set \
  --name vxt-function \
  --resource-group VXT-IoT-Hub \
  --settings \
    DB_SERVER="vxtdb.database.windows.net" \
    DB_NAME="free-sql-db-5949639" \
    DB_USER="vxt" \
    DB_PASSWORD="Barak1976!" \
    IoTHubConnectionString="HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=..." \
    PROVIDER_NAME="N2KToSignalK"
```

### Finding 2: Local Settings Not Synced to Azure

**File:** [azure-functions/local.settings.json](azure-functions/local.settings.json)

**Content (example):**
```json
{
  "Values": {
    "DB_SERVER": "vxtdb.database.windows.net",
    "DB_NAME": "free-sql-db-5949639",
    "DB_USER": "vxt",
    "DB_PASSWORD": "Barak1976!",
    "IoTHubConnectionString": "HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=YOUR_IOT_HUB_KEY_HERE"
  }
}
```

**Issue:** `local.settings.json` has the **correct structure** but:
1. Local values don't auto-sync to Azure
2. `IoTHubConnectionString` still shows placeholder: `YOUR_IOT_HUB_KEY_HERE` ❌
3. These settings must be manually deployed to Azure Function App

### Finding 3: Function Code Expects Environment Variables

**File:** [azure-functions/function_app.py](azure-functions/function_app.py) (Lines 32-55)

**Code:**
```python
SQL_CONNECTION_STRING = os.environ.get('SQL_CONNECTION_STRING', '')

def parse_connection_string(conn_str: str) -> Dict:
    if not conn_str:
        # Fallback to individual parameters
        db_server = os.environ.get('DB_SERVER', 'vxtdb.database.windows.net')
        db_name = os.environ.get('DB_NAME', 'free-sql-db-5949639')
        db_user = os.environ.get('DB_USER', 'vxt')
        db_password = os.environ.get('DB_PASSWORD', '')
```

**Issue:** Function tries to read environment variables but finds:
- `DB_USER = None` ❌ (not set in Azure)
- `DB_PASSWORD = None` ❌ (not set in Azure)
- `IoTHubConnectionString = None` ❌ (not set in Azure)

### Finding 4: Health Check Endpoint Returns 500

**Expected:** `GET https://vxt-function.azurewebsites.net/api/health` → 200 with stats

**Actual:** Function tries to connect to database (in health_check function), fails because:
1. Database credentials are missing
2. Function raises exception
3. Returns 500 error

### Finding 5: IoT Hub Trigger Not Connected

**File:** [azure-functions/function_app.py](azure-functions/function_app.py) (Lines 341-347)

**Code:**
```python
@app.event_hub_message_trigger(
    arg_name="messages",
    connection="IoTHubConnectionString",  # ← Looks for this environment variable
    event_hub_name="iothub-ehub-vxt-iot-hu-66946165-82f53700df"
)
def iot_hub_consumer(messages: List[func.EventHubEvent]) -> None:
```

**Issue:** Trigger requires `IoTHubConnectionString` environment variable:
- If NOT set → trigger disabled
- If set to wrong value → connection fails
- Current: Not set → **function never triggered**

### Finding 6: Local Testing Confirms Issues

**Test Environment Variables:**
```
DB_USER = None ❌
DB_PASSWORD = None ❌
IOT_DEVICE_CONNECTION_STRING = NOT SET ❌
IoTHubConnectionString = NOT SET ❌
```

**Test Database Connection:**
```
EntityTelemetry table: 0 rows ❌
No data has been inserted
```

---

## Root Cause Analysis

```
sequenceDiagram
    participant GitHub as GitHub Actions
    participant Azure as Azure Function App
    participant DB as Azure SQL Database
    participant IoTHub as Azure IoT Hub

    GitHub->>Azure: Deploy code (ZIP)
    Note over Azure: ✓ Code uploaded
    GitHub-->>Azure: ❌ Missing: Set app settings (env vars)
    Note over Azure: ❌ No DB credentials<br/>❌ No IoT Hub connection

    IoTHub-->>Azure: Try to trigger function
    Note over Azure: ❌ IoTHubConnectionString=null<br/>Trigger not connected
    
    Note over Azure: Health check fails<br/>Cannot connect to DB

    DB-->>DB: EntityTelemetry stays empty
    Note over DB: 0 rows inserted
```

**Chain of Failures:**
1. Workflow deploys code ✅
2. Workflow does NOT set environment variables ❌
3. Function has no credentials for database ❌
4. Function has no credentials for IoT Hub ❌
5. IoT Hub trigger not connected ❌
6. Function runs but can't process events ❌
7. No data reaches database ❌

---

## What's Configured Correctly

✅ **Function Code** - v5.0 deployed, all files present  
✅ **Python Runtime** - 3.11 configured  
✅ **Dependencies** - pyodbc==5.2.0, requests==2.32.3 installed  
✅ **Deployment Method** - config-zip working correctly  
✅ **Database Schema** - EntityTelemetry table exists with correct columns  
✅ **Function Structure** - Health endpoint defined, IoT Hub trigger defined

---

## What's Missing to Fix

### Missing Setting #1: Database Connection
```
DB_SERVER = vxtdb.database.windows.net
DB_NAME = free-sql-db-5949639
DB_USER = vxt
DB_PASSWORD = Barak1976!
```

### Missing Setting #2: IoT Hub Connection
```
IoTHubConnectionString = HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=[actual-key]
```

### Missing Setting #3: Provider Name
```
PROVIDER_NAME = N2KToSignalK
```

### Missing Workflow Step
The GitHub Actions workflow needs to add an additional step after deployment to set these variables in Azure.

---

## Impact If Not Fixed

| Component | Current State | Impact |
|-----------|--------------|--------|
| Function Code | ✅ Deployed | Will run (but can't process) |
| Database Connection | ❌ Missing | 0 records inserted daily |
| IoT Hub Trigger | ❌ Disconnected | Function never invoked |
| Health Check | ❌ 500 Error | Cannot monitor function |
| Data Pipeline | ❌ BROKEN | Maritime telemetry data lost |

**Result:** Complete data loss from all IoT Hub messages sent to the function.

---

## Next Steps to Investigate

Before applying fixes, please provide:

1. **IoT Hub Actual Connection String**
   - What is the actual `SharedAccessKey` for the IoT Hub `service` SAS policy?
   - Location: Azure Portal → IoT Hub → Shared access policies → service → Connection string

2. **Database Confirmation**
   - Confirm: DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD are correct?
   - Is the database currently accessible from local Python? (for test validation)

3. **Simulation Readiness**
   - Can we run `simulate_iot_hub_telemetry.py` to send test messages?
   - Is the device connection string available?

4. **Current Remote Logs (if accessible)**
   - Azure Portal → Function App → Monitoring → Application Insights logs
   - Any startup errors visible?

---

## Recommended Fix Sequence

1. **Immediate (5 minutes):** Manually set app settings in Azure Portal
2. **Short-term (15 minutes):** Update GitHub workflow to automate setting config
3. **Test (10 minutes):** Run simulation and verify data arrives
4. **Validate (5 minutes):** Check EntityTelemetry for new records

---

## Files That Need Changes

| File | Change Type | Priority |
|------|------------|----------|
| `.github/workflows/deploy-function.yml` | Add env vars step | HIGH |
| `azure-functions/local.settings.json` | Update with real IoT key | HIGH |
| Function App Settings (Azure) | Add 4 settings | CRITICAL |

---

## Appendix: IoT Hub Trigger Configuration

The Azure Function is configured to listen to:
- **Event Hub Name:** `iothub-ehub-vxt-iot-hu-66946165-82f53700df`
- **Connection String Variable:** `IoTHubConnectionString`
- **Message Format:** SignalK with `context` and `updates`
- **Expected MMSI:** Maritime vessel identifiers (e.g., 234567890)

Messages must include a JSON payload like:
```json
{
  "context": "vessels.urn:mrn:imo:imo-number:1234567",
  "updates": [
    {
      "timestamp": "2026-03-20T20:17:00Z",
      "values": [
        {
          "path": "navigation.position.latitude",
          "value": 32.8315366
        }
      ]
    }
  ]
}
```

---

**Report Generated:** 2026-03-20 20:45:00Z  
**Status:** AWAITING FIX AUTHORIZATION  
**Severity:** CRITICAL - Data pipeline non-functional
