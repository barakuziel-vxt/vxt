#!/usr/bin/env pwsh
<#
.SYNOPSIS
Azure IoT Hub Telemetry Simulator - Setup and Run

.DESCRIPTION
Fetches IoT Hub device connection string and runs SignalK event simulation
to test end-to-end data flow through Azure Function to EntityTelemetry table

.EXAMPLE
.\run_iot_simulation.ps1
#>

param(
    [string]$DeviceId = "TomerRefael",
    [string]$HubName = "vxt-hub",
    [string]$ResourceGroup = "VXT-IoT-Hub",
    [int]$DurationMinutes = 5,
    [int]$IntervalSeconds = 10
)

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "Azure IoT Hub Telemetry Simulator Setup" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan

# Step 1: Get device connection string
Write-Host "`n[Step 1] Retrieving IoT Hub device connection string..."
try {
    $connectionString = az iot hub device-identity connection-string show `
        --device-id $DeviceId `
        --hub-name $HubName `
        --resource-group $ResourceGroup `
        --query "connectionString" -o tsv `
        2>$null
    
    if (-not $connectionString) {
        Write-Host "✗ Device not found. Creating device: $DeviceId" -ForegroundColor Yellow
        az iot hub device-identity create `
            --device-id $DeviceId `
            --hub-name $HubName `
            --resource-group $ResourceGroup `
            --auth-method shared_private_key | Out-Null
        
        $connectionString = az iot hub device-identity connection-string show `
            --device-id $DeviceId `
            --hub-name $HubName `
            --resource-group $ResourceGroup `
            --query "connectionString" -o tsv
    }
    
    Write-Host "✓ Device connection string retrieved" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to get connection string: $_" -ForegroundColor Red
    Write-Host "`nMake sure you have:" -ForegroundColor Yellow
    Write-Host "  1. Azure CLI installed: https://aka.ms/azure-cli-install"
    Write-Host "  2. Signed in to Azure: az login"
    Write-Host "  3. Correct resource group and hub name"
    exit 1
}

# Step 2: Verify Python environment
Write-Host "`n[Step 2] Checking Python environment..."
$pythonVersion = python --version 2>$null
if (-not $pythonVersion) {
    Write-Host "✗ Python not found in PATH" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green

# Step 3: Install Azure SDK if needed
Write-Host "`n[Step 3] Ensuring Azure SDK is installed..."
$packages = @("azure-iot-device", "azure-storage-blob")
pip show azure-iot-device >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing required packages..."
    pip install azure-iot-device --quiet
}
Write-Host "✓ Required packages installed" -ForegroundColor Green

# Step 4: Run simulation
Write-Host "`n[Step 4] Starting telemetry simulation..." -ForegroundColor Cyan
Write-Host "Duration: $DurationMinutes minutes" -ForegroundColor Gray
Write-Host "Interval: $IntervalSeconds seconds" -ForegroundColor Gray
Write-Host "Expected events: $(($DurationMinutes * 60) / $IntervalSeconds) events" -ForegroundColor Gray

$env:IOT_DEVICE_CONNECTION_STRING = $connectionString

python simulate_iot_hub_telemetry.py

$exitCode = $LASTEXITCODE
Write-Host "`n[Complete] Simulation finished with exit code: $exitCode" -ForegroundColor Cyan

if ($exitCode -eq 0) {
    Write-Host "`nNext Steps:" -ForegroundColor Green
    Write-Host "  1. Check Azure Functions logs:"
    Write-Host "     az functionapp log tail --name vxt-function --resource-group VXT-IoT-Hub"
    Write-Host "  2. Query EntityTelemetry table for new data:"
    Write-Host "     mssql-cli -S vxtdb.database.windows.net -d free-sql-db-5949639 -u vxt"
    Write-Host "     SELECT TOP 10 * FROM EntityTelemetry ORDER BY timestamp DESC"
}

exit $exitCode
