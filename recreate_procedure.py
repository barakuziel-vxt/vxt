import pyodbc

drivers = [
    'DRIVER={ODBC Driver 17 for SQL Server};SERVER=127.0.0.1;DATABASE=BoatTelemetryDB;UID=sa;PWD=YourStrongPassword123!;',
    'DRIVER={SQL Server};SERVER=127.0.0.1;DATABASE=BoatTelemetryDB;UID=sa;PWD=YourStrongPassword123!;'
]

conn = None
for d in drivers:
    try:
        conn = pyodbc.connect(d)
        break
    except:
        pass

if conn:
    cursor = conn.cursor()
    
    # Read and execute the fixed procedure
    with open(r'C:\VXT\db\sql\0172_Create_Analysis_APIs.sql', 'r') as f:
        sql = f.read()
    
    # Split by GO statements and execute each batch
    batches = sql.split('\nGO\n')
    
    try:
        for batch in batches:
            batch = batch.strip()
            if batch:
                cursor.execute(batch)
        conn.commit()
        print("✓ sp_GetEntityTelemetryData recreated successfully")
    except Exception as e:
        print(f"Error: {e}")
    
    conn.close()
