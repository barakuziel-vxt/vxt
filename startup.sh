#!/bin/bash
set -e

echo "======================================"
echo "[STARTUP] VXT Web App Fresh Start"
echo "======================================"
echo "[$(date)] Starting up..."

# GET PYTHON PATH
PY=$(which python3 || which python)
echo "[STARTUP] Python: $PY"

# AGGRESSIVE cache cleanup
echo "[STARTUP] Cleaning Python cache..."
find /home/site/wwwroot -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find /home/site/wwwroot -type f -name "*.pyc" -delete 2>/dev/null || true
find /home/site/wwwroot -type f -name "*.pyo" -delete 2>/dev/null || true

# Clear pip cache
echo "[STARTUP] Clearing pip cache..."
$PY -m pip cache purge 2>/dev/null || true

# Uninstall OLD DRIVERS (the root cause)
echo "[STARTUP] ==>> REMOVING OLD DRIVERS <<"
$PY -m pip uninstall -y pymssql pyodbc odbc mssqlcli 2>/dev/null || true
echo "[STARTUP] Verified pymssql/pyodbc removed"

# Force reinstall ONLY correct driver
echo "[STARTUP] Installing CLEAN requirements..."
$PY -m pip install --no-cache-dir -r /home/site/wwwroot/requirements.txt --disable-pip-version-check

# Verify mssql-python is installed and pymssql is NOT
echo "[STARTUP] Verifying driver setup..."
$PY -c "import mssql_python; print('[STARTUP] ✓ mssql-python available')" || echo "[STARTUP] ERROR: mssql-python NOT installed"
$PY -c "import pymssql; print('[STARTUP] ✗ WARNING: pymssql still present!')" 2>/dev/null || echo "[STARTUP] ✓ pymssql confirmed removed"

# Verify environment
echo "[STARTUP] Checking environment..."
echo "[STARTUP] SQL_CONNECTION_STRING is set: $([ -n \"\$SQL_CONNECTION_STRING\" ] && echo 'YES' || echo 'NO')"
echo "[STARTUP] ENVIRONMENT=$ENVIRONMENT"
echo "[STARTUP] RUNNING_IN_AZURE=$([[ -n \"\$WEBSITE_INSTANCE_ID\" ]] && echo 'YES' || echo 'NO')"

# Start app
echo "[STARTUP] Starting Gunicorn..."
exec gunicorn \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile - \
  main:app
