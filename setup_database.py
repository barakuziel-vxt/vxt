import pyodbc

# Connect to SQL Server (master database)
conn_str = 'DRIVER={SQL Server};SERVER=localhost;DATABASE=master;UID=sa;PWD=YourStrongPassword123!'
try:
    conn = pyodbc.connect(conn_str, autocommit=True)
    cursor = conn.cursor()
    
    # Create database if it doesn't exist
    cursor.execute('''
    IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'BoatTelemetryDB')
    CREATE DATABASE BoatTelemetryDB
    ''')
    print('✓ Database BoatTelemetryDB created (or already exists).')
    conn.close()
    
except Exception as e:
    print(f'✗ Error creating database: {e}')
