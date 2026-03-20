# Deploy to Azure Web App - Complete Guide

This guide will deploy your FastAPI + React app to Azure in 5 steps.

---

## Prerequisites ✓

- ✅ Web App created: `vxt-admin-app`
- ✅ Azure SQL Database: existing (Europe)
- ✅ Code in GitHub: `main` branch
- ✅ App Service Plan: ASP-VXTIoTHub-8523 (Linux, Free F1)

---

## Step 1: Build React Dashboard Locally

Run this in PowerShell (in C:\VXT):

```powershell
cd admin-dashboard
npm install
npm run build
cd ..
```

**What it does:** Creates `admin-dashboard/dist/` folder with optimized React code

**Time:** 3-5 minutes

**Expected output:**
```
✓ vite v5.x.x building for production...
✓ built in 2.5s
```

---

## Step 2: Get Your Web App Git Deploy URL

1. **Azure Portal** → **VXT-IoT-Hub** → **vxt-admin-app**
2. **Left sidebar** → **Deployment** → **Deployment Center**
3. **Under "Source"** → Select **"Local Git"**
4. **Click "Save"**
5. **Copy the Git URL:**
   ```
   https://<username>@vxt-admin-app.scm.azurewebsites.net/vxt-admin-app.git
   ```

**Save this URL** - you'll need it in Step 3

---

## Step 3: Configure Git Remote & Push to Azure

In PowerShell (C:\VXT):

```powershell
# Check current git remote
git remote -v

# Add Azure remote
git remote add azure https://<username>@vxt-admin-app.scm.azurewebsites.net/vxt-admin-app.git

# Replace "main" with your branch name if different
git push azure main:master

# This will ask for password - use your Azure username/password from Deployment Center
```

**What it does:** Pushes your code to Azure, triggers automatic deployment

**Time:** 1-2 minutes

**Expected output:**
```
Counting objects: 150...
remote: Deployment successful!
```

---

## Step 4: Update Database Connection String

1. **Azure Portal** → **vxt-admin-app** (Web App)
2. **Left sidebar** → **Settings** → **Environment variables** (or **Configuration**)
3. **Click "+ New application setting"**
4. **Add:**
   - **Name:** `DATABASE_URL`
   - **Value:** (see below how to get it)

### How to Get DATABASE_URL:

1. **Go to your SQL Database** in Azure Portal
2. **Left sidebar** → **Connection strings**
3. **Copy the "ADO.NET (SQL authentication)" string**
4. **Replace:**
   - `{your_username}` → Your SQL admin username
   - `{your_password}` → Your SQL admin password
5. **Paste into Azure Portal**

**Example:**
```
Server=tcp:vxt-db.database.windows.net,1433;Initial Catalog=vxt;Persist Security Info=False;User ID=sqladmin;Password=YourPassword123!;Encrypt=True;Connection Timeout=30;
```

5. **Click "OK"** → **Click "Save"**

---

## Step 5: Execute SQL Schema Update

1. **Azure Portal** → **SQL Database** → **Query Editor**
2. **Login** with SQL admin credentials
3. **Copy the entire script below** and paste into Query Editor:

```sql
-- Add iotDeviceId column if it doesn't exist
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CustomerEntities' AND COLUMN_NAME = 'iotDeviceId'
)
BEGIN
    ALTER TABLE CustomerEntities ADD iotDeviceId NVARCHAR(128) NULL;
    PRINT 'Column iotDeviceId added successfully';
END
ELSE
BEGIN
    PRINT 'Column iotDeviceId already exists';
END

-- Verify the column exists
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'CustomerEntities' AND COLUMN_NAME = 'iotDeviceId';
```

4. **Click "Run"**
5. **Should see:**
   ```
   Column iotDeviceId added successfully
   
   COLUMN_NAME    DATA_TYPE      IS_NULLABLE
   iotDeviceId    nvarchar(128)  YES
   ```

---

## Step 6: Test Your Deployment

Wait 2-3 minutes for Azure to fully start the app, then:

### Test 1: Access the Dashboard
```
https://vxt-admin-app.azurewebsites.net
```

Should see: Admin dashboard with Customer Entities table

### Test 2: API Endpoints
```
https://vxt-admin-app.azurewebsites.net/api/customerentities
```

Should return: JSON list of customer entities with `iotDeviceId` field

### Test 3: Check Logs (if issues)
1. **Azure Portal** → **vxt-admin-app** 
2. **Left sidebar** → **Log Stream**
3. **Watch for errors**

---

## Troubleshooting

### "Deployment failed"
- Check git remote: `git remote -v`
- Check branch name: `git branch`
- Ensure code is committed: `git status`

### "Cannot connect to database"
- Verify DATABASE_URL format
- Check Azure SQL firewall rules allow App Service
  - **SQL Database** → **Firewalls and virtual networks**
  - **Allow Azure services and resources**: ON

### "Module not found" errors
- Web App is missing dependencies
- **Solution:** Add `requirements.txt` with all Python packages
  - FastAPI, uvicorn, pyodbc, sqlalchemy, etc.

### "React page is blank"
- Static files not deployed
- Check `admin-dashboard/dist/` folder exists locally
- Re-run: `npm run build`

---

## Summary

✅ **What's deployed:**
- FastAPI backend (main.py)
- React admin dashboard
- Database schema updated
- Environment variables configured

✅ **What's working:**
- API endpoints responding
- Dashboard loading
- Database connected
- Device IDs visible

---

## Next: Verify Everything Works

1. **Visit dashboard URL**
2. **Check API endpoints**
3. **Test SYNC button** (should make API call to device twin)
4. **Monitor logs** for errors

---

## Rollback if Needed

If something breaks:

```powershell
# Revert to previous commit
git reset --hard HEAD~1
git push azure main:master
```

---

Done! Your app is now LIVE on Azure ☁️
