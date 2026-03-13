# ⚡ QUICK START - Azure Deployment Complete Checklist

## ✅ What's Done (No More Steps Needed)
- [x] Git production branch created
- [x] React dashboard code ready  
- [x] FastAPI API configured
- [x] SQL schema script prepared
- [x] IoT Device ID feature complete
- [x] Documentation complete

## 📋 Next: Azure Portal Manual Setup (Estimated 60-90 minutes)

### Phase 1: Create Infrastructure (20 minutes)

**Step 1.1: Create Resource Group**
```
Azure Portal → Resource Groups → Create
Name: vxt-resource-group
Location: East US
Review + Create → Create
```

**Step 1.2: Create Storage Account**
```
Azure Portal → Storage Accounts → Create
Name: vxtstorage123 (use random numbers)
Resource Group: vxt-resource-group
Performance: Standard
Redundancy: Locally-redundant storage (LRS)
Access tier: Hot
Review + Create → Create
[Wait 2-3 minutes]
```

**Step 1.3: Create Function App**
```
Azure Portal → Function App → Create
Function App name: vxt-api-functions-123
Resource Group: vxt-resource-group
Runtime stack: Python
Version: 3.11
Region: East US
Hosting options: Consumption
Storage account: vxtstorage123 [select from dropdown]
Create → [Wait 2-3 minutes]
```

**Step 1.4: Create App Service Plan**
```
Azure Portal → App Service Plans → Create
Name: vxt-app-plan
Resource Group: vxt-resource-group
Operating System: Linux
SKU and size: Free F1 (1 GB memory)
Create → [Wait 2-3 minutes]
```

**Step 1.5: Create App Service**
```
Azure Portal → App Services → Create
Web App
Name: vxt-admin-dashboard-123
Resource Group: vxt-resource-group
Publish: Code
Runtime stack: Node 18 LTS
Operating System: Linux
App Service Plan: vxt-app-plan
Create → [Wait 2-3 minutes]
```

### Phase 2: Deploy Code (30 minutes)

**Step 2.1: Build React Dashboard Locally**
```powershell
cd C:\VXT\admin-dashboard
npm install
npm run build
```
Output: `dist/` folder created with production build

**Step 2.2: Deploy to App Service**
```
Azure Portal → vxt-admin-dashboard-123 → Deployment Center
Source: Local Git / Zip Upload
Choose: Manual Deployment
Drag and drop dist/ folder → Deploy
[Wait 5-10 minutes for deployment]
```

OR Via PowerShell:
```powershell
cd C:\VXT\admin-dashboard
$zipPath = "C:\VXT\app.zip"
Compress-Archive -Path "dist/*" -DestinationPath $zipPath -Force
az webapp deployment source config-zip --name vxt-admin-dashboard-123 --resource-group vxt-resource-group --src $zipPath
```

**Step 2.3: Configure Function App**
```
Azure Portal → vxt-api-functions-123 → Configuration
Application settings: Click "+ New application setting"

Add:
Name: AzureSqlConnectionString
Value: Server=tcp:vxtdb.database.windows.net,1433;Initial Catalog=free-sql-db-5949639;Persist Security Info=False;User ID=vxt;Password=Barak1976!;Encrypt=True;Connection Timeout=30;

Name: Environment
Value: prod

Name: WEBSITE_ENABLE_SYNC_UPDATE_SITE  
Value: true

Click Save
```

**Step 2.4: Configure CORS**
```
Azure Portal → vxt-api-functions-123 → CORS
Allowed Origins: [Add these three]
- http://localhost:3001
- http://localhost:5173  
- https://vxt-admin-dashboard-123.azurewebsites.net

Click Save
```

### Phase 3: Update SQL Schema (10 minutes)

**Step 3.1: Run SQL Script**
```
Azure Portal → free-sql-db-5949639 (SQL Database) → Query editor
[Paste all content from: C:\VXT\AZURE_SQL_SCHEMA_UPDATE.sql]
Run
```

Verify output shows:
```
TotalEntities: [count]
EntitiesWithDeviceIDs: [count]
EntitiesWithoutDeviceIDs: [count]
```

### Phase 4: Test Deployment (10 minutes)

**Step 4.1: Access Dashboard**
```
Browser: https://vxt-admin-dashboard-123.azurewebsites.net
[Should load React dashboard with Azure logo]
```

**Step 4.2: Test API Endpoints**
```
Browser: https://vxt-api-functions-123.azurewebsites.net/api/docs
[Should show Swagger API documentation]
```

**Step 4.3: Test IoT Device ID Feature**
```
1. Dashboard → Customer Entities
2. See Device ID column
3. Click Edit on any entity
4. Change Device ID or test SYNC button
5. Verify success message
```

## 📊 Verify Everything Works

### Checklist
- [ ] Dashboard loads: `https://vxt-admin-dashboard-123.azurewebsites.net`
- [ ] API responds: `https://vxt-api-functions-123.azurewebsites.net/api/docs`
- [ ] SQL data visible: Device IDs shown in dashboard
- [ ] Sync button works: Can update device mappings
- [ ] No errors in browser console

## 💰 Verify Costs

```
Function App (Consumption):      FREE (1M calls/month)
App Service Plan (Free F1):      FREE
App Service (Free F1):           FREE  
Storage Account:                 ~$1-2/month
SQL Database:                    ~$0-5/month
────────────────────────────────────
TOTAL:                           ~$1-7/month
```

## 🚀 Live URLs After Deployment

```
Admin Dashboard: https://vxt-admin-dashboard-[numbers].azurewebsites.net
API Endpoints:   https://vxt-api-functions-[numbers].azurewebsites.net/api
API Docs:        https://vxt-api-functions-[numbers].azurewebsites.net/api/docs
SQL Server:      vxtdb.database.windows.net
Database:        free-sql-db-5949639
```

## 📝 Reference Files

All files are in `C:\VXT\`:

```
AZURE_SQL_SCHEMA_UPDATE.sql     ← Copy/paste into Query Editor
DEPLOYMENT_STATUS_FINAL.md      ← Detailed status
GITHUB_BRANCH_SETUP.md          ← Git branch strategy
AZURE_DEPLOYMENT_RUN.md         ← Execution guide
admin-dashboard/                ← React app
main.py                         ← FastAPI backend
```

## ⚡ Quick Copy-Paste Commands

### For React deployment:
```powershell
cd C:\VXT\admin-dashboard
npm install
npm run build
# Then upload dist/ to App Service
```

### For SQL schema:
```
Open Query Editor in Azure Portal
Paste entire content from: C:\VXT\AZURE_SQL_SCHEMA_UPDATE.sql
Click Run
```

### Check deployment status:
```powershell
cd C:\VXT
git status                    # Check local changes
git branch -a                 # Verify production branch
```

## 🎯 Success Criteria

✅ You know deployment is complete when:

1. Dashboard is accessible at `https://vxt-admin-dashboard-123.azurewebsites.net`
2. Can see Customer Entities with Device ID column
3. API endpoints respond with data
4. SQL query shows entities with device IDs populated
5. IoT Device ID sync feature works (click SYNC button)
6. Monthly cost is under $10

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Node.js LTS not available | Use latest Node 18 or 20 LTS |
| React build fails | Run `npm install` again, check npm version |
| SQL connection error | Verify firewall rules, credentials correct |
| CORS errors | Re-check CORS config in Function App |
| Dashboard blank | Check App Service logs, ensure dist/ uploaded |

## 📞 Support Resources

- [Azure Portal](https://portal.azure.com)
- [Azure Functions Docs](https://docs.microsoft.com/en-us/azure/azure-functions/)
- [App Service Docs](https://docs.microsoft.com/en-us/azure/app-service/)
- [SQL Database Docs](https://docs.microsoft.com/en-us/azure/azure-sql/)

---

**Status**: ✅ Ready for Azure Portal Deployment  
**Estimated Time**: 90 minutes  
**Next Step**: Go to [Azure Portal](https://portal.azure.com) and follow Phase 1-4 above
