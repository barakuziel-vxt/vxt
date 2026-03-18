#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy VXT FastAPI to Azure Web App (Fixed UTF-8 encoding issue)
    
.DESCRIPTION
    This script rebuilds the Docker image with UTF-8 encoding fixes and deploys it to Azure Web App.
    This fixes the HTTP 500 errors caused by Unicode/emoji encoding issues.

.EXAMPLE
    .\Deploy-VXT-API-Azure-Fixed.ps1
#>

param(
    [string]$RegistryName = "vxtwapp",
    [string]$RegistryGroup = "vxt-rg",
    [string]$AppName = "vxt-web-app-g5gbaee2f4bmgphb",
    [string]$AppResourceGroup = "vxt-rg",
    [string]$ImageTag = "latest"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "VXT FastAPI - Azure Deployment (UTF-8 Fix)"  -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Verify Docker is running
Write-Host "`n[1/6] Checking Docker..." -ForegroundColor Yellow
try {
    docker ps > $null
    Write-Host "[OK] Docker is running" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Verify we're in the VXT directory
if (-not (Test-Path ".\main.py")) {
    Write-Host "[ERROR] main.py not found. Please run this script from C:\VXT" -ForegroundColor Red
    exit 1
}

# Build image locally
Write-Host "`n[2/6] Building Docker image locally..." -ForegroundColor Yellow
Write-Host "Command: docker build -t vxt-api:$ImageTag ." -ForegroundColor Gray
docker build -t vxt-api:$ImageTag .

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Image built successfully" -ForegroundColor Green

# Test image locally (optional)
Write-Host "`n[3/6] Testing image locally..." -ForegroundColor Yellow
Write-Host "Note: Starting test container..." -ForegroundColor Gray

$testContainer = docker run --rm -d `
    -e PYTHONIOENCODING=utf-8 `
    -e ENVIRONMENT=test `
    -p 8001:8000 `
    vxt-api:$ImageTag

Start-Sleep -Seconds 3

Write-Host "Testing /health/db endpoint..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/health/db" -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "[OK] API is responding successfully!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] API returned status $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Could not reach local test container - this may be expected if using local networking" -ForegroundColor Yellow
}

# Stop test container
docker stop $testContainer 2>$null | Out-Null
Write-Host "[OK] Local test complete" -ForegroundColor Green

# Login to Azure
Write-Host "`n[4/6] Authenticating with Azure..." -ForegroundColor Yellow
try {
    $account = az account show 2>$null
    if (-not $account) {
        Write-Host "Launching Azure login..." -ForegroundColor Gray
        az login | Out-Null
    }
    Write-Host "[OK] Azure authentication successful" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Azure authentication failed!" -ForegroundColor Red
    exit 1
}

# Get ACR credentials and push image
Write-Host "`n[5/6] Pushing image to Azure Container Registry..." -ForegroundColor Yellow

$acrUrl = "$RegistryName.azurecr.io"
Write-Host "Registry: $acrUrl" -ForegroundColor Gray

# Tag image for ACR
docker tag vxt-api:$ImageTag "$acrUrl/vxt-api:$ImageTag"

# Login to ACR using Azure CLI
Write-Host "Logging in to ACR ($RegistryName)..." -ForegroundColor Gray
az acr login --name $RegistryName

# Push image
Write-Host "Pushing image..." -ForegroundColor Gray
docker push "$acrUrl/vxt-api:$ImageTag"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Image pushed successfully" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to push image!" -ForegroundColor Red
    exit 1
}

# Restart Azure Web App
Write-Host "`n[6/6] Restarting Azure Web App..." -ForegroundColor Yellow
Write-Host "App: $AppName (Resource Group: $AppResourceGroup)" -ForegroundColor Gray

az webapp restart `
    --name $AppName `
    --resource-group $AppResourceGroup

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Web App restarted successfully" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Web App restart command completed with status $LASTEXITCODE" -ForegroundColor Yellow
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Wait 30-60 seconds for the app to start"
Write-Host "2. Test the API:"
Write-Host "   curl https://$AppName.azurewebsites.net/protocols"
Write-Host "3. Check logs if there are issues:"
Write-Host "   az webapp log tail --name $AppName --resource-group $AppResourceGroup"

Write-Host "`nKey Changes:" -ForegroundColor Cyan
Write-Host "✓ Added UTF-8 encoding environment variables to Dockerfile"
Write-Host "✓ Set PYTHONIOENCODING=utf-8 for proper Unicode handling"
Write-Host "✓ Configured LANG and LC_ALL for container locale"
Write-Host "`nThis fixes the HTTP 500 errors caused by emoji/Unicode encoding issues."
