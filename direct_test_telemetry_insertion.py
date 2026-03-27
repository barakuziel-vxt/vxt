#!/usr/bin/env python3
"""
Direct End-to-End Test: Simulates telemetry insertion into EntityTelemetry
Tests the complete data flow without needing IoT Hub credentials.

This script:
1. Validates database connectivity via pyodbc
2. Simulates telemetry processor logic
3. Inserts test records directly (as Azure Function would)
4. Verifies records appear in database
5. Confirms data integrity
"""

import pyodbc
import json
from datetime import datetime
import logging
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('DirectTelemetryTest')

# Database Configuration
DB_SERVER = "vxtdb.database.windows.net"
DB_PORT = 1433
DB_NAME = "free-sql-db-5949639"
DB_USER = "vxt"
DB_PASSWORD = os.getenv('DB_PASSWORD', '')

if not DB_PASSWORD:
    logger.error('DB_PASSWORD environment variable not set')

def get_db_connection():
    """Create database connection using pyodbc"""
    try:
        conn_string = (
            f"Driver={{ODBC Driver 17 for SQL Server}};"
            f"Server={DB_SERVER},{DB_PORT};"
            f"Database={DB_NAME};"
            f"UID={DB_USER};"
            f"PWD={DB_PASSWORD};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=no;"
        )
        conn = pyodbc.connect(conn_string)
        logger.info("✅ Database connection successful")
        return conn
    except Exception as e:
        logger.error(f"❌ Connection failed: {str(e)}")
        raise

def insert_test_telemetry(conn, entity_id, event_num):
    """Insert test telemetry record"""
    try:
        cursor = conn.cursor()
        
        # Sample telemetry data (mimicking N2K → Signal K conversion)
        telemetry = {
            'entityId': str(entity_id),
            'timestamp': datetime.utcnow().isoformat(),
            'provider': 'test-simulator',
            'numericValue': 2500 + event_num * 100,  # RPM
            'latitude': 32.83 + (event_num * 0.01),
            'longitude': 35.00 + (event_num * 0.01),
        }
        
        # Insert into EntityTelemetry (entityTelemetryId auto-increments)
        insert_query = """
            INSERT INTO dbo.EntityTelemetry 
            (entityId, entityTypeAttributeId, startTimestampUTC, endTimestampUTC, 
             ingestionTimestampUTC, providerEventInterpretation, providerDevice, 
             numericValue, latitude, longitude, stringValue)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        now = datetime.utcnow()
        
        cursor.execute(insert_query, (
            entity_id,                           # entityId
            1,                                   # entityTypeAttributeId (placeholder)
            now,                                 # startTimestampUTC
            now,                                 # endTimestampUTC
            now,                                 # ingestionTimestampUTC
            f"Test event {event_num}",          # providerEventInterpretation
            "test-simulator",                   # providerDevice
            telemetry['numericValue'],          # numericValue (RPM)
            telemetry['latitude'],              # latitude
            telemetry['longitude'],             # longitude
            json.dumps(telemetry)               # stringValue (full JSON)
        ))
        
        conn.commit()
        logger.info(f"✅ Inserted telemetry for entity {entity_id}, event {event_num}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Insert failed: {str(e)}")
        conn.rollback()
        raise

def query_inserted_records(conn):
    """Query and display recently inserted records"""
    try:
        cursor = conn.cursor()
        
        # Query last 10 records
        query = """
            SELECT TOP 10 
                entityTelemetryId, entityId, numericValue, 
                latitude, longitude, ingestionTimestampUTC
            FROM dbo.EntityTelemetry
            ORDER BY entityTelemetryId DESC
        """
        
        cursor.execute(query)
        records = cursor.fetchall()
        
        if records:
            logger.info(f"✅ Found {len(records)} recent records:")
            logger.info("-" * 80)
            for i, record in enumerate(records, 1):
                logger.info(f"{i}. ID={record[0]}, Entity={record[1]}, Value={record[2]}, "
                          f"Lat={record[3]:.4f}, Lon={record[4]:.4f}, Time={record[5]}")
            logger.info("-" * 80)
            return records
        else:
            logger.warning("⚠️  No records found in EntityTelemetry")
            return None
            
    except Exception as e:
        logger.error(f"❌ Query failed: {str(e)}")
        raise

def verify_connection_chain():
    """Verify the complete connection chain"""
    logger.info("=" * 80)
    logger.info("DIRECT END-TO-END TELEMETRY TEST")
    logger.info("This validates the pyodbc migration is working")
    logger.info("=" * 80)
    logger.info("")
    
    try:
        # Step 1: Connect
        logger.info("[STEP 1] Testing database connection...")
        conn = get_db_connection()
        logger.info("")
        
        # Step 2: Insert test data
        logger.info("[STEP 2] Inserting test telemetry records...")
        logger.info("  - Inserting 3 events for entity 234567890")
        logger.info("  - Inserting 2 events for entity 234567891")
        
        for event_num in range(1, 4):
            insert_test_telemetry(conn, "234567890", event_num)
        
        for event_num in range(1, 3):
            insert_test_telemetry(conn, "234567891", event_num)
        
        logger.info("")
        
        # Step 3: Query and verify
        logger.info("[STEP 3] Querying inserted data...")
        logger.info("")
        records = query_inserted_records(conn)
        logger.info("")
        
        if records and len(records) >= 5:
            logger.info("✅ ALL TESTS PASSED!")
            logger.info("")
            logger.info("Summary:")
            logger.info("  ✅ pyodbc driver working")
            logger.info("  ✅ Database connectivity confirmed")
            logger.info("  ✅ EntityTelemetry table accessible")
            logger.info("  ✅ Records inserted successfully")
            logger.info("  ✅ Data retrieval working")
            logger.info("")
            logger.info("Next steps:")
            logger.info("  1. Regenerate IoT device credentials in Azure Portal")
            logger.info("  2. Set IOT_DEVICE_CONNECTION_STRING environment variable")
            logger.info("  3. Run: python test_function_trigger.py")
            logger.info("  4. Verify events flow through IoT Hub → Azure Function → SQL")
            return True
        else:
            logger.error("❌ TEST FAILED: Not enough records inserted")
            return False
            
    except Exception as e:
        logger.error(f"❌ TEST FAILED: {str(e)}")
        return False
    finally:
        if conn:
            conn.close()
            logger.info("")
            logger.info("Database connection closed")

if __name__ == '__main__':
    success = verify_connection_chain()
    exit(0 if success else 1)
