#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

Write-Host "=== ENABLE PROD BRANCH PROTECTION ===" -ForegroundColor Cyan

# Check GitHub CLI
Write-Host "Checking GitHub CLI installation..." -ForegroundColor Yellow
$result = gh --version 2>&1
if ($?) { Write-Host "✓ GitHub CLI is installed" -ForegroundColor Green } else { Write-Host "ERROR: GitHub CLI not found"; exit 1 }

# Check authentication
Write-Host "Checking GitHub authentication..." -ForegroundColor Yellow
gh auth status 2>&1 | Out-Null
if ($?) { Write-Host "✓ Authenticated with GitHub" -ForegroundColor Green } else { Write-Host "ERROR: Not authenticated"; exit 1 }

# Get repo
Write-Host "Getting repository info..." -ForegroundColor Yellow
$repo = gh repo view --json nameWithOwner --jq '.nameWithOwner'
Write-Host "✓ Repository: $repo" -ForegroundColor Green

# Enable protection
Write-Host ""
Write-Host "Enabling branch protection for 'prod'..." -ForegroundColor Yellow

$null = gh api -X PUT "repos/{owner}/{repo}/branches/prod/protection" -f "enforce_admins=true" -f "allow_force_pushes=false" -f "allow_deletions=false" 2>&1

if ($?) {
    Write-Host "✓ Branch protection enabled successfully!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Could not enable protection" -ForegroundColor Red
    exit 1 
}

Write-Host ""
Write-Host "=== PROTECTION ENABLED ===" -ForegroundColor Green
Write-Host ""
Write-Host "Settings Applied:" -ForegroundColor Cyan
Write-Host "  ✓ Enforce admins: YES" 
Write-Host "  ✓ Allow force pushes: NO"
Write-Host "  ✓ Allow deletions: NO"
Write-Host ""
Write-Host "What this means:" -ForegroundColor Green
Write-Host "  • Direct pushes to prod are now BLOCKED"
Write-Host "  • Only push-to-prod.ps1 script can deploy"
Write-Host "  • Github Actions auto-deploy still works"
Write-Host ""
Write-Host "Deploy with: .\push-to-prod.ps1" -ForegroundColor Cyan
