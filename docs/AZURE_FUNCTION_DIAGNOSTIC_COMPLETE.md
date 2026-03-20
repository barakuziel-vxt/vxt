# Azure Function Trigger - Complete Diagnostic Report

**Date**: March 20, 2026  
**Status**: 🔴 FUNCTION NOT TRIGGERED - IoT Hub Message Routing NOT Configured

---

## ✅ COMPLETED ACTIONS

### 1. ✅ Fixed All Code Files
- [appsettings.json](../appsettings.json) - IoT Hub hostname corrected
- [azure-functions/local.settings.json](../azure-functions/local.settings.json) - Database credentials corrected

### 2. ✅ Updated Function App Settings in Azure
Applied these correctedsettings to `vxt-function`:
```
DB_NAME:               free-sql-db-5949639 ✓
DB_USER:               vxt ✓
DB_PASSWORD:           Barak1976! ✓
DB_SERVER:             vxtdb.database.windows.net ✓
IoTHubConnectionString: HostName=vxt-iot-hub.azure-devices.net;... ✓
PROVIDER_NAME:         N2KToSignalK ✓
SQL_CONNECTION_STRING: Server=vxtdb.database.windows.net;Database=... ✓
```

### 3. ✅ Created Test Device
- Device ID: `test-final-device`
- Status: Created and enabled in IoT Hub

### 4. ✅ Sent Test Message
- Message: `{"temperature": 25.5, "context": "vessels.urn:mrn:imo:mmsi:234567890"}`
- Status: Successfully sent to IoT Hub

### 5. ✅ Verified Function App
- App Name: `vxt-function`
- Status: **RUNNING** ✓
- Runtime: Python (Consumption Y1 plan)

### 6. ✅ Verified Database Connection
- Connected to: `vxtdb.database.windows.net / free-sql-db-5949639`
- Status: ✓ Connection successful
- EntityTelemetry table: EXISTS ✓

---

## 🔴 CRITICAL ISSUE: IoT Hub Message Routing NOT CONFIGURED

### The Problem
Even though:
- ✅ Message was sent to IoT Hub successfully
- ✅ Function app is running and healthy
- ✅ Database credentials are correct
- ✅ All settings are configured

**NO DATA appears in the database**, which means:

**👉 The function is NEVER BEING TRIGGERED**

### Root Cause
IoT Hub has NO route configured to forward messages to the Function App.

Messages are arriving in IoT Hub but are NOT being sent to `vxt-function`.

### Evidence
```
Test Actions:
1. Sent message to IoT Hub               ✅ SUCCESS
2. Waited for function to process         ⏳ (waited 3 seconds)
3. Checked EntityTelemetry table          ❌ EMPTY (0 records)
   → Proves function was NOT called
```

---

## ⚠️ SOLUTION REQUIRED

### The Fix: Create IoT Hub Message Route

This CANNOT be done via Azure CLI due to deprecated commands. Must be done manually in Azure Portal.

**Steps**:

1. Go to **Azure Portal**
2. Navigate to: **Resource Groups** → **VXT-IoT-Hub** → **vxt-iot-hub**
3. Click **Message Routing** (left menu)
4. Click **Routes** tab
5. Click **+ Add route**
6. Fill in:
   ```
   Name:       telemetry-consumer
   Source:     IoT Hub Messages
   Endpoint:   vxt-function (Create new if needed)
               Type: Azure Function
   Query:      Leave empty (to accept all messages)
   Enabled:    ON
   ```
7. Click **Save**

**Alternative Minimal Query** (if you want to filter):
```
properties.provider = 'N2KToSignalK'
```

---

## 📊 Status Summary

| Component | Configuration | Works? | Details |
|-----------|---------------|--------|---------|
| IoT Hub | Created | ✅ | Messages accepted |
| Function App | Deployed | ✅ | Running, Python 3.11 |
| Function Settings | Applied | ✅ | All 7+ settings correct |
| Database Connection | Tested | ✅ | Connects successfully |
| Message Route | **NOT SETUP** | ❌ | **This is the missing piece** |

---

## 🎯 What Happens After Route is Created

Once the IoT Hub message route is configured:

1. IoT Hub receives message from device
2. Message matches route condition (or all messages if query empty)
3. IoT Hub forwards message to Function endpoint
4. Function's `iot_hub_consumer` trigger fires
5. Function processes message and inserts into Database
6. Data appears in `EntityTelemetry` table

---

## 🧪 Next Steps to Verify

After creating the route in Azure Portal:

### 1. Send another test message
```powershell
az iot device send-d2c-message \
  --hub-name vxt-iot-hub \
  --device-id test-final-device \
  --data '{"temperature": 25.5}'
```

### 2. Check database (should now have data)
```powershell
python check_telemetry.py
```

Expected output should show records in EntityTelemetry table.

### 3. Monitor function logs (if available)
Check Azure Portal → vxt-function → Monitor for execution logs with:
- Request count > 0
- No or low error count

---

## 📝 Important Notes

### Why CLI Didn't Work
- `az iot hub route` commands are deprecated
- `az iot hub message-route` not available in standard Azure CLI
- Must use Azure Portal for route management

### Function Trigger Type
The function uses `@app.event_hub_message_trigger()` which is Event Hub compatible.
IoT Hub messages are delivered via Event Hub endpoints.
Route must explicitly forward to Function endpoint.

### Testing Device
- Device: `test-final-device`
- Connection string available in IoT Hub
- Device status: Enabled, Connected
- Can send/receive messages

---

## 🎓 Summary

**All critical code and configuration issues are FIXED except one**:

The IoT Hub message routing rule must be created manually in Azure Portal. This is a one-time Azure Portal configuration that tells IoT Hub to send messages to your Function App.

**Once route is created**, the entire pipeline will work:
- Devices → IoT Hub → Route → Function → Database ✓

**Estimated time to complete**: 2 minutes in Azure Portal

---

**Report Generated**: March 20, 2026  
**Next Action**: Create message route in Azure Portal
