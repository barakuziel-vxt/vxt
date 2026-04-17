#!/usr/bin/env python3
"""
Check for duplicate attribute codes with different names in EntityTypeAttribute.
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

print('Checking for duplicate attribute codes with different names...\n')

cur.execute("""
    SELECT 
        entityTypeAttributeCode,
        COUNT(DISTINCT entityTypeAttributeName) AS unique_names,
        COUNT(*) AS total_records
    FROM dbo.EntityTypeAttribute
    GROUP BY entityTypeAttributeCode
    HAVING COUNT(DISTINCT entityTypeAttributeName) > 1
    ORDER BY unique_names DESC
""")

duplicates = cur.fetchall()

if not duplicates:
    print('✓ No duplicate codes with different names found.')
else:
    print(f'Found {len(duplicates)} codes with multiple different names:\n')
    print('='*100)
    
    for code, unique_names, total in duplicates:
        print(f'\nCode: "{code}" | Unique Names: {unique_names} | Total Records: {total}')
        print(f'  {"-"*96}')
        
        cur.execute("""
            SELECT 
                entityTypeAttributeId,
                entityTypeId,
                entityTypeAttributeCode,
                entityTypeAttributeName,
                entityTypeAttributeUnit,
                active
            FROM dbo.EntityTypeAttribute
            WHERE entityTypeAttributeCode = ?
            ORDER BY entityTypeAttributeName
        """, (code,))
        
        for rec in cur.fetchall():
            attr_id, et_id, attr_code, attr_name, unit, active = rec
            print(f'    ID={attr_id:4d} | EntityTypeId={et_id:2d} | Name="{attr_name:30s}" | Unit="{unit}" | Active={active}')
    
    print('\n' + '='*100)

cur.close()
conn.close()
