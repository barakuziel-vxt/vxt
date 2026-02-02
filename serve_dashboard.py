#!/usr/bin/env python3
"""Simple static file server that serves index.html for React SPA"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys

class ReactStaticHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        try:
            print(f"[GET] {self.path}", file=sys.stderr)
            # Parse the URL path
            if self.path == '/':
                self.path = '/index.html'
                print(f"[REWRITE] Converted / to /index.html", file=sys.stderr)
            elif self.path.endswith('/') or (not '.' in self.path.split('/')[-1]):
                # Directory request without index.html - redirect to index.html for SPA
                self.path = '/index.html'
                print(f"[REWRITE] Converted directory request to /index.html", file=sys.stderr)
            
            print(f"[SERVING] {self.path} from {os.getcwd()}", file=sys.stderr)
            # Now use the parent class to serve the file
            super().do_GET()
        except Exception as e:
            print(f"[ERROR] {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)

if __name__ == '__main__':
    os.chdir('C:\\VXT\\boat-dashboard\\build')
    print(f"Working dir: {os.getcwd()}")
    
    server = HTTPServer(('0.0.0.0', 3000), ReactStaticHandler)
    print('Dashboard at http://localhost:3000')
    print('Type Ctrl+C to stop\n')
    sys.stderr.flush()
    sys.stdout.flush()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[SHUTDOWN] Keyboard interrupt received')
        server.shutdown()
    except Exception as e:
        print(f'\n[FATAL] {e}')
        import traceback
        traceback.print_exc()
