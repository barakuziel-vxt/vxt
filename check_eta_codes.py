#!/usr/bin/env python3
"""Quick script to check EntityTypeAttribute codes in DB"""
from mssql_python import connect
import os
from dotenv import load_dotenv

load_dotenv()

conn_str = f"Server={os.getenv('DB_SERVER', 'localhost')},1433;Database={os.getenv('DB_NAME', 'free-sql-db-5949639')};UID={os.getenv('DB_USER', 'vxt')};PWD={os.getenv('DB_PASSWORD', 'Barak1976!')};Encrypt=no;TrustServerCertificate=yes;"

conn = connect(conn_str)
cursor = conn.cursor()

print("\n=== EntityTypeAttribute codes in DB ===")
cursor.execute('''
    SELECT DISTINCT eta.entityTypeAttributeCode
    FROM EntityTypeAttribute eta
    ORDER BY eta.entityTypeAttributeCode
''')

codes = [row[0] for row in cursor.fetchall()]
print(f"Total unique codes: {len(codes)}")
for code in codes[:20]:
    print(f"  {code}")
if len(codes) > 20:
    print(f"  ... and {len(codes)-20} more")

conn.close()
