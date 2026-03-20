#!/usr/bin/env python3
"""Check EntityTelemetry table schema"""
import pymssql
import os

conn_str = "Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;User Id=vxt;Password=Barak1976!;"

config = {}
for item in conn_str.split(';'):
    if '=' in item:
        key, value = item.split('=', 1)
        config[key.strip()] = value.strip()

try:
    conn = pymssql.connect(
        server=config['Server'].split(',')[0],
        port=int(config['Server'].split(',')[1]),
        database=config['Database'],
        user=config.get('User') or config.get('User Id'),
        password=config['Password'],
        timeout=30
    )
    
    print("=" * 80)
    print("EntityTelemetry Table Schema")
    print("=" * 80)
    
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'EntityTelemetry'
        ORDER BY ORDINAL_POSITION
    """)
    
    print(f"{'Column Name':<30} {'Data Type':<20} {'Nullable'}")
    print("-" * 70)
    
    for row in cursor:
        print(f"{row[0]:<30} {row[1]:<20} {row[2]}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
