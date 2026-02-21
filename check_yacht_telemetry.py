#!/usr/bin/env python
"""Check if Yacht entities have telemetry data in database"""
import pyodbc

conn_str = (
    'DRIVER={SQL Server};'
    'SERVER=127.0.0.1;'
    'DATABASE=BoatTelemetryDB;'
    'UID=sa;'
    'PWD=YourStrongPassword123!'
)

try:
    conn = pyodbc.connect(conn_str)
    cur = conn.cursor()
    
    # Get entities
    cur.execute("""
    SELECT TOP 20 e.entityId, COALESCE(e.entityFirstName + ' ' + e.entityLastName, e.entityId) as entity_name, et.entityTypeName, COUNT(tel.entityTelemetryId) as telemetry_count
    FROM dbo.Entity e
    JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
    LEFT JOIN dbo.EntityTelemetry tel ON e.entityId = tel.entityId
    GROUP BY e.entityId, e.entityFirstName, e.entityLastName, et.entityTypeName
    ORDER BY et.entityTypeName, entity_name
    """)
    
    print("=== Entities and Telemetry Data Count ===\n")
    for row in cur.fetchall():
        entity_id, entity_name, entity_type, count = row
        count = count or 0
        status = "✓ HAS DATA" if count > 0 else "✗ NO DATA"
        print(f"{entity_type:20} | {entity_name:30} | {count:,} records | {status}")
    
    # Check latest timestamp for Yacht entities
    print("\n=== Latest Telemetry Timestamp for Each Entity Type ===\n")
    cur.execute("""
    SELECT 
      et.entityTypeName,
      e.entityId,
      COALESCE(e.entityFirstName + ' ' + e.entityLastName, e.entityId) as entity_name,
      MAX(tel.endTimestampUTC) as latest_timestamp,
      COUNT(*) as record_count
    FROM dbo.Entity e
    JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
    JOIN dbo.EntityTelemetry tel ON e.entityId = tel.entityId
    GROUP BY et.entityTypeName, e.entityId, e.entityFirstName, e.entityLastName
    ORDER BY et.entityTypeName, latest_timestamp DESC
    """)
    
    for row in cur.fetchall():
        entity_type, entity_id, entity_name, latest, count = row
        print(f"{entity_type:20} | {entity_name:30} | Latest: {latest} | {count:,} records")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
