"""Test failing queries using ACTUAL mssql-python with Managed Identity (same as production)"""
from mssql_python import connect

# Using Managed Identity Auth (same as production)
conn_str = (
    "Server=vxtdb.database.windows.net,1433;"
    "Database=free-sql-db-5949639;"
    "Authentication=ActiveDirectoryMSI;"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
)

print("Connecting via MSI...")
try:
    conn = connect(conn_str)
    print("Connected!")
    cur = conn.cursor()
    
    # Test 1: Simple query
    print("\nTest 1: Simple query")
    cur.execute("SELECT 1 AS test")
    print(f"  {cur.fetchone()}")
    
    # Test 2: Health check (works in production)
    print("\nTest 2: Tables")
    cur.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
    print(f"  Tables: {cur.fetchone()[0]}")
    
    # Test 3: telemetry/range query
    print("\nTest 3: telemetry/range query")
    query = """
        SELECT
            et.entityTypeAttributeId,
            eta.entityTypeAttributeCode,
            et.numericValue,
            et.endTimestampUTC,
            et.latitude,
            et.longitude
        FROM dbo.EntityTelemetry et
        JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
        WHERE et.entityId = ?
          AND et.endTimestampUTC >= CONVERT(DATETIME2, ?)
          AND et.endTimestampUTC <= CONVERT(DATETIME2, ?)
        ORDER BY et.endTimestampUTC ASC
        """
    try:
        cur.execute(query, ('234567891', '2026-01-01 00:00:00', '2026-12-31 00:00:00'))
        rows = cur.fetchall()
        print(f"  OK: {len(rows)} rows")
    except Exception as e:
        print(f"  ERROR: {e}")
    
    conn.close()
except Exception as e:
    print(f"Connection failed: {e}")
