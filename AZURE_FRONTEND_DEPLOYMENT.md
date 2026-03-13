# Azure Frontend Layer Deployment - React Admin Dashboard

## 📋 Overview

This guide walks you through deploying the **React Admin Dashboard** to **Azure App Service**.

**Key Points**:
- ✅ Uses **Free Tier** (or B1 plan for better performance)
- ✅ React production build (optimized & minified)
- ✅ Automatic HTTPS/SSL (free)
- ✅ Environment variables for API endpoint
- ✅ Fast CDN delivery
- ✅ ~5 minutes to deploy

---

## 🎯 What You're Deploying

### React Admin Dashboard Features

```
┌─────────────────────────────────────────────────────┐
│  YachtSense AI - Customer Entities Management       │
│  http://vxt-admin-dashboard.azurewebsites.net      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Customer Entities List                            │
│  ┌──────┬──────────┬─────────────────┬──────────┐  │
│  │ ID   │ Type     │ IoT Device ID   │ Status   │  │
│  ├──────┼──────────┼─────────────────┼──────────┤  │
│  │ 2    │ Vessel   │ TomerRefael ← NEW COLUMN  │  │
│  │ 3    │ Health   │ vessel-234567   ← NEW     │  │
│  │ 4    │ Provider │ —               │ Active  │  │
│  └──────┴──────────┴─────────────────┴──────────┘  │
│         [  + Add Entity        ]                    │
│                                                     │
│  Edit Entity Modal                                  │
│  ─────────────────────────────────────────────     │
│  Entity ID        | 234567890                       │
│  Entity Name      | TomerRefael's Boat             │
│  IoT Device ID    | TomerRefael    ← NEW FIELD    │
│  Entity Type      | Vessel                         │
│  Status           | Active                         │
│                                                     │
│  [🚀 SYNC to Device Setup] ← NEW BUTTON           │
│  [Save] [Cancel]                                   │
│                                                     │
│  ✓ Setup synced to device successfully ← SUCCESS   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Step-by-Step Deployment

### STEP 1: Build React Application

**Local Steps** (Run on your development machine):

```powershell
# Navigate to admin-dashboard directory
cd admin-dashboard

# Install dependencies (if not already installed)
npm install

# Build for production
npm run build

# Expected output:
# ✓ 1234 modules transformed
# dist/index.html    1.2kB
# dist/assets/index.abcd1234.js    125kB
```

**What this creates**:
- `/dist` folder with optimized, minified production build
- All JavaScript/CSS bundled and compressed
- Ready to serve via web server

**Verify build**:
```powershell
# Check that dist folder was created
ls dist/

# Expected files:
# index.html
# assets/
#   ├── index.abcd1234.js
#   ├── index.5678efgh.css
#   └── ...
```

---

### STEP 2: Create App Service Plan

**Azure Portal Steps**:
1. Go to **Azure Portal** → Search "App Service Plans"
2. Click **Create**
3. Fill in:
   - **Subscription**: (select your subscription)
   - **Resource Group**: vxt-resource-group
   - **Name**: vxt-app-plan
   - **Operating System**: Windows (or Linux)
   - **Sku and size**: Click "Change size" → **Free F1** (recommended)
   - **Zone redundancy**: Off (not available for Free)
4. Click **Review + Create** → **Create**

**Expected**: Creation takes 1-2 minutes

**Tier Comparison**:
| Tier | Cost | Performance | Features |
|------|------|-------------|----------|
| Free (F1) | FREE | Basic | ~60 min/day shared compute |
| B1 | ~$7/month | Better | Dedicated core, always-on |
| B2 | ~$35/month | Production | 2 cores, auto-scale |

👉 **For MVP**: Use Free tier. Upgrade to B1 later if needed.

---

### STEP 3: Create App Service Instance

**Azure Portal Steps**:
1. Go to **Azure Portal** → Search "App Services"
2. Click **Create** → **Web App**
3. Fill in:
   - **Subscription**: (select your subscription)
   - **Resource Group**: vxt-resource-group
   - **Name**: vxt-admin-dashboard (must be globally unique)
   - **Publish**: Code
   - **Runtime stack**: Node 18 LTS (or latest stable)
   - **Operating System**: Windows
   - **Region**: East US
   - **App Service Plan**: vxt-app-plan (created in Step 2)
4. Click **Review + Create** → **Create**

**Expected**: Creation takes 3-5 minutes

**What you get**:
- Public URL: `https://vxt-admin-dashboard.azurewebsites.net`
- HTTPS enabled (free certificate)
- Auto-scaling capable
- Integrated Application Insights (optional)

---

### STEP 4: Deploy Built Files to App Service

#### Option A: Using Azure Portal (Fastest)

1. Go to **App Service** → **vxt-admin-dashboard**
2. Click **Advanced Tools** → **Go** (opens Kudu)
3. Click **Debug console** → **PowerShell**
4. Navigate to: `D:\home\site\wwwroot`
5. **Drag and drop** contents of `/dist` folder here
6. Refresh the browser

#### Option B: Using Azure CLI (Recommended)

```powershell
# From your project root with /dist folder

# Log in to Azure (if not already)
az login

# Get publish profile (creates a password)
az webapp deployment list-publishing-profiles `
    --resource-group vxt-resource-group `
    --name vxt-admin-dashboard `
    --query @[0].publishUrl `
    --output tsv > publish.txt

# Deploy using ZIP
cd dist
Compress-Archive -Path * -DestinationPath ../app.zip
cd ..

az webapp deployment source config-zip `
    --resource-group vxt-resource-group `
    --name vxt-admin-dashboard `
    --src app.zip
```

#### Option C: Using VS Code

**Prerequisites**:
```powershell
# Install Azure App Service extension
code --install-extension ms-azuretools.vscode-azureappservice
```

**Steps**:
1. Open VS Code
2. Go to **Azure Explorer** (left sidebar)
3. Sign in with Azure subscription
4. Right-click **vxt-admin-dashboard** app service
5. Select **Deploy to Web App**
6. Select `/dist` folder
7. Click **Deploy**

---

### STEP 5: Configure Environment Variables

**Purpose**: Tell React where the API is located

**Azure Portal Steps**:
1. Go to **App Service** → **vxt-admin-dashboard**
2. Click **Configuration** (left sidebar)
3. Click **Application settings** tab
4. Click **+ New application setting**
5. Add:

| Name | Value |
|------|-------|
| `VITE_API_BASE_URL` | `https://vxt-api-functions.azurewebsites.net/api` |
| `NODE_ENV` | `production` |

6. Click **Save**

**For React to use these**:
- React components access via: `import.meta.env.VITE_API_BASE_URL`
- Example in code: `const api = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'`

---

### STEP 6: Configure App Service Settings

**Azure Portal Steps** (Additional Configuration):

1. Go to **App Service** → **vxt-admin-dashboard**
2. Click **General settings** → **Startup command**:
   ```
   echo "Node app running"
   ```

3. Virtual applications and directories:
   - Physical path: `site\wwwroot`
   - Handler: `DefaultDocument`

4. Enable these features:
   - ✅ **Always On** (recommended for production)
   - ✅ **HTTP/2**
   - ✅ **64-bit**

5. Click **Save**

---

### STEP 7: Verify Deployment

#### Test 1: Check Website is Accessible

```powershell
# Open in browser
Start-Process "https://vxt-admin-dashboard.azurewebsites.net"

# Or via PowerShell
Invoke-WebRequest -Uri "https://vxt-admin-dashboard.azurewebsites.net" | Select-Object StatusCode, StatusDescription
```

**Expected**: HTTP 200 (OK)

#### Test 2: Verify API Connection

1. Open dashboard in browser: `https://vxt-admin-dashboard.azurewebsites.net`
2. Open **Browser Developer Tools** (F12)
3. Go to **Console** tab
4. You should see no CORS errors
5. Go to **Network** tab
6. Navigate to Customer Entities page
7. You should see API requests to `vxt-api-functions.azurewebsites.net/api/customerentities`

#### Test 3: Test Core Features

1. **View Entities**:
   - Navigate to Customer Entities Management
   - Should see list of 5 entities
   - Should see **IoT Device ID column** (NEW)

2. **Edit Entity**:
   - Click Edit on Entity ID 2
   - Should see **IoT Device ID field** (NEW)
   - Value: `TomerRefael`

3. **Test Sync Button**:
   - Scroll to bottom of Edit form
   - Should see **🚀 SYNC to Device** button (NEW)
   - Click it
   - Should see success message: "✓ Setup synced to device successfully"

---

## 🎨 Customization Options

### Custom Domain (Optional)

**Add your own domain** instead of `.azurewebsites.net`:

1. Go to **App Service** → **Custom domains** (left sidebar)
2. Click **Add custom domain**
3. Enter domain name (e.g., `dashboard.yachtsense.ai`)
4. Azure will show DNS records needed
5. Add DNS records to your domain registrar
6. Validate and save

**Result**: Users can access via `https://dashboard.yachtsense.ai`

### Custom SSL Certificate (Optional)

If using custom domain:
1. **Free option**: Let's Encrypt (automatic via App Service)
2. **Paid option**: Upload your own certificate

Azure App Service provides **free SSL certificates** for `.azurewebsites.net` and custom domains!

---

## 🚨 Troubleshooting

### "Blank page" or "404 Not Found"

**Cause**: Files not deployed correctly

**Solution**:
1. Check `/dist` folder has `index.html`
2. Re-deploy using ZIP method
3. Check deployment logs in Kudu

### "API returns CORS error"

**Cause**: Frontend and API domain/origin mismatch

**Solution**:
1. Go to **Function App** → **CORS**
2. Add `https://vxt-admin-dashboard.azurewebsites.net` to allowed origins
3. Save and wait 60 seconds
4. Refresh browser without cache (Ctrl+Shift+Del)

### "Cannot GET /path"

**Cause**: React Router paths not handled correctly

**Solution**: Add **web.config** to `/dist` folder:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchList" trackAllCaptures="false">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### "Slow loading" or "Timeouts"

**Causes**: 
- Free tier has limited resources
- Cold start (deploys take time)
- Database query slow

**Solutions**:
1. Upgrade to B1 plan (~$7/month)
2. Enable "Always On" in app settings
3. Optimize database queries
4. Monitor in Application Insights

---

## 📊 Performance Monitoring

### Enable Application Insights

**Azure Portal Steps**:
1. Go to **App Service** → **vxt-admin-dashboard**
2. Click **Application Insights** (left sidebar)
3. Click **Enable Application Insights** → **Create new**
4. Name: `vxt-insights`
5. Click **OK**

**Monitor**:
- Page load times
- API response times
- Error rates
- User count

---

## 🔄 Continuous Deployment (Optional)

### Set up GitHub Actions for Auto-Deployment

**Create `.github/workflows/deploy.yml`**:

```yaml
name: Deploy React Admin Dashboard to Azure

on:
  push:
    branches: [ main ]
    paths: [ 'admin-dashboard/**' ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Use Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Build
      working-directory: ./admin-dashboard
      run: |
        npm install
        npm run build
    
    - name: Deploy to Azure
      uses: azure/webapps-deploy@v2
      with:
        app-name: 'vxt-admin-dashboard'
        publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
        package: './admin-dashboard/dist'
```

---

## ✅ Deployment Checklist

- [ ] React app builds locally (`npm run build`)
- [ ] `/dist` folder created with `index.html`
- [ ] App Service Plan created (Free tier)
- [ ] App Service instance created
- [ ] Built files deployed to App Service
- [ ] Environment variables configured
- [ ] Website accessible at `https://vxt-admin-dashboard.azurewebsites.net`
- [ ] Dashboard loads without errors
- [ ] API endpoint configured in environment
- [ ] Customer Entities page shows 5 entities
- [ ] IoT Device ID column visible
- [ ] IoT Device ID form field visible (in Edit)
- [ ] 🚀 SYNC button visible and clickable
- [ ] Sync button returns success message
- [ ] No CORS errors in browser console

---

## 📈 After Deployment

### Monitor Health

```powershell
# Check app service status
az webapp show `
    --resource-group vxt-resource-group `
    --name vxt-admin-dashboard `
    --query state
```

### View Logs

```powershell
# Stream live logs
az webapp log tail `
    --resource-group vxt-resource-group `
    --name vxt-admin-dashboard
```

### Update Content

Anytime you make changes to React code:

```powershell
# Rebuild
cd admin-dashboard
npm run build

# Deploy new version
az webapp deployment source config-zip `
    --resource-group vxt-resource-group `
    --name vxt-admin-dashboard `
    --src dist/
```

---

## 🎯 Next Steps

### Immediate (After Frontend is Live)
1. ✅ Database deployed (Azure SQL)
2. ✅ API deployed (Azure Functions)
3. ✅ Frontend deployed (Azure App Service)
4. **Test entire flow end-to-end**:
   - Open dashboard
   - Edit entity with device ID
   - Click sync button
   - Verify Device Twin updates in Azure IoT Hub

### Short-term
1. **Performance Optimization**:
   - Monitor response times
   - Optimize slow queries
   - Add caching if needed

2. **Security Hardening**:
   - Add authentication (OAuth/AAD)
   - Implement rate limiting
   - Use Key Vault for secrets

3. **Additional Features**:
   - Real-time updates (WebSockets)
   - Advanced device management
   - Analytics dashboard

### Medium-term (Optional)
1. **CI/CD Pipeline**: Set up GitHub Actions
2. **Custom Domain**: Link your domain
3. **CDN**: Add Azure CDN for global distribution
4. **Monitoring**: Set up alerts in Azure Monitor

---

## 💰 Cost Summary

**Monthly Cost** (Free Tier):
- App Service (Free): $0
- Storage Account: ~$1
- Function App: $0 (1M calls/month free)
- Application Insights: $0 (free tier)
- SQL Database: $0 (free tier trial)

**Total**: **FREE** (after free trial)

**After upgrade to B1**:
- App Service (B1): +$7/month
- **Total**: ~$10-15/month

---

## 📞 Support

### Useful Azure Portal Links

- **App Service**: https://portal.azure.com → App Services → vxt-admin-dashboard
- **Log Stream**: https://portal.azure.com → App Services → vxt-admin-dashboard → Log Stream
- **Kudu Console**: https://vxt-admin-dashboard.scm.azurewebsites.net/DebugConsole
- **App Insights**: https://portal.azure.com → Application Insights → vxt-insights

### Common Commands

```powershell
# Restart app service
az webapp restart `
    --resource-group vxt-resource-group `
    --name vxt-admin-dashboard

# Check deployment status
az webapp deployment list-publishing-profiles `
    --resource-group vxt-resource-group `
    --name vxt-admin-dashboard

# Scale up to B1 plan
az appservice plan update `
    --name vxt-app-plan `
    --resource-group vxt-resource-group `
    --sku B1
```

---

## ✨ Feature Verification

Once deployed, verify all new features are working:

```javascript
// In browser console on dashboard:

// Check environment variable is set
console.log(import.meta.env.VITE_API_BASE_URL)
// Should output: https://vxt-api-functions.azurewebsites.net/api

// Check API calls are working
fetch(`${import.meta.env.VITE_API_BASE_URL}/customerentities`)
    .then(r => r.json())
    .then(d => console.log('Entities:', d))
// Should show 5 entities with iotDeviceId field
```

---

**Status**: Phase 3 (Frontend) - Complete  
**Overall Progress**: 100% Deployed  
**Remaining**: Testing & optimizations  

Generated: March 13, 2026
