"""Update defaultInGraph based on actual attribute codes in database"""

import pyodbc
import os
from dotenv import load_dotenv

load_dotenv()

server = os.getenv('DB_SERVER', '127.0.0.1')
database = os.getenv('DB_NAME', 'BoatTelemetryDB')
username = os.getenv('DB_USER', 'sa')
password = os.getenv('DB_PASSWORD', 'Real_Password_123!')

conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};'

try:
    conn = pyodbc.connect(conn_str, autocommit=True)
    cursor = conn.cursor()
    
    print("Updating defaultInGraph values based on attribute codes...\n")
    
    # Reset all to 'N' first
    cursor.execute("UPDATE EntityTypeAttribute SET defaultInGraph = 'N'")
    print(f"✓ Reset all attributes to 'N'")
    
    # Set health metrics to 'Y' using pattern matching on actual codes
    # Engine/Propulsion metrics
    cursor.execute("""
    UPDATE EntityTypeAttribute 
    SET defaultInGraph = 'Y'
    WHERE entityTypeAttributeCode LIKE '%mainengine%' 
       OR entityTypeAttributeCode LIKE '%engine.%'
       OR entityTypeAttributeCode LIKE '%propulsion%'
    """)
    print(f"✓ Updated {cursor.rowcount} engine/propulsion attributes")
    
    # Electrical/Battery metrics
    cursor.execute("""
    UPDATE EntityTypeAttribute 
    SET defaultInGraph = 'Y'
    WHERE entityTypeAttributeCode LIKE '%electrical%batt%' 
       OR entityTypeAttributeCode LIKE '%batteries%'
       OR entityTypeAttributeCode LIKE '%batteryvoltage%'
    """)
    print(f"✓ Updated {cursor.rowcount} electrical/battery attributes")
    
    # Navigation depth
    cursor.execute("""
    UPDATE EntityTypeAttribute 
    SET defaultInGraph = 'Y'
    WHERE entityTypeAttributeCode LIKE '%depth%'
    """)
    print(f"✓ Updated {cursor.rowcount} depth attributes")
    
    # Verify results
    cursor.execute("SELECT defaultInGraph, COUNT(*) as cnt FROM EntityTypeAttribute GROUP BY defaultInGraph")
    stats = cursor.fetchall()
    
    print("\n=== Final Distribution ===")
    for stat in stats:
        print(f"defaultInGraph = '{stat[0]}': {stat[1]} attributes")
    
    print("\n=== Sample Health Metrics (should be 'Y') ===")
    cursor.execute("""
    SELECT TOP 5 entityTypeAttributeCode, defaultInGraph 
    FROM EntityTypeAttribute 
    WHERE defaultInGraph = 'Y'
    ORDER BY entityTypeAttributeCode
    """)
    for row in cursor.fetchall():
        print(f"  {row[0]:45s} → {row[1]}")
    
    conn.close()
    print("\n✓ Database updated successfully!")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
