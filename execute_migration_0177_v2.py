#!/usr/bin/env python3
"""
Execute migration 0177 - Try local SQL Server first, then Azure
"""
import json
import sys
import subprocess

# First, try to install mssql-python if not available
try:
    import mssql_python
except ImportError:
    print("Installing mssql-python...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "mssql-python"])

# Now import
from mssql_python import connect

# Load Azure connection config for fallback
with open('azure-vxtdb-connection.json', 'r') as f:
    azure_config = json.load(f)['mssql.connections'][0]

# Read migration script  
with open(r'db\sql\0177_Create_User_Device_Tables.sql', 'r', encoding='utf-8') as f:
    sql_script = f.read()

def execute_migration(connection_string, description):
    """Execute the migration script"""
    try:
        print(f"\nConnecting to {description}...")
        conn = connect(connection_string, timeout=30)
        print("✓ Connected")

        cursor = conn.cursor()
        
        # Split by GO batch separator
        batches = sql_script.split('\nGO')
        success_count = 0
        batch_num = 0
        
        current_batch = ""
        for line in sql_script.split('\n'):
            if line.upper().strip() == 'GO':
                if current_batch.strip() and not current_batch.strip().startswith('--'):
                    batch_num += 1
                    try:
                        print(f"[Batch {batch_num}]", end=' ', flush=True)
                        cursor.execute(current_batch)
                        conn.commit()
                        print("✓")
                        success_count += 1
                    except Exception as e:
                        print(f"✗ {str(e)[:80]}")
                        try:
                            conn.rollback()
                        except:
                            pass
                        continue
                current_batch = ""
            else:
                current_batch += line + "\n"
        
        # Execute last batch
        if current_batch.strip() and not current_batch.strip().startswith('--'):
            batch_num += 1
            try:
                print(f"[Batch {batch_num}]", end=' ', flush=True)
                cursor.execute(current_batch)
                conn.commit()
                print("✓")
                success_count += 1
            except Exception as e:
                print(f"✗ {str(e)[:80]}")

        cursor.close()
        conn.close()
        print(f"\n✓ Migration 0177 completed! ({success_count}/{batch_num} batches executed)")
        return True

    except Exception as e:
        print(f"✗ Failed: {e}")
        return False

# Try local SQL Server first
local_conns = [
    ("(localdb)\\mssqllocaldb", "Local SQL Server (LocalDB)", "vxtdb"),
    ("localhost", "Local SQL Server (localhost)", "vxtdb"),
    (".", "Local SQL Server (named pipe)", "vxtdb"),
]

success = False
for server, desc, db in local_conns:
    try:
        conn_str = f"Server={server};Database={db};Trusted_Connection=yes;TrustServerCertificate=yes;Encrypt=no"
        if execute_migration(conn_str, f"{desc}/{db}"):
            success = True
            break
    except:
        continue

# Fall back to Azure
if not success:
    print("\nLocal SQL Server not found or failed. Trying Azure...")
    azure_conn = (
        f"Server={azure_config['server']};"
        f"Database={azure_config['database']};"
        f"Uid={azure_config['user']};"
        f"Pwd={azure_config['password']};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no"
    )
    execute_migration(azure_conn, f"Azure ({azure_config['server']}/{azure_config['database']})")
