#!/bin/bash
set -e

echo "[VXT] Starting application..."
python --version
echo ""

# Install ODBC Driver 17 for SQL Server - critical for Managed Identity auth
echo "[VXT] Installing ODBC Driver 17 for SQL Server..."
apt-get update -y 2>/dev/null || true
apt-get install -y --no-install-recommends curl gnupg apt-transport-https ca-certificates unixodbc unixodbc-dev 2>/dev/null || true

# Add Microsoft ODBC repository
echo "[VXT] Adding Microsoft ODBC repository..."
(
    curl -m 10 https://packages.microsoft.com/keys/microsoft.asc 2>/dev/null | apt-key add - 2>/dev/null || true
    curl -m 10 https://packages.microsoft.com/config/debian/11/prod.list 2>/dev/null | tee /etc/apt/sources.list.d/mssql-release.list 2>/dev/null || true
) || true

apt-get update 2>/dev/null || true
ACCEPT_EULA=Y timeout 60 apt-get install -y --no-install-recommends msodbcsql17 2>/dev/null || true

echo "[VXT] ODBC setup completed"
echo ""

echo "[VXT] Installing Python dependencies..."
pip install -q -r requirements.txt

echo "[VXT] Starting FastAPI application with Managed Identity..."
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
