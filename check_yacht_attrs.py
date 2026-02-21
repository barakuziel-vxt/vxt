#!/usr/bin/env python
import pyodbc

try:
    conn_str = (
        'DRIVER={SQL Server};'
        'SERVER=127.0.0.1;'
        'DATABASE=BoatTelemetryDB;'
        'UID=sa;'
        'PWD=YourStrongPassword123!'
    )
    conn = pyodbc.connect(conn_str, timeout=10)
    cur = conn.cursor()
    
    # Check Yacht entity attributes with NULL or 'N'
    cur.execute("""
    SELECT DISTINCT
      eta.entityTypeAttributeCode,
      eta.entityTypeAttributeName,
      eta.defaultInGraph,
      et.entityTypeName
    FROM dbo.EntityTypeAttribute eta
    JOIN dbo.EntityType et ON eta.entityTypeId = et.entityTypeId
    WHERE et.entityTypeName IN ('Elan Impression 40', 'Lagoon 380')
    ORDER BY et.entityTypeName, eta.entityTypeAttributeCode
    """)
    
    print("=== Yacht Entity Attributes ===\n")
    for row in cur.fetchall():
        code, name, default, entity_type = row
        status = f"[{default}]" if default else "[NULL]"
        print(f"{status} {code}: {name} ({entity_type})")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
