#!/usr/bin/env python3
"""Check if vxt-function database user exists and verify privileges"""

try:
    from mssql_python import connect
    
    # Connect using Managed Identity
    conn = connect(
        server='vxtdb.database.windows.net',
        database='vxtdb',
        authentication='ActiveDirectoryMSI',
        timeout=10
    )
    cursor = conn.cursor()
    
    # Check if user exists
    cursor.execute("SELECT name, type, authentication_type FROM sys.database_principals WHERE name = 'vxt-function'")
    result = cursor.fetchone()
    
    if result:
        print('✓ User exists')
        print(f'  Name: {result[0]}')
        print(f'  Type: {result[1]} (E=External)')
        print(f'  Auth Type: {result[2]}')
        
        # Check role membership
        cursor.execute("""
        SELECT r.name 
        FROM sys.database_role_members rm
        JOIN sys.database_principals r ON rm.role_principal_id = r.principal_id
        JOIN sys.database_principals m ON rm.member_principal_id = m.principal_id
        WHERE m.name = 'vxt-function'
        """)
        
        roles = cursor.fetchall()
        print('\n✓ Role memberships:')
        if roles:
            for role in roles:
                print(f'  - {role[0]}')
        else:
            print('  (none - needs setup)')
    else:
        print('✗ User does not exist')
    
    conn.close()

except ImportError:
    print('✗ mssql-python not installed')
except Exception as e:
    print(f'✗ Error: {str(e)[:200]}')
