#!/bin/bash
set -e

echo "[STARTUP] VXT Web App - $(date)"

# Oryx extracts output.tar.zst and activates antenv BEFORE this script runs.
# Packages from requirements.txt are already installed by the Oryx build step.
# Do NOT reinstall - it wastes 60-90 seconds on every cold start.
PY=$(command -v python3.11 || command -v python3)
echo "[STARTUP] Python: $PY ($($PY --version 2>&1))"

# Only install if the driver is somehow missing (should not happen in normal flow)
if ! $PY -c "from mssql_python import connect" 2>/dev/null; then
  echo "[STARTUP] WARNING: mssql-python not in antenv, installing now..."
  $PY -m pip install 'mssql-python>=1.0.0' -q
fi
echo "[STARTUP] mssql-python: OK"
echo "[STARTUP] SQL_CONNECTION_STRING: $([ -n "$SQL_CONNECTION_STRING" ] && echo 'SET' || echo 'NOT SET')"

echo "[STARTUP] Starting Gunicorn..."
exec $PY -m gunicorn \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile - \
  main:app
