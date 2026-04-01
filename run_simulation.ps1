#!/usr/bin/env pwsh
<#
.SYNOPSIS
Run telemetry simulation - sends both SignalK and Junction events to IoT Hub
.DESCRIPTION
This script sends telemetry events to the Azure IoT Hub using TestDevice:
  - SignalK maritime events (navigation, propulsion, environment, tanks)
  - Junction health events (heart rate, blood pressure, body weight from 2 users)

Both simulators run in parallel and wait for the Azure Function to process them.
#>

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IoT Hub Telemetry Simulation (SignalK + Junction)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set device connection string (from environment or secure location)
if (-not $env:IOT_DEVICE_CONNECTION_STRING) {
    Write-Host "❌ Error: IOT_DEVICE_CONNECTION_STRING not set" -ForegroundColor Red
    Write-Host "Please set the environment variable before running this script" -ForegroundColor Yellow
    exit 1
}
Write-Host "Using IOT_DEVICE_CONNECTION_STRING from environment" -ForegroundColor Green

Write-Host "Device: TestDevice" -ForegroundColor Green
Write-Host "Hub: VXT-IoT-Hub" -ForegroundColor Green
Write-Host "Simulations: SignalK (maritime) + Junction (health)" -ForegroundColor Green
Write-Host ""

# Launch simulators sequentially (Azure IoT Hub doesn't allow simultaneous device connections)
Write-Host "[1/3] Launching SignalK simulator..." -ForegroundColor Yellow
python test_function_trigger.py

Write-Host ""
Write-Host "[2/3] Waiting 10 seconds before Junction simulator (allow device reconnection)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "[3/3] Launching Junction simulator..." -ForegroundColor Yellow
python test_junction_trigger.py

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Simulation complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
