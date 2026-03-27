#!/usr/bin/env python3
"""Check vxt-function database user and privileges"""

try:
    from mssql_python import connect
    
    # Connect using SQL Server authentication (not Managed Identity)
    # The parameters should be passed directly
    conn = connect(
        server='vxtdb.database.windows.net',
        database='free-sql-db-5949639',
        user='vxt',
        password='Barak1976!'
    )
    cursor = conn.cursor()
    
    # Check if vxt-function user exists
    cursor.execute("SELECT name, type, authentication_type FROM sys.database_principals WHERE name = 'vxt-function'")
    result = cursor.fetchone()
    
    if result:
        print('✓ User [vxt-function] EXISTS')
        print(f'  Type: {result[1]} (E=External, S=SQL User)')
        print(f'  Auth Type: {result[2]}')
        
        # Check role membership
        cursor.execute("""
        SELECT r.name 
        FROM sys.database_role_members rm
        JOIN sys.database_principals r ON rm.role_principal_id = r.principal_id
        JOIN sys.database_principals m ON rm.member_principal_id = m.principal_id
        WHERE m.name = 'vxt-function'
        ORDER BY r.name
        """)
        
        roles = cursor.fetchall()
        print(f'\n✓ Role Memberships: {len(roles)} role(s)')
        if roles:
            for role in roles:
                print(f'  - {role[0]}')
        else:
            print('  (none assigned - NEEDS FIX)')
    else:
        print('✗ User [vxt-function] DOES NOT EXIST - needs creation')
        print('\nNeed to run:')
        print('  CREATE USER [vxt-function] FROM EXTERNAL PROVIDER;')
        print('  ALTER ROLE db_datareader ADD MEMBER [vxt-function];')
        print('  ALTER ROLE db_datawriter ADD MEMBER [vxt-function];')
    
    conn.close()

except ImportError as e:
    print(f'✗ Missing mssql-python: {str(e)}')
    print('Install with: pip install mssql-python')
except Exception as e:
    print(f'✗ Error: {str(e)[:250]}')
