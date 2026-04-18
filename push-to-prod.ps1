#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Safe push from main to prod branch with confirmation
.DESCRIPTION
    1. Verifies you're on main branch
    2. Pulls latest from main
    3. Switches to prod
    4. Merges main into prod
    5. Pushes to GitHub (triggers Azure deployment)
#>

Write-Host "=== PUSH MAIN TO PROD ===" -ForegroundColor Cyan

# Check current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne "main") {
    Write-Host "ERROR: You must be on 'main' branch to push to prod" -ForegroundColor Red
    Write-Host "Current branch: $currentBranch" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ On main branch" -ForegroundColor Green

# Pull latest
Write-Host "Pulling latest from main..." -ForegroundColor Yellow
git pull origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to pull from main" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Pulled latest" -ForegroundColor Green

# Switch to prod
Write-Host "Switching to prod..." -ForegroundColor Yellow
git checkout prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to checkout prod" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Switched to prod" -ForegroundColor Green

# Pull latest prod
Write-Host "Pulling latest prod..." -ForegroundColor Yellow
git pull origin prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to pull prod" -ForegroundColor Red
    exit 1
}

# Merge main into prod
Write-Host "Merging main into prod..." -ForegroundColor Yellow
git merge main --no-edit
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Merge conflict! Resolve manually then push" -ForegroundColor Red
    Write-Host "Run: git merge --abort (to continue the cancel process)" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Merged main" -ForegroundColor Green

# Push to prod (triggers GitHub Actions → Azure)
Write-Host "Pushing to prod (will trigger Azure deployment)..." -ForegroundColor Yellow
# Use SSH deploy key for authentication
$env:GIT_SSH_COMMAND = "ssh -i $env:USERPROFILE\.ssh\deploy_prod -o StrictHostKeyChecking=accept-new"
# Bypass pre-push hook (only deploy scripts may push to prod)
$env:VXT_DEPLOY_SCRIPT = "1"
git push origin prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to push to prod" -ForegroundColor Red
    exit 1
}

Write-Host "" -ForegroundColor Green
Write-Host "✓✓✓ SUCCESS! Changes pushed to prod" -ForegroundColor Green
Write-Host "GitHub Actions will now deploy to Azure" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "Monitor deployment:" -ForegroundColor Cyan
Write-Host "  https://github.com/barakuziel-vxt/vxt/actions" -ForegroundColor Blue
Write-Host "" -ForegroundColor Green

# Switch back to main
Write-Host "Switching back to main for future work..." -ForegroundColor Yellow
git checkout main
Write-Host "✓ Back on main branch" -ForegroundColor Green
