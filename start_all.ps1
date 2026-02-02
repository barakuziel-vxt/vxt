# YachtSense AI - Full Stack Startup Script
Write-Host "Starting YachtSense AI Infrastructure..." -ForegroundColor Cyan

# 1. Start Docker Containers
Write-Host "[1/7] Starting Docker Containers (SQL Edge & Redpanda)..." -ForegroundColor Yellow
docker-compose up -d

# 2. Wait for Infrastructure to be ready
Write-Host "[2/7] Waiting for services to initialize (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# 3. Create Kafka Topic
Write-Host "[3/7] Configuring Kafka Topics..." -ForegroundColor Yellow
# Use the workspace virtual environment Python to ensure required packages are available
.\.venv\Scripts\python.exe create_topic_boat-telemetry.py
.\.venv\Scripts\python.exe Create_topic_terra-health-vitals.py

# Create Kafka functions
.\.venv\Scripts\python.exe create_generate_terra_json_function.py

# 4. Launch Backend Services in separate windows
Write-Host "[4/7] Launching Consumer and Simulator..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe consumer_boatTelemetry.py" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe consumer_HealthVitals.py" -WindowStyle Normal

# Launch Simulators
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe simulate_boat_234567890.py" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe simulate_boat_234567891.py" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe simulate_cardiac_issue_033114870.py" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe simulate_healthy_person_033114869.py" -WindowStyle Normal

# 5. Launch FastAPI Web Server
Write-Host "[5/7] Starting FastAPI API..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe main.py" -WindowStyle Normal

# 6. Launch React boat-dashboard
#Write-Host "[6/7] Starting React boat-dashboard..." -ForegroundColor Yellow
#Set-Location ./boat-dashboard
#Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WindowStyle Normal

# 7. Launch Health Dashboard
Write-Host "[7/7] Starting Health Dashboard..." -ForegroundColor Yellow
# From the boat-dashboard folder, move up and into health-dashboard then install deps (if needed) and start it
Push-Location
Set-Location ./health-dashboard
if (!(Test-Path "node_modules")) {
    Write-Host "Installing health-dashboard dependencies (npm install)..." -ForegroundColor Yellow
    npm install
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WindowStyle Normal
Pop-Location

Write-Host "All systems are booting up. Check individual windows for logs." -ForegroundColor Green