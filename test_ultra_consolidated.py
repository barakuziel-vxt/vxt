#!/usr/bin/env python3
"""Test ultra-consolidated 2-query initialization with heavy JOINs"""

import logging
import pyodbc
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_ultra_consolidated_queries():
    """Test that 2 consolidated queries with JOINs work correctly"""
    
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
        print("Testing ULTRA-CONSOLIDATED 2-QUERY INITIALIZATION with Heavy JOINs")
        print("="*80)
        
        # QUERY 1: CONSOLIDATED Entity + Attribute + CustomerEntities JOIN
        print("\n[QUERY 1] Provider → Entity → EntityTypeAttribute → CustomerEntities")
        print("          (Single JOIN across all 4 tables)")
        
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
        """, (provider_name,))
        
        rows = cursor.fetchall()
        if not rows:
            print("✗ No data returned from Query 1")
            return False
        
        # Parse results into caches
        entity_cache = {}
        attribute_cache = set()
        customer_entities_cache = set()
        
        first_row = rows[0]
        provider_id = first_row[0]
        provider_config = {
            'ProviderId': first_row[0],
            'ProviderName': first_row[1],
            'TopicName': first_row[2],
            'BatchSize': first_row[3]
        }
        
        processed_entities = set()
        for row in rows:
            entity_id = row[4]
            entity_type_id = row[5]
            attr_code = row[6]
            is_customer_entity = row[7]
            
            # Add to entity cache (only once per entity)
            if entity_id not in processed_entities:
                entity_cache[entity_id] = entity_type_id
                processed_entities.add(entity_id)
            
            # Add attribute code
            attribute_cache.add(attr_code)
            
            # Add to customer entities if assigned to active customer
            if is_customer_entity and entity_id not in customer_entities_cache:
                customer_entities_cache.add(entity_id)
        
        print(f"✓ Provider: {provider_config['ProviderName']} (ID: {provider_id})")
        print(f"  Topic: {provider_config['TopicName']}, Batch: {provider_config['BatchSize']}")
        print(f"✓ Loaded from single Query 1 JOIN:")
        print(f"  - {len(entity_cache)} entities: {sorted(entity_cache.keys())}")
        print(f"  - {len(attribute_cache)} attribute codes (sample): {list(attribute_cache)[:5]}")
        print(f"  - {len(customer_entities_cache)} customer-assigned: {sorted(customer_entities_cache)}")
        
        # QUERY 2: CONSOLIDATED ProviderEvent + EntityTypeAttribute JOIN
        print("\n[QUERY 2] ProviderEvent ← EntityTypeAttribute")
        print("          (Single LEFT JOIN to map attributes)")
        
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
        for row in cursor.fetchall():
            event_mappings[row[1]] = {
                'provider_event_id': row[0],
                'protocol_attribute_code': row[2],
                'value_json_path': row[3],
                'sample_array_path': row[4],
                'composite_template': json.loads(row[5]) if row[5] else {},
                'field_mapping': json.loads(row[6]) if row[6] else {},
                'entity_type_attribute_id': row[7]
            }
        
        print(f"✓ Loaded {len(event_mappings)} ProviderEvent mappings from Query 2")
        print(f"  Event types (sample): {list(event_mappings.keys())[:3]}")
        
        connection.close()
        
        print("\n" + "="*80)
        print("ULTRA-CONSOLIDATED QUERY TEST: ✓ PASSED")
        print("="*80)
        print(f"\n📊 EFFICIENCY IMPROVEMENT:")
        print(f"   Before: 5 separate queries → {len(rows)} + {len(event_mappings)} result rows")
        print(f"   After:  2 consolidated queries with JOINs")
        print(f"   Benefit: Fewer DB round-trips, heavier JOINs, one connection session")
        
        print(f"\n🎯 FINAL CACHES:")
        print(f"   Entities:           {len(entity_cache)}")
        print(f"   Attributes:         {len(attribute_cache)}")
        print(f"   Customer Entities:  {len(customer_entities_cache)}")
        print(f"   Event Mappings:     {len(event_mappings)}")
        print()
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Test failed: {e}", exc_info=True)
        return False


if __name__ == '__main__':
    import sys
    success = test_ultra_consolidated_queries()
    sys.exit(0 if success else 1)
