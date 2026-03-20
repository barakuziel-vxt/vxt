#!/bin/bash
set -e

echo "===== VXT API STARTUP SCRIPT ====="
echo "Python version:"
python --version
echo ""

# Install ODBC Driver 17 for SQL Server (required for pyodbc on Azure App Service)
echo "Installing ODBC Driver 17 for SQL Server..."
apt-get update -y
apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    apt-transport-https \
    ca-certificates \
    unixodbc \
    unixodbc-dev

# Add Microsoft repository key
curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - 2>/dev/null || true

# Add Microsoft repository for Debian
curl https://packages.microsoft.com/config/debian/11/prod.list | tee /etc/apt/sources.list.d/mssql-release.list 2>/dev/null || true

# Install ODBC Driver 17 with ACCEPT_EULA
apt-get update -y
ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql17 2>/dev/null || true

echo "ODBC Driver installation completed"
echo ""

echo "Current directory: $(pwd)"
echo "Files in directory:"
ls -la | grep -E "^-" | head -20
echo ""

echo "Installing/Verifying dependencies from requirements.txt..."
pip install -q -r requirements.txt

echo ""
echo "Dependency check:"
python -c "import fastapi; import pyodbc; import uvicorn; print('[OK] All dependencies loaded including pyodbc')" 2>&1

echo ""
echo "Available ODBC drivers:"
odbcinst -q -d -n ODBC* || echo "    [Note: ODBC drivers will be available at runtime]"
echo ""

echo "Starting FastAPI application with Uvicorn..."
echo "Listening on 0.0.0.0:8000"
echo "===== Starting server ====="
exec uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
