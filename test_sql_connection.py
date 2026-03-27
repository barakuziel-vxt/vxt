import pyodbc
import os

# Connection details
server = 'vxtdb.database.windows.net'
database = 'vxtdb'
username = 'vxtadmin'
password = os.getenv('DB_PASSWORD', '')

if not password:
    raise ValueError('DB_PASSWORD environment variable not set')

# Create connection string
connection_string = f'Driver={{ODBC Driver 17 for SQL Server}};Server={server},1433;Database={database};Uid={username};Pwd={password};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;'

print("Testing Azure SQL Database Connection...")
print(f"Server: {server}")
print(f"Database: {database}")
print(f"Username: {username}")
print("-" * 50)

try:
    conn = pyodbc.connect(connection_string)
    cursor = conn.cursor()
    
    # Test query
    cursor.execute("SELECT GETDATE() as CurrentTime, @@VERSION as SQLVersion;")
    row = cursor.fetchone()
    
    print("\n✅ CONNECTION SUCCESSFUL!")
    print("-" * 50)
    print(f"Current Time: {row[0]}")
    print(f"SQL Version: {row[1][:60]}...")  # First 60 chars
    
    # Test database access
    cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE';")
    tables = cursor.fetchall()
    print(f"\nTables in database: {len(tables)}")
    if tables:
        for table in tables[:5]:
            print(f"  - {table[0]}")
    
    conn.close()
    print("\n✅ All tests passed! Password is correct.")
    
except pyodbc.Error as e:
    print(f"\n❌ CONNECTION FAILED")
    print("-" * 50)
    print(f"Error: {e}")
    print("\nPossible solutions:")
    print("1. Wrong password - try resetting in Azure Portal")
    print("2. Firewall blocking - add your IP in SQL firewall rules")
    print("3. Database not ready - wait a few minutes")
