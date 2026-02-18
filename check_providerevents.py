import pyodbc

try:
    conn = pyodbc.connect('Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=BoatTelemetryDB;Trusted_Connection=yes;')
    cur = conn.cursor()
    
    # Check if table exists
    cur.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ProviderEvent'")
    table_exists = cur.fetchone()
    print(f"Table exists: {table_exists}")
    
    if table_exists:
        # Get columns
        cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ProviderEvent'")
        cols = cur.fetchall()
        print("\nColumns:")
        for col in cols:
            print(f"  {col[0]}: {col[1]}")
        
        # Try to select data
        cur.execute("SELECT * FROM ProviderEvent")
        rows = cur.fetchall()
        print(f"\nRows count: {len(rows)}")
        if rows:
            print(f"First row: {rows[0]}")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
