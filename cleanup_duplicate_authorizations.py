#!/usr/bin/env python3
"""
Clean up duplicate UserAuthorization records.
Keeps the most recent (highest userAuthorizationId) for each (userId, customerId, entityId) combination.
"""

import pyodbc
import os
from dotenv import load_dotenv

load_dotenv()

# Database connection
server = os.getenv('DB_SERVER', 'localhost')
database = os.getenv('DB_NAME', 'vxtdb')
username = os.getenv('DB_USER', 'sa')
password = os.getenv('DB_PASSWORD')

print(f"Connecting to {server}/{database}...")
conn = pyodbc.connect(f'Driver={{ODBC Driver 17 for SQL Server}};Server={server};Database={database};UID={username};PWD={password}')
cur = conn.cursor()

try:
    # Find duplicate groups
    print("\n[1] Finding duplicate UserAuthorization records...")
    cur.execute("""
        SELECT userId, customerId, entityId, COUNT(*) AS cnt
        FROM dbo.UserAuthorization
        GROUP BY userId, customerId, entityId
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
    """)
    
    duplicates = cur.fetchall()
    if not duplicates:
        print("✓ No duplicates found.")
        cur.close()
        conn.close()
        exit(0)
    
    print(f"Found {len(duplicates)} groups with duplicates:\n")
    total_rows_to_delete = 0
    for row in duplicates:
        user_id, customer_id, entity_id, count = row
        print(f"  userId={user_id}, customerId={customer_id}, entityId={entity_id}: {count} records")
        total_rows_to_delete += (count - 1)
    
    print(f"\nTotal rows to delete: {total_rows_to_delete}\n")
    
    # Clean up: for each duplicate group, delete all but the most recent
    print("[2] Deleting duplicate records (keeping the most recent by userAuthorizationId)...\n")
    
    deleted_count = 0
    for row in duplicates:
        user_id, customer_id, entity_id, count = row
        
        # Find the userAuthorizationId of the record to KEEP (highest ID = most recent)
        cur.execute("""
            SELECT MAX(userAuthorizationId) FROM dbo.UserAuthorization
            WHERE userId = ? AND customerId = ? AND entityId = ?
        """, (user_id, customer_id, entity_id))
        
        keep_id = cur.fetchone()[0]
        
        # Delete all others in this group
        cur.execute("""
            DELETE FROM dbo.UserAuthorization
            WHERE userId = ? AND customerId = ? AND entityId = ? AND userAuthorizationId != ?
        """, (user_id, customer_id, entity_id, keep_id))
        
        deleted = cur.rowcount
        deleted_count += deleted
        print(f"  userId={user_id}, customerId={customer_id}, entityId={entity_id}: deleted {deleted} duplicate(s), kept ID={keep_id}")
    
    conn.commit()
    
    print(f"\n✓ Successfully deleted {deleted_count} duplicate records.")
    print("\n[3] Verifying cleanup...")
    
    cur.execute("""
        SELECT COUNT(*) FROM (
            SELECT userId, customerId, entityId, COUNT(*) AS cnt
            FROM dbo.UserAuthorization
            GROUP BY userId, customerId, entityId
            HAVING COUNT(*) > 1
        ) AS duplicates
    """)
    
    remaining_duplicates = cur.fetchone()[0]
    if remaining_duplicates == 0:
        print("✓ All duplicates removed. Database is clean.")
    else:
        print(f"⚠ Warning: {remaining_duplicates} duplicate groups still exist.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
