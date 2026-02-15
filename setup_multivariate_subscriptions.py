"""
Setup subscriptions for Multivariate Correlation Shift event
Creates subscriptions for Barak and Shula entities monitoring Heart Rate + SpO2 correlation
"""

import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()

server = os.getenv('DB_SERVER', '127.0.0.1')
database = os.getenv('DB_NAME', 'BoatTelemetryDB')
username = os.getenv('DB_USER', 'sa')
password = os.getenv('DB_PASSWORD', 'Real_Password_123!')

conn_str = f'DRIVER={{SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};'

try:
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    
    print('=' * 80)
    print('Setting up Multivariate Correlation Shift subscriptions')
    print('=' * 80)
    
    # Step 1: Find SLMEDICAL customer
    print('\n[Step 1] Finding SLMEDICAL customer...')
    cursor.execute('''
    SELECT customerId, customerName 
    FROM dbo.Customer 
    WHERE customerName = 'SLMEDICAL'
    ''')
    
    row = cursor.fetchone()
    if not row:
        print('✗ ERROR: SLMEDICAL customer not found')
        conn.close()
        exit(1)
    
    customer_id = row[0]
    print(f'✓ Found SLMEDICAL customer (ID: {customer_id})')
    
    # Step 2: Find Barak entity
    print('\n[Step 2] Finding Barak entity...')
    cursor.execute('''
    SELECT entityId, entityFirstName, entityLastName
    FROM dbo.Entity 
    WHERE (entityFirstName = 'Barak' OR entityLastName = 'Barak' OR entityFirstName LIKE '%Barak%')
    AND active = 'Y'
    ''')
    
    barak_row = cursor.fetchone()
    if not barak_row:
        print('✗ ERROR: Barak entity not found')
        conn.close()
        exit(1)
    
    barak_entity_id = barak_row[0]
    barak_name = f"{barak_row[1] or ''} {barak_row[2] or ''}".strip()
    print(f'✓ Found Barak entity: {barak_name} (ID: {barak_entity_id})')
    
    # Step 3: Find Shula entity
    print('\n[Step 3] Finding Shula entity...')
    cursor.execute('''
    SELECT entityId, entityFirstName, entityLastName
    FROM dbo.Entity 
    WHERE (entityFirstName = 'Shula' OR entityLastName = 'Shula' OR entityFirstName LIKE '%Shula%')
    AND active = 'Y'
    ''')
    
    shula_row = cursor.fetchone()
    if not shula_row:
        print('✗ ERROR: Shula entity not found')
        conn.close()
        exit(1)
    
    shula_entity_id = shula_row[0]
    shula_name = f"{shula_row[1] or ''} {shula_row[2] or ''}".strip()
    print(f'✓ Found Shula entity: {shula_name} (ID: {shula_entity_id})')
    
    # Step 4: Find HeartRateSpO2CorrelationShift event
    print('\n[Step 4] Finding HeartRateSpO2CorrelationShift event...')
    cursor.execute('''
    SELECT eventId, eventCode, eventDescription
    FROM dbo.Event
    WHERE eventCode = 'HeartRateSpO2CorrelationShift'
    AND active = 'Y'
    ''')
    
    event_row = cursor.fetchone()
    if not event_row:
        print('✗ ERROR: HeartRateSpO2CorrelationShift event not found')
        print('Make sure to run: .\\venv\\Scripts\\python.exe deploy_sql.py db/sql/0185_Setup_MultivariateCorrectionShift.sql')
        conn.close()
        exit(1)
    
    event_id = event_row[0]
    event_code = event_row[1]
    print(f'✓ Found event: {event_code} (ID: {event_id})')
    print(f'  Description: {event_row[2]}')
    
    # Step 5: Create subscription for Barak
    print(f'\n[Step 5a] Creating subscription for {barak_name}...')
    
    cursor.execute('''
    SELECT COUNT(*) as cnt FROM dbo.CustomerSubscriptions 
    WHERE customerId = ? AND eventId = ? AND entityId = ?
    ''', (customer_id, str(event_id), barak_entity_id))
    
    exists = cursor.fetchone()[0]
    if exists == 0:
        cursor.execute('''
        INSERT INTO dbo.CustomerSubscriptions 
        (customerId, eventId, entityId, active)
        VALUES (?, ?, ?, 'Y')
        ''', (customer_id, str(event_id), barak_entity_id))
        
        conn.commit()
        print(f'✓ Created subscription for {barak_name} → HeartRateSpO2CorrelationShift')
    else:
        print(f'✓ Subscription for {barak_name} already exists')
    
    # Step 6: Create subscription for Shula
    print(f'\n[Step 5b] Creating subscription for {shula_name}...')
    
    cursor.execute('''
    SELECT COUNT(*) as cnt FROM dbo.CustomerSubscriptions 
    WHERE customerId = ? AND eventId = ? AND entityId = ?
    ''', (customer_id, str(event_id), shula_entity_id))
    
    exists = cursor.fetchone()[0]
    if exists == 0:
        cursor.execute('''
        INSERT INTO dbo.CustomerSubscriptions 
        (customerId, eventId, entityId, active)
        VALUES (?, ?, ?, 'Y')
        ''', (customer_id, str(event_id), shula_entity_id))
        
        conn.commit()
        print(f'✓ Created subscription for {shula_name} → HeartRateSpO2CorrelationShift')
    else:
        print(f'✓ Subscription for {shula_name} already exists')
    
    # Step 7: Display final summary
    print('\n' + '=' * 80)
    print('SUMMARY - Multivariate Correlation Shift Subscriptions')
    print('=' * 80)
    print(f'Customer: SLMEDICAL (ID: {customer_id})')
    print(f'Event: HeartRateSpO2CorrelationShift (ID: {event_id})')
    print(f'Subscribed Entities:')
    print(f'  1. {barak_name} (ID: {barak_entity_id})')
    print(f'  2. {shula_name} (ID: {shula_entity_id})')
    print('')
    print('Analysis Details:')
    print('  - Monitors Heart Rate (8867-4) ↔ SpO2 (59408-5) correlation')
    print('  - Current window: 24 hours')
    print('  - Baseline: 7 days')
    print('  - Threshold: Correlation shift > 0.25 (Pearson r coefficient)')
    print('  - Expected: Negative correlation (HR increases when SpO2 drops)')
    print('')
    print('⚠ Note: Simulators (Barak & Shula) are generating realistic health data.')
    print('   Subscriptions are active and will trigger events when correlation shifts.')
    print('=' * 80)
    
    conn.close()
    
except pyodbc.Error as e:
    print(f'✗ Database error: {e}')
    exit(1)
except Exception as e:
    print(f'✗ Error: {e}')
    exit(1)
