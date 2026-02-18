import pyodbc

conn = pyodbc.connect(
    'DRIVER={SQL Server};'
    'SERVER=127.0.0.1,1433;'
    'DATABASE=BoatTelemetryDB;'
    'UID=sa;'
    'PWD=YourStrongPassword123!;'
)
cursor = conn.cursor()

# Check Entity table structure
cursor.execute("""
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Entity'
ORDER BY ORDINAL_POSITION
""")

print("Entity table columns:")
for col in cursor.fetchall():
    print(f"  - {col[0]}: {col[1]}")

conn.close()
