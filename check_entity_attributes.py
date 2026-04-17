#!/usr/bin/env python3
"""
Check for duplicate attribute names with different codes in EntityTypeAttribute.
"""

import pyodbc
import os
from dotenv import load_dotenv

load_dotenv()

server = os.getenv('DB_SERVER', 'localhost')
database = os.getenv('DB_NAME', 'vxtdb')
username = os.getenv('DB_USER', 'sa')
password = os.getenv('DB_PASSWORD')

conn = pyodbc.connect(f'Driver={{ODBC Driver 17 for SQL Server}};Server={server};Database={database};UID={username};PWD={password}')
cur = conn.cursor()

print('Checking for duplicate attribute names with different codes in EntityTypeAttribute...\n')

# Find attribute names that have multiple different codes
cur.execute("""
    SELECT 
        entityTypeAttributeName,
        COUNT(DISTINCT entityTypeAttributeCode) AS unique_codes,
        COUNT(*) AS total_records
    FROM dbo.EntityTypeAttribute
    GROUP BY entityTypeAttributeName
    HAVING COUNT(DISTINCT entityTypeAttributeCode) > 1
    ORDER BY unique_codes DESC, total_records DESC
""")

duplicates = cur.fetchall()

if not duplicates:
    print('✓ No duplicate attribute names with different codes found.')
    cur.close()
    conn.close()
    exit(0)

print(f'Found {len(duplicates)} attribute names with multiple different codes:\n')
print('='*100)

for attr_name, unique_codes, total_records in duplicates:
    print(f'\nAttribute Name: "{attr_name}"')
    print(f'  Unique Codes: {unique_codes}, Total Records: {total_records}')
    print(f'  {"-"*96}')
    
    # Get all records for this attribute name
    cur.execute("""
        SELECT 
            entityTypeAttributeId,
            entityTypeId,
            entityTypeAttributeCode,
            entityTypeAttributeName,
            entityTypeAttributeUnit,
            entityTypeAttributeTimeAspect,
            active
        FROM dbo.EntityTypeAttribute
        WHERE entityTypeAttributeName = ?
        ORDER BY entityTypeAttributeCode
    """, (attr_name,))
    
    records = cur.fetchall()
    for rec in records:
        attr_id, et_id, code, name, unit, time_aspect, active = rec
        print(f'    ID={attr_id:4d} | EntityTypeId={et_id:2d} | Code="{code:12s}" | Unit="{unit:10s}" | TimeAspect="{time_aspect:6s}" | Active={active}')

print('\n' + '='*100)

cur.close()
conn.close()

