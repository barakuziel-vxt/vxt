# Azure Deployment Guide - File-Based Deployment

## Status: Application Ready for GitHub Actions Deployment

Your VXT application (Python APIs + React dashboards) is now ready to deploy to Azure using file-based deployment.

### What's Included

1. **FastAPI Backend** - All 6 IoT-enabled endpoints
   - GET /entitycategories
   - POST /entities
   - And more...

2. **React Admin Dashboard** - Built and optimized
   - Full management interface
   - Real-time IoT device data
   - Entity management

3. **Database Schema Files** - Ready for execution
   - Customer, Entity, Provider tables
   - Event logging tables
   - Protocol configuration

### Deployment Method: File-Based (NOT Docker)

Files are deployed directly to Azure App Service using the Azure Web Apps Deploy action. No Docker containers required.

### Prerequisites

Your Azure Web App must have:
- Python 3.11 runtime
- App Service plan (Linux or Windows)
- Publish profile configured in GitHub Secrets

### Deployment Steps

#### Step 1: Get Azure Publish Profile

1. Go to Azure Portal (https://portal.azure.com)
2. Navigate to: App Services > vxt-web-app
3. Click "Get publish profile" button (top right)
4. A .PublishSettings file will download
5. Open the file and copy ALL the XML content

#### Step 2: Add GitHub Secret

1. Go to GitHub: https://github.com/barakuziel-vxt/vxt
2. Click Settings (top menu)
3. Go to Secrets and variables > Actions
4. Click "New repository secret"
5. Create secret with:
   - Name: `AZURE_PUBLISH_PROFILE`
   - Value: [Paste the entire .PublishSettings XML]
6. Click "Add secret"

#### Step 3: Trigger Deployment

Push code to the `prod` branch to auto-deploy:

```bash
git push origin prod
```

The GitHub Actions workflow will:
1. Checkout the code
2. Set up Python 3.11
3. Install requirements.txt dependencies
4. Deploy files directly to Azure App Service
5. Application starts automatically

### Deployment Configuration

**Workflow File:** `.github/workflows/deploy-to-azure.yml`

The workflow triggers on:
- Push to `prod` branch (automatic)
- Manual workflow dispatch

### Post-Deployment

After deployment completes:

1. **Check Deployment Status:**
   - GitHub Actions tab shows workflow status
   - Azure Portal: App Services > vxt-web-app > Deployments

2. **Verify API is Running:**
   ```
   curl https://vxt-web-app.azurewebsites.net/health/db
   ```

3. **Check Logs:**
   - Azure Portal: vxt-web-app > Deployment slots > Production > App Service logs

### Troubleshooting

**If deployment fails:**

1. Check GitHub Actions workflow logs
2. Verify AZURE_PUBLISH_PROFILE secret is correctly set
3. Ensure publish profile XML is complete and valid
4. Check requirements.txt has all necessary packages

**If app doesn't start:**

1. Check Azure App Service logs
2. Verify Python version is 3.11
3. Check environment variables are set (SQL_CONNECTION_STRING, ENVIRONMENT, etc.)
4. Verify pymssql can connect to database
git push origin main
```

Or make a test commit:

```
echo "Deployment triggered" >> README.md
git add README.md
git commit -m "Deploy to Azure"
git push origin main
```

#### Step 4: Monitor Progress

1. Visit GitHub repo > Actions tab
2. Watch "Deploy to Azure" workflow
3. When complete (green), visit: https://vxt-admin-app.azurewebsites.net

### Verification Checklist

After deployment completes:

- [ ] Website loads at https://vxt-admin-app.azurewebsites.net
- [ ] Admin dashboard displays
- [ ] API endpoint responds: https://vxt-admin-app.azurewebsites.net/api/customerentities
- [ ] No errors in Application Insights logs

### Architecture

GitHub (Code) 
  -> GitHub Actions (Build + Deploy) 
    -> Azure App Service (vxt-admin-app)
      -> FastAPI + React Live


### Deployment Package Contents

Created files:
- azure-deployment/ - Complete deployment package
- azure-deployment.zip - Compressed deployment
- AZURE_DEPLOYMENT_FINAL.md - Detailed guide

### Database Configuration

The database schema files are in the repository:
- azure_data_Customer.sql
- azure_data_Entity.sql
- azure_data_Provider.sql
- azure_data_Event.sql

If schema hasn't been applied to Azure SQL, execute via Azure Portal:
1. SQL Database > Query Editor
2. Copy and run each .sql file

### Troubleshooting

**If deployment fails:**
1. Check Actions tab for error messages
2. Ensure entire .PublishSettings XML was copied (not truncated)
3. Verify AZURE_PUBLISH_PROFILE secret was added without line breaks

**If website doesn't load:**
1. Check App Service > Logs in Azure Portal
2. Ensure Python dependencies installed
3. Check environment variables configured

**Database not responding:**
1. Check firewall rule allows Azure services
2. Verify DATABASE_URL environment variable set
3. Confirm database exists and is accessible

### What Gets Deployed

✓ FastAPI Python backend
✓ React admin-dashboard 
✓ All configuration files
✓ Database schema scripts
✓ Environment configuration

---

**Status:** READY FOR GITHUB ACTIONS DEPLOYMENT
**Target URL:** https://vxt-admin-app.azurewebsites.net
**Last Updated:** March 14, 2026
