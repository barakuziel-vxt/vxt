# Azure Function Trigger - Complete Fix Summary

**Status**: ✅ Automated Fixes Complete | ⏳ Manual Steps Required  
**Commit**: 73eb1a8  
**Date**: March 20, 2026

---

## 🎯 What I Fixed Automatically

### 1. ✅ appsettings.json - IoT Hub Hostname
**File**: [appsettings.json](../appsettings.json)

```diff
- "HostName=VXT-IoT-Hub.azure-devices.net;SharedAccessKeyName=iothubowner;..."
+ "HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;..."
```

**Details**:
- Fixed uppercase hostname `VXT-IoT-Hub` → lowercase `vxt-iot-hub`
- Changed policy from `iothubowner` (admin) to `service` (least privilege)

---

### 2. ✅ local.settings.json - Database Credentials
**File**: [azure-functions/local.settings.json](../azure-functions/local.settings.json)

```json
{
  "DB_SERVER": "vxtdb.database.windows.net",    // Correct
  "DB_NAME": "free-sql-db-5949639",             // ✓ Fixed (was: vxtdb)
  "DB_USER": "vxt",                             // ✓ Fixed (was: vxtadmin)
  "DB_PASSWORD": "Barak1976!"                   // ✓ Fixed (was: Barak1008!)
}
```

**Details**:
- Corrected all database credentials to match actual Azure SQL setup
- Now matches the connection details you provided

---

## 📋 What You Still Need to Do (Azure Portal)

### Task 1: Run the Automation Script

I've created a script that will automatically configure your Function App:

```powershell
cd c:\VXT
./fix-azure-function.ps1
```

**What it does**:
- Adds `IoTHubConnectionString` to Function App settings
- Adds `SQL_CONNECTION_STRING` to Function App settings
- Adds database credentials (`DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`)
- Adds `PROVIDER_NAME` setting
- Verifies all settings are applied

**Requirements**:
- Azure CLI installed and authenticated
- Permission to modify Function App settings

---

### Task 2: Configure IoT Hub Message Routing (Manual)

**Location**: Azure Portal → Resource Groups → VXT-IoT-Hub → vxt-iot-hub → Message Routing → Routes

**Steps**:

1. Click **Add route**
2. Fill in:
   - **Name**: `telemetry-consumer`
   - **Source**: `IoT Hub Messages`
   - **Endpoint**: `vxt-function` (Function App endpoint)
   - **Query**: Leave empty (routes all messages)
3. Click **Save**

**Why**: Without this route, IoT Hub messages won't be forwarded to your function, so it will never trigger.

---

### Task 3: Verify Event Hub Name (Optional - Only if messages still don't arrive)

**Location**: Azure Portal → Resource Groups → VXT-IoT-Hub → vxt-iot-hub → Built-in endpoints

Check if the "Event Hub-compatible name" matches the hardcoded name in the function code:

**Current in code** ([line 348](../azure-functions/function_app.py#L348)):
```python
event_hub_name="iothub-ehub-vxt-iot-hu-66946165-82f53700df"
```

If different, update the function code with the correct name.

---

## 🚀 Complete Workflow

```
1. Run (automated):      ./fix-azure-function.ps1
2. Manual Azure Portal:  Create IoT Hub message routing
3. Test:                 Send test message to IoT Hub
4. Verify logs:          Check function execution logs
5. Success:              Data appears in SQL EntityTelemetry table
```

---

## 🧪 Testing After Fixes

### Test 1: Verify Function App Settings

```powershell
az functionapp config appsettings list \
  --name vxt-function \
  --resource-group VXT-IoT-Hub
```

**Expected**: Should show all 7 settings including `IoTHubConnectionString` and `SQL_CONNECTION_STRING`

---

### Test 2: Send Test Message

```powershell
# Create test device
az iot hub device-identity create \
  --hub-name vxt-iot-hub \
  --device-id test-device-final

# Send test message
az iot device send-d2c-message \
  --hub-name vxt-iot-hub \
  --device-id test-device-final \
  --data '{"temperature": 25.5, "context": "vessels.urn:mrn:imo:mmsi:234567890", "timestamp": "2026-03-20T12:00:00Z"}'
```

---

### Test 3: Monitor Function Logs

```powershell
# Real-time log streaming
az functionapp log tail \
  --name vxt-function \
  --resource-group VXT-IoT-Hub
```

**Expected output**:
```
[RCV 1] Device: test-device-final | Body: {"temperature": 25.5...
[PROC 1] Inserted: 1 | Device: test-device-final
```

---

### Test 4: Verify Database Insert

```sql
-- Connect to Azure SQL Database: vxtdb
-- Run this query:

SELECT TOP 5 
  entityId,
  numericValue,
  stringValue,
  ingestionTimestampUTC
FROM dbo.EntityTelemetry
ORDER BY ingestionTimestampUTC DESC;
```

**Expected**: Should see the test message data inserted

---

## 📚 Documentation Files Created

1. **[docs/AZURE_FUNCTION_TRIGGER_DIAGNOSIS.md](AZURE_FUNCTION_TRIGGER_DIAGNOSIS.md)**
   - Root cause analysis of all 5 issues
   - Detailed explanations of what caused the problem

2. **[docs/AZURE_FUNCTION_FIX_IMPLEMENTATION.md](AZURE_FUNCTION_FIX_IMPLEMENTATION.md)**
   - Step-by-step fix instructions
   - Complete configuration checklist
   - All validation commands

3. **[fix-azure-function.ps1](../fix-azure-function.ps1)**
   - Automation script to apply all Function App settings
   - Includes verification and error handling
   - One command to configure entire Function App

---

## 🔐 Security Notes

- **Passwords in local.settings.json**: Only for local development
- **Azure Portal settings**: Encrypted in Azure vault
- **IoT Hub policy**: Changed from `iothubowner` to `service` (least privilege)
- **SQL connection**: Uses TLS encryption in connection string

---

## 📞 Summary Table

| Component | Issue | Fixed? | Location |
|-----------|-------|--------|----------|
| **appsettings.json** | Wrong IoT Hub hostname | ✅ YES | Commit 73eb1a8 |
| **local.settings.json** | Wrong database credentials | ✅ YES | Commit 73eb1a8 |
| **Function App Settings** | Missing IoTHubConnectionString | ⏳ SCRIPT | Run fix-azure-function.ps1 |
| **Function App Settings** | Missing SQL credentials | ⏳ SCRIPT | Run fix-azure-function.ps1 |
| **IoT Hub Routing** | No route to function | ⏳ MANUAL | Azure Portal |
| **Event Hub Name** | Might be outdated | ⏳ VERIFY | Check if needed |

---

## ✅ Quick Next Steps

```powershell
# 1. Run the automation script
./fix-azure-function.ps1

# 2. Monitor logs while running (in new terminal)
az functionapp log tail --name vxt-function --resource-group VXT-IoT-Hub

# 3. Go to Azure Portal and create IoT Hub message routing
# Then test with:
az iot device send-d2c-message --hub-name vxt-iot-hub --device-id test-device --data '{"temperature": 25.5}'

# 4. Verify data in SQL
# Query: SELECT * FROM dbo.EntityTelemetry ORDER BY ingestionTimestampUTC DESC
```

---

## 🎓 What Went Wrong (Why Function Wasn't Triggering)

1. **Missing Credentials**: Function App didn't have `IoTHubConnectionString` set
2. **No Message Routing**: IoT Hub had no route configured to forward messages to function
3. **Wrong Database Setup**: Function used incorrect username/password/database name  
4. **Wrong Hostname**: appsettings.json had uppercase hostname that couldn't resolve
5. **Incomplete Configuration**: Multiple settings were missing or mismatched

**All root causes are now identified and fixable with the automation script.**

---

**Last Updated**: March 20, 2026  
**Commit**: 73eb1a8  
**Status**: Ready for user to run script and manual Azure Portal configuration
