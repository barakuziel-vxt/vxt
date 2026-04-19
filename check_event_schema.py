import pyodbc
conn = pyodbc.connect("DRIVER={ODBC Driver 17 for SQL Server};SERVER=vxtdb.database.windows.net,1433;DATABASE=free-sql-db-5949639;UID=vxt;PWD=Barak1976!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;", autocommit=True)
cur = conn.cursor()
cur.execute("""
    SELECT c.name, c.is_identity, c.is_nullable,
           dc.definition AS default_definition,
           IDENT_SEED('dbo.Event') AS ident_seed,
           IDENT_INCR('dbo.Event') AS ident_incr,
           (SELECT TOP 1 1 FROM sys.sequences WHERE object_id = OBJECT_ID('dbo.seq_Event_eventId')) AS seq_exists
    FROM sys.columns c
    LEFT JOIN sys.default_constraints dc
        ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    WHERE c.object_id = OBJECT_ID('dbo.Event') AND c.name = 'eventId'
""")
row = cur.fetchone()
if row:
    print(f"name={row[0]}, is_identity={row[1]}, is_nullable={row[2]}, default={row[3]}, ident_seed={row[4]}, ident_incr={row[5]}, seq_exists={row[6]}")
else:
    print("Column not found")
cur.close()
conn.close()
