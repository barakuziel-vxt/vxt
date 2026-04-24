"""Run migration 0040 and verify results."""
import os, sys
from dotenv import load_dotenv
load_dotenv()
os.environ.setdefault('ENVIRONMENT', 'local')
sys.path.insert(0, 'azure-functions')

from mssql_python import connect

conn_str = os.environ.get(
    'SQL_CONNECTION_STRING',
    'Server=localhost,1433;Database=free-sql-db-5949639;UID=sa;PWD=YourStrongPassword123!;Encrypt=no;TrustServerCertificate=yes;'
)
conn = connect(conn_str)
cur = conn.cursor()

with open('cinfirm/migrations/0040_Add_SARJ1979_Automotive_Protocol.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

cur.execute(sql)
conn.commit()
print('Migration applied successfully.')

# Verify
cur.execute("SELECT COUNT(*) FROM dbo.ProtocolAttribute WHERE protocolId = (SELECT protocolId FROM dbo.Protocol WHERE protocolName='SARJ1979')")
row = cur.fetchone()
print(f'ProtocolAttribute rows for SARJ1979: {row[0]}')

cur.execute("SELECT COUNT(*) FROM dbo.EntityTypeAttribute WHERE entityTypeId=(SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName='Car')")
row = cur.fetchone()
print(f'EntityTypeAttribute rows for Car: {row[0]}')

cur.execute("SELECT entityId, entityFirstName, entityLastName FROM dbo.Entity WHERE entityId='KM8J33A41GU000001'")
row = cur.fetchone()
print(f'Entity HundayTuson 2016: {row}')

cur.execute("SELECT COUNT(*), MAX(ingestionTimestampUTC) FROM dbo.EntityTelemetry WHERE entityId='KM8J33A41GU000001'")
row = cur.fetchone()
print(f'EntityTelemetry rows for KM8J33A41GU000001: {row[0]}, last ingested: {row[1]}')

conn.close()
