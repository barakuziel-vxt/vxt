"""Deploy IoT Device IDs to entities"""
import pyodbc

print("[1/3] Connecting to SQL Server...")
try:
    conn = pyodbc.connect(
        'DRIVER={SQL Server};'
        'SERVER=127.0.0.1,1433;'
        'DATABASE=BoatTelemetryDB;'
        'UID=sa;'
        'PWD=YourStrongPassword123!;'
    )
    print("[✓] Connected to SQL Server")
except Exception as e:
    print(f"[✗] Connection failed: {e}")
    exit(1)

cursor = conn.cursor()

# Verify column exists
print("\n[2/3] Verifying iotDeviceId column exists...")
try:
    cursor.execute("""
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CustomerEntities' AND COLUMN_NAME = 'iotDeviceId'
    """)
    result = cursor.fetchone()
    if result:
        print("[✓] iotDeviceId column exists")
    else:
        print("[✗] iotDeviceId column NOT found - schema update failed")
        exit(1)
except Exception as e:
    print(f"[✗] Error checking schema: {e}")
    exit(1)

# Populate device IDs based on entity assignments
print("\n[3/3] Populating IoT Device IDs...")
try:
    # Map entities to their primary device IDs
    device_mappings = {
        '033114869': 'vessel-033114869',        # Barak
        '234567890': 'TomerRefael',             # Tomer Refael
        '234567891': 'vessel-234567891',        # TinyK
    }
    
    cursor.execute("SELECT customerEntityId, entityId FROM CustomerEntities WHERE iotDeviceId IS NULL")
    unassigned = cursor.fetchall()
    
    assignments = []
    for customer_entity_id, entity_id in unassigned:
        device_id = device_mappings.get(entity_id, f"device-{entity_id}")
        cursor.execute(
            "UPDATE CustomerEntities SET iotDeviceId = ? WHERE customerEntityId = ?",
            (device_id, customer_entity_id)
        )
        assignments.append((customer_entity_id, entity_id, device_id))
    
    conn.commit()
    
    if assignments:
        print(f"[✓] Assigned {len(assignments)} device IDs:")
        for ce_id, entity_id, device_id in assignments:
            print(f"  - ID {ce_id}: {entity_id} → {device_id}")
    else:
        print("[✓] All entities already have device IDs assigned")
    
except Exception as e:
    conn.rollback()
    print(f"[✗] Error populating device IDs: {e}")
    exit(1)

# Display all entities
print("\n[VERIFICATION] Current assignments:")
try:
    cursor.execute("""
    SELECT customerEntityId, customerId, entityId, iotDeviceId, active 
    FROM CustomerEntities 
    ORDER BY customerEntityId
    """)
    rows = cursor.fetchall()
    for row in rows:
        status = "✓" if row[4] == 'Y' else "✗"
        print(f"  {status} ID {row[0]}: Customer {row[1]} → Entity {row[2]} → Device {row[3]}")
except Exception as e:
    print(f"[✗] Error displaying assignments: {e}")

cursor.close()
conn.close()

print("\n[COMPLETE] IoT Device ID deployment successful! ✅")
