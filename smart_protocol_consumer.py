"""
Smart Protocol-Agnostic Event Consumer
Reads from Kafka topics, extracts attributes based on protocol mappings, and stores in EntityTelemetry
"""

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from jsonpath_ng import parse
import pyodbc
from kafkaConsumer import KafkaConsumer  # You'll need kafka-python package

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SmartProtocolConsumer:
    """
    Configuration-driven consumer that:
    1. Reads events from Kafka (by protocol)
    2. Looks up ProtocolAttributeMapping from database
    3. Extracts JSON values based on jsonPath
    4. Applies transformation rules
    5. Stores in EntityTelemetry table with EntityTypeAttribute mapping
    """
    
    def __init__(self, db_connection_string: str):
        self.conn_string = db_connection_string
        self.protocol_mappings = {}  # Cache protocol mappings
        self.load_protocol_mappings()
    
    def load_protocol_mappings(self):
        """
        Load all protocol attribute mappings from database into memory for fast lookup
        Structure: {protocol_name: {attribute_code: {mapping_info}}}
        """
        try:
            conn = pyodbc.connect(self.conn_string)
            cursor = conn.cursor()
            
            query = """
            SELECT 
                p.protocolName,
                pa.protocolAttributeCode,
                pa.jsonPath,
                pa.dataType,
                pam.entityTypeAttributeCode,
                pam.transformationRule,
                pam.transformationLanguage
            FROM ProtocolAttributeMapping pam
            JOIN ProtocolAttribute pa ON pam.protocolAttributeId = pa.protocolAttributeId
            JOIN Protocol p ON pa.protocolId = p.protocolId
            WHERE p.active = 'Y' AND pa.active = 'Y' AND pam.active = 'Y'
            ORDER BY pam.priority DESC
            """
            
            cursor.execute(query)
            
            for row in cursor.fetchall():
                protocol = row.protocolName
                attr_code = row.protocolAttributeCode
                
                if protocol not in self.protocol_mappings:
                    self.protocol_mappings[protocol] = {}
                
                self.protocol_mappings[protocol][attr_code] = {
                    'jsonPath': row.jsonPath,
                    'dataType': row.dataType,
                    'entityTypeAttributeCode': row.entityTypeAttributeCode,
                    'transformationRule': row.transformationRule,
                    'transformationLanguage': row.transformationLanguage
                }
            
            conn.close()
            logger.info(f"Loaded {sum(len(v) for v in self.protocol_mappings.values())} protocol attribute mappings")
        
        except Exception as e:
            logger.error(f"Failed to load protocol mappings: {e}")
            raise
    
    def extract_value_from_json(self, data: Dict[Any, Any], json_path: str) -> Optional[Any]:
        """Extract value from JSON using JSONPath notation"""
        try:
            if not json_path:
                return None
            
            # Simple dot notation if jsonpath-ng not available
            if json_path.startswith('$.'):
                keys = json_path[2:].split('.')
                value = data
                for key in keys:
                    if isinstance(value, dict):
                        value = value.get(key)
                    else:
                        return None
                return value
            
            # Or use jsonpath-ng for complex paths
            jsonpath_expr = parse(json_path)
            matches = [match.value for match in jsonpath_expr.find(data)]
            return matches[0] if matches else None
        
        except Exception as e:
            logger.warning(f"Failed to extract value from JSON path {json_path}: {e}")
            return None
    
    def apply_transformation(self, value: Any, transformation_rule: Optional[str], 
                           transformation_language: str) -> Any:
        """Apply optional transformation to extracted value"""
        try:
            if not transformation_rule or not value:
                return value
            
            if transformation_language == 'SQL':
                # For SQL transformations, we'll apply them in the INSERT statement
                return value
            
            elif transformation_language == 'PYTHON':
                # Simple Python eval for transformations
                # WARNING: Only use trusted transformation rules in production
                return eval(transformation_rule, {"value": value})
            
            return value
        
        except Exception as e:
            logger.warning(f"Failed to apply transformation '{transformation_rule}': {e}")
            return value
    
    def process_event(self, event_data: Dict[Any, Any], protocol_name: str, 
                     entity_id: str, timestamp: datetime) -> Dict[str, Any]:
        """
        Process a single event:
        1. Extract all mapped attributes using jsonPath
        2. Apply transformations
        3. Return structured data for database insertion
        """
        extracted_attributes = {}
        
        if protocol_name not in self.protocol_mappings:
            logger.warning(f"No mappings found for protocol: {protocol_name}")
            return {}
        
        protocol_config = self.protocol_mappings[protocol_name]
        
        for protocol_attr_code, mapping_info in protocol_config.items():
            # Extract value from JSON
            value = self.extract_value_from_json(event_data, mapping_info['jsonPath'])
            
            if value is not None:
                # Apply transformation if configured
                transformed_value = self.apply_transformation(
                    value, 
                    mapping_info['transformationRule'],
                    mapping_info['transformationLanguage']
                )
                
                entity_attr_code = mapping_info['entityTypeAttributeCode']
                extracted_attributes[entity_attr_code] = {
                    'value': transformed_value,
                    'protocolCode': protocol_attr_code,
                    'dataType': mapping_info['dataType']
                }
        
        return extracted_attributes
    
    def insert_into_entity_telemetry(self, entity_id: str, extracted_attributes: Dict[str, Any], 
                                     timestamp: datetime, protocol_name: str):
        """Insert processed attributes into EntityTelemetry table"""
        try:
            conn = pyodbc.connect(self.conn_string)
            cursor = conn.cursor()
            
            for entity_attr_code, attr_data in extracted_attributes.items():
                insert_query = """
                INSERT INTO EntityTelemetry 
                (entityId, entityTypeAttributeCode, attributeValue, timestamp, protocol)
                VALUES (?, ?, ?, ?, ?)
                """
                
                cursor.execute(insert_query, (
                    entity_id,
                    entity_attr_code,
                    str(attr_data['value']),
                    timestamp,
                    protocol_name
                ))
            
            conn.commit()
            conn.close()
            logger.info(f"Inserted {len(extracted_attributes)} attributes for entity {entity_id}")
        
        except Exception as e:
            logger.error(f"Failed to insert into EntityTelemetry: {e}")
            raise
    
    def consume_from_kafka(self, protocol_name: str, kafka_brokers: list, 
                          topic: str, group_id: str):
        """
        Consume events from Kafka topic for a specific protocol
        """
        try:
            consumer = KafkaConsumer(
                topic,
                bootstrap_servers=kafka_brokers,
                group_id=group_id,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='earliest'
            )
            
            logger.info(f"Starting consumer for protocol '{protocol_name}' on topic '{topic}'")
            
            for message in consumer:
                try:
                    event_data = message.value
                    
                    # Expected event structure:
                    # {
                    #   "entityId": "234567890",
                    #   "timestamp": "2024-02-13T10:30:00Z",
                    #   "protocolAttributes": { ... actual protocol data ... }
                    # }
                    
                    entity_id = event_data.get('entityId')
                    timestamp_str = event_data.get('timestamp', datetime.now(timezone.utc).isoformat())
                    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    protocol_data = event_data.get('protocolAttributes', event_data)
                    
                    if not entity_id:
                        logger.warning(f"Event missing entityId: {event_data}")
                        continue
                    
                    # Process event through smart consumer
                    extracted_attributes = self.process_event(
                        protocol_data, 
                        protocol_name, 
                        entity_id, 
                        timestamp
                    )
                    
                    if extracted_attributes:
                        self.insert_into_entity_telemetry(
                            entity_id, 
                            extracted_attributes, 
                            timestamp, 
                            protocol_name
                        )
                    else:
                        logger.warning(f"No attributes extracted from event: {event_data}")
                
                except Exception as e:
                    logger.error(f"Error processing message: {e}", exc_info=True)
        
        except Exception as e:
            logger.error(f"Consumer error: {e}")
            raise


# ============================================
# EXAMPLE USAGE
# ============================================

if __name__ == '__main__':
    # Database connection string
    db_connection = 'Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=YachtSenseDB;UID=sa;PWD=your_password'
    
    # Initialize consumer
    consumer = SmartProtocolConsumer(db_connection)
    
    # Kafka configuration
    kafka_brokers = ['localhost:9092']
    
    # Start consuming from multiple protocols
    protocols = [
        ('LOINC', 'health-vitals', 'health-vitals-group'),
        ('SignalK', 'boat-telemetry', 'boat-telemetry-group'),
        ('Junction', 'junction-events', 'junction-events-group'),
    ]
    
    # In production, you'd run each protocol consumer in a separate thread
    for protocol_name, topic, group_id in protocols:
        try:
            consumer.consume_from_kafka(protocol_name, kafka_brokers, topic, group_id)
        except Exception as e:
            logger.error(f"Failed to consume from {protocol_name}: {e}")
