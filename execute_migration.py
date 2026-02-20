"""Execute SQL migration with proper batch handling"""

import pyodbc
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Get database connection parameters
server = os.getenv('DB_SERVER', '127.0.0.1')
database = os.getenv('DB_NAME', 'BoatTelemetryDB')
username = os.getenv('DB_USER', 'sa')
password = os.getenv('DB_PASSWORD', 'Real_Password_123!')

# Try to connect
try:
    conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};'
    conn = pyodbc.connect(conn_str, autocommit=True)
except:
    try:
        conn_str = f'DRIVER={{SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};'
        conn = pyodbc.connect(conn_str, autocommit=True)
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        sys.exit(1)

cursor = conn.cursor()

try:
    # Execute migration statements individually
    print("Executing migration: Add defaultInGraph column...")
    
    # 1. Add column
    print("  1. Adding defaultInGraph column...")
    cursor.execute('ALTER TABLE EntityTypeAttribute ADD defaultInGraph CHAR(1) DEFAULT \'N\'')
    print("     ✓ Column added")
    
    # 2. Update health attributes to Y
    print("  2. Setting health attributes to Y...")
    cursor.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'Y'
    WHERE entityTypeAttributeCode LIKE 'propulsion.mainEngine.%'
       OR entityTypeAttributeCode LIKE 'propulsion.engine.%'
    """)
    print(f"     ✓ Updated {cursor.rowcount} engine attributes")
    
    # 3. Update electrical attributes to Y
    cursor.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'Y'
    WHERE entityTypeAttributeCode LIKE 'electrical.batt%'
       OR entityTypeAttributeCode = 'electrical.batteries.1.voltage'
    """)
    print(f"     ✓ Updated {cursor.rowcount} electrical attributes")
    
    # 4. Update navigation depth to Y
    cursor.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'Y'
    WHERE entityTypeAttributeCode = 'navigation.depth'
    """)
    print(f"     ✓ Updated {cursor.rowcount} depth attribute")
    
    # 5. Ensure location attributes are N
    cursor.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'N'
    WHERE entityTypeAttributeCode IN ('navigation.latitude', 'navigation.longitude', 'navigation.position')
    """)
    print(f"     ✓ Updated {cursor.rowcount} location attributes to N")
    
    # 6. Set environment to N
    cursor.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'N'
    WHERE entityTypeAttributeCode LIKE 'environment.%'
    """)
    print(f"     ✓ Updated {cursor.rowcount} environment attributes")
    
    # 7. Set navigation non-health to N
    cursor.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'N'
    WHERE entityTypeAttributeCode LIKE 'navigation.speed%'
       OR entityTypeAttributeCode LIKE 'navigation.course%'
       OR entityTypeAttributeCode LIKE 'navigation.heading%'
    """)
    print(f"     ✓ Updated {cursor.rowcount} navigation metrics")
    
    # 8. Set tanks to N
    cursor.execute("""
    UPDATE EntityTypeAttribute
    SET defaultInGraph = 'N'
    WHERE entityTypeAttributeCode LIKE 'tanks.%'
    """)
    print(f"     ✓ Updated {cursor.rowcount} tank attributes")
    
    conn.commit()
    print("\n✓ Migration completed successfully!")
    
except Exception as e:
    print(f"\n✗ Migration failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
finally:
    conn.close()
