"""Test the exact failing queries using pyodbc to reproduce the error"""
import struct, pyodbc, subprocess, sys

result = subprocess.run(
    'az account get-access-token --resource "https://database.windows.net/" --query accessToken -o tsv',
    capture_output=True, text=True, shell=True
)
token = result.stdout.strip()
if not token:
    print("Failed to get AAD token:", result.stderr[:200])
    sys.exit(1)
print(f"Got token ({len(token)} chars)")
token_bytes = token.encode('utf-16-le')
token_struct = struct.pack('<I', len(token_bytes)) + token_bytes
conn_str = 'Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;Encrypt=yes;TrustServerCertificate=no;'
conn = pyodbc.connect(conn_str, attrs_before={1256: token_struct}, timeout=30)
print("Connected")
cur = conn.cursor()

# Test 1: Simple param (works in production)
print("\nTest 1: Simple entity lookup with one ? param")
cur.execute("SELECT entityId, entityFirstName FROM dbo.Entity WHERE entityId = ?", ('234567891',))
rows = cur.fetchall()
print(f"  Result: {rows}")

# Test 2: Three params (like telemetry/range) -- NO CONVERT
print("\nTest 2: Range query with 3 params (no CONVERT)")
cur.execute("""
    SELECT et.endTimestampUTC, et.numericValue
    FROM dbo.EntityTelemetry et
    WHERE et.entityId = ?
      AND et.endTimestampUTC >= ?
      AND et.endTimestampUTC <= ?
    ORDER BY et.endTimestampUTC ASC
""", ('234567891', '2026-01-01 00:00:00', '2026-12-31 00:00:00'))
rows = cur.fetchall()
print(f"  Result: {len(rows)} rows")

# Test 3: Three params WITH CONVERT(DATETIME2, ?)
print("\nTest 3: Range query with CONVERT(DATETIME2, ?)")
try:
    cur.execute("""
        SELECT et.endTimestampUTC, et.numericValue
        FROM dbo.EntityTelemetry et
        WHERE et.entityId = ?
          AND et.endTimestampUTC >= CONVERT(DATETIME2, ?)
          AND et.endTimestampUTC <= CONVERT(DATETIME2, ?)
        ORDER BY et.endTimestampUTC ASC
    """, ('234567891', '2026-01-01 00:00:00', '2026-12-31 00:00:00'))
    rows = cur.fetchall()
    print(f"  Result: {len(rows)} rows")
except Exception as e:
    print(f"  ERROR: {e}")

# Test 4: CAST(? AS DATETIME)
print("\nTest 4: Range query with CAST(? AS DATETIME)")
try:
    cur.execute("""
        SELECT et.endTimestampUTC, et.numericValue
        FROM dbo.EntityTelemetry et
        WHERE et.entityId = ?
          AND et.endTimestampUTC >= CAST(? AS DATETIME)
          AND et.endTimestampUTC <= CAST(? AS DATETIME)
        ORDER BY et.endTimestampUTC ASC
    """, ('234567891', '2026-01-01 00:00:00', '2026-12-31 00:00:00'))
    rows = cur.fetchall()
    print(f"  Result: {len(rows)} rows")
except Exception as e:
    print(f"  ERROR: {e}")

conn.close()
print("\nDone.")
