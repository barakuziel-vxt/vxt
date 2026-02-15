# Protocol-Agnostic Event-Driven Platform Setup Guide

## Architecture Overview

```
External Systems (Junction, Terra, SignalK, etc.)
    ↓
Kafka Topics (Protocol-specific)
    ↓
Smart Protocol Consumer (reads configuration from DB)
    ↓
Protocol Mappings → EntityTypeAttribute Resolution
    ↓
EntityTelemetry Table (unified storage)
```

## Database Schema

### 1. **Protocol Table**
Defines each external system/protocol.

```sql
INSERT INTO Protocol (protocolName, protocolVersion, kafkaTopic, description)
VALUES ('SignalK', '1.7.0', 'boat-telemetry', 'Maritime vessel telemetry protocol');
```

**Key Columns:**
- `protocolName`: Unique identifier (e.g., 'LOINC', 'Terra', 'SignalK', 'Junction')
- `kafkaTopic`: Kafka topic where this protocol's events arrive
- `entityTypeId`: Optional - which EntityType this protocol serves (NULL = multiple)

---

### 2. **ProtocolAttribute Table**
Defines all attributes that a protocol can provide.

```sql
INSERT INTO ProtocolAttribute 
(protocolId, protocolAttributeCode, protocolAttributeName, jsonPath, dataType)
VALUES 
(2, 'navigation.courseOverGroundMagnetic', 'Course Over Ground', 
 '$.context.vessel.navigation.courseOverGroundMagnetic', 'number');
```

**Key Columns:**
- `protocolAttributeCode`: Standard code from the protocol (e.g., '8867-4' for LOINC, 'navigation.speedOverGround' for SignalK)
- `jsonPath`: Where to find this attribute in incoming JSON events
  - Example: `$.AvgHR` for HealthVitals events
  - Example: `$.context.vessel.navigation.courseOverGroundMagnetic` for SignalK
- `dataType`: The type of value (number, string, boolean, integer, decimal)
- `unit`: Unit of measurement
- `rangeMin/rangeMax`: Expected value ranges for validation

---

### 3. **ProtocolAttributeMapping Table**
Maps protocol attributes to your system's EntityTypeAttribute (with optional transformations).

```sql
INSERT INTO ProtocolAttributeMapping 
(protocolAttributeId, entityTypeAttributeCode, transformationRule, transformationLanguage)
VALUES 
((SELECT protocolAttributeId FROM ProtocolAttribute 
  WHERE protocolAttributeCode = 'propulsion.port.engineTemperature'),
 'CoolantTempC', 
 'value - 273.15',  -- Convert Kelvin to Celsius
 'PYTHON');
```

**Key Columns:**
- `protocolAttributeId`: Which protocol attribute
- `entityTypeAttributeCode`: Maps to EntityTypeAttribute in your system (e.g., 'AvgHR', 'CoolantTempC', 'Latitude')
- `transformationRule`: Optional transformation
  - SQL: `CAST(value * 1.94384 AS DECIMAL(10,2))` - Convert m/s to knots
  - PYTHON: `value - 273.15` - Convert Kelvin to Celsius
  - NONE: No transformation
- `priority`: If multiple protocols map to same attribute, higher priority wins

---

## How to Add a New Protocol

### Example: Adding "Terra Health" Protocol

#### Step 1: Create Protocol Record
```sql
INSERT INTO Protocol (protocolName, protocolVersion, description, kafkaTopic)
VALUES ('Terra', '1.0', 'Terra Health wearable data', 'health-vitals');
```

#### Step 2: Define Protocol Attributes
```sql
DECLARE @protocolId INT = (SELECT protocolId FROM Protocol WHERE protocolName = 'Terra');

INSERT INTO ProtocolAttribute 
(protocolId, protocolAttributeCode, protocolAttributeName, jsonPath, dataType, unit)
VALUES
(@protocolId, 'terra.heart_rate', 'Heart Rate', '$.heart_rate', 'number', '{beats}/min'),
(@protocolId, 'terra.blood_pressure', 'Blood Pressure', '$.blood_pressure', 'object', 'mmHg'),
(@protocolId, 'terra.oxygen_saturation', 'Oxygen Saturation', '$.spo2', 'number', '%'),
(@protocolId, 'terra.body_temperature', 'Body Temperature', '$.temperature', 'number', 'C');
```

#### Step 3: Create Mappings to EntityTypeAttribute
```sql
DECLARE @protocolAttributeId INT;

-- Map Terra heart rate to EntityTypeAttribute 'AvgHR'
SELECT @protocolAttributeId = protocolAttributeId FROM ProtocolAttribute 
WHERE protocolAttributeCode = 'terra.heart_rate';

INSERT INTO ProtocolAttributeMapping 
(protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
VALUES (@protocolAttributeId, 'AvgHR', 'NONE', 2);  -- Priority 2 (lower than LOINC's priority 1)
```

#### Step 4: Sample Event Structure (JSON sent to Kafka)
```json
{
  "entityId": "033114869",
  "timestamp": "2024-02-13T10:30:00Z",
  "protocolAttributes": {
    "heart_rate": 75,
    "blood_pressure": {"systolic": 120, "diastolic": 80},
    "spo2": 98.5,
    "temperature": 36.8
  }
}
```

---

## How the Smart Consumer Works

### Processing Flow

1. **Load Configuration** (at startup)
   - Read all Protocol → ProtocolAttribute → EntityTypeAttribute mappings
   - Cache in memory for fast lookups

2. **On Each Event**
   ```
   Event arrives in Kafka topic
   ↓
   Consumer identifies protocol by topic or header
   ↓
   Looks up: Protocol → ProtocolAttribute mappings
   ↓
   Extracts JSON values using jsonPath expressions
   ↓
   Applies optional transformations (unit conversion, type casting)
   ↓
   Maps to EntityTypeAttribute codes
   ↓
   Inserts into EntityTelemetry as unified records
   ```

3. **Example: Processing a SignalK Event**
   ```python
   # Incoming event
   event = {
     "entityId": "234567890",
     "timestamp": "2024-02-13T10:30:00Z",
     "protocolAttributes": {
       "context": {
         "vessel": {
           "navigation": {
             "courseOverGroundMagnetic": 1.5708,  # radians
             "speedOverGround": 5.5  # m/s
           }
         }
       }
     }
   }
   
   # Extraction using jsonPath
   CourseOverGround = 1.5708  # from $.context.vessel.navigation.courseOverGroundMagnetic
   SOG = 5.5 * 1.94384 = 10.68 knots  # from $.context.vessel.navigation.speedOverGround (with transformation)
   
   # Insert into EntityTelemetry
   INSERT INTO EntityTelemetry (entityId, entityTypeAttributeCode, attributeValue, timestamp, protocol)
   VALUES 
     ('234567890', 'CourseOverGround', '1.5708', '2024-02-13T10:30:00Z', 'SignalK'),
     ('234567890', 'SOG', '10.68', '2024-02-13T10:30:00Z', 'SignalK');
   ```

---

## Transformation Rules

### Common Transformations

| Transformation | Language | Example | Use Case |
|---|---|---|---|
| Unit Conversion | PYTHON | `value * 1.94384` | Convert m/s to knots |
| Temperature | PYTHON | `value - 273.15` | Convert Kelvin to Celsius |
| Type Casting | SQL | `CAST(value AS DECIMAL(10,2))` | Ensure numeric type |
| Offset | PYTHON | `value + 32` | Offset correction |
| Formula | PYTHON | `value * 2 + 10` | Custom calculation |
| None | NONE | (empty) | Pass through as-is |

### Adding a Custom Transformation
```sql
UPDATE ProtocolAttributeMapping
SET transformationRule = 'value / 1000',  -- Example: convert to different unit
    transformationLanguage = 'PYTHON'
WHERE protocolAttributeId = (SELECT protocolAttributeId FROM ProtocolAttribute WHERE protocolAttributeCode = 'some_code')
  AND entityTypeAttributeCode = 'TargetAttribute';
```

---

## Queryingthe Mappings

### View All Protocol Mappings
```sql
SELECT 
    p.protocolName,
    pa.protocolAttributeCode,
    pa.jsonPath,
    pam.entityTypeAttributeCode,
    pam.transformationRule
FROM ProtocolAttributeMapping pam
JOIN ProtocolAttribute pa ON pam.protocolAttributeId = pa.protocolAttributeId
JOIN Protocol p ON pa.protocolId = p.protocolId
WHERE p.active = 'Y'
ORDER BY p.protocolName, pam.entityTypeAttributeCode;
```

### Check What Attributes a Protocol Provides
```sql
SELECT pa.protocolAttributeCode, pa.protocolAttributeName, pa.jsonPath
FROM ProtocolAttribute pa
JOIN Protocol p ON pa.protocolId = p.protocolId
WHERE p.protocolName = 'SignalK' AND pa.active = 'Y'
ORDER BY pa.protocolAttributeName;
```

### Debug: Find EntityTypeAttribute Mappings for a Protocol
```sql
SELECT DISTINCT pam.entityTypeAttributeCode
FROM ProtocolAttributeMapping pam
JOIN ProtocolAttribute pa ON pam.protocolAttributeId = pa.protocolAttributeId
JOIN Protocol p ON pa.protocolId = p.protocolId
WHERE p.protocolName = 'LOINC' AND pam.active = 'Y';
```

---

## Running the Smart Consumer

### Using Python
```bash
# Install dependencies
pip install kafka-python pyodbc jsonpath-ng

# Run consumer
python smart_protocol_consumer.py
```

### Multi-Protocol Setup (Recommended)
Each protocol should run in its own thread/process:

```python
from threading import Thread

protocols = [
    ('LOINC', 'health-vitals', 'health-vitals-group'),
    ('SignalK', 'boat-telemetry', 'boat-telemetry-group'),
    ('Junction', 'junction-events', 'junction-events-group'),
    ('Terra', 'health-vitals', 'terra-health-group'),
]

consumer = SmartProtocolConsumer(db_connection)

threads = []
for protocol_name, topic, group_id in protocols:
    t = Thread(target=consumer.consume_from_kafka, 
               args=(protocol_name, ['localhost:9092'], topic, group_id))
    t.daemon = True
    t.start()
    threads.append(t)

for t in threads:
    t.join()
```

---

## Adding New EntityTypeAttribute to the System

If you need to capture a new health or vessel metric:

1. **Add to EntityTypeAttribute table** (if not exists)
   ```sql
   INSERT INTO EntityTypeAttribute (entityTypeAttributeCode, description, entityTypeCategoryId)
   VALUES ('NewMetricCode', 'Description of new metric', (SELECT entityTypeCategoryId FROM EntityTypeCategory WHERE name='Health'));
   ```

2. **At protocol mapping time**, when you encounter a protocol attribute that should map to it:
   ```sql
   INSERT INTO ProtocolAttributeMapping 
   (protocolAttributeId, entityTypeAttributeCode, transformationRule, transformationLanguage, active)
   VALUES (...);
   ```

3. The smart consumer will **automatically** start importing this new attribute from that protocol!

---

## Key Benefits

✅ **Configuration-Driven**: Add new protocols without code changes
✅ **Pluggable Transformations**: Handle unit conversions, type casting, custom formulas
✅ **Multi-Protocol Aggregation**: Same EntityTypeAttribute can come from different protocols
✅ **Priority-Based Conflict Resolution**: When multiple protocols provide same attribute, highest priority wins
✅ **Audit Trail**: Track which protocol provided each telemetry value
✅ **Extensible**: Easy to add new protocols (Junction, Terra, custom proprietary systems)
✅ **Standards-Compliant**: Supports LOINC, SignalK, and any JSON-based protocol

---

## Troubleshooting

### No data appearing in EntityTelemetry?
```sql
-- 1. Check if protocol mappings exist
SELECT COUNT(*) FROM ProtocolAttributeMapping WHERE active = 'Y';

-- 2. Verify Kafka topics exist
-- kafka-topics.sh --list --bootstrap-server localhost:9092

-- 3. Check consumer logs for JSON extraction errors
-- Look for: "Failed to extract value from JSON path"
```

### Transformations not working?
```sql
-- Verify transformation rule syntax
SELECT transformationRule, transformationLanguage 
FROM ProtocolAttributeMapping 
WHERE entityTypeAttributeCode = 'YourAttribute';

-- Test transformation manually in Python
value = 5.5
result = value * 1.94384  # Should work
```

### Wrong priority mapping being used?
```sql
-- Check priority values
SELECT entityTypeAttributeCode, priority, transformationRule
FROM ProtocolAttributeMapping 
WHERE entityTypeAttributeCode = 'SOG'
ORDER BY priority DESC;

-- Update priority if needed
UPDATE ProtocolAttributeMapping 
SET priority = 10 
WHERE protocolAttributeId = (SELECT protocolAttributeId FROM ProtocolAttribute WHERE protocolAttributeCode = 'navigation.speedOverGround')
  AND entityTypeAttributeCode = 'SOG';
```
