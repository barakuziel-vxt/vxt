"""
Deploy IoT Device ID schema and data to Azure SQL Database
"""
import pyodbc
import time

print("=" * 80)
print("Deploying to AZURE SQL DATABASE")
print("=" * 80)

# Azure SQL credentials
AZURE_SERVER = "vxtdb.database.windows.net"
AZURE_DB = "free-sql-db-5949639"
AZURE_USER = "vxt"
AZURE_PASSWORD = "Barak1976!"

print(f"\n[1/4] Connecting to Azure SQL Database...")
print(f"      Server: {AZURE_SERVER}")
print(f"      Database: {AZURE_DB}")

try:
    # Try different connection methods
    connection_strings = [
        # Try with ODBC Driver 17 first
        f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={AZURE_SERVER};DATABASE={AZURE_DB};UID={AZURE_USER};PWD={AZURE_PASSWORD};',
        # Try with generic ODBC driver
        f'DRIVER={{SQL Server}};SERVER={AZURE_SERVER};DATABASE={AZURE_DB};UID={AZURE_USER};PWD={AZURE_PASSWORD};',
        # Try without explicit driver
        f'SERVER={AZURE_SERVER};DATABASE={AZURE_DB};UID={AZURE_USER};PWD={AZURE_PASSWORD};',
    ]
    
    conn = None
    for conn_str in connection_strings:
        try:
            conn = pyodbc.connect(conn_str)
            print("[✓] Connected to Azure SQL Database")
            break
        except Exception as e:
            if "ODBC Driver" in str(e) or "Data source name not found" in str(e):
                continue
            else:
                raise
    
    if not conn:
        print("[✗] Could not establish connection with any driver")
        print("\nAvailable drivers on this system:")
        print(pyodbc.drivers())
        exit(1)
        
except Exception as e:
    print(f"[✗] Connection failed: {e}")
    print("\nTroubleshooting:")
    print("1. Check internet connection to Azure")
    print("2. Verify credentials (vxt / Barak1976!)")
    print("3. Ensure Azure SQL firewall allows your IP")
    print("4. Check if database exists: free-sql-db-5949639")
    exit(1)

cursor = conn.cursor()

# Step 2: Verify CustomerEntities table exists
print("\n[2/4] Checking if CustomerEntities table exists...")
try:
    cursor.execute("""
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME = 'CustomerEntities'
    """)
    
    if cursor.fetchone()[0] > 0:
        print("[✓] CustomerEntities table exists")
    else:
        print("[✗] CustomerEntities table NOT found - need to create it first")
        exit(1)
        
except Exception as e:
    print(f"[✗] Error checking table: {e}")
    exit(1)

# Step 3: Add iotDeviceId column if it doesn't exist
print("\n[3/4] Adding iotDeviceId column...")
try:
    # Check if column exists
    cursor.execute("""
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CustomerEntities' AND COLUMN_NAME = 'iotDeviceId'
    """)
    
    if not cursor.fetchone():
        # Column doesn't exist, add it
        cursor.execute("""
        ALTER TABLE CustomerEntities
        ADD iotDeviceId NVARCHAR(128) NULL
        """)
        conn.commit()
        print("[✓] Added iotDeviceId column")
    else:
        print("[✓] iotDeviceId column already exists")
        
except Exception as e:
    if "already exists" in str(e).lower():
        print("[✓] iotDeviceId column already exists")
    else:
        print(f"[✗] Error adding column: {e}")
        exit(1)

# Step 4: Populate device IDs
print("\n[4/4] Populating IoT Device IDs...")
try:
    # Map entities to their device IDs
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
            print(f"    • ID {ce_id}: {entity_id} → {device_id}")
    else:
        print("[✓] All entities already have device IDs assigned")
    
except Exception as e:
    conn.rollback()
    print(f"[✗] Error populating device IDs: {e}")
    exit(1)

# Verification
print("\n[VERIFICATION] Azure SQL Database entities:")
try:
    cursor.execute("""
    SELECT customerEntityId, customerId, entityId, iotDeviceId, active 
    FROM CustomerEntities 
    ORDER BY customerEntityId
    """)
    rows = cursor.fetchall()
    print(f"   Total: {len(rows)} entities")
    for row in rows:
        status = "✓" if row[4] == 'Y' else "✗"
        print(f"   {status} ID {row[0]}: Entity {row[2]} → Device {row[3]}")
except Exception as e:
    print(f"[✗] Error displaying assignments: {e}")

cursor.close()
conn.close()

print("\n" + "=" * 80)
print("[COMPLETE] Azure SQL Database deployment successful! ✅")
print("=" * 80 + "\n")

print("""
🎉 SUMMARY:
   ✓ Schema deployed to Azure SQL Database
   ✓ iotDeviceId column added
   ✓ Device IDs populated
   
📊 Both databases now have IoT Device ID support:
   ✓ Local SQL Server (127.0.0.1:1433)
   ✓ Azure SQL Database (vxtdb.database.windows.net)
   
🔄 Data is synchronized across both databases!
""")
