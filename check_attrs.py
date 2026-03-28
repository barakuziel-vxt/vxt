#!/usr/bin/env python3
from mssql_python import connect

conn = connect("Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;Authentication=ActiveDirectoryMSI;Encrypt=yes;TrustServerCertificate=no;")
cursor = conn.cursor()

print("=" * 90)
print("EntityTypeAttribute CODES in DB")
print("=" * 90)
cursor.execute("SELECT DISTINCT eta.entityTypeAttributeCode, eta.providerId FROM EntityTypeAttribute eta WHERE eta.active='Y' ORDER BY eta.entityTypeAttributeCode")
for row in cursor.fetchall():
    print(f"  {row[0]:<45} providerId={row[1]}")

print("\n" + "=" * 90)
print("Attributes for TEST ENTITIES (234567890, 234567891)")
print("=" * 90)
cursor.execute("""
SELECT DISTINCT eta.entityTypeAttributeCode, eta.providerId, e.entityId, e.entityTypeId, et.entityTypeName
FROM EntityTypeAttribute eta
JOIN Entity e ON e.entityTypeId = eta.entityTypeId
JOIN EntityType et ON et.entityTypeId = e.entityTypeId
WHERE e.entityId IN ('234567890', '234567891')
  AND eta.active = 'Y'
ORDER BY e.entityId, eta.entityTypeAttributeCode
""")
for row in cursor.fetchall():
    print(f"  Entity {row[2]:<12} ({row[4]:<20}) | Code: {row[0]:<40} providerId={row[1]}")

print("\n" + "=" * 90)
print("Checking if N2KToSignalK provider (providerId) is configured...")
print("=" * 90)
cursor.execute("SELECT ProviderId, ProviderName FROM Provider WHERE ProviderName='N2KToSignalK'")
prov = cursor.fetchone()
if prov:
    print(f"  ✓ Provider N2KToSignalK found: providerId={prov[0]}")
else:
    print(f"  ✗ Provider N2KToSignalK NOT FOUND!")

cursor.close()
conn.close()
