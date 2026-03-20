#!/usr/bin/env python3
import pymssql
import sys

def test_connection():
    server = "vxtdb.database.windows.net"
    user = "vxt"
    password = "Barak1976!"
    database = "free-sql-db-5949639"
    
    print(f"Testing pymssql connection...")
    print(f"Server: {server}")
    print(f"Database: {database}")
    print(f"User: {user}")
    print()
    
    try:
        print("Attempting to connect...")
        conn = pymssql.connect(
            server=server,
            user=user,
            password=password,
            database=database,
            timeout=30
        )
        print("✓ Connection successful!")
        
        # Test a simple query
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES")
        count = cursor.fetchone()[0]
        print(f"✓ Tables in database: {count}")
        
        conn.close()
        return True
    except Exception as e:
        print(f"✗ Connection failed!")
        print(f"Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
