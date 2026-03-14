#!/bin/bash
set -e

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Starting FastAPI with Uvicorn..."
exec gunicorn --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 main:app
