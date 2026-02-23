#!/usr/bin/env python3
"""
Setup script to:
1. Create AnalyzeGeofence function
2. Create "Insert into Restricted Area 1" event
3. Create subscription for SAILOR customer on TinyK entity
"""

import sys
sys.path.insert(0, '.')
from main import get_db_connection

def setup_geofence_system():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        print("=" * 60)
        print("Setting up Geofence System")
        print("=" * 60)
        
        # 1. Insert AnalyzeGeofence function
        print("\n[1/3] Creating AnalyzeGeofence function...")
        cur.execute("""
            INSERT INTO AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, active)
            VALUES (?, ?, ?, ?)
        """, ("AnalyzeGeofence", "Geofence", "geofence_analyzer.check_location_in_zone", "Y"))
        conn.commit()
        
        # Get the AnalyzeFunctionId
        cur.execute("SELECT AnalyzeFunctionId FROM AnalyzeFunction WHERE FunctionName = ?", ("AnalyzeGeofence",))
        analyze_func_id = cur.fetchone()[0]
        print(f"✓ AnalyzeGeofence created with ID: {analyze_func_id}")
        
        # 2. Get EntityTypeId for "Ship" (or another appropriate type)
        print("\n[2/3] Creating 'Insert into Restricted Area 1' event...")
        cur.execute("SELECT entityTypeId FROM EntityType WHERE entityTypeName = 'Ship'")
        result = cur.fetchone()
        
        if result:
            entity_type_id = result[0]
        else:
            # Default to first available entity type if Ship not found
            cur.execute("SELECT TOP 1 entityTypeId FROM EntityType ORDER BY entityTypeId")
            entity_type_id = cur.fetchone()[0]
        
        print(f"  Using EntityTypeId: {entity_type_id}")
        
        # Insert the new event
        cur.execute("""
            INSERT INTO Event (eventCode, eventDescription, entityTypeId, AnalyzeFunctionId, risk, active)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("GEOFENCE_BREACH", "Insert into Restricted Area 1", entity_type_id, analyze_func_id, "HIGH", "Y"))
        conn.commit()
        
        # Get the eventId
        cur.execute("SELECT eventId FROM Event WHERE eventCode = ?", ("GEOFENCE_BREACH",))
        event_id = cur.fetchone()[0]
        print(f"✓ Event created with ID: {event_id}")
        
        # 3. Create subscription for SAILOR on TinyK
        print("\n[3/3] Creating subscription...")
        
        # Get customerId for SAILOR
        cur.execute("SELECT customerId FROM Customers WHERE customerName = ?", ("Sailor",))
        result = cur.fetchone()
        if not result:
            print("✗ Customer 'Sailor' not found!")
            return False
        customer_id = result[0]
        print(f"  SAILOR customerId: {customer_id}")
        
        # Get entityId for TinyK
        cur.execute("SELECT entityId FROM Entity WHERE entityFirstName = ?", ("TinyK",))
        result = cur.fetchone()
        if not result:
            print("✗ Entity 'TinyK' not found!")
            return False
        entity_id = result[0]
        print(f"  TinyK entityId: {entity_id}")
        
        # Insert subscription
        cur.execute("""
            INSERT INTO CustomerSubscriptions (customerId, entityId, eventId, subscriptionStartDate, active)
            VALUES (?, ?, ?, GETDATE(), ?)
        """, (customer_id, entity_id, event_id, "Y"))
        conn.commit()
        
        print(f"✓ Subscription created")
        
        # Verify the subscription was created
        cur.execute("""
            SELECT cs.customerSubscriptionId, c.customerName, e.entityFirstName, ev.eventDescription
            FROM CustomerSubscriptions cs
            JOIN Customers c ON cs.customerId = c.customerId
            JOIN Entity e ON cs.entityId = e.entityId
            JOIN Event ev ON cs.eventId = ev.eventId
            WHERE c.customerName = 'Sailor' AND e.entityFirstName = 'TinyK'
        """)
        
        sub_result = cur.fetchone()
        if sub_result:
            print(f"\n✓ Verified subscription:")
            print(f"    ID: {sub_result[0]}")
            print(f"    Customer: {sub_result[1]}")
            print(f"    Entity: {sub_result[2]}")
            print(f"    Event: {sub_result[3]}")
        
        cur.close()
        conn.close()
        
        print("\n" + "=" * 60)
        print("✓ Setup complete!")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = setup_geofence_system()
    sys.exit(0 if success else 1)
