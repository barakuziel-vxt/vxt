# Azure Function - Critical Issues FIX GUIDE

**Status**: Implementation Guide  
**Date**: March 20, 2026  
**Priority**: 🔴 CRITICAL - Must complete before function can work

---

## ✅ COMPLETED FIXES (Local)

### 1. ✅ Fixed appsettings.json - IoT Hub Hostname
- Changed from `VXT-IoT-Hub.azure-devices.net` to `vxt-iot-hub.azure-devices.net`
- Changed policy from `iothubowner` to `service`

### 2. ✅ Fixed local.settings.json - Database Configuration
- **DB_NAME**: Changed from `vxtdb` → `free-sql-db-5949639` ✓
- **DB_USER**: Changed from `vxtadmin` → `vxt` ✓
- **DB_PASSWORD**: Changed from `Barak1008!` → `Barak1976!` ✓
- **DB_SERVER**: `vxtdb.database.windows.net` ✓

---

## ⚠️ REQUIRED MANUAL FIXES (Azure Portal)

### FIX #1: Configure Function App Application Settings

**Location**: Azure Portal → Resource Groups → VXT-IoT-Hub → vxt-function → Configuration → Application settings

**Currently Missing/Incorrect Settings**:

**These MUST be added:**

```
Name: IoTHubConnectionString
Value: ${IOT_HUB_CONNECTION_STRING}

Name: SQL_CONNECTION_STRING
Value: ${SQL_CONNECTION_STRING}

Name: DB_SERVER
Value: vxtdb.database.windows.net

Name: DB_NAME
Value: free-sql-db-5949639

Name: DB_USER
Value: ${DB_USER}

Name: DB_PASSWORD
Value: ${DB_PASSWORD}

Name: PROVIDER_NAME
Value: N2KToSignalK
```

**Steps**:
1. Go to Azure Portal
2. Navigate to: Resource Groups → VXT-IoT-Hub → vxt-function
3. Click on "Configuration" in the left menu
4. Click on "Application settings" tab
5. Click "+ New application setting" for each setting above
6. Enter Name and Value
7. Click **Save** at the top

---

### FIX #2: Verify/Create IoT Hub Message Routing

**Location**: Azure Portal → Resource Groups → VXT-IoT-Hub → vxt-iot-hub → Message Routing → Routes

**Current State**: ❌ Route does NOT exist (messages not forwarded to function)

**Steps to Create Route**:

1. Go to Azure Portal
2. Navigate to: Resource Groups → VXT-IoT-Hub → vxt-iot-hub
3. Click on "Message Routing" in the left menu
4. Click on "Routes" tab
5. Click **Add route**

**Fill in these values**:
```
Name: telemetry-consumer
Source: IoT Hub Messages
Endpoint: Choose endpoint (may need to create function app endpoint)
  - If no function endpoint exists, click "Add endpoint" first
  - Choose "Azure Function" as the type
  - Select: vxt-function (from dropdown)
Query: Leave empty (or use: properties.provider = 'N2KToSignalK')
Enabled: Toggle ON
```

6. Click **Save**

---

### FIX #3: Verify IoT Hub Event Hub Name (if not working after above fixes)

**Location**: Azure Portal → Resource Groups → VXT-IoT-Hub → vxt-iot-hub → Built-in endpoints

**The Event Hub name in the function code**:
```python
event_hub_name="iothub-ehub-vxt-iot-hu-66946165-82f53700df"
```

**Verification steps**:
1. Go to Azure Portal
2. Navigate to: Resource Groups → VXT-IoT-Hub → vxt-iot-hub
3. Click on "Built-in endpoints" in the left menu
4. Look for "Event Hub-compatible endpoint"
5. Copy the "Event Hub-compatible name"
6. Compare with the hardcoded name in function_app.py

**If different**:
- Update line 348 in [azure-functions/function_app.py)](../azure-functions/function_app.py) with correct name

---

## 🧪 VALIDATION STEPS

### Step 1: Verify Settings Are Saved

```powershell
# List all function app settings
az functionapp config appsettings list \
  --name vxt-function \
  --resource-group VXT-IoT-Hub
```

**Expected output**: Should show all settings including `IoTHubConnectionString`, `SQL_CONNECTION_STRING`, etc.

---

### Step 2: Check Function App Logs

```powershell
# Stream logs in real-time
az functionapp log tail \
  --name vxt-function \
  --resource-group VXT-IoT-Hub
```

**Expected**: Should show startup logs without connection errors

---

### Step 3: Send Test Message to IoT Hub

```powershell
# Create a test device (if not exists)
az iot hub device-identity create \
  --hub-name vxt-iot-hub \
  --device-id test-device-123

# Send test message
az iot device send-d2c-message \
  --hub-name vxt-iot-hub \
  --device-id test-device-123 \
  --data '{"temperature": 25.5, "timestamp": "2026-03-20T12:00:00Z"}'
```

**Expected**: Function logs should show message received and processed

---

### Step 4: Verify Message in Function Logs

After sending test message, check logs again:

```powershell
az functionapp log tail \
  --name vxt-function \
  --resource-group VXT-IoT-Hub
```

**Expected output should include**:
```
[RCV 1] Device: test-device-123 | Body: {"temperature": 25.5...
[PROC 1] Inserted: 1 | Device: test-device-123
```

---

### Step 5: Verify Data in SQL Database

```sql
-- Connect to vxtdb in Azure SQL
-- Query to verify telemetry was inserted

SELECT TOP 10 
  entityId,
  entityTypeAttributeId,
  numericValue,
  stringValue,
  ingestionTimestampUTC
FROM dbo.EntityTelemetry
ORDER BY ingestionTimestampUTC DESC;

-- Expected: Should see your test message data
```

---

## 🎯 QUICK CHECKLIST

Before and after each fix, verify:

- [ ] Function App has `IoTHubConnectionString` setting
- [ ] Function App has `SQL_CONNECTION_STRING` setting  
- [ ] Function App has database credentials (`DB_USER`, `DB_PASSWORD`)
- [ ] IoT Hub Message Routing is configured
- [ ] Route forwards to `vxt-function` endpoint
- [ ] Test message triggers function (visible in logs)
- [ ] Data appears in SQL EntityTelemetry table

---

## 📊 Issue Matrix

| Issue | Root Cause | Fixed? | Location |
|-------|-----------|--------|----------|
| IoT Hub messages not triggering function | Message routing not configured | ⚠️ PENDING | Azure Portal |
| Function cannot connect to IoT Hub | `IoTHubConnectionString` not set | ⚠️ PENDING | Azure Portal |
| Function cannot connect to database | Wrong DB credentials | ✅ FIXED | local.settings.json |
| Function cannot parse IoT Hub name | Hardcoded event hub name | ⚠️ VERIFY | function_app.py line 348 |

---

## 🚀 DEPLOYMENT SEQUENCE

**Order to apply fixes**:

1. ✅ **Done**: Fix appsettings.json (hostname)
2. ✅ **Done**: Fix local.settings.json (database credentials)
3. ⏳ **Next**: Add settings to Function App in Azure Portal (FIX #1)
4. ⏳ **Next**: Configure IoT Hub message routing (FIX #2)
5. ⏳ **Next**: Verify event hub name if needed (FIX #3)
6. ⏳ **Finally**: Run validation tests

---

## 📞 Support Files

- Function code: [azure-functions/function_app.py](../azure-functions/function_app.py)
- Local config: [azure-functions/local.settings.json](../azure-functions/local.settings.json)
- App settings: [appsettings.json](../appsettings.json)
- Original diagnosis: [docs/AZURE_FUNCTION_TRIGGER_DIAGNOSIS.md](AZURE_FUNCTION_TRIGGER_DIAGNOSIS.md)

---

## 🔗 Direct Links to Azure Portal

- **Subscription**: 0d48ff3b-92f5-4d0e-b5d0-73a5e9ffebbb
- **Resource Group**: VXT-IoT-Hub
- **Function App**: vxt-function
- **IoT Hub**: vxt-iot-hub

```powershell
# Direct commands to open Azure Portal
az webapp browse --name vxt-function --resource-group VXT-IoT-Hub
az iot hub monitor-events --hub-name vxt-iot-hub
```
