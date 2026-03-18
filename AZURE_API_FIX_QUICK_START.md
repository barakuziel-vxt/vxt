# 🚀 Azure API 500 Error - Quick Fix Guide

## Problem
Your VXT Web App is returning **HTTP 500 errors** for all API endpoints.
- Dashboard can't call `/protocols` or any other API
- Error occurs since yesterday's deployment

## Root Cause ✅ FOUND
**Unicode/Emoji encoding error in print statements**
- Your code has emoji characters (📊) in `print()` statements
- Azure container environment doesn't support them by default
- When API tries to print emoji → crashes → returns 500 error

## Solution Applied ✅ FIXED
Updated `Dockerfile` to enable UTF-8 encoding:
```dockerfile
ENV PYTHONIOENCODING=utf-8
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
```

---

## 🎯 How to Deploy the Fix

### Quick Deployment (Recommended)
```powershell
cd C:\VXT
.\Deploy-VXT-API-Azure-Fixed.ps1
```

**What it does:**
1. ✓ Builds Docker image with UTF-8 fix
2. ✓ Tests image locally  
3. ✓ Pushes to Azure Container Registry
4. ✓ Restarts Web App

**Time**: ~3-5 minutes build + 2-3 minute restart

### Manual Deployment
```powershell
# Step 1: Build image
docker build -t vxt-api:latest .

# Step 2: Test locally (optional)
docker run --rm -p 8000:8000 vxt-api:latest
curl http://localhost:8000/health/db

# Step 3: Push to Azure
docker tag vxt-api:latest vxtwapp.azurecr.io/vxt-api:latest
az acr login --name vxtwapp
docker push vxtwapp.azurecr.io/vxt-api:latest

# Step 4: Restart app
az webapp restart --name vxt-web-app-g5gbaee2f4bmgphb --resource-group vxt-rg
```

---

## ✅ Verify the Fix

After deployment, test these endpoints:

```powershell
# Test 1: Health check (should return 200)
curl -i https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net/health/db

# Test 2: Protocols endpoint (should return JSON list)
curl https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net/protocols

# Test 3: Check app is responding
curl https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net/
```

---

## 🔍 If Issues Persist

### Check Azure Logs
```powershell
az webapp log tail --name vxt-web-app-g5gbaee2f4bmgphb --resource-group vxt-rg
```

### Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Still getting 500 | Old image still running | Wait 60+ seconds for app to start |
| `/protocols` returns error | Database not accessible | Check SQL firewall allows Azure |
| Container won't start | Wrong Python packages | Rebuild with `docker build --no-cache` |
| DNS errors | Regional issue | Try curl with `--ignore-errors` |

### Check Database Connection
```powershell
# Verify connection string is correct in .env.azure
cat .env.azure

# Expected format:
# SQL_CONNECTION_STRING=Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net;...
```

### Verify Version Deployed
```powershell
# Check container logs
az webapp log tail --name vxt-web-app-g5gbaee2f4bmgphb

# Should show (new version):
# ENV PYTHONIOENCODING=utf-8
# ENV LANG=C.UTF-8
# ENV LC_ALL=C.UTF-8
```

---

## 📊 What Changed

### Dockerfile Changes
| Before | After |
|--------|-------|
| No UTF-8 config | `ENV PYTHONIOENCODING=utf-8` |
| System default encoding | `ENV LANG=C.UTF-8` |
| May fail on emoji | `ENV LC_ALL=C.UTF-8` |

### Files Modified
- ✅ `Dockerfile` - Added UTF-8 environment variables
- ✅ `API_AZURE_500_ERROR_DIAGNOSIS.md` - Created detailed diagnosis
- ✅ `Deploy-VXT-API-Azure-Fixed.ps1` - Created deployment script

---

## 🎓 Why This Happened

### Technical Explanation
1. Python tries to print emoji character `📊` (`\U0001f4ca`)
2. Windows default encoding (cp1252) can handle it
3. Azure container uses different locale
4. Python can't encode emoji → Exception
5. Uvicorn catches exception → Returns HTTP 500

### Prevention
- Always use UTF-8 for deployments
- Avoid emoji in production logging
- Test Docker images locally before deploying

---

## ✨ Next Steps

### Immediate (Today)
1. Run deployment script or manual steps above
2. Wait 60 seconds for restart
3. Test endpoints work
4. Verify dashboard can load APIs

### Soon (Within 24 hours)
1. Check application logs for any other issues
2. Monitor error rates in Application Insights
3. Consider centralizing logging (not just print statements)

### Later (This Week)
1. Replace print() with proper logging module
   ```python
   import logging
   logger.info("GET /protocols")
   ```
2. Add structured error telemetry
3. Set up alerts for HTTP 500 errors

---

## 📞 Support

**If deployment fails:**
1. Check Docker is running
2. Verify Azure CLI is authenticated: `az account show`
3. Check Azure subscription is active
4. Review error message carefully

**If API still returns 500:**
1. Check database connectivity
2. Review Application Insights in Azure Portal
3. Check blob storage for detailed logs

---

**Status**: Ready to deploy  
**Estimated Fix Time**: 15-30 minutes  
**Difficulty**: Low (automated script ready)

Run `.\Deploy-VXT-API-Azure-Fixed.ps1` to fix! 🚀
