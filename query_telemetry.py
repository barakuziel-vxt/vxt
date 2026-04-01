"""Query EntityTelemetry to verify rows were inserted."""
import subprocess, struct, pyodbc

result = subprocess.run(
    'az account get-access-token --resource https://database.windows.net --query accessToken -o tsv',
    shell=True, capture_output=True, text=True
)
token = result.stdout.strip()
token_bytes = token.encode('utf-16-le')
access_token = struct.pack('I', len(token_bytes)) + token_bytes
SQL_COPT_SS_ACCESS_TOKEN = 1256

conn_str = (
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=vxtdb.database.windows.net,1433;'
    'DATABASE=free-sql-db-5949639;'
    'Encrypt=yes;TrustServerCertificate=no;'
)
conn = pyodbc.connect(conn_str, attrs_before={SQL_COPT_SS_ACCESS_TOKEN: access_token})
cursor = conn.cursor()

cursor.execute("""
    SELECT TOP 20
        entityTelemetryId,
        entityId,
        entityTypeAttributeId,
        startTimestampUTC,
        providerDevice,
        numericValue,
        latitude,
        longitude
    FROM dbo.EntityTelemetry
    ORDER BY ingestionTimestampUTC DESC
""")
rows = cursor.fetchall()
print(f"Total rows returned: {len(rows)}")
print()
print(f"{'ID':>6} | {'entityId':^12} | {'attrId':>6} | {'timestamp':^23} | {'device':^15} | {'numVal':>10} | {'lat':>8} | {'lon':>8}")
print("-" * 110)
for r in rows:
    print(f"{r[0]:>6} | {str(r[1]):^12} | {r[2]:>6} | {str(r[3]):^23} | {str(r[4]):^15} | {str(round(r[5],4) if r[5] else ''):>10} | {str(round(r[6],4) if r[6] else ''):>8} | {str(round(r[7],4) if r[7] else ''):>8}")

cursor.execute("SELECT COUNT(*) FROM dbo.EntityTelemetry")
total = cursor.fetchone()[0]
print(f"\nTotal rows in EntityTelemetry: {total}")

conn.close()
