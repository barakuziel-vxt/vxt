#!/usr/bin/env pwsh
<#
.SYNOPSIS
Configure Azure Function App Settings for vxt-function

.DESCRIPTION
This script sets up all required environment variables for the Azure Function App.
Run this after deployment to configure the function properly.

.EXAMPLE
.\setup_function_config.ps1 -IotHubConnectionString "HostName=...;SharedAccessKey=..."
#>

param(
    [Parameter(Mandatory=$true, HelpMessage="IoT Hub connection string (get from Azure Portal)")]
    [string]$IotHubConnectionString,
    
    [Parameter(Mandatory=$false)]
    [string]$FunctionAppName = "vxt-function",
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "VXT-IoT-Hub",
    
    [Parameter(Mandatory=$false)]
    [string]$DbServer = "vxtdb.database.windows.net",
    
    [Parameter(Mandatory=$false)]
    [string]$DbName = "free-sql-db-5949639",
    
    [Parameter(Mandatory=$false)]
    [string]$DbUser = "vxt",
    
    [Parameter(Mandatory=$false)]
    [string]$DbPassword = "Barak1976!",
    
    [Parameter(Mandatory=$false)]
    [string]$ProviderName = "N2KToSignalK"
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Azure Function Configuration Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Validate IoT Hub connection string format
if (-not ($IotHubConnectionString -match 'HostName=.*?;.*?SharedAccessKey=.*')) {
    Write-Host "ERROR: Invalid IoT Hub connection string format" -ForegroundColor Red
    Write-Host "Expected format: HostName=...;SharedAccessKeyName=service;SharedAccessKey=..." -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Checking Azure CLI login..." -ForegroundColor Yellow
try {
    $account = az account show -o json | ConvertFrom-Json
    Write-Host "✓ Logged in as: $($account.user.name)" -ForegroundColor Green
} catch {
    Write-Host "✗ Not logged in to Azure. Run 'az login' first" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Verifying Function App exists..." -ForegroundColor Yellow
try {
    $app = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup -o json 2>$null | ConvertFrom-Json
    Write-Host "✓ Function App found: $($app.name)" -ForegroundColor Green
} catch {
    Write-Host "✗ Function App '$FunctionAppName' not found in resource group '$ResourceGroup'" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Setting application configuration..." -ForegroundColor Yellow
Write-Host "  Setting: DB_SERVER" -ForegroundColor Cyan
Write-Host "  Setting: DB_NAME" -ForegroundColor Cyan
Write-Host "  Setting: DB_USER" -ForegroundColor Cyan
Write-Host "  Setting: DB_PASSWORD" -ForegroundColor Cyan
Write-Host "  Setting: IoTHubConnectionString" -ForegroundColor Cyan
Write-Host "  Setting: PROVIDER_NAME" -ForegroundColor Cyan

try {
    az functionapp config appsettings set `
        --resource-group $ResourceGroup `
        --name $FunctionAppName `
        --settings `
            DB_SERVER=$DbServer `
            DB_NAME=$DbName `
            DB_USER=$DbUser `
            DB_PASSWORD=$DbPassword `
            IoTHubConnectionString=$IotHubConnectionString `
            PROVIDER_NAME=$ProviderName `
            FUNCTIONS_WORKER_RUNTIME="python" | Out-Null
    
    Write-Host "✓ Configuration applied successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Error setting configuration: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 4: Verifying configuration..." -ForegroundColor Yellow
try {
    $settings = az functionapp config appsettings list --resource-group $ResourceGroup --name $FunctionAppName -o json | ConvertFrom-Json
    
    $requiredSettings = @('DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'IoTHubConnectionString', 'PROVIDER_NAME')
    $allSet = $true
    
    foreach ($setting in $requiredSettings) {
        $value = $settings | Where-Object { $_.name -eq $setting } | Select-Object -First 1
        if ($value) {
            Write-Host "✓ $($setting): SET" -ForegroundColor Green
        } else {
            Write-Host "✗ $($setting): NOT SET" -ForegroundColor Red
            $allSet = $false
        }
    }
    
    if ($allSet) {
        Write-Host ""
        Write-Host "✓✓✓ All settings configured successfully! ✓✓✓" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. The Azure Function will restart automatically with new settings"
        Write-Host "2. Test health endpoint: curl https://$FunctionAppName.azurewebsites.net/api/health"
        Write-Host "3. Run IoT Hub simulation: python simulate_iot_hub_telemetry.py"
        Write-Host "4. Check database for new telemetry: SELECT COUNT(*) FROM EntityTelemetry"
    } else {
        Write-Host ""
        Write-Host "✗ Some settings were not applied properly" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Error verifying configuration: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Configuration Complete" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
