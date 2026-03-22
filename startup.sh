#!/bin/bash
set -e

echo "Cleaning up old dependencies..."
pip uninstall -y pymssql pyodbc 2>/dev/null || true

echo "Installing new dependencies (mssql-python)..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Starting FastAPI with Uvicorn..."
exec gunicorn --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 main:app
