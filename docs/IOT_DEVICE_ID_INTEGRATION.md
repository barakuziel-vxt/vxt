# IoT Device ID Integration & Setup Sync Feature

## Overview

This update adds Azure IoT Hub device ID management to the Customer Entities system and enables syncing entity configuration directly to connected IoT devices.

## Changes Made

### 1. Database Schema Update

**File**: `seed_customerentities.py`

Added new column to `CustomerEntities` table:
```sql
iotDeviceId NVARCHAR(128) NULL
```

**Characteristics**:
- Optional field (NULL allowed) for backward compatibility
- Stores the Azure IoT Hub device ID
- Allows multiple entities to be linked to their respective devices

**Example Values**:
- `TomerRefael` (person device)
- `vessel-234567890` (boat device)
- `health-monitor-001` (wearable device)

### 2. Backend API Updates

**File**: `main.py`

#### Updated Endpoints

**GET /customerentities**
- Now includes `iotDeviceId` in response
- Lists all customer entities with their assigned device IDs

**GET /customerentities/{id}**
- Returns single entity with `iotDeviceId` field

**POST /customerentities**
- Accepts new `iotDeviceId` parameter in request body
- Example:
  ```json
  {
    "customerId": 1,
    "entityId": "033114869",
    "iotDeviceId": "TomerRefael",
    "active": "Y"
  }
  ```

**PUT /customerentities/{id}**
- Updates existing entity including `iotDeviceId`
- Example:
  ```json
  {
    "customerId": 1,
    "entityId": "033114869",
    "iotDeviceId": "TomerRefael",
    "active": "Y"
  }
  ```

#### New Endpoint: Sync Setup to Device

**POST /customerentities/{id}/sync-setup**

Syncs an entity's provider configuration to its IoT device via Device Twin.

**Request**:
```json
{
  "provider_name": "N2KToSignalK"  // Optional, defaults to "N2KToSignalK"
}
```

**Response (Success - 200)**:
```json
{
  "status": "success",
  "message": "Setup synced to device TomerRefael",
  "entity_id": "033114869",
  "provider_name": "N2KToSignalK",
  "device_id": "TomerRefael",
  "sync_result": {
    "status": "success",
    "devices_synced": ["TomerRefael"],
    "setup_exported": true,
    "entities_count": 5,
    "attributes_count": 42,
    "events_count": 15
  }
}
```

**Response (Error - 404)**:
```json
{
  "detail": "Customer entity not found"
}
```

**Response (Error - 400)**:
```json
{
  "detail": "Entity does not have an IoT Device ID assigned"
}
```

### 3. Frontend Updates

**File**: `admin-dashboard/src/pages/CustomerEntitiesPage.jsx`

#### Table Display Enhancement

Added new column to the Customer Entities table:
- **Column**: "IoT Device ID"
- **Position**: After "Entity Type", before "Status"
- **Display**: Shows device ID in monospace font with subtle background
- **Empty State**: Shows "—" if not assigned

#### Edit Entity Modal Updates

**New Form Field**: "IoT Device ID"
- Input type: Text field with monospace font
- Placeholder: "e.g., TomerRefael or device-id-from-azure-iot-hub"
- Helper text: "The device ID as registered in your Azure IoT Hub. Required for pushing setup to the device."
- Position: Between "Entity ID" and "Status" fields

#### New Sync Button

**Button**: "🚀 SYNC to Device"
- **Visibility**: Only shown when editing an existing entity AND IoT Device ID is assigned
- **Position**: Left side of modal footer (next to Cancel/Update buttons)
- **Styling**: 
  - Blue background (#2563eb) - stands out from other buttons
  - Large font weight (600) - visually prominent
  - Full width when shown
  - Disabled state while syncing
- **States**:
  - Normal: "🚀 SYNC to Device"
  - Loading: "⏳ Syncing Setup..."
  - Hidden: When no IoT Device ID assigned or creating new entity

#### Sync Feedback

**Status Message Box**:
- Shown below form fields (above buttons) after sync attempt
- Green background for success ✓
- Red background for errors ✗
- Shows specific error messages if sync fails
- Clears when user closes modal and reopens

### 4. Data Flow

#### Setup Sync Flow

```
User Edit Entity Modal
    ↓
Enters/Updates IoT Device ID
    ↓
Click "SYNC to Device" Button
    ↓
POST /customerentities/{id}/sync-setup
    ↓
Backend: Get entity's iotDeviceId
    ↓
Validate iotDeviceId exists
    ↓
Call /api/setup/sync/{provider}?device_id={iotDeviceId}
    ↓
Setup Manager: Export setup from DB
    ↓
Update Device Twin properties.desired
    ↓
IoT Hub: Send MQTT notification to device
    ↓
Device: Receives update, reloads configuration
    ↓
Success Response with sync details
    ↓
User sees confirmation message
```

## Usage Guide

### Assigning IoT Device IDs to Entities

1. Go to **Customer Entities Management** page
2. Click **Edit** on an entity
3. Enter the device ID in the **"IoT Device ID"** field
   - Must match exactly as registered in Azure IoT Hub
4. Click **"Update Entity Assignment"** to save
5. The device can now receive configuration updates

### Syncing Setup to Device

1. In the **Edit Entity** modal, ensure IoT Device ID is assigned
2. Click the prominent **"🚀 SYNC to Device"** button
3. Wait for the operation to complete
4. Watch for success/error message:
   - **✓ Green**: Setup successfully synced
   - **✗ Red**: Error (check message for details)

### Common Issues

**Error: "Entity does not have an IoT Device ID assigned"**
- Solution: Add IoT Device ID in the form and save before syncing

**Error: "Device not found in IoT Hub"**
- Solution: Verify the device ID matches exactly in Azure IoT Hub

**Sync takes long**
- Normal: Can take 5-15 seconds first time
- Check Azure Function logs if it keeps failing

## Example Scenarios

### Scenario 1: Add New Device

1. Create/Edit Customer Entity with:
   - Customer: "Sailor"
   - Entity ID: "233114869"
   - IoT Device ID: "vessel-233114869"
2. Save the entity
3. Click "SYNC to Device" button
4. Device receives Maritime N2K attributes

### Scenario 2: Update Device Configuration

1. Entity already has IoT Device ID assigned
2. Admin updates provider attributes in database
3. Click "SYNC to Device" to push new config
4. Device reloads without restart

### Scenario 3: Multiple Devices

```
Entity: TomerRefael (person)
├─ Device: TomerRefael (wearable)
│  └─ Sync → Junction health attributes
│
Entity: vessel-1 (boat)
├─ Device: vessel-1 (navigation system)
│  └─ Sync → N2K maritime attributes
│
Entity: vessel-2 (boat)
├─ Device: vessel-2 (navigation system)
│  └─ Sync → N2K maritime attributes
```

## Database Considerations

### Local DB (Docker SQL Edge)
```powershell
# Verify column added
SELECT iotDeviceId FROM CustomerEntities WHERE customerEntityId = 1

# Update device ID
UPDATE CustomerEntities SET iotDeviceId = 'TomerRefael' WHERE entityId = '033114869'
```

### Cloud DB (Azure SQL)
```
// Same migrations applied automatically
// Column synced to cloud via seed script
// Can query in Azure Portal
```

## API Integration Examples

### cURL
```bash
# Add entity with device ID
curl -X POST http://localhost:8000/customerentities \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "entityId": "033114869",
    "iotDeviceId": "TomerRefael",
    "active": "Y"
  }'

# Sync setup to device
curl -X POST http://localhost:8000/customerentities/1/sync-setup \
  -H "Content-Type: application/json" \
  -d '{"provider_name": "N2KToSignalK"}'
```

### PowerShell
```powershell
# Create entity with device ID
$body = @{
  customerId = 1
  entityId = "033114869"
  iotDeviceId = "TomerRefael"
  active = "Y"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/customerentities" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Sync to device
Invoke-WebRequest -Uri "http://localhost:8000/customerentities/1/sync-setup" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"provider_name":"N2KToSignalK"}'
```

### JavaScript/React
```javascript
// Create entity with device ID
const response = await fetch('/api/customerentities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerId: 1,
    entityId: '033114869',
    iotDeviceId: 'TomerRefael',
    active: 'Y'
  })
});

// Sync to device
const syncResponse = await fetch('/api/customerentities/1/sync-setup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider_name: 'N2KToSignalK' })
});

const result = await syncResponse.json();
console.log(`Synced to device: ${result.device_id}`);
```

## Related Features

**Device Twin Configuration**:
- See `DEVICE_TWIN_DEPLOYMENT_GUIDE.md`
- How config flows to devices via Twin

**Setup Management API**:
- See `API_REFERENCE_UPDATED.md`
- POST /api/setup/sync/{provider_name} details

**TelemetryProcessor JSON Mode**:
- See `DEVICE_TWIN_IMPLEMENTATION_SUMMARY.md`
- How devices load JSON configuration

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| seed_customerentities.py | Added iotDeviceId column schema | +1 |
| main.py | Updated 5 endpoints, added sync endpoint | +60 |
| CustomerEntitiesPage.jsx | Added form field, table display, sync button | +80 |

## Backward Compatibility

✅ **Fully backward compatible**:
- IoT Device ID is optional (NULL allowed)
- Existing entities work without device ID
- Can add device IDs incrementally
- Sync button only shows for entities with device ID

## Next Steps

1. **Seed Device IDs**: Run database seed script with device IDs
   ```powershell
   .\.venv\Scripts\python.exe seed_customerentities.py
   ```

2. **Test Locally**: 
   - Create/edit entity with device ID
   - Click sync button
   - Check Azure IoT Hub Device Twin (properties.desired.setup)

3. **Deploy Azure Functions**:
   - SignalK function reads Device Twin on startup
   - Gets fresh config from twin before processing

4. **Monitor in Dashboard**:
   - Watch device twin updates in Azure Portal
   - Verify device receives MQTT notifications
   - Confirm processor uses new config

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Sync button not visible | Ensure entity has IoT Device ID assigned |
| "Device not found" error | Verify device exists in Azure IoT Hub |
| Setup not applied to device | Check Azure Function logs for errors |
| Device rejects Twin update | Verify device is online and connected |

## Support

For issues or questions:
1. Check Azure IoT Hub twin state
2. Review Azure Function execution logs
3. Verify device online status in portal
4. Check browser console for React errors
