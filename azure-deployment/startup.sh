#!/bin/bash
echo "Starting VXT Application on Azure App Service..."

# Install Python dependencies
pip install -r requirements.txt

# Start Gunicorn with FastAPI
gunicorn -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 main:app
