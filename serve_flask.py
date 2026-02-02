#!/usr/bin/env python3
"""Flask server for serving React SPA"""
from flask import Flask, send_from_directory
import os

# Get the absolute path to the build directory
build_dir = r'C:\VXT\boat-dashboard\build'

print(f'Dashboard at http://localhost:3000')
print(f'Serving from: {build_dir}')
print(f'Index.html exists: {os.path.exists(os.path.join(build_dir, "index.html"))}')

app = Flask(__name__, static_folder=build_dir, static_url_path='/')

@app.route('/')
@app.route('/<path:path>')
def serve(path=''):
    """Serve React app - always return index.html for non-existent paths"""
    if path != '' and os.path.exists(os.path.join(build_dir, path)):
        return send_from_directory(build_dir, path)
    return send_from_directory(build_dir, 'index.html')

if __name__ == '__main__':
    try:
        print('Starting Flask...')
        app.run(host='0.0.0.0', port=3000, debug=False, use_reloader=False)
    except Exception as e:
        print(f'ERROR: {e}')
        import traceback
        traceback.print_exc()
