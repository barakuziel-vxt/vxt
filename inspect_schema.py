"""Inspect DB schema to get correct column names."""
import os, sys
from dotenv import load_dotenv
load_dotenv()
sys.path.insert(0, 'azure-functions')
from mssql_python import connect

conn = connect(os.environ['SQL_CONNECTION_STRING'])
cur = conn.cursor()

for table in ['Protocol', 'ProtocolAttribute', 'EntityCategory', 'EntityType',
              'EntityTypeAttribute', 'Entity']:
    cur.execute(
        "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_NAME=? ORDER BY ORDINAL_POSITION",
        (table,)
    )
    rows = cur.fetchall()
    print(f"\n=== {table} ===")
    for r in rows:
        print(f"  {r[0]}  ({r[1]})")

conn.close()
