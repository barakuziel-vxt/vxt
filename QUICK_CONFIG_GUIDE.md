# Quick Configuration Guide - Get Your Credentials

## 🔑 Step 1: Get SQL Database Password

**Location in Azure Portal**:
```
1. Go to: https://portal.azure.com
2. Search: "SQL databases"
3. Click: vxtdb
4. Menu Left: Connection strings
5. Tab: ODBC
6. Copy entire connection string
7. REPLACE: {your_password} with actual password

If you forgot password, you can reset:
   vxtdb → Reset password → Set new admin password
```

**Example Connection String**:
```
Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=vxtdb;Uid=vxtadmin;Pwd=YOUR_PASSWORD_HERE;
```

---

## 🔌 Step 2: Get IoT Hub Connection String

**Location in Azure Portal**:
```
1. Go to: https://portal.azure.com
2. Search: "IoT hubs"
3. Click: vxt-iot-hub
4. Left Menu: Shared access policies
5. Click: owner
6. Copy: Connection string—primary key

Format: HostName=...;SharedAccessKeyName=owner;SharedAccessKey=...
```

---

## 📝 Credential Template (Fill In)

**Save this somewhere safe** - you'll use it for both Web App and Function App:

```
SQL_CONNECTION_STRING:
Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=vxtdb;Uid=vxtadmin;Pwd=[YOUR_SQL_PASSWORD];

IOTHUB_CONNECTION_STRING:
[YOUR_IOTHUB_CONNECTION_STRING]
```

---

## ✅ When Ready, Run These Steps

### **Step 1A: Configure Web App** (5 minutes)
```
Azure Portal → vxt-web-app → Configuration → Application settings

ADD NEW settings:
WEBSITES_PORT = 8000
ENVIRONMENT = production
SQL_CONNECTION_STRING = [PASTE FROM ABOVE]
DOCKER_REGISTRY_SERVER_URL = https://index.docker.io

Click: SAVE
```

### **Step 1B: Configure Function App** (5 minutes)
```
Azure Portal → vxt-function → Configuration → Application settings

ADD NEW settings:
WEBSITES_PORT = 8000
ENVIRONMENT = production
SQL_CONNECTION_STRING = [PASTE FROM ABOVE]
IOTHUB_CONNECTION_STRING = [PASTE FROM ABOVE]

Click: SAVE
```

### **Step 2: Build & Push Docker Image** (10 minutes)
```powershell
cd c:\VXT

# Login (one-time)
docker login -u barakdoc
# Enter password when prompted

# Build
docker build -t barakdoc/vxt-web-app:latest .

# Push
docker push barakdoc/vxt-web-app:latest

# Verify on Docker Hub
# https://hub.docker.com/r/barakdoc/vxt-web-app
```

### **Step 3: Deploy to Web App** (5 minutes)
```
Azure Portal → vxt-web-app → Deployment Center

Container Source: Docker Container
Container Registry: Docker Hub
Image: barakdoc/vxt-web-app:latest
Tag: latest
Click: Save & Deploy

Wait 3-5 minutes for startup...

Test:
curl https://vxt-web-app.azurewebsites.net/
```

### **Step 4: Deploy to Function App** (5 minutes)
```
Azure Portal → vxt-function → Deployment Center

Container Source: Docker Container
Container Registry: Docker Hub
Image: barakdoc/vxt-web-app:latest (same as Web App for now)
Tag: latest
Click: Save & Deploy

Wait 3-5 minutes for startup...
```

---

## 📞 What I'll Do When You Say "Ready"

Once you complete Steps 1-4 above, tell me and I'll:

1. ✅ Verify both services are running
2. ✅ Test REST API endpoints on Web App
3. ✅ Configure IoT Hub → Function App trigger
4. ✅ Create GitHub Actions CI/CD workflows
5. ✅ End-to-end data flow test (IoT → SQL → Web App → Dashboard)

---

## 🚨 Troubleshooting

**If Web App doesn't start**:
- Check Configuration settings are saved
- Check Application logs in Deployment Center
- Verify WEBSITES_PORT=8000

**If Function App errors**:
- Verify IoT Hub connection string is correct
- Check Function App logs
- Ensure SQL firewall allows Azure services

---

## 👇 Ready? Tell Me When Complete!

Send message: "Configuration complete, ready for deployment"

I'll immediately:
- Verify everything is running
- Create deployment scripts
- Test the entire pipeline
