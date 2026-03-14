# 🔧 Raspberry Pi IoT Configuration Update

**Date**: March 14, 2026  
**Device**: halos.local (Raspberry Pi)  
**User**: pi  
**Password**: halos  
**Task**: Update IoT Hub connection string

---

## ✅ NEW CONNECTION STRINGS

### Primary Connection String (USE THIS ONE):
```
HostName=VXT-IoT-Hub.azure-devices.net;DeviceId=TomerRefael;SharedAccessKey=hv1RRMhVUplHnfsfqAerPQsBK7UNhwg70+0NfC5FRpg=
```

### Secondary Connection String (Backup):
```
HostName=VXT-IoT-Hub.azure-devices.net;DeviceId=TomerRefael;SharedAccessKey=GEH8owzqB93A7z86Ejt9Vt9XvnWJbxlxu9ifMSOtSUo=
```

### Primary Key:
```
hv1RRMhVUplHnfsfqAerPQsBK7UNhwg70+0NfC5FRpg=
```

### Secondary Key (Backup):
```
GEH8owzqB93A7z86Ejt9Vt9XvnWJbxlxu9ifMSOtSUo=
```

---

## 🚀 Step 1: Connect to Raspberry Pi via SSH

### From Windows PowerShell:

```powershell
# SSH into Raspberry Pi
ssh pi@halos.local

# When prompted for password, enter:
# halos
```

### You'll see:
```
The authenticity of host 'halos.local' can't be established...
Are you sure you want to continue connecting (yes/no)? 
```

**Type**: `yes` and press Enter

---

## 🔍 Step 2: Find IoT Configuration File

Once connected to the Pi, run these commands to find where the IoT config is:

```bash
# Check for IoT Edge config
ls -la /etc/iotedge/

# If the above doesn't exist, check:
find /etc -name "*iot*" -type f 2>/dev/null

# Or check home directory:
find /home/pi -name "*config*" -type f 2>/dev/null
```

### What you're looking for:
```
Common locations:
├─ /etc/iotedge/config.yaml
├─ /etc/iotedge/config.json
├─ /var/lib/iotedge/config.yaml
├─ /home/pi/.iotedge/config.yaml
└─ /home/pi/iotedge_config
```

**Report back what you find** - let me know the exact path!

---

## ✏️ Step 3: Edit Configuration File

Once you find the config file, edit it:

```bash
# Open config with nano editor
sudo nano /etc/iotedge/config.yaml

# OR if it's config.json:
sudo nano /etc/iotedge/config.json

# OR your specific path (replace with what you found):
sudo nano [YOUR_CONFIG_PATH]
```

### What to look for in the file:

**In YAML format** (config.yaml):
```yaml
# Look for a line like:
device:
  connection_string: "HostName=VXT-IoT-Hub.azure-devices.net;..."

# OR
provisioning:
  source: "manual"
  device_connection_string: "HostName=VXT-IoT-Hub.azure-devices.net;..."
```

**In JSON format** (config.json):
```json
{
  "device": {
    "connection_string": "HostName=VXT-IoT-Hub..."
  }
}
```

### Find and Replace:

**OLD** (current):
```
HostName=VXT-IoT-Hub.azure-devices.net;DeviceId=TomerRefael;SharedAccessKey=[OLD_KEY]
```

**NEW** (paste this):
```
HostName=VXT-IoT-Hub.azure-devices.net;DeviceId=TomerRefael;SharedAccessKey=hv1RRMhVUplHnfsfqAerPQsBK7UNhwg70+0NfC5FRpg=
```

---

## 💾 Step 4: Save the File

In nano editor:

```
1. Press: Ctrl+X

2. You'll see: "Save modified buffer? (y/n)"
   Type: y

3. You'll see: "File name to write:"
   Press: Enter (keep same name)

✅ File saved!
```

---

## 🔄 Step 5: Restart IoT Service

```bash
# Restart the IoT Edge runtime
sudo systemctl restart iotedge

# Check status:
sudo systemctl status iotedge

# You should see:
# ● iotedge.service - Azure IoT Edge daemon
#      Loaded: loaded
#      Active: active (running) ✅

# Press 'q' to exit status view
```

---

## ✅ Step 6: Verify Connection

Wait 30-60 seconds for the device to connect, then check:

```bash
# Check IoT Edge logs:
journalctl -u iotedge -f

# Or check via Azure Portal:
# Azure Portal → vxt-iot-hub → Devices → TomerRefael
# Status should show: "Connected" ✅
```

---

## 🚪 Step 7: Exit SSH Session

```bash
# Type:
exit

# Or press: Ctrl+D
```

---

## 📋 Quick Command Summary (Copy-Paste Ready)

### Find config file:
```bash
ls -la /etc/iotedge/
find /etc -name "*iot*" -type f 2>/dev/null
```

### Edit config:
```bash
sudo nano /etc/iotedge/config.yaml
```

### Restart service:
```bash
sudo systemctl restart iotedge
sudo systemctl status iotedge
```

### Check logs:
```bash
journalctl -u iotedge -f
```

### Exit:
```bash
exit
```

---

## 🆘 Troubleshooting

### "Cannot connect to halos.local"
```
Try with IP address instead:
ssh pi@[raspberry-pi-ip]

Or check if Pi is on network:
ping halos.local
```

### "Connection refused"
```
Pi might not have SSH enabled
Or network connectivity issue
Try IP address or check network
```

### "Permission denied (publickey,password)"
```
Wrong password
Try: halos
Or check if user is 'pi' (not 'root')
```

### "Cannot find config file"
```
Run: find /etc -name "*iot*" -type f
Run: find /home -name "*config*" -type f
Report the path you find
```

### "systemctl: command not found"
```
Try: sudo service iotedge restart
Or: sudo /etc/init.d/iotedge restart
```

---

## 📞 If You Get Stuck

When connected to the Pi, run this and send me the output:

```bash
# Show config file location:
find / -name "*iot*" -type f 2>/dev/null | head -20

# Show system info:
uname -a

# Show services:
systemctl list-units --type=service | grep -i iot
```

---

## ✨ Your New Connection String (Save This)

```
HostName=VXT-IoT-Hub.azure-devices.net;DeviceId=TomerRefael;SharedAccessKey=hv1RRMhVUplHnfsfqAerPQsBK7UNhwg70+0NfC5FRpg=
```

---

**Status**: Ready to configure  
**Est. Time**: 10-15 minutes  
**Difficulty**: ⭐ Moderate (SSH + text editing)

👉 **START**: Open PowerShell and SSH to halos.local!
