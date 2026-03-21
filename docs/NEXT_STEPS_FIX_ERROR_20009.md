# CRITICAL: Next Steps to Fix Error 20009

**Date**: March 21, 2026  
**Status**: ROOT CAUSE IDENTIFIED - Ready for implementation  
**Target**: vxt-web-app F1 + vxtdb Azure SQL  

---

## THE PROBLEM (In Plain English)

You're using **pymssql** driver which is like trying to fit a Windows key into a Mac lock. While similar, it just doesn't work right for Azure SQL.

Each time the app tries to connect, it fails with error 20009 because:
1. pymssql doesn't speak Azure's language (Managed Identity)
2. Azure SQL firewall may be blocking the connection
3. ODBC driver setup incomplete on Linux container
4. Connection string format is wrong for mssql-python

---

## THE SOLUTION (3 MAJOR CHANGES)

### CHANGE 1: Replace Driver
**File**: `requirements.txt`

```diff
- pyodbc==5.0.1
- pymssql==2.3.13
+ mssql-python>=1.0.0
```

Then redeploy and let pip install the official Microsoft driver.

---

### CHANGE 2: Simplify Startup
**File**: `startup.sh`

```diff
- apt-get install -y mssql-tools unixodbc-dev
- export PATH="$PATH:/opt/mssql-tools/bin"

# <-- DELETE THOSE LINES, keep only:
pip install -r requirements.txt
gunicorn --workers 1 --worker-class uvicorn.workers.UvicornWorker \
         --bind 0.0.0.0:8000 main:app
```

This removes the 25-second ODBC installation overhead.

---

### CHANGE 3: Fix Connection String
**File**: `main.py` (in database initialization section)

```diff
# OLD (Wrong format):
- connection_string = os.getenv("SQL_CONNECTION_STRING")
- # Format: DRIVER={...};UID=...;PWD=...

# NEW (Correct format):
+ connection_string = (
+     "Server=vxtdb.database.windows.net,1433;"
+     "Database=vxtdb;"
+     "Authentication=ActiveDirectoryMSI;"  # ← Managed Identity
+     "Encrypt=yes;"
+     "TrustServerCertificate=no;"
+ )
+
+ from mssql_python import connect
+ with connect(connection_string) as conn:
+     with conn.cursor() as cursor:
+         cursor.execute("SELECT 1")
```

This uses Azure's own authentication system.

---

## AZURE SIDE: 3 Things to Check/Enable

### 1️⃣ SQL FIREWALL - CRITICAL ⚠️  
**This is probably why you're getting error 20009!**

Go to Azure Portal → SQL Servers → vxtdb → Networking

Find: **"Allow Azure services and resources to access this server"**

Change it to: **ON**

```powershell
# Via CLI if you prefer:
az sql server firewall-rule create \
  --resource-group VXT-IoT-Hub \
  --server vxtdb \
  --name AllowAllWindowsAzureIps \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 2️⃣ WEB APP MANAGED IDENTITY

Go to Azure Portal → App Services → vxt-web-app → Identity

Find: **System assigned** tab

Change Status to: **ON**

```powershell
# Via CLI:
az webapp identity assign \
  --resource-group VXT-IoT-Hub \
  --name vxt-web-app
```

### 3️⃣ DATABASE USER PERMISSIONS

Run this SQL in Azure SQL Database (vxtdb):

```sql
-- Create user from managed identity
CREATE USER [vxt-web-app] FROM EXTERNAL PROVIDER;

-- Grant permissions
ALTER ROLE db_datareader ADD MEMBER [vxt-web-app];
ALTER ROLE db_datawriter ADD MEMBER [vxt-web-app];
ALTER ROLE db_ddladmin ADD MEMBER [vxt-web-app];
```

---

## QUICK START CHECKLIST ✅

### Local Testing (Before Deployment)
- [ ] Create `.env` file with connection string
- [ ] `pip uninstall pymssql pyodbc -y`
- [ ] `pip install mssql-python`
- [ ] Test connection locally with Python script
- [ ] Verify FastAPI starts with `python main.py`

### Azure Configuration
- [ ] SQL firewall: "Allow Azure services" = ON
- [ ] Web App: Managed Identity = ON
- [ ] Database: Created user from external provider
- [ ] Web App: Restart after changes

### Deployment
- [ ] Commit and push changes to GitHub
- [ ] GitHub Actions triggered automatically
- [ ] Monitor deployment status
- [ ] Test health endpoint after 2 minutes

---

## VERIFICATION STEPS

### After deploying, test with:

```powershell
# 1. Check Web App is running (should return your FastAPI response)
Invoke-WebRequest https://vxt-web-app-g5gbaee2f4bmgphb.azurewebsites.net/ -UseBasicParsing

# 2. Check health endpoint (you can't use curl, but logs will show response)
# Just visit: https://vxt-web-app-g5gbaee2f4bmgphb.azurewebsites.net/health/db

# 3. Check logs for errors
az webapp log tail --resource-group VXT-IoT-Hub --name vxt-web-app

# 4. Check configuration
az webapp config show --resource-group VXT-IoT-Hub --name vxt-web-app
```

**Expected output from health/db endpoint**:
```json
{
  "status": "healthy",
  "database": "connected",
  "environment": "production"
}
```

Not:
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "error": "Error 20009..."
}
```

---

## WHY THIS FIXES IT

| Issue | Old Approach | New Approach | Result |
|-------|-------------|-------------|--------|
| **Driver Incompatibility** | pymssql (3rd party) | mssql-python (Microsoft) | ✅ Works with Azure |
| **Authentication** | SQL login in env var | Managed Identity | ✅ No secrets, more secure |
| **ODBC Dependency** | Requires installation | Not needed | ✅ Faster startup |
| **Connection Format** | DRIVER={...} | Server=... | ✅ Correct syntax |
| **Firewall Access** | Blocked by default | Explicitly allowed | ✅ Connection accepted |

---

## IF YOU STILL GET ERROR 20009

### Diagnostic Checklist:
1. ❌ Firewall rule not created? → Create it now
2. ❌ Still using pymssql? → Uninstall, install mssql-python
3. ❌ Managed Identity not on? → Enable it
4. ❌ Database user doesn't exist? → Create it with SQL script
5. ❌ Old code still deployed? → Check git status, redeploy
6. ❌ App not restarted? → Manually restart Web App

### Debug Output Location:
```powershell
# Real-time logs show connection attempts
az webapp log tail --resource-group VXT-IoT-Hub --name vxt-web-app --provider application
```

Look for:
- ✅ `✅ Database connection successful!` = SUCCESS
- ❌ `❌ Database connection failed:` = Still broken, check diagnostic

---

## TIME ESTIMATE

- **Local changes**: 15 minutes
- **Git push + deploy**: 2-3 minutes (auto-deploy via GitHub Actions)
- **Azure changes**: 5 minutes
- **Total**: ~25 minutes from start to health check passing

---

**Once completed, update [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) to reflect actual success!**

