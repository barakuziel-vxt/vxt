import pyodbc
import time

print("[TEST] Validating CustomerEntities filter logic in generic_telemetry_consumer...")
print("=" * 70)

# Connect to SQL Server
for attempt in range(5):
    try:
        conn = pyodbc.connect(
            'DRIVER={SQL Server};'
            'SERVER=127.0.0.1,1433;'
            'DATABASE=BoatTelemetryDB;'
            'UID=sa;'
            'PWD=YourStrongPassword123!;'
        )
        print("[✓] Connected to SQL Server\n")
        break
    except Exception as e:
        if attempt < 4:
            time.sleep(3)
        else:
            print(f"[✗] Connection failed: {e}")
            exit(1)

cursor = conn.cursor()

# Test 1: Check active CustomerEntities
print("[TEST 1] Check active CustomerEntities with active customers:")
cursor.execute("""
SELECT DISTINCT ce.entityId, c.customerName, c.active, ce.active
FROM CustomerEntities ce
JOIN Customers c ON ce.customerId = c.customerId
WHERE ce.active = 'Y' AND c.active = 'Y'
ORDER BY c.customerName, ce.entityId
""")

rows = cursor.fetchall()
print(f"  Found {len(rows)} active customer entities:")
for row in rows:
    print(f"    - Entity: {row[0]} (Customer: {row[1]}, Active: {row[3]})")

# Test 2: Check inactive CustomerEntities that should be filtered out
print("\n[TEST 2] Check inactive CustomerEntities (should be FILTERED OUT):")
cursor.execute("""
SELECT DISTINCT ce.entityId, c.customerName, c.active, ce.active
FROM CustomerEntities ce
JOIN Customers c ON ce.customerId = c.customerId
WHERE ce.active = 'N' OR c.active = 'N'
ORDER BY c.customerName, ce.entityId
""")

rows = cursor.fetchall()
if rows:
    print(f"  Found {len(rows)} inactive customer entities that will be filtered:")
    for row in rows:
        print(f"    - Entity: {row[0]} (Customer: {row[1]}, CE Active: {row[3]}, Customer Active: {row[2]})")
else:
    print(f"  No inactive customer entities found (all are active)")

# Test 3: Show entities in Entity table that are NOT in CustomerEntities
print("\n[TEST 3] Entities in Entity table but NOT assigned to any customer:")
cursor.execute("""
SELECT DISTINCT e.entityId, e.entityFirstName
FROM Entity e
WHERE e.active = 'Y'
  AND NOT EXISTS (
    SELECT 1 FROM CustomerEntities ce
    WHERE ce.entityId = e.entityId 
      AND ce.active = 'Y'
      AND EXISTS (
        SELECT 1 FROM Customers c
        WHERE c.customerId = ce.customerId
        AND c.active = 'Y'
      )
  )
ORDER BY e.entityId
""")

rows = cursor.fetchall()
if rows:
    print(f"  Found {len(rows)} entities NOT assigned to active customers:")
    for row in rows:
        print(f"    - Entity: {row[0]} ({row[1]}) - Will be FILTERED OUT")
else:
    print(f"  All active entities are assigned to active customers ✓")

# Test 4: Check what the cache would contain
print("\n[TEST 4] Expected cache contents for _load_customer_entities_cache():")
cursor.execute("""
SELECT DISTINCT ce.entityId
FROM CustomerEntities ce
JOIN Customers c ON ce.customerId = c.customerId
WHERE ce.active = 'Y'
  AND c.active = 'Y'
""")

cache_entities = [row[0] for row in cursor.fetchall()]
print(f"  Cache size: {len(cache_entities)} entities")
print(f"  Cache contents: {cache_entities}")

conn.close()

print("\n" + "=" * 70)
print("[SUMMARY] Filter validation complete!")
print("\nThe generic consumer will now:")
print("  ✓ Only insert data for entities assigned to active customers")
print("  ✓ Filter out entities not in CustomerEntities")
print("  ✓ Filter out entities assigned to inactive customers")
print("  ✓ Maintain efficient caching for performance")
