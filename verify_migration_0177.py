#!/usr/bin/env python3
"""
Verify migration 0177 - Check if all tables were created successfully
"""
import subprocess
import sys
import json

def check_tables(server, database):
    """Query to verify all tables exist"""
    query = """
    SELECT 
        name AS TableName,
        CASE WHEN OBJECT_ID('dbo.' + name) IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS Status
    FROM (
        SELECT 'EntityIoTDevice' AS name
        UNION ALL SELECT 'AppUser'
        UNION ALL SELECT 'UserApplication'
        UNION ALL SELECT 'UserAuthorization'
        UNION ALL SELECT 'UserAppPushNotification'
    ) t
    WHERE OBJECT_ID('dbo.' + name) IS NOT NULL
    """
    
    try:
        ps_command = f"""
$result = sqlcmd -S "{server}" -d "{database}" -Q "{query}" -h -1 2>&1
Write-Host $result
"""
        result = subprocess.run(
            ['powershell', '-NoProfile', '-Command', ps_command],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("✓ Query executed successfully")
            print(result.stdout)
            return True
        else:
            print(f"✗ Query failed: {result.stderr[:200]}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def get_table_details(server, database, table_name):
    """Get column details for a table"""
    query = f"""
    SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        IS_NULLABLE,
        COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '{table_name}' AND TABLE_SCHEMA = 'dbo'
    ORDER BY ORDINAL_POSITION
    """
    
    try:
        ps_command = f"""
$result = sqlcmd -S "{server}" -d "{database}" -Q "{query}" -h -1 2>&1
Write-Host $result
"""
        result = subprocess.run(
            ['powershell', '-NoProfile', '-Command', ps_command],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return result.stdout
        else:
            return None
    except:
        return None

if __name__ == '__main__':
    print("=" * 70)
    print("Migration 0177 - Verification Script")
    print("=" * 70)
    
    # Try to connect to local database
    servers_to_try = [
        ('(localdb)\\mssqllocaldb', 'LocalDB'),
        ('localhost', 'Local SQL Server'),
        ('.', 'Named Pipe'),
    ]
    
    database = 'vxtdb'
    
    for server, desc in servers_to_try:
        print(f"\nAttempting to connect to: {desc} ({server})...")
        print("-" * 70)
        
        if check_tables(server, database):
            print(f"\n✓ Successfully connected to {desc}")
            print("\nChecking table structures...")
            
            tables = [
                'EntityIoTDevice',
                'AppUser',
                'UserApplication',
                'UserAuthorization',
                'UserAppPushNotification'
            ]
            
            for table in tables:
                print(f"\n{table}:")
                details = get_table_details(server, database, table)
                if details:
                    print(details)
            
            sys.exit(0)
    
    print("\n" + "=" * 70)
    print("✗ Could not connect to any SQL Server instance")
    print("=" * 70)
    print("\nTo manually execute the scripts:")
    print("1. Open SQL Server Management Studio")
    print("2. Connect to your local SQL Server")
    print("3. Open and execute each script in order:")
    print("   - db/sql/0177_A_Create_EntityIoTDevice.sql")
    print("   - db/sql/0177_B_Create_AppUser.sql")
    print("   - db/sql/0177_C_Create_UserApplication.sql")
    print("   - db/sql/0177_D_Create_UserAuthorization.sql")
    print("   - db/sql/0177_E_Create_UserAppPushNotification.sql")
    sys.exit(1)
