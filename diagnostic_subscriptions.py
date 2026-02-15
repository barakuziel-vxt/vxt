#!/usr/bin/env python
"""
Diagnostic script to check subscription processing status
"""
import pyodbc

SQL_CONN_STR = 'DRIVER={SQL Server};SERVER=127.0.0.1;DATABASE=BoatTelemetryDB;UID=sa;PWD=YourStrongPassword123!'

try:
    conn = pyodbc.connect(SQL_CONN_STR)
    cursor = conn.cursor()
    
    print("Checking Python-based subscriptions...\n")
    
    # Get all Python subscriptions with function details
    query = """
    SELECT 
        cs.customerSubscriptionId,
        c.customerName,
        cs.entityId,
        e.eventCode,
        e.eventDescription,
        af.FunctionName,
        af.FunctionType,
        af.AnalyzePath,
        e.AnalyzeFunctionId
    FROM CustomerSubscriptions cs
    JOIN Customer c ON cs.customerId = c.customerId
    JOIN Event e ON cs.eventId = e.eventId
    LEFT JOIN AnalyzeFunction af ON e.AnalyzeFunctionId = af.AnalyzeFunctionId
    WHERE cs.active = 'Y'
    ORDER BY af.FunctionName, cs.customerSubscriptionId
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    
    function_groups = {}
    for row in rows:
        func_name = row[5] or 'Unknown'
        if func_name not in function_groups:
            function_groups[func_name] = []
        function_groups[func_name].append({
            'id': row[0],
            'customer': row[1],
            'entity': row[2],
            'event': row[3],
            'function': row[5],
            'type': row[6],
            'path': row[7]
        })
    
    for func_name, subs in function_groups.items():
        print(f"Function: {func_name} ({len(subs)} subscriptions)")
        for sub in subs:
            print(f"  - {sub['customer']} / {sub['entity']} / {sub['event']}")
            if sub['path']:
                print(f"    Path: {sub['path']}")
        print()
    
    # Check if DriftDetector exists and is configured properly
    print("\nChecking DriftDetector function...")
    cursor.execute("""
    SELECT AnalyzeFunctionId, FunctionName, FunctionType, AnalyzePath, active
    FROM AnalyzeFunction
    WHERE FunctionName = 'DriftDetector'
    """)
    
    drift_row = cursor.fetchone()
    if drift_row:
        print(f"  ID: {drift_row[0]}")
        print(f"  Name: {drift_row[1]}")
        print(f"  Type: {drift_row[2]}")
        print(f"  Path: {drift_row[3]}")
        print(f"  Active: {drift_row[4]}")
    else:
        print("  NOT FOUND!")
    
    # Check if RestHeartRateDrift event exists
    print("\nChecking RestHeartRateDrift event...")
    cursor.execute("""
    SELECT e.eventId, e.eventCode, e.AnalyzeFunctionId, e.LookbackMinutes, e.SensitivityThreshold, e.MinSamplesRequired
    FROM Event e
    WHERE e.eventCode = 'RestHeartRateDrift'
    """)
    
    event_row = cursor.fetchone()
    if event_row:
        print(f"  ID: {event_row[0]}")
        print(f"  Code: {event_row[1]}")
        print(f"  Function ID: {event_row[2]}")
        print(f"  Lookback: {event_row[3]} minutes")
        print(f"  Sensitivity: {event_row[4]}")
        print(f"  Min Samples: {event_row[5]}")
    else:
        print("  NOT FOUND!")
    
    # Check subscriptions linking to RestHeartRateDrift
    print("\nRestHeartRateDrift Subscriptions:")
    cursor.execute("""
    SELECT cs.customerSubscriptionId, c.customerName, cs.entityId, e.eventCode, cs.active
    FROM CustomerSubscriptions cs
    JOIN Customer c ON cs.customerId = c.customerId
    JOIN Event e ON cs.eventId = e.eventId
    WHERE e.eventCode = 'RestHeartRateDrift'
    ORDER BY cs.customerSubscriptionId
    """)
    
    drift_subs = cursor.fetchall()
    if drift_subs:
        for sub in drift_subs:
            print(f"  Sub {sub[0]}: {sub[1]} / {sub[2]} / {sub[4]}")
    else:
        print("  NO SUBSCRIPTIONS FOUND")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
