#!/usr/bin/env python
"""
Migration: Update EntityTypeAttribute codes to match SignalK paths
Executes all updates from 0176_Update_EntityTypeAttribute_SignalK_Paths.sql
Runs against Azure SQL Database
"""

import pyodbc
import sys

# Azure SQL Connection
SERVER = "vxtdb.database.windows.net"
DATABASE = "free-sql-db-5949639"
UID = "vxt"
PWD = "Barak1976!"

conn_str = f"Driver={{ODBC Driver 17 for SQL Server}};Server={SERVER},1433;Database={DATABASE};Uid={UID};Pwd={PWD};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"

# EntityType IDs for yachts: 4=Elan Impression 40, 5=Lagoon 380, 6=Lagoon 420, 7=Bavaria Cruiser 46
ENTITY_TYPES = [4, 5, 6, 7]

# Update mappings: old code → new code
UPDATES = [
    ("propulsion.main.fuelRate", "propulsion.main.fuel.rate"),
    ("propulsion.main.fuelPressure", "propulsion.main.fuel.pressure"),
    ("navigation.position.latitude", "navigation.position.value.latitude"),
    ("navigation.position.longitude", "navigation.position.value.longitude"),
    ("propulsion.main.waterTemperature", "propulsion.main.coolantTemperature"),
    ("propulsion.main.gearboxOilTemperature", "propulsion.main.transmission.oilTemperature"),
    ("tanks.fuelTank.level", "tanks.fuel.0.currentLevel"),
    ("tanks.freshWaterTank.level", "tanks.freshWater.0.currentLevel"),
    ("electrical.dc.houseBattery.voltage", "electrical.batteries.main.voltage"),
    ("propulsion.main.alternatorOutput", "electrical.alternators.main.voltage"),
    ("propulsion.port.fuelRate", "propulsion.main.fuel.rate"),
    ("tanks.wasteWaterTank.level", "tanks.wasteWater.0.currentLevel"),
    ("environment.depth.belowTransducer", "navigation.depth"),
]

def connect_azure():
    """Connect to Azure SQL Database"""
    try:
        conn = pyodbc.connect(conn_str, timeout=30)
        conn.setdecoding(pyodbc.SQL_CHAR, encoding='utf-8')
        conn.setdecoding(pyodbc.SQL_WCHAR, encoding='utf-8')
        conn.setencoding(encoding='utf-8')
        print("✓ Connected to Azure SQL Database")
        return conn
    except Exception as e:
        print(f"✗ Failed to connect to Azure SQL: {e}")
        return None

def execute_migration(conn):
    """Execute all SignalK attribute code updates"""
    cursor = conn.cursor()
    total_rows = 0
    
    print("\n=== Starting EntityTypeAttribute Code Migration ===")
    print(f"Target Entity Types: {ENTITY_TYPES}")
    print(f"Total updates to apply: {len(UPDATES)}\n")
    
    try:
        for index, (old_code, new_code) in enumerate(UPDATES, 1):
            # Build WHERE clause with entity type IDs
            entity_types_str = ",".join(str(et) for et in ENTITY_TYPES)
            
            query = f"""
            UPDATE dbo.EntityTypeAttribute
            SET entityTypeAttributeCode = ?
            WHERE entityTypeAttributeCode = ? AND entityTypeId IN ({entity_types_str})
            """
            
            try:
                cursor.execute(query, (new_code, old_code))
                rows_affected = cursor.rowcount
                total_rows += rows_affected
                print(f"{index:2d}. {old_code:45s} → {new_code:45s} ({rows_affected:3d} rows)")
            except Exception as e:
                print(f"{index:2d}. {old_code:45s} → {new_code:45s} (ERROR: {e})")
        
        conn.commit()
        print(f"\n✓ Migration completed successfully!")
        print(f"  Total rows updated: {total_rows}")
        return True
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()

def verify_updates(conn):
    """Verify the updates were applied correctly"""
    cursor = conn.cursor()
    
    print("\n=== Verification: Updated Attribute Codes ===\n")
    
    # Get all the new codes we just inserted
    new_codes = [new for old, new in UPDATES]
    new_codes_str = "','".join(new_codes)
    
    query = f"""
    SELECT 
        entityTypeId,
        entityTypeAttributeCode,
        COUNT(*) as count
    FROM dbo.EntityTypeAttribute
    WHERE entityTypeAttributeCode IN ('{new_codes_str}')
    GROUP BY entityTypeId, entityTypeAttributeCode
    ORDER BY entityTypeId, entityTypeAttributeCode
    """
    
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
        
        if rows:
            print(f"{'Entity Type':<15} {'Attribute Code':<50} {'Count':<8}")
            print("─" * 73)
            
            for entity_type, code, count in rows:
                print(f"{entity_type:<15} {code:<50} {count:<8}")
        else:
            print("No updated attributes found!")
        
        # Summary by entity type
        print("\n=== Summary by Entity Type ===\n")
        query2 = """
        SELECT 
            et.entityTypeId,
            et.entityTypeName,
            COUNT(*) as total_attributes,
            SUM(CASE WHEN eta.entityTypeAttributeUnit IS NOT NULL AND eta.entityTypeAttributeUnit != '' THEN 1 ELSE 0 END) as with_units
        FROM dbo.EntityTypeAttribute eta
        JOIN dbo.EntityType et ON eta.entityTypeId = et.entityTypeId
        WHERE eta.entityTypeId IN (4, 5, 6, 7)
        GROUP BY et.entityTypeId, et.entityTypeName
        ORDER BY et.entityTypeId
        """
        
        cursor.execute(query2)
        for entity_type, name, total, with_units in cursor.fetchall():
            print(f"Entity Type {entity_type}: {name:<30} | Total: {total:3d} attributes | With units: {with_units:3d}")
        
    except Exception as e:
        print(f"Verification failed: {e}")
    finally:
        cursor.close()

def main():
    """Main execution"""
    print("\n" + "═" * 75)
    print("SignalK Attribute Code Migration - Azure SQL Database")
    print("═" * 75)
    
    conn = connect_azure()
    if not conn:
        sys.exit(1)
    
    try:
        success = execute_migration(conn)
        if success:
            verify_updates(conn)
        else:
            print("\nMigration failed. No changes were committed.")
            sys.exit(1)
    
    finally:
        conn.close()
        print("\n" + "═" * 75)
        print("✓ Script completed")
        print("═" * 75 + "\n")

if __name__ == "__main__":
    # Check for required driver
    try:
        # Try to verify the driver exists
        test_conn = pyodbc.connect("Driver={ODBC Driver 17 for SQL Server}")
    except Exception:
        print("Warning: ODBC Driver 17 for SQL Server may not be installed")
        print("Install with: choco install odbc-driver-17-for-sql-server")
    
    main()
