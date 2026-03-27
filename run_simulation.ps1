#!/usr/bin/env pwsh
<#
.SYNOPSIS
Run telemetry simulation - sends 2 test messages to IoT Hub
.DESCRIPTION
This script sends 2 telemetry events to the Azure IoT Hub using TestDevice
and waits for the Azure Function to process them (5 second wait)
#>

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IoT Hub Telemetry Simulation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set device connection string (from environment or secure location)
if (-not $env:IOT_DEVICE_CONNECTION_STRING) {
    Write-Host "❌ Error: IOT_DEVICE_CONNECTION_STRING not set" -ForegroundColor Red
    Write-Host "Please set the environment variable or run: az iot device compute-derived-key --device-id TestDevice --hub-name VXT-IoT-Hub" -ForegroundColor Yellow
    exit 1
}
Write-Host "Using IOT_DEVICE_CONNECTION_STRING from environment" -ForegroundColor Green

Write-Host "Device: TestDevice" -ForegroundColor Green
Write-Host "Hub: VXT-IoT-Hub" -ForegroundColor Green
Write-Host "Messages: 2" -ForegroundColor Green
Write-Host ""

# Run the simulation
python test_function_trigger.py

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Simulation complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
