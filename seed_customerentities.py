import pyodbc
import time

# Connect to SQL Server
print("[1/3] Connecting to SQL Server...")
for attempt in range(5):
    try:
        conn = pyodbc.connect(
            'DRIVER={SQL Server};'
            'SERVER=127.0.0.1,1433;'
            'DATABASE=BoatTelemetryDB;'
            'UID=sa;'
            'PWD=YourStrongPassword123!;'
        )
        print("[✓] Connected to SQL Server")
        break
    except Exception as e:
        if attempt < 4:
            print(f"[Attempt {attempt+1}/5] Waiting... {str(e)[:50]}")
            time.sleep(3)
        else:
            print(f"[✗] Connection failed: {e}")
            exit(1)

cursor = conn.cursor()

# Execute migration to create table
print("\n[2/3] Creating CustomerEntities table...")
try:
    # Drop existing if present
    cursor.execute("DROP TABLE IF EXISTS CustomerEntities")
    
    # Create table
    cursor.execute("""
    CREATE TABLE CustomerEntities (
        customerEntityId INT PRIMARY KEY IDENTITY(1,1),
        customerId INT NOT NULL,
        entityId NVARCHAR(50) NOT NULL,

        active CHAR(1) NOT NULL CONSTRAINT DF_CustomerEntities_active DEFAULT ('Y'),
        createDate DATETIME NOT NULL CONSTRAINT DF_CustomerEntities_createDate DEFAULT (GETDATE()),
        lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_CustomerEntities_lastUpdateTimestamp DEFAULT (GETDATE()),
        lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_CustomerEntities_lastUpdateUser DEFAULT (SUSER_SNAME())
    )
    """)
    
    # Add unique constraint
    cursor.execute("""
    ALTER TABLE CustomerEntities 
    ADD CONSTRAINT UQ_CustomerEntities_CustomerId_EntityId 
    UNIQUE (customerId, entityId)
    """)
    
    # Add foreign keys
    cursor.execute("""
    IF OBJECT_ID('Customers','U') IS NOT NULL
    BEGIN
        ALTER TABLE CustomerEntities ADD CONSTRAINT FK_CustomerEntities_Customers FOREIGN KEY (customerId) REFERENCES Customers(customerId);
    END
    """)
    
    cursor.execute("""
    IF OBJECT_ID('Entity','U') IS NOT NULL
    BEGIN
        ALTER TABLE CustomerEntities ADD CONSTRAINT FK_CustomerEntities_Entity FOREIGN KEY (entityId) REFERENCES Entity(entityId);
    END
    """)
    
    # Create indexes
    cursor.execute("CREATE INDEX IX_CustomerEntities_CustomerId ON CustomerEntities (customerId)")
    cursor.execute("CREATE INDEX IX_CustomerEntities_EntityId ON CustomerEntities (entityId)")
    
    conn.commit()
    print("[✓] CustomerEntities table created successfully")
except Exception as e:
    conn.rollback()
    print(f"[✗] Error creating table: {e}")
    exit(1)

# Seed data
print("\n[3/3] Seeding initial data...")
try:
    # Get available customers and entities
    cursor.execute("SELECT customerId FROM Customers WHERE active = 'Y' ORDER BY customerId")
    customers = [row[0] for row in cursor.fetchall()]
    
    cursor.execute("SELECT entityId FROM Entity WHERE active = 'Y' ORDER BY entityId")
    entities = [row[0] for row in cursor.fetchall()]
    
    print(f"  Found {len(customers)} active customers and {len(entities)} active entities")
    
    if customers and entities:
        # Create various assignments
        insertions = []
        
        # Sailor (customerId 1) gets some boat entities
        sailor_boats = [e for e in entities if e in ['033114869', '234567890', '234567891']]
        for boat in sailor_boats:
            insertions.append((1, boat))
        
        # SLMEDICAL (customerId 2) gets person entities
        slmedical_people = [e for e in entities if e in ['033114869', '234567890']]
        for person in slmedical_people:
            insertions.append((2, person))
        
        # Insert all assignments
        for customerId, entityId in insertions:
            try:
                cursor.execute("""
                INSERT INTO CustomerEntities (customerId, entityId, active)
                VALUES (?, ?, 'Y')
                """, (customerId, entityId))
            except Exception as e:
                if 'Violation of UNIQUE KEY constraint' in str(e):
                    print(f"  ⚠ Duplicate: {entityId} already assigned to customer {customerId}")
                else:
                    raise
        
        conn.commit()
        print(f"[✓] Seeded {len(insertions)} customer-entity assignments")
    else:
        print("[!] No customers or entities found to seed")

    # Verify
    cursor.execute("""
    SELECT ce.customerEntityId, c.customerName, ce.entityId, e.entityFirstName, ce.active
    FROM CustomerEntities ce
    LEFT JOIN Customers c ON ce.customerId = c.customerId
    LEFT JOIN Entity e ON ce.entityId = e.entityId
    ORDER BY ce.customerEntityId
    """)
    
    rows = cursor.fetchall()
    print(f"\n[VERIFICATION] Total customer entities: {len(rows)}")
    print("\nCurrent assignments:")
    for row in rows:
        print(f"  ID {row[0]}: {row[1]} → {row[2]} ({row[3]}) [Active: {row[4]}]")

except Exception as e:
    conn.rollback()
    print(f"[✗] Error seeding data: {e}")
    import traceback
    traceback.print_exc()
finally:
    cursor.close()
    conn.close()

print("\n[COMPLETE] CustomerEntities table initialized and seeded successful! ✅")
