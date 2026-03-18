# 🚀 Deployment Instructions - Azure Function Auto-Deploy Fix

## What Was Fixed
The previous GitHub Actions workflow failed with HTTP 403 because it relied on a publish profile from a function app that didn't exist. **This has been fixed** - the new workflow uses `az functionapp up` for automatic deployment without requiring a pre-existing publish profile.

## ✅ What You Need To Do

### Step 1: Create Azure Service Principal (1 command)

Run this **once** to create credentials for GitHub Actions to use:

```powershell
az ad sp create-for-rbac --name "vxt-function-deployer" `
  --role Contributor `
  --scopes /subscriptions/0d48ff3b-92f5-4d0e-b5d0-73a5e9ffebbb/resourceGroups/VXT-IoT-Hub
```

**Save the output** - it will look like:
```json
{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "0d48ff3b-92f5-4d0e-b5d0-73a5e9ffebbb",
  "tenantId": "..."
}
```

### Step 2: Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. **Name**: `azure_function`
3. **Visibility**: Private
4. Click **Create repository**
5. Copy the HTTPS URL (e.g., `https://github.com/YOUR_USERNAME/azure_function.git`)

### Step 3: Add GitHub Secrets

In **your new azure_function repo**:

1. Go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Add these 2 secrets:

| Name | Value |
|---|---|
| `AZURE_CREDENTIALS` | Paste the entire JSON from Step 1 (all 4 fields) |
| `DB_PASSWORD` | `Barak1008!` (your Azure SQL password) |

### Step 4: Push Code to GitHub

```powershell
# Change to the azure-functions directory
cd c:\VXT\azure-functions

# Update remote URL
git remote set-url origin https://github.com/YOUR_USERNAME/azure_function.git

# (First time only) Set your git user if needed
git config user.email "you@example.com"
git config user.name "Your Name"

# Push to GitHub
git push origin prod
```

### Step 5: Watch It Deploy

1. Go to your GitHub repo URL
2. Click **Actions** tab
3. Wait for the workflow to complete (usually 3-5 minutes)
4. When complete, you should see a green checkmark

### Step 6: Verify It Works

```powershell
# Check that the function app was created
az functionapp show --name vxt-telemetry-consumer --resource-group VXT-IoT-Hub

# Test the health endpoint
curl https://vxt-telemetry-consumer.azurewebsites.net/api/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-18T...",
  "messages_processed": 0,
  "last_error": null
}
```

## 🔄 From Now On

**Every time you push to `prod` branch:**
```powershell
cd c:\VXT\azure-functions
# Make your changes...
git add .
git commit -m "Updated function code"
git push origin prod  # ← Automatic deployment happens!
```

## ❌ Troubleshooting

### Secrets not set correctly
- **Error**: `ERROR: Authentication failed`
- **Fix**: Go back to Step 3, make sure both secrets are added exactly as shown

### Workflow fails with "ResourceNotFound"
- **Error**: `The Resource 'Microsoft.Web/sites/vxt-telemetry-consumer' under resource group`
- **Fix**: This is normal on first run - the workflow creates the app automatically. If it persists, check that your AZURE_CREDENTIALS secret is valid JSON

### Health check returns 503
- **Normal**: First deployment takes 2-3 minutes for Python cold start
- **Check**: View workflow logs in GitHub Actions tab to see progress
- **Manual test**: `az functionapp log tail --name vxt-telemetry-consumer --resource-group VXT-IoT-Hub`

### Git push fails
- **Error**: `fatal: '[repo url]' does not appear to be a 'git' repository`
- **Fix**: Make sure you're in `c:\VXT\azure-functions` directory and ran `git remote set-url origin [your_repo_url]`

## 📋 Checklist

- [ ] Ran `az ad sp create-for-rbac` and saved JSON output
- [ ] Created new GitHub repo named `azure_function`
- [ ] Added `AZURE_CREDENTIALS` secret (JSON from CLI)
- [ ] Added `DB_PASSWORD` secret (`Barak1008!`)
- [ ] Changed git remote URL
- [ ] Pushed code with `git push origin prod`
- [ ] Checked Actions tab for green checkmark
- [ ] Verified function app created in Azure
- [ ] Tested health endpoint (returns 200)

## 🎯 Next Steps

After deployment succeeds:
1. Configure IoT Hub routing to send messages to your function
2. Send test telemetry from Raspberry Pi
3. Verify data appears in EntityTelemetry table
4. Monitor function logs: `az functionapp log tail --name vxt-telemetry-consumer --resource-group VXT-IoT-Hub`

## 💡 Note

The workflow will try Python first (recommended), but if it fails, it falls back to Node.js. Both can execute your code - you'll see which one in the GitHub Actions logs.
