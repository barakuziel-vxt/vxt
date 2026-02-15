"""Deploy SQL script - Execute any SQL file against the database"""

import sys
import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()

if len(sys.argv) < 2:
    print("Usage: python deploy_sql_file.py <sql_file_path>")
    sys.exit(1)

sql_file = sys.argv[1]

if not os.path.exists(sql_file):
    print(f"✗ Error: SQL file not found: {sql_file}")
    sys.exit(1)

# Read SQL file
print(f"Reading SQL file: {sql_file}")
with open(sql_file, 'r', encoding='utf-8') as f:
    sql_script = f.read()

# Get database connection parameters
server = os.getenv('DB_SERVER', '127.0.0.1')
database = os.getenv('DB_NAME', 'BoatTelemetryDB')
username = os.getenv('DB_USER', 'sa')
password = os.getenv('DB_PASSWORD', 'Real_Password_123!')

# Try both ODBC drivers
for driver in ['{SQL Server}', '{ODBC Driver 17 for SQL Server}']:
    try:
        conn_str = f'DRIVER={driver};SERVER={server};DATABASE={database};UID={username};PWD={password};'
        print(f"Connecting to {server}/{database}...")
        conn = pyodbc.connect(conn_str, autocommit=True, timeout=10)
        break
    except:
        continue
else:
    print(f"✗ Error: Could not connect with available drivers")
    sys.exit(1)

try:
    conn = pyodbc.connect(conn_str, autocommit=True)
    cursor = conn.cursor()
    
    print(f"Executing SQL from: {sql_file}")
    print("=" * 80)
    
    # Execute script
    cursor.execute(sql_script)
    
    print("=" * 80)
    print("✓ SQL script executed successfully!")
    conn.close()
    
except pyodbc.Error as e:
    print(f"✗ Database error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
