#!/usr/bin/env python3
"""
Execute all 5 migration scripts on local SQL Server database
Scripts: 0177_A through 0177_E
"""
import subprocess
import sys
import os

# List of migration scripts to execute in order
migration_scripts = [
    'db/sql/0177_A_Create_EntityIoTDevice.sql',
    'db/sql/0177_B_Create_AppUser.sql',
    'db/sql/0177_C_Create_UserApplication.sql',
    'db/sql/0177_D_Create_UserAuthorization.sql',
    'db/sql/0177_E_Create_UserAppPushNotification.sql',
]

# Try different local SQL Server connection strings
local_servers = [
    '(localdb)\\mssqllocaldb',
    'localhost',
    '.',
]

def execute_script(script_path, server):
    """Execute a single script using PowerShell"""
    script_path = os.path.abspath(script_path)
    
    if not os.path.exists(script_path):
        print(f"  ✗ Script not found: {script_path}")
        return False
    
    try:
        # Use PowerShell to execute sqlcmd
        ps_command = f"""
$output = sqlcmd -S "{server}" -d "vxtdb" -i "{script_path}" -h -1 2>&1
Write-Host $output
if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}
"""
        
        result = subprocess.run(
            ['powershell', '-NoProfile', '-Command', ps_command],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            # Print output minus the header row
            if result.stdout:
                lines = result.stdout.strip().split('\n')
                for line in lines[-3:]:  # Show last 3 lines (usually the PRINT output)
                    if line.strip():
                        print(f"     {line}")
            return True
        else:
            error_msg = result.stderr if result.stderr else result.stdout
            print(f"  ✗ Error: {error_msg[:100]}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"  ✗ Timeout executing script")
        return False
    except Exception as e:
        print(f"  ✗ Error: {str(e)[:100]}")
        return False

def main():
    print("=" * 60)
    print("Migration 0177: Creating User & Device Tables")
    print("=" * 60)
    
    # Find working local server
    working_server = None
    print("\nFinding local SQL Server...")
    
    for server in local_servers:
        try:
            # Quick connection test
            test_cmd = f'sqlcmd -S "{server}" -d "vxtdb" -Q "SELECT 1" -h -1'
            result = subprocess.run(
                ['powershell', '-NoProfile', '-Command', test_cmd],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                working_server = server
                print(f"✓ Connected to: {server}")
                break
        except:
            continue
    
    if not working_server:
        print("✗ Could not connect to any local SQL Server instance")
        print("  Make sure SQL Server is running and database 'vxtdb' exists")
        sys.exit(1)
    
    # Execute each script
    print("\nExecuting migration scripts...")
    results = []
    
    for i, script in enumerate(migration_scripts, 1):
        script_name = os.path.basename(script)
        print(f"\n[{i}/5] {script_name}")
        success = execute_script(script, working_server)
        results.append((script_name, success))
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    successful = sum(1 for _, s in results if s)
    total = len(results)
    
    for script, success in results:
        status = "✓" if success else "✗"
        print(f"{status} {script}")
    
    print(f"\n{successful}/{total} scripts executed successfully")
    
    if successful == total:
        print("\n✓ All tables created successfully!")
        print("\nTables created:")
        print("  1. EntityIoTDevice")
        print("  2. AppUser")
        print("  3. UserApplication")
        print("  4. UserAuthorization")
        print("  5. UserAppPushNotification")
        return 0
    else:
        print("\n✗ Some scripts failed. Check errors above.")
        return 1

if __name__ == '__main__':
    sys.exit(main())
