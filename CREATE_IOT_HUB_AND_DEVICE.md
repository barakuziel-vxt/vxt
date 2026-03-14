# 🚀 Create New IoT Hub & Add Device - Step by Step

**Status**: Delete complete, ready to recreate in North Europe  
**Date**: March 14, 2026  
**Device**: TomerRefael (1 device)

---

## ✅ Step 1: Create New IoT Hub in North Europe (5-10 min)

### In Azure Portal:

```
1. Go to Azure Portal
   → https://portal.azure.com

2. Click "+ Create a resource"
   (top left corner)

3. Search for "IoT Hub"
   (in search box)

4. Click "IoT Hub" in results

5. Click "Create"

6. Fill in the form:
   ├─ Subscription: [your subscription]
   ├─ Resource Group: vxt-resource-group (or your group)
   ├─ IoT Hub Name: vxt-iot-hub ⚠️ (use this exact name!)
   ├─ Region: North Europe ⚠️ CRITICAL!
   ├─ Tier: Free (B0)
   └─ Other settings: Leave as default

7. Click "Review + Create"

8. Click "Create"

9. Wait 5-10 minutes for deployment
   ✅ You'll see "Deployment complete"
```

---

## ✅ Step 2: Verify IoT Hub Created (1 min)

```
After deployment completes:

1. Click "Go to resource"
   (or search "vxt-iot-hub" in portal)

2. You should see:
   ├─ Name: vxt-iot-hub
   ├─ Region: North Europe
   ├─ Tier: Free
   └─ Status: Running ✅
```

---

## ✅ Step 3: Add Device TomerRefael (2 min)

### In your new IoT Hub:

```
1. Left menu → "Devices"

2. Click "+ New Device"

3. Fill in Device Details:
   ├─ Device ID: TomerRefael
   │  (must match exactly!)
   │
   ├─ Authentication Type:
   │  Select "Symmetric Key"
   │
   ├─ Auto-generate keys:
   │  ✅ Check this box (should be checked)
   │  (Azure will create NEW keys automatically)
   │
   └─ Leave other fields default

4. Click "Save"

⏳ Device created! (1-2 seconds)
```

---

## ✅ Step 4: Get NEW Connection String (2 min)

### **IMPORTANT**: You need the NEW connection string for your Raspberry Pi

```
1. In IoT Hub → Devices → Click "TomerRefael"

2. You'll see:
   ├─ Device ID: TomerRefael
   ├─ Primary Key: [NEW KEY - copy this]
   ├─ Secondary Key: [BACKUP - copy this too]
   │
   └─ Connection strings section:
       ├─ Primary Connection String: 
       │  HostName=vxt-iot-hub.azure-devices.net;
       │  DeviceId=TomerRefael;
       │  SharedAccessKey=[NEW KEY]
       │
       └─ Secondary Connection String:
          HostName=vxt-iot-hub.azure-devices.net;
          DeviceId=TomerRefael;
          SharedAccessKey=[BACKUP KEY]

3. COPY the PRIMARY Connection String
   (click the copy icon next to it)

4. Save it somewhere safe
```

---

## ✅ Step 5: Update Raspberry Pi (5 min)

### **SSH into your Raspberry Pi and update the config:**

```bash
# SSH into your Pi:
ssh pi@[your-pi-ip]

# Find the config file:
find /etc -name "*iot*" 2>/dev/null
# OR if that doesn't work:
find /home -name "*config*" 2>/dev/null

# Edit the config file (example path):
sudo nano /etc/iotedge/config.yaml
# OR
sudo nano /var/lib/iotedge/config.json
# OR wherever YOUR config is located

# Look for the connection string line
# OLD: HostName=VXT-IoT-Hub.azure-devices.net;...

# REPLACE with NEW one:
# NEW: HostName=vxt-iot-hub.azure-devices.net;DeviceId=TomerRefael;SharedAccessKey=[NEW KEY]

# Save file:
# Press: Ctrl+X
# Press: Y (Yes to save)
# Press: Enter (confirm filename)

# Restart IoT service:
sudo systemctl restart iotedge
# OR
sudo systemctl restart [your-service-name]

# Check status:
sudo systemctl status iotedge

# Should show: active (running) ✅
```

---

## ✅ Step 6: Verify Connection (2 min)

### Back in Azure Portal:

```
1. Azure Portal → vxt-iot-hub

2. Click "Devices"

3. Find "TomerRefael"

4. Check the status:
   ├─ After 30-60 seconds
   ├─ Status should change to "Connected" ✅
   ├─ "Last Activity" should show recent time
   └─ You're done! 🎉
```

---

## 📝 Summary - What Changed

```
OLD IoT Hub:
├─ Name: VXT-IoT-Hub
├─ Region: East US (or wherever it was)
├─ Device: TomerRefael
└─ Connection: HostName=VXT-IoT-Hub.azure-devices.net;...

NEW IoT Hub:
├─ Name: vxt-iot-hub
├─ Region: North Europe ✅
├─ Device: TomerRefael (recreated)
└─ Connection: HostName=vxt-iot-hub.azure-devices.net;...

⚠️ Different hostname!
   Update Raspberry Pi with the NEW connection string
```

---

## 🔍 Complete Connection String Format

Your new connection string will look like:

```
HostName=vxt-iot-hub.azure-devices.net;DeviceId=TomerRefael;SharedAccessKey=DtTdKNgcfvF4Z3CGO0Cd7Ci5wPtJnUYKmSYk2/nHQuk=
```

**Parts:**
- `HostName=vxt-iot-hub.azure-devices.net` ← NEW hub name
- `DeviceId=TomerRefael` ← Same device name
- `SharedAccessKey=[NEW KEY]` ← NEW auto-generated key

---

## ⏱️ Total Time

```
Step 1: Create hub       : 5-10 min ⏳
Step 2: Verify hub       : 1 min
Step 3: Add device       : 2 min
Step 4: Get connection   : 2 min
Step 5: Update Pi        : 5 min
Step 6: Verify connected : 2 min
────────────────────────────────
TOTAL:                    17-27 min ✅
```

---

## ✅ Success Checklist

- [ ] New IoT Hub created in North Europe
- [ ] Hub shows "Running" status
- [ ] Device "TomerRefael" created
- [ ] Device status shows "Connected" ✅
- [ ] New connection string copied
- [ ] Raspberry Pi config updated
- [ ] IoT service restarted on Pi
- [ ] Last Activity shows recent time

---

## 🚨 Common Issues

### Device shows "Disconnected"
```
Wait 30-60 seconds, then refresh
(Takes time to connect after creating)
```

### Can't find config file on Pi
```
Try these paths:
├─ /etc/iotedge/config.yaml
├─ /var/lib/iotedge/config.json
├─ /home/pi/.iotedge/config.yaml
├─ Check with: ls -la /etc/iotedge/
└─ Ask your Pi admin where config is
```

### Service won't restart
```
Check service name:
systemctl list-units --type=service | grep iot

Then restart proper service:
sudo systemctl restart [actual-service-name]
```

### "Connection refused" error
```
Check connection string:
├─ Hostname must be: vxt-iot-hub.azure-devices.net
├─ No spaces or typos
├─ Exact copy from Azure Portal
└─ Try again after 2 minutes (DNS propagation)
```

---

## 📋 Saved Credentials

Your old credentials are backed up in:
- `IOT_DEVICE_CREDENTIALS_BACKUP.txt`

Keep reference to compare OLD vs NEW.

---

**Next**: After device shows "Connected", you can proceed with:
- ✅ Phase 2: Azure Functions (API layer)
- ✅ Phase 3: Static Web Apps (Frontend)

---

**Status**: Ready to Create  
**Est. Time**: ~25 minutes  
**Difficulty**: ⭐ Easy (mostly clicking in Portal)

👉 **Start NOW**: Go to Azure Portal and create the new IoT Hub!
