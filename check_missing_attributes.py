#!/usr/bin/env python3
"""Check for missing EntityTypeAttribute codes in database"""

from mssql_python import connect

conn_str = (
    "Server=vxtdb.database.windows.net,1433;"
    "Database=vxtdb;"
    "UID=vxt-web-app@vxtdb;"
    "PWD=Admin@123456;"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
)

with connect(conn_str) as conn:
    with conn.cursor() as cursor:
        # Get all EntityTypeAttribute codes
        cursor.execute("SELECT DISTINCT code FROM EntityTypeAttribute ORDER BY code")
        codes = cursor.fetchall()
        print("=== Existing EntityTypeAttribute Codes ===")
        for row in codes:
            print(f"  {row[0]}")
        
        print(f"\nTotal: {len(codes)} unique codes\n")
        
        # Check for missing SignalK codes
        missing_signalk = [
            'navigation.latitude',
            'navigation.longitude', 
            'environment.outside.temperature',
            'propulsion.main.temperature',
            'electrical.dc.houseBattery.voltage',
            'electrical.dc.houseBattery.current'
        ]
        
        print("=== Checking SignalK Codes ===")
        cursor.execute("SELECT code FROM EntityTypeAttribute WHERE code IN (?, ?, ?, ?, ?, ?)",
            missing_signalk)
        existing = [row[0] for row in cursor.fetchall()]
        
        for code in missing_signalk:
            status = "✓ EXISTS" if code in existing else "✗ MISSING"
            print(f"  {code}: {status}")
        
        # Check for missing Junction codes
        missing_junction = ['33018-7', '41981-2', '55411-3', '8466-5', '93831-0']
        
        print("\n=== Checking Junction Codes ===")
        cursor.execute("SELECT code FROM EntityTypeAttribute WHERE code IN (?, ?, ?, ?, ?)",
            missing_junction)
        existing = [row[0] for row in cursor.fetchall()]
        
        for code in missing_junction:
            status = "✓ EXISTS" if code in existing else "✗ MISSING"
            print(f"  {code}: {status}")
