#!/usr/bin/env python
"""Run FastAPI with explicit error handling"""
import sys
import os

# Set encoding
os.environ['PYTHONIOENCODING'] = 'utf-8'

try:
    print("Starting FastAPI server...")
    import uvicorn
    from main import app
    
    print("App loaded successfully")
    print("Starting server...")
    
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="debug"
    )
except Exception as e:
    import traceback
    print(f"FATAL ERROR: {e}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
