import pyodbc

conn_str = (
    'Driver={ODBC Driver 17 for SQL Server};'
    'Server=vxtdb.database.windows.net,1433;'
    'Database=free-sql-db-5949639;'
    'UID=vxt@vxtdb;'
    'PWD=Barak1976!;'
    'Encrypt=yes;'
    'TrustServerCertificate=no;'
)

try:
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    
    print("=== CustomerEntities Columns ===")
    cursor.execute("""
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'CustomerEntities' 
        ORDER BY ORDINAL_POSITION
    """)
    for row in cursor.fetchall():
        print(f"  - {row[0]} ({row[1]})")
    
    print("\n=== CustomerGeofenceCriteria Columns ===")
    cursor.execute("""
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'CustomerGeofenceCriteria' 
        ORDER BY ORDINAL_POSITION
    """)
    for row in cursor.fetchall():
        print(f"  - {row[0]} ({row[1]})")
    
    print("\n=== ProviderEvent Columns ===")
    cursor.execute("""
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'ProviderEvent' 
        ORDER BY ORDINAL_POSITION
    """)
    for row in cursor.fetchall():
        print(f"  - {row[0]} ({row[1]})")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
