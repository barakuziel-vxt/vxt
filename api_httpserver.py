#!/usr/bin/env python
"""Simple HTTP server using built-in http.server - no async/threading issues"""
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import pyodbc
import sys

class BoatTelemetryHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        query_params = parse_qs(parsed_path.query)
        
        # CORS headers
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        if path == '/':
            response = json.dumps({"status": "ok", "message": "Boat Telemetry API"})
            self.wfile.write(response.encode())
            return
        
        if path.startswith('/telemetry/'):
            boat_id = path.split('/')[-1]
            limit = int(query_params.get('limit', [50])[0])
            
            try:
                conn_str = (
                    'DRIVER={SQL Server};'
                    'SERVER=localhost;'
                    'DATABASE=BoatTelemetryDB;'
                    'UID=sa;'
                    'PWD=YourStrongPassword123!'
                )
                conn = pyodbc.connect(conn_str)
                cursor = conn.cursor()
                
                if not boat_id.startswith("vessels."):
                    boat_id = f"vessels.urn:mrn:imo:mmsi:{boat_id}"
                
                query = """
                    SELECT TOP (?)
                        Timestamp,
                        JSON_VALUE(RawJson, '$.engine.rpm') AS rpm_value,
                        JSON_VALUE(RawJson, '$.engine.coolantTemp') AS temp_value_kelvin
                    FROM BoatTelemetry
                    WHERE BoatId = ?
                    ORDER BY Timestamp DESC
                """
                
                cursor.execute(query, limit, boat_id)
                rows = cursor.fetchall()
                
                result = []
                for row in rows:
                    timestamp = row.Timestamp
                    if hasattr(timestamp, 'isoformat'):
                        timestamp_str = timestamp.isoformat()
                    else:
                        timestamp_str = str(timestamp)
                    
                    rpm = float(row.rpm_value) if row.rpm_value else 0
                    temp_k = float(row.temp_value_kelvin) if row.temp_value_kelvin else 0
                    temp_c = temp_k - 273.15
                        
                    result.append({
                        "timestamp": timestamp_str,
                        "rpm": rpm,
                        "temp": temp_c
                    })
                
                cursor.close()
                conn.close()
                
                response = json.dumps(result[::-1])
                self.wfile.write(response.encode())
                return
                
            except Exception as e:
                print(f"ERROR: {e}", file=sys.stderr)
                import traceback
                traceback.print_exc()
                error_response = json.dumps({"error": str(e)})
                self.wfile.write(error_response.encode())
                return
        
        # 404
        self.send_error(404)
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        print(f"{self.client_address[0]} - {format % args}")

if __name__ == "__main__":
    server = HTTPServer(('0.0.0.0', 8000), BoatTelemetryHandler)
    print("Boat Telemetry API running on http://0.0.0.0:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
