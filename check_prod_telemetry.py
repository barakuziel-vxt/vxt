import pyodbc

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=vxtdb.database.windows.net,1433;'
    'DATABASE=vxtdb;'
    'UID=vxtadmin;'
    'PWD=Barak1008!;'
    'Encrypt=yes;'
    'TrustServerCertificate=no;'
)
cursor = conn.cursor()

# Latest 10 rows in EntityTelemetry
cursor.execute("""
    SELECT TOP 10
        et.entityTelemetryId,
        e.entityFirstName + ISNULL(' ' + e.entityLastName, '') AS entity,
        eta.entityTypeAttributeCode AS attribute,
        et.numericValue,
        et.recordedAt
    FROM EntityTelemetry et
    JOIN Entity e ON et.entityId = e.entityId
    JOIN EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
    ORDER BY et.recordedAt DESC
""")
rows = cursor.fetchall()
print("Latest rows in EntityTelemetry (most recent first):")
print(f"{'ID':<8} {'Entity':<20} {'Attribute':<25} {'Value':<12} RecordedAt")
print('-' * 90)
for r in rows:
    print(f"{r[0]:<8} {str(r[1]):<20} {str(r[2]):<25} {str(r[3]):<12} {r[4]}")

# Count rows in last 5 minutes
cursor.execute("SELECT COUNT(*) FROM EntityTelemetry WHERE recordedAt >= DATEADD(MINUTE, -5, GETUTCDATE())")
count = cursor.fetchone()[0]
print(f"\nRows inserted in last 5 minutes: {count}")

# Count rows in last 30 minutes
cursor.execute("SELECT COUNT(*) FROM EntityTelemetry WHERE recordedAt >= DATEADD(MINUTE, -30, GETUTCDATE())")
count30 = cursor.fetchone()[0]
print(f"Rows inserted in last 30 minutes: {count30}")

cursor.execute("SELECT MIN(recordedAt), MAX(recordedAt), COUNT(*) FROM EntityTelemetry")
r = cursor.fetchone()
print(f"\nTotal rows: {r[2]}")
print(f"Table time range: {r[0]} to {r[1]}")
conn.close()
