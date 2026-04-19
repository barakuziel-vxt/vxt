# ✅ Static Web Apps Deployment Checklist

**Parallel Work While Awaiting Function App Quota**

---

## 📋 Pre-Deployment (5 minutes)

- [ ] **Verify React build exists**
  ```powershell
  ls c:\VXT\admin-dashboard\dist
  ```
  Should show: `index.html`, `favicon.svg`, `assets/`

- [ ] **Create staticwebapp.config.json**
  - Location: `c:\VXT\admin-dashboard\dist\staticwebapp.config.json`
  - Content: Use provided JSON config from STATICWEBAPP_CONFIG_EXPLANATION.md
  - Verify valid JSON (no syntax errors)

- [ ] **Verify subscription is Pay-As-You-Go**
  - Azure Portal → Subscriptions
  - Should show "Pay-As-You-Go" (not "Free Trial")

---

## 🔧 Create Static Web Apps Resource (3 minutes)

### Step 1: Open Azure Portal
- [ ] Navigate to [https://portal.azure.com](https://portal.azure.com)
- [ ] Search for "Static Web Apps"
- [ ] Click "Create"

### Step 2: Fill Creation Form
- [ ] **Subscription**: Select your Pay-As-You-Go subscription
- [ ] **Resource Group**: Same as other VXT resources
- [ ] **Name**: `vxt-admin-dashboard`
- [ ] **Region**: **West Europe** (only option)
- [ ] **Plan Type**: **Free**
- [ ] **Source**: Select **"Other"** (manual upload)

### Step 3: Create Resource
- [ ] Click "Create"
- [ ] Wait 2-3 minutes for green checkmark
- [ ] Note the assigned URL

### Step 4: Record Resource Details
```
Resource Name: vxt-admin-dashboard
Region: West Europe
URL: https://vxt-admin-dashboard.azurewebsites.net
Status: Ready
```

---

## 📤 Upload React Build Files (2-3 minutes)

### Option A: Portal File Upload (Recommended)

- [ ] Navigate to Static Web Apps resource
- [ ] Click **"Overview"** or **"Configuration"**
- [ ] Find **upload/deploy** section
- [ ] Select **all files from `dist/` folder**:
  ```
  ✓ index.html
  ✓ favicon.svg
  ✓ staticwebapp.config.json
  ✓ assets/ (folder)
  ```
- [ ] Upload
- [ ] Wait for "Deployment complete" message

### Option B: CLI Upload (If portal upload unavailable)

```powershell
cd c:\VXT\admin-dashboard\dist
az staticwebapp upload-files `
  --name vxt-admin-dashboard `
  --source .
```

**Time:** 2 minutes

---

## 🔧 Configure Routing (1 minute)

**After upload completes:**

- [ ] Verify `staticwebapp.config.json` was uploaded
- [ ] Portal → Static Web Apps → **Configuration** → verify settings loaded
- [ ] Wait 30 seconds for settings to apply

---

## 🌐 Test Deployment (3-5 minutes)

### Basic URL Test

- [ ] Open dashboard URL in browser:
  ```
  https://vxt-admin-dashboard.azurewebsites.net
  ```

- [ ] Should see:
  - [ ] React app loads
  - [ ] No blank page
  - [ ] Styling visible
  - [ ] Navigation menu appears

### Browser Console Check

- [ ] Open DevTools (F12)
- [ ] Go to **Console** tab
- [ ] Check for errors (should be clean or minimal dev warnings)
- [ ] No 404 errors for resources

### Route Testing

- [ ] Click navigation links
- [ ] Try these routes (all should load without 404):
  - [ ] `/`
  - [ ] `/dashboard`
  - [ ] `/entities` (or main content page)
  - [ ] `/settings` (or other pages)

### Network Tab Check

- [ ] Open DevTools → **Network** tab
- [ ] Refresh page (Ctrl+R)
- [ ] Check response codes:
  - [ ] `index.html` → **200 OK**
  - [ ] CSS files → **200 OK**
  - [ ] JS bundles → **200 OK**
  - [ ] `favicon.svg` → **200 OK** (or 404 is OK)

---

## 🔌 Prepare API Integration (2 minutes)

**This is done now, tested later:**

- [ ] Portal → Static Web Apps → **Configuration** → **Application settings**
- [ ] Add setting:
  - [ ] **Name**: `VITE_API_BASE_URL`
  - [ ] **Value**: `https://vxt-api-functions.azurewebsites.net/api`
  - [ ] Click **Save**
- [ ] Wait 1 minute for setting to apply

**Note:** API won't respond yet (Functions not deployed). Setting is ready for Phase 2.

---

## ✅ Deployment Complete Checklist

- [ ] Resource created in West Europe
- [ ] URL assigned and accessible
- [ ] React dashboard loads
- [ ] No 404 errors in console
- [ ] Styling renders correctly
- [ ] Navigation between pages works
- [ ] App settings configured for API endpoint
- [ ] SPA routing configured (routes don't 404)

**Status: Phase 3 Ready** ✅

---

## 📊 Resource Details to Save

```
STATIC WEB APPS RESOURCE
├─ Name: vxt-admin-dashboard
├─ Region: West Europe
├─ Plan: Free
├─ URL: https://vxt-admin-dashboard.azurewebsites.net
├─ Status: Running ✅
├─ Build: React 1.59 MB
├─ Routing: SPA (/ → index.html)
└─ API Endpoint: Configured (pending connection)
```

---

## 🚀 Next: Phase 2 (Function App)

Once this completes, you'll:

1. Wait for quota approval (check email/Portal)
2. Create Function App in North Europe
3. Deploy 6 HTTP functions
4. Set connection string to SQL Database
5. Configure CORS for this Static Web Apps URL
6. Update API endpoint setting above
7. Test end-to-end

---

## 🛠️ Troubleshooting During Deployment

| Issue | Solution |
|-------|----------|
| **404 on any route except /** | Missing `staticwebapp.config.json` - re-upload with config file |
| **Blank page, no styling** | CSS 404s - check Network tab, verify `assets/` uploaded |
| **Upload fails** | Portal might timeout - try smaller batch or CLI |
| **Resource creation hangs** | Rare - refresh Portal or try again in 5 min |
| **URL not assigned** | Wait 3-5 minutes after creation completes |

---

## ⏱️ Timeline Summary

```
Total Time: 13-15 minutes (parallel work)

Pre-deployment:     3-5 min
Resource creation:  3 min
File upload:        2-3 min
Routing config:     1 min
Testing:            3-5 min
───────────────────────────
TOTAL:             13-15 min
```

**Can start immediately while waiting for Function App quota.**

---

## 📝 Notes

- Static Web Apps Free tier is sufficient for MVP
- 100 GB monthly bandwidth included
- No egress charges for internal Azure traffic
- TLS/HTTPS automatic
- Global CDN reduces latency

---

**Status: Ready to deploy Phase 3**

👉 **Start now!** [Open Azure Portal] → [Create Static Web Apps] → [Upload dist/] → [Test]
