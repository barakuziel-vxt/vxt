#!/bin/bash
set -e

# Azure App Service startup script for Python FastAPI app
# This script runs ONCE when the app starts, before gunicorn is launched

echo "=========================================="
echo "🚀 VXT Web App Startup ($(date))"
echo "=========================================="

# Step 1: Verify we're in the right directory
echo "[1/5] Checking working directory..."
pwd
ls -la main.py 2>/dev/null && echo "✓ Found main.py" || echo "✗ main.py not found!"

# Step 2: Clean up old SQL drivers
echo "[2/5] Removing old SQL drivers..."
pip uninstall -y pymssql pyodbc 2>/dev/null || echo "  (no old drivers to remove)"
echo "✓ Old drivers removed"

# Step 3: Upgrade pip and install dependencies
echo "[3/5] Installing Python dependencies..."
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
echo "✓ Dependencies installed"

# Step 4: Verify mssql-python is installed
echo "[4/5] Verifying mssql-python installation..."
python -c "from mssql_python import connect; print('✓ mssql-python imported successfully')" || {
  echo "✗ mssql-python import failed!"
  exit 1
}

# Step 5: Start the application
echo "[5/5] Starting Gunicorn (workers=4)..."
echo "=========================================="
echo "🎯 App is now ready to accept requests"
echo "=========================================="

# Use exec to replace the shell with gunicorn (so it receives signals directly)
exec gunicorn \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 60 \
  --access-logfile - \
  --error-logfile - \
  main:app
