"""
Entity Telemetry Consumer
Consumes Junction bulk telemetry events from Kafka and inserts individual samples into EntityTelemetry table
Flattens nested sample arrays and performs bulk insert
"""

import json
from select import select
from kafka import KafkaConsumer
from datetime import datetime
import logging
import pyodbc
from typing import List, Dict, Tuple
import sys
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class EntityTelemetryConsumer:
    def __init__(self, 
        bootstrap_servers='127.0.0.1:9092',
        topic='junction-events',
        db_server='localhost',
        db_name='BoatTelemetryDB',
        db_user='sa',
        db_password='YourStrongPassword123!'):        
        self.topic = topic
        self.db_server = db_server
        self.db_name = db_name
        self.db_user = db_user
        self.db_password = db_password
        self.connection_string = (
            'DRIVER={SQL Server};'
            f'SERVER={db_server};'
            f'DATABASE={db_name};'
            f'UID={db_user};'
            f'PWD={db_password}'
        )
        
        logger.info(f"Connection string: SERVER={db_server}, DATABASE={db_name}")
        
        # Initialize Kafka consumer with retry logic
        self.consumer = self._init_kafka_consumer(bootstrap_servers, topic)
        
        self.batch_size = 50  # Lowered for testing - easier to see inserts
        self.event_buffer: List[Tuple] = []
        self.total_inserted = 0
        self.total_events_processed = 0
        
        logger.info(f"Consumer initialized - Topic: {topic}, Batch size: {self.batch_size}")
    
    def _init_kafka_consumer(self, bootstrap_servers, topic, max_retries=5):
        """Initialize Kafka consumer with retry logic"""
        for attempt in range(max_retries):
            try:
                logger.info(f"Connecting to Kafka (attempt {attempt + 1}/{max_retries})...")
                consumer = KafkaConsumer(
                    topic,
                    bootstrap_servers=bootstrap_servers,
                    value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                    group_id='entity-telemetry-group',
                    auto_offset_reset='earliest',
                    enable_auto_commit=False,
                    max_poll_records=100,
                    session_timeout_ms=10000,
                    request_timeout_ms=30000,
                    consumer_timeout_ms=-1  # Wait indefinitely for messages
                )
                logger.info("[OK] Connected to Kafka broker")
                return consumer
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = 5 * (attempt + 1)
                    logger.info(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    logger.error("Max retries reached. Exiting.")
                    raise
    
    def get_db_connection(self):
        """Create database connection with retry logic"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                connection = pyodbc.connect(self.connection_string)
                return connection
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = 2 * (attempt + 1)
                    logger.info(f"Database connection retry in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Failed to connect to database after {max_retries} attempts: {e}")
                    raise
    
    def flatten_bulk_event(self, event: Dict) -> List[Tuple]:
        """
        Flatten bulk event with nested samples into individual telemetry records
        Returns list of tuples for EntityTelemetry table:
        (entityId, entityTypeAttributeId, startTimestampUTC, endTimestampUTC, providerEventInterpretation, providerDevice, numericValue, latitude, longitude, stringValue)
        """
        records = []
        
        try:
            user_id = event.get('user', {}).get('user_id', 'unknown')
            loinc_code = event.get('loinc_code')
            event_type = event.get('event_type')
            provider_device = 'Apple Watch 11'
            data = event.get('data', {})
            
            # Extract entity_id from user_id (e.g., "user_1" -> 1)
            try:
                entity_id = user_id.split('_')[1]
            except (ValueError, IndexError):
                entity_id = user_id
            
            # Get entityTypeAttributeId from loinc_code via database lookup
            entity_type_attribute_id = self._get_entity_type_attribute_id(loinc_code)
            
            # Process each data category
            for data_key, data_value in data.items():
                if not isinstance(data_value, dict):
                    continue
                
                # Check if this data has detailed samples
                if 'detailed' not in data_value:
                    continue
                
                detailed = data_value.get('detailed', {})
                
                # Process each sample array
                for sample_key, sample_list in detailed.items():
                    if not isinstance(sample_list, list):
                        continue
                    
                    # Each item in the array is a sample
                    for sample in sample_list:
                        if not isinstance(sample, dict):
                            continue
                        
                        timestamp = sample.get('timestamp')
                        if not timestamp:
                            continue
                        
                        # Extract value based on event type
                        numeric_value = None
                        latitude = None
                        longitude = None
                        string_value = None
                        
                        value = self._extract_value_from_sample(event_type, sample, data_key)
                        
                        if value is not None:
                            # Determine value type and assign to appropriate column
                            if isinstance(value, (int, float)):
                                numeric_value = float(value)
                            elif isinstance(value, str):
                                # Check if it's a coordinate pair
                                if ',' in str(value) and event_type and 'location' in event_type:
                                    try:
                                        lat, lon = str(value).split(',')
                                        latitude = float(lat)
                                        longitude = float(lon)
                                    except:
                                        string_value = str(value)
                                else:
                                    string_value = str(value)
                            
                            record = (
                                entity_id,
                                entity_type_attribute_id,
                                timestamp,  # startTimestampUTC (using sample timestamp)
                                timestamp,  # endTimestampUTC (same as start for point-in-time measurement)
                                None,  # providerEventInterpretation
                                provider_device,  # providerDevice
                                numeric_value,
                                latitude,
                                longitude,
                                string_value
                            )
                            records.append(record)
            
            return records
            
        except Exception as e:
            logger.error(f"Error flattening event: {e}")
            return []
    
    def _extract_unit_from_summary(self, summary: Dict, event_type: str) -> str:
        """Extract unit from summary based on event type"""
        unit_mapping = {
            'vitals.heart_rate': 'bpm',
            'vitals.blood_pressure': 'mmHg',
            'vitals.body_temperature': 'C',
            'vitals.oxygen_saturation': '%',
            'vitals.respiration_rate': 'breaths/min',
            'vitals.heart_rate_variability': 'ms',
            'vitals.glucose': 'mg/dL',
            'activity.steps': 'steps',
            'activity.calories': 'kcal',
            'activity.distance': 'km',
            'sleep.session': 'minutes',
            'location.update': 'coordinates',
        }
        
        for key, unit in unit_mapping.items():
            if key in event_type:
                return unit
        
        return ''
    
    def _extract_value_from_sample(self, event_type: str, sample: Dict, data_key: str) -> any:
        """Extract telemetry value from a sample"""
        
        # Map event types to value extraction logic
        if 'heart_rate' in event_type:
            if 'bpm' in sample:
                return sample['bpm']
            elif 'rmssd_ms' in sample:
                return sample['rmssd_ms']
            elif 'restingHeartRate' in sample:
                return sample['restingHeartRate']
            elif 'minimumHeartRate' in sample:
                return sample['minimumHeartRate']
            elif 'maximumHeartRate' in sample:
                return sample['maximumHeartRate']
        
        elif 'blood_pressure' in event_type:
            systolic = sample.get('systolic_mmhg')
            diastolic = sample.get('diastolic_mmhg')
            if systolic and diastolic:
                return f"{systolic}/{diastolic}"
            elif 'diastolic_mmhg' in sample:
                return sample['diastolic_mmhg']
        
        elif 'temperature' in event_type:
            return sample.get('celsius')
        
        elif 'oxygen' in event_type:
            return sample.get('percentage')
        
        elif 'respiration' in event_type:
            return sample.get('breaths_per_min')
        
        elif 'glucose' in event_type:
            return sample.get('glucose_mg_dl')
        
        elif 'steps' in event_type:
            return sample.get('hourly_steps')
        
        elif 'calories' in event_type:
            return sample.get('calories_burned')
        
        elif 'distance' in event_type:
            return sample.get('segment_distance_km')
        
        elif 'sleep' in event_type:
            return sample.get('stage')
        
        elif 'location' in event_type:
            lat = sample.get('latitude')
            lon = sample.get('longitude')
            if lat and lon:
                return f"{lat},{lon}"
        
        # Default: return first numeric value found
        for v in sample.values():
            if isinstance(v, (int, float)):
                return v
        
        return None
    
    def _get_entity_type_attribute_id(self, loinc_code: str) -> int:
        """Lookup entityTypeAttributeId from EntityTypeAttribute table by loinc_code"""
        if not loinc_code:
            return 1  # Default to 1 if no loinc_code provided
        
        try:
            connection = self.get_db_connection()
            cursor = connection.cursor()
            
            # Query EntityTypeAttribute table for the matching code
            cursor.execute(
                "SELECT entityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE EntityTypeAttributeCode = ?",
                (loinc_code,)
            )
            row = cursor.fetchone()
            connection.close()
            
            if row:
                return row[0]
            else:
                logger.warning(f"No entityTypeAttributeId found for loinc_code: {loinc_code}, using default 1")
                return 1  # Default to 1 if not found
        except Exception as e:
            logger.warning(f"Error looking up entityTypeAttributeId for {loinc_code}: {e}, using default 1")
            return 1  # Default to 1 on error
    
    def bulk_insert_telemetry(self, records: List[Tuple]) -> bool:
        """Bulk insert telemetry records into EntityTelemetry table"""
        if not records:
            return True
        
        connection = None
        try:
            connection = self.get_db_connection()
            cursor = connection.cursor()
            
            # Insert query matching actual EntityTelemetry table schema
            insert_query = """
            INSERT INTO EntityTelemetry 
            (entityId, entityTypeAttributeId, startTimestampUTC, endTimestampUTC, 
             providerEventInterpretation, providerDevice, numericValue, latitude, longitude, stringValue)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            # Execute bulk insert
            cursor.executemany(insert_query, records)
            connection.commit()
            
            logger.info(f"[OK] SUCCESS: Inserted {len(records)} telemetry records into database")
            self.total_inserted += len(records)
            
            return True
            
        except Exception as e:
            logger.error(f"[FAILED] FAILED: Bulk insert error: {e}")
            if connection:
                try:
                    connection.rollback()
                except:
                    pass
            return False
        finally:
            if connection:
                try:
                    connection.close()
                except:
                    pass
    
    def consume_and_insert(self, max_events=None):
        """Consume bulk events and insert individual samples into database"""
        
        logger.info(f"Starting consumer on topic: {self.topic}")
        logger.info("=" * 70)
        
        try:
            for message in self.consumer:
                try:
                    event = message.value
                    self.total_events_processed += 1
                    
                    event_type = event.get('event_type', 'unknown')
                    user_id = event.get('user', {}).get('user_id', 'unknown')
                    
                    # Flatten bulk event into individual records
                    records = self.flatten_bulk_event(event)
                    
                    if records:
                        num_samples = len(records)
                        logger.info(f"Processing: {event_type:40} | User: {user_id:10} | Samples: {num_samples:3}")
                        
                        # Add to buffer
                        self.event_buffer.extend(records)
                    
                    # Bulk insert when buffer reaches batch size
                    if len(self.event_buffer) >= self.batch_size:
                        success = self.bulk_insert_telemetry(self.event_buffer)
                        if success:
                            self.consumer.commit()
                            self.event_buffer = []
                        else:
                            logger.error("Insert failed - buffer not cleared, will retry")
                    
                    if max_events and self.total_events_processed >= max_events:
                        break
                        
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    continue
            
            # Insert remaining records
            if self.event_buffer:
                logger.info(f"Inserting final batch of {len(self.event_buffer)} records...")
                success = self.bulk_insert_telemetry(self.event_buffer)
                if success:
                    self.consumer.commit()
            
            logger.info("=" * 70)
            logger.info(f"Consumer stopped")
            logger.info(f"Total bulk events consumed: {self.total_events_processed}")
            logger.info(f"Total telemetry records inserted: {self.total_inserted}")
            
        except KeyboardInterrupt:
            logger.info("\nConsumer interrupted by user")
            if self.event_buffer:
                logger.info(f"Inserting {len(self.event_buffer)} remaining records...")
                self.bulk_insert_telemetry(self.event_buffer)
                self.consumer.commit()
        except Exception as e:
            logger.error(f"Fatal error in consumer: {e}")
            sys.exit(1)
        finally:
            self.consumer.close()


if __name__ == '__main__':
    import os
    
    # Get database credentials from environment or use defaults
    db_server = os.getenv('DB_SERVER', 'localhost')
    db_name = os.getenv('DB_NAME', 'BoatTelemetryDB')
    db_user = os.getenv('DB_USER', 'sa')
    db_password = os.getenv('DB_PASSWORD', 'YourStrongPassword123!')
    
    consumer = EntityTelemetryConsumer(
        bootstrap_servers='127.0.0.1:9092',
        topic='junction-events',
        db_server=db_server,
        db_name=db_name,
        db_user=db_user,
        db_password=db_password
    )
    logger.info("=" * 70)
    logger.info("Starting Entity Telemetry Consumer (Bulk Processing)")
    logger.info("=" * 70)
    consumer.consume_and_insert()