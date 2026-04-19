# 🚀 Azure Static Web Apps Deployment Guide

**Status**: Phase 3 - Frontend Deployment  
**Region**: West Europe  
**Timeline**: 15-25 minutes  
**Cost**: FREE (with 100 GB monthly bandwidth)

---

## 📋 Overview

Deploy the React admin dashboard to Azure Static Web Apps. This is parallel work you can do **while waiting for Function App quota approval**.

```
✅ ADVANTAGES OF STARTING NOW:
├─ Non-blocking (doesn't depend on quota)
├─ Can configure API endpoint later
├─ Gives you live frontend URL to test
└─ Saves time once Functions are ready
```

---

## 🌍 Architecture

```
WEST EUROPE (Frontend Only)
├─ Static Web Apps (vxt-admin-dashboard)
│  ├─ Region: West Europe (only option available)
│  ├─ Plan: Free tier (100GB bandwidth/month)
│  ├─ React build: 1.59 MB
│  ├─ Build framework: Vite
│  └─ Cost: $0/month
│
├─ DNS: Automatically assigned (e.g., vxt-admin-dashboard.azurewebsites.net)
└─ TLS: Automatic HTTPS certificate
```

---

## ✅ Prerequisites

Before starting:

- [ ] React app built locally (should already be done)
- [ ] Admin dashboard code at `c:\VXT\admin-dashboard\`
- [ ] `dist/` folder exists with production build
- [ ] Azure Portal access
- [ ] Pay-As-You-Go subscription (quota approved or in progress)

**Verify build exists:**
```powershell
ls c:\VXT\admin-dashboard\dist
```

Should show:
```
index.html
assets/
favicon.svg
```

---

## 📝 Step 1: Build React App Locally (If Not Already Done)

**Skip this if you already have `dist/` folder with today's build.**

```powershell
cd c:\VXT\admin-dashboard
npm run build
```

**Output:**
```
✓ 233 modules transformed
✓ built in 12.34s

dist/
├── index.html       (entrance point)
├── assets/          (JS/CSS bundles)
└── favicon.svg
```

**Size:** ~1.59 MB (all gzipped)

**Time:** 3-5 minutes

---

## 🔧 Step 2: Create Static Web Apps Resource

### 2.1 Open Azure Portal

1. Go to [https://portal.azure.com](https://portal.azure.com)
2. Search for **"Static Web Apps"**
3. Click **"Create"**

### 2.2 Fill in Creation Form

| Field | Value |
|-------|-------|
| **Subscription** | Your Pay-As-You-Go subscription |
| **Resource Group** | Same group as other VXT resources |
| **Name** | `vxt-admin-dashboard` |
| **Region** | **West Europe** (only option for Static Web Apps) |
| **Plan Type** | Free |
| **Source** | (Choose one below) |

### 2.3 Choose Deployment Source

**Option A: Manual Upload (Recommended - Faster)**
- Select: **Other**
- No GitHub integration needed
- Deploy pre-built files manually
- **ETA: 5 minutes**

**Option B: GitHub Integration (Auto-deployment)**
- Select: **GitHub**
- Connect GitHub account
- Auto-redeploys on push
- **ETA: 10-15 minutes**

**→ Choose Option A for speed**

### 2.4 Complete Creation

Click **"Create"** → Wait 2-3 minutes for deployment

**Status Check:**
- Green checkmark = Resource ready
- URL assigned automatically

---

## 📤 Step 3: Deploy Built Files (Manual Upload Method)

### 3.1 Locate Your Build Output

```powershell
cd c:\VXT\admin-dashboard
ls dist
```

Should see: `index.html`, `assets/`, `favicon.svg`

### 3.2 Upload via Azure Portal

1. Open the Static Web Apps resource in Portal
2. Click **"Configuration"** in left menu
3. Scroll down to **"Build configuration"**

**Alternative - Use Storage Browser:**

1. Go to **"Static Web Apps"** → your app → **"Static files"**
2. Click **"Upload files"**
3. Select **all contents of `dist/` folder**:
   ```
   dist/
   ├── index.html      ← SELECT THIS
   ├── assets/         ← SELECT THIS
   └── favicon.svg     ← SELECT THIS
   ```
4. Click **"Upload"**

**Time:** 1-2 minutes

---

## 🌐 Step 4: Verify Deployment

### 4.1 Get App URL

In Portal → Static Web Apps → **Overview**

**Copy this URL:**
```
https://vxt-admin-dashboard.azurewebsites.net
```

Or it might be:
```
https://vxt-admin-dashboard-[randomid].azurewebsites.net
```

### 4.2 Test in Browser

1. Open the URL in browser
2. Should see login page or entity list
3. Check for 404 errors

**Possible Issues:**
- ❌ **404 on root path** → Routing issue (fix below)
- ✅ **Page loads with content** → Deployment successful!

---

## 🛠️ Step 5: Configure SPA Routing (Important!)

**Static Web Apps needs special routing config for Single Page Apps.**

### 5.1 Create `staticwebapp.config.json`

In **root of your `dist/` folder**, create:

**File**: `dist/staticwebapp.config.json`

**Content:**
```json
{
  "routes": [
    {
      "route": "/*",
      "serve": "/index.html",
      "statusCode": 200
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.{css,svg,ico,png,jpg,gif}"]
  },
  "mimeTypes": {
    ".json": "text/json",
    ".wasm": "application/wasm"
  }
}
```

### 5.2 Re-upload Files

1. Upload entire `dist/` folder again (including new config)
2. Wait 30 seconds for Static Web Apps to process
3. Refresh browser

**Result:** All routes now serve `index.html` → React handles routing

---

## 🔌 Step 6: Configure API Endpoint (Prepare for Functions)

**This step waits for Function App to be created, but you can prepare now.**

### 6.1 Add Environment Variables

In Portal → Static Web Apps → **Configuration**

**Add App Settings:**

| Name | Value | Notes |
|------|-------|-------|
| `VITE_API_BASE_URL` | *Pending* | Will be: `https://vxt-api-functions.azurewebsites.net/api` |

**Leave value empty for now**, OR use placeholder:
```
https://vxt-api-functions.azurewebsites.net/api
```

### 6.2 Rebuild and Deploy When Functions Ready

Once Function App is created:

1. Update `.env.production` locally:
   ```
   VITE_API_BASE_URL=https://vxt-api-functions.azurewebsites.net/api
   ```

2. Rebuild React:
   ```powershell
   cd c:\VXT\admin-dashboard
   npm run build
   ```

3. Re-upload `dist/` folder to Static Web Apps

4. Test the connection:
   - Open dashboard
   - Navigate to "Customer Entities"
   - Should see data from API

---

## 🧪 Step 7: Test Dashboard

### 7.1 Basic Functionality (No API)

Open: `https://vxt-admin-dashboard.azurewebsites.net`

**Check:**
- [ ] Page loads without errors
- [ ] No 404s in browser console
- [ ] Styling loads correctly
- [ ] Navigation works

### 7.2 With API Endpoint (After Functions Ready)

**Once Function App is deployed:**

1. Update API endpoint in app settings
2. Refresh dashboard
3. Open **Customer Entities** page
4. Should see 5 entities loaded from API
5. Try editing an entity
6. Try clicking 🚀 **SYNC to Device** button

---

## 📊 Configuration Checklist

- [ ] Static Web Apps resource created in **West Europe**
- [ ] React `dist/` folder uploaded
- [ ] `staticwebapp.config.json` included in upload
- [ ] Dashboard accessible at HTTPS URL
- [ ] App Settings configured (VITE_API_BASE_URL)
- [ ] SPA routing working (all routes → index.html)
- [ ] Ready to connect to Function App

---

## 🔍 Troubleshooting

### Issue: 404 on root path

**Solution:** SPA routing not configured
1. Ensure `staticwebapp.config.json` is in `dist/`
2. Re-upload entire `dist/` folder
3. Wait 1-2 minutes
4. Refresh browser (hard refresh: Ctrl+Shift+R)

### Issue: Styling not loading (blank page)

**Solution:** Check browser console for CSS path errors
1. Open DevTools (F12)
2. Check Network tab
3. Look for CSS files with 404s
4. Verify paths in `index.html`

### Issue: API calls fail with CORS error

**Solution:** Configure CORS on Function App
1. Wait for Function App creation
2. Go to Function App → CORS
3. Add Static Web Apps domain: `https://vxt-admin-dashboard.azurewebsites.net`
4. Refresh dashboard

### Issue: Environment variables not loading

**Solution:** Restart app after adding settings
1. Go to Static Web Apps → Overview
2. Click "Restart"
3. Wait 30 seconds
4. Refresh dashboard

---

## 📈 Monitoring & Debugging

### View Live Logs

1. Static Web Apps → **Overview**
2. Click linked **Application Insights** (if enabled)
3. View real-time requests and errors

### Test API Connection

Once Functions are ready, test in browser console:

```javascript
// Test API connection
fetch('https://vxt-api-functions.azurewebsites.net/api/customerentities')
  .then(r => r.json())
  .then(d => console.log(d))
  .catch(e => console.error(e))
```

---

## ✅ Success Criteria

### Phase 3 Complete When:

- [ ] Static Web Apps resource created in Portal
- [ ] `vxt-admin-dashboard.azurewebsites.net` URL generated
- [ ] React dashboard loads without errors
- [ ] Page styling displays correctly
- [ ] Navigation between pages works
- [ ] All routes serve from `index.html`
- [ ] Ready to connect API endpoint

---

## 📋 Quick Summary

```
WHAT YOU'RE DOING:
├─ Deploy React build to Static Web Apps
├─ Configure SPA routing
├─ Set up environment for API connection
└─ Test frontend in isolation

TIME ESTIMATE:
├─ Build verification: 1 min
├─ Resource creation: 3 min
├─ File upload: 2 min
├─ Configuration: 2 min
├─ Testing: 5 min
└─ TOTAL: 13-15 minutes

RESULT:
├─ Live HTTPS dashboard accessible globally
├─ Ready to connect to Function API
└─ Waiting for Phase 2 completion
```

---

## 🚀 Next Steps (After This Phase)

1. **Quota Approval** (parallel work in progress)
2. **Function App Creation** (Phase 2)
3. **Deploy 6 HTTP Functions** (Phase 2)
4. **Update API Endpoint** in dashboard settings
5. **Test End-to-End Integration** (Phase 4)

---

## 📞 Quick Links

**Azure Portal Navigation:**
- [Static Web Apps Console](https://portal.azure.com/#blade/HubsExtension/BrowseResourceBlade/resourceType/Microsoft.Web%2FstaticSites)
- [Your Resource Group](https://portal.azure.com/#blade/HubsExtension/BrowseResourceBlade/resourceType/Microsoft.Resources%2Fsubscriptions%2FresourceGroups)

**Documentation:**
- [Azure Static Web Apps Docs](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- [Configure SPA Routing](https://docs.microsoft.com/en-us/azure/static-web-apps/configuration)
- [Environment Variables](https://docs.microsoft.com/en-us/azure/static-web-apps/application-settings)

---

## 📝 Notes

**Why West Europe for Static Web Apps?**
- Static Web Apps not available in North Europe
- West Europe is closest geographic region
- Global CDN ensures fast delivery worldwide
- Zero egress charges for API calls to North Europe resources

**Cost Breakdown:**
- Static Web Apps Free plan: **$0/month**
- 100 GB bandwidth included
- Expected usage: <1 GB/month
- Upgrade only if exceeding limits (unlikely for MVP)

**React Build Optimization:**
- Current size: 1.59 MB
- Gzip compressed: ~400-500 KB
- Load time: <2 seconds on 4G
- Sufficient for MVP and testing

---

**Ready to start? Open Azure Portal and create Static Web Apps resource!**

👉 **Next**: [Create resource] → [Upload dist/] → [Test URL]
