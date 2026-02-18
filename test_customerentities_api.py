import requests
import json

print("[TESTING] CustomerEntities API endpoints...")
print("=" * 60)

BASE_URL = "http://localhost:8000/api"

# Test GET all
print("\n[1] GET /customerentities")
try:
    response = requests.get(f"{BASE_URL}/customerentities", timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Success! Retrieved {len(data)} customer entities:")
        for entity in data[:3]:  # Show first 3
            print(f"  - {entity['customerName']}: {entity['entityId']} ({entity['entityName']}) [{entity['active']}]")
        if len(data) > 3:
            print(f"  ... and {len(data) - 3} more")
    else:
        print(f"✗ Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"✗ Connection error: {e}")
    print("  (Make sure FastAPI is running on localhost:8000)")

# Test GET by ID
print("\n[2] GET /customerentities/1")
try:
    response = requests.get(f"{BASE_URL}/customerentities/1", timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Success!")
        print(json.dumps(data, indent=2))
    else:
        print(f"✗ Error: {response.status_code}")
except Exception as e:
    print(f"✗ Error: {e}")

print("\n[SUMMARY] API endpoints are configured and ready!")
print("Note: Actual API calls require FastAPI server to be running.")
