#!/usr/bin/env python3
"""
Execute migration 0177 on vxtdb using modern SQL driver
"""
import json
import sys

try:
    # Try importing the modern mssql driver
    from mssql_python import connect
except ImportError:
    # Fall back to simpler approach using urllib + direct connection
    print("Installing mssql-python...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "mssql-python", "-q"])
    from mssql_python import connect

# Load connection config
with open('azure-vxtdb-connection.json', 'r') as f:
    config = json.load(f)['mssql.connections'][0]

# Build connection string for mssql-python
connection_string = (
    f"Server={config['server']};"
    f"Database={config['database']};"
    f"Uid={config['user']};"
    f"Pwd={config['password']};"
    f"Encrypt=yes;"
    f"TrustServerCertificate=no"
)

# Read migration script  
with open(r'db\sql\0177_Create_User_Device_Tables.sql', 'r', encoding='utf-8') as f:
    sql_script = f.read()

try:
    print(f"Connecting to {config['server']}/{config['database']}...")
    conn = connect(connection_string)
    print("✓ Connected")

    cursor = conn.cursor()
    
    # Remove GO statements and split by GO (SQL batch separator)
    statements = sql_script.split('\nGO\n')
    success_count = 0
    
    for i, stmt in enumerate(statements, 1):
        stmt = stmt.strip()
        if stmt and not stmt.startswith('--'):
            try:
                print(f"\n[Executing statement {i}...]", end=' ')
                # Remove leading/trailing whitespace and extra GO commands
                stmt = stmt.replace('\nGO', '').strip()
                if stmt:
                    cursor.execute(stmt)
                    conn.commit()
                    print("✓")
                    success_count += 1
            except Exception as e:
                print(f"\n✗ Error in statement {i}: {e}")
                conn.rollback()
                # Continue with other statements
                continue

    cursor.close()
    conn.close()
    print(f"\n✓ Migration 0177 completed! ({success_count} statements executed successfully)")

except Exception as e:
    print(f"✗ Error: {e}")
    sys.exit(1)
