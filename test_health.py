#!/usr/bin/env python3
import time
import urllib.request
import json

print("Waiting 30 seconds for Azure deployment to complete...")
time.sleep(30)

print("Testing /health/db endpoint...")
try:
    response = urllib.request.urlopen(
        'https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net/health/db',
        timeout=15
    )
    data = json.loads(response.read().decode('utf-8'))
    print(f"Status Code: {response.status}")
    print("Response:")
    print(json.dumps(data, indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    try:
        error_data = json.loads(e.read().decode('utf-8'))
        print("Error Response:")
        print(json.dumps(error_data, indent=2))
    except:
        print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {type(e).__name__}: {str(e)}")
