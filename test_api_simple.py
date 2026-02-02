#!/usr/bin/env python
"""Test the API endpoint directly"""
import sys
sys.path.insert(0, 'C:\\VXT')

try:
    print("Importing main...")
    from main import get_boat_telemetry
    print("Import successful!")
    
    print("\nCalling get_boat_telemetry...")
    result = get_boat_telemetry('234567890', 2)
    
    print(f"Success! Got {len(result)} records:")
    for record in result:
        print(f"  - {record}")
        
except Exception as e:
    import traceback
    print(f"ERROR: {e}")
    traceback.print_exc()
