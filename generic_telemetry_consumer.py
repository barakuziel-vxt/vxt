# generic_telemetry_consumer.py
"""
Generic Telemetry Consumer with Adapter Pattern
Filters by: Entity + EntityTypeAttribute (matching code + provider)
"""

import json
import logging
import time
from abc import ABC, abstractmethod
from kafka import KafkaConsumer
from typing import List, Dict, Tuple, Optional
import pyodbc
import sys
from importlib import import_module

logger = logging.getLogger(__name__)


class ProviderAdapter(ABC):
    """Abstract base class for provider-specific adapters"""
    
    def __init__(self, provider_config: Dict):
        self.config = provider_config
        self.event_rules = {}
    
    @abstractmethod
    def validate_message(self, message: Dict) -> bool:
        """Validate incoming message format"""
        pass
    
    @abstractmethod
    def parse_event(self, message: Dict) -> List[Dict]:
        """Parse provider event into normalized format"""
        pass
    
    def set_extraction_rules(self, rules: Dict):
        """Set event extraction rules from ProviderEvent"""
        self.event_rules = rules


class GenericTelemetryConsumer:
    """
    Protocol and Provider-agnostic consumer
    
    Filters by:
    - Entity exists in Entity table
    - EntityTypeAttribute exists with:
      - entityTypeAttributeCode = ProviderEvent.protocolAttributeCode
      - EntityTypeAttribute.providerId = ProviderEvent.providerId
      - EntityTypeAttribute.Active = 'Y'
    """
    
    def __init__(self, provider_name: str, db_server='localhost', db_name='BoatTelemetryDB', 
                 db_user='sa', db_password='YourStrongPassword123!'):
        self.provider_name = provider_name
        self.provider_id = None
        self.db_server = db_server
        self.db_name = db_name
        self.db_user = db_user
        self.db_password = db_password
        
        # Load all caches in consolidated queries (Provider, Entity, Attributes, Customer, etc.)
        self._load_all_caches()
        
        # Load provider configuration and adapter
        self.adapter = self._load_adapter()
        
        # Initialize Kafka consumer
        self.consumer = self._init_kafka_consumer()
        
        self.batch_size = self.provider_config.get('BatchSize', 50)
        self.event_buffer: List[Tuple] = []
        self.total_inserted = 0
        self.total_events = 0
        self.total_skipped = 0
        
        logger.info(f"✓ Consumer initialized: {self.provider_config['ProviderName']}")
        logger.info(f"  Entities cached: {len(self.entity_cache)}")
        logger.info(f"  EntityTypeAttributes cached: {len(self.attribute_cache)}")
        logger.info(f"  Customer entities cached: {len(self.customer_entities_cache)}")
        logger.info(f"  ProviderEvents cached: {len(self.event_mappings)}")
    
    def _load_all_caches(self):
        """
        Ultra-consolidated cache loading - executes only 2 queries with heavy JOINs:
        
        QUERY 1: Single JOIN across Provider → Entity → EntityTypeAttribute → CustomerEntities
        Returns: All entities with their attributes and customer assignment status
        
        QUERY 2: Single JOIN across ProviderEvent ← EntityTypeAttribute
        Returns: All provider events with their attribute mappings
        
        This eliminates 5 separate queries and builds all 4 caches from 2 result sets.
        """
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            # ============================================================================
            # QUERY 1: CONSOLIDATED Entity + Attribute + CustomerEntities JOIN
            # Returns one row per (entity, attribute) pair with customer assignment info
            # ============================================================================
            cursor.execute("""
                SELECT 
                    p.ProviderId,
                    p.ProviderName,
                    p.TopicName,
                    p.BatchSize,
                    e.EntityId,
                    e.EntityTypeId,
                    eta.entityTypeAttributeCode,
                    CASE WHEN ce.entityId IS NOT NULL AND c.active = 'Y' THEN 1 ELSE 0 END as is_customer_entity
                FROM Provider p
                CROSS JOIN Entity e
                INNER JOIN EntityTypeAttribute eta 
                    ON eta.EntityTypeId = e.EntityTypeId 
                    AND eta.providerId = p.ProviderId
                    AND eta.Active = 'Y'
                LEFT JOIN CustomerEntities ce 
                    ON ce.entityId = e.EntityId 
                    AND ce.active = 'Y'
                LEFT JOIN Customers c 
                    ON ce.customerId = c.customerId 
                    AND c.active = 'Y'
                WHERE p.ProviderName = ? 
                    AND p.Active = 'Y'
                    AND e.Active = 'Y'
            """, (self.provider_name,))
            
            rows = cursor.fetchall()
            if not rows:
                raise Exception(f"Provider '{self.provider_name}' not found or has no active entities/attributes")
            
            # Initialize caches from Query 1 results
            self.entity_cache = {}
            self.attribute_cache = set()
            self.customer_entities_cache = set()
            
            # Set provider config from first row
            first_row = rows[0]
            self.provider_id = first_row[0]
            provider_name = first_row[1]
            adapter_class_name = f"{provider_name}Adapter"
            
            self.provider_config = {
                'ProviderId': first_row[0],
                'ProviderName': first_row[1],
                'AdapterClassName': adapter_class_name,
                'TopicName': first_row[2],
                'BatchSize': first_row[3]
            }
            logger.info(f"✓ Resolved provider '{self.provider_name}' to ID {self.provider_id}")
            
            # Process all rows: build entity_cache, attribute_cache, customer_entities_cache
            processed_entities = set()
            for row in rows:
                entity_id = row[4]
                entity_type_id = row[5]
                attr_code = row[6]
                is_customer_entity = row[7]
                
                # Add to entity cache (only once per entity)
                if entity_id not in processed_entities:
                    self.entity_cache[entity_id] = entity_type_id
                    processed_entities.add(entity_id)
                
                # Add attribute code
                self.attribute_cache.add(attr_code)
                
                # Add to customer entities cache if assigned to active customer
                if is_customer_entity and entity_id not in self.customer_entities_cache:
                    self.customer_entities_cache.add(entity_id)
            
            logger.info(f"✓ Query 1 loaded from 1 consolidated JOIN:")
            logger.info(f"  - {len(self.entity_cache)} entities")
            logger.info(f"  - {len(self.attribute_cache)} attribute codes")
            logger.info(f"  - {len(self.customer_entities_cache)} customer-assigned entities")
            
            # ============================================================================
            # QUERY 2: CONSOLIDATED ProviderEvent + EntityTypeAttribute JOIN
            # Returns event mappings with their attribute details
            # ============================================================================
            cursor.execute("""
                SELECT 
                    pe.providerEventId,
                    pe.providerEventType,
                    pe.protocolAttributeCode,
                    pe.ValueJsonPath,
                    pe.SampleArrayPath,
                    pe.CompositeValueTemplate,
                    pe.FieldMappingJSON,
                    COALESCE(eta.entityTypeAttributeId, 0) as entityTypeAttributeId
                FROM dbo.ProviderEvent pe
                LEFT JOIN dbo.EntityTypeAttribute eta 
                    ON eta.entityTypeAttributeCode = pe.protocolAttributeCode
                    AND eta.providerId = pe.providerId
                    AND eta.Active = 'Y'
                WHERE pe.providerId = ? AND pe.Active = 'Y'
            """, (self.provider_id,))
            
            self.event_mappings = {}
            for row in cursor.fetchall():
                self.event_mappings[row[1]] = {  # Key by ProviderEventType
                    'provider_event_id': row[0],
                    'protocol_attribute_code': row[2],
                    'value_json_path': row[3],
                    'sample_array_path': row[4],
                    'composite_template': json.loads(row[5]) if row[5] else {},
                    'field_mapping': json.loads(row[6]) if row[6] else {},
                    'entity_type_attribute_id': row[7]
                }
            
            connection.close()
            logger.info(f"✓ Query 2 loaded {len(self.event_mappings)} ProviderEvent mappings with attributes")
            logger.info(f"\n✓ ALL CACHES LOADED from 2 CONSOLIDATED QUERIES (vs 5 separate)")
            
            # Set extraction rules for adapter
            if hasattr(self, 'adapter'):
                self.adapter.set_extraction_rules(self.event_mappings)
            
        except Exception as e:
            logger.error(f"Failed to load caches: {e}")
            raise
    
    def _load_adapter(self):
        """Dynamically load provider adapter based on naming convention"""
        try:
            adapter_class_name = self.provider_config['AdapterClassName']
            module = import_module('provider_adapters')
            adapter_class = getattr(module, adapter_class_name)
            logger.info(f"✓ Loaded adapter: {adapter_class_name}")
            return adapter_class(self.provider_config)
        except AttributeError as e:
            logger.error(f"Adapter class '{adapter_class_name}' not found in provider_adapters module. Expected naming convention: <ProviderName>Adapter (e.g., JunctionAdapter)")
            raise
        except Exception as e:
            logger.error(f"Failed to load adapter: {e}")
            raise
    
    def _should_insert(self, entity_id: str, protocol_attr_code: str) -> Tuple[bool, str]:
        """
        Determine if we should insert this telemetry record
        
        Checks:
        1. Entity must exist in Entity table (and have EntityTypeId matching this provider)
        2. EntityTypeAttribute code exists for this provider
        3. Entity must be in CustomerEntities with active customer subscription
        
        Args:
            entity_id: str - entity identifier (e.g., '033114869')
            protocol_attr_code: str - attribute code (e.g., 'heart_rate')
        
        Returns: (should_insert, reason)
        """
        # Check 1: Entity must exist in entity cache (already filtered by provider's EntityTypeIds)
        if entity_id not in self.entity_cache:
            return False, f"✗ Entity '{entity_id}' not in entity_cache. Available: {sorted(self.entity_cache.keys())}"
        
        # Check 2: EntityTypeAttribute code must exist for this provider
        if protocol_attr_code not in self.attribute_cache:
            return False, f"✗ Code '{protocol_attr_code}' not in attribute_cache. Available: {sorted(list(self.attribute_cache))[:5]}"
        
        # Check 3: Entity must be assigned to an active customer (active CustomerEntity with active Customer)
        if entity_id not in self.customer_entities_cache:
            return False, f"✗ Entity '{entity_id}' not in customer_entities_cache. Allowed: {sorted(self.customer_entities_cache)}"
        
        return True, "OK"
    
    def _init_kafka_consumer(self):
        """Initialize Kafka consumer with retry logic"""
        max_retries = 15
        retry_delay = 3  # seconds (increased from 2)
        
        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"Attempting Kafka connection (attempt {attempt}/{max_retries})...")
                consumer = KafkaConsumer(
                    self.provider_config['TopicName'],
                    bootstrap_servers='localhost:9092',
                    value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                    group_id=f"consumer-provider-{self.provider_id}",
                    client_id=f"client-{self.provider_id}",
                    auto_offset_reset='earliest',
                    enable_auto_commit=False,
                    consumer_timeout_ms=-1,
                    request_timeout_ms=30000,
                    session_timeout_ms=10000,
                    connections_max_idle_ms=540000  # 9 minutes
                )
                logger.info(f"✓ Connected to Kafka topic: {self.provider_config['TopicName']}")
                return consumer
            except Exception as e:
                if attempt < max_retries:
                    backoff_delay = retry_delay * (2 ** min(attempt - 1, 3))  # Cap exponential backoff at 8x
                    logger.warning(f"Kafka connection failed (attempt {attempt}/{max_retries}): {e}")
                    logger.info(f"Retrying in {backoff_delay} seconds...")
                    time.sleep(backoff_delay)
                else:
                    logger.error(f"Failed to connect to Kafka after {max_retries} attempts: {e}")
                    raise
    
    def _get_db_connection(self):
        """Create database connection"""
        connection_string = (
            'DRIVER={SQL Server};'
            f'SERVER={self.db_server};'
            f'DATABASE={self.db_name};'
            f'UID={self.db_user};'
            f'PWD={self.db_password}'
        )
        return pyodbc.connect(connection_string)
    
    def bulk_insert_telemetry(self, records: List[Tuple]) -> bool:
        """Bulk insert to EntityTelemetry"""
        if not records:
            return True
        
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            insert_query = """
            INSERT INTO dbo.EntityTelemetry 
            (entityId, entityTypeAttributeId, startTimestampUTC, endTimestampUTC, 
             providerEventInterpretation, providerDevice, numericValue, latitude, 
             longitude, stringValue)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            cursor.executemany(insert_query, records)
            connection.commit()
            connection.close()
            
            logger.info(f"✓ Inserted {len(records)} telemetry records")
            self.total_inserted += len(records)
            return True
            
        except Exception as e:
            logger.error(f"✗ Insert failed: {e}")
            return False
    
    def consume_and_insert(self, max_events=None):
        """Main consumer loop with Entity + EntityTypeAttribute filtering"""
        logger.info("=" * 80)
        logger.info(f"Starting consumer: {self.provider_config['ProviderName']}")
        logger.info(f"Provider ID: {self.provider_id}")
        logger.info(f"Kafka Topic: {self.provider_config['TopicName']}")
        logger.info(f"Filtering by:")
        logger.info(f"  1. Entity exists in Entity table")
        logger.info(f"  2. EntityTypeAttribute.entityTypeAttributeCode = ProviderEvent.protocolAttributeCode")
        logger.info(f"  3. EntityTypeAttribute.providerId = {self.provider_id}")
        logger.info(f"  4. EntityTypeAttribute.Active = 'Y'")
        logger.info("=" * 80)
        
        try:
            for message in self.consumer:
                try:
                    event = message.value
                    self.total_events += 1
                    
                    # Validate message
                    if not self.adapter.validate_message(event):
                        logger.warning(f"Message validation failed")
                        self.total_skipped += 1
                        continue
                    
                    # Parse using provider-specific adapter
                    normalized_events = self.adapter.parse_event(event)
                    
                    for evt in normalized_events:
                        entity_id = evt['entity_id']  # Keep as string - Entity.entityId is NVARCHAR(50)
                        protocol_attr_code = evt['protocol_attribute_code']
                        entity_type_attribute_id = evt.get('entity_type_attribute_id')
                        
                        # APPLY FILTER: Entity + EntityTypeAttribute must match
                        should_insert, reason = self._should_insert(entity_id, protocol_attr_code)
                        
                        if not should_insert:
                            logger.info(f"SKIP entity {entity_id}: {reason}")
                            self.total_skipped += 1
                            continue
                        
                        # Create telemetry record (10 columns)
                        record = (
                            entity_id,
                            entity_type_attribute_id,
                            evt['timestamp'],
                            evt['timestamp'],  # endTimestamp = startTimestamp for point-in-time
                            None,  # providerEventInterpretation
                            evt.get('provider_device'),
                            evt.get('numeric_value'),
                            evt.get('latitude'),
                            evt.get('longitude'),
                            evt.get('string_value')
                        )
                        self.event_buffer.append(record)
                    
                    # Log progress every 10 events
                    if self.total_events % 10 == 0:
                        logger.info(f"Progress: {self.total_events} events, {self.total_inserted} inserted, {self.total_skipped} skipped")
                    
                    # Batch insert when buffer reaches batch size
                    if len(self.event_buffer) >= self.batch_size:
                        if self.bulk_insert_telemetry(self.event_buffer):
                            self.consumer.commit()
                            self.event_buffer = []
                    
                    if max_events and self.total_events >= max_events:
                        break
                        
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    self.total_skipped += 1
                    continue
            
            # Insert remaining records
            if self.event_buffer:
                logger.info(f"Inserting final batch of {len(self.event_buffer)} records...")
                self.bulk_insert_telemetry(self.event_buffer)
                self.consumer.commit()
            
            logger.info("=" * 80)
            logger.info(f"Consumer stopped")
            logger.info(f"Total events processed: {self.total_events}")
            logger.info(f"Total records inserted: {self.total_inserted}")
            logger.info(f"Total records skipped: {self.total_skipped}")
            logger.info(f"Success rate: {(self.total_inserted/self.total_events*100) if self.total_events > 0 else 0:.1f}%")
            logger.info("=" * 80)
            
        except KeyboardInterrupt:
            logger.info("\nConsumer interrupted by user")
            if self.event_buffer:
                logger.info(f"Inserting {len(self.event_buffer)} remaining records...")
                self.bulk_insert_telemetry(self.event_buffer)
                self.consumer.commit()
        finally:
            self.consumer.close()


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Generic Telemetry Consumer with Adapter Pattern')
    parser.add_argument('provider_name', type=str, help='Provider name to consume for (e.g., Junction, Terra)')
    parser.add_argument('--db-server', default='localhost', help='Database server (default: localhost)')
    parser.add_argument('--db-name', default='BoatTelemetryDB', help='Database name (default: BoatTelemetryDB)')
    parser.add_argument('--db-user', default='sa', help='Database user (default: sa)')
    parser.add_argument('--db-password', default='YourStrongPassword123!', help='Database password')
    parser.add_argument('--log-level', default='INFO', help='Log level (default: INFO)')
    
    args = parser.parse_args()
    
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    try:
        consumer = GenericTelemetryConsumer(
            provider_name=args.provider_name,
            db_server=args.db_server,
            db_name=args.db_name,
            db_user=args.db_user,
            db_password=args.db_password
        )
        consumer.consume_and_insert()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
