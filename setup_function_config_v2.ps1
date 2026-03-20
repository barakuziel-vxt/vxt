#!/usr/bin/env pwsh
param(
    [Parameter(Mandatory=$true)]
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

# Validate connection string
if (-not ($IotHubConnectionString -match 'HostName=.*?;.*?SharedAccessKey=.*')) {
    Write-Host "ERROR: Invalid IoT Hub connection string format" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration Parameters:" -ForegroundColor Yellow
Write-Host "  Function App: $FunctionAppName"
Write-Host "  Resource Group: $ResourceGroup"
Write-Host "  DB Server: $DbServer"
Write-Host "  DB Name: $DbName"
Write-Host "  DB User: $DbUser"
Write-Host "  IoT Hub Connection: HostName=VXT-IoT-Hub.azure-devices.net;..."
Write-Host ""

Write-Host "Step 1: Validating Azure authentication..." -ForegroundColor Yellow
try {
    $user = az account show --query "user.name" -o tsv 2>$null
    if (-not $user) {
        Write-Host "ERROR: Not logged in to Azure" -ForegroundColor Red
        Write-Host "Run: az login" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✓ Authenticated as: $user" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Checking if function app exists..." -ForegroundColor Yellow
try {
    $app = az functionapp show --resource-group $ResourceGroup --name $FunctionAppName -o json 2>$null | ConvertFrom-Json
    if ($app) {
        Write-Host "✓ Found function app: $($app.name)" -ForegroundColor Green
    }
    else {
        Write-Host "ERROR: Function app not found" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Setting configuration values..." -ForegroundColor Yellow
try {
    $settings = @(
        "DB_SERVER=$DbServer",
        "DB_NAME=$DbName",
        "DB_USER=$DbUser",
        "DB_PASSWORD=$DbPassword",
        "IoTHubConnectionString=$IotHubConnectionString",
        "PROVIDER_NAME=$ProviderName"
    )
    
    Write-Host "  Setting 6 environment variables..."
    az functionapp config appsettings set --resource-group $ResourceGroup --name $FunctionAppName --settings $settings -o none
    Write-Host "✓ All settings applied" -ForegroundColor Green
}
catch {
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
        }
        else {
            Write-Host "✗ $($setting): NOT SET" -ForegroundColor Red
            $allSet = $false
        }
    }
    
    if ($allSet) {
        Write-Host ""
        Write-Host "✓✓✓ All settings configured successfully! ✓✓✓" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. The Azure Function will restart automatically"
        Write-Host "2. Run IoT Hub simulation: python simulate_iot_hub_telemetry.py"
        Write-Host "3. Check database: SELECT COUNT(*) FROM EntityTelemetry"
    }
    else {
        Write-Host ""
        Write-Host "✗ Some settings were not applied properly" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "✗ Error verifying configuration: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Configuration Complete" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
