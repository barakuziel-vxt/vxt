# Azure Deployment - Ready to Execute

Your GitHub repo is set up with the production branch ready. Everything is prepared for Azure deployment.

## Prerequisites (One-time setup)
- [ ] Install Azure CLI: https://aka.ms/installazurecliwindows
- [ ] After install, open new PowerShell window
- [ ] Run: `az login` (follow browser prompt)

## Then Run This Script

Once Azure CLI is installed and you're logged in:

```powershell
cd C:\VXT
.\deploy_now.ps1
```

The script will automatically:
- ✅ Create Resource Group
- ✅ Create Storage Account (~1-2/month)
- ✅ Create Function App (FREE - 1M calls/month)
- ✅ Create App Service Plan (FREE F1)
- ✅ Create App Service (FREE F1)
- ✅ Clone your GitHub production branch
- ✅ Build React dashboard
- ✅ Deploy to Azure
- ✅ Update SQL schema with IoT Device ID
- ✅ Show you the live URLs

## Installation Steps

### Option 1: Download Installer
1. Go to: https://aka.ms/installazurecliwindows
2. Download `AzureCLI.msi`
3. Run installer
4. Close and reopen PowerShell
5. Test: `az --version`

### Option 2: Using winget (Windows Package Manager)
```powershell
winget install Microsoft.AzureCLI
```

### Option 3: Using Chocolatey
```powershell
choco install azure-cli
```

## After Installation

```powershell
# Verify Azure CLI is installed
az --version

# Login to Azure
az login

# Run deployment (happens automatically from here)
cd C:\VXT
.\deploy_now.ps1
```

## What Gets Created

| Resource | Tier | Cost |
|----------|------|------|
| Function App | Consumption | FREE (1M calls/month) |
| App Service Plan | Free F1 | FREE |
| App Service | Free F1 | FREE |
| Storage Account | Standard LRS | ~1-2/month |
| **Total** | | **~1-3/month** |

## Live URLs After Deployment

Shown in script output:
- Admin Dashboard: `https://vxt-admin-dashboard-XXXX.azurewebsites.net`
- API Endpoints: `https://vxt-api-functions-YYYY.azurewebsites.net/api`

## Files Prepared

✅ `deploy_now.ps1` - Master deployment script
✅ Production branch created in GitHub
✅ admin-dashboard ready to build
✅ SQL schema update script
✅ API configuration ready
✅ CORS configured for Azure

## Next: Just Install Azure CLI and Run!

1. Install Azure CLI
2. Run `az login`
3. Execute `.\deploy_now.ps1`

That's it! Everything else is automated.
