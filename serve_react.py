#!/usr/bin/env python3
"""Pure Python HTTP server to serve React SPA"""
import http.server
import socketserver
import os
import urllib.parse
from pathlib import Path

# Build directory
BUILD_DIR = r'C:\VXT\boat-dashboard\build'

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BUILD_DIR, **kwargs)

    def do_GET(self):
        """Override GET to serve React SPA"""
        # Parse the URL
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path.lstrip('/')
        
        # Construct full file path
        file_path = os.path.join(BUILD_DIR, path)
        
        # Security check - ensure we're not going outside BUILD_DIR
        try:
            file_path = os.path.abspath(file_path)
            if not file_path.startswith(os.path.abspath(BUILD_DIR)):
                self.send_error(403)
                return
        except:
            self.send_error(500)
            return
        
        # If path is empty or a directory, or file doesn't exist, serve index.html
        if not path or os.path.isdir(file_path) or not os.path.isfile(file_path):
            file_path = os.path.join(BUILD_DIR, 'index.html')
        
        # Serve the file
        try:
            with open(file_path, 'rb') as f:
                self.send_response(200)
                
                # Determine content type
                if file_path.endswith('.html'):
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                elif file_path.endswith('.js'):
                    self.send_header('Content-Type', 'application/javascript')
                elif file_path.endswith('.css'):
                    self.send_header('Content-Type', 'text/css')
                elif file_path.endswith('.json'):
                    self.send_header('Content-Type', 'application/json')
                elif file_path.endswith('.png'):
                    self.send_header('Content-Type', 'image/png')
                elif file_path.endswith('.ico'):
                    self.send_header('Content-Type', 'image/x-icon')
                else:
                    self.send_header('Content-Type', 'application/octet-stream')
                
                content = f.read()
                self.send_header('Content-Length', len(content))
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                self.wfile.write(content)
        except Exception as e:
            print(f'Error serving {file_path}: {e}')
            self.send_error(500)

    def log_message(self, format, *args):
        """Log request"""
        print(f'{self.client_address[0]} - {format % args}')

if __name__ == '__main__':
    port = 3000
    handler = SPAHandler
    
    try:
        with socketserver.TCPServer(("0.0.0.0", port), handler) as httpd:
            print(f'Dashboard at http://localhost:{port}')
            print(f'Serving from: {BUILD_DIR}')
            print(f'Press CTRL+C to quit')
            httpd.serve_forever()
    except Exception as e:
        print(f'ERROR: {e}')
        import traceback
        traceback.print_exc()
