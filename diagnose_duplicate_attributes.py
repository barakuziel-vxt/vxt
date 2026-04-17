#!/usr/bin/env python3
"""
Diagnostic script to identify the source of duplicate telemetry attributes.
Checks:
1. EntityTypeAttribute table for duplicate attribute codes
2. EntityTelemetry table for entries referencing duplicate attributes
3. GetEntityTelemetry API response
4. EntityTelemetryRNPage rendering
"""

import os
from dotenv import load_dotenv
import json
from collections import defaultdict

# Load environment variables from .env
load_dotenv()

# Get connection string from environment
SQL_CONNECTION_STRING = os.getenv('SQL_CONNECTION_STRING')

def connect_db():
    """Connect to local SQL Server database"""
    try:
        if not SQL_CONNECTION_STRING:
            print("❌ SQL_CONNECTION_STRING not set in environment")
            return None
        
        import pyodbc
        # Convert connection string format if needed
        # From: Server=localhost,1433;Database=xyz;UID=sa;PWD=xxx;...
        # To: ODBC format
        conn_str = SQL_CONNECTION_STRING
        if 'Server=' in conn_str and 'UID=' in conn_str:
            # Already in correct format, just add ODBC driver
            conn_str = 'Driver={ODBC Driver 17 for SQL Server};' + conn_str
        
        print(f"🔌 Connecting to database...")
        print(f"   Connection string: {conn_str[:80]}...")
        
        conn = pyodbc.connect(conn_str)
        print(f"✓ Connected successfully\n")
        return conn
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print(f"   SQL_CONNECTION_STRING: {SQL_CONNECTION_STRING[:100]}")
        return None

def check_duplicate_attributes(conn):
    """Check for duplicate attribute codes in EntityTypeAttribute"""
    print("\n" + "="*80)
    print("1. CHECKING EntityTypeAttribute TABLE FOR DUPLICATES")
    print("="*80)
    
    try:
        cursor = conn.cursor()
        
        # Find all attributes with code containing 'RPM', 'ENG TEMP', 'WASTE WATER'
        query = """
        SELECT 
            entityTypeAttributeId,
            entityTypeId,
            protocolId,
            entityTypeAttributeCode,
            entityTypeAttributeName,
            entityTypeAttributeUnit
        FROM dbo.EntityTypeAttribute
        WHERE entityTypeAttributeCode LIKE '%rpm%' 
           OR entityTypeAttributeCode LIKE '%revolutions%'
           OR entityTypeAttributeName LIKE '%RPM%'
           OR entityTypeAttributeCode LIKE '%temperature%'
           OR entityTypeAttributeCode LIKE '%ENG%'
           OR entityTypeAttributeName LIKE '%ENG TEMP%'
           OR entityTypeAttributeCode LIKE '%wasteWater%'
           OR entityTypeAttributeName LIKE '%WASTE WATER%'
        ORDER BY entityTypeAttributeCode, entityTypeAttributeName
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        if not rows:
            print("❓ No attributes found with RPM, ENG TEMP, or WASTE WATER keywords")
            return
        
        print(f"\n✓ Found {len(rows)} attribute entries matching keywords:\n")
        
        # Group by attribute name
        by_name = defaultdict(list)
        by_code = defaultdict(list)
        
        for row in rows:
            attr_id, entity_type_id, proto_id, code, name, unit = row
            by_name[name].append((attr_id, code, unit, entity_type_id, proto_id))
            by_code[code].append((attr_id, name, unit, entity_type_id, proto_id))
            
            print(f"  ID: {attr_id:3d} | Code: {code:40s} | Name: {name:30s} | Unit: {unit}")
        
        # Find duplicates
        print(f"\n{'─'*80}")
        print("DUPLICATE ANALYSIS:")
        print(f"{'─'*80}")
        
        duplicates_found = False
        
        for name, entries in by_name.items():
            if len(entries) > 1:
                duplicates_found = True
                print(f"\n⚠️  DUPLICATE NAME: '{name}' appears {len(entries)} times:")
                for attr_id, code, unit, etype_id, proto_id in entries:
                    print(f"     ID: {attr_id:3d} | Code: {code:40s} | EntityTypeId: {etype_id} | ProtocolId: {proto_id}")
        
        for code, entries in by_code.items():
            if len(entries) > 1:
                duplicates_found = True
                print(f"\n⚠️  DUPLICATE CODE: '{code}' appears {len(entries)} times:")
                for attr_id, name, unit, etype_id, proto_id in entries:
                    print(f"     ID: {attr_id:3d} | Name: {name:30s} | EntityTypeId: {etype_id} | ProtocolId: {proto_id}")
        
        if not duplicates_found:
            print("\n✓ No duplicate attribute names or codes found in EntityTypeAttribute table")
        
        cursor.close()
        
    except Exception as e:
        print(f"❌ Error querying EntityTypeAttribute: {e}")


def check_telemetry_usage(conn):
    """Check how many times each attribute is used in EntityTelemetry"""
    print("\n" + "="*80)
    print("2. CHECKING EntityTelemetry TABLE - ATTRIBUTE USAGE")
    print("="*80)
    
    try:
        cursor = conn.cursor()
        
        query = """
        SELECT 
            eta.entityTypeAttributeId,
            eta.entityTypeAttributeCode,
            eta.entityTypeAttributeName,
            COUNT(*) as telemetry_count,
            COUNT(DISTINCT et.entityId) as unique_entities
        FROM dbo.EntityTelemetry et
        JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
        GROUP BY eta.entityTypeAttributeId, eta.entityTypeAttributeCode, eta.entityTypeAttributeName
        HAVING eta.entityTypeAttributeCode LIKE '%rpm%' 
            OR eta.entityTypeAttributeCode LIKE '%revolutions%'
            OR eta.entityTypeAttributeName LIKE '%RPM%'
            OR eta.entityTypeAttributeCode LIKE '%temperature%'
            OR eta.entityTypeAttributeName LIKE '%ENG TEMP%'
            OR eta.entityTypeAttributeCode LIKE '%wasteWater%'
            OR eta.entityTypeAttributeName LIKE '%WASTE WATER%'
        ORDER BY eta.entityTypeAttributeName
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        if not rows:
            print("❓ No telemetry data found for target attributes")
            return
        
        print(f"\n✓ Telemetry usage by attribute:\n")
        print(f"{'ID':<5} {'Code':<40} {'Name':<30} {'Records':<10} {'Entities'}")
        print(f"{'─'*5} {'─'*40} {'─'*30} {'─'*10} {'─'*8}")
        
        for row in rows:
            attr_id, code, name, count, entity_count = row
            print(f"{attr_id:<5} {code:<40} {name:<30} {count:<10} {entity_count}")
        
        cursor.close()
        
    except Exception as e:
        print(f"❌ Error querying EntityTelemetry: {e}")


def check_api_response_for_entity(conn, entity_id='Shula'):
    """Check what the GetEntityTelemetry API would return for a test entity"""
    print("\n" + "="*80)
    print(f"3. SIMULATING GetEntityTelemetry API FOR ENTITY: {entity_id}")
    print("="*80)
    
    try:
        cursor = conn.cursor()
        
        # First find an entity by name
        find_entity = "SELECT TOP 1 entityId FROM dbo.Entity WHERE entityFirstName = ? OR entityName = ?"
        cursor.execute(find_entity, entity_id, entity_id)
        entity_row = cursor.fetchone()
        
        if not entity_row:
            print(f"❓ Entity '{entity_id}' not found in database")
            cursor.close()
            return
        
        actual_entity_id = entity_row[0]
        print(f"✓ Found entity: {actual_entity_id} ({entity_id})")
        
        # Simulate the API query from main.py /api/telemetry/latest/{entity_id}
        query = """
        WITH LatestPerAttribute AS (
          SELECT
            eta.entityTypeAttributeId,
            eta.entityTypeAttributeCode,
            eta.entityTypeAttributeName,
            eta.entityTypeAttributeUnit,
            eta.defaultInGraph,
            et.numericValue,
            et.stringValue,
            et.endTimestampUTC,
            pa.protocolAttributeCode,
            pa.description,
            ROW_NUMBER() OVER (PARTITION BY eta.entityTypeAttributeId ORDER BY et.endTimestampUTC DESC) AS rn
          FROM dbo.EntityTelemetry et WITH (NOLOCK)
          JOIN dbo.EntityTypeAttribute eta WITH (NOLOCK) ON et.entityTypeAttributeId = eta.entityTypeAttributeId
          LEFT JOIN dbo.ProtocolAttribute pa WITH (NOLOCK) ON eta.protocolId = pa.protocolId 
            AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
          WHERE et.entityId = ?
            AND (et.numericValue IS NOT NULL OR et.stringValue IS NOT NULL)
        )
        SELECT 
          entityTypeAttributeId,
          entityTypeAttributeCode,
          entityTypeAttributeName,
          entityTypeAttributeUnit,
          defaultInGraph,
          numericValue,
          stringValue,
          endTimestampUTC,
          protocolAttributeCode,
          description
        FROM LatestPerAttribute 
        WHERE rn = 1
        ORDER BY entityTypeAttributeCode
        """
        
        cursor.execute(query, actual_entity_id)
        rows = cursor.fetchall()
        
        print(f"\n✓ API would return {len(rows)} attributes:\n")
        print(f"{'ID':<5} {'Code':<40} {'Name':<30} {'Value':<10} {'Unit':<10}")
        print(f"{'─'*5} {'─'*40} {'─'*30} {'─'*10} {'─'*10}")
        
        # Count by attribute name to see if there are duplicates in the response
        attr_count = defaultdict(int)
        attr_details = defaultdict(list)
        
        for row in rows:
            attr_id, code, name, unit, in_graph, num_val, str_val, ts, proto_code, desc = row
            print(f"{attr_id:<5} {code:<40} {name:<30} {str(num_val):<10} {unit:<10}")
            
            attr_count[name] += 1
            attr_details[name].append((attr_id, code))
        
        print(f"\n{'─'*80}")
        print("DUPLICATE ATTRIBUTES IN API RESPONSE:")
        print(f"{'─'*80}")
        
        duplicates = {name: count for name, count in attr_count.items() if count > 1}
        if duplicates:
            print(f"\n⚠️  Found {len(duplicates)} attribute names appearing more than once:\n")
            for name, count in duplicates.items():
                print(f"  '{name}' appears {count} times:")
                for attr_id, code in attr_details[name]:
                    print(f"    - ID: {attr_id:3d} | Code: {code}")
        else:
            print("\n✓ No duplicates found in API response")
        
        cursor.close()
        
    except Exception as e:
        print(f"❌ Error simulating API: {e}")


def main():
    conn = connect_db()
    if not conn:
        return
    
    try:
        print("\n" + "="*80)
        print("TELEMETRY DUPLICATE ATTRIBUTE DIAGNOSTIC TOOL")
        print("="*80)
        
        check_duplicate_attributes(conn)
        check_telemetry_usage(conn)
        check_api_response_for_entity(conn)
        
        print("\n" + "="*80)
        print("DIAGNOSTIC COMPLETE")
        print("="*80)
        
    finally:
        conn.close()


if __name__ == '__main__':
    main()
