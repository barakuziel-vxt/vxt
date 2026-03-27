#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run telemetry simulation by sending events to Azure IoT Hub
    
.DESCRIPTION
    This script sends test telemetry events to the Azure IoT Hub, which are then 
    processed by the Azure Function and stored in the database.
    
.PARAMETER DeviceConnectionString
    The Azure IoT Hub device connection string
    Format: HostName=<hub>.azure-devices.net;DeviceId=<device>;SharedAccessKey=<key>
#>

param(
    [Parameter(Mandatory=$true, HelpMessage="Azure IoT Hub device connection string")]
    [string]$DeviceConnectionString
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $projectRoot

try {
    # Validate connection string
    if ($DeviceConnectionString -notmatch "HostName=.*;DeviceId=.*") {
        Write-Error "Invalid connection string format"
        exit 1
    }

    Write-Host "Starting Telemetry Simulation" -ForegroundColor Cyan
    Write-Host "Project: $projectRoot" -ForegroundColor Gray

    # Set environment variable
    $env:IOT_DEVICE_CONNECTION_STRING = $DeviceConnectionString

    # Run Python script
    Write-Host "Sending telemetry events..." -ForegroundColor Yellow
    python test_function_trigger.py
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Simulation completed successfully" -ForegroundColor Green
    } else {
        Write-Host "Simulation failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
    Remove-Item env:IOT_DEVICE_CONNECTION_STRING -ErrorAction SilentlyContinue
}
