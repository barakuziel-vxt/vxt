import pyodbc

# Use the same connection string as main.py
SQL_CONN_STR = (
    'DRIVER={SQL Server};'
    'SERVER=127.0.0.1;'
    'DATABASE=BoatTelemetryDB;'
    'UID=sa;'
    'PWD=YourStrongPassword123!'
)

try:
    print(f"Attempting connection to BoatTelemetryDB...")
    conn = pyodbc.connect(SQL_CONN_STR, autocommit=False)
    print("Connected to database successfully")
    cursor = conn.cursor()
    
    # Update the AnalyzePath for DriftDetector to point to the wrapper function
    update_query = """
    UPDATE AnalyzeFunction
    SET AnalyzePath = 'drift_detector.detect_entity_drift'
    WHERE FunctionName = 'DriftDetector'
    """
    
    cursor.execute(update_query)
    conn.commit()
    
    print(f"Updated DriftDetector AnalyzePath to 'drift_detector.detect_entity_drift'")
    
    # Verify the change
    cursor.execute("""
    SELECT FunctionName, FunctionType, AnalyzePath 
    FROM AnalyzeFunction 
    WHERE FunctionName = 'DriftDetector'
    """)
    
    row = cursor.fetchone()
    if row:
        print(f"Verified: FunctionName={row[0]}, FunctionType={row[1]}, AnalyzePath={row[2]}")
    
    cursor.close()
    conn.close()
    print("Success!")
    
except pyodbc.Error as e:
    print(f"Database error: {e}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
