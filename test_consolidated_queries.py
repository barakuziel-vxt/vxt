#!/usr/bin/env python3
"""Test consolidated query initialization without Kafka dependency"""

import logging
import pyodbc
import json
from importlib import import_module

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_consolidated_queries():
    """Test that all 5 consolidated queries execute correctly"""
    
    db_server = 'localhost'
    db_name = 'BoatTelemetryDB'
    db_user = 'sa'
    db_password = 'YourStrongPassword123!'
    provider_name = 'Junction'
    
    try:
        connection_string = (
            'DRIVER={SQL Server};'
            f'SERVER={db_server};'
            f'DATABASE={db_name};'
            f'UID={db_user};'
            f'PWD={db_password}'
        )
        connection = pyodbc.connect(connection_string)
        cursor = connection.cursor()
        
        print("\n" + "="*80)
        print("Testing Consolidated Query Initialization")
        print("="*80)
        
        # QUERY 1: Get Provider config
        print("\n[QUERY 1] Provider config...")
        cursor.execute("""
            SELECT ProviderId, ProviderName, TopicName, BatchSize
            FROM Provider
            WHERE ProviderName = ? AND Active = 'Y'
        """, (provider_name,))
        
        row = cursor.fetchone()
        if not row:
            print(f"✗ Provider '{provider_name}' not found or inactive")
            return False
        
        provider_id = row[0]
        provider_config = {
            'ProviderId': row[0],
            'ProviderName': row[1],
            'TopicName': row[2],
            'BatchSize': row[3]
        }
        print(f"✓ Provider: {provider_config['ProviderName']} (ID: {provider_id})")
        print(f"  Topic: {provider_config['TopicName']}, Batch Size: {provider_config['BatchSize']}")
        
        # QUERY 2: Entity cache
        print("\n[QUERY 2] Entity cache (with EntityTypeAttribute)...")
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
        """, (provider_id,))
        
        entity_cache = {}
        rows = cursor.fetchall()
        for row in rows:
            entity_cache[row[0]] = row[1]
        
        print(f"✓ Cached {len(entity_cache)} entities for provider")
        print(f"  Sample entities: {list(entity_cache.keys())[:5]}")
        
        # QUERY 3: Attribute codes
        print("\n[QUERY 3] Attribute codes...")
        cursor.execute("""
            SELECT DISTINCT eta.entityTypeAttributeCode
            FROM EntityTypeAttribute eta
            WHERE eta.Active = 'Y' AND eta.providerId = ?
        """, (provider_id,))
        
        attribute_cache = set(row[0] for row in cursor.fetchall())
        print(f"✓ Cached {len(attribute_cache)} attribute codes")
        print(f"  Sample attributes: {list(attribute_cache)[:5]}")
        
        # QUERY 4: Customer entities
        print("\n[QUERY 4] Customer entities (active customers only)...")
        cursor.execute("""
            SELECT DISTINCT ce.entityId
            FROM CustomerEntities ce
            JOIN Customers c ON ce.customerId = c.customerId
            WHERE ce.active = 'Y' AND c.active = 'Y'
        """)
        
        customer_entities_cache = set(row[0] for row in cursor.fetchall())
        print(f"✓ Cached {len(customer_entities_cache)} customer entities")
        print(f"  Entities: {sorted(customer_entities_cache)}")
        
        # QUERY 5: ProviderEvent mappings
        print("\n[QUERY 5] ProviderEvent mappings...")
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
        """, (provider_id,))
        
        event_mappings = {}
        rows = cursor.fetchall()
        for row in rows:
            event_mappings[row[1]] = {
                'provider_event_id': row[0],
                'protocol_attribute_code': row[2],
                'value_json_path': row[3],
                'sample_array_path': row[4],
                'composite_template': json.loads(row[5]) if row[5] else {},
                'field_mapping': json.loads(row[6]) if row[6] else {},
                'entity_type_attribute_id': row[7]
            }
        
        print(f"✓ Cached {len(event_mappings)} ProviderEvent mappings")
        print(f"  Event types: {list(event_mappings.keys())[:5]}")
        
        connection.close()
        
        print("\n" + "="*80)
        print("CONSOLIDATED QUERY TEST: ✓ PASSED")
        print("="*80)
        print(f"\nSummary:")
        print(f"  Provider:          {provider_config['ProviderName']}")
        print(f"  Entities:          {len(entity_cache)}")
        print(f"  Attributes:        {len(attribute_cache)}")
        print(f"  Customer Entities: {len(customer_entities_cache)}")
        print(f"  Event Mappings:    {len(event_mappings)}")
        print(f"\nAll 5 consolidated queries executed successfully!\n")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Test failed: {e}", exc_info=True)
        return False


if __name__ == '__main__':
    import sys
    success = test_consolidated_queries()
    sys.exit(0 if success else 1)
