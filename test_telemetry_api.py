"""Test the telemetry CTE query against production DB"""
import struct
import pyodbc
import subprocess
import sys

# Get AAD token
result = subprocess.run(
    ['az', 'account', 'get-access-token', '--resource', 'https://database.windows.net/', '--query', 'accessToken', '-o', 'tsv'],
    capture_output=True, text=True, shell=True
)
token = result.stdout.strip()
if not token:
    print("Failed to get AAD token")
    sys.exit(1)
print(f"Got token ({len(token)} chars)")

token_bytes = token.encode('utf-16-le')
token_struct = struct.pack('<I', len(token_bytes)) + token_bytes

conn_str = 'Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;Encrypt=yes;TrustServerCertificate=no;'

try:
    conn = pyodbc.connect(conn_str, attrs_before={1256: token_struct}, timeout=30)
    print("Connected to DB")
    cur = conn.cursor()
    
    # Test simplified CTE query (same as main.py)
    query = """
    WITH LatestPerAttribute AS (
      SELECT
        eta.entityTypeAttributeId,
        eta.entityTypeAttributeCode,
        eta.entityTypeAttributeName,
        eta.defaultInGraph,
        et.numericValue,
        et.stringValue,
        et.endTimestampUTC,
        ROW_NUMBER() OVER (PARTITION BY eta.entityTypeAttributeId ORDER BY et.endTimestampUTC DESC) AS rn
      FROM dbo.EntityTelemetry et
      JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
      WHERE et.entityId = ?
        AND (et.numericValue IS NOT NULL OR et.stringValue IS NOT NULL)
    )
    SELECT entityTypeAttributeId, entityTypeAttributeCode, entityTypeAttributeName,
           defaultInGraph, numericValue, stringValue, endTimestampUTC
    FROM LatestPerAttribute 
    WHERE rn = 1
    ORDER BY entityTypeAttributeCode
    """
    
    entity_id = '234567891'
    print(f"Executing query for entity_id={entity_id!r}")
    cur.execute(query, (entity_id,))
    rows = cur.fetchall()
    print(f"OK: {len(rows)} rows")
    for r in rows[:3]:
        print(f"  {r}")
    
    conn.close()
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
