"""Check and fix default metrics in database"""

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
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    
    print("\n=== Existing Attributes and defaultInGraph Values ===\n")
    cursor.execute("""
        SELECT 
            entityTypeAttributeId,
            entityTypeAttributeCode,
            entityTypeAttributeName,
            ISNULL(defaultInGraph, 'NULL') as defaultInGraph
        FROM dbo.EntityTypeAttribute
        ORDER BY entityTypeAttributeCode
    """)
    
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row[0]:5d} | Code: {row[1]:45s} | Name: {row[2]:40s} | Default: {row[3]}")
    
    print(f"\n\nTotal attributes: {len(rows)}")
    
    # Count current defaults
    cursor.execute("SELECT defaultInGraph, COUNT(*) as cnt FROM EntityTypeAttribute GROUP BY defaultInGraph")
    stats = cursor.fetchall()
    print("\n=== Current Distribution ===")
    for stat in stats:
        print(f"defaultInGraph = '{stat[0]}': {stat[1]} attributes")
    
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
