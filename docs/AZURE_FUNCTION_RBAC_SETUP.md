# Azure Function RBAC Setup - Critical Configuration

## ⚠️ REQUIRED: Managed Identity Permissions for Event Hub Access

**Status**: Function App has Managed Identity enabled, but **Event Hub permissions NOT assigned yet**
**Root Cause**: Without these permissions, the IoT Hub trigger cannot receive messages

---

## Step 1: Verify Function App Managed Identity

### In Azure Portal:
1. Navigate to: **vxt-function** → **Identity**
2. Confirm **System Assigned** is **ON** (Status: Enabled)
3. Note the Object ID (Principal ID): This is what needs RBAC permissions

### Via Azure CLI:
```powershell
az functionapp identity show --resource-group VXT-IoT-Hub --name vxt-function --query principalId
```

---

## Step 2: Grant Event Hub Permissions (REQUIRED)

### Option A: Via Azure Portal (Easiest)

1. Navigate to: **VXT-IoT-Hub** (IoT Hub resource) → **Data receivers**
2. Click **Add role assignment**
3. Configure:
   - **Role**: `Azure Event Hubs Data Receiver`
   - **Scope**: Select your resource group
   - **Assign to**: Managed Identity
   - **Member**: Search for `vxt-function` (your function app)
4. Click **Review + Assign**

### Option B: Via Azure CLI

```powershell
# Get the function app's Managed Identity principal ID
$principalId = az functionapp identity show `
  --resource-group VXT-IoT-Hub `
  --name vxt-function `
  --query principalId -o tsv

# Get IoT Hub Event Hub-compatible endpoint resource ID
$iotHubId = az iot hub show `
  --resource-group VXT-IoT-Hub `
  --name VXT-IoT-Hub `
  --query id -o tsv

# Assign "Azure Event Hubs Data Receiver" role
az role assignment create `
  --assignee $principalId `
  --role "Azure Event Hubs Data Receiver" `
  --scope $iotHubId

# Verify the assignment
az role assignment list `
  --assignee $principalId `
  --resource-group VXT-IoT-Hub
```

---

## Step 3: Verify Configuration Alignment

### ✓ Required App Settings (Already Configured)

In Azure Function App → Configuration:

| Setting | Value | Status |
|---------|-------|--------|
| `IoTHubConnectionString` | `Endpoint=sb://ihsuproddbres051dednamespace.servicebus.windows.net/...` | ✅ Set |
| `PYTHON_VERSION` | `3.13` | ✅ Set |
| `FUNCTIONS_EXTENSION_VERSION` | `~4` | ✅ Set |
| `WEBSITE_RUN_FROM_PACKAGE` | `1` | ✅ Set |

### ✓ Required Function Configuration

**File**: `azure-functions/iot_hub_consumer/function.json`

```json
{
  "scriptFile": "../function_app.py",
  "bindings": [
    {
      "type": "iotHubTrigger",
      "name": "messages",
      "direction": "in",
      "path": "events",
      "connection": "IoTHubConnectionString",
      "cardinality": "many",
      "consumerGroup": "$Default",
      "dataType": "string"
    }
  ]
}
```

**Status**: ✅ Aligned (updated deployment)

---

## Step 4: Verify Connectivity

### Test 1: Function App Identity Has Access

```powershell
# Check role assignment was successful
az role assignment list --assignee $principalId `
  --resource-group VXT-IoT-Hub `
  --query "[?roleDefinitionName=='*Event*' || roleDefinitionName=='*Receiver*']"
```

**Expected Output**: Should show one assignment with role containing "Event Hubs Data Receiver"

### Test 2: Send Test Message from Device/Simulator

```powershell
# Send a test C2D message (or d2c telemetry)
az iot device c2d-message send `
  --device-id <DEVICE_ID> `
  --hub-name VXT-IoT-Hub `
  --data "test_message"
```

### Test 3: Monitor Function Logs

```powershell
# Stream live logs from function app
az functionapp log tail --resource-group VXT-IoT-Hub --name vxt-function
```

**Look for**: 
- If successful: Function invocations, message processing logs
- If failing: "Unauthorized" or "403" errors → RBAC not granted
- If failing: "Connection timeout" → Firewall/network issue

---

## Step 5: Troubleshooting

### Problem: "Unauthorized" or "403" Errors

**Cause**: RBAC role not assigned to Managed Identity

**Solution**:
1. Verify function app identity exists: `az functionapp identity show ...`
2. Re-run role assignment command above
3. Wait 1-2 minutes for Azure AD to sync
4. Restart function app: `az functionapp restart --resource-group VXT-IoT-Hub --name vxt-function`

### Problem: "Connection Timeout"

**Cause**: Firewall or network connectivity issue

**Solution**:
1. Verify IoT Hub firewall allows function app subnet
2. Check if Event Hub endpoint is reachable
3. Verify `IoTHubConnectionString` setting is correct

### Problem: No Messages Received (Silent)

**Cause**: IoT Hub routing may not be configured to send messages to this function

**Solution**:
1. Check IoT Hub Route Configuration
2. Verify messages are being sent by device
3. Check Consumer Group `$Default` is not blocked

---

## Step 6: Microsoft Troubleshooting Checklist

Per Azure Functions official guidance, verify:

- ✅ **Storage**: `AzureWebJobsStorage` is valid and reachable
- ✅ **Content Share**: `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` + `WEBSITE_CONTENTSHARE` valid
- ✅ **Timeout**: 10 minutes configured (`functionTimeout` in host.json)
- ✅ **Python Version**: 3.13 (current/supported)
- ✅ **Runtime**: Python v2 programming model with decorators
- ✅ **Managed Identity**: System-assigned enabled
- ✅ **RBAC**: Permissions assigned to Event Hub
- ✅ **Trigger Config**: function.json matches app settings
- ✅ **Consumer Group**: `$Default` (not custom)
- ✅ **Binding Type**: `iotHubTrigger` with `dataType: "string"`

---

## What's Different from Non-Managed Identity

| Item | Without Managed Identity | With Managed Identity |
|------|--------------------------|----------------------|
| Connection String | Contains SAS key or password | Contains only endpoint |
| Credentials | Stored in app settings | Derived from system identity |
| Rotation | Manual updates needed | Automatic (no key rotation needed) |
| Security | Keys in environment | No secrets stored |
| RBAC | Not required | **REQUIRED** |

---

## Resources

- Azure Functions Managed Identity: https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity
- Event Hubs Data Receiver Role: https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#azure-event-hubs-data-receiver
- IoT Hub Troubleshooting: https://learn.microsoft.com/en-us/azure/iot-hub/troubleshoot-connect

---

## Next Action

**BEFORE** testing trigger functionality:

1. ✅ Proceed with Step 1-2 above to grant RBAC permissions
2. ⏳ Wait 2 minutes for Azure AD synchronization
3. ✅ Restart function app to pick up new permissions
4. 🧪 Run connectivity tests (Test 1-3 above)
5. 📊 Monitor logs for message processing
