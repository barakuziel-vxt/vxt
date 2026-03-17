#!/usr/bin/env python
"""
Test ODBC Driver 17 connection to Azure SQL Server
"""
import pyodbc
import sys

print("=" * 70)
print("ODBC Driver 17 Connection Test")
print("=" * 70)

# Connection parameters
SERVER = 'vxtdb.database.windows.net,1433'
DATABASE = 'free-sql-db-5949639'
USERNAME = 'vxt@vxtdb'  # Azure SQL Server admin user (not vxtadmin)
PASSWORD = 'Barak1976!'

print(f"\nConnection Details:")
print(f"  Server: {SERVER}")
print(f"  Database: {DATABASE}")
print(f"  Username: {USERNAME}")

# Build connection string
connection_string = (
    f'Driver={{ODBC Driver 17 for SQL Server}};'
    f'Server={SERVER};'
    f'Database={DATABASE};'
    f'UID={USERNAME};'
    f'PWD={PASSWORD};'
    f'Encrypt=yes;'
    f'TrustServerCertificate=no;'
    f'Connection Timeout=30;'
)

print(f"\nConnection String (redacted):")
print(f"  Driver={{ODBC Driver 17 for SQL Server}};Server={SERVER};Database={DATABASE};UID={USERNAME};PWD=***;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;")

print("\n" + "-" * 70)
print("Attempting connection...")
print("-" * 70)

try:
    # Test connection
    conn = pyodbc.connect(connection_string)
    print("✓ Connection successful!")
    
    # Get SQL Server version
    cursor = conn.cursor()
    cursor.execute("SELECT @@version as version")
    version = cursor.fetchone()[0]
    print(f"✓ SQL Server Version: {version}")
    
    # Check available tables
    cursor.execute("""
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE' 
        ORDER BY TABLE_NAME
    """)
    tables = cursor.fetchall()
    print(f"✓ Available tables ({len(tables)} total):")
    for table in tables[:10]:
        print(f"    - {table[0]}")
    if len(tables) > 10:
        print(f"    ... and {len(tables) - 10} more")
    
    # Check EntityCategory table specifically
    cursor.execute("SELECT COUNT(*) FROM EntityCategory")
    count = cursor.fetchone()[0]
    print(f"✓ EntityCategory table has {count} rows")
    
    conn.close()
    
    print("\n" + "=" * 70)
    print("✓ All tests passed! Connection is working correctly.")
    print("=" * 70)
    sys.exit(0)
    
except pyodbc.Error as e:
    print(f"\n✗ ODBC Error: {e}")
    print(f"\nTroubleshooting:")
    print(f"  1. Verify ODBC Driver 17 is installed: pyodbc.drivers() shows it")
    print(f"  2. Check credentials are correct")
    print(f"  3. Check network connectivity to vxtdb.database.windows.net")
    print(f"  4. Check Azure SQL Server firewall rules allow your IP")
    sys.exit(1)
    
except Exception as e:
    print(f"\n✗ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
