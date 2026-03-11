"""
Setup Exporter Service
Exports provider configuration from MSSQL as JSON
Used to populate Azure IoT Edge Device Twin for edge devices
"""

import json
import logging
from typing import Dict, List, Optional
import pyodbc

logger = logging.getLogger(__name__)


class SetupExporter:
    """
    Exports provider setup/configuration from MSSQL
    Generates JSON suitable for:
    - Device Twin properties
    - Local edge device config files
    - API responses
    """
    
    def __init__(self, db_server='localhost', db_name='BoatTelemetryDB',
                 db_user='sa', db_password='YourStrongPassword123!'):
        self.db_server = db_server
        self.db_name = db_name
        self.db_user = db_user
        self.db_password = db_password
    
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
    
    def export_provider_setup(self, provider_name: str) -> Dict:
        """
        Export complete provider setup including:
        - Provider metadata
        - Entity types
        - Entity type attributes (with aggregation rules)
        - Provider events (with extraction rules)
        - Active entities
        
        Args:
            provider_name: Provider name (e.g., 'N2KToSignalK', 'Junction')
        
        Returns:
            JSON-serializable dict with complete setup
        """
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            # 1. Get provider info
            cursor.execute("""
                SELECT ProviderId, ProviderName, TopicName, BatchSize
                FROM Provider
                WHERE ProviderName = ? AND Active = 'Y'
            """, (provider_name,))
            
            provider_row = cursor.fetchone()
            if not provider_row:
                raise ValueError(f"Provider '{provider_name}' not found or inactive")
            
            provider_id = provider_row[0]
            
            setup = {
                'provider': {
                    'id': provider_id,
                    'name': provider_row[1],
                    'topic_name': provider_row[2],
                    'batch_size': provider_row[3],
                    'exported_timestamp': self._get_timestamp()
                },
                'entity_types': self._get_entity_types(cursor, provider_id),
                'attributes': self._get_attributes(cursor, provider_id),
                'events': self._get_provider_events(cursor, provider_id),
                'entities': self._get_active_entities(cursor, provider_id),
                'metadata': {
                    'version': '1.0',
                    'description': f'Setup configuration for {provider_name} provider'
                }
            }
            
            connection.close()
            logger.info(f"[OK] Exported setup for provider '{provider_name}'")
            return setup
            
        except Exception as e:
            logger.error(f"Failed to export provider setup: {e}")
            raise
    
    def _get_entity_types(self, cursor, provider_id: int) -> List[Dict]:
        """Get entity types relevant to this provider"""
        cursor.execute("""
            SELECT DISTINCT et.EntityTypeId, et.EntityTypeName, et.EntityTypeCode
            FROM EntityType et
            WHERE et.Active = 'Y'
              AND EXISTS (
                SELECT 1 FROM EntityTypeAttribute eta
                WHERE eta.EntityTypeId = et.EntityTypeId
                  AND eta.providerId = ?
                  AND eta.Active = 'Y'
              )
            ORDER BY et.EntityTypeName
        """, (provider_id,))
        
        return [
            {
                'id': row[0],
                'name': row[1],
                'code': row[2]
            }
            for row in cursor.fetchall()
        ]
    
    def _get_attributes(self, cursor, provider_id: int) -> List[Dict]:
        """Get all attributes for this provider with extraction rules"""
        cursor.execute("""
            SELECT 
                eta.entityTypeAttributeId,
                eta.entityTypeAttributeCode,
                eta.entityTypeAttributeName,
                eta.AttributeType,
                eta.providerId,
                ISNULL(eta.AggregationType, 'latest') as AggregationType
            FROM EntityTypeAttribute eta
            WHERE eta.Active = 'Y'
              AND eta.providerId = ?
            ORDER BY eta.entityTypeAttributeCode
        """, (provider_id,))
        
        return [
            {
                'id': row[0],
                'code': row[1],
                'name': row[2],
                'type': row[3],
                'provider_id': row[4],
                'aggregation': row[5]
            }
            for row in cursor.fetchall()
        ]
    
    def _get_provider_events(self, cursor, provider_id: int) -> List[Dict]:
        """Get provider event mappings with extraction rules"""
        cursor.execute("""
            SELECT 
                pe.providerEventId,
                pe.providerEventType,
                pe.protocolAttributeCode,
                pe.ValueJsonPath,
                pe.SampleArrayPath,
                pe.CompositeValueTemplate,
                pe.FieldMappingJSON
            FROM ProviderEvent pe
            WHERE pe.providerId = ? AND pe.Active = 'Y'
            ORDER BY pe.providerEventType
        """, (provider_id,))
        
        events = []
        for row in cursor.fetchall():
            events.append({
                'id': row[0],
                'type': row[1],
                'protocol_attribute_code': row[2],
                'value_json_path': row[3],
                'sample_array_path': row[4],
                'composite_template': json.loads(row[5]) if row[5] else {},
                'field_mapping': json.loads(row[6]) if row[6] else {}
            })
        
        return events
    
    def _get_active_entities(self, cursor, provider_id: int) -> List[Dict]:
        """Get active entities assigned to customers"""
        cursor.execute("""
            SELECT DISTINCT 
                e.EntityId,
                e.EntityTypeId,
                e.EntityName,
                c.CustomerName,
                ce.customerId
            FROM Entity e
            JOIN CustomerEntities ce ON e.EntityId = ce.entityId
            JOIN Customers c ON ce.customerId = c.customerId
            WHERE e.Active = 'Y'
              AND ce.active = 'Y'
              AND c.active = 'Y'
              AND EXISTS (
                SELECT 1 FROM EntityTypeAttribute eta
                WHERE eta.EntityTypeId = e.EntityTypeId
                  AND eta.providerId = ?
                  AND eta.Active = 'Y'
              )
            ORDER BY e.EntityName
        """, (provider_id,))
        
        return [
            {
                'id': row[0],
                'entity_type_id': row[1],
                'name': row[2],
                'customer_name': row[3],
                'customer_id': row[4]
            }
            for row in cursor.fetchall()
        ]
    
    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        from datetime import datetime
        return datetime.utcnow().isoformat() + 'Z'
    
    def export_for_entity(self, entity_id: str) -> Dict:
        """
        Export setup filtered for a specific entity
        (Useful for vessel-specific configurations)
        
        Returns only attributes/events relevant to that entity's type
        """
        try:
            connection = self._get_db_connection()
            cursor = connection.cursor()
            
            # Get entity's provider (from EntityTypeAttribute)
            cursor.execute("""
                SELECT DISTINCT eta.providerId
                FROM Entity e
                JOIN EntityType et ON e.EntityTypeId = et.EntityTypeId
                JOIN EntityTypeAttribute eta ON et.EntityTypeId = eta.EntityTypeId
                WHERE e.EntityId = ? AND e.Active = 'Y' AND eta.Active = 'Y'
            """, (entity_id,))
            
            rows = cursor.fetchall()
            if not rows:
                raise ValueError(f"Entity '{entity_id}' not found or has no attributes")
            
            provider_id = rows[0][0]
            
            # Get provider name
            cursor.execute("""
                SELECT ProviderName FROM Provider WHERE ProviderId = ?
            """, (provider_id,))
            
            provider_name = cursor.fetchone()[0]
            
            # Export full setup then filter to this entity
            full_setup = self.export_provider_setup(provider_name)
            
            # Get entity's type
            cursor.execute("""
                SELECT EntityTypeId FROM Entity WHERE EntityId = ?
            """, (entity_id,))
            
            entity_type_id = cursor.fetchone()[0]
            
            connection.close()
            
            # Filter setup to this entity
            setup = {
                **full_setup,
                'entity_filter': {
                    'entity_id': entity_id,
                    'entity_type_id': entity_type_id
                },
                'attributes': [
                    attr for attr in full_setup['attributes']
                    # Filter to attributes for this entity type (would need attribute-type mapping)
                ]
            }
            
            return setup
            
        except Exception as e:
            logger.error(f"Failed to export entity-specific setup: {e}")
            raise


# Example usage
if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    
    exporter = SetupExporter()
    
    # Export SignalK setup
    setup = exporter.export_provider_setup('N2KToSignalK')
    
    print(json.dumps(setup, indent=2))
    
    # Show structure
    print(f"\n✓ Provider: {setup['provider']['name']}")
    print(f"✓ Entity Types: {len(setup['entity_types'])}")
    print(f"✓ Attributes: {len(setup['attributes'])}")
    print(f"✓ Events: {len(setup['events'])}")
    print(f"✓ Active Entities: {len(setup['entities'])}")
