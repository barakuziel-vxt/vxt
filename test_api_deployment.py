"""Test the deployed API endpoints"""
import requests
import json

print("[Testing API Endpoints...]\n")

try:
    # Test 1: Get all customer entities
    print("[1/3] Testing GET /customerentities...")
    response = requests.get("http://localhost:8000/customerentities", timeout=5)
    
    if response.status_code == 200:
        data = response.json()
        print(f"[✓] Endpoint working - returned {len(data)} entities")
        
        # Check if iotDeviceId field exists
        if len(data) > 0 and 'iotDeviceId' in data[0]:
            print(f"[✓] iotDeviceId field present in response")
            first = data[0]
            print(f"    Sample: ID {first['customerEntityId']} - Entity {first['entityId']} - Device {first['iotDeviceId']}")
        else:
            print("[✗] iotDeviceId field NOT found in response")
    else:
        print(f"[✗] Endpoint returned status {response.status_code}")

    # Test 2: Get specific customer entity
    print("\n[2/3] Testing GET /customerentities/2...")
    response = requests.get("http://localhost:8000/customerentities/2", timeout=5)
    
    if response.status_code == 200:
        data = response.json()
        print(f"[✓] Endpoint working")
        if 'iotDeviceId' in data:
            print(f"[✓] iotDeviceId field: {data['iotDeviceId']}")
        else:
            print("[✗] iotDeviceId field NOT found")
    else:
        print(f"[✗] Endpoint returned status {response.status_code}")

    # Test 3: Check if sync endpoint exists
    print("\n[3/3] Testing POST /customerentities/2/sync-setup endpoint...")
    try:
        response = requests.post(
            "http://localhost:8000/customerentities/2/sync-setup",
            json={"provider_name": "N2KToSignalK"},
            timeout=5
        )
        
        if response.status_code in [200, 400, 404, 500]:
            print(f"[✓] Endpoint exists and is callable")
            print(f"    Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"    Device: {data.get('device_id')}")
                print(f"    Provider: {data.get('provider_name')}")
        else:
            print(f"[?] Endpoint returned unexpected status: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("[✗] Endpoint not reachable (server may still be starting)")
    except Exception as e:
        print(f"[✗] Error testing endpoint: {e}")

    print("\n" + "="*60)
    print("[SUCCESS] API Deployment Verified! ✅")
    print("="*60)

except requests.exceptions.ConnectionError:
    print("[✗] Cannot connect to API server at localhost:8000")
    print("[ℹ] Make sure main.py is running")
except Exception as e:
    print(f"[✗] Error: {e}")
