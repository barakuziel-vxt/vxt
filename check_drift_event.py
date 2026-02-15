#!/usr/bin/env python3
"""Check if RestHeartRateDrift event and subscriptions are marked as active"""

import os
import sys
import pyodbc
from dotenv import load_dotenv

load_dotenv()

server = os.getenv('DB_SERVER', 'localhost')
database = os.getenv('DB_NAME', 'VXT')
username = os.getenv('DB_USER', 'sa')
password = os.getenv('DB_PASSWORD', '')

try:
    # Try with ODBC Driver 17
    drivers_to_try = [
        f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};',
        f'DRIVER={{SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};'
    ]
    
    conn = None
    for driver_str in drivers_to_try:
        try:
            conn = pyodbc.connect(driver_str)
            break
        except:
            continue
    
    if not conn:
        print("ERROR: Could not connect to database")
        sys.exit(1)
    
    cursor = conn.cursor()
    
    print('=== RestHeartRateDrift Event Status ===')
    cursor.execute('''SELECT eventId, eventCode, active, AnalyzeFunctionId FROM Event WHERE eventCode = 'RestHeartRateDrift' ''')
    event = cursor.fetchone()
    if event:
        print(f'Event ID: {event[0]}, Code: {event[1]}, Active: {event[2]}, FunctionID: {event[3]}')
    else:
        print('Event not found!')
    
    print('\n=== RestHeartRateDrift Subscriptions ===')
    cursor.execute('''
    SELECT cs.customerSubscriptionId, cs.customerId, cs.entityId, cs.active, c.active as customer_active, ent.active as entity_active
    FROM CustomerSubscriptions cs
    JOIN Customers c ON cs.customerId = c.customerId
    JOIN Entity ent ON cs.entityId = ent.entityId
    JOIN Event e ON cs.eventId = e.eventId
    WHERE e.eventCode = 'RestHeartRateDrift'
    ''')
    rows = cursor.fetchall()
    print(f'Found {len(rows)} subscriptions')
    for row in rows:
        print(f'  SubID: {row[0]}, CustID: {row[1]}, Entity: {row[2]}, Sub Active: {row[3]}, Cust Active: {row[4]}, Entity Active: {row[5]}')
    
    print('\n=== Checking sp_GetSubscriptionDetails results ===')
    cursor.execute('EXEC dbo.sp_GetSubscriptionDetails @entityId = NULL, @onlyActive = 1')
    all_subs = cursor.fetchall()
    print(f'Total subscriptions from sp_GetSubscriptionDetails: {len(all_subs)}')
    
    # Filter for RestHeartRateDrift
    drift_subs = [row for row in all_subs if row[6] == 'RestHeartRateDrift']
    print(f'RestHeartRateDrift subscriptions from sp_GetSubscriptionDetails: {len(drift_subs)}')
    if drift_subs:
        for row in drift_subs:
            print(f'  Entity: {row[3]}, Event: {row[6]}, Function: {row[12]}, Type: {row[13]}')
    
    conn.close()
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
