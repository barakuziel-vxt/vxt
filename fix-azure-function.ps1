#!/usr/bin/env pwsh
<#
.SYNOPSIS
Azure Function Configuration Fix Script
Applies all critical settings to vxt-function app to enable IoT Hub trigger

.DESCRIPTION
This script configures:
1. IoTHubConnectionString - Connection to Azure IoT Hub
2. SQL_CONNECTION_STRING - Connection to Azure SQL database
3. Database credentials - DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD
4. Function settings - PROVIDER_NAME

.PARAMETER ResourceGroup
The Azure resource group name (default: VXT-IoT-Hub)

.PARAMETER FunctionAppName
The Azure function app name (default: vxt-function)

.PARAMETER IoTHubKey
The IoT Hub shared access key (default: fWmQKA04f6DhGHrMLxPYM6eY7PkNmRAjnAIoTH2GGF8=)

.PARAMETER DatabasePassword
The database password for user 'vxt' (default: Barak1976!)

.EXAMPLE
./fix-azure-function.ps1 -ResourceGroup VXT-IoT-Hub -FunctionAppName vxt-function

.NOTES
Run this script from the project root directory
Requires: Azure CLI (az command) installed and authenticated
#>

param(
    [string]$ResourceGroup = "VXT-IoT-Hub",
    [string]$FunctionAppName = "vxt-function",
    [string]$IoTHubKey = "fWmQKA04f6DhGHrMLxPYM6eY7PkNmRAjnAIoTH2GGF8=",
    [string]$DatabasePassword = "Barak1976!"
)

# Colors for output
$GREEN = "`e[32m"
$YELLOW = "`e[33m"
$RED = "`e[31m"
$RESET = "`e[0m"

function Write-Success { Write-Host "$GREEN[✓]$RESET $args" }
function Write-Warning { Write-Host "$YELLOW[!]$RESET $args" }
function Write-Error { Write-Host "$RED[✗]$RESET $args" }

Write-Host "`n=== Azure Function Configuration Fix ===" -ForegroundColor Cyan
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Function App: $FunctionAppName`n"

# Check if Azure CLI is installed
try {
    $version = az --version 2>&1 | Select-Object -First 1
    Write-Success "Azure CLI is installed: $version"
} catch {
    Write-Error "Azure CLI not found. Please install it first: https://aka.ms/azure-cli"
    exit 1
}

# Check if resource group exists
Write-Host "`n--- Checking resource group ---"
try {
    $rg = az group show --name $ResourceGroup --query name -o tsv 2>&1
    Write-Success "Resource group found: $rg"
} catch {
    Write-Error "Resource group not found: $ResourceGroup"
    exit 1
}

# Check if function app exists
Write-Host "`n--- Checking function app ---"
try {
    $fnapp = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup --query name -o tsv 2>&1
    Write-Success "Function app found: $fnapp"
} catch {
    Write-Error "Function app not found: $FunctionAppName"
    exit 1
}

# Define settings to apply
$settings = @{
    "IoTHubConnectionString" = "HostName=vxt-iot-hub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=$IoTHubKey"
    "SQL_CONNECTION_STRING" = "Server=vxtdb.database.windows.net;Database=free-sql-db-5949639;User=vxt;Password=$DatabasePassword;Encrypt=true;TrustServerCertificate=false;Connection Timeout=30;"
    "DB_SERVER" = "vxtdb.database.windows.net"
    "DB_NAME" = "free-sql-db-5949639"
    "DB_USER" = "vxt"
    "DB_PASSWORD" = $DatabasePassword
    "PROVIDER_NAME" = "N2KToSignalK"
}

# Apply each setting
Write-Host "`n--- Applying application settings ---"
$successCount = 0
$failureCount = 0

foreach ($key in $settings.Keys) {
    $value = $settings[$key]
    
    # Mask sensitive values in output
    $displayValue = if ($key -match "Password|Key|String") {
        $value.Substring(0, [Math]::Min(20, $value.Length)) + "..."
    } else {
        $value
    }
    
    try {
        Write-Host "Setting: $key = $displayValue"
        az functionapp config appsettings set `
            --name $FunctionAppName `
            --resource-group $ResourceGroup `
            --settings "$key=$value" `
            -o none 2>&1
        
        Write-Success "  ✓ Applied"
        $successCount++
    } catch {
        Write-Error "  ✗ Failed: $_"
        $failureCount++
    }
}

# Display summary
Write-Host "`n--- Configuration Summary ---"
Write-Host "Settings applied successfully: $successCount/$($settings.Count)"
if ($failureCount -gt 0) {
    Write-Warning "Settings with errors: $failureCount"
}

# Verify all settings were applied
Write-Host "`n--- Verifying settings ---"
try {
    $appliedSettings = az functionapp config appsettings list `
        --name $FunctionAppName `
        --resource-group $ResourceGroup `
        -o json | ConvertFrom-Json
    
    Write-Success "Current application settings:"
    foreach ($item in $appliedSettings) {
        if ($item.name -match "IoTHub|SQL_|DB_|PROVIDER") {
            $displayValue = if ($item.name -match "Password|Key|String") {
                $item.value.Substring(0, [Math]::Min(20, $item.value.Length)) + "..."
            } else {
                $item.value
            }
            Write-Host "  ✓ $($item.name) = $displayValue"
        }
    }
} catch {
    Write-Error "Failed to verify settings: $_"
}

# Next steps
Write-Host "`n--- Next Steps ---"
Write-Host "1. Configure IoT Hub Message Routing:"
Write-Host "   Azure Portal → vxt-iot-hub → Message Routing → Routes"
Write-Host "   Create route: telemetry-consumer → vxt-function endpoint"
Write-Host ""
Write-Host "2. Test the function:"
Write-Host "   az functionapp log tail --name $FunctionAppName --resource-group $ResourceGroup"
Write-Host ""
Write-Host "3. Send test message to IoT Hub:"
Write-Host "   az iot device send-d2c-message --hub-name vxt-iot-hub --device-id test-device --data '{""temperature"": 25.5}'"
Write-Host ""
Write-Host "For detailed steps, see: docs/AZURE_FUNCTION_FIX_IMPLEMENTATION.md"

Write-Host "`n=== Configuration Complete ===" -ForegroundColor Green
