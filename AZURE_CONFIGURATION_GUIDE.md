# 🔧 Azure Configuration Guide - Complete Setup Instructions

**Last Updated**: March 14, 2026  
**Status**: Ready to Configure  
**Duration**: ~20-30 minutes for all configuration

---

## 📋 Overview

After deploying the three Azure components, you need to configure them to work together:

```
Configuration Steps:
1. ✅ Phase 1: Database (already done in deployment)
2. ⏳ Phase 2: Configure Azure Functions (CORS, env vars, connections)
3. ⏳ Phase 3: Configure Static Web Apps (env vars, API endpoint)
4. ⏳ Phase 4: Integration testing (verify all components talk)
```

---

## 🔗 Architecture Overview (Before Configuration)

```
┌────────────────────────────────────────┐
│ User's Browser (anywhere)              │
└────────────────────────────────────────┘
         ↓                          ↓
    (1) CDN                    (2) API
    Static Web Apps            Azure Functions
    (West Europe)              (North Europe)
         ↓                          ↓
      React app                  Database
      (index.html, CSS, JS)      (North Europe)
      
Configuration needed:
(1) Static Web Apps → point to Functions API
(2) Functions → CORS allow Static Web Apps domain
(3) Functions → connect to SQL database
(4) Browser → CORS headers allow cross-origin calls
```

---

## Phase 2: Azure Functions Configuration (North Europe)

### Step 1: Connect to SQL Database

**Environment Variables** (Application Settings)

Location: Azure Portal → Function App → Settings → Environment variables

Add these variables:

```
Key: SQL_SERVER
Value: vxtdb.database.windows.net

Key: SQL_DATABASE
Value: free-sql-db-5949639

Key: SQL_USER
Value: vxt

Key: SQL_PASSWORD
Value: Barak1976!
```

**How to add in Portal:**

```
1. Go to Azure Portal
2. Search for "vxt-api-functions" (Function App)
3. Click on it
4. Left menu → Settings → Configuration
5. Click "+ New application setting"
6. Enter Name and Value
7. Click OK
8. Click Save at top of page
9. Restart function app (if needed)
```

**In your function code** (already present in templates):

```python
# Inside each HTTP function
import os
import pyodbc

def main(req):
    # Read from environment variables
    server = os.environ['SQL_SERVER']
    database = os.environ['SQL_DATABASE']
    username = os.environ['SQL_USER']
    password = os.environ['SQL_PASSWORD']
    
    # Connect to database
    connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}'
    conn = pyodbc.connect(connection_string)
    # ... rest of function
```

**ETA**: 5 minutes

---

### Step 2: Configure CORS (Critical!)

**What is CORS?**

CORS (Cross-Origin Resource Sharing) allows your browser to call APIs from different regions.

**Without CORS configured**: 
```
Browser error: "No 'Access-Control-Allow-Origin' header"
Result: API calls fail even though endpoint works
```

**Location**: Azure Portal → Function App → Settings → CORS

**Steps:**

```
1. Go to Azure Portal
2. Search for "vxt-api-functions"
3. Left menu → API → CORS
4. Under "Allowed Origins", add these domains:

   https://vxt-admin-dashboard.azurewebsites.net
   (Your Static Web Apps domain - this is CRITICAL!)
   
5. Allowed Methods: GET, POST, PUT, DELETE, OPTIONS
6. Allowed Headers: Content-Type, Authorization
7. Click Save
```

**For Local Development** (testing locally before deploying):

Also add:
```
http://localhost:3000
http://localhost:5173
http://127.0.0.1:5173
```

**Verify CORS is Working:**

```powershell
# Test from PowerShell
$uri = "https://vxt-api-functions.azurewebsites.net/api/customerentities"
$response = Invoke-WebRequest -Uri $uri -Method GET

# Check headers
$response.Headers['Access-Control-Allow-Origin']
# Should show: https://vxt-admin-dashboard.azurewebsites.net
```

**ETA**: 5 minutes

---

### Step 3: Verify Functions are Running

**Test each endpoint:**

```powershell
# Test 1: Get all entities
Invoke-WebRequest -Uri "https://vxt-api-functions.azurewebsites.net/api/customerentities" -Method GET

# Test 2: Get single entity
Invoke-WebRequest -Uri "https://vxt-api-functions.azurewebsites.net/api/customerentities/1" -Method GET

# Test 3: Create entity
$body = @{
    name = "Test Entity"
    iotDeviceId = "device-123"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://vxt-api-functions.azurewebsites.net/api/customerentities" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

**Expected Results:**
- Status code: 200 OK
- Response: JSON with entity data
- No CORS errors

**ETA**: 5 minutes

---

## Phase 3: Static Web Apps Configuration (West Europe)

### Step 1: Configure Environment Variables

**Location**: Azure Portal → Static Web Apps → Settings → Configuration

**Add these application settings:**

```
Key: VITE_API_BASE_URL
Value: https://vxt-api-functions.azurewebsites.net
Description: "API endpoint for Functions"

Key: VITE_APP_NAME
Value: YachtSense Admin Dashboard
Description: "Application name"
```

**How to add in Portal:**

```
1. Go to Azure Portal
2. Search for "Static Web App"
3. Find "vxt-admin-dashboard"
4. Left menu → Settings → Configuration
5. Click "+ Add"
6. Enter Name: VITE_API_BASE_URL
7. Enter Value: https://vxt-api-functions.azurewebsites.net
8. Click Add
9. Repeat for other variables
```

**In your React code** (already configured):

```javascript
// admin-dashboard/src/config.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// admin-dashboard/src/api.js
export const fetchEntities = async () => {
  const response = await fetch(`${API_BASE}/api/customerentities`);
  return response.json();
};
```

**ETA**: 5 minutes

---

### Step 2: Build & Deploy React App

**Local Build (One-time)**:

```bash
cd admin-dashboard
npm run build
```

**Output locations:**
```
admin-dashboard/dist/
├─ index.html
├─ assets/
│  ├─ index-*.js
│  └─ index-*.css
└─ (other assets)
```

**Deploy Options:**

**Option A: GitHub Auto-Deployment (RECOMMENDED)**
```
1. Commit changes to GitHub
   git add .
   git commit -m "Configure API endpoints"
   git push origin main

2. Static Web Apps auto-detects changes
3. Automatically builds and deploys
4. Takes ~2-5 minutes
5. URL: https://vxt-admin-dashboard.azurewebsites.net
```

**Option B: Manual ZIP Upload**
```
1. Run: npm run build (locally)
2. ZIP entire dist/ folder
3. Portal → Static Web App → Deployment
4. Upload ZIP file
5. Takes ~2-3 minutes
```

**Option C: Azure CLI**
```powershell
az staticwebapp upload \
  --name vxt-admin-dashboard \
  --source ./admin-dashboard/dist \
  --resource-group vxt-resource-group
```

**ETA**: 5-10 minutes

---

## Phase 4: Integration Testing

### Test 1: Frontend Loads from CDN

```
1. Open browser
2. Navigate to: https://vxt-admin-dashboard.azurewebsites.net
3. Should see: React admin dashboard
4. Open DevTools → Network tab
5. Should see files loaded from CDN (small KB sizes)
```

**Expected**:
- Page loads in <2 seconds
- No console errors
- All JavaScript bundles load

---

### Test 2: API Endpoints Respond

```
1. In browser, open DevTools → Console
2. Run this JavaScript:

fetch('https://vxt-api-functions.azurewebsites.net/api/customerentities')
  .then(r => r.json())
  .then(data => console.log(data))
  .catch(e => console.error('CORS Error:', e))
```

**Expected**:
- See JSON with customer entities
- No CORS errors
- Data from North Europe SQL

---

### Test 3: Dashboard Gets Data

```
1. Dashboard should load
2. Navigate to "Customer Entities" section
3. Should see table with 5 entities:
   - Barak
   - TomerRefael
   - Shula
   - ... (other entities)
4. Each has iotDeviceId column populated
5. Click "Edit" on an entity
6. Should show form with fields
```

**Expected**:
- 5 entities loaded
- iotDeviceId values visible
- No API errors in DevTools

---

### Test 4: CORS Headers Check

```
1. In browser DevTools → Network tab
2. Look for GET request to /api/customerentities
3. Click on the request
4. Check Response Headers
5. Should see:

Access-Control-Allow-Origin: https://vxt-admin-dashboard.azurewebsites.net
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type
```

**If not present**:
- CORS not configured correctly
- Re-check Azure Function CORS settings

---

### Test 5: Edit & Sync

```
1. In dashboard, click Edit on entity ID 2 (TomerRefael)
2. Change iotDeviceId to "test-device-123"
3. Click 🚀 "SYNC to Device"
4. Should see success message
5. Database should update (visible in next refresh)
```

**Expected**:
- No errors
- Success message appears
- Data persists after refresh

---

## 🛠️ Common Configuration Issues & Fixes

### Issue 1: CORS Error in Browser

```
Error: "No 'Access-Control-Allow-Origin' header is present"
```

**Solution:**
1. Check CORS is configured in Azure Function
2. Verify allowed origin matches exactly:
   - Should be: https://vxt-admin-dashboard.azurewebsites.net
   - NOT: https://vxt-admin-dashboard.azurewebsites.net/
   - NOT: http:// (must be https://)
3. Wait 2-3 minutes for changes to propagate
4. Restart Function App:
   - Portal → Function App → Restart

---

### Issue 2: "API_BASE is undefined" in React

```
Error: Cannot read property 'api/customerentities' of undefined
```

**Solution:**
1. Check environment variable is set in Static Web Apps
2. Verify name: VITE_API_BASE_URL (exact, case-sensitive)
3. Rebuild and redeploy React:
   ```bash
   npm run build
   git push origin main
   ```
4. Hard refresh browser (Ctrl+Shift+R)

---

### Issue 3: 500 Error from API

```
Error: Internal Server Error (500)
```

**Solution:**
1. Check Function environment variables are set correctly
2. Verify connection string details:
   - Server: vxtdb.database.windows.net
   - Database: free-sql-db-5949639
   - User: vxt
   - Password: Barak1976!
3. Check Function logs:
   - Portal → Function App → Monitor → Logs
4. Verify function code handles database connection

---

### Issue 4: Function Cold Start (3-5 sec delay)

```
First API call takes 3-5 seconds
```

**Expected Behavior**:
- This is normal for Azure Functions on Consumption plan
- Cold start happens after 10-20 minutes of inactivity
- Subsequent calls are fast (~100-200ms)
- Not caused by configuration, it's by design

**Not a bug**, it's acceptable for POC.

---

## ✅ Configuration Checklist

### Azure Functions (North Europe)

- [ ] Storage Account created in North Europe
- [ ] Function App created in North Europe
- [ ] All 6 HTTP functions deployed
- [ ] Environment variables set:
  - [ ] SQL_SERVER
  - [ ] SQL_DATABASE
  - [ ] SQL_USER
  - [ ] SQL_PASSWORD
- [ ] CORS configured for Static Web Apps domain
- [ ] Local CORS added for http://localhost:5173
- [ ] Functions tested and responding

### Static Web Apps (West Europe)

- [ ] Static Web App created in West Europe
- [ ] GitHub connected for auto-deployment
- [ ] Environment variable set:
  - [ ] VITE_API_BASE_URL=https://vxt-api-functions.azurewebsites.net
- [ ] React built locally (npm run build)
- [ ] Deployed to Static Web Apps
- [ ] Loads from https://vxt-admin-dashboard.azurewebsites.net

### Integration Testing

- [ ] Dashboard loads and displays 5 entities
- [ ] No CORS errors in browser console
- [ ] API endpoints respond with data
- [ ] Edit form works
- [ ] Sync button calls API successfully

---

## 📊 Final Cost Breakdown (After Configuration)

```
Component                  Region          Cost/Month    Egress Cost
─────────────────────────────────────────────────────────────────
Azure SQL Database         North Europe    FREE→$5       $0
Azure Functions            North Europe    FREE          $0
Storage (Function runtime) North Europe    $1-2          $0
Static Web Apps            West Europe     FREE          $0 *
IoT Hub                    North Europe    FREE          $0
─────────────────────────────────────────────────────────────────
TOTAL MONTHLY              All Regions     $1-7/mo       $0 egress

* Static Web Apps uses free global CDN, no egress charges
```

---

## 🎯 Success Criteria - Configuration Complete When:

- ✅ Functions responding at: https://vxt-api-functions.azurewebsites.net/api/customerentities
- ✅ Dashboard loading at: https://vxt-admin-dashboard.azurewebsites.net
- ✅ No CORS errors in DevTools console
- ✅ Dashboard displays 5 entities from database
- ✅ Edit and Sync features work end-to-end
- ✅ API calls take <1 second (after cold start)
- ✅ Database updates visible in dashboard

---

## 📞 Support & Troubleshooting

### Quick Links

- [Function App Debugging](https://portal.azure.com/) → Function App → Monitor
- [Static Web Apps Logs](https://portal.azure.com/) → Static Web App → Settings → Logs
- [SQL Connection Test](https://portal.azure.com/) → SQL Database → Query Editor
- [Network Diagnostics](https://portal.azure.com/) → Function App → Diagnose and Solve

### Common Commands

```powershell
# Restart Function App
az functionapp restart --name vxt-api-functions --resource-group vxt-resource-group

# Get Function URL
az functionapp show --name vxt-api-functions --resource-group vxt-resource-group --query "defaultHostName"

# View Function logs
az webapp log tail --name vxt-api-functions --resource-group vxt-resource-group
```

---

**Status**: Ready to configure  
**Next Action**: Follow Phase 2 steps above to configure Azure Functions  

👉 **Start Now**: Configure Azure Functions CORS (Step 2 above)
