#!/usr/bin/env python3
import pymssql
import sys
from datetime import datetime, timedelta

# Database credentials  
server = "vxtdb.database.windows.net"
database = "free-sql-db-5949639"
user = "vxt"
password = "Barak1976!"

print("[*] Checking Azure SQL Database for telemetry data...")
try:
    conn = pymssql.connect(
        server=server,
        user=user,
        password=password,
        database=database,
        port=1433,
        timeout=10
    )
    print("[✓] Connected to Azure SQL successfully!\n")
    
    cursor = conn.cursor()
    
    # Check if EntityTelemetry table exists
    cursor.execute("""
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_name = 'EntityTelemetry'
    """)
    table_exists = cursor.fetchone()[0]
    
    if not table_exists:
        print("[!] EntityTelemetry table does not exist")
        cursor.close()
        conn.close()
        sys.exit(1)
    
    # Get total count
    cursor.execute("SELECT COUNT(*) FROM dbo.EntityTelemetry")
    total_count = cursor.fetchone()[0]
    print(f"[*] Total records in EntityTelemetry: {total_count}")
    
    # Get recent records
    print("\n[*] Last 5 telemetry records:")
    print("-" * 100)
    
    cursor.execute("""
    SELECT TOP 5 
        entityId,
        entityTypeAttributeId,
        numericValue,
        stringValue,
        providerEventInterpretation,
        ingestionTimestampUTC
    FROM dbo.EntityTelemetry
    ORDER BY ingestionTimestampUTC DESC
    """)
    
    rows = cursor.fetchall()
    
    if rows:
        print(f"{'ID':<15} {'Type':<6} {'NumVal':<12} {'StrVal':<25} {'Provider':<20} {'Timestamp':<30}")
        print("-" * 100)
        for row in rows:
            entity_id = str(row[0])[:14] if row[0] else "None"
            type_id = str(row[1]) if row[1] else "None"
            num_val = f"{row[2]:.2f}" if row[2] else "None"
            str_val = str(row[3])[:23] if row[3] else "None"
            provider = str(row[4])[:18] if row[4] else "None"
            timestamp = str(row[5])[:28] if row[5] else "None"
            print(f"{entity_id:<15} {type_id:<6} {num_val:<12} {str_val:<25} {provider:<20} {timestamp:<30}")
        
        print("\n[✓] SUCCESS: Data is being inserted into the database!")
    else:
        print("[!] No data found in EntityTelemetry table\n")
        print("[*] This means the Azure Function is NOT processing messages")
        print("[*] Possible reasons:")
        print("    1. IoT Hub message routing is not configured")
        print("    2. Function app connection string is incorrect")
        print("    3. Function is not running or has errors")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"[✗] Error: {str(e)}")
    sys.exit(1)
