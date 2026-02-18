#!/usr/bin/env python3
import requests
import json

API_BASE = "http://localhost:8000"

print("Testing API Endpoints...\n")

# Test customers endpoint
try:
    resp = requests.get(f"{API_BASE}/customers", timeout=5)
    print(f"✓ GET /customers: {resp.status_code}")
    if resp.status_code == 200:
        customers = resp.json()
        print(f"  Found {len(customers)} customers")
        for c in customers[:3]:
            print(f"    - {c.get('customerName')} (ID: {c.get('customerId')})")
except Exception as e:
    print(f"✗ GET /customers: {str(e)}")

# Test entities endpoint
try:
    resp = requests.get(f"{API_BASE}/entities", timeout=5)
    print(f"\n✓ GET /entities: {resp.status_code}")
    if resp.status_code == 200:
        entities = resp.json()
        print(f"  Found {len(entities)} entities")
        for e in entities[:3]:
            print(f"    - {e.get('entityFirstName')} (ID: {e.get('entityId')})")
except Exception as e:
    print(f"\n✗ GET /entities: {str(e)}")

# Test events endpoint
try:
    resp = requests.get(f"{API_BASE}/events", timeout=5)
    print(f"\n✓ GET /events: {resp.status_code}")
    if resp.status_code == 200:
        events = resp.json()
        print(f"  Found {len(events)} events")
        for ev in events[:3]:
            print(f"    - {ev.get('eventCode')}")
except Exception as e:
    print(f"\n✗ GET /events: {str(e)}")

# Test customersubscriptions endpoint
try:
    resp = requests.get(f"{API_BASE}/customersubscriptions", timeout=5)
    print(f"\n✓ GET /customersubscriptions: {resp.status_code}")
    if resp.status_code == 200:
        subs = resp.json()
        print(f"  Found {len(subs)} subscriptions")
        for s in subs[:3]:
            print(f"    - {s.get('customerName')} -> {s.get('entityId')} ({s.get('eventCode')})")
except Exception as e:
    print(f"\n✗ GET /customersubscriptions: {str(e)}")

print("\n✓ API endpoint tests complete")
