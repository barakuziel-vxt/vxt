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
        
        # Load provider ID from provider name
        self.provider_id = self._lookup_provider_id()
        
        # Load provider configuration and adapter
        self.provider_config = self._load_provider_config()
        self.adapter = self._load_adapter()
        
        # Load ProviderEvent mappings
        self.event_mappings = self._load_event_mappings()
        self.adapter.set_extraction_rules(self.event_mappings)
        
        # Pre-load caches for efficient filtering
        self.entity_cache = self._load_entity_cache()  # {entity_id -> entity_type_id}
        self.attribute_cache = self._load_attribute_cache()  # set of valid attribute codes for provider
        self.customer_entities_cache = self._load_customer_entities_cache()  # set of entity_ids with active customer assignments
        
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
    
    def _lookup_provider_id(self) -> int:
        """Lookup provider ID from provider name"""
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            cursor.execute("""
                SELECT ProviderId
                FROM Provider
                WHERE ProviderName = ? AND Active = 'Y'
            """, (self.provider_name,))
            
            row = cursor.fetchone()
            connection.close()
            
            if not row:
                raise Exception(f"Provider '{self.provider_name}' not found or inactive")
            
            provider_id = row[0]
            logger.info(f"✓ Resolved provider name '{self.provider_name}' to provider ID {provider_id}")
            return provider_id
        except Exception as e:
            logger.error(f"Failed to lookup provider ID: {e}")
            raise
    
    def _load_provider_config(self) -> Dict:
        """Load provider configuration from database"""
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            cursor.execute("""
                SELECT ProviderId, ProviderName, TopicName, BatchSize
                FROM Provider
                WHERE ProviderId = ? AND Active = 'Y'
            """, (self.provider_id,))
            
            row = cursor.fetchone()
            connection.close()
            
            if not row:
                raise Exception(f"Provider {self.provider_id} not found or inactive")
            
            # Derive adapter class name from provider name (e.g., "Junction" -> "JunctionAdapter")
            adapter_class_name = f"{row[1]}Adapter"
            
            return {
                'ProviderId': row[0],
                'ProviderName': row[1],
                'AdapterClassName': adapter_class_name,
                'TopicName': row[2],
                'BatchSize': row[3]
            }
        except Exception as e:
            logger.error(f"Failed to load provider config: {e}")
            raise
    
    def _load_event_mappings(self) -> Dict:
        """Load ProviderEvent mappings with extraction rules and EntityTypeAttributeId"""
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            # Join with EntityTypeAttribute to get the entityTypeAttributeId
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
            
            rules = {}
            for row in cursor.fetchall():
                rules[row[1]] = {  # Key by ProviderEventType
                    'provider_event_id': row[0],
                    'protocol_attribute_code': row[2],
                    'value_json_path': row[3],
                    'sample_array_path': row[4],
                    'composite_template': json.loads(row[5]) if row[5] else {},
                    'field_mapping': json.loads(row[6]) if row[6] else {},
                    'entity_type_attribute_id': row[7]
                }
            
            connection.close()
            logger.info(f"✓ Loaded {len(rules)} ProviderEvent mappings for provider {self.provider_id}")
            for event_type, rule in rules.items():
                if rule['entity_type_attribute_id'] > 0:
                    logger.debug(f"  {event_type} -> entityTypeAttributeId {rule['entity_type_attribute_id']}")
            return rules
        except Exception as e:
            logger.error(f"Failed to load event mappings: {e}")
            raise
    
    def _load_entity_cache(self) -> Dict[int, int]:
        """
        Cache entities that have EntityTypeAttributes for this provider
        
        Returns: {entity_id -> entity_type_id}
        
        Only includes entities whose EntityTypeId exists in EntityTypeAttribute 
        where providerId = this provider AND Active = 'Y'
        """
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            cursor.execute("""
                SELECT DISTINCT e.EntityId, e.EntityTypeId
                FROM Entity e
                WHERE e.Active = 'Y'
                  AND EXISTS (
                    SELECT 1 FROM EntityTypeAttribute eta 
                    WHERE eta.EntityTypeId = e.EntityTypeId 
                      AND eta.providerId = ? 
                      AND eta.Active = 'Y'
                  )
            """, (self.provider_id,))
            
            cache = {}
            for row in cursor.fetchall():
                cache[row[0]] = row[1]
            
            connection.close()
            logger.info(f"✓ Cached {len(cache)} active entities with EntityTypeAttributes for provider {self.provider_id}")
            if cache:
                sample_keys = list(cache.items())[:5]
                logger.info(f"  Sample entity cache entries: {sample_keys}")
            else:
                logger.warning(f"  WARNING: Entity cache is EMPTY! No entities found for provider {self.provider_id}")
            return cache
        except Exception as e:
            logger.error(f"Failed to load entity cache: {e}")
            raise
    
    def _load_attribute_cache(self) -> set:
        """
        Cache EntityTypeAttribute codes linked to this provider
        
        Returns: set of valid entityTypeAttributeCodes for this provider
        
        Only includes codes where:
        - EntityTypeAttribute.providerId = this provider_id
        - EntityTypeAttribute.Active = 'Y'
        """
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            cursor.execute("""
                SELECT DISTINCT eta.entityTypeAttributeCode
                FROM EntityTypeAttribute eta
                WHERE eta.Active = 'Y'
                  AND eta.providerId = ?
            """, (self.provider_id,))
            
            cache = set(row[0] for row in cursor.fetchall())
            
            connection.close()
            logger.info(f"✓ Cached {len(cache)} EntityTypeAttribute codes for provider {self.provider_id}: {cache}")
            return cache
        except Exception as e:
            logger.error(f"Failed to load attribute cache: {e}")
            return set()
    
    def _load_customer_entities_cache(self) -> set:
        """
        Cache CustomerEntities that have active assignments with active customers
        
        Returns: set of entity_ids that are assigned to active customers
        
        Only includes entities where:
        - CustomerEntities.active = 'Y'
        - Customers.active = 'Y'
        """
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            cursor.execute("""
                SELECT DISTINCT ce.entityId
                FROM CustomerEntities ce
                JOIN Customers c ON ce.customerId = c.customerId
                WHERE ce.active = 'Y'
                  AND c.active = 'Y'
            """)
            
            cache = set(row[0] for row in cursor.fetchall())
            
            connection.close()
            logger.info(f"✓ Cached {len(cache)} active customer entities")
            if cache:
                sample_entities = list(cache)[:5]
                logger.info(f"  Sample customer entities: {sample_entities}")
            else:
                logger.warning(f"  WARNING: Customer entities cache is EMPTY! No active customer entities found.")
            return cache
        except Exception as e:
            logger.error(f"Failed to load customer entities cache: {e}")
            return set()
    
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
