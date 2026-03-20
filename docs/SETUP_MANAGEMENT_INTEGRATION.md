"""
INTEGRATION EXAMPLE - Adding Setup Management to main.py

This file shows how to integrate the setup_management.py router into your FastAPI application.
"""

# ============================================================================
# INTEGRATION STEPS
# ============================================================================

# STEP 1: Add import at top of main.py
# ============================================================================

'''
Add this line after other imports in main.py:

from setup_management import router as setup_router
'''

# STEP 2: Include router in FastAPI app
# ============================================================================

'''
Add this after your existing middleware configuration in main.py:

# Include setup management endpoints
# These provide setup export and Device Twin synchronization
app.include_router(setup_router)
'''

# STEP 3: Verify environment variables
# ============================================================================

'''
Make sure these environment variables are set:

For FastAPI (optional but recommended):
  DB_SERVER=vxtdb.database.windows.net
  DB_NAME=free-sql-db-5949639
  DB_USER=vxt
  DB_PASSWORD=<from Key Vault>
  IOT_HUB_CONNECTION_STRING=<optional, for Device Twin sync>

For local development:
  DB_SERVER=127.0.0.1
  DB_NAME=BoatTelemetryDB
  DB_USER=sa
  DB_PASSWORD=YourStrongPassword123!
  IOT_HUB_CONNECTION_STRING=<leave unset for local testing>
'''

# ============================================================================
# FULL INTEGRATION EXAMPLE
# ============================================================================

# This is what part of main.py should look like after integration:

'''
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import pyodbc

# ✅ NEW: Import setup management router
from setup_management import router as setup_router

app = FastAPI(title="VXT API")

# Enable CORS...
app.add_middleware(
    CORSMiddleware,
    allow_origins=[...],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ NEW: Include setup management endpoints
app.include_router(setup_router)

# Your existing endpoints...
@app.get("/")
def read_root():
    return {"message": "VXT Telemetry API"}

# ...rest of your API...
'''

# ============================================================================
# AVAILABLE ENDPOINTS AFTER INTEGRATION
# ============================================================================

'''
GET /api/setup/export/{provider_name}
├─ Purpose: Export provider setup from MSSQL as JSON
├─ Used by: Dashboard, API clients, Device Twin updates
├─ Example: GET /api/setup/export/N2KToSignalK
└─ Response: JSON with provider metadata, entity types, attributes, events, entities

POST /api/setup/sync/{device_id}/{provider_name}
├─ Purpose: Export setup and sync to Device Twin
├─ Trigger: "Update Setup" button in dashboard
├─ Example: POST /api/setup/sync/TomerRefael/N2KToSignalK
├─ Response: {status: "queued", entities_count: 5, ...}
└─ Action: Async updates Device Twin, device receives notification

GET /api/setup/export/{entity_id}
├─ Purpose: Export setup filtered to specific entity
├─ Used by: Entity-specific dashboard views
├─ Example: GET /api/setup/export/234567890
└─ Response: JSON setup for only that entity
'''

# ============================================================================
# TESTING THE INTEGRATION
# ============================================================================

'''
1. Start FastAPI locally:
   $ python main.py
   
   Expected output:
   INFO:     Server running at http://127.0.0.1:8000
   INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)

2. Test export endpoint:
   $ curl http://localhost:8000/api/setup/export/N2KToSignalK | jq .
   
   Expected: JSON setup with metadata, entities, attributes, events

3. Test sync endpoint (requires IOT_HUB_CONNECTION_STRING):
   $ curl -X POST http://localhost:8000/api/setup/sync/TestDevice/N2KToSignalK | jq .
   
   Expected: {status: "queued", ...} (if IOT_HUB_CONNECTION_STRING set)
   Or: {status: "warning", message: "Device Twin sync disabled..."} (if not set)

4. Test entity-specific export:
   $ curl http://localhost:8000/api/setup/export/234567890 | jq .
   
   Expected: JSON setup for that entity only
'''

# ============================================================================
# DASHBOARD INTEGRATION (React)
# ============================================================================

'''
Example: "Update Setup" button in admin dashboard

import axios from 'axios';

export function UpdateSetupButton({ deviceId, provider }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpdateSetup = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `/api/setup/sync/${deviceId}/${provider}`
      );
      
      if (response.data.status === 'queued') {
        setMessage(
          `✓ Setup update queued for ${deviceId}. ` +
          `Synced ${response.data.entities_count} entities`
        );
      } else if (response.data.status === 'warning') {
        setMessage(
          '⚠ Device Twin sync disabled (contact admin)'
        );
      }
    } catch (error) {
      setMessage(`✗ Failed to update setup: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleUpdateSetup} disabled={loading}>
        {loading ? 'Updating...' : 'Update Setup'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
'''

# ============================================================================
# TROUBLESHOOTING
# ============================================================================

'''
Problem: Connection timeout when calling /api/setup/export
Solution:
  - Check DB_SERVER and DB_NAME are correct
  - Verify database credentials (DB_USER, DB_PASSWORD)
  - Check network connectivity to Azure SQL
  - Review setup_management.py logs

Problem: Device Twin sync returns warning
Solution:
  - Set IOT_HUB_CONNECTION_STRING environment variable
  - Verify connection string is valid (from Azure Portal)
  - Check service principal has Azure IoT Hub Registry access
  - Review application logs for [Twin] messages

Problem: Device doesn't receive setup update
Solution:
  - Verify device is connected to IoT Hub (check Connection state)
  - Review device logs for MQTT twin/delta subscription
  - Check Device Twin has been updated (view in Portal)
  - Verify device subscribes to $iothub/twin/PATCH/properties/desired/#
'''

# ============================================================================
# MONITORING & LOGGING
# ============================================================================

'''
Key logs to monitor:

[OK] Exported setup for provider: N2KToSignalK
  → Setup successfully exported from MSSQL
  
[Twin] Updated device twin for TomerRefael
  → Device Twin successfully updated
  
[Twin] ✓ Found setup config in device twin for TomerRefael
  → Device Twin mode activated in Azure Function
  
IOT_HUB_CONNECTION_STRING not configured
  → Warning: Device Twin sync disabled, using database mode
'''
