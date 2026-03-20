# Azure Deployment - Quick Reference Card (1-Page Cheat Sheet)

**Print this page or keep it visible while deploying!**

---

## 🚀 PHASE 1: Database (5-10 min)

### Command
1. Go to: https://portal.azure.com
2. Search "SQL databases"
3. Select: free-sql-db-5949639
4. Click: Query Editor
5. Login: `vxt` / `Barak1976!`
6. Copy file: `AZURE_SQL_DEPLOYMENT.sql` → Paste into editor
7. Click: **Run**
8. ✅ See: Results with 5 entities

### Verify
```sql
SELECT COUNT(*) as [Total], 
       SUM(CASE WHEN iotDeviceId IS NOT NULL THEN 1 ELSE 0 END) as [With IDs]
FROM CustomerEntities;
-- Expected: Total=5, With IDs=5
```

---

## 🔧 PHASE 2: API Functions (20-30 min)

### Step 1: Storage Account
```
Portal → Search "Storage accounts" → Create
├─ Name: vxtstorage (must be unique)
├─ Resource Group: vxt-resource-group
├─ Region: East US
└─ Click Create
```

### Step 2: Function App
```
Portal → Search "Function App" → Create
├─ Name: vxt-api-functions (must be unique)
├─ Runtime: Python 3.11
├─ Plan: Consumption (FREE)
├─ Storage: vxtstorage
├─ Region: East US
└─ Click Create
```

### Step 3: Deploy Functions (6 total)
```
In Function App Portal:
1. Functions → Create
2. Template: HTTP trigger
3. Name each:
   • HttpTriggerGetEntities
   • HttpTriggerGetEntity
   • HttpTriggerCreateEntity
   • HttpTriggerUpdateEntity
   • HttpTriggerDeleteEntity
   • HttpTriggerSyncSetup ⭐

Copy code from: AZURE_API_FUNCTION_SETUP.md (code templates)
Paste into each function → Save
```

### Step 4: Environment Variables
```
Function App → Configuration → + New application setting

Name: AzureSqlConnectionString
Value: Server=tcp:vxtdb.database.windows.net,1433;Initial Catalog=free-sql-db-5949639;Persist Security Info=False;User ID=vxt;Password=Barak1976!;Encrypt=True;Connection Timeout=30;

Click Save
```

### Step 5: CORS
```
Function App → CORS → Add:
• http://localhost:3001
• http://localhost:5173
• https://vxt-admin-dashboard.azurewebsites.net
Click Save
```

### Step 6: Test
```powershell
$api = "https://vxt-api-functions.azurewebsites.net/api"

# Test 1
Invoke-RestMethod -Uri "$api/customerentities" -Method GET

# Test 2
Invoke-RestMethod -Uri "$api/customerentities/2/sync-setup" `
    -Method POST -Body '{"provider_name":"iot_hub"}' -ContentType "application/json"

# Expected: {"status":"success", "device_id":"TomerRefael"}
```

---

## 🎨 PHASE 3: Frontend (15-25 min)

### Step 1: Build Locally
```powershell
cd admin-dashboard
npm install  # if needed
npm run build

# Verify: /dist folder created with index.html
```

### Step 2: App Service Plan
```
Portal → Search "App Service Plans" → Create
├─ Name: vxt-app-plan
├─ Resource Group: vxt-resource-group
├─ Sku: Free F1
└─ Click Create
```

### Step 3: App Service
```
Portal → Search "App Services" → Create Web App
├─ Name: vxt-admin-dashboard (must be unique)
├─ Runtime: Node 18 LTS
├─ Plan: vxt-app-plan
├─ Region: East US
└─ Click Create
```

### Step 4: Deploy Files
```powershell
# Option A: PowerShell/ZIP
cd admin-dashboard/dist
Compress-Archive -Path * -DestinationPath ../app.zip -Force
cd ..

az webapp deployment source config-zip `
    --resource-group vxt-resource-group `
    --name vxt-admin-dashboard `
    --src app.zip

# Option B: Azure Portal Kudu
Go to: https://vxt-admin-dashboard.scm.azurewebsites.net/DebugConsole
Drag-drop contents of /dist into wwwroot
```

### Step 5: Environment Variables
```
App Service → Configuration → Application settings → + New

VITE_API_BASE_URL = https://vxt-api-functions.azurewebsites.net/api
NODE_ENV = production

Click Save
```

### Step 6: Test
```
Open: https://vxt-admin-dashboard.azurewebsites.net
├─ Should load without errors
├─ Should show 5 entities
├─ Should see IoT Device ID column ✅
├─ Click Edit → see Device ID field ✅
├─ Click Sync → see success message ✅
```

---

## ✅ Success Criteria Per Phase

| Phase | Item | ✅ Check |
|-------|------|---------|
| 1 | SQL schema updated | Query returns 5 entities |
| 1 | Device IDs populated | See "TomerRefael" etc. |
| 2 | Function App running | Portal shows "Running" |
| 2 | API callable | curl/PowerShell returns 200 |
| 2 | CORS configured | No CORS errors |
| 3 | Dashboard accessible | HTTPS URL works |
| 3 | Data loads | 5 entities visible |
| 3 | Device ID column | Shows in table |
| 3 | Sync button | Shows & clickable |
| 3 | Sync works | Returns success |

---

## 🚨 Quick Troubleshooting

### "SQL connection fails"
→ Check: Server is `vxtdb.database.windows.net` (not localhost)
→ Check: User is `vxt` / Password is `Barak1976!`
→ Check: Database firewall allows "Azure services"

### "CORS error in dashboard"
→ Go: Function App → CORS
→ Add: `https://vxt-admin-dashboard.azurewebsites.net`
→ Wait: 60 seconds then refresh

### "API returns 500 error"
→ Go: Function App → specific function
→ Click: Monitor
→ View: Error details in logs
→ Usually: Connection string issue

### "Dashboard loads blank"
→ Check: /dist folder exists with index.html
→ Re-deploy using ZIP method
→ Clear browser cache (Ctrl+Shift+Del)

### "Sync button doesn't work"
→ Check: Browser DevTools → Console
→ Check: Function App logs
→ Verify: IoT Hub connection string set (optional)

---

## 🔑 Important Credentials

```
Azure SQL Database:
  Server: vxtdb.database.windows.net
  User: vxt
  Password: Barak1976!
  Database: free-sql-db-5949639

Connection String:
  Server=tcp:vxtdb.database.windows.net,1433;Initial Catalog=free-sql-db-5949639;Persist Security Info=False;User ID=vxt;Password=Barak1976!;Encrypt=True;Connection Timeout=30;
```

---

## 📍 Post-Deployment URLs

```
Admin Dashboard:
  https://vxt-admin-dashboard.azurewebsites.net

API Base:
  https://vxt-api-functions.azurewebsites.net/api

Azure Portal Links:
  SQL Database:   https://portal.azure.com → SQL databases
  Function App:   https://portal.azure.com → Function apps
  App Service:    https://portal.azure.com → App services
  Resource Group: https://portal.azure.com → Resource groups
```

---

## ⏱️ Timeline Tracker

```
Start Time: ___________

Phase 1 Start: ___________  (Target: 5-10 min)
Phase 1 Done:  ___________  ✅

Phase 2 Start: ___________  (Target: 20-30 min)
Phase 2 Done:  ___________  ✅

Phase 3 Start: ___________  (Target: 15-25 min)
Phase 3 Done:  ___________  ✅

Total Time: ___________  (Target: 2-3 hours)
```

---

## 📋 Resource Names (Copy These Exactly)

```
Resource Group:        vxt-resource-group
Storage Account:       vxtstorage
Function App:          vxt-api-functions
App Service Plan:      vxt-app-plan
App Service:           vxt-admin-dashboard
Database:              free-sql-db-5949639
Database Server:       vxtdb

API Functions (6 total):
  1. HttpTriggerGetEntities
  2. HttpTriggerGetEntity
  3. HttpTriggerCreateEntity
  4. HttpTriggerUpdateEntity
  5. HttpTriggerDeleteEntity
  6. HttpTriggerSyncSetup
```

---

## 🎯 Final Verification

After all 3 phases complete:

```
☐ Admin Dashboard loads without errors
☐ Sees 5 customer entities in list
☐ IoT Device ID column visible
  ├─ Entity 1: vessel-033114869
  ├─ Entity 2: TomerRefael
  └─ Entity 3: vessel-234567891

☐ Edit entity works
  ├─ Form shows IoT Device ID field
  └─ Can edit the value

☐ Sync button visible and functional
  ├─ Shows when entity has device ID
  ├─ Shows loading state (⏳)
  └─ Shows success message (✓)

☐ No errors in Browser Console (F12)

☐ Application Insights shows successful calls
```

---

## 🎓 Learn More

If you want to understand the architecture better:

```
Architecture: See AZURE_MULTI_LAYER_DEPLOYMENT.md

Phase Details:
  Phase 1: AZURE_DEPLOYMENT_GUIDE.md
  Phase 2: AZURE_API_FUNCTION_SETUP.md
  Phase 3: AZURE_FRONTEND_DEPLOYMENT.md

Complete Overview: AZURE_DEPLOYMENT_QUICK_START.md

Local Testing (already done): IMPLEMENTATION_CHECKLIST_IOT.md
```

---

## 💡 Pro Tips

1. **Do all 3 phases in one sitting** → More consistent
2. **Keep Azure Portal open in one tab** → Easier switching
3. **Keep PowerShell terminal open** → For testing
4. **Monitor Application Insights** → Catch errors early
5. **Screenshot success points** → For documentation

---

## 🚀 You're Ready!

Everything is prepared. All guides are written. All code is ready.

**Time to execute**: 2-3 hours  
**Difficulty**: ⭐⭐ (Moderate - mostly portal clicking)  
**Risk**: Low (all resources are free tier, easy to delete if needed)  

**Next Action**: Open Azure Portal and start Phase 1!

---

**Generated**: March 13, 2026  
**Print or Bookmark This Page!**
