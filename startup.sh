#!/bin/bash
set -e

echo "[VXT] Starting application..."
python --version
echo ""

# Install minimal required system packages for mssql-python (TDS/Direct Database Connectivity)
echo "[VXT] Installing required system packages for mssql-python..."
apt-get update -y 2>/dev/null || true
apt-get install -y --no-install-recommends libltdl7 libkrb5-3 libgssapi-krb5-2 2>/dev/null || true

echo "[VXT] System packages installed successfully"
echo ""

echo "[VXT] Installing Python dependencies..."
pip install -q -r requirements.txt

echo "[VXT] Starting FastAPI application..."
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
