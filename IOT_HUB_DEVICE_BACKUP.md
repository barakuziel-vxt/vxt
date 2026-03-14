# 🔐 IoT Hub Device Configuration Backup

**Backup Date**: March 14, 2026  
**Current Hub**: [Old Hub Name]  
**Purpose**: Device recreation after migration to North Europe

---

## ✅ Critical Information to Save

### 1. Device Connection String (MOST IMPORTANT)
```
You MUST get this from Azure Portal BEFORE deletion!

Location: Azure Portal → IoT Hub → Devices → [Device Name] → Connection strings

🔴 SAVE BOTH:
├─ Primary Connection String: HostName=...;SharedAccessKeyName=...;SharedAccessKey=...
└─ Secondary Connection String: [backup key]
```

**These are UNIQUE to each device and IoT Hub**

---

## 2. Device Twin Information (What You Provided)

```json
{
    "deviceId": "TomerRefael",
    "version": 2,
    "properties": {
        "desired": {
            "$metadata": {
                "$lastUpdated": "2026-03-12T23:14:32.9683785Z"
            },
            "$version": 1
        },
        "reported": {
            "$metadata": {
                "$lastUpdated": "2026-03-12T23:14:32.9683785Z"
            },
            "$version": 1
        }
    },
    "capabilities": {
        "iotEdge": true
    },
    "status": "enabled",
    "authenticationType": "sas",
    "lastActivityTime": "2026-03-13T21:09:52.6363182Z"
}
```

**What This Tells Us:**
- ✅ Device ID: `TomerRefael`
- ✅ Status: Enabled
- ✅ Auth Type: SAS (Shared Access Signature)
- ✅ IoT Edge: Enabled (important!)
- ⚠️ Desired Properties: Currently empty
- ⚠️ Reported Properties: Currently empty

---

## 3. What to Get BEFORE Deletion

### From Azure Portal - PER DEVICE:

For **each of the 5 devices**, get:

```
Device: [TomerRefael]
├─ Device ID: TomerRefael
├─ Authentication Type: sas
├─ Primary Key: [copy from portal]
├─ Secondary Key: [copy from portal]
├─ Primary Connection String: HostName=vxtiotdemo.azure-devices.net;SharedAccessKeyName=TomerRefael;SharedAccessKey=...
├─ Secondary Connection String: [backup]
├─ Device Status: enabled
└─ IoT Edge Enabled: Yes ✅
```

---

## 4. All 5 Device Names (From Your Current Hub)

```
DEVICE 1: TomerRefael
DEVICE 2: [Get from portal]
DEVICE 3: [Get from portal]
DEVICE 4: [Get from portal]
DEVICE 5: [Get from portal]
```

---

## 5. Steps to Complete BEFORE Deleting Old Hub

### ⏰ DO THIS NOW (takes 10 minutes):

```
1. Azure Portal → IoT Hub → Devices
2. FOR EACH DEVICE (5 total):
   a. Click device name
   b. Copy Device ID
   c. Copy Primary Key
   d. Copy Primary Connection String
   e. Note: Authentication Type = "sas"
   f. Note: Status = "enabled"
   
3. Save all 5 to a text file like:
   DEVICE_CREDENTIALS_BACKUP.txt
```

### Example Format:

```
=== DEVICE BACKUP ===
Old Hub: vxtiotdemo
Region: East US (wherever it is now)
Date: 2026-03-14

DEVICE 1: TomerRefael
├─ Primary Key: [keep secure]
├─ Connection String: HostName=vxtiotdemo.azure-devices.net;SharedAccessKeyName=TomerRefael;SharedAccessKey=...
└─ Status: enabled

DEVICE 2: [name]
├─ Primary Key: [keep secure]
├─ Connection String: ...
└─ Status: enabled

... (repeat for 5 devices)
```

---

## ⚠️ Important Notes

### What's IN the Device Twin (can easily recreate):
```
✅ Device ID - just the name
✅ Status (enabled/disabled)
✅ Authentication Type (sas)
✅ IoT Edge enabled flag
✅ Desired properties (currently empty)
✅ Reported properties (currently empty)
```

### What's NOT in the Device Twin (MUST save separately):
```
❌ Primary Key (CANNOT get later, only shown once)
❌ Secondary Key (CANNOT get later, only shown once)
❌ Connection String (derived from keys)
❌ Any device-specific secrets
```

---

## 🔄 Recreation Process Later

```
When you create new hub in North Europe:

1. Create Device with same name: TomerRefael
   └─ Azure will generate NEW keys automatically
   
2. Copy NEW Primary Connection String
   └─ Format: HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=TomerRefael;SharedAccessKey=[NEW]
   
3. Use NEW connection string on Raspberry Pi
   └─ Just hostname changes, format stays same
   
4. Old Device Twin settings:
   └─ Will be EMPTY in new device (start fresh)
   └─ No problem - currently empty anyway
```

---

## 📋 Backup Template

**SAVE THIS INFORMATION NOW:**

| Device | Device ID | Primary Key | Status | IoT Edge |
|--------|-----------|-------------|--------|----------|
| 1 | TomerRefael | [copy] | enabled | yes |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
| 5 |  |  |  |  |

---

## ✅ Migration Checklist

Before you delete old hub:

```
[ ] Device 1: TomerRefael
    ├─ Name: TomerRefael
    ├─ Primary Key: _________________
    ├─ Connection String: HostName=vxtiotdemo.azure-devices.net;SharedAccessKeyName=TomerRefael;SharedAccessKey=...
    └─ Status: enabled

[ ] Device 2: ________
    ├─ Name: ________
    ├─ Primary Key: _________________
    ├─ Connection String: ________
    └─ Status: enabled

[ ] Device 3: ________
    ├─ Name: ________
    ├─ Primary Key: _________________
    ├─ Connection String: ________
    └─ Status: enabled

[ ] Device 4: ________
    ├─ Name: ________
    ├─ Primary Key: _________________
    ├─ Connection String: ________
    └─ Status: enabled

[ ] Device 5: ________
    ├─ Name: ________
    ├─ Primary Key: _________________
    ├─ Connection String: ________
    └─ Status: enabled
```

---

## 🎯 Action Plan

### RIGHT NOW:
```
1. Open Azure Portal
2. Go to your IoT Hub
3. Click Devices
4. For each of 5 devices:
   a. Click the device name
   b. Copy: Device ID, Primary Key, Connection String
   c. Save to backup file
5. Keep this file safe
```

### THEN:
```
1. Delete old IoT Hub
2. Create new IoT Hub (vxt-iot-hub) in North Europe
3. Create 5 devices in new hub (10 minutes)
   └─ Same names, new keys auto-generated
4. Copy new connection strings to Raspberry Pi
5. Done!
```

---

## 💡 Why Device Twin Info is Less Critical

The Device Twin JSON you provided shows:
```
"desired": { ... empty ... }
"reported": { ... empty ... }
```

Since there are **no custom properties stored** in the desired/reported sections, you're not losing any configuration. It's all just metadata that Azure manages automatically.

---

## 🔐 Security Notes

⚠️ **KEEP CONNECTION STRINGS SECURE:**
```
✅ Save in: A file on YOUR computer
✅ Keep: Password protected file
❌ Don't: Share on GitHub, email, public locations
❌ Don't: Post in chat/support tickets
```

Once new hub is created, old keys are worthless anyway (old hub deleted).

---

## 📝 Summary

**What you MUST save BEFORE deletion:**
1. ✅ All 5 device names/IDs
2. ✅ All 5 primary connection strings
3. ✅ All 5 primary keys (backup only)
4. ✅ Authentication type: sas
5. ✅ Status: enabled

**What you DON'T need to save:**
- Device Twin properties (recreate automatically)
- Version numbers (auto-reset)
- Last activity times (auto-reset)
- Etags (auto-reset)

---

**Status**: Ready to backup  
**Next**: Go to Azure Portal NOW and save device credentials before deletion

👉 **START NOW**: Don't delete old hub until you have all 5 device names + connection strings saved!
