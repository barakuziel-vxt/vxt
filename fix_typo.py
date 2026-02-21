#!/usr/bin/env python
"""Fix typo: revisions -> revolutions in Yacht metric marking"""
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
    
    print("Fixing typo: propulsion.main.revisions -> propulsion.main.revolutions")
    
    # First, undo the typo
    cur.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'N'
    WHERE entityTypeAttributeCode = 'propulsion.main.revisions'
    """)
    undone = cur.rowcount
    print(f"  Undid {undone} rows with typo")
    
    # Now mark the correct code
    cur.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'Y'
    WHERE entityTypeAttributeCode = 'propulsion.main.revolutions'
    AND entityTypeId IN (
      SELECT entityTypeId FROM EntityType WHERE entityTypeName IN ('Elan Impression 40', 'Lagoon 380')
    )
    """)
    fixed = cur.rowcount
    print(f"  Fixed {fixed} rows with correct code")
    
    conn.commit()
    print(f"\n✓ Typo fixed!")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
