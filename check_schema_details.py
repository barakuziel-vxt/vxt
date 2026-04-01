"""Check ProtocolAttribute columns"""
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

# Check ProtocolAttribute columns
cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='ProtocolAttribute' ORDER BY ORDINAL_POSITION")
rows = cur.fetchall()
print("ProtocolAttribute columns:")
for r in rows:
    print(f"  {r[0]:40} {r[1]}")

# Check EventLog columns
cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='EventLog' ORDER BY ORDINAL_POSITION")
rows = cur.fetchall()
print("\nEventLog columns:")
for r in rows:
    print(f"  {r[0]:40} {r[1]}")

# Check ProtocolAttribute exists
cur.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('ProtocolAttribute','EventLog','EventLogDetails') ORDER BY TABLE_NAME")
rows = cur.fetchall()
print("\nTables found:", [r[0] for r in rows])

# Check Event table columns
cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Event' ORDER BY ORDINAL_POSITION")
rows = cur.fetchall()
print("\nEvent columns:")
for r in rows:
    print(f"  {r[0]:40} {r[1]}")

conn.close()
