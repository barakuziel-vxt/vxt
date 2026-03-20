#!/usr/bin/env pwsh
<#
.SYNOPSIS
Deploys Azure Function code to vxt-function app

.DESCRIPTION
Creates a zip package of function code and deploys it using az CLI

.EXAMPLE
.\deploy-function.ps1
#>

param(
    [string]$FunctionAppName = "vxt-function",
    [string]$ResourceGroup = "VXT-IoT-Hub",
    [string]$SourcePath = "c:\VXT\azure-functions"
)

Write-Host "========================================" -ForegroundColor Green
Write-Host "Azure Function Deployment Script" -ForegroundColor Green  
Write-Host "========================================" -ForegroundColor Green

Write-Host "`nTarget: $FunctionAppName (Resource Group: $ResourceGroup)" -ForegroundColor Cyan
Write-Host "Source: $SourcePath" -ForegroundColor Cyan

# Verify source files exist
if (-not (Test-Path "$SourcePath\function_app.py")) {
    Write-Host "ERROR: function_app.py not found at $SourcePath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "$SourcePath\requirements.txt")) {
    Write-Host "ERROR: requirements.txt not found at $SourcePath" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/3] Creating deployment package..." -ForegroundColor Yellow

$zipPath = "$SourcePath\function-deploy.zip"
$FilesToZip = @(
    "$SourcePath\function_app.py",
    "$SourcePath\requirements.txt",
    "$SourcePath\local.settings.json"
)

try {
    Compress-Archive -Path $FilesToZip -DestinationPath $zipPath -Force
    $zipSize = (Get-Item $zipPath).Length / 1KB
    Write-Host "[OK] Created $zipPath ($([math]::Round($zipSize, 2)) KB)" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to create zip: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/3] Deploying to Azure Function App..." -ForegroundColor Yellow

try {
    $output = az functionapp deployment source config-zip `
        --resource-group $ResourceGroup `
        --name $FunctionAppName `
        --src $zipPath 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Deployment successful" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Deployment output:" -ForegroundColor Yellow
        Write-Host $output
    }
} catch {
    Write-Host "[ERROR] Deployment failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/3] Restarting Function App..." -ForegroundColor Yellow

try {
    az functionapp restart --name $FunctionAppName --resource-group $ResourceGroup
    Write-Host "[OK] Function app restarted" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Restart may have failed: $_" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

Write-Host "`nTesting..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "`nFunction URL: https://$FunctionAppName.azurewebsites.net" -ForegroundColor Cyan
Write-Host "Status: Should now be running" -ForegroundColor Cyan
