#!/usr/bin/env python3
"""
Test script to verify yacht telemetry data retrieval
Tests the /api/telemetry/range endpoint with known good dates
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
API_BASE = "http://localhost:8000"
YACHT_ENTITY_ID = "234567890"  # TomerRefael

def test_yacht_telemetry():
    """Test telemetry retrieval for yacht entity"""
    
    print("\n" + "="*70)
    print("YACHT TELEMETRY TEST")
    print("="*70)
    
    # Calculate date range: last 2 hours in UTC
    # Using simple datetime (no timezone library needed)
    now_utc = datetime.utcnow()
    two_hours_ago = now_utc - timedelta(hours=2)
    
    start_date_iso = two_hours_ago.isoformat() + "Z"
    end_date_iso = now_utc.isoformat() + "Z"
    
    print(f"\nUsing date range:")
    print(f"   Start: {start_date_iso}")
    print(f"   End:   {end_date_iso}")
    print(f"   (Now UTC: {now_utc.isoformat()}Z)")
    
    # Test /api/telemetry/latest
    print(f"\nTesting /api/telemetry/latest/{YACHT_ENTITY_ID}")
    try:
        latest_url = f"{API_BASE}/api/telemetry/latest/{YACHT_ENTITY_ID}"
        response = requests.get(latest_url, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            latest_data = response.json()
            print(f"   OK: Received {len(latest_data)} attributes with latest values")
            if len(latest_data) > 0:
                print(f"      Sample: {latest_data[0]['attributeCode']} = {latest_data[0]['numericValue']} {latest_data[0]['attributeUnit']}")
        else:
            print(f"   ERROR: {response.text}")
    except Exception as e:
        print(f"   EXCEPTION: {e}")
    
    # Test /api/telemetry/range
    print(f"\nTesting /api/telemetry/range/{YACHT_ENTITY_ID}")
    try:
        range_url = (f"{API_BASE}/api/telemetry/range/{YACHT_ENTITY_ID}"
                    f"?startDate={requests.utils.quote(start_date_iso)}"
                    f"&endDate={requests.utils.quote(end_date_iso)}")
        
        print(f"   URL: {range_url}")
        response = requests.get(range_url, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            telemetry_data = response.json()
            print(f"   OK: Received {len(telemetry_data)} telemetry records")
            
            if len(telemetry_data) > 0:
                first = telemetry_data[0]
                last = telemetry_data[-1]
                print(f"      First timestamp: {first.get('endTimestampUTC')}")
                print(f"      Last timestamp:  {last.get('endTimestampUTC')}")
                attrs = [k for k in first.keys() if k != 'endTimestampUTC' and k != 'latitude' and k != 'longitude'][:5]
                print(f"      Sample attributes: {attrs}")
            else:
                print(f"   WARNING: No telemetry records returned!")
                print(f"            This might indicate a date range or data issue")
        else:
            print(f"   ERROR: {response.text}")
    except Exception as e:
        print(f"   EXCEPTION: {e}")
    
    # Also test a person entity for comparison
    print(f"\nTesting person entity (033114869) for comparison:")
    try:
        range_url = (f"{API_BASE}/api/telemetry/range/033114869"
                    f"?startDate={requests.utils.quote(start_date_iso)}"
                    f"&endDate={requests.utils.quote(end_date_iso)}")
        
        response = requests.get(range_url, timeout=10)
        if response.status_code == 200:
            telemetry_data = response.json()
            print(f"   OK: Person entity returned {len(telemetry_data)} records")
        else:
            print(f"   ERROR: Person entity error: {response.status_code}")
    except Exception as e:
        print(f"   EXCEPTION: {e}")
    
    print("\n" + "="*70)

if __name__ == "__main__":
    test_yacht_telemetry()
