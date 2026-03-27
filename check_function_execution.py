#!/usr/bin/env python3
"""
Diagnostic script to verify end-to-end function execution
Checks if database has recent records from simulation
"""
import sys
from mssql_python import connect
from datetime import datetime, timedelta

def check_database_records():
    """Query database for recent records"""
    try:
        # Use Managed Identity just like the function does
        connection_string = (
            "Server=vxtdb.database.windows.net,1433;"
            "Database=free-sql-db-5949639;"
            "Authentication=ActiveDirectoryMSI;"
            "Encrypt=yes;"
            "TrustServerCertificate=no;"
        )
        
        with connect(connection_string) as conn:
            with conn.cursor() as cursor:
                # Query recent records
                query = """
                SELECT TOP 20 
                    entityId, 
                    attributeName, 
                    attributeValue, 
                    timestamp 
                FROM dbo.EntityTelemetry 
                WHERE timestamp > DATEADD(minute, -5, GETUTCDATE())
                ORDER BY timestamp DESC
                """
                cursor.execute(query)
                rows = cursor.fetchall()
                
                if rows:
                    print(f"✅ SUCCESS: Found {len(rows)} recent records in database!")
                    print("\nSample records:")
                    for i, row in enumerate(rows[:5], 1):
                        print(f"  {i}. Entity: {row[0]}, Attr: {row[1]}, Value: {row[2]}, Time: {row[3]}")
                    
                    # Count records by entity
                    cursor.execute("""
                    SELECT entityId, COUNT(*) as count
                    FROM dbo.EntityTelemetry 
                    WHERE timestamp > DATEADD(minute, -5, GETUTCDATE())
                    GROUP BY entityId
                    """)
                    entity_counts = cursor.fetchall()
                    print("\n✅ Records by entity:")
                    for entity, count in entity_counts:
                        print(f"   {entity}: {count} records")
                    
                    return True
                else:
                    print("❌ No records found in database from last 5 minutes")
                    print("\n   This means:")
                    print("   1. Events reached IoT Hub ✅ (simulation confirmed)")
                    print("   2. Function NOT triggered or NOT processing messages ❌")
                    print("\n   Likely causes:")
                    print("   - Event Hub trigger not registered")
                    print("   - Database connection failing silently")
                    print("   - Message routing issue")
                    return False
                    
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 70)
    print("DIAGNOSTIC: Checking if function processed simulation events")
    print("=" * 70)
    
    success = check_database_records()
    sys.exit(0 if success else 1)
