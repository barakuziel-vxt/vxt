# 🚀 Azure Deployment - Complete Checklist & Quick Reference

**Status**: Deployment & Configuration Guide Ready  
**Total Time**: ~2.5-3 hours (all phases)  
**Cost**: $1-7/month (zero egress charges)

---

## 📋 Complete Deployment Workflow

### PHASE 1: Database (5-10 min) ✅ ALREADY READY

```
Task                          Action                        Time    Done?
─────────────────────────────────────────────────────────────────────────
Verify SQL exists             Check vxtdb.database.windows  1 min    [ ]
Execute SQL script            Run AZURE_SQL_DEPLOYMENT.sql  5 min    [ ]
Verify 5 entities exist       Query returns 5 rows           2 min    [ ]
```

**Go to**: [AZURE_DEPLOYMENT_GUIDE.md](AZURE_DEPLOYMENT_GUIDE.md) for detailed steps

---

### PHASE 2A: Create Resources (North Europe) - 15-20 min ⏳

```
Resource               Region          Type        Free?   Action
──────────────────────────────────────────────────────────────────
Storage Account        North Europe    Infrastructure  ✅   Create
Function App           North Europe    Compute         ✅   Create
IoT Hub               North Europe    Messaging       ✅   Create
(Optional) App Insights North Europe   Monitoring      ✅   Create
```

**Portal Navigation**:
```
1. Create Storage Account
   Azure Portal → Storage accounts → Create
   Name: vxtstorage
   Region: North Europe
   Tier: Standard
   Replication: Locally-redundant

2. Create Function App
   Azure Portal → Function App → Create
   Name: vxt-api-functions
   Runtime: Python 3.11
   Region: North Europe ⚠️ IMPORTANT!
   Plan: Consumption
   Storage: vxtstorage

3. Create IoT Hub
   Azure Portal → IoT Hub → Create
   Name: vxt-iot-hub
   Region: North Europe
   Tier: Free

```

---

### PHASE 2B: Deploy Functions (10-15 min) ⏳

```
Function Name              Endpoint                         Action
────────────────────────────────────────────────────────────────────
GetEntities                GET /api/customerentities        Deploy
GetEntity                  GET /api/customerentities/{id}   Deploy
CreateEntity               POST /api/customerentities       Deploy
UpdateEntity               PUT /api/customerentities/{id}   Deploy
DeleteEntity               DELETE /api/customerentities/{id} Deploy
SyncSetup                  POST /api/.../sync-setup        Deploy
```

**Steps**:
```
1. In Azure Portal → Function App → Functions
2. Create HTTP trigger for each function
3. Copy code from AZURE_API_FUNCTION_SETUP.md
4. Save and deploy
5. Test each endpoint
```

---

### PHASE 2C: Configure Functions (10-15 min) ⏳

```
Configuration Item         Location                         Priority
────────────────────────────────────────────────────────────────────
Environment Variables      Settings → Configuration         🔴 CRITICAL
  SQL_SERVER               vxtdb.database.windows.net
  SQL_DATABASE             free-sql-db-5949639
  SQL_USER                 vxt
  SQL_PASSWORD             Barak1976!

CORS Setup                 Settings → CORS                  🔴 CRITICAL
  Origin 1                 https://vxt-admin-dashboard...
  Origin 2                 http://localhost:5173 (dev)
  Methods                  GET, POST, PUT, DELETE, OPTIONS
  Headers                  Content-Type, Authorization
```

**See**: [AZURE_CONFIGURATION_GUIDE.md](AZURE_CONFIGURATION_GUIDE.md) Phase 2 for detailed steps

---

### PHASE 3A: Create Static Web Apps (5 min) ⏳

```
Resource          Region          Type           Action
──────────────────────────────────────────────────────────────
Static Web Apps   West Europe     Frontend       Create
```

**Portal Navigation**:
```
1. Go to Azure Portal
2. Search "Static Web App" → Create
3. Name: vxt-admin-dashboard
4. Region: West Europe ⚠️ NOT North Europe!
5. Plan: Free
6. GitHub Integration:
   - Connect GitHub account
   - Select repo: barakuziel-vxt/vxt
   - Build preset: React (Vite)
   - Build path: admin-dashboard/
   - Output location: dist/
```

---

### PHASE 3B: Configure Static Web Apps (5 min) ⏳

```
Configuration           Location                    Action
──────────────────────────────────────────────────────────
Environment Variable    Settings → Configuration   Set
  VITE_API_BASE_URL     https://vxt-api-functions.azurewebsites.net
```

**See**: [AZURE_CONFIGURATION_GUIDE.md](AZURE_CONFIGURATION_GUIDE.md) Phase 3 for detailed steps

---

### PHASE 3C: Build & Deploy React (5 min) ⏳

```
Step                     Command                          Time
─────────────────────────────────────────────────────────────────
Build locally            npm run build                    3-5 min
Verify build works       ls admin-dashboard/dist/        1 min
Deploy                   git push origin main             2-5 min
                         (auto-deploys via GitHub)
```

**Static Web Apps will**:
```
✅ Detect GitHub push
✅ Trigger auto-build
✅ Copy dist/ to CDN
✅ Deploy globally
✅ Available at https://vxt-admin-dashboard.azurewebsites.net
```

---

### PHASE 4: Integration Testing (10-15 min) ⏳

```
Test                      Expected Result                Status
──────────────────────────────────────────────────────────────────
Dashboard loads           Page visible in <2 sec         [ ]
API endpoint responds     GET returns 200 + JSON         [ ]
5 entities visible       Table shows Barak...Shula       [ ]
No CORS errors           DevTools console clean          [ ]
Edit form works          Can edit entity fields          [ ]
Sync button works        Updates database successfully   [ ]
```

**Test Commands** (from browser console):
```javascript
// Test 1: API responds
fetch('https://vxt-api-functions.azurewebsites.net/api/customerentities')
  .then(r => r.json())
  .then(d => console.log(d))

// Test 2: Check CORS headers
fetch('https://vxt-api-functions.azurewebsites.net/api/customerentities')
  .then(r => {
    console.log('CORS Header:', r.headers.get('access-control-allow-origin'))
    return r.json()
  })
```

---

## ✅ Pre-Deployment Checklist

Before you deploy, verify:

```
Local Environment
─────────────────
[ ] Git repository ready (VXT folder)
[ ] React admin-dashboard builds: npm run build ✅
[ ] Python API functions ready: all 6 functions present ✅
[ ] SQL script ready: AZURE_SQL_DEPLOYMENT.sql ✅
[ ] Database credentials: vxt / Barak1976! ✅

Azure Account
─────────────
[ ] Azure subscription active
[ ] Logged into Azure Portal
[ ] Have resource group name ready: vxt-resource-group
[ ] GitHub account connected (for Static Web Apps)
[ ] Permissions to create resources

Documentation
──────────────
[ ] AZURE_DEPLOYMENT_GUIDE.md (Phase 1: Database)
[ ] AZURE_API_FUNCTION_SETUP.md (Phase 2: Functions)
[ ] AZURE_FRONTEND_DEPLOYMENT.md (Phase 3: Frontend)
[ ] AZURE_CONFIGURATION_GUIDE.md (Configuration)
[ ] This file (checklist)
```

---

## 🎯 Step-by-Step Execution

### Day 1: Phase 1 (Database) - 10 minutes

```
1. Open Azure Portal
2. Navigate to SQL Database: vxtdb.database.windows.net
3. Open Query Editor
4. Login: vxt / Barak1976!
5. Run: AZURE_SQL_DEPLOYMENT.sql
6. Verify: 5 entities returned
✅ Phase 1 Complete!
```

---

### Day 1-2: Phase 2 (Azure Functions) - 30 minutes

```
Part A: Create Resources (10 min)
1. Create Storage Account (vxtstorage) in North Europe
2. Create Function App (vxt-api-functions) in North Europe
3. Create IoT Hub (vxt-iot-hub) in North Europe

Part B: Deploy Functions (15 min)
1. Create 6 HTTP trigger functions
2. Copy code from AZURE_API_FUNCTION_SETUP.md
3. Save each function
4. Deploy all

Part C: Configure (5 min)
1. Set environment variables (SQL connection)
2. Configure CORS for Static Web Apps domain
3. Configure CORS for http://localhost:5173 (dev)
4. Restart Function App

✅ Phase 2 Complete!
```

---

### Day 2-3: Phase 3 (Static Web Apps) - 15-20 minutes

```
Part A: Create Static Web Apps (5 min)
1. Create Static Web App (vxt-admin-dashboard)
2. Region: West Europe (NOT North Europe!)
3. Connect GitHub repository
4. Select admin-dashboard/ as build path
5. Select dist/ as output location

Part B: Configure (5 min)
1. Set environment variable: VITE_API_BASE_URL
2. Value: https://vxt-api-functions.azurewebsites.net

Part C: Deploy (5-10 min)
1. Build locally: cd admin-dashboard && npm run build
2. Commit to GitHub: git push origin main
3. Wait for auto-deploy (2-5 minutes)
4. Verify at: https://vxt-admin-dashboard.azurewebsites.net

✅ Phase 3 Complete!
```

---

### Phase 4: Integration Testing - 15 minutes

```
1. Open dashboard: https://vxt-admin-dashboard.azurewebsites.net
2. Verify page loads in <2 seconds
3. Check DevTools console for no errors
4. Navigate to "Customer Entities"
5. Verify 5 entities appear in table
6. Click Edit on one entity
7. Try filling form
8. Click Sync button
9. Check for success message
10. Refresh page, verify changes persisted

All tests passing? 🎉 YOU'RE LIVE!
```

---

## 🔗 Important URLs During Deployment

```
Azure Portal:           https://portal.azure.com
Resource Group:         vxt-resource-group
Storage Account:        vxtstorage
Function App:           vxt-api-functions
SQL Database:           vxtdb.database.windows.net
Static Web Apps:        vxt-admin-dashboard
API Base URL:           https://vxt-api-functions.azurewebsites.net
Dashboard URL:          https://vxt-admin-dashboard.azurewebsites.net

GitHub Repo:            barakuziel-vxt/vxt
Admin Dashboard:        admin-dashboard/
```

---

## 🔑 Credentials & Connection Strings

```
Azure SQL Database
├─ Server:   vxtdb.database.windows.net
├─ Database: free-sql-db-5949639
├─ Username: vxt
└─ Password: Barak1976!

Local SQL (for testing)
├─ Server:   127.0.0.1:1433
├─ Database: BoatTelemetryDB
├─ Username: sa
└─ Password: [your local password]
```

⚠️ **KEEP THESE SECURE** - Consider Azure Key Vault after POC

---

## 💰 Cost Tracking

```
Component              Month 1         Month 2+        Notes
─────────────────────────────────────────────────────────
Azure SQL             FREE (trial)     $5              32GB free
Functions             FREE             FREE            1M calls free
Storage               ~$1-2            ~$1-2           Function runtime
Static Web Apps       FREE             FREE            Global CDN
IoT Hub               FREE             FREE            8K msgs/day
─────────────────────────────────────────────────────────
TOTAL                 ~$1-2            ~$6-7           /month
```

---

## 🎓 Troubleshooting Quick Reference

| Problem | Solution | Time |
|---------|----------|------|
| CORS error in browser | Check CORS configured in Function App | 2 min |
| API returns 500 | Verify SQL connection strings in env vars | 3 min |
| Dashboard shows no data | Check VITE_API_BASE_URL variable | 2 min |
| Sync button doesn't work | Verify sync endpoint code | 5 min |
| Cold start (3-5 sec) | This is normal, not a bug | N/A |
| Functions not found | Check deployment completed | 3 min |

**See**: [AZURE_CONFIGURATION_GUIDE.md](AZURE_CONFIGURATION_GUIDE.md) for detailed fixes

---

## 📞 Getting Help

```
Azure Portal Search: "Function App Insights" → Debug logs
Browser DevTools:    F12 → Console → Check for errors
PowerShell:          Get-AzFunctionApp -Name vxt-api-functions
CLI:                 az functionapp list --resource-group vxt-resource-group
```

---

## ✨ Success Indicators

You'll know everything is working when:

```
✅ Dashboard loads at https://vxt-admin-dashboard.azurewebsites.net
✅ 5 customer entities display in table
✅ Each entity has iotDeviceId value
✅ Edit form works without errors
✅ Sync button calls API successfully
✅ Database updates persist after refresh
✅ No console errors in DevTools
✅ Page load time <2 seconds
✅ API response time <500ms (warm)
✅ CORS headers present in requests
```

---

## 📊 Architecture Verified When:

```
Browser (Anywhere)
    ↓
    ├→ Static Web Apps CDN (West Europe) ✅ Works
    │  └─ Fast global delivery
    │
    └→ API (Azure Functions, North Europe) ✅ Works
       ├─ Database (North Europe) ✅ Works
       └─ IoT Hub (North Europe) ✅ Ready
```

---

**🎉 Ready to Deploy?**

→ Start with Phase 1: [AZURE_DEPLOYMENT_GUIDE.md](AZURE_DEPLOYMENT_GUIDE.md)

**Questions?**
→ Check: [AZURE_CONFIGURATION_GUIDE.md](AZURE_CONFIGURATION_GUIDE.md)

**Timeline**: 2.5-3 hours total (start to finish)
