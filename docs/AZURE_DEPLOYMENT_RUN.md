# How to Run Azure Deployment Script

## Quick Start (5 minutes)

### Prerequisites
- ✅ Azure login: `az login`
- ✅ GitHub repo with code
- ✅ Node.js installed
- ✅ Python 3.11+ installed

### Option 1: Interactive Mode (Easiest)

```powershell
cd C:\VXT
.\deploy_all_azure_automated.ps1
```

Then answer the prompts:
1. **GitHub Repo URL** → Enter your GitHub repo URL
2. **Proceed?** → Press Enter to continue

The script will:
- Prompt for GitHub repo URL (if not provided)
- Show branch setup guide
- Validate prerequisites
- Create all Azure resources
- Deploy your code
- Update SQL schema
- Run tests
- Show you the live URLs

### Option 2: Direct Parameters

```powershell
.\deploy_all_azure_automated.ps1 `
  -GitHubRepoUrl "https://github.com/YOUR-USERNAME/vxt-repo" `
  -GitHubBranch "production" `
  -Location "eastus"
```

## What The Script Does (Step by Step)

```
Phase 1: Azure Resources
├─ Create Storage Account (~$1-2/month)
├─ Create Function App (FREE - 1M calls/month included)
├─ Create App Service Plan (FREE F1)
└─ Create App Service for dashboard (FREE F1)

Phase 2: Deploy Functions
├─ Configure environment variables
├─ Set up CORS
└─ Link GitHub repo for auto-deployment

Phase 3: Deploy React Dashboard
├─ Clone from GitHub
├─ Install dependencies (npm install)
├─ Build production bundle (npm run build)
└─ Deploy to App Service

Phase 4: Update SQL Schema
├─ Add iotDeviceId column
├─ Populate device mappings
└─ Verify data

Phase 5: Testing & Verification
├─ Test API endpoints
├─ Test dashboard accessibility
└─ Show live URLs
```

**Total time: 30-45 minutes**

## What You Need to Prepare

### 1. GitHub Repository
Your repo should have this structure:
```
your-repo/
├── admin-dashboard/          (React app)
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── functions/                (Azure Functions - optional)
│   ├── __init__.py
│   └── function.json
└── main.py                   (FastAPI backend - optional)
```

### 2. GitHub Branches
Recommended structure:
```
main        → Development
production  → Deployed to Azure (this is what the script uses)
```

See [GITHUB_BRANCH_SETUP.md](GITHUB_BRANCH_SETUP.md) for detailed instructions.

## After Deployment

### Live URLs
```
Admin Dashboard: https://vxt-admin-dashboard-XXXX.azurewebsites.net
API Endpoints:   https://vxt-api-functions-YYYY.azurewebsites.net/api
Database:        vxtdb.database.windows.net
```

### Continue Development
1. **Make changes locally** in `main` branch
2. **Push to production branch** when ready → Auto-deploys to Azure
3. **Monitor in Azure** via Application Insights

### Update Azure Code
Push to production branch:
```powershell
git push origin production
# GitHub Actions → Automatic deployment to Azure
```

## Troubleshooting

### ❌ "Not logged into Azure"
```powershell
az login
# Follow the browser prompt
```

### ❌ "GitHub repo not found"
- Check URL: `https://github.com/USERNAME/REPO`
- Verify public or you have access

### ❌ "npm install failed"
```powershell
# Ensure Node.js is installed
node --version   # Should be v18+
npm --version    # Should be 8+
```

### ❌ "SQL connection timeout"
- Azure SQL firewall may block your IP
- Run from Azure Cloud Shell instead:
  ```powershell
  az cloud shell
  ```

## Environment Variables Set in Azure

The script automatically configures these in your Function App:

```
AzureSqlConnectionString = Server=tcp:vxtdb.database.windows.net...
Environment = prod
WEBSITE_ENABLE_SYNC_UPDATE_SITE = true
```

## Monthly Cost Estimate

| Resource | Cost | Notes |
|----------|------|-------|
| Function App Consumption | FREE | 1M calls/month included |
| App Service Plan (F1) | FREE | Development tier |
| App Service (F1) | FREE | 60 minutes/day |
| Storage Account | ~$1-2 | Required for Function runtime |
| SQL Database | Trial* | First month free |
| **Total** | **~$1-2** | **Effectively FREE** |

*After trial, ~$5-15/month depending on usage

## Next Steps

### 1. Create the production branch
```powershell
git checkout -b production
git push -u origin production
```

### 2. Run the deployment
```powershell
.\deploy_all_azure_automated.ps1
```

### 3. Make changes and deploy
```powershell
# On main branch - make changes
git add .
git commit -m "Your message"
git push origin main

# When ready for Azure
git checkout production
git merge main
git push origin production  # Auto-deploys!
```

### 4. Monitor live
- Dashboard: `https://vxt-admin-dashboard-XXXX.azurewebsites.net`
- API Docs: `https://vxt-api-functions-YYYY.azurewebsites.net/api/docs`

---

**Questions?** Check [GITHUB_BRANCH_SETUP.md](GITHUB_BRANCH_SETUP.md) for detailed GitHub configuration. 🚀
