#!/bin/bash
set -e

echo "===== VXT API STARTUP SCRIPT ====="
echo "Python version:"
python --version
echo ""

echo "Current directory: $(pwd)"
echo "Files in directory:"
ls -la | head -20
echo ""

echo "Installing/Verifying dependencies from requirements.txt..."
pip install -r requirements.txt 2>&1 | tail -10
echo ""

echo "Dependency check:"
python -c "import fastapi; import pymssql; import uvicorn; print('[OK] All dependencies loaded')" 2>&1

echo ""
echo "Starting FastAPI application with Uvicorn..."
echo "Listening on 0.0.0.0:8000"
echo "===== Starting server ====="
exec uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
