"""
DEVICE TWIN ARCHITECTURE - DEPLOYMENT GUIDE

This guide explains how to deploy the Device Twin-based configuration system
that allows Azure IoT Hub to manage setup on cloud and edge devices.

ARCHITECTURE OVERVIEW:
├─ MSSQL (Single Source of Truth)
│  └─ Dashboard admin manages provider setup
├─ SetupExporter Service
│  └─ Exports MSSQL config as JSON
├─ FastAPI /api/setup Endpoints
│  ├─ GET /api/setup/export/{provider} → Get JSON from MSSQL
│  └─ POST /api/setup/sync/{device_id}/{provider} → Update Device Twin
├─ Azure Device Twin
│  ├─ properties.desired.setup → JSON config cached on device
│  └─ MQTT twin/delta topic notifies device of changes
├─ Azure Function (SignalK)
│  ├─ Tries Device Twin mode first (no DB queries)
│  └─ Falls back to Database mode if Twin not configured
└─ Raspberry Pi Edge Consumer (Future)
   ├─ Reads setup from Device Twin on startup
   ├─ Monitors for setup changes
   └─ Reloads TelemetryProcessor when setup changes
"""

# DEPLOYMENT CHECKLIST

## Step 1: Deploy Updated TelemetryProcessor
# ✅ DONE - telemetry_processor.py already has dual-mode support
# No additional deployment needed - existing consumers still work

## Step 2: Deploy Updated Azure Functions
# Files modified:
# - azure_function_signalk_telemetry.py (READY ✅)
# - azure_function_junction_health_telemetry.py (READY ✅)
#
# Deployment steps:
# 1. Configure Azure Function Settings:
#    - DB_SERVER: vxtdb.database.windows.net
#    - DB_NAME: free-sql-db-5949639
#    - DB_USER: vxt
#    - DB_PASSWORD: (from Key Vault)
#    - IOT_HUB_CONNECTION_STRING: (optional, for Device Twin mode)
#
# 2. Deploy SignalK function:
#    $ cd azure_functions
#    $ func azure functionapp publish <FunctionAppName>
#
# 3. Deploy Junction function (when ready):
#    - First uncomment main() function
#    - Delete placeholder_main()
#    - Deploy same way as SignalK

## Step 3: Integrate FastAPI Setup Management
# File: setup_management.py (READY ✅)
# Location: Place in workspace root
#
# Then add to main.py:
'''
from fastapi import FastAPI
from setup_management import router as setup_router

app = FastAPI()

# Include setup management endpoints
app.include_router(setup_router)

# Now available:
# GET  /api/setup/export/N2KToSignalK
# POST /api/setup/sync/TomerRefael/N2KToSignalK
# GET  /api/setup/export/1  (entity-specific)
'''

## Step 4: Deploy FastAPI to App Service F1
# 1. Run locally first:
#    $ python main.py
#    # Test: curl http://localhost:8000/api/setup/export/N2KToSignalK
#
# 2. Deploy to Azure:
#    $ az webapp deployment source config-zip -g <RG> -n <AppServiceName> --src app.zip
#    OR use Azure DevOps/GitHub Actions

## Step 5: Configure Device Twin (Manual)
# Option A - Via Azure Portal:
# 1. Go to IoT Hub → IoT Devices → Select device (e.g., TomerRefael)
# 2. Click "Device Twin" tab
# 3. Modify properties.desired:
#    {
#      "setup": <output from GET /api/setup/export/N2KToSignalK>
#    }
# 4. Click "Save"
#
# Option B - Via API (Recommended):
# 1. Click "Update Setup" button in dashboard
# 2. Dashboard posts to: POST /api/setup/sync/TomerRefael/N2KToSignalK
# 3. FastAPI automatically updates Device Twin
# 4. Device receives notification and reloads setup

## Step 6: Configure IoT Hub Message Routing (Optional)
# Route messages to different Azure Functions by provider:
# 1. IoT Hub → Message Routing → Add Route
# 2. Route 1: Source = IoT Hub messages, Endpoint = azure_function_signalk
#    Routing query: (properties.provider = 'N2KToSignalK')
# 3. Route 2: Source = IoT Hub messages, Endpoint = azure_function_junction
#    Routing query: (properties.provider = 'Junction')

## Step 7: Test Device Twin Mode
# 1. Configure azure_function_signalk_telemetry.py:
#    - Set IOT_HUB_CONNECTION_STRING in Function Settings
#
# 2. Send message to IoT Hub (e.g., from Raspberry Pi):
#    {
#      "entityId": 234567890,
#      "rpm": 1200,
#      "waterTemp": 18.5,
#      "engineTemp": 92
#    }
#
# 3. Check Function logs:
#    [Twin] Retrieved device twin for device: pi-vessel-1
#    [Twin] ✓ Found setup config in device twin
#    [OK] TelemetryProcessor initialized in DEVICE TWIN mode
#
# 4. Verify data in Azure SQL:
#    SELECT * FROM EntityTelemetry ORDER BY CreatedDate DESC LIMIT 5

## Step 8: Verify Fallback Mode Works
# 1. Clear IOT_HUB_CONNECTION_STRING from Function Settings
# 2. Send message to IoT Hub again
# 3. Check Function logs:
#    [DB Mode] Initializing TelemetryProcessor from Azure SQL database
#    [OK] TelemetryProcessor initialized in DATABASE mode

# USAGE EXAMPLES

# Example 1: Export setup from dashboard
'''
GET /api/setup/export/N2KToSignalK

Response (200):
{
  "metadata": {
    "provider_id": 1,
    "provider_name": "N2KToSignalK",
    "topic_name": "boat-telemetry",
    "batch_size": 100
  },
  "entity_types": [
    {"id": 1, "code": "BOAT_VESSEL", "name": "Yacht/Vessel"},
    ...
  ],
  "attributes": [
    {"id": 10, "code": "ENGINE_RPM", "aggregationType": "latest"},
    ...
  ],
  "events": [
    {"id": 95, "protocolAttributeCode": "RPM", "attributeCode": "ENGINE_RPM"},
    ...
  ],
  "entities": [
    {"id": 234567890, "entityTypeId": 1, "customerId": 1},
    ...
  ]
}
'''

# Example 2: Sync device setup
'''
POST /api/setup/sync/TomerRefael/N2KToSignalK

Response (202 - Accepted):
{
  "status": "queued",
  "device_id": "TomerRefael",
  "provider_name": "N2KToSignalK",
  "setup_exported": true,
  "entities_count": 5,
  "attributes_count": 42,
  "events_count": 15,
  "message": "Setup exported, Device Twin sync queued"
}

Backend (async):
- Calls SetupExporter.export_provider_setup('N2KToSignalK')
- Updates Device Twin: properties.desired.setup = exported_config
- Device receives notification on MQTT twin/delta topic
- Device reloads setup from twin
- TelemetryProcessor reinitializes with new config
'''

# Example 3: Raspberry Pi Consumer reads Device Twin
'''
from azure.iot.device.aio import IoTHubModuleClient
from telemetry_processor import TelemetryProcessor

async def main():
    # Connect to Azure IoT Hub (as IoT Edge Module)
    module_client = IoTHubModuleClient.create_from_edge_environment()
    await module_client.connect()
    
    # Get current device twin
    twin = await module_client.get_twin()
    setup_config = twin['properties']['desired'].get('setup')
    
    # Initialize processor from twin
    processor = TelemetryProcessor.from_json_config('N2KToSignalK', setup_config)
    
    # Listen for twin changes
    async def twin_patch_listener(patch):
        setup_config = patch.get('setup')
        if setup_config:
            # Reload processor with new setup
            processor = TelemetryProcessor.from_json_config('N2KToSignalK', setup_config)
            logger.info("Setup updated from Device Twin")
    
    module_client.on_twin_desired_properties_patch_received = twin_patch_listener
    
    # Consume local SignalK, process, send to IoT Hub
    while True:
        event = await get_signalk_event()  # From local SignalK server
        processor.process_event(event)
        # Already filtered, validated, and inserted to Azure SQL
'''

# TROUBLESHOOTING

# Issue 1: Device Twin mode not working
# Symptom: Function logs show "[DB Mode] Initializing..."
# Solution:
# 1. Check IOT_HUB_CONNECTION_STRING is set in Function Settings
# 2. Verify Device Twin has properties.desired.setup
# 3. Check device exists in IoT Hub
# 4. Review function logs: [Twin] errors

# Issue 2: Setup changes not reflecting on device
# Symptom: Device still uses old setup after Device Twin update
# Solution:
# 1. Verify MQTT twin/delta topic is subscribed on device
# 2. Check device is online (look in IoT Hub → Device → Connection state)
# 3. Manually trigger: DELETE twin/delta subscription, reconnect
# 4. Or manually reload by restarting device

# Issue 3: Device Twin sync endpoint returns 500
# Symptom: POST /api/setup/sync/{device_id}/{provider} fails
# Solution:
# 1. Check IOT_HUB_CONNECTION_STRING in FastAPI environment
# 2. Verify connection string is valid (check Azure Portal)
# 3. Check IotHubRegistryManager has read/write permission
# 4. Review async logs: [Twin] error messages

# MONITORING & LOGGING

# Key log messages to watch for:

# Device Twin Mode (Preferred):
# [Twin] Retrieved device twin for device: {device_id}
# [Twin] ✓ Found setup config in device twin for {device_id}
# [OK] TelemetryProcessor initialized in DEVICE TWIN mode

# Database Mode (Fallback):
# [DB Mode] Initializing TelemetryProcessor from Azure SQL database
# [OK] TelemetryProcessor initialized in DATABASE mode

# Setup Export:
# ✓ Exported setup for provider: N2KToSignalK
# entities: 5, attributes: 42, events: 15

# Device Twin Update:
# [Twin] ✓ Updated device twin for {device_id}
# [Twin]   Provider: N2KToSignalK
# [Twin]   Entities: 5
# [Twin]   Attributes: 42
# Device will receive update notification via MQTT

# SEQUENCE DIAGRAM

'''
Timeline of setup change:

1. Admin clicks "Update Setup" in dashboard
   ↓
2. Dashboard: POST /api/setup/sync/TomerRefael/N2KToSignalK
   ↓
3. FastAPI: SetupExporter.export_provider_setup('N2KToSignalK')
   ↓
4. MSSQL: Query Provider, EntityTypeAttribute, ProviderEvent, Entity, Customer
   ↓
5. FastAPI: Registry Manager updates Device Twin
   ↓
6. IoT Hub: Twin update recorded
   ↓
7. Raspberry Pi: Receives MQTT twin/delta message
   ↓
8. Device: Parses new setup from twin
   ↓
9. Device: TelemetryProcessor.from_json_config() reinitializes
   ↓
10. Device: New filters, validations applied to next event
'''

# MIGRATION PATH (From Database Mode to Device Twin Mode)

'''
Phase 1: Deploy (Current)
- Azure Functions deployed with both modes supported
- IOT_HUB_CONNECTION_STRING not configured → Uses Database mode
- Everything works, no changes needed

Phase 2: Enable Device Twin (Next Sprint)
- Set IOT_HUB_CONNECTION_STRING in Function Settings
- Manually update Device Twin with setup config
- Azure Functions now prefer Device Twin (Device Twin mode)
- Better performance, no DB queries per message

Phase 3: Automated Setup Distribution (Future)
- Dashboard "Update Setup" button → Triggers Device Twin sync
- Setup changes immediately propagated to all devices
- No manual twin updates needed

Phase 4: Subscription-Based Changes (Phase 2+)
- Monitor customer subscription table
- On subscription change, automatically export filtered setup
- Update Device Twin for affected devices
- Devices reload setup based on subscription tier
'''
