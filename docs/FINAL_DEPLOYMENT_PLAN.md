# 🚀 VXT Azure Deployment - Final Action Plan

**Status**: Password verified ✅ → Ready for deployment

---

## 📋 Deployment Checklist (4 Steps - ~45 minutes)

### ✅ Step 1: Configure Web App Settings (5 minutes)

**Location**: Azure Portal → `vxt-web-app` → Configuration → Application settings

**Add these 4 settings**:

| Name | Value |
|------|-------|
| `WEBSITES_PORT` | `8000` |
| `ENVIRONMENT` | `production` |
| `SQL_CONNECTION_STRING` | `Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=vxtdb;Uid=vxtadmin;Pwd=Barak1008!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;` |
| `DOCKER_REGISTRY_SERVER_URL` | `https://index.docker.io` |

**Click**: SAVE

**Expected**: ✅ All settings saved (green checkmark)

---

### ✅ Step 2: Configure Function App Settings (5 minutes)

**Location**: Azure Portal → `vxt-function` → Configuration → Application settings

**Add these 4 settings**:

| Name | Value |
|------|-------|
| `WEBSITES_PORT` | `8000` |
| `ENVIRONMENT` | `production` |
| `SQL_CONNECTION_STRING` | `Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=vxtdb;Uid=vxtadmin;Pwd=Barak1008!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;` |
| `IOTHUB_CONNECTION_STRING` | [FROM STEP 2A BELOW] |

**Click**: SAVE

#### Step 2A: Get IoT Hub Connection String

**Location**: Azure Portal → `vxt-iot-hub` → Shared access policies → `owner`

**Copy**: Connection string—primary key

**Looks like**: `HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=owner;SharedAccessKey=...`

---

### ✅ Step 3: Build & Push Docker Image (10 minutes)

**Run these commands in PowerShell** (from `c:\VXT` directory):

```powershell
# Step 1: Login to Docker Hub (one-time)
docker login -u barakdoc
# When prompted, enter your Docker Hub password

# Step 2: Build Docker image
docker build -t barakdoc/vxt-web-app:latest .
# Wait for "Successfully tagged..." message

# Step 3: Push to Docker Hub
docker push barakdoc/vxt-web-app:latest
# Wait for "Successfully pushed..." message

# Step 4: Verify on Docker Hub
# Open browser: https://hub.docker.com/r/barakdoc/vxt-web-app
# Should see "latest" tag listed with small green checkmark
```

**Expected Output**:
```
Successfully tagged barakdoc/vxt-web-app:latest
Successfully pushed barakdoc/vxt-web-app:latest
```

**Verify**: Visit [Docker Hub](https://hub.docker.com/r/barakdoc/vxt-web-app) - image should appear

---

### ✅ Step 4: Deploy to Azure (15 minutes total)

#### 4A: Deploy to Web App

**Location**: Azure Portal → `vxt-web-app` → Deployment Center

**Steps**:
1. Click: Deployment Center (left menu)
2. Select Source: **Docker Container**
3. Container Registry: **Docker Hub**
4. Image: `barakdoc/vxt-web-app:latest`
5. Tag: `latest`
6. Click: **Save & Deploy**

**Wait**: 3-5 minutes for restart

**Test**: 
```powershell
# In PowerShell, verify Web App is running
$url = "https://vxt-web-app.azurewebsites.net/"
Invoke-WebRequest $url -UseBasicParsing | Select-Object StatusCode

# Should see: StatusCode : 200
```

**View Live**: Visit https://vxt-web-app.azurewebsites.net in browser

---

#### 4B: Deploy to Function App

**Location**: Azure Portal → `vxt-function` → Deployment Center

**Steps**:
1. Click: Deployment Center (left menu)
2. Select Source: **Docker Container**
3. Container Registry: **Docker Hub**
4. Image: `barakdoc/vxt-web-app:latest` (same image for now - we'll update later)
5. Tag: `latest`
6. Click: **Save & Deploy**

**Wait**: 3-5 minutes for restart

**Note**: Function App uses same image initially. We'll create separate `vxt-function:latest` image later with consumer logic.

---

## 🎯 Copy-Paste Ready Commands

### For Docker Build & Push:
```powershell
docker login -u barakdoc
docker build -t barakdoc/vxt-web-app:latest .
docker push barakdoc/vxt-web-app:latest
```

### For Testing (After Deployment):
```powershell
# Test Web App
curl https://vxt-web-app.azurewebsites.net/

# Test health endpoint
curl https://vxt-web-app.azurewebsites.net/health

# List all endpoints
curl https://vxt-web-app.azurewebsites.net/docs
```

---

## 📊 Current Status

| Component | Status | Next Action |
|-----------|--------|-------------|
| SQL Password | ✅ Verified | Use in Step 1 & 2 |
| Connection String | ✅ Ready | Copy to Web App & Function App |
| Docker Image | ⏳ Needs Build | Step 3 |
| Web App Config | ⏳ Needs Update | Step 1 |
| Function App Config | ⏳ Needs Update | Step 2 |
| Deployment | ⏳ Needs Deploy | Step 4 |

---

## 🚀 Timeline

- **Step 1**: 5 min (Web App config)
- **Step 2**: 5 min (Function App config)
- **Step 3**: 10 min (Build & push Docker)
- **Step 4**: 15 min (Azure deployment + wait)

**Total**: ~45 minutes, mostly waiting for Azure

---

## ✅ When Complete

Tell me: **"All steps complete, services deployed"**

**Then I will**:
1. ✅ Test Web App REST endpoints
2. ✅ Configure IoT Hub → Function App trigger
3. ✅ Create GitHub Actions CI/CD workflows
4. ✅ Run end-to-end data flow test
5. ✅ Verify React Dashboard connectivity

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| App won't start | Check Configuration settings are saved |
| Docker push fails | Verify Docker Hub credentials with `docker login` |
| 404 from Web App | Wait 3-5 min for startup, check logs in Deployment Center |
| FirewallIP error | Add your IP to SQL Firewall (or use "Allow Azure services") |

**Error in Deployment Center?** 
- Go to: `vxt-web-app` → Logs → Deployment logs
- Copy error message and send to me

---

## 📌 Ready to Start?

**Follow the 4 steps above in order.**

**Status Check at Each Step**:
- ✅ Step 1: Settings show green checkmark
- ✅ Step 2: Settings show green checkmark  
- ✅ Step 3: Docker push shows "Successfully pushed"
- ✅ Step 4: Azure shows "Running" status

**Then report**: "All steps complete, services deployed"

Let's go! 🚀
