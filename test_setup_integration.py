"""
Quick Test - Verify setup_management integration
"""
import sys
import traceback

print("=" * 60)
print("Testing setup_management integration...")
print("=" * 60)

try:
    print("\n[1/4] Testing FastAPI import...")
    from fastapi import FastAPI
    print("✓ FastAPI imported successfully")
    
    print("\n[2/4] Testing setup_management import...")
    from setup_management import router as setup_router
    print("✓ setup_management imported successfully")
    print(f"   Router has {len(setup_router.routes)} routes")
    
    print("\n[3/4] Checking router endpoints...")
    for route in setup_router.routes:
        print(f"   - {route.methods} {route.path}")
    
    print("\n[4/4] Testing main.py integration...")
    from main import app
    
    # Count all routes including the new setup routes
    total_routes = len([r for r in app.routes if hasattr(r, 'path')])
    setup_routes = len([r for r in app.routes if hasattr(r, 'path') and '/api/setup' in r.path])
    
    print(f"✓ main.py loaded successfully")
    print(f"   Total routes: {total_routes}")
    print(f"   Setup management routes: {setup_routes}")
    
    print("\n" + "=" * 60)
    if setup_routes > 0:
        print("✓ INTEGRATION SUCCESSFUL - Setup management endpoints are available")
    else:
        print("⚠ WARNING - Setup endpoints may not be registered")
        print("\n  Endpoint paths should include:")
        print("  - GET /api/setup/export/{provider_name}")
        print("  - POST /api/setup/sync/{device_id}/{provider_name}")
        print("  - GET /api/setup/export/{entity_id}")
    print("=" * 60)
    
except Exception as e:
    print(f"\n✗ ERROR: {e}")
    print("\nTraceback:")
    traceback.print_exc()
    sys.exit(1)
