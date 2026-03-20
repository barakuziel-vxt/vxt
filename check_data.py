import pyodbc
import time

print("Waiting for data to process...")
time.sleep(3)

conn_str = 'DRIVER={ODBC Driver 17 for SQL Server};SERVER=tcp:vxtdb.database.windows.net,1433;DATABASE=free-sql-db-5949639;UID=vxt;PWD=Barak1976!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30'

try:
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM EntityTelemetry WHERE InsertedAt > DATEADD(minute, -5, GETUTCDATE())')
    count = cursor.fetchone()[0]
    print(f'\nRecords in last 5 minutes: {count}')

    if count > 0:
        print("\nLatest records:")
        cursor.execute('SELECT TOP 3 InsertedAt, EntityId FROM EntityTelemetry ORDER BY InsertedAt DESC')
        for row in cursor.fetchall():
            print(f'  {row[0]} | {row[1]}')
        print("\n✅ SUCCESS: Data received!")
    else:
        print("\n⚠️  No recent data - checking what was the last record...")
        cursor.execute('SELECT MAX(InsertedAt) FROM EntityTelemetry')
        last_date = cursor.fetchone()[0]
        print(f"Last record timestamp: {last_date}")

    conn.close()
except Exception as e:
    print(f"Error: {e}")
