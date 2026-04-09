#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Compare EntityTypeAttribute between Local DB and Azure SQL
Identify missing attributes and generate sync script
"""

import pyodbc
import sys
import os

# Set UTF-8 encoding for output
os.environ['PYTHONIOENCODING'] = 'utf-8'

# Local DB Connection
LOCAL_SERVER = "localhost"
LOCAL_DATABASE = "free-sql-db-5949639"
LOCAL_UID = "sa"
LOCAL_PWD = "YourStrongPassword123!"

LOCAL_CONN_STR = f"Driver={{ODBC Driver 17 for SQL Server}};Server={LOCAL_SERVER};Database={LOCAL_DATABASE};Uid={LOCAL_UID};Pwd={LOCAL_PWD};Encrypt=no;"

# Azure SQL Connection
AZURE_SERVER = "vxtdb.database.windows.net"
AZURE_DATABASE = "free-sql-db-5949639"
AZURE_UID = "vxt"
AZURE_PWD = "Barak1976!"

AZURE_CONN_STR = f"Driver={{ODBC Driver 17 for SQL Server}};Server={AZURE_SERVER},1433;Database={AZURE_DATABASE};Uid={AZURE_UID};Pwd={AZURE_PWD};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"

ENTITY_TYPES = [4, 5, 6, 7]

def connect_to_db(conn_str, db_name):
    """Connect to database"""
    try:
        conn = pyodbc.connect(conn_str, timeout=30)
        conn.setdecoding(pyodbc.SQL_CHAR, encoding='utf-8')
        conn.setdecoding(pyodbc.SQL_WCHAR, encoding='utf-8')
        conn.setencoding(encoding='utf-8')
        return conn
    except Exception as e:
        print(f"✗ Failed to connect to {db_name}: {e}")
        return None

def get_attributes(conn, entity_types):
    """Get all EntityTypeAttribute records"""
    cursor = conn.cursor()
    
    entity_types_str = ",".join(str(et) for et in entity_types)
    query = f"""
    SELECT 
        entityTypeAttributeId,
        entityTypeId,
        entityTypeAttributeCode,
        entityTypeAttributeName,
        entityTypeAttributeTimeAspect,
        entityTypeAttributeUnit,
        providerId,
        providerEventType,
        active
    FROM EntityTypeAttribute
    WHERE entityTypeId IN ({entity_types_str})
    ORDER BY entityTypeId, entityTypeAttributeCode
    """
    
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # Convert to dict keyed by (entityTypeId, entityTypeAttributeCode)
        attributes = {}
        for row in rows:
            key = (row[1], row[2])  # (entityTypeId, code)
            attributes[key] = {
                'id': row[0],
                'name': row[3],
                'timeAspect': row[4],
                'unit': row[5],
                'providerId': row[6],
                'providerEventType': row[7],
                'active': row[8]
            }
        
        return attributes
    except Exception as e:
        print(f"Error querying attributes: {e}")
        return {}
    finally:
        cursor.close()

def get_max_id(conn):
    """Get max entityTypeAttributeId from Azure"""
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT ISNULL(MAX(entityTypeAttributeId), 0) FROM EntityTypeAttribute")
        result = cursor.fetchone()
        return result[0] if result else 0
    except Exception as e:
        print(f"Error getting max ID: {e}")
        return 0
    finally:
        cursor.close()

def main():
    print("\n" + "="*80)
    print("EntityTypeAttribute Sync: Local DB vs Azure SQL")
    print("="*80)
    
    # Connect to both databases
    print("\nConnecting to databases...")
    local_conn = connect_to_db(LOCAL_CONN_STR, "Local DB")
    azure_conn = connect_to_db(AZURE_CONN_STR, "Azure SQL")
    
    if not local_conn or not azure_conn:
        sys.exit(1)
    
    print("Connected to both databases\n")
    
    # Get attributes
    print("Fetching EntityTypeAttribute records...")
    local_attrs = get_attributes(local_conn, ENTITY_TYPES)
    azure_attrs = get_attributes(azure_conn, ENTITY_TYPES)
    
    print(f"✓ Local DB:  {len(local_attrs)} attributes")
    print(f"✓ Azure SQL: {len(azure_attrs)} attributes\n")
    
    # Compare
    print("="*80)
    print("COMPARISON RESULTS")
    print("="*80)
    
    missing_in_azure = []
    different_in_azure = []
    
    for key, local_data in local_attrs.items():
        entity_type, code = key
        
        if key not in azure_attrs:
            missing_in_azure.append((entity_type, code, local_data))
        else:
            azure_data = azure_attrs[key]
            # Check if attributes differ
            if local_data != azure_data:
                different_in_azure.append((entity_type, code, local_data, azure_data))
    
    # Report missing
    if missing_in_azure:
        print(f"\nMISSING IN AZURE ({len(missing_in_azure)} attributes):\n")
        for entity_type, code, data in missing_in_azure:
            print(f"  Entity Type {entity_type}: {code}")
            print(f"    Name: {data['name']}")
            print(f"    Unit: {data['unit']}")
            print(f"    Provider: {data['providerId']}, Event: {data['providerEventType']}")
    else:
        print("\nNo missing attributes")
    
    # Report different
    if different_in_azure:
        print(f"\nDIFFERENT IN AZURE ({len(different_in_azure)} attributes):\n")
        for entity_type, code, local_data, azure_data in different_in_azure:
            print(f"  Entity Type {entity_type}: {code}")
            for field in ['name', 'timeAspect', 'unit', 'providerId', 'providerEventType', 'active']:
                local_val = local_data.get(field)
                azure_val = azure_data.get(field)
                if local_val != azure_val:
                    print(f"    {field}:")
                    print(f"      Local:  {local_val}")
                    print(f"      Azure:  {azure_val}")
    else:
        print("\nAll attributes match")
    
    # Generate INSERT statements
    if missing_in_azure:
        print("\n" + "="*80)
        print("SQL SYNC SCRIPT: INSERT MISSING ATTRIBUTES INTO AZURE")
        print("="*80 + "\n")
        
        max_id = get_max_id(azure_conn)
        next_id = max_id + 1
        
        print(f"-- Starting from ID {next_id} (current max: {max_id})\n")
        print("INSERT INTO EntityTypeAttribute")
        print("(entityTypeAttributeId, entityTypeId, entityTypeAttributeCode, entityTypeAttributeName,")
        print(" entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active)")
        print("VALUES\n")
        
        for i, (entity_type, code, data) in enumerate(missing_in_azure):
            name = data['name'].replace("'", "''") if data.get('name') else ''
            time_aspect = data.get('timeAspect', 'Pt') or 'Pt'
            unit = (data.get('unit', '') or '').replace("'", "''")
            provider_id = data.get('providerId')
            provider_event = (data.get('providerEventType') or '').replace("'", "''")
            active = data.get('active', 'Y')
            
            comma = "," if i < len(missing_in_azure) - 1 else ";"
            
            print(f"({next_id}, {entity_type}, '{code}', '{name}',")
            print(f" '{time_aspect}', '{unit}', {provider_id if provider_id else 'NULL'}, '{provider_event}', '{active}'){comma}")
            
            next_id += 1
    
    # Generate UPDATE statements
    if different_in_azure:
        print("\n" + "="*80)
        print("SQL SYNC SCRIPT: UPDATE DIFFERENT ATTRIBUTES IN AZURE")
        print("="*80 + "\n")
        
        for entity_type, code, local_data, azure_data in different_in_azure:
            print(f"-- Entity Type {entity_type}: {code}")
            print(f"UPDATE EntityTypeAttribute SET")
            
            updates = []
            for field in ['name', 'timeAspect', 'unit', 'providerId', 'providerEventType', 'active']:
                local_val = local_data.get(field)
                azure_val = azure_data.get(field)
                if local_val != azure_val:
                    if field == 'name':
                        val_str = f"'{local_val.replace(chr(39), chr(39)*2)}'"
                    elif field in ['providerId']:
                        val_str = str(local_val) if local_val else 'NULL'
                    else:
                        val_str = f"'{str(local_val).replace(chr(39), chr(39)*2)}'"
                    
                    sql_field = 'entityTypeAttributeName' if field == 'name' else \
                                'entityTypeAttributeTimeAspect' if field == 'timeAspect' else \
                                'entityTypeAttributeUnit' if field == 'unit' else \
                                'providerId' if field == 'providerId' else \
                                'providerEventType' if field == 'providerEventType' else 'active'
                    
                    updates.append(f"  {sql_field} = {val_str}")
            
            if updates:
                print(",\n".join(updates))
                print(f"WHERE entityTypeId = {entity_type} AND entityTypeAttributeCode = '{code}';\n")
    
    print("\n" + "="*80)
    print("Comparison complete")
    print("="*80 + "\n")
    
    local_conn.close()
    azure_conn.close()

if __name__ == "__main__":
    main()
