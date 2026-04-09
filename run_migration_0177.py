#!/usr/bin/env python3
"""
Execute migration scripts 0177 on local SQL Server
Uses Windows authentication
"""
import os
import sys
import subprocess

migrations = [
    ('0177_A', 'db/sql/0177_A_Create_EntityIoTDevice.sql'),
    ('0177_B', 'db/sql/0177_B_Create_AppUser.sql'),
    ('0177_C', 'db/sql/0177_C_Create_UserApplication.sql'),
    ('0177_D', 'db/sql/0177_D_Create_UserAuthorization.sql'),
    ('0177_E', 'db/sql/0177_E_Create_UserAppPushNotification.sql'),
]

print("\n" + "="*60)
print("Migration 0177 Executor")
print("="*60 + "\n")

# Try to import pyodbc, install if needed
try:
    import pyodbc
except ImportError:
    print("Installing python-pyodbc...")
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-q', 'pyodbc'])
    import pyodbc

# Connection using Windows Authentication
try:
    print("Connecting to local SQL Server (vxtdb)...")
    conn = pyodbc.connect('Driver={ODBC Driver 18 for SQL Server};Server=.;Database=vxtdb;Trusted_Connection=yes;TrustServerCertificate=yes;')
    print("Connected!\n")
except pyodbc.Error as e:
    print(f"Connection failed: {e}\n")
    sys.exit(1)

cursor = conn.cursor()
success_count = 0

for name, filepath in migrations:
    print(f"[{name}] Executing {os.path.basename(filepath)}...", end=' ', flush=True)
    
    if not os.path.exists(filepath):
        print(f"File not found!")
        continue
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # Remove GO statements and split into batches
        batches = sql_script.split('\nGO')
        
        for batch in batches:
            batch = batch.strip()
            if batch and not batch.startswith('--'):
                cursor.execute(batch)
        
        conn.commit()
        print("OK")
        success_count += 1
        
    except Exception as e:
        print(f"FAILED: {str(e)[:50]}")
        try:
            conn.rollback()
        except:
            pass

cursor.close()
conn.close()

print(f"\n{'='*60}")
print(f"Result: {success_count}/5 scripts executed successfully")
print(f"{'='*60}\n")

if success_count == 5:
    print("SUCCESS! All tables created:")
    print("  1. EntityIoTDevice")
    print("  2. AppUser")
    print("  3. UserApplication")
    print("  4. UserAuthorization")
    print("  5. UserAppPushNotification")
    sys.exit(0)
else:
    print(f"PARTIAL: Only {success_count}/5 completed")
    sys.exit(1)
