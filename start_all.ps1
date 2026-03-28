# YachtSense AI - Full Stack Startup Script
Write-Host "Starting YachtSense AI Infrastructure..." -ForegroundColor Cyan

# 1. Start Docker Containers
Write-Host "[1/7] Starting Docker Containers (SQL Server 2022 & Redpanda)..." -ForegroundColor Yellow
docker-compose up -d

# 2. Wait for Infrastructure to be ready
Write-Host "[2/7] Waiting for SQL Server and Redpanda to initialize (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Health check for Redpanda availability
Write-Host "[2.5/7] Checking Redpanda broker connectivity..." -ForegroundColor Yellow
$maxRetries = 10
$retries = 0
while ($retries -lt $maxRetries) {
    try {
        $result = docker exec yacht-broker rpk broker info 2>&1
        if ($result -match "version") {
            Write-Host "[OK] Redpanda broker is ready" -ForegroundColor Green
            break
        }
    } catch { }
    $retries++
    if ($retries -lt $maxRetries) {
        Write-Host "Waiting for broker readiness... ($retries/$maxRetries)" -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}

# 3. Create Kafka Topic
Write-Host "[3/7] Configuring Kafka Topics..." -ForegroundColor Yellow
# Create Kafka functions
.\.venv\Scripts\python.exe create_generate_terra_json_function.py

# 4. Launch Backend Services in separate windows
Write-Host "[4/7] Launching Subscription Analysis Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe subscription_analysis_worker.py" -WindowStyle Normal

Write-Host "[4.5/7] Launching Consumers (uses same logic as Azure Function) and Simulators..." -ForegroundColor Yellow
# Single source of truth: run_consumer_local.py imports SimpleEventProcessor from azure-functions/function_app.py
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe run_consumer_local.py N2KToSignalK" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe run_consumer_local.py Junction" -WindowStyle Normal
# Launch Simulators
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe Simulate_Junction_health_provider_Barak.py" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe Simulate_Junction_health_provider_Shula.py" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe simulate_signalk_vessel.py" -WindowStyle Normal

# 5. Launch FastAPI Web Server
Write-Host "[5/7] Starting FastAPI API..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe main.py" -WindowStyle Normal

# 6. Launch Admin Dashboard
Write-Host "[6/7] Starting Admin Management Dashboard..." -ForegroundColor Yellow
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
Write-Host "  - SignalK Consumer   : run_consumer_local.py N2KToSignalK  -> azure-functions/function_app.py" -ForegroundColor Yellow
Write-Host "  - Junction Consumer  : run_consumer_local.py Junction       -> azure-functions/function_app.py" -ForegroundColor Yellow
Write-Host "  - Simulators         : Generating SignalK maritime + Junction health data" -ForegroundColor Yellow
Write-Host "" -ForegroundColor Green
Write-Host "Dashboard URLs:" -ForegroundColor Cyan
Write-Host "  - Admin Dashboard (Local)  : http://localhost:3002" -ForegroundColor Yellow
Write-Host "  - Admin Dashboard (Network): http://192.168.1.29:3002 (or your PC's IP)" -ForegroundColor Yellow
Write-Host "  - FastAPI Docs             : http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "  - Redpanda Console         : http://localhost:8080" -ForegroundColor Yellow