from mssql_python import connect

conn_str = (
    'Server=vxtdb.database.windows.net,1433;'
    'Database=free-sql-db-5949639;'
    'UID=vxtadmin;'
    'PWD=Barak1008!;'
    'Encrypt=yes;'
    'TrustServerCertificate=no;'
)
try:
    conn = connect(conn_str)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COLUMNPROPERTY(OBJECT_ID('dbo.EntityTelemetry'), 'entityTelemetryId', 'IsIdentity') AS IsIdentity
    """)
    row = cursor.fetchone()
    print('IsIdentity:', row[0])
    cursor.execute('SELECT COUNT(*) FROM dbo.EntityTelemetry')
    row2 = cursor.fetchone()
    print('RowCount:', row2[0])
    conn.close()
    print('Done')
except Exception as e:
    print('ERROR:', e)
