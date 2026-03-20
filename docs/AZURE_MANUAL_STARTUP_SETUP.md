# 🚀 CRITICAL: Azure App Service Manual Setup Required

**Status**: Deployment files pushed ✅
**Next Step**: Configure startup in Azure Portal (REQUIRED for app to start)

## ⚠️ This MUST be done in Azure Portal for the app to run

### Step 1: Go to Azure Portal
- Resource: **vxt-web-app**
- Resource Group: **VXT-IoT-Hub**

### Step 2: Configure General Settings
**Menu Path**: Settings → Configuration → General settings

1. **Runtime stack**: Python
2. **Python version**: 3.11
3. **Startup Command**: Choose ONE:

   **OPTION A** (Using startup.sh - Recommended):
   ```
   bash startup.sh
   ```

   **OPTION B** (Direct uvicorn):
   ```
   python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

4. **Click Save** and wait for app to restart

### Step 3: Configure Application Settings
**Menu Path**: Settings → Configuration → Application settings

Add these values (if not already set):

| Key | Value | Notes |
|-----|-------|-------|
| `ENVIRONMENT` | `azure` | Tells app it's running in Azure |
| `SQL_CONNECTION_STRING` | See below | Database connection string |
| `FRONTEND_URL` | `https://ambitious-sand-0b08c3f03.6.azurestaticapps.net` | For CORS access |

**SQL_CONNECTION_STRING format**:
```
Server=tcp:your-server.database.windows.net,1433;Initial Catalog=your-database;User ID=your-user;Password=your-password;TrustServerCertificate=no;Connection Timeout=30;
```

Get these values from:
- **Server**: Azure SQL Server → Properties → Server name
- **Database**: Azure SQL Database → name
- **User ID**: Your SQL user (likely `azureuser` or similar)
- **Password**: Your SQL password

### Step 4: Verify Configuration
After saving, check:

1. **App Service Logs**:
   ```powershell
   az webapp log tail --name vxt-web-app --resource-group VXT-IoT-Hub
   ```
   Should show:
   ```
   [INFO] ===== APP INITIALIZATION STARTED =====
   [INFO] Environment variables loaded
   [INFO] ===== APP INITIALIZATION COMPLETE =====
   INFO:     Uvicorn running on http://0.0.0.0:8000
   ```

2. **Test health endpoint**:
   ```powershell
   curl https://vxt-web-app.azurewebsites.net/health/db
   ```
   Should return JSON with database status

## 📋 What Was Changed

### Requirements
- ✅ Removed `gunicorn==21.2.0` (was causing complications)
- ✅ Changed to `uvicorn[standard]==0.27.0` (simpler, direct ASGI server)
- ✅ All other dependencies verified

### Configuration Files
- ✅ **web.config** - Updated to properly forward HTTP to Uvicorn
- ✅ **startup.sh** - Simplified, removed gunicorn, added diagnostics
- ✅ **main.py** - Already has comprehensive error logging
- ✅ **.github/workflows/deploy-to-azure.yml** - Updated, removed hardcoded startup-command

### Deployment Flow
1. GitHub Actions builds and verifies dependencies
2. Deploys all files to Azure App Service
3. **Azure uses web.config + startup command** you set in Portal
4. App starts with Uvicorn directly

## 🔍 Troubleshooting

If app still doesn't start:

1. **Check Log Stream** (Portal → App Service → Log Stream):
   ```powershell
   az webapp log tail --name vxt-web-app --resource-group VXT-IoT-Hub
   ```

2. **Look for [ERROR]** messages - will show exactly what failed

3. **Common issues**:
   - `[ERROR] Failed to load environment variables` → Missing `ENVIRONMENT` setting
   - `[ERROR] Database connection failed` → Check `SQL_CONNECTION_STRING`
   - `ModuleNotFoundError: No module named 'fastapi'` → Dependencies not installed (pip failed)
   - `Port already in use` → Change port in startup command

4. **If still stuck**:
   - Restart the app (Portal → Restart)
   - Check Python 3.11 is selected
   - Verify startup command has no typos
   - Ensure startup.sh file exists in deployed files

## ✅ Success Criteria

Once configured correctly, you should see:

1. **Log shows startup sequence**:
   ```
   [INFO] ===== APP INITIALIZATION STARTED =====
   [INFO] ===== APP INITIALIZATION COMPLETE =====
   INFO:     Uvicorn running on http://0.0.0.0:8000
   ```

2. **Health endpoint works**:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "totalTables": 15,
     "missingTables": [],
     "message": "Database is ready"
   }
   ```

3. **Admin dashboard can load data** from `/entities` endpoint

## Commit Reference
**Commit**: ddb5660
**Message**: "feat: fresh deployment from scratch - removed gunicorn, simplified to uvicorn, updated web.config and startup.sh"
