#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy VXT Orchestrator to Raspberry Pi via Azure IoT Edge
.DESCRIPTION
    1. Commits azure-iot-edge/* changes to main
    2. Merges main → prod and pushes (triggers GitHub Actions CI/CD)
    3. CI/CD builds ARM64 Docker image → pushes to ghcr.io
    4. CI/CD deploys to IoT Edge via az iot edge set-modules
    5. Edge agent on Pi pulls the image and runs the module

    Can also deploy directly without CI/CD using -Direct flag.

.PARAMETER Direct
    Skip git push. Deploy directly to IoT Edge using latest ghcr.io image.

.PARAMETER Tag
    Docker image tag to deploy (default: "latest")
#>

param(
    [switch]$Direct,
    [string]$Tag = "latest"
)

$IOT_HUB = "VXT-IoT-Hub"
$DEVICE_ID = "halos-edge"
$IMAGE = "ghcr.io/barakuziel-vxt/vxt-orchestrator"
$TEMPLATE = "$PSScriptRoot/azure-iot-edge/deployment.template.json"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  🚢 Deploy VXT Orchestrator to Raspberry Pi" -ForegroundColor Cyan
Write-Host "  via Azure IoT Edge" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Hub     : $IOT_HUB" -ForegroundColor Yellow
Write-Host "  Device  : $DEVICE_ID" -ForegroundColor Yellow
Write-Host "  Image   : ${IMAGE}:${Tag}" -ForegroundColor Yellow
Write-Host "  Mode    : $(if ($Direct) { 'Direct deploy' } else { 'Git push → CI/CD → Deploy' })" -ForegroundColor Yellow
Write-Host ""

# ── Verify az CLI is available and logged in ────────────────────────────────
Write-Host "Checking Azure CLI..." -ForegroundColor Yellow
$azVersion = az version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Azure CLI (az) not found. Install from https://aka.ms/installazurecli" -ForegroundColor Red
    exit 1
}

$azAccount = az account show --query "name" -o tsv 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Not logged in to Azure. Run: az login" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Azure CLI logged in ($azAccount)" -ForegroundColor Green

# Ensure IoT extension is installed
az extension add --name azure-iot --yes 2>$null | Out-Null

if (-not $Direct) {
    # ── GIT FLOW: commit → main → prod → push ──────────────────────────────

    # Check current branch
    $currentBranch = git rev-parse --abbrev-ref HEAD
    if ($currentBranch -ne "main") {
        Write-Host "ERROR: You must be on 'main' branch (currently on '$currentBranch')" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ On main branch" -ForegroundColor Green

    # Stage azure-iot-edge files and workflow
    Write-Host "Staging IoT Edge files..." -ForegroundColor Yellow
    git add azure-iot-edge/ .github/workflows/deploy-iot-edge.yml push-to-raspberry.ps1
    
    # Check if there are changes to commit
    $staged = git diff --cached --name-only
    if ($staged) {
        Write-Host "  Files staged:" -ForegroundColor Gray
        $staged | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }

        git commit -m "IoT Edge: update VXT orchestrator module"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Commit failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "✓ Committed to main" -ForegroundColor Green
    } else {
        Write-Host "✓ No new changes to commit" -ForegroundColor Green
    }

    # Pull latest main
    Write-Host "Pulling latest from main..." -ForegroundColor Yellow
    git pull origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to pull from main" -ForegroundColor Red
        exit 1
    }

    # Push main
    Write-Host "Pushing main..." -ForegroundColor Yellow
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to push main" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Pushed main" -ForegroundColor Green

    # Switch to prod
    Write-Host "Switching to prod..." -ForegroundColor Yellow
    git checkout prod
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to checkout prod" -ForegroundColor Red
        exit 1
    }

    # Pull latest prod
    git pull origin prod 2>$null

    # Merge main into prod
    Write-Host "Merging main into prod..." -ForegroundColor Yellow
    git merge main --no-edit
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Merge conflict! Resolve manually then push" -ForegroundColor Red
        Write-Host "Run: git merge --abort  (to cancel)" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✓ Merged main into prod" -ForegroundColor Green

    # Push prod (triggers GitHub Actions → build image → deploy to Edge)
    Write-Host "Pushing to prod (triggers CI/CD pipeline)..." -ForegroundColor Yellow
    git push origin prod
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to push to prod" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Pushed to prod" -ForegroundColor Green

    # Switch back to main
    git checkout main
    Write-Host "✓ Back on main branch" -ForegroundColor Green

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  ✓✓✓ CI/CD Pipeline Triggered!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  GitHub Actions will now:" -ForegroundColor Cyan
    Write-Host "    1. Build ARM64 Docker image (QEMU cross-build)" -ForegroundColor White
    Write-Host "    2. Push to ghcr.io/barakuziel-vxt/vxt-orchestrator" -ForegroundColor White
    Write-Host "    3. Deploy to IoT Edge device ($DEVICE_ID)" -ForegroundColor White
    Write-Host "    4. Edge agent on Pi pulls image & starts module" -ForegroundColor White
    Write-Host ""
    Write-Host "  Monitor:" -ForegroundColor Cyan
    Write-Host "    https://github.com/barakuziel-vxt/vxt/actions" -ForegroundColor Blue
    Write-Host ""

} else {
    # ── DIRECT DEPLOY: generate manifest and push to IoT Edge ───────────────

    Write-Host "Generating deployment manifest..." -ForegroundColor Yellow

    if (-not (Test-Path $TEMPLATE)) {
        Write-Host "ERROR: Template not found: $TEMPLATE" -ForegroundColor Red
        exit 1
    }

    # Read template and replace placeholders
    $manifest = Get-Content $TEMPLATE -Raw
    $manifest = $manifest -replace "__TAG__", $Tag

    # For direct deploy, remove registry credentials (use public or already-authed)
    # Replace credential placeholders with empty strings
    $manifest = $manifest -replace '\$GHCR_USERNAME', ""
    $manifest = $manifest -replace '\$GHCR_TOKEN', ""

    $deploymentFile = "$PSScriptRoot/deployment.generated.json"
    $manifest | Set-Content $deploymentFile -Encoding UTF8
    Write-Host "✓ Generated $deploymentFile" -ForegroundColor Green

    # Deploy to IoT Edge
    Write-Host "Deploying to IoT Edge device..." -ForegroundColor Yellow
    Write-Host "  az iot edge set-modules --hub-name $IOT_HUB --device-id $DEVICE_ID" -ForegroundColor Gray

    az iot edge set-modules `
        --hub-name $IOT_HUB `
        --device-id $DEVICE_ID `
        --content $deploymentFile

    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Deployment failed" -ForegroundColor Red
        Remove-Item $deploymentFile -ErrorAction SilentlyContinue
        exit 1
    }
    Write-Host "✓ Deployment sent to IoT Hub" -ForegroundColor Green

    # Clean up generated file
    Remove-Item $deploymentFile -ErrorAction SilentlyContinue

    # Verify
    Write-Host ""
    Write-Host "Verifying module status..." -ForegroundColor Yellow
    az iot hub module-identity list `
        --hub-name $IOT_HUB `
        --device-id $DEVICE_ID `
        --query "[].{Module:moduleId, State:connectionState}" `
        -o table

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  ✓✓✓ Deployed to Raspberry Pi!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  The Edge agent on halos.local will now:" -ForegroundColor Cyan
    Write-Host "    1. Pull ${IMAGE}:${Tag}" -ForegroundColor White
    Write-Host "    2. Start the vxt-orchestrator module" -ForegroundColor White
    Write-Host "    3. Connect as IoT Edge module (no connection string needed)" -ForegroundColor White
    Write-Host ""
    Write-Host "  Verify on Pi:" -ForegroundColor Cyan
    Write-Host "    ssh pi@halos.local 'sudo iotedge list'" -ForegroundColor Gray
    Write-Host "    ssh pi@halos.local 'sudo iotedge logs vxt-orchestrator'" -ForegroundColor Gray
    Write-Host ""
}
