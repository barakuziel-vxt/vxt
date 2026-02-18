#!/usr/bin/env python3
import pyodbc

try:
    conn = pyodbc.connect(
        'DRIVER={SQL Server};'
        'SERVER=127.0.0.1;'
        'DATABASE=BoatTelemetryDB;'
        'UID=sa;'
        'PWD=YourStrongPassword123!'
    )
    cur = conn.cursor()
    
    # Check customers
    cur.execute('SELECT TOP 5 customerId, customerName, active FROM Customers WHERE active = ?', ('Y',))
    customers = cur.fetchall()
    print(f"Active Customers: {len(customers)}")
    for c in customers:
        print(f"  {c[0]} - {c[1]} - {c[2]}")
    
    # Check subscriptions
    cur.execute('''
        SELECT TOP 5 cs.customerSubscriptionId, c.customerName, cs.entityId, e.eventCode, cs.active 
        FROM CustomerSubscriptions cs
        JOIN Customers c ON cs.customerId = c.customerId
        LEFT JOIN Event e ON cs.eventId = e.eventId
        WHERE cs.active = ?
    ''', ('Y',))
    subs = cur.fetchall()
    print(f"\nActive Subscriptions: {len(subs)}")
    for s in subs:
        print(f"  {s[0]} - {s[1]} - {s[2]} - {s[3]} - {s[4]}")
    
    cur.close()
    conn.close()
    print("\n✓ Database connection successful")
    
except Exception as e:
    print(f"✗ Database error: {str(e)}")
