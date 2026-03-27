#!/usr/bin/env pwsh

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IoT Hub Telemetry Simulation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""


# Set device connection string directly (no env needed)
$env:IOT_DEVICE_CONNECTION_STRING = "REDACTED"
Write-Host "Using hardcoded IOT_DEVICE_CONNECTION_STRING for TestDevice" -ForegroundColor Green


Write-Host "Entities: 234567890, 234567891" -ForegroundColor Green
Write-Host "Hub: VXT-IoT-Hub" -ForegroundColor Green
Write-Host "Messages per entity: 5" -ForegroundColor Green
Write-Host "Total messages: 10" -ForegroundColor Green
Write-Host ""

# Run the simulation
python test_function_trigger.py

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Simulation complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
