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
cur = conn.cursor()

print('=== Entities in production DB ===')
cur.execute('SELECT TOP 10 entityId, entityFirstName, entityLastName, entityTypeId FROM Entity ORDER BY entityId')
for r in cur.fetchall():
    print(f'  id={r[0]} name={r[1]} {r[2] or ""} typeId={r[3]}')

print('\n=== Attribute codes (EntityTypeAttribute) ===')
cur.execute('SELECT entityTypeAttributeCode, entityTypeAttributeId FROM EntityTypeAttribute ORDER BY entityTypeAttributeCode')
for r in cur.fetchall():
    print(f'  {r[0]} (id={r[1]})')

print('\n=== Latest EntityTelemetry rows ===')
cur.execute("""
    SELECT TOP 10 et.entityTelemetryId, et.entityId, eta.entityTypeAttributeCode, et.numericValue, et.recordedAt
    FROM EntityTelemetry et
    JOIN EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
    ORDER BY et.recordedAt DESC
""")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f'  id={r[0]} entity={r[1]} attr={r[2]} val={r[3]} at={r[4]}')
else:
    print('  (no rows)')

print('\n=== Total EntityTelemetry count ===')
cur.execute('SELECT COUNT(*) FROM EntityTelemetry')
print(f'  {cur.fetchone()[0]} rows')

conn.close()
