# GitHub Branch Strategy for YachtSense AI Azure Deployment

## Overview

This document explains the recommended GitHub branch strategy for deploying YachtSense AI to Azure.

## Branch Strategy

### 1. **main** (Development)
- **Purpose**: Your primary development branch
- **Where**: Local development, staging tests
- **What goes here**: All active development features
- **Protection**: Optional - no direct pushes to production

### 2. **production** (Azure Deployment) ⭐ (Recommended for this script)
- **Purpose**: Dedicated Azure Production Deployment
- **Automatic Deployment**: Yes - GitHub Actions deploys to Azure when you push
- **What goes here**: Release-ready code, tested & verified
- **Protection**: Recommended - require PR reviews

### 3. **staging** (Optional - Azure Staging)
- **Purpose**: Test Azure deployment before production
- **Automatic Deployment**: To staging App Service
- **What goes here**: Release candidates
- **Protection**: Recommended

## Step 1: Create the Production Branch Locally

```powershell
# Clone your repo if you haven't
git clone https://github.com/YOUR-USERNAME/vxt-repo-name.git
cd vxt-repo-name

# Create production branch from main
git checkout -b production

# Push it to GitHub
git push -u origin production
```

## Step 2: Configure GitHub (First Time Only)

If you want automatic deployments when you push to `production` branch:

1. Go to your GitHub repo → **Settings**
2. Click **Secrets and variables** → **Actions**
3. Add these secrets (matching your Azure credentials):
   ```
   AZURE_SUBSCRIPTION_ID = your-subscription-id
   AZURE_RESOURCE_GROUP = vxt-resource-group
   AZURE_FUNCTION_APP = vxt-api-functions-XXXX
   AZURE_APP_SERVICE = vxt-admin-dashboard-XXXX
   ```

4. Create `.github/workflows/deploy-azure.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches:
      - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy Functions
        run: |
          # Deploy Azure Functions from admin-dashboard/...
          
      - name: Deploy React App
        run: |
          # Build and deploy React to App Service
```

## Step 3: Use the Automated Deployment Script

Run the deployment script with your repo:

```powershell
# Run the script and provide your GitHub repo URL when prompted
.\deploy_all_azure_automated.ps1

# Or specify parameters directly
.\deploy_all_azure_automated.ps1 -GitHubRepoUrl "https://github.com/username/repo" -GitHubBranch "production"
```

## Step 4: Daily Workflow

### For Development:
```powershell
# Work on main branch
git checkout main
# ... make changes ...
git add .
git commit -m "Add new feature"
git push origin main
```

### For Azure Deployment:
```powershell
# When ready to deploy to Azure
git checkout production
git merge main  # or git rebase (if linear history preferred)
git push origin production
# GitHub Actions automatically deploys!
```

## Workflow Diagram

```
┌─────────────┐
│    main     │  Development Branch
│  (local)    │  ✓ New features
└──────┬──────┘  ✓ Bug fixes
       │
       │ (Ready for production?)
       │ git merge/rebase
       │
       ▼
┌─────────────────┐
│   production    │  Azure Production
│  (GitHub)       │  ✓ Auto-deploys to Azure
└─────────────────┘  ✓ Live to users
       │
       │ (Need staging first?)
       │ git branch staging
       ▼
┌─────────────────┐
│    staging      │  Azure Staging (Optional)
│  (GitHub)       │  ✓ Test before production
└─────────────────┘  ✓ Separate resources
```

## Branch Protection Rules (Recommended)

To prevent accidental pushes to production:

1. Go to repo **Settings** → **Branches**
2. Click **Add rule** for `production` branch
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging

## Common Commands

### Check which branch you're on:
```powershell
git branch -v
```

### Switch to production:
```powershell
git checkout production
```

### See commits that are in main but not production:
```powershell
git log production..main --oneline
```

### Merge main into production (with review):
```powershell
# Option 1: Local merge and push
git checkout production
git merge main
git push origin production

# Option 2: GitHub PR (recommended - safer)
# Go to GitHub → Create PR from main → production
```

### Create staging branch:
```powershell
git checkout -b staging
git push -u origin staging
# Then configure another App Service for staging environment
```

## Troubleshooting

**Q: I accidentally pushed to production, how do I revert?**
```powershell
git revert HEAD
git push origin production
```

**Q: Main and production are out of sync, which is correct?**
```powershell
# Production should always be ≥ main in terms of commits
# Get main back in sync:
git checkout main
git pull origin production
git push origin main
```

**Q: I want continuous deployment on main (not just production)?**
- Update `.github/workflows/deploy-azure.yml` to trigger on both branches
- Deploy to different Azure resources (staging for main, production for production branch)

## Security Best Practices

1. **Never push secrets to GitHub**
   - Instead: Use GitHub Secrets (in Actions)
   - Instead: Use Azure Key Vault
   - Instead: Use managed identities

2. **Protect production branch**
   - Require PR reviews
   - Run automated tests
   - Deploy to staging first

3. **Audit deployments**
   - GitHub Actions history
   - Azure Activity Log
   - Application Insights monitoring

## Summary

| Task | Command |
|------|---------|
| Start development | `git checkout main` |
| Deploy to production | `git push origin production` |
| Check branch status | `git branch -v` |
| Create staging | `git checkout -b staging && git push -u origin staging` |
| Pull production code | `git pull origin production` |

---

**Need help?** Run the deployment script - it will guide you through the setup! 🚀
