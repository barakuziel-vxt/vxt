#!/usr/bin/env python
"""Execute migration to fix Yacht health metrics defaultInGraph marking"""
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
    
    print("Executing: Fix Yacht health metrics marking...")
    
    # Mark propulsion (engine) health attributes
    cur.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'Y'
    WHERE entityTypeAttributeCode IN (
      'propulsion.main.temperature',
      'propulsion.main.oilPressure',
      'propulsion.main.revisions'
    )
    AND entityTypeId IN (
      SELECT entityTypeId FROM EntityType WHERE entityTypeName IN ('Elan Impression 40', 'Lagoon 380')
    )
    """)
    rows1 = cur.rowcount
    print(f"  Updated {rows1} propulsion attributes")
    
    # Mark electrical (battery/power) health attributes  
    cur.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'Y'
    WHERE entityTypeAttributeCode IN (
      'electrical.main.voltage',
      'electrical.dc.houseBattery.voltage',
      'electrical.dc.houseBattery.current'
    )
    AND entityTypeId IN (
      SELECT entityTypeId FROM EntityType WHERE entityTypeName IN ('Elan Impression 40', 'Lagoon 380')
    )
    """)
    rows2 = cur.rowcount
    print(f"  Updated {rows2} electrical attributes")
    
    # Mark fuelRate as 'N'
    cur.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'N'
    WHERE entityTypeAttributeCode = 'propulsion.port.fuelRate'
    AND entityTypeId IN (
      SELECT entityTypeId FROM EntityType WHERE entityTypeName IN ('Elan Impression 40', 'Lagoon 380')
    )
    """)
    rows3 = cur.rowcount
    print(f"  Updated {rows3} fuel rate attributes")
    
    conn.commit()
    print(f"\n✓ Migration executed successfully!")
    print(f"  Total rows updated: {rows1 + rows2 + rows3}")
    
    # Verify
    cur.execute("""
    SELECT 
      et.entityTypeName,
      COUNT(*) as total,
      SUM(CASE WHEN eta.defaultInGraph = 'Y' THEN 1 ELSE 0 END) as marked_Y
    FROM EntityTypeAttribute eta
    JOIN EntityType et ON eta.entityTypeId = et.entityTypeId
    WHERE et.entityTypeName IN ('Elan Impression 40', 'Lagoon 380', 'Person')
    GROUP BY et.entityTypeName
    """)
    
    print("\nVerification - Attributes marked 'Y' per entity type:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[2]}/{row[1]} marked for auto-selection")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
