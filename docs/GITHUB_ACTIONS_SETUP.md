# GitHub Actions Deployment Setup

## What I've Done
✅ Created `.github/workflows/deploy-to-azure.yml` 
- Automatically builds your code on every push to `main`
- Builds React admin dashboard
- Deploys everything to Azure App Service
- No manual git credentials needed!

## Your Next Steps (2 minutes)

### Step 1: Download Publish Profile from Azure
1. Go to Azure Portal → **vxt-admin-app** (Web App)
2. Click **Download publish profile** button (top right area)
3. A file like `vxt-admin-app.PublishSettings` will download
4. Open it with Notepad - keep it open

### Step 2: Add to GitHub Secrets
1. Go to GitHub: `https://github.com/barakuziel-vxt/vxt`
2. Click **Settings** (top right)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret** button
5. Fill in:
   - **Name**: `AZURE_PUBLISH_PROFILE`
   - **Value**: Copy/paste the **entire contents** of the PublishSettings file
6. Click **Add secret**

### Step 3: Push to Trigger Deployment
```powershell
cd C:\VXT
git add .github/
git commit -m "Add GitHub Actions Azure deployment workflow"
git push origin main
```

That's it! GitHub Actions will immediately start building and deploying to Azure.

### Verify Deployment
- Go to GitHub → **Actions** tab
- You'll see your deployment workflow running
- Once it completes (✅ green checkmark), visit:
  `https://vxt-admin-app.azurewebsites.net`

## Benefits
✅ No more credential issues
✅ Automatic deployment on every push
✅ Can trigger manually anytime from GitHub Actions
✅ Clean deployment logs and history
✅ Professional CI/CD pipeline

## Troubleshooting
If deployment fails:
1. Check GitHub Actions logs for the error
2. Verify the publish profile was pasted completely (no missing XML)
3. Check that `requirements.txt` exists in C:\VXT

Need help? The publish profile must be the complete XML file - typically 3000+ characters.
