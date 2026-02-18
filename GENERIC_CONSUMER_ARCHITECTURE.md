# Generic Telemetry Consumer - Provider Adapter Architecture

## Overview

This document describes the multi-provider, multi-protocol telemetry consumer system that uses database-driven configuration for flexible data extraction.

## Architecture

### Key Components

1. **generic_telemetry_consumer.py** - Main consumer orchestrator
   - Loads provider configuration from `Provider` table
   - Dynamically instantiates provider adapters
   - Manages entity and attribute caches for filtering
   - Batches inserts to EntityTelemetry

2. **provider_adapters.py** - Protocol-specific parsers
   - `ProviderAdapter` - Abstract base class
   - `JunctionVitalsAdapter` - LOINC-based health vitals (Junction Health)
   - `TerraAdapter` - Health API format (Terra API)
   - `SignalKAdapter` - Maritime vessel telemetry (SignalK)

3. **Database Configuration**
   - `ProviderEvent` table - Event extraction rules with JSONPath
   - `Protocol` table - Protocol definitions (LOINC, SignalK, custom)
   - `ProtocolAttribute` table - Standard attributes with LOINC codes
   - `EntityTypeAttribute` table - Maps attributes to entity types per provider

## Schema Documentation

### Junction Health Provider (LOINC-based)

**Event Format:**
```json
{
  "user": {"user_id": "033114869"},
  "data": {
    "heart_rate_data": {
      "summary": {"avg_hr_bpm": 72},
      "detailed": {"hr_samples": [{"timestamp": "2026-02-18T...", "bpm": 72}]}
    },
    "blood_pressure_data": {
      "summary": {"avg_systolic_mmhg": 120, "avg_diastolic_mmhg": 80},
      "detailed": {"bp_samples": [{"timestamp": "2026-02-18T...", "systolic_mmhg": 120, "diastolic_mmhg": 80}]}
    },
    "temperature_data": {"body_temperature_celsius": 37.5},
    "oxygen_data": {"avg_saturation_percentage": 98.5}
  },
  "type": "vitals",
  "event_type": "vitals.heart_rate.update",
  "loinc_code": "8867-4",
  "timestamp": "2026-02-18T..."
}
```

**Configured Attributes:**
| LOINC Code | Attribute | ValueJsonPath | SampleArrayPath |
|-----------|-----------|---------------|-----------------|
| 8867-4 | avg_hr_bpm | $.data.heart_rate_data.summary.avg_hr_bpm | $.data.heart_rate_data.detailed.hr_samples |
| 8480-6 | systolic_mmhg | $.data.blood_pressure_data.summary.avg_systolic_mmhg | $.data.blood_pressure_data.detailed.bp_samples |
| 8462-4 | diastolic_mmhg | $.data.blood_pressure_data.summary.avg_diastolic_mmhg | $.data.blood_pressure_data.detailed.bp_samples |
| 8310-5 | body_temperature_celsius | $.data.temperature_data.body_temperature_celsius | NULL |
| 2708-6 | oxygen_saturation_percent | $.data.oxygen_data.avg_saturation_percentage | NULL |

### Terra Health API (Array-based)

**Event Format:**
```json
{
  "status": "success",
  "type": "vitals",
  "user_id": "033114869",
  "reference": "ref-1234",
  "timestamp": "2026-02-18T...Z",
  "start_timestamp": "2026-02-18T...Z",
  "metadata": {"start_timestamp": "...", "end_timestamp": "..."},
  "data": [{
    "heart_rate_data": {
      "summary": {
        "avg_hr_bpm": 72,
        "hr_variability_rmssd": 25.5,
        "max_hr_bpm": 85,
        "min_hr_bpm": 60,
        "resting_hr_bpm": 65
      },
      "detailed": {"hr_samples": [{"timestamp": "...", "bpm": 72}]}
    },
    "ecg_data": [{"classification": "sinus_rhythm", "afib_result": 0}],
    "blood_pressure_data": {"blood_pressure_samples": [{"systolic_bp_mmHg": 120, "diastolic_bp_mmHg": 80}]},
    "temperature_data": {"body_temperature_celsius": 37.5},
    "oxygen_data": {"avg_saturation_percentage": 98.5},
    "glucose_data": {"day_avg_glucose_mg_per_dL": 95},
    "respiration_data": {"avg_breaths_per_min": 16},
    "device_data": {"name": "Apple Watch"}
  }]
}
```

**Configured Attributes:**
| LOINC Code | Attribute | ValueJsonPath | SampleArrayPath |
|-----------|-----------|---------------|-----------------|
| 8867-4 | avg_hr_bpm | $.data[0].heart_rate_data.summary.avg_hr_bpm | $.data[0].heart_rate_data.detailed.hr_samples |
| 8480-6 | systolic_mmhg | $.data[0].blood_pressure_data.blood_pressure_samples[0].systolic_bp_mmHg | $.data[0].blood_pressure_data.blood_pressure_samples |
| 8462-4 | diastolic_mmhg | $.data[0].blood_pressure_data.blood_pressure_samples[0].diastolic_bp_mmHg | $.data[0].blood_pressure_data.blood_pressure_samples |
| 8310-5 | body_temperature_celsius | $.data[0].temperature_data.body_temperature_celsius | NULL |
| 2708-6 | oxygen_saturation_percent | $.data[0].oxygen_data.avg_saturation_percentage | NULL |
| 2345-7 | glucose_mg_per_dl | $.data[0].glucose_data.day_avg_glucose_mg_per_dL | NULL |
| 9279-1 | respiration_rate_per_min | $.data[0].respiration_data.avg_breaths_per_min | NULL |

### SignalK Protocol (Maritime Telemetry)

**Event Format:**
```json
{
  "context": "vessels.urn:mrn:imo:mmsi:234567890",
  "updates": [{
    "timestamp": "2026-02-18T...",
    "values": [
      {"path": "navigation.position.latitude", "value": 60.0},
      {"path": "navigation.position.longitude", "value": 25.0},
      {"path": "navigation.speedOverGround", "value": 12.5},
      {"path": "propulsion.0.engine.coolantTemperature", "value": 82.3}
    ]
  }]
}
```

**Typical Attributes (configurable in database):**
- navigation.position.latitude → latitude
- navigation.position.longitude → longitude
- navigation.speedOverGround → speed_kts
- propulsion.0.engine.coolantTemperature → engine_coolant_temp_celsius

## Data Extraction Rules (ValueJsonPath & SampleArrayPath)

### ValueJsonPath (JSONPath Syntax)

Extracts a single scalar value or summary from the event:

```
$.data.heart_rate_data.summary.avg_hr_bpm        # Nested object access
$.data[0].temperature_data.body_temperature_celsius  # Array access with index
$.data[*].heart_rate_data.summary.avg_hr_bpm     # All elements (returns array)
```

### SampleArrayPath (JSONPath Syntax)

Extracts an array of detailed samples for multi-sample events:

```
$.data.heart_rate_data.detailed.hr_samples        # Array of samples
$.data[0].blood_pressure_data.blood_pressure_samples  # Terra array format
```

When SampleArrayPath is used, CompositeValueTemplate defines how to extract values:

```json
{
  "valueKey": "bpm",           // Key in each sample object containing value
  "timestampKey": "timestamp"  // Key in each sample object containing timestamp
}
```

Example: For hr_samples = [{"timestamp": "...", "bpm": 72}]
- valueKey: "bpm" → extracts 72
- timestampKey: "timestamp" → extracts the timestamp

## Database Schema Changes Required

### 1. Alter ProviderEvent Table

```sql
ALTER TABLE dbo.ProviderEvent ADD
    ProtocolId INT NULL,
    ProtocolAttributeId INT NULL,
    ValueJsonPath NVARCHAR(MAX) NULL,
    SampleArrayPath NVARCHAR(MAX) NULL,
    CompositeValueTemplate NVARCHAR(MAX) NULL,
    FieldMappingJSON NVARCHAR(MAX) NULL;
```

### 2. Add Foreign Keys

```sql
ALTER TABLE dbo.ProviderEvent
ADD CONSTRAINT FK_ProviderEvent_Protocol 
FOREIGN KEY (ProtocolId) REFERENCES dbo.Protocol(ProtocolId);

ALTER TABLE dbo.ProviderEvent
ADD CONSTRAINT FK_ProviderEvent_ProtocolAttribute 
FOREIGN KEY (ProtocolAttributeId) REFERENCES dbo.ProtocolAttribute(ProtocolAttributeId);
```

## Deployment Steps

### Step 1: Apply Database Migration

```powershell
# Run the ALTER TABLE migration
sqlcmd -S localhost -d VXT -U sa -P YourPassword -i "db\sql\ALTER_ProviderEvent_AddColumns.sql"
```

### Step 2: Seed ProviderEvent Data

```powershell
# Populate with Junction and Terra configurations
sqlcmd -S localhost -d VXT -U sa -P YourPassword -i "db\sql\SEED_ProviderEvent_JunctionTerra_Schemas.sql"
```

### Step 3: Install Dependencies

```powershell
pip install jsonpath-ng
```

### Step 4: Start Consumer

```powershell
# Start consumer for Junction provider (provider_id = 1)
.\.venv\Scripts\python.exe generic_telemetry_consumer.py 1 --log-level INFO

# Start consumer for Terra provider (provider_id = 2)
.\.venv\Scripts\python.exe generic_telemetry_consumer.py 2 --log-level INFO
```

## Adding a New Provider

### 1. Create Adapter Class

In `provider_adapters.py`:

```python
class MyProviderAdapter(ProviderAdapter):
    def validate_message(self, message: Dict) -> bool:
        # Validate required fields
        return 'required_field' in message
    
    def parse_event(self, message: Dict) -> List[Dict]:
        events = []
        # Extract data and create normalized event dictionaries
        return events
```

### 2. Register in Provider Table

```sql
INSERT INTO dbo.Provider (ProviderName, Active, AdapterClassName, TopicName, BatchSize)
VALUES ('MyProvider', 'Y', 'MyProviderAdapter', 'my_provider_topic', 50);
```

### 3. Configure ProviderEvent Rules

```sql
INSERT INTO dbo.ProviderEvent (
    ProviderId, ProviderEventType, ProtocolId, ProtocolAttributeId,
    loincCode, protocolAttributeCode,
    ValueJsonPath, SampleArrayPath, CompositeValueTemplate
)
VALUES (
    (SELECT ProviderId FROM Provider WHERE ProviderName = 'MyProvider'),
    'my_event_type',
    (SELECT ProtocolId FROM Protocol WHERE ProtocolName = 'LOINC'),
    (SELECT ProtocolAttributeId FROM ProtocolAttribute WHERE protocolAttributeCode = 'xyz'),
    '1234-5',
    'xyz',
    '$.data.mapping.to.value',
    '$.data.mapping.to.samples',
    '{"valueKey": "value", "timestampKey": "timestamp"}'
);
```

### 4. Map EntityTypes

```sql
INSERT INTO dbo.EntityTypeAttribute (
    EntityTypeId, entityTypeAttributeCode, providerId, Active
)
SELECT 
    et.EntityTypeId,
    'xyz',
    p.ProviderId,
    'Y'
FROM EntityType et
CROSS JOIN Provider p
WHERE et.EntityTypeName = 'Person' AND p.ProviderName = 'MyProvider';
```

### 5. Start Consuming

```powershell
.\.venv\Scripts\python.exe generic_telemetry_consumer.py <provider_id>
```

## Filtering Logic

The consumer filters EntityTelemetry inserts based on:

1. **Entity Existence** - EntityId must exist in Entity table with Active='Y'
2. **EntityTypeAttribute Mapping** - Must exist record with:
   - `entityTypeAttributeCode = ProviderEvent.protocolAttributeCode`
   - `providerId = ProviderEvent.providerId`
   - `Active = 'Y'`
   - Entity's EntityTypeId must match the EntityTypeAttribute mapping

Example - Skip logic:
```python
# Entity doesn't exist in database
if entity_id not in self.entity_cache:
    return False, f"Entity {entity_id} not found"

# Attribute not mapped for this provider/entity-type combination
entity_type_id = self.entity_cache[entity_id]
allowed_types = self.attribute_cache.get(protocol_attr_code, set())
if entity_type_id not in allowed_types:
    return False, f"EntityType not mapped to attribute for provider"
```

## Monitoring

### Consumer Startup Logs

```
[2026-02-18T14:30:45.123] ✓ Provider loaded: Junction
[2026-02-18T14:30:45.456] Loaded 5 ProviderEvent mappings (5 with EntityTypeAttribute)
[2026-02-18T14:30:45.789] Cached 12 active entities
[2026-02-18T14:30:45.890] Cached 5 EntityTypeAttribute codes for provider 1
[2026-02-18T14:30:46.000] ✓ Connected to Kafka topic: junction-events
```

### Processing Statistics

```
Progress: 100 events, 85 inserted, 15 skipped
  - SKIP entity 999: Entity not found in Entity table
  - SKIP entity 033114870: EntityType Person not mapped to attribute avg_hr_bpm
  
Final Summary:
- Total events: 1000
- Inserted: 850 (85%)
- Skipped: 150 (15%)
```

## Troubleshooting

### No records being inserted

1. Check entity cache: Are entities in the Entity table with Active='Y'?
   ```sql
   SELECT COUNT(*) FROM Entity WHERE Active = 'Y';
   ```

2. Check EntityTypeAttribute mappings:
   ```sql
   SELECT eta.*, et.entityTypeName FROM EntityTypeAttribute eta
   JOIN EntityType et ON eta.EntityTypeId = et.EntityTypeId
   WHERE eta.providerId = 1 AND eta.Active = 'Y';
   ```

3. Check ProviderEvent configuration:
   ```sql
   SELECT * FROM ProviderEvent WHERE ProviderId = 1 AND Active = 'Y';
   ```

### JSONPath extraction not working

1. Test JSONPath on sample event:
   ```python
   from jsonpath_ng import parse
   jsonpath = parse("$.data.heart_rate_data.summary.avg_hr_bpm")
   matches = jsonpath.find(event_data)
   print(matches[0].value if matches else "NOT FOUND")
   ```

2. Verify SampleArrayPath:
   ```python
   jsonpath = parse("$.data.heart_rate_data.detailed.hr_samples")
   matches = jsonpath.find(event_data)
   print([m.value for m in matches])
   ```

### Adapter instantiation fails

1. Verify AdapterClassName in Provider table:
   ```sql
   SELECT ProviderName, AdapterClassName FROM Provider WHERE Active = 'Y';
   ```

2. Check provider_adapters.py for class definition:
   ```python
   # Verify class exists
   from provider_adapters import JunctionVitalsAdapter
   ```
