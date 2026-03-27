#!/usr/bin/env python3
from mssql_python import connect
from datetime import datetime, timedelta

try:
    conn_str = "Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;Authentication=ActiveDirectoryMSI;Encrypt=yes;TrustServerCertificate=no"
    with connect(conn_str) as conn:
        with conn.cursor() as cursor:
            # Check for new records in last 20 minutes
            query = "SELECT COUNT(*) as count FROM EntityTelemetry WHERE Timestamp > DATEADD(minute, -20, GETUTCDATE())"
            cursor.execute(query)
            result = cursor.fetchone()
            recent_count = result[0] if result else 0
            
            if recent_count > 0:
                print(f"✅ Found {recent_count} RECENT records in EntityTelemetry (last 20 mins)")
                cursor.execute("SELECT TOP 5 TelemetryId, EntityId, Value, Timestamp FROM EntityTelemetry WHERE Timestamp > DATEADD(minute, -20, GETUTCDATE()) ORDER BY Timestamp DESC")
                for row in cursor.fetchall():
                    print(f"   ID: {row[0]}, Entity: {row[1]}, Value: {row[2]}, Time: {row[3]}")
            else:
                print("❌ No new records in EntityTelemetry (last 20 mins)")
                
except Exception as e:
    print(f"ERROR: {str(e)[:200]}")
