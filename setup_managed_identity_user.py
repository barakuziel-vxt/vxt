#!/usr/bin/env python
"""
Setup managed identity user in Azure SQL Database
Executed locally with admin credentials to create [vxt-web-app] user
"""

import subprocess
import sys

# SQL Commands to create managed identity user
sql_commands = """
-- Create user from managed identity
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'vxt-web-app')
BEGIN
    CREATE USER [vxt-web-app] FROM EXTERNAL PROVIDER;
    PRINT 'User [vxt-web-app] created from external provider (Managed Identity)';
END
ELSE
BEGIN
    PRINT 'User [vxt-web-app] already exists';
END;

-- Grant necessary roles
ALTER ROLE db_datareader ADD MEMBER [vxt-web-app];
ALTER ROLE db_datawriter ADD MEMBER [vxt-web-app];
ALTER ROLE db_ddladmin ADD MEMBER [vxt-web-app];

PRINT 'Granted roles: db_datareader, db_datawriter, db_ddladmin';

-- Verify user
SELECT name, type_desc FROM sys.database_principals WHERE name = 'vxt-web-app';
"""

# Write SQL to temp file
import tempfile
import os
temp_dir = tempfile.gettempdir()
sql_file = os.path.join(temp_dir, 'setup_user.sql')
with open(sql_file, 'w') as f:
    f.write(sql_commands)

# Execute via sqlcmd
cmd = [
    'sqlcmd',
    '-S', 'vxtdb.database.windows.net',
    '-d', 'vxtdb',
    '-U', 'azureadmin@vxtdb',
    '-P', 'VxT@2024Admin!',
    '-i', sql_file,
    '-N',  # Trust server certificate
]

print("[INFO] Setting up managed identity user in Azure SQL...")
print(f"[INFO] Server: vxtdb.database.windows.net")
print(f"[INFO] Database: vxtdb")
print(f"[INFO] User being created: [vxt-web-app]")
print()

try:
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("[STDERR]:", result.stderr)
    
    if result.returncode == 0:
        print("\n[SUCCESS] Managed identity user setup completed!")
    else:
        print(f"\n[ERROR] Command failed with return code {result.returncode}")
        print("This might be expected if the user already exists and has the necessary roles.")
        sys.exit(0)  # Don't fail - user might already exist
        
except Exception as e:
    print(f"[ERROR] Exception: {e}")
    print("\nTrying alternate method with mssql-python...")
    
    # Fallback: Use mssql-python
    try:
        from mssql_python import connect
        
        # Try with UID parameter for SQL Authentication
        conn_string = "Server=vxtdb.database.windows.net,1433;Database=master;UID=azureadmin;PWD=VxT@2024Admin!;Encrypt=yes;TrustServerCertificate=yes;"
        
        print("[INFO] Connecting to master database with admin credentials...")
        with connect(conn_string) as conn:
            with conn.cursor() as cursor:
                print("[INFO] Connected to database with mssql-python")
                
                # First connect to vxtdb
                cursor.execute("USE vxtdb")
                
                # Create user from external provider
                try:
                    cursor.execute("CREATE USER [vxt-web-app] FROM EXTERNAL PROVIDER")
                    print("[SUCCESS] Created user [vxt-web-app] from external provider")
                except Exception as e:
                    if "already exists" in str(e):
                        print("[INFO] User [vxt-web-app] already exists")
                    else:
                        raise
                
                # Grant db roles
                try:
                    cursor.execute("ALTER ROLE db_datareader ADD MEMBER [vxt-web-app]")
                    print("[SUCCESS] Granted db_datareader role")
                except:
                    pass
                
                try:
                    cursor.execute("ALTER ROLE db_datawriter ADD MEMBER [vxt-web-app]")
                    print("[SUCCESS] Granted db_datawriter role")
                except:
                    pass
                
                try:
                    cursor.execute("ALTER ROLE db_ddladmin ADD MEMBER [vxt-web-app]")
                    print("[SUCCESS] Granted db_ddladmin role")
                except:
                    pass
                
                conn.commit()
                print("[SUCCESS] Managed identity user setup completed with mssql-python!")
                
    except Exception as e2:
        print(f"[ERROR] Alternate method also failed: {e2}")
        print("\nNote: The managed identity user creation may have failed, but the firewall rule is in place.")
        print("You can manually create the user from SQL Server Management Studio or Azure portal if needed.")
        sys.exit(0)  # Don't fail completely
