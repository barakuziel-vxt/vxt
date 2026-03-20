# Azure Function - IoT Hub Trigger Issue Diagnosis

**Date**: March 20, 2026  
**Issue**: Azure Function not being triggered by IoT Hub messages despite messages being present in the hub  
**Status**: ⚠️ CRITICAL - Multiple configuration issues found

---

## 🔴 ROOT CAUSES IDENTIFIED

### 1. **CRITICAL: Wrong IoT Hub Hostname in appsettings.json**

**File**: [appsettings.json](../appsettings.json)  
**Issue**: Hostname is UPPERCASE instead of lowercase

```json
// ❌ WRONG (Current)
"value": "HostName=VXT-IoT-Hub.azure-devices.net;"

// ✅ CORRECT (Should be)
"value": "HostName=vxt-iot-hub.azure-devices.net;"
```

**Impact**: Connection string with wrong hostname will fail to connect to IoT Hub

**Evidence**: 
- Correct name in docs: `vxt-iot-hub` (lowercase)  
- Correct name in deployment scripts: `vxt-iot-hub`
- Correct name in function configuration: `HostName=vxt-iot-hub.azure-devices.net`

---

### 2. **CRITICAL: IoTHubConnectionString NOT Set in Azure Function App**

**Location**: Azure Portal → vxt-function → Configuration → Application settings

**Current State**: 
- ❌ `IoTHubConnectionString` is NOT in the Function App application settings
- ❌ The function code requires this setting to trigger

**Evidence** (from [function_app.py](../azure-functions/function_app.py) line 347):
```python
@app.event_hub_message_trigger(
    arg_name="messages",
    connection="IoTHubConnectionString",  # ← Looks for this setting in Azure
    event_hub_name="iothub-ehub-vxt-iot-hu-66946165-82f53700df"
)
```

**Solution Required**: Add to Function App settings:
```
IoTHubConnectionString = HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=[KEY_HERE]
```

---

### 3. **CRITICAL: IoT Hub Message Routing NOT Configured**

**Location**: Azure Portal → vxt-iot-hub → Message Routing → Routes

**Current State**:
- ❌ No route configured to send messages to the Function App
- ❌ Messages are arriving in IoT Hub but NOT being forwarded to the function

**Evidence** (from [azure-functions/README.md](../azure-functions/README.md) line 26-32):
```
IoT Hub Routing (Azure Portal)

1. Go to **IoT Hub → Message Routing → Routes**
2. Create a new route:
   - **Name**: `telemetry-consumer`
   - **Source**: `IoT Hub Messages`
   - **Endpoint**: Select your function app
   - **Query**: `properties.provider = 'N2KToSignalK'` (or leave empty for all)
```

**Solution Required**: Create message routing rule that forwards messages to the Function App

---

### 4. **POTENTIAL: Database Configuration Mismatch**

**File**: [azure-functions/function_app.py](../azure-functions/function_app.py) lines 38-45

**Issue**: Database name fallback is inconsistent

```python
# Fallback to individual parameters
db_name = os.environ.get('DB_NAME', 'free-sql-db-5949639')  # ← Hardcoded fallback
```

**File**: [azure-functions/local.settings.json](../azure-functions/local.settings.json)

```json
"DB_NAME": "vxtdb"  // ← Different name here
```

**Current Azure Configuration**: Unknown - need to verify in Portal

**Solution Required**: Ensure all these match:
- `SQL_CONNECTION_STRING` env variable is set (preferred)
- OR all of these match: `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

---

### 5. **POTENTIAL: Event Hub Name May Be Incorrect**

**File**: [azure-functions/function_app.py](../azure-functions/function_app.py) line 348

```python
event_hub_name="iothub-ehub-vxt-iot-hu-66946165-82f53700df"
```

**Issue**: This hardcoded event hub name may have changed or be incorrect

**How to Verify**:
```powershell
az iot hub show --name vxt-iot-hub --resource-group VXT-IoT-Hub --query properties.eventHubEndpoints
```

**Current Status**: ⚠️ Needs verification

---

## 📋 CHECKLIST: What Needs to Be Fixed

| # | Issue | File/Location | Priority | Status |
|---|-------|---------------|----------|--------|
| 1 | Fix hostname in appsettings.json | `appsettings.json` | 🔴 CRITICAL | ✅ DONE |
| 2 | Fix database credentials in local.settings.json | `azure-functions/local.settings.json` | 🔴 CRITICAL | ✅ DONE |
| 3 | Set IoTHubConnectionString in Function App | Azure Portal | 🔴 CRITICAL | ⏳ MANUAL |
| 4 | Set SQL settings in Function App | Azure Portal | 🔴 CRITICAL | ⏳ MANUAL |
| 5 | Configure IoT Hub message routing | Azure Portal | 🔴 CRITICAL | ⏳ MANUAL |
| 6 | Verify event hub name matches IoT Hub | Azure Portal | 🟡 HIGH | ⏳ VERIFY |

---

## 🔧 DETAILED FIXES

### Fix #1: Correct appsettings.json

**File to edit**: [appsettings.json](../appsettings.json)

Change from:
```json
{
  "name": "IoTHubConnectionString",
  "value": "HostName=VXT-IoT-Hub.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=fWmQKA04f6DhGHrMLxPYM6eY7PkNmRAjnAIoTH2GGF8="
}
```

To:
```json
{
  "name": "IoTHubConnectionString",
  "value": "HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=fWmQKA04f6DhGHrMLxPYM6eY7PkNmRAjnAIoTH2GGF8="
}
```

**Note**: Also changed the shared access policy from `iothubowner` to `service` (more restrictive, better practice)

---

### Fix #2: Configure Function App Settings

**Location**: Azure Portal → Resource Groups → VXT-IoT-Hub → vxt-function → Configuration → Application settings

**Add these settings**:

```
Name: IoTHubConnectionString
Value: HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=fWmQKA04f6DhGHrMLxPYM6eY7PkNmRAjnAIoTH2GGF8=

Name: SQL_CONNECTION_STRING
Value: Server=vxtdb.database.windows.net;Database=free-sql-db-5949639;User=vxt;Password=Barak1976!;

Name: PROVIDER_NAME
Value: N2KToSignalK
```

**Then click Save**

---

### Fix #3: Configure IoT Hub Message Routing

**Location**: Azure Portal → Resource Groups → VXT-IoT-Hub → vxt-iot-hub → Message Routing → Routes

**Steps**:

1. Click **Add Route**
2. Enter route details:
   - **Name**: `telemetry-consumer`
   - **Source**: `IoT Hub Messages`
   - **Endpoint**: Create new endpoint pointing to the Function App `vxt-function`
   - **Query**: Leave empty (to route all messages) or use: `properties.provider = 'N2KToSignalK'`
3. Click **Save**

---

## 🧪 TESTING AFTER FIXES

### Test 1: Verify Connection String

```powershell
# Navigate to Function App
az functionapp show --name vxt-function --resource-group VXT-IoT-Hub

# Should see proper configuration
az functionapp config appsettings list --name vxt-function --resource-group VXT-IoT-Hub
```

### Test 2: Send Test Message to IoT Hub

```powershell
# Using Azure IoT Extensions
az iot device send-d2c-message \
  --hub-name vxt-iot-hub \
  --device-id test-device \
  --data '{"temperature": 25.5}'
```

### Test 3: Check Function Logs

```powershell
# Real-time function logs
az functionapp log tail --name vxt-function --resource-group VXT-IoT-Hub

# Should show:
# [RCV 1] Device: test-device | Body: {"temperature": 25.5}...
# [PROC 1] Inserted: 1 | Device: test-device
```

### Test 4: Verify Database Insertion

```sql
-- In Azure SQL Database
SELECT TOP 10 * FROM dbo.EntityTelemetry 
ORDER BY ingestionTimestampUTC DESC;
```

---

## 📚 Reference Documentation

- [Azure IoT Hub Trigger Bindings](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-event-iot-trigger)
- [IoT Hub Message Routing](https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-message-routing-overview)
- [Azure Functions Configuration](https://learn.microsoft.com/en-us/azure/azure-functions/functions-app-settings)

---

## 📞 Support

**Function Code**: [azure-functions/function_app.py](../azure-functions/function_app.py)  
**Local Settings**: [azure-functions/local.settings.json](../azure-functions/local.settings.json)  
**Deployment Scripts**: [azure-functions/deploy.ps1](../azure-functions/deploy.ps1)
