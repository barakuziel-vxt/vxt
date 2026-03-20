# Geofence Analysis System - Implementation Guide

## Architecture Overview

The geofence system allows customers to define restricted geographic areas (polygons/circles) and receive alerts when entities (boats/people) enter those zones.

### System Components

```
┌─────────────────────────────────────────────────────┐
│  CustomerGeofenceCriteria Table (SQL)               │
│  - Store customer-specific geofence definitions     │
│  - Supports Polygon, Circle types                   │
│  - Coordinates stored as JSON                       │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  GeofenceAnalyzer Module (Python)                   │
│  - Shapely-based geometry library                   │
│  - Point-in-polygon & circle distance calculation   │
│  - Returns score: 0 = no breach, 1+ = inside       │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  GeofenceEventAnalyzer (Python)                     │
│  - Subscription worker integration point            │
│  - Extracts position from SignalK telemetry         │
│  - Returns score + analysisMetadata                 │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  subscription_analysis_worker (Python)              │
│  - Runs every 5 minutes                             │
│  - Executes analyze_geofence_event function         │
│  - Registers events (EventLog/EventLogDetails)      │
│  - Logs analysis lifecycle                          │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  Event Types (SQL)                                  │
│  - GEOFENCE_WARN (score 1+)                         │
│  - GEOFENCE_ALERT (score 2+)                        │
│  - GEOFENCE_CRITICAL (score 3+)                     │
└─────────────────────────────────────────────────────┘
```

## Deployment Steps

### Step 1: Run SQL Migrations

Execute these migrations in order:

```sql
-- 0076_Create_CustomerGeofenceCriteria.sql
-- Creates the table and sample data
EXEC sp_executesql N'...'

-- 0077_Create_Geofence_Events.sql
-- Creates event types and analyzer function registration
EXEC sp_executesql N'...'
```

**What gets created:**
- `CustomerGeofenceCriteria` table with indexes
- `GEOFENCE_WARN`, `GEOFENCE_ALERT`, `GEOFENCE_CRITICAL` events
- Entry in `AnalyzeFunction` table: `analyze_geofence_event`

### Step 2: Verify Python Dependencies

```powershell
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install shapely if not already present
pip install shapely

# Verify installation
python -c "import shapely; print(f'Shapely {shapely.__version__} installed')"
```

### Step 3: Validate System Implementation

```powershell
# Run test suite
.\.venv\Scripts\python.exe test_geofence_system.py
```

**Expected output:**
```
✓ PASS: Database Schema
✓ PASS: Geofence Events
✓ PASS: Analyzer Function Registered
✓ PASS: Point-in-Polygon Logic
✓ PASS: Analyzer Function Signature

Total: 5/5 tests passed
✓ ALL TESTS PASSED - Geofence system is ready!
```

### Step 4: Start Services

```powershell
# Start API server
.\.venv\Scripts\python.exe main.py

# In another terminal, start subscription worker
.\.venv\Scripts\python.exe subscription_analysis_worker.py
```

## How It Works

### 1. Create Geofence

**POST** `/customergeofencecriteria`
```json
{
  "customerId": 1,
  "geofenceName": "Harbor Restricted Zone",
  "geoType": "Polygon",
  "coordinates": "{\"type\":\"Polygon\",\"coordinates\":[[[-73.9857,40.7484],[-73.9847,40.7484],[-73.9847,40.7474],[-73.9857,40.7474],[-73.9857,40.7484]]]}",
  "description": "No vessels allowed in harbor area",
  "active": "Y"
}
```

### 2. Create Subscription

Customer subscribes to a geofence event (e.g., `GEOFENCE_CRITICAL`):

**POST** `/customersubscriptions`
```json
{
  "customerId": 1,
  "entityId": "234567890",
  "eventId": <geofence_critical_event_id>,
  "subscriptionStartDate": "2026-02-23",
  "active": "Y"
}
```

### 3. Worker Processes Position Data

Every 5 minutes, `subscription_analysis_worker`:

1. **Loads** active subscriptions with geofence events
2. **Retrieves** latest position from EntityTelemetry (SignalK)
3. **Calls** `analyze_geofence_event()` with:
   - entity_id: "234567890"
   - event_id: <geofence_critical_eventId>
   - telemetry_data: [{attributeCode: "latitude", numericValue: 40.745}, {attributeCode: "longitude", numericValue: -73.985}]
4. **Receives** result:
   ```json
   {
     "status": "success",
     "cumulative_score": 1,
     "probability": 0.5,
     "details": [{...}],
     "analysisMetadata": {
       "position": {"lat": 40.745, "lon": -73.985},
       "customer_id": 1,
       "breached_geofences": 1
     }
   }
   ```
5. **Checks** threshold: score 1 >= minCumulatedScore (1) for GEOFENCE_WARN
6. **Registers** event → inserts EventLog + EventLogDetails rows
7. **Logs** analysis completion

### 4. Event Triggered

If entity position is inside one or more geofences:
- **GEOFENCE_WARN**: 1+ geofences breached
- **GEOFENCE_ALERT**: 2+ geofences breached  
- **GEOFENCE_CRITICAL**: 3+ geofences breached

## API Endpoints

### List Geofences
- **GET** `/customergeofencecriteria?customer_id=1&status=Y`
  - Returns all active geofences for customer 1

### Get Specific Geofence
- **GET** `/customergeofencecriteria/{id}`
  - Returns single geofence with full details

### Create Geofence
- **POST** `/customergeofencecriteria`
  - Body: {customerId, geofenceName, geoType, coordinates, description, active}
  - Returns: {"message": "Geofence criteria created successfully"}

### Update Geofence
- **PUT** `/customergeofencecriteria/{id}`
  - Body: partial update (any fields)
  - Returns: {"message": "Geofence criteria updated successfully"}

### Delete Geofence
- **DELETE** `/customergeofencecriteria/{id}`
  - Hard delete (permanent removal)
  - Returns: {"message": "Geofence criteria deleted successfully"}

## Coordinate Formats

### Polygon
```json
{
  "type": "Polygon",
  "coordinates": [[[lon, lat], [lon, lat], [lon, lat], [lon, lat]]]
}
```
Example (NYC Harbor Square):
```json
{
  "type": "Polygon",
  "coordinates": [[[-73.9857, 40.7484], [-73.9847, 40.7484], [-73.9847, 40.7474], [-73.9857, 40.7474], [-73.9857, 40.7484]]]
}
```

### Circle (not yet UI support)
```json
{
  "type": "Point",
  "coordinates": [lon, lat],
  "radius": 5000
}
```
Example (5km radius around position):
```json
{
  "type": "Point",
  "coordinates": [-73.85, 40.75],
  "radius": 5000
}
```

## Troubleshooting

### "No position data available for entity"
**Cause**: EntityTelemetry table has no records with latitude/longitude for this entity

**Solution**:
1. Check that consumer (SignalK or Junction) is running
2. Check EntityTelemetry table has recent records
3. Verify attributeCode values match (should be 'latitude', 'longitude)

### "Event threshold not met"
**Cause**: Cumulative score doesn't match event's minCumulatedScore/maxCumulatedScore

**Solution**:
1. Check Event table minCumulatedScore for the event
2. Verify entity was actually inside geofence
3. Check worker logs: `worker_analysis.log`

### "ShapelyError: ..."
**Cause**: Invalid JSON in coordinates field

**Solution**:
1. Validate JSON using online JSON validator
2. Ensure coordinates are [lon, lat] not [lat, lon]
3. Close polygon rings: last point should equal first point

### Worker not processing geofence events
**Cause**: AnalyzeFunction entry missing or incorrect path

**Solution**:
```sql
-- Verify function is registered
SELECT * FROM AnalyzeFunction WHERE FunctionName = 'analyze_geofence_event'

-- Check Event table links to function
SELECT eventCode, AnalyzeFunctionId FROM Event WHERE eventCode LIKE 'GEOFENCE_%'
```

## Files Created/Modified

**New Files:**
- `geofence_analyzer.py` - Core geometry logic
- `geofence_event_analyzer.py` - Worker integration
- `db/sql/0076_Create_CustomerGeofenceCriteria.sql` - Database table
- `db/sql/0077_Create_Geofence_Events.sql` - Events & function registration
- `test_geofence_system.py` - Integration test suite

**Modified Files:**
- `main.py` - Added 5 REST endpoints for geofence CRUD
- `subscription_analysis_worker.py` - Already supports dynamic function execution (no changes needed)

## Next Steps

### Phase 2: Admin UI
Create a React page (`CustomerGeofencePage.jsx`) with:
- List/search geofences by customer
- Map interface for drawing polygons (using Leaflet or Mapbox)
- Circle radius selector
- Test geofence by simulating position data
- View event logs triggered by geofence breaches

### Phase 3: Geofence History
Add optional table to track:
- When entity entered geofence
- Time inside geofence
- Exit time
- Can generate "geofence dwell reports"

### Phase 4: Advanced Types
Support additional geofence types:
- Corridor (linear buffer around route)
- Polygon with holes (exclude inner areas)
- Time-based (different zones per time of day)
