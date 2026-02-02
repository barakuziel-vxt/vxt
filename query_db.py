#!/usr/bin/env python3
"""Query database and show recent telemetry data"""
import pyodbc
import json

conn_str = 'DRIVER={SQL Server};SERVER=localhost;DATABASE=BoatTelemetryDB;UID=sa;PWD=YourStrongPassword123!'
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

cursor.execute('SELECT TOP 5 BoatId, Timestamp, RawJson FROM BoatTelemetry ORDER BY Timestamp DESC')

print('\n' + '='*80)
print('LATEST BOAT TELEMETRY DATA FROM DATABASE')
print('='*80 + '\n')

for i, row in enumerate(cursor.fetchall(), 1):
    boat_id, timestamp, raw_json = row
    data = json.loads(raw_json)
    rpm = data.get('engine', {}).get('rpm', 'N/A')
    temp_k = data.get('engine', {}).get('coolantTemp', 0)
    temp_c = temp_k - 273.15 if temp_k else 0
    
    print(f"Record #{i}")
    print(f"  Boat ID: {boat_id}")
    print(f"  Timestamp: {timestamp}")
    print(f"  Engine RPM: {rpm}")
    print(f"  Coolant Temp: {temp_c:.1f}°C (Kelvin: {temp_k})")
    print()

cursor.close()
conn.close()

print('='*80)
print('Data is successfully stored in the database!')
print('='*80)
