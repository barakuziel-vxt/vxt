# Azure Deployment Summary & Complete Step-by-Step Guide

---

## PART 1: WHAT'S ALREADY DONE ✅

### Local Development (100% Complete)

**Database**
- ✅ Schema created with `iotDeviceId` column
- ✅ 5 device IDs seeded locally (vessel-033114869, TomerRefael, vessel-234567891, etc.)
- ✅ All CRUD tables ready

**FastAPI Backend (main.py)**
- ✅ All 6 endpoints implemented and tested:
  - GET /customerentities (returns device IDs)
  - GET /customerentities/{id} (single entity with device ID)
  - POST /customerentities (accepts device ID)
  - PUT /customerentities/{id} (updates device ID)
  - DELETE /customerentities/{id}
  - POST /customerentities/{id}/sync-setup (IoT Hub sync)

**React Admin Dashboard (admin-dashboard/)**
- ✅ Form field for "IoT Device ID" (text input)
- ✅ Table column showing device IDs
- ✅ SYNC button (functional, blue color, calls /sync-setup endpoint)
- ✅ Toast notifications (success/error)
- ✅ Ready to build: `npm run build` → creates dist/ folder

**GitHub Repository**
- ✅ All code committed to `main` branch
- ✅ GitHub repo: https://github.com/barakuziel-vxt/vxt
- ✅ Credentials: vxt / Barak1976!

### Azure Resources Already Created

**Resource Group**
- ✅ VXT-IoT-Hub (already exists - will reuse)

---

## PART 2: WHAT'S LEFT TO CREATE

| Resource | Status | Cost |
|----------|--------|------|
| Storage Account | ⏳ Create in Azure Portal | Free (12 months) |
| App Service Plan (Free F1) | ⏳ Create in Azure Portal | $0 |
| App Service | ⏳ Create in Azure Portal | $0 |
| Azure SQL Server | ⏳ Create in Azure Portal | Free (limit) |
| Azure SQL Database | ⏳ Create in Azure Portal | Free (limit) |
| Code deployment (React) | ⏳ Build locally + upload | $0 |
| SQL schema execution | ⏳ Run script in Query Editor | $0 |

**Total Time Estimate: 60-90 minutes**

---

## PART 3: STEP-BY-STEP DEPLOYMENT GUIDE

### Prerequisites
- Azure account (free tier available)
- Your code: https://github.com/barakuziel-vxt/vxt
- 2 files ready in C:\VXT:
  - `AZURE_SQL_SCHEMA_UPDATE.sql` (ready to paste)
  - `QUICK_START_CHECKLIST.md` (reference guide)

---

## PHASE 1: Create Azure SQL Database (10 minutes)

### Step 1.1: Create Azure SQL Server

1. Go to [Azure Portal](https://portal.azure.com) → Sign in
2. Click **"+ Create a resource"** (top-left)
3. Search for **"SQL Database"** → Click it
4. Click **"Create"**

**Fill in the form:**
- **Resource group**: Select `VXT-IoT-Hub` (your existing group)
- **Database name**: `vxt-db`
- **Server**: Click **"Create new"**
  - **Server name**: `vxt-server-prod` (must be globally unique)
  - **Location**: Select your region (e.g., East US, West US)
  - **Authentication method**: SQL authentication
  - **Server admin login**: `vxtadmin`
  - **Password**: `P@ssw0rd2024!` (or your own - remember it!)
  - Click **"OK"**

**Continue in Database form:**
- **Compute + storage**: Click **"Configure database"**
  - Select **"Serverless"** tier (cheaper)
  - Min vCores: 0.5
  - Click **"Apply"**
- Click **"Review + create"** → **"Create"**

⏱️ **Wait 2-3 minutes for deployment**

### Step 1.2: Get SQL Server Connection Details

1. Go to **Azure Portal** → **Resource groups** → **VXT-IoT-Hub**
2. Click the new SQL Server resource (name: `vxt-server-prod`)
3. Copy the **Server name** (looks like: `vxt-server-prod.database.windows.net`)
4. Go to **Settings** → **Firewalls and virtual networks**
5. Click **"+ Add your client IP address"** (allows your PC to connect)
6. Click **"Save"**

---

## PHASE 2: Create Storage Account (5 minutes)

### Step 2.1: Create Storage Account

1. **Azure Portal** → **"+ Create a resource"** → Search **"Storage Account"** → **Create**

**Fill in:**
- **Resource group**: `VXT-IoT-Hub`
- **Storage account name**: `vxtstoragedev` (must be lowercase, globally unique)
- **Region**: Same as SQL server
- **Performance**: Standard
- **Redundancy**: Locally-redundant storage (LRS)
- Click **"Review + create"** → **"Create"**

⏱️ **Wait 1-2 minutes**

---

## PHASE 3: Create App Service Plan + App Service (15 minutes)

### Step 3.1: Create App Service Plan

1. **Azure Portal** → **"+ Create a resource"** → Search **"App Service Plan"** → **Create**

**Fill in:**
- **Resource group**: `VXT-IoT-Hub`
- **Name**: `vxt-app-plan`
- **Operating System**: Windows
- **Region**: Same as previous resources
- **Pricing tier**: Click "Change size"
  - Select **"Free tier (F1)"**
  - Click **"Apply"**
- Click **"Review + create"** → **"Create"**

⏱️ **Wait 1-2 minutes**

### Step 3.2: Create App Service

1. **Azure Portal** → **"+ Create a resource"** → Search **"App Service"** → **Create**

**Fill in:**
- **Resource group**: `VXT-IoT-Hub`
- **Name**: `vxt-admin-app` (this becomes your URL: vxt-admin-app.azurewebsites.net)
- **Runtime stack**: Python 3.11
- **Operating System**: Windows
- **Plan**: Select `vxt-app-plan` (the plan you just created)
- Click **"Review + create"** → **"Create"**

⏱️ **Wait 2-3 minutes for deployment**

---

## PHASE 4: Deploy Code to App Service (20-30 minutes)

### Step 4.1: Build React Dashboard Locally

On your PC, open PowerShell and run:

```powershell
cd C:\VXT\admin-dashboard
npm install
npm run build
```

⏱️ **This creates a `dist/` folder (~5-10 min)**

### Step 4.2: Get App Service Deployment Credentials

1. **Azure Portal** → **VXT-IoT-Hub** resource group → Click `vxt-admin-app`
2. Left menu: **Deployment** → **Deployment Center**
3. Click **"Manage publish profile"** → **"Download publish profile"**
4. Save the `.publishsettings` file to C:\VXT\

Alternative (if above doesn't work):
1. Left menu: **Settings** → **Properties**
2. Copy **FTP Hostname** and note it

### Step 4.3: Deploy Using Git (Recommended)

1. In PowerShell, navigate to C:\VXT:
```powershell
cd C:\VXT
git remote add azure https://vxt-admin-app.scm.azurewebsites.net/vxt-admin-app.git
git push azure main:master
```

When prompted for credentials:
- Username: `$vxt-admin-app`
- Password: Get from **Azure Portal** → **App Service** → **Deployment** → **Deployment credentials**

(Or use the publish profile via Visual Studio)

⏱️ **Takes 5-10 minutes for first deployment**

### Step 4.4: Configure App Service Settings

1. **Azure Portal** → `vxt-admin-app` (App Service)
2. Left menu: **Settings** → **Configuration**
3. Click **"New application setting"** and add:

| Name | Value |
|------|-------|
| `WEBSITES_PORT` | `8000` |
| `DB_HOST` | `vxt-server-prod.database.windows.net` |
| `DB_USER` | `vxtadmin` |
| `DB_PASSWORD` | `P@ssw0rd2024!` |
| `DB_NAME` | `vxt-db` |

4. Click **"Save"** → Confirm **"Continue"**
5. App Service will restart (1-2 min)

---

## PHASE 5: Execute SQL Schema (5 minutes)

### Step 5.1: Open Query Editor in Azure Portal

1. **Azure Portal** → **Resource groups** → **VXT-IoT-Hub** → Click SQL Database `vxt-db`
2. Left menu: **Query editor (preview)**
3. Login with:
   - **Login**: `vxtadmin`
   - **Password**: `P@ssw0rd2024!`
   - Click **"OK"**

### Step 5.2: Run Schema Script

1. Open file: **C:\VXT\AZURE_SQL_SCHEMA_UPDATE.sql**
2. Copy ALL contents
3. Paste into **Query editor** window in Azure Portal
4. Click **"Run"** button (top-left, blue play button)

⏱️ **Should complete in < 30 seconds**

**Expected output:**
```
Command(s) completed successfully.
(5 rows affected)
```

---

## PHASE 6: Test Deployment (10 minutes)

### Step 6.1: Access Your App

1. **Azure Portal** → `vxt-admin-app` (App Service)
2. Top right: Click **"Browse"** or go to:
   ```
   https://vxt-admin-app.azurewebsites.net
   ```

**Expected:**
- Admin dashboard loads (React app)
- You can see Customer Entities page
- Table shows IoT Device IDs

### Step 6.2: Test API Endpoints

Open browser and test:
```
https://vxt-admin-app.azurewebsites.net/docs
```

**Should show:**
- FastAPI Swagger documentation
- All 6 endpoints listed
- /customerentities shows device IDs

### Step 6.3: Test SYNC Button

1. In admin dashboard: Go to Customer Entities table
2. Click **"SYNC to Device"** button on any row
3. Should see success toast notification

---

## QUICK REFERENCE: Your Azure Resources

Once deployed, you'll have:

```
Resource Group: VXT-IoT-Hub
├─ SQL Server: vxt-server-prod.database.windows.net
│  └─ Database: vxt-db
├─ Storage Account: vxtstoragedev (free tier)
├─ App Service Plan: vxt-app-plan (Free F1, $0)
└─ App Service: vxt-admin-app (running your code)
   └─ URL: https://vxt-admin-app.azurewebsites.net

Cost: $0-2/month (all free tiers)
```

---

## TROUBLESHOOTING

### Issue: Query Editor won't connect
**Solution:**
1. Go to SQL Server → Firewalls → "Add your client IP"
2. Retry Query Editor

### Issue: App Service shows 404
**Solution:**
1. Check if code was deployed: App Service → Deployment Center → "Build and Deploy"
2. If failed, re-run: `git push azure main:master`

### Issue: Database connection fails in App Service
**Solution:**
1. Verify connection string in Configuration settings
2. Ensure SQL Server firewall allows App Service IP:
   - SQL Server → Firewalls → "Allow Azure services and resources"

### Issue: React app loads but API doesn't respond
**Solution:**
1. Check Python runtime in App Service: Deployment Center → Stack settings
2. Ensure Python 3.11 is selected

---

## WHAT'S HAPPENING BEHIND THE SCENES

```
Your PC                Azure Portal
├─ main.py         →   App Service (runs FastAPI)
├─ admin-dashboard/ →   App Service (serves React dist/)
└─ AZURE_SQL_*.sql →   Query Editor (updates DB schema)

User visits: https://vxt-admin-app.azurewebsites.net
  ├─ React UI loads from App Service
  ├─ User clicks SYNC button
  ├─ FastAPI responds at /customerentities/{id}/sync-setup
  ├─ Data stored in Azure SQL
  └─ Success notification shown
```

---

## NEXT STEPS (After Deployment)

✅ **Phase 1-6 complete**: Your app is live!

**Optional Enhancements:**
- Add custom domain (azurewebsites.net → yourcompany.com)
- Enable HTTPS certificate (done automatically on .azurewebsites.net)
- Add Application Insights for monitoring
- Set up alerts for errors

---

## FILES YOU NEED

All in C:\VXT:
- `main.py` - FastAPI backend (will be deployed)
- `admin-dashboard/` - React frontend (build and deploy)
- `AZURE_SQL_SCHEMA_UPDATE.sql` - Copy/paste into Query Editor
- `QUICK_START_CHECKLIST.md` - Keep as reference

---

## ESTIMATED TIMELINE

| Phase | Task | Time |
|-------|------|------|
| 1 | SQL Server + Database | 10 min |
| 2 | Storage Account | 5 min |
| 3 | App Service Plan + App | 15 min |
| 4 | Build React + Deploy | 20-30 min |
| 5 | SQL Schema | 5 min |
| 6 | Testing | 10 min |
| **TOTAL** | **Full Deployment** | **60-90 min** |

---

## FINAL CHECKLIST

Before considering deployment complete, verify:

- [ ] SQL Server created + firewall configured
- [ ] Storage Account created
- [ ] App Service Plan (Free F1) + App Service created
- [ ] Code deployed (check App Service → Deployment Center)
- [ ] SQL schema executed (run Query Editor script)
- [ ] Dashboard accessible (https://vxt-admin-app.azurewebsites.net)
- [ ] API responds (/docs endpoint shows Swagger)
- [ ] SYNC button works (test on one entity)
- [ ] Device IDs visible in table
- [ ] No errors in App Service logs

✅ **All checked = Successful deployment!**

