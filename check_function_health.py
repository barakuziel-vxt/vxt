#!/usr/bin/env python3
import urllib.request
import json
import sys

# Test function health endpoint
try:
    url = "https://vxt-function.azurewebsites.net/api/health"
    print(f"[*] Testing function health endpoint: {url}\n")
    
    req = urllib.request.Request(url)
    response = urllib.request.urlopen(req, timeout=10)
    data = json.loads(response.read().decode())
    
    print("[✓] Function is responding!\n")
    print(json.dumps(data, indent=2))
    
except Exception as e:
    print(f"[!] Cannot reach health endpoint: {str(e)}")
    print("\n[*] Trying alternative endpoint...")
    
    try:
        # Try status endpoint from Azure
        url2 = "https://vxt-function.azurewebsites.net/admin/host/status"
        req2 = urllib.request.Request(url2)
        response2 = urllib.request.urlopen(req2, timeout=10)
        print(f"[✓] Got response from {url2}")
        print(response2.read().decode())
    except:
        print("[!] Function app may not be running or has errors")
