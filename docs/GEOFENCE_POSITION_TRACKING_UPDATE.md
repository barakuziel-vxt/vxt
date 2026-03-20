# Geofence Position Attribute Tracking Update

## Changes Made

### 1. **geofence_event_analyzer.py** - Now Captures Position Attribute IDs

**What Changed:**
- When telemetry data is received, we now capture **entityTypeAttributeId** and **entityTelemetryId** for both latitude and longitude records
- These IDs come directly from the SignalK EntityTelemetry records

**Before:**
```python
for record in telemetry_data:
    attr_code = record.get('attributeCode', '').lower()
    if 'latitude' in attr_code:
        lat = record.get('numericValue')  # Only captured the value
    elif 'longitude' in attr_code:
        lon = record.get('numericValue')  # Only captured the value
```

**After:**
```python
for record in telemetry_data:
    attr_code = record.get('attributeCode', '').lower()
    if 'latitude' in attr_code:
        lat = record.get('numericValue')
        lat_attr_id = record.get('entityTypeAttributeId')        # ✓ Now captured
        lat_telemetry_id = record.get('entityTelemetryId')       # ✓ Now captured
    elif 'longitude' in attr_code:
        lon = record.get('numericValue')
        lon_attr_id = record.get('entityTypeAttributeId')        # ✓ Now captured
        lon_telemetry_id = record.get('entityTelemetryId')       # ✓ Now captured
```

### 2. **Details Array Building** - Two Entries Per Geofence Breach

**Before:**
```python
if is_breached:
    details.append({
        'entityTypeAttributeId': None,      # ✗ No tracking
        'entityTelemetryId': None,          # ✗ No tracking
        'scoreContribution': 1,
        'withinRange': 'Y'
    })
```

**After:**
```python
if is_breached:
    # Latitude attribute detail
    if lat_attr_id is not None and lat_telemetry_id is not None:
        details.append({
            'entityTypeAttributeId': lat_attr_id,       # ✓ From SignalK
            'entityTelemetryId': lat_telemetry_id,      # ✓ From SignalK
            'scoreContribution': 1,
            'withinRange': 'Y'
        })
    # Longitude attribute detail
    if lon_attr_id is not None and lon_telemetry_id is not None:
        details.append({
            'entityTypeAttributeId': lon_attr_id,       # ✓ From SignalK
            'entityTelemetryId': lon_telemetry_id,      # ✓ From SignalK
            'scoreContribution': 1,
            'withinRange': 'Y'
        })
```

### 3. **analysisMetadata** - Position Attribute Tracking

**New Field Added:**
```python
'analysisMetadata': {
    'position': latest_position,
    'customer_id': customer_id,
    'breached_geofences': score,
    'analysis_type': 'geofence_containment',
    'analysis_notes': f'{score} geofence(s) breached, {len(details)} detail entries created (lat+lon per breach)',
    'position_attributes': {                    # ✓ NEW: Full position attribute tracking
        'latitude': {
            'entityTypeAttributeId': lat_attr_id,
            'entityTelemetryId': lat_telemetry_id
        },
        'longitude': {
            'entityTypeAttributeId': lon_attr_id,
            'entityTelemetryId': lon_telemetry_id
        }
    }
}
```

---

## How It Works Now

### Example Flow

1. **SignalK sends position data:**
   ```
   EntityTelemetry Record #1001:
   - attributeCode: "latitude"
   - entityTypeAttributeId: 5 (SignalK latitude attribute)
   - entityTelemetryId: 1001
   - numericValue: 40.745
   
   EntityTelemetry Record #1002:
   - attributeCode: "longitude"
   - entityTypeAttributeId: 6 (SignalK longitude attribute)
   - entityTelemetryId: 1002
   - numericValue: -73.985
   ```

2. **Geofence analyzer receives telemetry:**
   ```python
   telemetry_data = [
       {'attributeCode': 'latitude', 'numericValue': 40.745,
        'entityTypeAttributeId': 5, 'entityTelemetryId': 1001},
       {'attributeCode': 'longitude', 'numericValue': -73.985,
        'entityTypeAttributeId': 6, 'entityTelemetryId': 1002}
   ]
   ```

3. **Position is inside 2 geofences → returns 4 detail entries:**
   ```python
   details = [
       # Geofence 1 - Latitude entry
       {'entityTypeAttributeId': 5, 'entityTelemetryId': 1001,
        'scoreContribution': 1, 'withinRange': 'Y'},
       
       # Geofence 1 - Longitude entry
       {'entityTypeAttributeId': 6, 'entityTelemetryId': 1002,
        'scoreContribution': 1, 'withinRange': 'Y'},
       
       # Geofence 2 - Latitude entry
       {'entityTypeAttributeId': 5, 'entityTelemetryId': 1001,
        'scoreContribution': 1, 'withinRange': 'Y'},
       
       # Geofence 2 - Longitude entry
       {'entityTypeAttributeId': 6, 'entityTelemetryId': 1002,
        'scoreContribution': 1, 'withinRange': 'Y'}
   ]
   ```

4. **Worker inserts into EventLogDetails:**
   ```sql
   EventLogDetails Table:
   ├─ entityTypeAttributeId: 5, entityTelemetryId: 1001, withinRange: 'Y'
   ├─ entityTypeAttributeId: 6, entityTelemetryId: 1002, withinRange: 'Y'
   ├─ entityTypeAttributeId: 5, entityTelemetryId: 1001, withinRange: 'Y'
   └─ entityTypeAttributeId: 6, entityTelemetryId: 1002, withinRange: 'Y'
   ```

---

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **Auditability** | Can't trace back to position attributes ✗ | Can trace to exact SignalK attributes ✓ |
| **Traceability** | No linkage to EntityTelemetry records | Full linkage: event → lat/lon attributes → telemetry records |
| **Data Consistency** | Geofence different from NEWS analyzer | Both attribute-based systems with populated IDs |
| **Query Capability** | Can't join to EntityTelemetry | Can join EventLogDetails → EntityTelemetry |
| **Event Analysis** | No way to map which position triggered event | Can replay exact position that triggered breach |

---

## Architecture Alignment

**Now matches existing patterns:**
- Attribute-based events (NEWS): populate both fields from specific attributes
- Geofence events: populate both fields from position attributes
- Both systems use identical EventLogDetails structure
- Worker unchanged; fully backward compatible

---

## Testing Considerations

To test this feature end-to-end:

1. **Ensure SignalK provider sends latitude/longitude with attribute IDs:**
   ```python
   # In subscription_analysis_worker or consumer
   # When querying EntityTelemetry, confirm these fields are present:
   # - attributeCode: 'latitude'
   # - entityTypeAttributeId: <actual ID from EntityTypeAttribute table>
   # - entityTelemetryId: <record ID from EntityTelemetry table>
   # - numericValue: <latitude value>
   ```

2. **Verify details array structure:**
   ```python
   # Check that each geofence breach has 2 entries (lat+lon)
   # with populated entityTypeAttributeId and entityTelemetryId
   assert len(details) > 0 and len(details) % 2 == 0  # Even number per geofence
   for detail in details:
       assert detail['entityTypeAttributeId'] is not None
       assert detail['entityTelemetryId'] is not None
   ```

3. **Query EventLogDetails to verify persistence:**
   ```sql
   SELECT TOP 1
       eventLogDetailsId,
       entityTypeAttributeId,
       entityTelemetryId,
       scoreContribution,
       withinRange
   FROM dbo.EventLogDetails
   WHERE eventLogId = <geofence_event_id>
   -- Should show populated entityTypeAttributeId and entityTelemetryId
   ```

---

## Backward Compatibility

✓ **Fully backward compatible:**
- EventLogDetails table structure unchanged (columns already nullable)
- Existing attribute-based events (NEWS, health) continue to work
- Worker SQL CAST statements handle both NULL and populated values
- No database schema changes required
