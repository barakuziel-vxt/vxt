# Implementation Checklist - IoT Device ID Integration

## ✅ Completed Changes

### Database
- [x] Added `iotDeviceId` column to CustomerEntities table schema
- [x] Column is NVARCHAR(128) NULL
- [x] Updated in seed_customerentities.py

### Backend (main.py)
- [x] Updated `GET /customerentities` to include iotDeviceId
- [x] Updated `GET /customerentities/{id}` to include iotDeviceId  
- [x] Updated `POST /customerentities` to accept iotDeviceId
- [x] Updated `PUT /customerentities/{id}` to update iotDeviceId
- [x] Added new `POST /customerentities/{id}/sync-setup` endpoint
- [x] Endpoint validates iotDeviceId exists before syncing
- [x] Calls /api/setup/sync/{provider}?device_id={iotDeviceId}

### Frontend (admin-dashboard)
- [x] Added iotDeviceId field to form
- [x] Form field has help text explaining Azure IoT Hub reference
- [x] Added iotDeviceId display column to table
- [x] Added "🚀 SYNC to Device" button to edit modal
- [x] Button only visible when editing AND device ID assigned
- [x] Button styled prominently (blue, large, centered)
- [x] Added sync handler function with error handling
- [x] Added sync status messages (success/error feedback)
- [x] Button shows loading state while syncing

---

## 📋 Next Steps - Implementation Order

### Step 1: Database Migration (5 minutes)
**What**: Run the updated schema script to add the column to both databases

**Local Database**:
```powershell
# Run the seed script - it will create/update the table
.\.venv\Scripts\python.exe seed_customerentities.py
```
- Verifies: iotDeviceId column exists in CustomerEntities

**Cloud Database**:
```sql
-- Execute this in Azure SQL (BoatTelemetryDB)
ALTER TABLE CustomerEntities
ADD iotDeviceId NVARCHAR(128) NULL
```
- Verifies: Column added to cloud database

**Verification**:
```sql
-- Check column exists
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'CustomerEntities' AND COLUMN_NAME = 'iotDeviceId'
```

### Step 2: Restart FastAPI Server (2 minutes)
**What**: Restart main.py to load updated endpoints

```powershell
# Kill any running main.py
# Then restart
.\.venv\Scripts\python.exe main.py
```

**Verify**: 
- Check FastAPI docs at http://localhost:8000/docs
- Search for `/customerentities/{id}/sync-setup` endpoint
- Should show as POST method

### Step 3: Test Backend API (5 minutes)
**What**: Test the new endpoints before using dashboard

**Test 1: Create entity with device ID**
```powershell
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
```

**Expected**: 
```json
{"message": "Customer entity created successfully"}
```

**Test 2: Verify iotDeviceId returned**
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/customerentities" | ConvertFrom-Json
```

**Expected**:
```json
[
  {
    "customerEntityId": 1,
    "customerId": 1,
    "iotDeviceId": "TomerRefael",  // ← This field
    "entityId": "033114869",
    "active": "Y"
  }
]
```

**Test 3: Update entity device ID**
```powershell
$body = @{
  customerId = 1
  entityId = "033114869"
  iotDeviceId = "TomerRefael-Updated"
  active = "Y"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/customerentities/1" `
  -Method PUT `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

**Expected**:
```json
{"message": "Customer entity updated successfully"}
```

### Step 4: Start Admin Dashboard (3 minutes)
**What**: Refresh dashboard to load updated UI

**If already running**:
```powershell
# The admin-dashboard file changes are React, might need hard refresh
# In browser: Ctrl+Shift+R (hard refresh) or clear cache
```

**If not running**:
```powershell
cd .\admin-dashboard
npm run dev -- --host 0.0.0.0
```

**Access**: http://localhost:3001

### Step 5: Test Admin Dashboard UI (10 minutes)
**What**: Add/edit entities with device IDs and test sync button

**Test 1: Add IoT Device ID to existing entity**
1. Navigate to "Customer Entities Management" page
2. Click "Edit" on any entity
3. Scroll to "IoT Device ID" field
   - Should be between Entity ID and Status
4. Enter device ID: `TomerRefael`
5. Click "Update Entity Assignment"
6. Verify device ID saved

**Test 2: View device ID in table**
1. Return to entities list
2. Look for new "IoT Device ID" column
3. Should show "TomerRefael" in monospace font
4. Verify rendering is correct (not broken layout)

**Test 3: Verify sync button appears**
1. Click "Edit" on entity you just updated
2. Scroll to modal footer area
3. Should see blue "🚀 SYNC to Device" button
   - Left side of footer
   - Visible and prominent
4. Cancel modal (don't click yet)

### Step 6: Test Sync Button (10-15 minutes)
**What**: Sync entity setup to device and verify flow

**Prerequisites**:
- Entity has IoT Device ID assigned
- Device exists in Azure IoT Hub with that ID
- Azure IoT Hub connection working
- Setup management endpoints active

**Test Procedure**:
1. Open Admin Dashboard
2. Go to Customer Entities Management
3. Click "Edit" on entity with device ID
4. Click the blue "🚀 SYNC to Device" button
5. Watch for response:

**Success Case** (2-5 seconds):
   ```
   ✓ Successfully synced setup to device TomerRefael
   ```
   - Green background
   - You can close modal and check Azure Portal Device Twin

**Error Case** (immediate):
   ```
   Failed to sync: Entity does not have an IoT Device ID assigned
   ```
   - Red background
   - Check form field has value

**Other Errors**:
   - "Device not found": Verify device exists in IoT Hub
   - "Setup not found": Check provider_name is correct
   - Network timeout: Check /api/setup/sync endpoint running

### Step 7: Verify in Azure Portal (5 minutes)
**What**: Confirm setup synced to Device Twin

**Process**:
1. Open Azure Portal
2. Navigate to IoT Hub (VXT-IoT-Hub)
3. Select your device (e.g., TomerRefael)
4. Click "Device Twin"
5. Look for `properties.desired.setup`:
   ```json
   {
     "setup": {
       "provider_name": "N2KToSignalK",
       "entities": [...],
       "attributes": [...],
       ...
     }
   }
   ```

**Success Indicators**:
- ✅ `setup` object exists in properties.desired
- ✅ Contains `provider_name` and entity/attribute arrays
- ✅ Data matches database export
- ✅ `lastUpdateTimestamp` is recent

### Step 8: Test Device Reception (Optional)
**What**: Verify device receives Twin update via MQTT

**For Edge Device (Raspberry Pi)**:
```bash
# SSH into device
ssh pi@halos.local

# Check if Twin update triggered
tail -f /var/log/iotedge/edge-hub.log | grep "desired.*setup"

# Should see incoming update notification
```

**For Cloud Function**:
- SignalK Azure Function will load Twin config on next message
- Check function logs for "Using Device Twin mode"

---

## 🔍 Verification Checklist

### Database Level
- [ ] iotDeviceId column exists in CustomerEntities
- [ ] Column accepts NULL values
- [ ] Column is NVARCHAR(128)
- [ ] Existing records unaffected (backward compatible)

### API Level
- [ ] GET /customerentities returns iotDeviceId
- [ ] POST /customerentities accepts iotDeviceId
- [ ] PUT /customerentities/{id} updates iotDeviceId
- [ ] POST /customerentities/{id}/sync-setup endpoint exists
- [ ] Sync endpoint validates device ID
- [ ] Sync endpoint calls setup management API

### Frontend Level
- [ ] Form has iotDeviceId input field
- [ ] Form field shows helper text
- [ ] Table displays iotDeviceId column
- [ ] Edit button loads device ID into form
- [ ] Sync button visible when device ID assigned
- [ ] Sync button hidden when no device ID
- [ ] Sync button shows loading state
- [ ] Success message displays correctly
- [ ] Error message displays correctly

### End-to-End Level
- [ ] Can add device ID via form
- [ ] Can edit device ID via form
- [ ] Can sync setup to device
- [ ] Device Twin updated in Azure Portal
- [ ] Device receives MQTT notification
- [ ] Device loads new configuration

---

## 🐛 Troubleshooting

### Form Field Not Appearing
**Issue**: IoT Device ID field not visible in edit form

**Solution**:
1. Hard refresh browser: Ctrl+Shift+R
2. Clear browser cache
3. Close developer tools
4. Restart admin-dashboard server

### Sync Button Not Appearing
**Issue**: Blue sync button doesn't show in edit modal

**Conditions to check**:
1. ✓ Editing existing entity (not creating new)
2. ✓ IoT Device ID field has value (not empty)
3. ✓ Device ID matches Azure IoT Hub registration

**If conditions met but button not showing**:
- Hard refresh browser
- Check browser console for React errors
- Check admin-dashboard server logs

### Sync Fails with 404
**Issue**: "Entity does not have an IoT Device ID assigned"

**Solutions**:
1. Verify iotDeviceId field has value
2. Click "Update Entity Assignment" to save
3. Close modal and re-open to verify saved
4. Try sync again

### Sync Fails with Device Not Found
**Issue**: Setup management says device not found

**Solutions**:
1. Verify device exists in Azure IoT Hub
2. Device ID must match exactly (case-sensitive)
3. Check device status is "Enabled"
4. Wait 30 seconds and retry (caching)

### Setup Not Applied to Device
**Issue**: Device Twin updated but device doesn't load config

**Solutions**:
1. Check device is online and connected
2. Verify device subscribes to MQTT $iothub/twin/PATCH/properties/desired/# topic
3. Check device logs for errors
4. Verify TelemetryProcessor.from_json_config() called

---

## 📞 Support References

**Related Documentation**:
- Device Twin Setup: `DEVICE_TWIN_DEPLOYMENT_GUIDE.md`
- API Reference: `API_REFERENCE_UPDATED.md`
- Sync Endpoint: `API_CORRECTION_SUMMARY.md`
- Setup Management: `SETUP_MANAGEMENT_INTEGRATION.md`

**Key Files Updated**:
- Backend: [main.py](main.py#L2540-L2750)
- Frontend: [CustomerEntitiesPage.jsx](admin-dashboard/src/pages/CustomerEntitiesPage.jsx)
- Database: [seed_customerentities.py](seed_customerentities.py#L36)

**API Endpoints**:
- Sync Device: `POST /customerentities/{id}/sync-setup`
- List Entities: `GET /customerentities`
- Get Entity: `GET /customerentities/{id}`
- Create Entity: `POST /customerentities`
- Update Entity: `PUT /customerentities/{id}`

---

## 🎯 Success Criteria

✅ **Implementation Complete When**:

1. [ ] iotDeviceId column exists in both databases
2. [ ] AdminDashboard shows new field and column
3. [ ] Can add/edit device IDs for entities
4. [ ] Sync button appears and is prominent
5. [ ] Clicking sync creates Device Twin update
6. [ ] Azure Portal shows setup in Device Twin
7. [ ] Device receives MQTT notification
8. [ ] No errors in browser console
9. [ ] No errors in Python backend
10. [ ] All edge cases handled gracefully

**Estimated Total Time**: 45-60 minutes including testing

---

## 📝 Notes

- Changes are backward compatible - existing entities work without device IDs
- Device IDs can be added/updated incrementally
- Sync button is intentionally prominent (not hidden)
- First sync may take 5-15 seconds due to setup export
- Multiple devices can sync in batches via /api/setup/sync endpoint
