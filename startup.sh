#!/bin/bash
set -e

echo "[VXT] Starting application..."
python --version
echo ""

# Install minimal system packages for unixodbc and ODBC Driver 17
echo "[VXT] Attempting to install ODBC driver and dependencies..."
apt-get update -y 2>/dev/null || true
apt-get install -y --no-install-recommends curl gnupg apt-transport-https ca-certificates unixodbc unixodbc-dev 2>/dev/null || true

# Try installing ODBC Driver 17 (non-blocking on failure)
echo "[VXT] Setting up Microsoft ODBC repository..."
(
    curl -s https://packages.microsoft.com/keys/microsoft.asc 2>/dev/null | apt-key add - 2>/dev/null || true
    curl -s https://packages.microsoft.com/config/debian/11/prod.list 2>/dev/null | tee /etc/apt/sources.list.d/mssql-release.list 2>/dev/null || true
) || true

apt-get update 2>/dev/null || true
ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql17 2>/dev/null || true

echo "[VXT] ODBC driver setup completed (errors ignored if already present or unavailable)"
echo ""

echo "[VXT] Installing Python dependencies..."
pip install -q -r requirements.txt

echo "[VXT] Starting FastAPI application..."
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
