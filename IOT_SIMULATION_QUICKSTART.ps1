#!/usr/bin/env pwsh
<#
.SYNOPSIS
Quick start guide for IoT Hub telemetry simulation

.DESCRIPTION
This script provides step-by-step instructions for running the simulator
#>

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "IoT Hub Telemetry Simulator - Quick Start Guide" -ForegroundColor Cyan  
Write-Host "=" * 80 -ForegroundColor Cyan

Write-Host "`n[STEP 1] Get your IoT Hub device connection string" -ForegroundColor Yellow
Write-Host @"
Run this command in PowerShell:

  `$device = az iot hub device-identity connection-string show `
      --device-id TomerRefael `
      --hub-name vxt-hub `
      --resource-group VXT-IoT-Hub `
      --query "connectionString" -o tsv
  
  `$env:IOT_DEVICE_CONNECTION_STRING = `$device
  Write-Host "Connection string set: " + `$device.Substring(0, 50) + "..."

Alternatively, manually set it:
  - Go to: Azure Portal > vxt-hub > Devices > TomerRefael
  - Copy: Connection string (primary key)
  - Run: `$env:IOT_DEVICE_CONNECTION_STRING = "<paste_here>"

"@ -ForegroundColor Gray

Write-Host "`n[STEP 2] Run the Python simulator" -ForegroundColor Yellow
Write-Host @"
  python simulate_iot_hub_telemetry.py

Expected output:
  ======================================================================
  Starting IoT Hub Telemetry Simulation
  Duration: 5 minutes
  Event interval: 10 seconds
  Events expected: 30
  This will trigger Azure Function: vxt-function
  Data destination: EntityTelemetry table
  ======================================================================
  
  ✓ Connected to IoT Hub as device: TomerRefael
  [   1] Sent SignalK event → Position: 32.832891°N, 35.003812°E
  [   2] Sent SignalK event → Position: 32.832901°N, 35.003845°E
  ...
  [  30] Sent SignalK event → Position: 32.833421°N, 35.004156°E
  
  Total events sent: 30
  Check EntityTelemetry table for new data

"@ -ForegroundColor Gray

Write-Host "`n[STEP 3] Verify simulation results" -ForegroundColor Yellow
Write-Host @"
Check Azure Function logs:
  az functionapp log tail --name vxt-function --resource-group VXT-IoT-Hub

Expected log entries:
  - "Processing telemetry event"
  - "Successfully inserted X records into EntityTelemetry"

Query the data in SQL:
  mssql-cli -S vxtdb.database.windows.net -d free-sql-db-5949639 -u vxt
  SELECT TOP 10 * FROM EntityTelemetry ORDER BY timestamp DESC

Check new records count:
  SELECT COUNT(*) FROM EntityTelemetry 
  WHERE timestamp > GETUTCDATE() - INTERVAL '10' MINUTE

"@ -ForegroundColor Gray

Write-Host "`n" -ForegroundColor Cyan
Write-Host "Ready to start? Follow these steps:" -ForegroundColor Green
Write-Host "  1. Copy your IoT Hub device connection string (see STEP 1)" -ForegroundColor Green
Write-Host "  2. Run: python simulate_iot_hub_telemetry.py" -ForegroundColor Green  
Write-Host "  3. Wait 5 minutes for events to process" -ForegroundColor Green
Write-Host "  4. Check EntityTelemetry table for new data" -ForegroundColor Green
Write-Host "`n" * 2

Write-Host "For troubleshooting, see: iot-hub-simulation-setup.md" -ForegroundColor Gray
