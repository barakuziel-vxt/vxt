# Geofence System - Data Flow Architecture

## How Existing Analyzers Work vs Geofence Analyzer

### Existing Analyzers (Attribute-Based)

**Example: `dbo.AnalyzeScore` (TSQL) and `detect_anomaly` (Python)**

```
┌─────────────────────────────────┐
│ Event (e.g., NEWSAggregateMedium)│
│ - eventId: 5                     │
│ - minCumulatedScore: 5           │
│ - maxCumulatedScore: 6           │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ EventAttribute mapping          │
│ - eventId: 5 → entityTypeAttributeId: 1 (AvgHR)
│ - eventId: 5 → entityTypeAttributeId: 2 (Systolic)
│ - eventId: 5 → entityTypeAttributeId: 3 (BodyTemp)
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ EntityTypeAttributeScore        │
│ - entityTypeAttributeId: 1      │
│ - minValue: 60, maxValue: 100   │
│ - Score: 5                      │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ EntityTelemetry (input data)    │
│ - entityTypeAttributeId: 1      │
│ - numericValue: 95              │
│ - entityTelemetryId: 1001       │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ Analyzer returns DETAILS:        │
│ [                               │
│   {                             │
│     entityTypeAttributeId: 1    │ ← FROM EVENT ATTRIBUTE MAPPING
│     entityTelemetryId: 1001     │ ← FROM ENTITY TELEMETRY RECORD
│     scoreContribution: 5        │ ← FROM ENTITY SCORE
│     withinRange: 'Y' or 'N'     │ ← COMPARE VALUE TO MIN/MAX
│   },                            │
│   ... more attributes ...       │
│ ]                               │
└─────────────────────────────────┘
```

**Key Points:**
- ✓ Has `entityTypeAttributeId` (comes from EventAttribute mapping)
- ✓ Has `entityTelemetryId` (specific telemetry record that was evaluated)
- ✓ Has `scoreContribution` (from EntityTypeAttributeScore table)
- ✗ Does NOT have position data (latitude/longitude)
- Compares: `numericValue BETWEEN minValue AND maxValue`

---

### Geofence Analyzer (Geometry-Based with Position Attribute Tracking)

**Example: `analyze_geofence_event` (Python)**

```
┌─────────────────────────────────┐
│ Event (e.g., GEOFENCE_CRITICAL) │
│ - eventId: 42                   │
│ - minCumulatedScore: 3          │
│ - maxCumulatedScore: 999        │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ EventAttribute mapping          │
│ - eventId: 42 → entityTypeAttributeId: 5 (Latitude)
│ - eventId: 42 → entityTypeAttributeId: 6 (Longitude)
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ CustomerGeofenceCriteria        │
│ - customerId: 1                 │
│ - entityTypeAttributeId: 5      │ ← Links to position attribute
│ - geofenceName: "Harbor Zone"   │
│ - coordinates: JSON Polygon     │
│ - geoType: "Polygon"            │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ EntityTelemetry (position data) │
│ Position Record #1001           │
│ - entityTelemetryId: 1001       │ ← SHARED BY TEL LAT & LON
│   CONTAINS latitude:            │
│   - entityTypeAttributeId: 5    │
│   - attributeCode: "latitude"   │
│   - numericValue: 40.745        │
│                                 │
│   AND longitude:                │
│   - entityTypeAttributeId: 6    │
│   - attributeCode: "longitude"  │
│   - numericValue: -73.985       │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│ Analyzer returns DETAILS:        │
│ [                               │
│   {                             │
│     entityTypeAttributeId: null │ ← Geometry test, not single attribute
│     entityTelemetryId: 1001     │ ← Shared position record ID
│     scoreContribution: 1        │ ← 1 POINT PER BREACHED GEOFENCE
│     withinRange: 'Y'            │ ← POINT-IN-POLYGON RESULT
│   },                            │
│   {                             │
│     entityTypeAttributeId: null │ ← Geometry test, not single attribute
│     entityTelemetryId: 1001     │ ← SAME POSITION RECORD ID
│     scoreContribution: 1        │ ← 1 POINT PER BREACHED GEOFENCE
│     withinRange: 'Y'            │ ← POINT-IN-POLYGON RESULT
│   },                            │
│   ... one per breached geofence │
│ ]                               │
└─────────────────────────────────┘
```

**Key Points:**
- ✓ Has `entityTypeAttributeId` (populated from CustomerGeofenceCriteria - e.g., latitude/longitude attribute ID)
- ✓ Has `entityTelemetryId` (POPULATED - from position record, shared by lat+lon)
- ✓ Has `scoreContribution` (1 per geofence breach)
- ✓ Has position data extracted from latitude/longitude attributes from same record
- ✓ Creates 1 detail per geofence breach (position record used for all calculations)
- Compares: `point_in_polygon(lat, lon, polygon_coords)` using CustomerGeofenceCriteria coordinates

---

## Data Structure Comparison

### Analyzer Returns Dict Structure

Both attribute-based and geofence analyzers return **IDENTICAL** structure to the worker, with geofence now populating position attributes:

```python
# Example: Entity at position (40.745, -73.985) inside 2 geofences
# Geofence 1: linked to entityTypeAttributeId 5 (latitude), position record #1001
# Geofence 2: linked to entityTypeAttributeId 6 (longitude), position record #1001
# Returns 2 detail entries (1 per geofence, each linked to its attribute)

return {
    'status': 'success',
    'cumulative_score': 2,          # 2 = inside 2 geofences
    'probability': 0.5,             # Confidence level (0.0-1.0)
    'details': [                    # Array of detail entries
        {
            'entityTypeAttributeId': 5,         # Linked to latitude attribute from CustomerGeofenceCriteria
            'entityTelemetryId': 1001,          # Position record (contains both lat and lon)
            'scoreContribution': 1,             # Points per geofence
            'withinRange': 'Y'                  # 'Y'=inside, 'N'=outside
        },
        {
            'entityTypeAttributeId': 6,         # Linked to longitude attribute from CustomerGeofenceCriteria
            'entityTelemetryId': 1001,          # SAME position record
            'scoreContribution': 1,
            'withinRange': 'Y'
        }
    ],
    'analysisMetadata': {           # Rich context for logging
        'position': {'lat': 40.745, 'lon': -73.985},
        'customer_id': 1,
        'breached_geofences': 2,
        'analysis_type': 'geofence_containment',
        'analysis_notes': '2 geofence(s) breached',
        'position_telemetry_id': 1001  # Shared by latitude and longitude from same record
    }
}
```

---

## Worker Processing (register_event Method)

The **subscription_analysis_worker** handles both cases **identically**:

```python
# Line 340-357 in subscription_analysis_worker.py
details_insert = """
INSERT INTO dbo.EventLogDetails (
    eventLogId,
    entityTypeAttributeId,
    entityTelemetryId,
    scoreContribution,
    withinRange
)
SELECT 
    ? as eventLogId,
    CAST(JSON_VALUE(value, '$.entityTypeAttributeId') AS INT) AS entityTypeAttributeId,
    TRY_CAST(JSON_VALUE(value, '$.entityTelemetryId') AS BIGINT) AS entityTelemetryId,
    CAST(JSON_VALUE(value, '$.scoreContribution') AS INT) AS scoreContribution,
    CASE WHEN JSON_VALUE(value, '$.withinRange') = 'Y' THEN 'Y' ELSE 'N' END AS withinRange
FROM OPENJSON(?) AS details;
"""
```

**SQL Conversion:**
- `CAST(... AS INT)` → Converts JSON null to SQL NULL, or converts populated values ✓
- `TRY_CAST(... AS BIGINT)` → Safely handles null/invalid values ✓
- `CASE WHEN ... = 'Y'` → Checks for 'Y' string ✓

**Result in EventLogDetails for Attribute-Based Event (NEWS):**
- `entityTypeAttributeId: 1` (populated from Heart Rate attribute)
- `entityTelemetryId: 1001` (populated from specific telemetry record)
- `scoreContribution: 5` ✓
- `withinRange: 'Y'` ✓

**Result in EventLogDetails for Geofence Event:**
- `entityTypeAttributeId: 5` (populated from CustomerGeofenceCriteria mapping - latitude attribute)
- `entityTelemetryId: 1001` (populated from position telemetry record)
- `scoreContribution: 1` ✓
- `withinRange: 'Y'` ✓

✓ **Same table, same SQL → all analyzers populate both fields!**

---

## EventLogDetails Table Supports Both

```sql
CREATE TABLE dbo.EventLogDetails (
    eventLogDetailsId BIGINT PRIMARY KEY IDENTITY(1,1),
    eventLogId BIGINT NOT NULL,
    entityTypeAttributeId INT,         ← Can be NULL (old style) or populated (geofence with SignalK position)
    entityTelemetryId BIGINT,          ← Can be NULL (old style) or populated (geofence with SignalK position)
    scoreContribution INT,             ← Populated for all event types
    withinRange CHAR(1),               ← Populated for all event types
    CONSTRAINT FK_EventLogDetails_EventLog FOREIGN KEY (eventLogId)
        REFERENCES dbo.EventLog(eventLogId)
    -- NO CONSTRAINT on entityTypeAttributeId (allows NULL for backward compatibility, or populated for new events)
    -- NO CONSTRAINT on entityTelemetryId (allows NULL for backward compatibility, or populated for new events)
)
```

**Backward Compatibility:**
- Existing attribute-based events (NEWS, health events): populate both fields
- New geofence events with SignalK position: also populate both fields
- Future aggregated events without position: can leave as NULL
- Table structure remains unchanged; all existing queries continue to work

---

## Complete Flow Example

### Scenario: Entity enters geofence, event should trigger

```
subscription_analysis_worker.py (every 5 minutes):
│
├─ Get active subscription:
│  - customerId: 1
│  - entityId: "234567890" (boat)
│  - eventId: 42 (GEOFENCE_CRITICAL)
│  - minCumulatedScore: 3
│  - maxCumulatedScore: 999
│
├─ Get telemetry from latest position record:
│  Position Record #1001 contains BOTH:
│  - latitude: 40.745 (attributeCode: 'latitude', entityTypeAttributeId: 5)
│  - longitude: -73.985 (attributeCode: 'longitude', entityTypeAttributeId: 6)
│  - SAME entityTelemetryId: 1001 for both
│
├─ Call: analyze_geofence_event(
│     entity_id="234567890",
│     event_id=42,
│     telemetry_data=[
│       {'attributeCode': 'latitude', 'numericValue': 40.745,
│        'entityTypeAttributeId': 5, 'entityTelemetryId': 1001},
│       {'attributeCode': 'longitude', 'numericValue': -73.985,
│        'entityTypeAttributeId': 6, 'entityTelemetryId': 1001}  ← SAME ID!
│     ]
│   )
│
├─ Geofence analyzer returns:
│  {
│    'status': 'success',
│    'cumulative_score': 3,           ← Inside 3 geofences
│    'probability': 0.5,
│    'details': [
│      {'entityTypeAttributeId': None, 'entityTelemetryId': 1001,
│       'scoreContribution': 1, 'withinRange': 'Y'},
│      {'entityTypeAttributeId': None, 'entityTelemetryId': 1001,
│       'scoreContribution': 1, 'withinRange': 'Y'},
│      {'entityTypeAttributeId': None, 'entityTelemetryId': 1001,
│       'scoreContribution': 1, 'withinRange': 'Y'}
│    ]
│  }
│
├─ Check threshold:
│  if 3 >= 3 and 3 <= 999:  ← YES, event detected!
│     call register_event()
│
├─ register_event() INSERT:
│  EventLog:
│    - entityId: "234567890"
│    - eventId: 42
│    - cumulativeScore: 3
│    - probability: 0.5
│    - triggeredAt: 2026-02-23 14:35:00Z
│
└─ EventLogDetails (3 rows):
   ├─ Row 1: entityTypeAttributeId: NULL, entityTelemetryId: 1001, scoreContribution: 1, withinRange: 'Y'
   ├─ Row 2: entityTypeAttributeId: NULL, entityTelemetryId: 1001, scoreContribution: 1, withinRange: 'Y'
   └─ Row 3: entityTypeAttributeId: NULL, entityTelemetryId: 1001, scoreContribution: 1, withinRange: 'Y'
   
   ← One detail row per breached geofence
   ← Fully traceable back to position record (which contains both lat+lon)
   ← Same table structure as attribute-based events (NEWS analyzer)
```

---

## Summary

| Aspect | Attribute-Based (NEWS) | Geofence |
|--------|------------------------|----------|
| **Event** | NEWSAggregateMedium | GEOFENCE_CRITICAL |
| **Criteria Table** | EventAttribute + EntityTypeAttributeScore | CustomerGeofenceCriteria |
| **Input Data** | Numeric values (HR, BP, temp) | Position (lat/lon from SignalK) |
| **Score Type** | Range-based (min/max bounds) | Geometry-based (point-in-polygon) |
| **entityTypeAttributeId** | ✓ Always populated (from EventAttribute) | ✓ Always populated (from CustomerGeofenceCriteria) |
| **entityTelemetryId** | ✓ Always populated (from EntityTelemetry) | ✓ Always populated (from position record) |
| **scoreContribution** | ✓ Variable (from score table) | ✓ 1 per geofence |
| **withinRange** | ✓ 'Y' if in range, 'N' if out | ✓ 'Y' if inside, 'N' if outside |
| **Details per Event** | 1 per attribute tested | 1 per geofence |
| **Worker Change Needed** | NO | NO |
| **Database Change Needed** | NO | NO |

**Conclusion:** The subscription worker is **fully generic** and doesn't need any modifications. Both systems provide complete auditability:
- **Attribute-based (NEWS)**: `entityTypeAttributeId` from EventAttribute mapping, `entityTelemetryId` from specific telemetry record
- **Geofence**: `entityTypeAttributeId` from CustomerGeofenceCriteria mapping (links geofence to position attribute), `entityTelemetryId` from position record
