"""Test telemetry CTE query using mssql-python (same driver as production)"""
import subprocess
import sys

# Get AAD token via subprocess
result = subprocess.run(
    'az account get-access-token --resource "https://database.windows.net/" --query accessToken -o tsv',
    capture_output=True, text=True, shell=True
)
token = result.stdout.strip()
if not token:
    print("Failed to get AAD token:", result.stderr[:200])
    sys.exit(1)
print(f"Got token ({len(token)} chars)")

try:
    from mssql_python import connect

    conn_str = (
        "Server=vxtdb.database.windows.net,1433;"
        "Database=free-sql-db-5949639;"
        "UID=vxt;"
        "PWD=xK9@mP2#wQ5!rL8$tN3vZ7&;"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
    )
    conn = connect(conn_str)
    print("Connected via mssql-python")
    cur = conn.cursor()
    
    # Test the CTE query from main.py
    query = """
    WITH LatestPerAttribute AS (
      SELECT
        eta.entityTypeAttributeId,
        eta.entityTypeAttributeCode,
        eta.entityTypeAttributeName,
        eta.entityTypeAttributeUnit,
        eta.defaultInGraph,
        et.numericValue,
        et.stringValue,
        et.endTimestampUTC,
        pa.protocolAttributeCode,
        pa.description,
        ROW_NUMBER() OVER (PARTITION BY eta.entityTypeAttributeId ORDER BY et.endTimestampUTC DESC) AS rn
      FROM dbo.EntityTelemetry et
      JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
      LEFT JOIN dbo.ProtocolAttribute pa ON eta.protocolId = pa.protocolId 
        AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
      WHERE et.entityId = ?
        AND (et.numericValue IS NOT NULL OR et.stringValue IS NOT NULL)
    )
    SELECT 
      entityTypeAttributeId,
      entityTypeAttributeCode,
      entityTypeAttributeName,
      entityTypeAttributeUnit,
      defaultInGraph,
      numericValue,
      stringValue,
      endTimestampUTC,
      protocolAttributeCode,
      description
    FROM LatestPerAttribute 
    WHERE rn = 1
    ORDER BY entityTypeAttributeCode
    """
    
    print("Executing CTE query...")
    cur.execute(query, ('234567891',))
    rows = cur.fetchall()
    print(f"OK: {len(rows)} rows")
    for r in rows[:3]:
        print(f"  {r}")
    conn.close()

except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
