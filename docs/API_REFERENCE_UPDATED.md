"""
✅ SETUP MANAGEMENT API - CORRECTED DESIGN

Status: API UPDATED - No device ID in URL path, generic by provider

═════════════════════════════════════════════════════════════════════════════════
API ENDPOINTS
═════════════════════════════════════════════════════════════════════════════════

Endpoint 1: Export Provider Setup
──────────────────────────────────
GET /api/setup/export/{provider_name}

Parameters:
  provider_name (path): Provider name (e.g., "N2KToSignalK", "Junction")

Response (200):
  {
    "metadata": {
      "provider_id": 1,
      "provider_name": "N2KToSignalK",
      "topic_name": "boat-telemetry",
      "batch_size": 100
    },
    "entity_types": [
      {"id": 1, "code": "BOAT_VESSEL", "name": "Yacht/Vessel"}
    ],
    "attributes": [
      {"id": 10, "code": "ENGINE_RPM", "aggregationType": "latest"}
    ],
    "events": [
      {"id": 95, "protocol_attribute_code": "RPM", "attribute_code": "ENGINE_RPM"}
    ],
    "entities": [
      {"id": 234567890, "entity_type_id": 1, "customer_id": 1}
    ]
  }

Example Requests:
  curl http://localhost:8000/api/setup/export/N2KToSignalK
  curl http://localhost:8000/api/setup/export/Junction


═════════════════════════════════════════════════════════════════════════════════
Endpoint 2: Sync Setup to Device(s) ✨ CORRECTED
──────────────────────────────────────────────────
POST /api/setup/sync/{provider_name}

This endpoint is GENERIC - device IDs are parameters, not part of URL path

Device IDs can be passed FOUR WAYS:

METHOD A: Single device via query parameter
────────────────────────────────────────────
POST /api/setup/sync/N2KToSignalK?device_id=TomerRefael

curl -X POST http://localhost:8000/api/setup/sync/N2KToSignalK?device_id=TomerRefael


METHOD B: Multiple devices via query parameters (repeat device_ids)
────────────────────────────────────────────────────────────────────
POST /api/setup/sync/N2KToSignalK?device_ids=TomerRefael&device_ids=vessel-2&device_ids=vessel-3

curl -X POST "http://localhost:8000/api/setup/sync/N2KToSignalK?device_ids=TomerRefael&device_ids=vessel-2&device_ids=vessel-3"


METHOD C: Multiple devices via JSON body
──────────────────────────────────────────
POST /api/setup/sync/N2KToSignalK
Content-Type: application/json

{
  "device_ids": ["TomerRefael", "vessel-2", "vessel-3"]
}

curl -X POST http://localhost:8000/api/setup/sync/N2KToSignalK \
  -H "Content-Type: application/json" \
  -d '{"device_ids": ["TomerRefael", "vessel-2", "vessel-3"]}'


METHOD D: Single device via JSON body
───────────────────────────────────────
POST /api/setup/sync/N2KToSignalK
Content-Type: application/json

{
  "device_id": "TomerRefael"
}

curl -X POST http://localhost:8000/api/setup/sync/N2KToSignalK \
  -H "Content-Type: application/json" \
  -d '{"device_id": "TomerRefael"}'


Response (200 Success):
  {
    "status": "success",
    "provider_name": "N2KToSignalK",
    "devices_synced": ["TomerRefael", "vessel-2"],
    "setup_exported": true,
    "entities_count": 5,
    "attributes_count": 42,
    "events_count": 15,
    "message": "Setup sync queued for 2 device(s)"
  }

Response (400 Bad Request):
  {
    "detail": "No device IDs provided. Use ?device_id=X or ?device_ids=X&device_ids=Y or JSON body"
  }

Response (404 Not Found):
  {
    "detail": "Provider 'InvalidProvider' not found"
  }


═════════════════════════════════════════════════════════════════════════════════
Endpoint 3: Export Entity-Specific Setup
─────────────────────────────────────────
GET /api/setup/export/{entity_id}

Parameters:
  entity_id (path): Entity ID (e.g., 234567890)

Response (200):
  Same structure as Endpoint 1, but filtered to only include this entity

Example:
  curl http://localhost:8000/api/setup/export/234567890


═════════════════════════════════════════════════════════════════════════════════
BENEFITS OF THIS DESIGN
═════════════════════════════════════════════════════════════════════════════════

✓ Generic Provider Endpoint
  - /api/setup/sync/{provider_name} is not device-specific
  - Can sync to 1 or N devices with same endpoint
  - No need for separate URLs per device

✓ Flexible Device Parameter Passing
  - Query params: Ideal for simple requests, shareable URLs
  - JSON body: Ideal for complex requests, multiple devices
  - Both supported: Client can choose what works best

✓ Scalable
  - Dashboard can update single device: ?device_id=X
  - Or update fleet: ?device_ids=X&device_ids=Y&device_ids=Z
  - Or mass sync: {"device_ids": [large array]}

✓ RESTful Design
  - Resource is the provider setup, not the device
  - POST to export and sync to one or more devices
  - Device IDs are parameters, not resource identifiers


═════════════════════════════════════════════════════════════════════════════════
USAGE EXAMPLES
═════════════════════════════════════════════════════════════════════════════════

PowerShell Examples:
─────────────────────

# Single device
$url = "http://localhost:8000/api/setup/sync/N2KToSignalK?device_id=TomerRefael"
Invoke-WebRequest -Uri $url -Method POST | ConvertFrom-Json

# Multiple devices via query
$url = "http://localhost:8000/api/setup/sync/N2KToSignalK?device_ids=TomerRefael&device_ids=vessel-2"
Invoke-WebRequest -Uri $url -Method POST | ConvertFrom-Json

# Multiple devices via body
$body = @{"device_ids" = @("TomerRefael", "vessel-2", "vessel-3")} | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:8000/api/setup/sync/N2KToSignalK" `
  -Method POST -Body $body -ContentType "application/json" | ConvertFrom-Json


JavaScript/Fetch Examples:
──────────────────────────

// Single device
fetch('/api/setup/sync/N2KToSignalK?device_id=TomerRefael', {
  method: 'POST'
})
.then(r => r.json())
.then(data => console.log(data))

// Multiple devices
fetch('/api/setup/sync/N2KToSignalK', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    device_ids: ['TomerRefael', 'vessel-2', 'vessel-3']
  })
})
.then(r => r.json())
.then(data => console.log(data))


React Component Example:
───────────────────────

function SyncSetupButton({ devices, provider }) {
  const handleSync = async () => {
    // Build URL with device IDs
    const deviceParams = devices
      .map(d => `device_ids=${encodeURIComponent(d)}`)
      .join('&');
    
    const response = await fetch(
      `/api/setup/sync/${provider}?${deviceParams}`,
      { method: 'POST' }
    );
    
    const data = await response.json();
    console.log(`Synced to ${data.devices_synced.length} device(s)`);
  };
  
  return <button onClick={handleSync}>Update Setup</button>;
}


═════════════════════════════════════════════════════════════════════════════════
API DECISION RATIONALE
═════════════════════════════════════════════════════════════════════════════════

Why NOT /api/setup/sync/{device_id}/{provider}?

Problem with path-based devices:
  ✗ One endpoint per device (fragmented API)
  ✗ Difficult to sync multiple devices at once
  ✗ Would need separate call per device
  ✗ Dashboard would make N requests instead of 1
  ✗ Doesn't scale for fleet management

Solution: Generic endpoint with parameter-based devices

Benefits:
  ✓ Single endpoint for all devices
  ✓ Batch sync to multiple devices in one request
  ✓ Cleaner API surface
  ✓ Future-proof for fleet management
  ✓ Follows REST best practices (resources vs. parameters)


═════════════════════════════════════════════════════════════════════════════════
"""
