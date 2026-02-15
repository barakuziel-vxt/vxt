#!/usr/bin/env python3
"""Clear old Shula telemetry data to prepare for fresh drift data"""

import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()

server = os.getenv('DB_SERVER', 'localhost')
database = os.getenv('DB_NAME', 'VXT')
username = os.getenv('DB_USER', 'sa')
password = os.getenv('DB_PASSWORD', '')

drivers_to_try = [
    f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};',
    f'DRIVER={{SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};'
]

conn = None
for driver_str in drivers_to_try:
    try:
        conn = pyodbc.connect(driver_str)
        break
    except:
        continue

if conn:
    cursor = conn.cursor()
    
    # Delete old Shula telemetry
    cursor.execute("DELETE FROM EntityTelemetry WHERE entityId = '033114870'")
    conn.commit()
    
    print('✓ Cleared old telemetry for Shula (033114870)')
    
    # Verify deletion
    cursor.execute("SELECT COUNT(*) FROM EntityTelemetry WHERE entityId = '033114870'")
    count = cursor.fetchone()[0]
    print(f'  Remaining Shula records: {count}')
    
    conn.close()
else:
    print("ERROR: Could not connect to database")
