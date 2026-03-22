#!/bin/bash
set -e

# Minimal startup script - focus on reliability, not verbosity
echo "[STARTUP] VXT Web App initializing..."

# Uninstall old drivers silently (with timeout to prevent hangs)
echo "[STARTUP] Cleaning old drivers (timeout 20s)..."
timeout 20 pip uninstall -y pymssql pyodbc --disable-pip-version-check 2>/dev/null || true

# Install dependencies (already cached, so fast)
echo "[STARTUP] Installing dependencies..."
pip install -r requirements.txt --disable-pip-version-check --quiet

# Start application
echo "[STARTUP] Starting application..."
exec gunicorn \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile - \
  main:app
