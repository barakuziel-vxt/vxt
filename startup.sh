#!/bin/bash
set -e

echo "[VXT] Starting application..."
python --version
echo ""

echo "[VXT] Installing Python dependencies..."
pip install -q -r requirements.txt

echo "[VXT] Starting FastAPI application with pymssql driver..."
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
