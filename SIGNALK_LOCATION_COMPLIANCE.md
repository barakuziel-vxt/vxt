# SignalK Location Protocol Compliance Implementation

## Overview

The system now properly implements **location as contextual metadata** for SignalK marine telemetry, ensuring protocol compliance without creating NULL constraint violations in the database.

## Implementation Details

### 1. Protocol-Compliant Message Structure

SignalK sends location as an **independent object** in the same update batch:

```json
{
  "context": "vessels.urn:mrn:imo:mmsi:234567890",
  "updates": [{
    "source": "gps1",
    "timestamp": "2026-02-18T10:30:00Z",
    "values": [
      {
        "path": "navigation.position",
        "value": {
          "latitude": 60.123456,
          "longitude": 25.654321
        }
      },
      {
        "path": "navigation.speedOverGround",
        "value": 12.5
      },
      {
        "path": "navigation.courseOverGround",
        "value": 3.14159
      }
    ]
  }]
}
```

### 2. Location Extraction (provider_adapters.py → N2KToSignalKAdapter)

The adapter processes each SignalK update in **two passes**:

#### First Pass: Extract Location Data
```python
# Extract latitude/longitude from navigation.position object (if present)
location_data = {'latitude': None, 'longitude': None}

for value_entry in update.get('values', []):
    signal_path = value_entry.get('path')
    signal_value = value_entry.get('value')
    
    if signal_path == 'navigation.position' and isinstance(signal_value, dict):
        location_data['latitude'] = signal_value.get('latitude')
        location_data['longitude'] = signal_value.get('longitude')
```

#### Second Pass: Process Measurements and Attach Location Context
```python
# Process each path, attaching location context to all measurements
for value_entry in update.get('values', []):
    signal_path = value_entry.get('path')
    signal_value = value_entry.get('value')
    
    # Skip standalone position object (we already extracted lat/lon)
    if signal_path == 'navigation.position':
        continue
    
    # Process this measurement with location context attached
    if signal_path in self.event_rules:
        rule = self.event_rules[signal_path]
        events.append({
            'entity_id': mmsi,
            'protocol_attribute_code': rule['protocol_attribute_code'],
            'entity_type_attribute_id': rule.get('entity_type_attribute_id'),
            'timestamp': timestamp,
            'numeric_value': float(signal_value) if isinstance(signal_value, (int, float)) else None,
            'latitude': location_data['latitude'],      # ← Location context
            'longitude': location_data['longitude'],    # ← Location context
            # ... other fields
        })
```

### 3. Consumer Integration (generic_telemetry_consumer.py)

The consumer filtering ensures **only valid records are inserted**:

```python
# Load adapter dynamically based on provider name
adapter = self._load_adapter()  # Returns N2KToSignalKAdapter for N2KToSignalK

# Set extraction rules from database
self.event_mappings = self._load_event_mappings()
adapter.set_extraction_rules(self.event_mappings)

# For each parsed event, apply filters before insertion
for evt in normalized_events:
    entity_id = evt['entity_id']
    protocol_attr_code = evt['protocol_attribute_code']
    
    # Check: Entity exists + EntityTypeAttribute configured for this provider
    should_insert, reason = self._should_insert(entity_id, protocol_attr_code)
    
    if not should_insert:
        self.total_skipped += 1
        continue
    
    # Insert (latitude/longitude will be NULL if not extracted)
    record = (
        entity_id,
        entity_type_attribute_id,  # ← Never NULL due to _should_insert check
        evt['timestamp'],
        evt['timestamp'],
        None,
        evt.get('provider_device'),
        evt.get('numeric_value'),
        evt.get('latitude'),         # ← Location context (may be NULL if position not in update)
        evt.get('longitude'),        # ← Location context (may be NULL if position not in update)
        evt.get('string_value')
    )
    insert_records.append(record)
```

### 4. Database Schema

The `EntityTelemetry` table has **10 columns**:

```sql
CREATE TABLE EntityTelemetry (
    entityId NVARCHAR(50) NOT NULL,
    entityTypeAttributeId INT NOT NULL,           -- ← Enforced NOT NULL
    startTimestampUTC DATETIME NOT NULL,
    endTimestampUTC DATETIME NOT NULL,
    providerEventInterpretation NVARCHAR(MAX),
    providerDevice NVARCHAR(255),
    numericValue FLOAT,
    latitude FLOAT NULL,                          -- ← Location context
    longitude FLOAT NULL,                         -- ← Location context
    stringValue NVARCHAR(MAX)
)
```

### 5. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Location as **metadata** not standalone entity | SignalK spec sends position as independent object in same update; other providers (Junction, Terra) don't send location at all. Making it metadata keeps design generic. |
| **Skip** navigation.position records | Prevents creating records with NULL entityTypeAttributeId (no mapping needed for position itself) |
| **Attach** location to ALL measurements | Allows queries to correlate any measurement (speed, heading, wind) with vessel location at that instant |
| Consumer **filtering** before insert | The `_should_insert()` check ensures entityTypeAttributeId is never NULL, preventing constraint violations |
| Optional latitude/longitude columns | Some updates may not include position; NULL is acceptable. Measurements remain valid even without location context. |

## Data Flow Example

**Input:** One SignalK update with 3 values (position + 2 measurements)

```
SignalK Message
├─ navigation.position {lat: 60.123, lon: 25.654}
├─ navigation.speedOverGround: 12.5
└─ navigation.courseOverGround: 3.14

     ↓ [Adapter First Pass: Extract Location]
     
Location Context: {latitude: 60.123, longitude: 25.654}

     ↓ [Adapter Second Pass: Process Measurements]
     
Parsed Events (2 records, NOT 3):
├─ speedOverGround: 12.5 (lat: 60.123, lon: 25.654) ✓
├─ courseOverGround: 3.14 (lat: 60.123, lon: 25.654) ✓
└─ position: [SKIPPED - no standalone record]

     ↓ [Consumer Filtering]
     
Both records pass _should_insert() check
(Entity exists, EntityTypeAttribute configured for N2KToSignalK provider)

     ↓ [Database Insert]
     
EntityTelemetry table gains 2 records with location context:
├─ speedOverGround: 12.5, latitude: 60.123, longitude: 25.654
└─ courseOverGround: 3.14, latitude: 60.123, longitude: 25.654
```

## NULL entityTypeAttributeId Prevention

The system prevents NULL constraint violations through **layered filtering**:

1. **Database Level**: EntityTypeAttribute linked to specific entity types + providers
2. **Consumer Cache**: Pre-loads valid attribute codes for the provider
3. **_should_insert() Check**: Verifies both entity and attribute code exist before insert
4. **Adapter Pattern**: Rules only returned for configured attributes

**Result:** Only valid (entity_id, entityTypeAttributeId) pairs reach the database.

## Verification

Run the compliance test:
```powershell
.\.venv\Scripts\python.exe test_signalk_location_compliance.py
```

Expected output:
```
✓ PASS: Location Extraction
✓ PASS: Database Config  
✓ PASS: Consumer Filtering

✓ Location correctly extracted and attached as contextual metadata
✓ No standalone navigation.position record created
```

## API Usage

**Get vessel location history with telemetry:**
```bash
GET /entity-telemetry?entityId=234567890&entityTypeAttributeCode=navigation.speedOverGround&startDate=2026-02-18&endDate=2026-02-19
```

Returns records with `latitude` and `longitude` columns populated from location context.

**Map visualization (admin-dashboard):**
- Automatically fetches EntityTelemetry records for entity
- Filters to records with non-NULL latitude/longitude
- Plots polyline from location history
- Shows speed/heading measurements at each location

## SignalK Specification Compliance

✓ **Message Format**: Accepts standard SignalK delta format  
✓ **Position Object**: Correctly handles navigation.position as object type  
✓ **Shared Timestamp**: All values in update share source and timestamp  
✓ **Flexible Attributes**: Supports any navigation/environment/propulsion path  
✓ **Protocol Agnostic**: Works with any provider via adapter pattern

## Files Involved

| File | Component | Purpose |
|------|-----------|---------|
| `provider_adapters.py` | N2KToSignalKAdapter | Extract location, process measurements, attach context |
| `generic_telemetry_consumer.py` | GenericTelemetryConsumer | Load adapter, filter records, insert with location |
| `simulate_signalk_vessel.py` | SignalKSimulator | Generate test messages with position in events |
| `run_signalk_consumer.py` | Launcher | Start consumer for N2KToSignalK provider |
| `db/sql/0007_*.sql` | Database | ProviderEvent records for SignalK attributes |
| `db/sql/0009_*.sql` | Database | EntityTypeAttribute mappings for boats |

## Future Enhancements

- **Altitude support**: Extract from `navigation.altitude` when available (currently latitude/longitude only)
- **Route geometry**: Store full vessel track for path visualization
- **Multi-source location**: Handle multiple GPS sources (gps1, gps2) with fallback logic
- **Location accuracy**: Track HDOP/PDOP from GNSS receiver quality indicators
