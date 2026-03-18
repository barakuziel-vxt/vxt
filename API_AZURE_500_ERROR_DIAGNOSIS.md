# Azure API 500 Error - Comprehensive Diagnosis & Fix

## 📋 Problem Summary
The VXT Web App deployed to Azure is returning **HTTP 500 errors** for all API endpoints.
- **URL**: https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net
- **Error Example**: `/protocols` endpoint → 500 Internal Server Error
- **Affected**: Dashboard calling multiple APIs, all failing with 500s

---

## 🔍 Root Cause Analysis

### Primary Issue: Unicode/Emoji Encoding Error
From your `fastapi_output.log`, the error occurs when:

```
UnicodeEncodeError: 'charmap' codec can't encode character '\U0001f4ca' in position 0
File "C:\VXT\main.py", line 1860
    print(f"\U0001f4ca GET /api/telemetry/range/{entity_id}")
```

**What is `\U0001f4ca`?** → 📊 (Bar Chart emoji)

### Why This Fails on Azure
1. **Local Windows**: Uses Windows-1252 encoding (supports emoji with special handling)
2. **Azure Container**: Uses UTF-8 by default OR has encoding restrictions
3. **Python Error**: When print() tries to encode emoji to cp1252, it fails
4. **Result**: Exception caught by uvicorn → Returns HTTP 500 to client

---

## 🔧 Immediate Fix: Enable UTF-8 in Container

### Option 1: Update Dockerfile
Add environment variables to force UTF-8 encoding:

```dockerfile
# Add to dockerfile BEFORE running uvicorn
ENV PYTHONIOENCODING=utf-8
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
```

**Full updated Dockerfile:**
```dockerfile
# Multi-stage build

# Stage 1: Builder
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    find /usr/local/lib/python3.11 -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# Stage 2: Runtime
FROM python:3.11-slim
WORKDIR /app

# ⭐ ADD THIS FOR UTF-8 SUPPORT
ENV PYTHONIOENCODING=utf-8
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY . .

RUN find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Option 2: Configure Azure App Settings
In Azure Portal → App Service → Settings → Environment Variables, add:
```
PYTHONIOENCODING=utf-8
LANG=C.UTF-8
LC_ALL=C.UTF-8
```

### Option 3: Best Practice - Remove Emoji Entirely
Replace all emoji print statements with ASCII equivalents:

**Before:**
```python
print(f"📊 GET /api/telemetry/range/{entity_id}")
print(f"✅ Query executed successfully")
print(f"❌ ERROR: Connection failed")
```

**After:**
```python
print(f"[CHART] GET /api/telemetry/range/{entity_id}")
print(f"[OK] Query executed successfully")
print(f"[ERROR] Connection failed")
```

---

## ✅ Verification Checklist

### Step 1: Verify Current Code
- [x] Check main.py for emoji/Unicode print statements
- [ ] Ensure all print() statements use ASCII only
- [ ] Run: `grep -r "\\U\|\\u[0-9A-F]" main.py` to find Unicode escapes

### Step 2: Test Locally
```bash
# Test in local Docker container
docker build -t vxt-api:test .
docker run --rm -p 8000:8000 vxt-api:test
curl http://localhost:8000/protocols
```

### Step 3: Deploy to Azure
```bash
# Build new image
docker build -t vxtwapp.azurecr.io/vxt-api:latest .

# Push to Azure Container Registry
docker push vxtwapp.azurecr.io/vxt-api:latest

# Restart Azure Web App
az webapp restart --name vxt-web-app-g5gbaee2f4bmgphb --resource-group <rg-name>
```

---

## 🔍 Additional Checks Required

### Check 1: Azure SQL Connection
- [ ] Verify database is accessible from Azure
- [ ] Check firewall rules allow Azure services
- [ ] Test connection string in SQL Server Management Studio

**Connection String (from .env.azure):**
```
Server=vxtdb.database.windows.net
Database=free-sql-db-5949639
UID=vxtadmin
```

### Check 2: Environment Variables
Verify these are set in Azure App Settings:
```
ENVIRONMENT=production
SQL_CONNECTION_STRING=Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net;Database=free-sql-db-5949639;UID=vxtadmin;PWD=Barak1976!;...
```

### Check 3: Firewall & Network
- [ ] Check if Azure SQL firewall allows 0.0.0.0 or specific Azure services
- [ ] Verify Container Registry credentials
- [ ] Check App Service IP is whitelisted

---

## 🚀 Complete Deployment Steps

### 1. Fix Dockerfile
```powershell
# Edit Dockerfile - Add UTF-8 env vars
```

### 2. Scan for Remaining Issues
```powershell
cd C:\VXT

# Search for any Unicode escapes
Select-String -Path main.py -Pattern '\\U\|\\u' 

# Search for emoji in comments/strings
Get-Content main.py | Select-String '[🚀✅❌⚠️📊]'
```

### 3. Build & Test Locally
```powershell
# Build image
docker build -t vxt-api:latest .

# Run and test
docker run --rm -e PYTHONIOENCODING=utf-8 -p 8000:8000 vxt-api:latest

# In another terminal
curl -X GET http://localhost:8000/protocols
```

### 4. Deploy to Azure
```powershell
# Login to Azure
az login

# Build and push to ACR
az acr build --registry vxtwapp --image vxt-api:latest .

# Or use Docker directly
docker tag vxt-api:latest vxtwapp.azurecr.io/vxt-api:latest
docker push vxtwapp.azurecr.io/vxt-api:latest

# Restart Web App
az webapp restart --name vxt-web-app-g5gbaee2f4bmgphb --resource-group <resource-group>
```

### 5. Verify Deployment
```powershell
# Check logs
az webapp log tail --name vxt-web-app-g5gbaee2f4bmgphb --resource-group <resource-group>

# Test endpoints
curl https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net/protocols
```

---

## 📊 Summary Table

| Issue | Root Cause | Fix | Priority |
|-------|-----------|-----|----------|
| HTTP 500 Errors | Unicode emoji in print() | Enable UTF-8 or remove emoji | **HIGH** |
| Database Connection | May not be accessible | Verify firewall rules | **HIGH** |
| Wrong Image Deployed | Outdated container image | Rebuild & redeploy | **HIGH** |
| Environment Variables | Not set in Azure | Set in App Settings | **MEDIUM** |

---

## 🆘 Quick Troubleshooting

**Issue**: Still getting 500 after fix
**Solution 1**: Check Azure logs
```powershell
az webapp log tail --name vxt-web-app-g5gbaee2f4bmgphb
```

**Solution 2**: Check if pymssql can connect
```python
import pymssql
conn = pymssql.connect(server='vxtdb.database.windows.net', 
                       database='free-sql-db-5949639',
                       user='vxtadmin', password='***')
```

**Solution 3**: Verify all required packages in requirements.txt
- ✅ fastapi==0.109.0
- ✅ uvicorn==0.27.0
- ✅ pymssql==2.3.0
- ✅ python-dotenv==1.0.0

---

**Status**: Ready for deployment  
**Next Step**: Update Dockerfile and redeploy  
**Estimated Fix Time**: 15-30 minutes
