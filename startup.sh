#!/bin/bash
set -x  # Debug mode - print all commands

echo "======================================"
echo "[STARTUP] VXT Web App - PYMSSQL ELIMINATION"
echo "======================================"
echo "[$(date)] Starting up..."

# Use 'python3' from PATH (Oryx activates antenv before calling this script,
# so python3 points to antenv's Python, NOT /usr/bin/python3 which may not exist)
PY=$(command -v python3.11 || command -v python3 || command -v python)
echo "[STARTUP] Using Python: $PY"
$PY --version

# Navigate to app directory
cd /home/site/wwwroot || exit 1
echo "[STARTUP] WorkDir: $(pwd)"
echo "[STARTUP] Contents: $(ls -la)"

# ===== STEP 1: NUCLEAR OPTION - Delete everything Python-related except source code =====
echo "[STARTUP] ==> STEP 1: Clean Python environment"
rm -rf /home/site/wwwroot/.venv 2>/dev/null || true
rm -rf /home/site/wwwroot/__pycache__ 2>/dev/null || true
find /home/site/wwwroot -name "*.pyc" -delete 2>/dev/null || true
find /home/site/wwwroot -name "*.pyo" -delete 2>/dev/null || true
find /home/site/wwwroot -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# Clear pip cache
echo "[STARTUP] ==> Clearing pip cache"
$PY -m pip cache purge --no-warn-script-location 2>&1 | head -5

# ===== STEP 2: AGGRESSIVELY list and remove old packages =====
echo "[STARTUP] ==> STEP 2: List installed packages BEFORE cleanup"
$PY -m pip list 2>&1 | grep -i "pymssql\|pyodbc\|mssql" || echo "[STARTUP] No old drivers detected"

echo "[STARTUP] ==> Uninstalling pymssql (if present)"
$PY -m pip uninstall /home/site/wwwroot -y 2>&1 || true  # Uninstall current dir packages
$PY -m pip uninstall pymssql -y --no-warn-script-location 2>&1 || echo "[STARTUP] pymssql not found (OK)"
$PY -m pip uninstall pyodbc -y --no-warn-script-location 2>&1 || echo "[STARTUP] pyodbc not found (OK)"
$PY -m pip uninstall odbc -y --no-warn-script-location 2>&1 || echo "[STARTUP] odbc not found (OK)"

# ===== STEP 3: Fresh install of ONLY correct packages =====
echo "[STARTUP] ==> STEP 3: Fresh install from requirements.txt"
echo "[STARTUP] Requirements file contents:"
cat requirements.txt
echo "[STARTUP] Starting pip install..."
$PY -m pip install --upgrade pip setuptools wheel --no-warn-script-location 2>&1 | tail -3
$PY -m pip install -r requirements.txt --no-cache-dir --no-warn-script-location --force-reinstall 2>&1 || {
  echo "[STARTUP] ERROR: pip install failed"
  $PY -m pip install -r requirements.txt --verbose 2>&1 | tail -20
  exit 1
}

# ===== STEP 4: Verify correct driver is installed =====
echo "[STARTUP] ==> STEP 4: Final verification"
echo "[STARTUP] Checking installed packages..."
$PY -m pip list 2>&1 | grep -i "mssql\|pymssql"

echo "[STARTUP] Trying to import mssql-python..."
if $PY -c "from mssql_python import connect; print('[STARTUP] SUCCESS: mssql-python imported'); print(connect.__module__)" 2>&1; then
  echo "[STARTUP] ✓ mssql-python imported successfully"
else
  echo "[STARTUP] ✗ FAILED to import mssql-python"
  exit 1
fi

echo "[STARTUP] Checking pymssql is NOT installed..."
if $PY -c "import pymssql" 2>/dev/null; then
  echo "[STARTUP] ✗ ERROR: pymssql is STILL installed! Removing..."
  $PY -m pip uninstall pymssql -y --no-warn-script-location 2>&1
  exit 1
else
  echo "[STARTUP] ✓ pymssql confirmed REMOVED"
fi

# ===== STEP 5: Check environment variables =====
echo "[STARTUP] ==> STEP 5: Environment check"
echo "[STARTUP] SQL_CONNECTION_STRING: $([ -n \"$SQL_CONNECTION_STRING\" ] && echo 'SET' || echo 'NOT SET')"
echo "[STARTUP] ENVIRONMENT: $ENVIRONMENT"
echo "[STARTUP] AZURE: $([ -n \"$WEBSITE_INSTANCE_ID\" ] && echo 'YES' || echo 'NO')"

# ===== STEP 6: Start application =====
echo "[STARTUP] ==> STEP 6: Starting Gunicorn"
exec $PY -m gunicorn \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile - \
  --log-level debug \
  main:app
