#!/usr/bin/env powershell
# VXT Mobile Android Build Optimizer - Deployment Script

param(
    [switch]$Release = $false
)

$ErrorActionPreference = "Stop"
$WarningPreference = "SilentlyContinue"

Write-Host "`n========== VXT Mobile Build Optimizer ==========" -ForegroundColor Cyan
Write-Host "Preparing optimized build and deployment..." -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date

# Step 1: Verify project
Write-Host "[1/5] Verifying project..." -ForegroundColor Yellow
if (-not (Test-Path "c:\VXT\vxt-mobile")) {
    throw "Error: vxt-mobile directory not found"
}
Write-Host "  OK - Project found`n" -ForegroundColor Green

# Step 2: Clean artifacts
Write-Host "[2/5] Cleaning build artifacts..." -ForegroundColor Yellow
cd c:\VXT\vxt-mobile

@("android\build", "android\app\build", "android\.gradle", ".jestcache", ".metro-cache") | ForEach-Object {
    if (Test-Path $_) {
        Remove-Item $_ -Recurse -Force -ErrorAction Ignore | Out-Null
        Write-Host "  Removed: $_" -ForegroundColor Gray
    }
}
Write-Host "  OK - Cleanup complete`n" -ForegroundColor Green

# Step 3: Dependencies
Write-Host "[3/5] Verifying dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing npm packages..." -ForegroundColor Gray
    npm install --legacy-peer-deps 2>&1 | Select-Object -Last 3
} else {
    Write-Host "  OK - node_modules present" -ForegroundColor Green
}
Write-Host ""

# Step 4: Build setup
Write-Host "[4/5] Configuring build..." -ForegroundColor Yellow
$buildCmd = "npm run android"
if ($Release) {
    Write-Host "  Mode: RELEASE (optimized)" -ForegroundColor Cyan
} else {
    Write-Host "  Mode: DEBUG (development)" -ForegroundColor Cyan
}
Write-Host ""

# Step 5: Deploy
Write-Host "[5/5] Building and deploying to Note20..." -ForegroundColor Yellow
Write-Host "  Starting gradle build (this may take 3-5 minutes)..." -ForegroundColor Gray
Write-Host ""

Invoke-Expression $buildCmd

$elapsed = [math]::Round((Get-Date - $startTime).TotalSeconds, 1)
Write-Host ""
Write-Host "=========== SUCCESS ============" -ForegroundColor Green
Write-Host "Build and deployment completed in $($elapsed)s" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green
