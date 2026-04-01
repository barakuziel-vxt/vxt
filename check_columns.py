"""Check EntityTelemetry columns via pyodbc"""
import struct, pyodbc, subprocess, sys

result = subprocess.run(
    'az account get-access-token --resource "https://database.windows.net/" --query accessToken -o tsv',
    capture_output=True, text=True, shell=True
)
token = result.stdout.strip()
token_bytes = token.encode('utf-16-le')
token_struct = struct.pack('<I', len(token_bytes)) + token_bytes
conn_str = 'Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;Encrypt=yes;TrustServerCertificate=no;'
conn = pyodbc.connect(conn_str, attrs_before={1256: token_struct}, timeout=30)
cur = conn.cursor()

# Get column names from EntityTelemetry
cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='EntityTelemetry' ORDER BY ORDINAL_POSITION")
rows = cur.fetchall()
print("EntityTelemetry columns:")
for r in rows:
    print(f"  {r[0]:40} {r[1]}")
    
conn.close()
