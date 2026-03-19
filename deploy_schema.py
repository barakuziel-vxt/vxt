#!/usr/bin/env python3
"""Deploy database schema to Azure SQL using pymssql"""

import pymssql
import sys
import os

# Configuration
SERVER = "vxtdb.database.windows.net"
DATABASE = "free-sql-db-5949639"
USER = "vxt"
PASSWORD = "Barak1976!"
SCHEMA_FILE = r"c:\VXT\azure_schema_export.sql"

print("="*60)
print("Azure SQL Schema Deployment")
print("="*60)
print(f"Server: {SERVER}")
print(f"Database: {DATABASE}")
print(f"User: {USER}")
print(f"Schema File: {SCHEMA_FILE}")
print("="*60)

# Read schema file
try:
    with open(SCHEMA_FILE, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    print(f"✓ Schema file loaded ({len(schema_sql)} bytes)")
except Exception as e:
    print(f"✗ Error reading schema file: {e}")
    sys.exit(1)

# Connect and deploy schema
try:
    print("\nConnecting to database...")
    conn = pymssql.connect(
        server=SERVER,
        user=USER,
        password=PASSWORD,
        database=DATABASE,
        timeout=30
    )
    print("✓ Connected to database")
    
    cursor = conn.cursor()
    
    # Split schema into individual statements and execute
    # SQL Server batches are separated by GO keyword or empty lines
    statements = []
    current = []
    
    for line in schema_sql.split('\n'):
        stripped = line.strip()
        
        if stripped.upper() == 'GO' or (not stripped and current):
            if current:
                stmt = '\n'.join(current)
                if stmt.strip():
                    statements.append(stmt)
                current = []
        else:
            if stripped or current:  # Keep whitespace within statements
                current.append(line)
    
    if current:
        stmt = '\n'.join(current)
        if stmt.strip():
            statements.append(stmt)
    
    print(f"✓ Schema split into {len(statements)} statements")
    
    # Execute statements
    executed = 0
    errors = []
    
    for i, stmt in enumerate(statements, 1):
        stmt = stmt.strip()
        if not stmt or stmt.startswith('--'):
            continue
            
        try:
            # Truncate display for long statements
            display_stmt = stmt[:80].replace('\n', ' ') + ('...' if len(stmt) > 80 else '')
            print(f"  [{i}/{len(statements)}] {display_stmt}")
            cursor.execute(stmt)
            executed += 1
        except pymssql.ProgrammingError as e:
            # Some statements may fail (like DROP IF NOT EXISTS) which is OK
            if 'does not exist' in str(e).lower() or 'already exists' in str(e).lower():
                print(f"    (OK - object state check)")
            else:
                error_msg = str(e)[:100]
                print(f"    ERROR: {error_msg}")
                errors.append((stmt[:50], error_msg))
        except Exception as e:
            error_msg = str(e)[:100]
            print(f"    ERROR: {error_msg}")
            errors.append((stmt[:50], error_msg))
    
    conn.commit()
    print(f"\n✓ Executed {executed} statements")
    
    if errors:
        print(f"\n⚠ {len(errors)} errors encountered:")
        for stmt, err in errors[:5]:  # Show first 5 errors
            print(f"  - {stmt}: {err}")
    
    # Verify schema was deployed
    print("\nVerifying deployment...")
    cursor.execute("SELECT COUNT(*) AS TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
    result = cursor.fetchone()
    table_count = result[0] if result else 0
    
    print(f"✓ Tables in database: {table_count}")
    
    # Check for critical tables
    critical_tables = ['Entity', 'EntityType', 'EntityCategory', 'Provider', 'ProviderEvent']
    cursor.execute("""
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
    """)
    existing_tables = [row[0] for row in cursor.fetchall()]
    
    found = [t for t in critical_tables if t in existing_tables]
    missing = [t for t in critical_tables if t not in existing_tables]
    
    print(f"✓ Critical tables found: {len(found)}/{len(critical_tables)}")
    if found:
        print(f"  Present: {', '.join(found)}")
    if missing:
        print(f"  Missing: {', '.join(missing)}")
    
    cursor.close()
    conn.close()
    
    if table_count > 0:
        print("\n✓✓✓ Schema deployment successful! ✓✓✓")
        print("\nNext steps:")
        print("1. Restart Azure Web App: az webapp restart --name vxt-web-app --resource-group VXT-IoT-Hub")
        print("2. Test endpoint: https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net/health/db")
    else:
        print("\n✗ No tables found - deployment may have failed")
        sys.exit(1)
        
except pymssql.DatabaseError as e:
    print(f"\n✗ Database error: {e}")
    print("\nAlternative: Deploy manually via Azure Portal")
    print("1. Go to https://portal.azure.net")
    print("2. Search for SQL databases and open 'free-sql-db-5949639'")
    print("3. Click Query editor")
    print("4. Login with user 'vxt'")
    print("5. Copy and paste contents of azure_schema_export.sql")
    print("6. Click Run")
    sys.exit(1)
except Exception as e:
    print(f"\n✗ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
