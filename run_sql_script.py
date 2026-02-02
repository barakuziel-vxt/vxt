import pyodbc

# Read SQL script
with open(r'C:\VXT\Create_BoatTelemetry_table.sql', 'r', encoding='utf-8') as f:
    sql_script = f.read()

# Connect to BoatTelemetryDB
conn_str = 'DRIVER={SQL Server};SERVER=localhost;DATABASE=BoatTelemetryDB;UID=sa;PWD=YourStrongPassword123!'
try:
    conn = pyodbc.connect(conn_str, autocommit=True)
    cursor = conn.cursor()
    
    # Execute script
    cursor.execute(sql_script)
    print('✓ SQL script executed successfully. Table and indexes created.')
    conn.close()
    
except Exception as e:
    print(f'✗ Error executing SQL script: {e}')
    import traceback
    traceback.print_exc()
