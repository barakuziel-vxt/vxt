#!/usr/bin/env python
import pyodbc
import os

try:
    # Connect to database
    conn_str = (
        'DRIVER={SQL Server};'
        'SERVER=127.0.0.1;'
        'DATABASE=BoatTelemetryDB;'
        'UID=sa;'
        'PWD=YourStrongPassword123!'
    )
    conn = pyodbc.connect(conn_str, timeout=10)
    cur = conn.cursor()
    
    # Get entity types
    cur.execute("""
    SELECT DISTINCT et.entityTypeName
    FROM dbo.Entity e
    JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
    ORDER BY et.entityTypeName
    """)
    
    entity_types = [row[0] for row in cur.fetchall()]
    print(f"Entity Types: {entity_types}\n")
    
    # For each entity type, check attribute defaults
    for entity_type in entity_types:
        print(f"\n=== {entity_type} Entity Type ===")
        
        cur.execute("""
        SELECT 
          eta.entityTypeAttributeCode,
          eta.entityTypeAttributeName,
          eta.defaultInGraph
        FROM dbo.EntityTypeAttribute eta
        WHERE eta.entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = ?)
        ORDER BY eta.entityTypeAttributeCode
        """, entity_type)
        
        rows = cur.fetchall()
        print(f"Total attributes: {len(rows)}")
        print(f"Marked as defaultInGraph='Y': {sum(1 for r in rows if r[2] == 'Y')}")
        print(f"Marked as defaultInGraph='N': {sum(1 for r in rows if r[2] == 'N')}")
        print(f"Marked as NULL: {sum(1 for r in rows if r[2] is None)}")
        
        print("\nAttributes marked 'Y':")
        for row in rows:
            if row[2] == 'Y':
                print(f"  - {row[0]}: {row[1]}")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
