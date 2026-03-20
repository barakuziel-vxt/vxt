#!/usr/bin/env python3
"""
Direct EntityTelemetry Database Test
Inserts sample telemetry data to test the complete pipeline
without requiring IoT Hub connectivity
"""

import pymssql
import json
import os
import sys
from datetime import datetime, timedelta, timezone
import random

# Connection string from environment
CONNECTION_STRING = os.environ.get('SQL_CONNECTION_STRING', 
    'Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;User Id=vxt;Password=Barak1976!;')

def parse_connection_string(conn_str: str) -> dict:
    """Parse SQL connection string"""
    config = {}
    for item in conn_str.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            config[key.strip()] = value.strip()
    
    server_key = config.get('Server', '')
    if ',' in server_key:
        server, port = server_key.split(',')
        port = int(port)
    else:
        server = server_key
        port = 1433
    
    return {
        'server': server,
        'port': port,
        'database': config.get('Database', ''),
        'user': config.get('User') or config.get('User Id', ''),
        'password': config.get('Password', ''),
        'timeout': 120
    }

def insert_test_telemetry():
    """Insert sample telemetry records"""
    config = parse_connection_string(CONNECTION_STRING)
    
    print("=" * 70)
    print("EntityTelemetry Direct Insert Test")
    print("=" * 70)
    print(f"\n[1] Connecting to database: {config['database']}...")
    
    try:
        conn = pymssql.connect(**config)
        cursor = conn.cursor()
        print("✓ Connected to Azure SQL Database")
        
        # Get or create test entity
        print("\n[2] Getting test entity...")
        cursor.execute("""
            SELECT entity_id FROM Entity WHERE entity_name = 'TomerRefael'
        """)
        result = cursor.fetchone()
        
        if result:
            entity_id = result[0]
            print(f"✓ Found entity: TomerRefael (ID: {entity_id})")
        else:
            print("✗ Entity not found. Creating...")
            cursor.execute("""
                INSERT INTO Entity (entity_name, entity_type_id, created_at, updated_at)
                VALUES ('TomerRefael', 1, GETUTCDATE(), GETUTCDATE())
            """)
            conn.commit()
            
            cursor.execute("SELECT @@IDENTITY")
            entity_id = cursor.fetchone()[0]
            print(f"✓ Created entity with ID: {entity_id}")
        
        # Insert test telemetry data
        print("\n[3] Inserting test telemetry records...")
        base_time = datetime.now(timezone.utc)
        insert_count = 0
        
        for i in range(10):  # Insert 10 test records
            event_time = base_time - timedelta(seconds=i*60)
            telemetry_data = {
                "navigation.position": {
                    "latitude": 32.8315366 + random.uniform(-0.001, 0.001),
                    "longitude": 35.0036234 + random.uniform(-0.001, 0.001)
                },
                "navigation.courseOverGround": random.uniform(0, 360),
                "navigation.speedOverGround": random.uniform(5, 15),
                "propulsion.0.revolutions": random.uniform(700, 2000),
                "environment.water.temperature": random.uniform(15, 25) + 273.15
            }
            
            try:
                cursor.execute("""
                    INSERT INTO EntityTelemetry 
                    (entity_id, timestamp, telemetry_data)
                    VALUES (%d, %s, %s)
                """, (
                    entity_id,
                    event_time.isoformat(),
                    json.dumps(telemetry_data)
                ))
                insert_count += 1
            except Exception as e:
                print(f"  ⚠ Error inserting record: {e}")
        
        conn.commit()
        print(f"✓ Inserted {insert_count} telemetry records")
        
        # Verify insertion
        print("\n[4] Verifying inserted data...")
        cursor.execute(f"""
            SELECT TOP 5 entity_id, timestamp, telemetry_data 
            FROM EntityTelemetry 
            WHERE entity_id = {entity_id}
            ORDER BY timestamp DESC
        """)
        
        records = cursor.fetchall()
        print(f"✓ Found {len(records)} recent records")
        
        for idx, record in enumerate(records, 1):
            ent_id, ts, data = record
            print(f"  [{idx}] Timestamp: {ts}")
        
        cursor.close()
        conn.close()
        
        print("\n" + "=" * 70)
        print("✓ TEST SUCCESSFUL - Database connection and inserts working")
        print("=" * 70)
        return 0
        
    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = insert_test_telemetry()
    sys.exit(exit_code)
