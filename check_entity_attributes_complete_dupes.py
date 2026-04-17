#!/usr/bin/env python3
"""
Check for complete duplicates in EntityTypeAttribute (same code and name).
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

print('Checking for complete duplicates (same code AND name)...\n')

cur.execute("""
    SELECT 
        entityTypeAttributeCode,
        entityTypeAttributeName,
        COUNT(*) AS record_count
    FROM dbo.EntityTypeAttribute
    GROUP BY entityTypeAttributeCode, entityTypeAttributeName
    HAVING COUNT(*) > 1
    ORDER BY record_count DESC
""")

duplicates = cur.fetchall()

if not duplicates:
    print('✓ No complete duplicate records (same code and name) found.')
else:
    print(f'Found {len(duplicates)} code+name combinations with multiple records:\n')
    print('='*100)
    
    for code, name, count in duplicates:
        print(f'\nCode: "{code}" | Name: "{name}" | Records: {count}')
        print(f'  {"-"*96}')
        
        cur.execute("""
            SELECT 
                entityTypeAttributeId,
                entityTypeId,
                protocolId,
                providerId,
                entityTypeAttributeUnit,
                active,
                createDate
            FROM dbo.EntityTypeAttribute
            WHERE entityTypeAttributeCode = ? AND entityTypeAttributeName = ?
            ORDER BY entityTypeAttributeId
        """, (code, name))
        
        for rec in cur.fetchall():
            attr_id, et_id, proto_id, prov_id, unit, active, create_date = rec
            print(f'    ID={attr_id:4d} | EntityTypeId={et_id:2d} | ProtocolId={proto_id} | ProviderId={prov_id} | Unit="{unit}" | Active={active} | Created={create_date.strftime("%Y-%m-%d")}')
    
    print('\n' + '='*100)

cur.close()
conn.close()
