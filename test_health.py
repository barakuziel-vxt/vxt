#!/usr/bin/env python
import urllib.request
import json
import sys

try:
    url = 'https://vxt-web-app.azurewebsites.net/health/db'
    print(f"Testing: {url}")
    response = urllib.request.urlopen(url, timeout=15)
    data = response.read().decode()
    
    # Try to parse as JSON
    try:
        json_data = json.loads(data)
        print("\nHealth Check Response:")
        print(json.dumps(json_data, indent=2))
        
        # Check for errors
        if 'sa' in str(json_data).lower():
            print("\n⚠️  WARNING: Found 'sa' in response - OLD CODE STILL RUNNING")
            sys.exit(1)
        elif 'unhealthy' in str(json_data).lower():
            print("\n❌ App is unhealthy")
            sys.exit(1)
        else:
            print("\n✅ Looks good!")
            sys.exit(0)
    except:
        print(f"Response: {data[0:1000]}")
        
except Exception as e:
    print(f"❌ Error: {str(e)}")
    sys.exit(1)
