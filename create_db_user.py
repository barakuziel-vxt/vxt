#!/usr/bin/env python3
"""
Create database user from Azure Managed Identity
This registers the vxt-web-app managed identity as a SQL database user
"""

from mssql_python import connect

print("=" * 60)
print("Creating SQL Database User from Managed Identity")
print("=" * 60)

try:
    # Connect as admin (SQL authentication)
    print("\n1. Connecting to Azure SQL Database...")
    conn = connect(
        "Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;UID=vxt;PWD=Barak1976!;Encrypt=yes;TrustServerCertificate=no;"
    )
    print("   ✓ Connected successfully")
    
    cursor = conn.cursor()
    
    # Create user from Managed Identity
    print("\n2. Creating user from Managed Identity...")
    try:
        cursor.execute("CREATE USER [vxt-web-app] FROM EXTERNAL PROVIDER;")
        print("   ✓ User [vxt-web-app] created")
    except Exception as e:
        if "already exists" in str(e):
            print("   ✓ User [vxt-web-app] already exists")
        else:
            print(f"   ⚠ Error: {e}")
    
    # Add db_datareader role
    print("\n3. Assigning database roles...")
    try:
        cursor.execute("ALTER ROLE db_datareader ADD MEMBER [vxt-web-app];")
        print("   ✓ Added db_datareader role")
    except Exception as e:
        print(f"   ⚠ db_datareader: {e}")
    
    # Add db_datawriter role
    try:
        cursor.execute("ALTER ROLE db_datawriter ADD MEMBER [vxt-web-app];")
        print("   ✓ Added db_datawriter role")
    except Exception as e:
        print(f"   ⚠ db_datawriter: {e}")
    
    # Verify user exists
    print("\n4. Verifying user creation...")
    cursor.execute("SELECT name, type_desc FROM sys.database_principals WHERE name = 'vxt-web-app';")
    result = cursor.fetchone()
    if result:
        print(f"   ✅ User verified: {result}")
    else:
        print("   ❌ User not found")
    
    # Check tables
    print("\n5. Checking database schema...")
    cursor.execute("SELECT COUNT(*) as table_count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE';")
    count = cursor.fetchone()
    print(f"   ✓ Database contains {count[0]} tables")
    
    if count[0] > 0:
        cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;")
        tables = cursor.fetchall()
        print(f"   Tables: {', '.join([t[0] for t in tables[:5]])}")
        if len(tables) > 5:
            print(f"           ... and {len(tables) - 5} more")
    
    conn.close()
    
    print("\n" + "=" * 60)
    print("✅ Database configuration complete!")
    print("=" * 60)
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
