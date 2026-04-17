#!/usr/bin/env python3
"""
Fix Foreign Key Constraints on Azure SQL Server
This script fixes the incorrect foreign key references in AppUser, UserAuthorization, and UserAppPushNotification tables
"""

import sys
import os

# Try to use mssql-python (if available)
try:
    import mssql
    print("Using mssql-python driver")
    HAS_MSSQL = True
except ImportError:
    HAS_MSSQL = False
    try:
        import pyodbc
        print("Using pyodbc driver")
        HAS_PYODBC = True
    except ImportError:
        HAS_PYODBC = False

def get_mssql_connection():
    """Connect using mssql-python"""
    import mssql
    server = "vxtdb.database.windows.net"
    database = "free-sql-db-5949639"
    user = "azureuser"
    password = os.getenv("AZURE_SQL_PASSWORD", "")
    
    conn_str = f"Server={server};Database={database};UID={user};PWD={password};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
    return mssql.connect(conn_str)

def get_pyodbc_connection():
    """Connect using pyodbc"""
    import pyodbc
    server = "vxtdb.database.windows.net"
    database = "free-sql-db-5949639"
    user = "azureuser"
    password = os.getenv("AZURE_SQL_PASSWORD", "")
    
    conn_str = f"Driver={{ODBC Driver 17 for SQL Server}};Server={server};Database={database};UID={user};PWD={password};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
    return pyodbc.connect(conn_str)

def run_fix():
    """Run the foreign key fix"""
    
    # Read the fix SQL script
    with open("fix_foreign_keys.sql", "r") as f:
        fix_sql = f.read()
    
    # Connect to database
    try:
        if HAS_MSSQL:
            conn = get_mssql_connection()
        elif HAS_PYODBC:
            conn = get_pyodbc_connection()
        else:
            print("ERROR: No SQL connection library available")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: Failed to connect to database: {e}")
        sys.exit(1)
    
    try:
        cursor = conn.cursor()
        
        # Split by GO statements and execute each batch
        batches = fix_sql.split("GO\n")
        for i, batch in enumerate(batches):
            batch = batch.strip()
            if not batch:
                continue
            
            print(f"\n[Batch {i+1}] Executing...")
            try:
                cursor.execute(batch)
                conn.commit()
                print(f"[Batch {i+1}] ✓ Success")
            except Exception as e:
                print(f"[Batch {i+1}] ✗ Error: {e}")
                conn.rollback()
                continue
        
        print("\n=== Foreign Key Fix Complete ===")
        
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    print("Starting Foreign Key Constraint Fix...")
    print("Database: free-sql-db-5949639 on vxtdb.database.windows.net")
    print()
    
    run_fix()
