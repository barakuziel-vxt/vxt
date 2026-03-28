"""
TelemetryProcessor - Reusable core telemetry processing logic
Handles protocol conversion, validation, filtering, and database insertion
Can be used by:
  - Kafka consumers (local development)
  - Azure Functions (IoT Hub trigger)
  - Any other event source
"""

import json
import logging
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import pymssql
from importlib import import_module

logger = logging.getLogger(__name__)


class TelemetryProcessor:
    """
    Provider-agnostic telemetry processor
    
    Filters by:
    - Entity exists in Entity table
    - EntityTypeAttribute exists with:
      - entityTypeAttributeCode = ProviderEvent.protocolAttributeCode
      - EntityTypeAttribute.providerId = ProviderEvent.providerId
      - EntityTypeAttribute.Active = 'Y'
    - Entity is assigned to active customer
    
    Supports two initialization modes:
    1. Database mode: Queries MSSQL for all config (use in cloud/local)
    2. JSON config mode: Uses provided setup dict (use in edge devices with Device Twin)
    """
    
    def __init__(self, provider_name: str, db_server='localhost', db_name='BoatTelemetryDB', 
                 db_user='sa', db_password='YourStrongPassword123!', setup_config: Dict = None):
        """
        Initialize processor for a specific provider
        
        Supports two modes:
        1. Database mode (default): setup_config=None
           - Queries MSSQL for all provider config, entity types, attributes, events, entities
           - Used in cloud (Azure Functions) and local development
           - Requires database connectivity
        
        2. JSON config mode: setup_config=<dict>
           - Uses provided setup_config dict (from Device Twin or local file)
           - No database queries needed
           - Used in edge devices (Raspberry Pi with Device Twin)
        
        Args:
            provider_name: Provider name (e.g., 'N2KToSignalK', 'Junction')
            db_server: Database server (required for database mode)
            db_name: Database name (required for database mode)
            db_user: Database user (required for database mode)
            db_password: Database password (required for database mode)
            setup_config: JSON setup dict from Device Twin/SetupExporter (optional, enables JSON mode)
        """
        self.provider_name = provider_name
        self.provider_id = None
        self.db_server = db_server
        self.db_name = db_name
        self.db_user = db_user
        self.db_password = db_password
        
        # Statistics
        self.stats = {
            'events_processed': 0,
            'records_inserted': 0,
            'records_skipped': 0
        }
        
        if setup_config:
            # JSON CONFIG MODE (Edge Device)
            logger.info(f"[JSON Mode] Initializing TelemetryProcessor from setup config dict")
            self._initialize_from_json_config(setup_config)
        else:
            # DATABASE MODE (Cloud / Local)
            logger.info(f"[DB Mode] Initializing TelemetryProcessor from MSSQL database")
            self._initialize_from_database()
    
    def _initialize_from_database(self):
        """Load all configuration from MSSQL database"""
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
        
        logger.info(f"[OK] TelemetryProcessor initialized: {self.provider_config['ProviderName']}")
        logger.info(f"  Entities cached: {len(self.entity_cache)}")
        logger.info(f"  EntityTypeAttributes cached: {len(self.attribute_cache)}")
        logger.info(f"  Customer entities cached: {len(self.customer_entities_cache)}")
        logger.info(f"  ProviderEvents cached: {len(self.event_mappings)}")
    
    def _initialize_from_json_config(self, setup_config: Dict):
        """Load configuration from JSON setup dict (from Device Twin or SetupExporter)"""
        # Extract provider metadata
        metadata = setup_config.get('metadata', {})
        self.provider_id = metadata.get('provider_id')
        self.provider_config = {
            'ProviderId': self.provider_id,
            'ProviderName': metadata.get('provider_name', self.provider_name),
            'TopicName': metadata.get('topic_name', f"{self.provider_name}-topic"),
            'BatchSize': metadata.get('batch_size', 100),
            'Active': 'Y'
        }
        
        # Load adapter (still needs to be loaded from module)
        self.adapter = self._load_adapter()
        
        # Build event mappings from JSON config
        self.event_mappings = {}
        for event in setup_config.get('events', []):
            event_id = event.get('event_id')
            self.event_mappings[event_id] = {
                'ProviderEventId': event_id,
                'providerId': self.provider_id,
                'protocolAttributeCode': event.get('protocol_attribute_code'),
                'entityTypeId': event.get('entity_type_id'),
                'attributeCode': event.get('attribute_code'),
                'aggregationType': event.get('aggregation_type', 'latest'),
                'jsonPathExpression': event.get('json_path', '$.'),
                'templateString': event.get('template', '')
            }
        self.adapter.set_extraction_rules(self.event_mappings)
        
        # Build entity cache from JSON config
        self.entity_cache = {}
        for entity in setup_config.get('entities', []):
            entity_id = entity.get('entity_id')
            self.entity_cache[entity_id] = entity.get('entity_type_id')
        
        # Build attribute cache from JSON config
        self.attribute_cache = set()
        for attr in setup_config.get('attributes', []):
            self.attribute_cache.add(attr.get('code'))
        
        # Build customer entities cache
        self.customer_entities_cache = set()
        for entity in setup_config.get('entities', []):
            self.customer_entities_cache.add(entity.get('entity_id'))
        
        logger.info(f"[OK] TelemetryProcessor initialized from JSON config: {self.provider_config['ProviderName']}")
        logger.info(f"  Entities cached: {len(self.entity_cache)}")
        logger.info(f"  EntityTypeAttributes cached: {len(self.attribute_cache)}")
        logger.info(f"  Customer entities cached: {len(self.customer_entities_cache)}")
        logger.info(f"  ProviderEvents cached: {len(self.event_mappings)}")
    
    @classmethod
    def from_json_config(cls, provider_name: str, setup_config: Dict) -> 'TelemetryProcessor':
        """
        Factory method to create TelemetryProcessor from JSON setup config
        
        Useful for edge devices (Raspberry Pi, AWS Greengrass) that receive config via:
        - Azure IoT Device Twin
        - Local config file
        - API call to dashboard
        
        Args:
            provider_name: Provider name (must match config)
            setup_config: Setup dict from SetupExporter (must include all required fields)
        
        Returns:
            TelemetryProcessor instance initialized in JSON mode
        
        Example:
            # Get config from Device Twin
            twin_config = device_client.get_twin()['properties']['desired']['setup']
            processor = TelemetryProcessor.from_json_config('N2KToSignalK', twin_config)
        """
        return cls(provider_name=provider_name, setup_config=setup_config)
    
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
            logger.info(f"[OK] Resolved provider name '{self.provider_name}' to provider ID {provider_id}")
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
            logger.info(f"[OK] Loaded {len(rules)} ProviderEvent mappings for provider {self.provider_id}")
            return rules
        except Exception as e:
            logger.error(f"Failed to load event mappings: {e}")
            raise
    
    def _load_entity_cache(self) -> Dict[int, int]:
        """
        Cache entities that have EntityTypeAttributes for this provider
        Returns: {entity_id -> entity_type_id}
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
            logger.info(f"[OK] Cached {len(cache)} active entities with EntityTypeAttributes for provider {self.provider_id}")
            return cache
        except Exception as e:
            logger.error(f"Failed to load entity cache: {e}")
            raise
    
    def _load_attribute_cache(self) -> set:
        """
        Cache EntityTypeAttribute codes linked to this provider
        Returns: set of valid entityTypeAttributeCodes for this provider
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
            logger.info(f"[OK] Cached {len(cache)} EntityTypeAttribute codes for provider {self.provider_id}")
            return cache
        except Exception as e:
            logger.error(f"Failed to load attribute cache: {e}")
            return set()
    
    def _load_customer_entities_cache(self) -> set:
        """
        Cache CustomerEntities that have active assignments with active customers
        Returns: set of entity_ids that are assigned to active customers
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
            logger.info(f"[OK] Cached {len(cache)} active customer entities")
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
            logger.info(f"[OK] Loaded adapter: {adapter_class_name}")
            return adapter_class(self.provider_config)
        except AttributeError:
            logger.error(f"Adapter class '{adapter_class_name}' not found in provider_adapters module")
            raise
        except Exception as e:
            logger.error(f"Failed to load adapter: {e}")
            raise
    
    def _should_insert(self, entity_id: str, protocol_attr_code: str) -> Tuple[bool, str]:
        """
        Determine if we should insert this telemetry record
        
        Returns: (should_insert, reason)
        """
        if entity_id not in self.entity_cache:
            return False, f"Entity '{entity_id}' not in entity_cache"
        
        if protocol_attr_code not in self.attribute_cache:
            return False, f"Code '{protocol_attr_code}' not in attribute_cache"
        
        if entity_id not in self.customer_entities_cache:
            return False, f"Entity '{entity_id}' not assigned to active customer"
        
        return True, "OK"
    
    def _get_db_connection(self):
        """Create database connection using pymssql (pure Python)"""
        return pymssql.connect(
            server=self.db_server,
            user=self.db_user,
            password=self.db_password,
            database=self.db_name,
            timeout=30,
            as_dict=False
        )
    
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
            
            logger.info(f"[OK] Inserted {len(records)} telemetry records")
            self.stats['records_inserted'] += len(records)
            return True
            
        except Exception as e:
            logger.error(f"[FAILED] Insert failed: {e}")
            return False
    
    def process_event(self, event: Dict) -> int:
        """
        Process a single event from any source (Kafka, IoT Hub, etc)
        
        Args:
            event: Raw event dictionary from provider
        
        Returns:
            Number of records inserted
        """
        self.stats['events_processed'] += 1
        inserted_count = 0
        
        try:
            # Validate message
            if not self.adapter.validate_message(event):
                logger.warning(f"Message validation failed")
                self.stats['records_skipped'] += 1
                return 0
            
            # Parse using provider-specific adapter
            normalized_events = self.adapter.parse_event(event)
            event_buffer: List[Tuple] = []
            
            for evt in normalized_events:
                entity_id = evt['entity_id']
                protocol_attr_code = evt['protocol_attribute_code']
                entity_type_attribute_id = evt.get('entity_type_attribute_id')
                
                # APPLY FILTER: Entity + EntityTypeAttribute must match
                should_insert, reason = self._should_insert(entity_id, protocol_attr_code)
                
                if not should_insert:
                    logger.debug(f"SKIP entity {entity_id}: {reason}")
                    self.stats['records_skipped'] += 1
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
                event_buffer.append(record)
            
            # Bulk insert all records from this event
            if event_buffer:
                if self.bulk_insert_telemetry(event_buffer):
                    inserted_count = len(event_buffer)
            
            return inserted_count
            
        except Exception as e:
            logger.error(f"Error processing event: {e}")
            self.stats['records_skipped'] += 1
            return 0
    
    def get_stats(self) -> Dict:
        """Get processing statistics"""
        return {
            **self.stats,
            'success_rate': (self.stats['records_inserted'] / self.stats['events_processed'] * 100) 
                           if self.stats['events_processed'] > 0 else 0
        }
    
    def print_stats(self):
        """Print formatted statistics"""
        stats = self.get_stats()
        logger.info("=" * 80)
        logger.info(f"Provider: {self.provider_config['ProviderName']}")
        logger.info(f"Total events processed: {stats['events_processed']}")
        logger.info(f"Total records inserted: {stats['records_inserted']}")
        logger.info(f"Total records skipped: {stats['records_skipped']}")
        logger.info(f"Success rate: {stats['success_rate']:.1f}%")
        logger.info("=" * 80)
