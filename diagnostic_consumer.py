"""
Diagnostic Consumer - Check Kafka Topic and Database Connection
This script will:
1. Check if data is arriving in the junction-events topic
2. Verify database connection
3. Show sample messages and identify parsing issues
"""

import json
from kafka import KafkaConsumer, KafkaAdminClient
from kafka.admin import ConfigResource, ConfigResourceType
import logging
import pyodbc
import time
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_kafka_topic():
    """Check if junction-events topic exists and has messages"""
    logger.info("=" * 70)
    logger.info("CHECKING KAFKA TOPIC")
    logger.info("=" * 70)
    
    try:
        # Try to read from topic
        logger.info("Connecting to Kafka broker at 127.0.0.1:9092...")
        consumer = KafkaConsumer(
            'junction-events',
            bootstrap_servers='127.0.0.1:9092',
            auto_offset_reset='earliest',
            enable_auto_commit=False,
            group_id='diagnostic-group',
            session_timeout_ms=10000,
            request_timeout_ms=30000,
            max_poll_records=5,
            consumer_timeout_ms=5000
        )
        
        logger.info("[OK] Connected to Kafka broker")
        logger.info("Waiting for messages (5 second timeout)...")
        
        message_count = 0
        for message in consumer:
            message_count += 1
            logger.info(f"\n{'='*70}")
            logger.info(f"MESSAGE #{message_count}")
            logger.info(f"{'='*70}")
            logger.info(f"Partition: {message.partition}, Offset: {message.offset}")
            
            try:
                event = json.loads(message.value.decode('utf-8'))
                logger.info(f"Event Type: {event.get('event_type', 'UNKNOWN')}")
                logger.info(f"User ID: {event.get('user', {}).get('user_id', 'UNKNOWN')}")
                logger.info(f"LOINC Code: {event.get('loinc_code', 'UNKNOWN')}")
                
                # Check data structure
                data = event.get('data', {})
                logger.info(f"Data keys: {list(data.keys())}")
                
                # Show first level of data structure
                for key, value in data.items():
                    if isinstance(value, dict):
                        logger.info(f"  - {key}: keys = {list(value.keys())}")
                        if 'detailed' in value:
                            detailed = value['detailed']
                            for detail_key, detail_value in detailed.items():
                                if isinstance(detail_value, list):
                                    logger.info(f"      - {detail_key}: {len(detail_value)} samples")
                                    if detail_value:
                                        logger.info(f"        First sample: {detail_value[0]}")
                
                logger.info(f"\nFull message:\n{json.dumps(event, indent=2)[:1000]}...")
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to decode JSON: {e}")
                logger.info(f"Raw message: {message.value[:200]}")
        
        if message_count == 0:
            logger.warning("⚠ NO MESSAGES FOUND in topic!")
            logger.warning("Possible issues:")
            logger.warning("  1. Producer (Simulate_Junction_health_provider.py) is not running")
            logger.warning("  2. Topic does not exist")
            logger.warning("  3. Topic has no recent messages")
        else:
            logger.info(f"\n[OK] Found {message_count} messages in topic")
        
        consumer.close()
        
    except Exception as e:
        logger.error(f"[ERROR] Kafka connection error: {e}")
        logger.error("Make sure Redpanda is running: docker-compose up -d")
        return False
    
    return True


def check_database_connection():
    """Check database connection and test insert"""
    logger.info("\n" + "=" * 70)
    logger.info("CHECKING DATABASE CONNECTION")
    logger.info("=" * 70)
    
    # Try different drivers
    drivers = [
        'ODBC Driver 17 for SQL Server',
        'ODBC Driver 18 for SQL Server',
        'SQL Server Native Client 11.0',
        'SQL Server Native Client 10.0',
        'SQL Server'
    ]
    
    for driver in drivers:
        try:
            conn_str = (
                f'DRIVER={{{driver}}};'
                f'SERVER=127.0.0.1;'
                f'DATABASE=BoatTelemetryDB;'
                f'UID=sa;'
                f'PWD=YourStrongPassword123!'
            )
            
            logger.info(f"Trying driver: {driver}...")
            conn = pyodbc.connect(conn_str)
            cursor = conn.cursor()
            logger.info(f"[OK] Successfully connected using {driver}")
            
            # Check if EntityTelemetry table exists
            cursor.execute("""
                SELECT COUNT(*) as col_count 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'EntityTelemetry'
            """)
            col_count = cursor.fetchone()[0]
            
            if col_count > 0:
                logger.info("[OK] EntityTelemetry table exists")
                
                # Get column info
                cursor.execute("""
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'EntityTelemetry'
                    ORDER BY ORDINAL_POSITION
                """)
                columns = [row[0] for row in cursor.fetchall()]
                logger.info(f"  Columns: {columns}")
                
                # Count existing records
                cursor.execute("SELECT COUNT(*) FROM EntityTelemetry")
                record_count = cursor.fetchone()[0]
                logger.info(f"  Current record count: {record_count}")
                
            else:
                logger.error("[ERROR] EntityTelemetry table not found!")
            
            # Test insert
            try:
                test_insert = """
                INSERT INTO EntityTelemetry 
                (entityId, loincCode, telemetryValue, telemetryUnit, telemetryTimestamp, source, active)
                VALUES (999999, '8867-4', '75', 'bpm', ?, 'diagnostic', 'Y')
                """
                cursor.execute(test_insert, (datetime.utcnow().isoformat(),))
                conn.commit()
                logger.info("[OK] Test insert successful (inserted diagnostic record)")
                
                # Delete test record
                cursor.execute("DELETE FROM EntityTelemetry WHERE entityId = 999999 AND source = 'diagnostic'")
                conn.commit()
                logger.info("  (diagnostic record deleted)")
                
            except Exception as e:
                logger.error(f"[ERROR] Test insert failed: {e}")
            
            conn.close()
            return True
            
        except Exception as e:
            logger.debug(f"  Driver {driver} failed: {e}")
            continue
    
    logger.error("[ERROR] No working ODBC driver found!")
    logger.error("Make sure SQL Server ODBC driver is installed")
    return False


def main():
    logger.info("Starting Diagnostic Consumer...")
    logger.info(f"Time: {datetime.now()}")
    
    kafka_ok = check_kafka_topic()
    db_ok = check_database_connection()
    
    logger.info("\n" + "=" * 70)
    logger.info("DIAGNOSTIC SUMMARY")
    logger.info("=" * 70)
    logger.info(f"Kafka Topic Check: {'[OK] PASS' if kafka_ok else '[FAILED] FAIL'}")
    logger.info(f"Database Check: {'[OK] PASS' if db_ok else '[FAILED] FAIL'}")
    
    if not kafka_ok:
        logger.info("\nAction: Start the producer")
        logger.info("  python.exe Simulate_Junction_health_provider.py")
    
    if not db_ok:
        logger.info("\nAction: Install ODBC SQL Server driver or check database connection")


if __name__ == '__main__':
    main()
