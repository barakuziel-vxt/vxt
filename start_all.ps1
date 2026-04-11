# YachtSense AI - Full Stack Startup Script
# NOTE: Docker containers (SQL Server + Redpanda) must already be running.
#       Run 'docker-compose up -d' and 'setup_database_once.ps1' first if needed.
Write-Host "Starting YachtSense AI Infrastructure..." -ForegroundColor Cyan

# 1. Create Kafka Topic
#Write-Host "[1/4] Configuring Kafka Topics..." -ForegroundColor Yellow
# Create Kafka functions
#.\.venv\Scripts\python.exe create_generate_terra_json_function.py

# 2. Launch Backend Services in separate windows
Write-Host "[1/4] Launching Subscription Analysis Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe subscription_analysis_worker.py" -WindowStyle Normal

Write-Host "[2.5/4] Launching Telemetry Consumers and Simulators..." -ForegroundColor Yellow
# One consumer process per active provider (Junction + SamsungHealth)
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe generic_telemetry_consumer.py Junction" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe generic_telemetry_consumer.py SamsungHealth" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe generic_telemetry_consumer.py N2KToSignalK" -WindowStyle Normal
# Launch Simulators
#Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe Simulate_Junction_health_provider_Barak.py" -WindowStyle Normal
#Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe Simulate_Junction_health_provider_Shula.py" -WindowStyle Normal
#Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe simulate_signalk_vessel.py" -WindowStyle Normal

# 3. Launch FastAPI Web Server
Write-Host "[3/4] Starting FastAPI API..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe main.py" -WindowStyle Normal

# 4. Launch Admin Dashboard
Write-Host "[4/4] Starting Admin Management Dashboard..." -ForegroundColor Yellow
Push-Location
Set-Location ./admin-dashboard
if (!(Test-Path "node_modules")) {
    Write-Host "Installing admin-dashboard dependencies (npm install)..." -ForegroundColor Yellow
    npm install
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev -- --host 0.0.0.0" -WindowStyle Normal
Pop-Location

Write-Host "All systems are booting up. Check individual windows for logs." -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "Running Services:" -ForegroundColor Cyan
Write-Host "  - Subscription Analysis Worker: Running (processes subscriptions every 5 min)" -ForegroundColor Yellow
Write-Host "  - IoT Consumers      : generic_telemetry_consumer.py Junction + SamsungHealth + N2KToSignalK" -ForegroundColor Yellow
Write-Host "  - Simulators         : Generating SignalK maritime + Junction health data" -ForegroundColor Yellow
Write-Host "" -ForegroundColor Green
Write-Host "Dashboard URLs:" -ForegroundColor Cyan
Write-Host "  - Admin Dashboard (Local)  : http://localhost:3002" -ForegroundColor Yellow
Write-Host "  - Admin Dashboard (Network): http://192.168.1.22:3002 (or your PC's IP)" -ForegroundColor Yellow
Write-Host "  - FastAPI Docs             : http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "  - Redpanda Console         : http://localhost:8080" -ForegroundColor Yellow