# Codebase Analysis: EntityTypeAttribute, Attributes & Validation

**Date:** April 21, 2026  
**Scope:** Medium thoroughness - Focus on validation logic, attribute generation, and production vs. development differences

---

## 1. EntityTypeAttribute - Structure & Validation

### File Location
[db\sql\0025_Create_EntityTypeAttribute_table.sql](db/sql/0025_Create_EntityTypeAttribute_table.sql#L1)

### Schema Definition
```sql
CREATE TABLE EntityTypeAttribute (
    entityTypeAttributeId INT IDENTITY(1,1) NOT NULL,
    entityTypeId INT NOT NULL,
    protocolId INT NULL,
    entityTypeAttributeCode NVARCHAR(100) NOT NULL,      -- e.g., '8867-4', 'propulsion.main.revolutions'
    entityTypeAttributeName VARCHAR(200) NOT NULL,        -- e.g., 'HeartRate', 'Engine RPM'
    entityTypeAttributeTimeAspect NVARCHAR(50) NOT NULL,  -- e.g., 'Pt' (point in time), 'Mean'
    entityTypeAttributeUnit NVARCHAR(50) NOT NULL,        -- e.g., 'bpm', 'rpm', 'knots'
    providerId INT NULL,
    providerEventType NVARCHAR(100) NULL,
    defaultInGraph CHAR(1) NOT NULL DEFAULT 'N',
    active CHAR(1) NOT NULL DEFAULT 'Y',
    createDate DATETIME NOT NULL,
    lastUpdateTimestamp DATETIME NOT NULL,
    lastUpdateUser VARCHAR(128) NOT NULL,
    
    CONSTRAINT PK_EntityTypeAttribute PRIMARY KEY (entityTypeAttributeId),
    CONSTRAINT UQ_EntityTypeAttribute_Name UNIQUE (entityTypeId, entityTypeAttributeName),
    CONSTRAINT FK_EntityTypeAttribute_EntityType FOREIGN KEY (entityTypeId) REFERENCES EntityType(entityTypeId),
    CONSTRAINT FK_EntityTypeAttribute_Protocol FOREIGN KEY (protocolId, entityTypeAttributeCode) REFERENCES ProtocolAttribute(protocolId, protocolAttributeCode),
    CONSTRAINT FK_EntityTypeAttribute_ProviderEvent FOREIGN KEY (providerId, providerEventType) REFERENCES ProviderEvent(providerId, providerEventType)
);
```

### Key Validations (Active='Y' Required)
- **Entity must exist**: `WHERE eta.active = 'Y'`
- **Provider mapping**: Optional `providerId` + `providerEventType` link to ProviderEvent
- **Attribute code**: Unique per entity type + name combination
- **Time aspect**: Standardized values (Pt, Mean, Max, Min)
- **Temporal tracking**: `lastUpdateTimestamp` and `lastUpdateUser` auto-updated via trigger

---

## 2. What Attributes Are Being Simulated

### A. SignalK Maritime Attributes
**File:** [simulate_signalk_vessel.py](simulate_signalk_vessel.py#L200)

**Vessel Context:** `vessels.urn:mrn:imo:mmsi:{MMSI}`

#### Navigation Attributes
```python
{
    'path': 'navigation.position',
    'value': {'latitude': 32.8315, 'longitude': 35.0036}
},
{
    'path': 'navigation.latitude',
    'value': 32.8315
},
{
    'path': 'navigation.longitude',
    'value': 35.0036
},
{
    'path': 'navigation.headingMagnetic',
    'value': 0.0 - 2π radians  # Random
},
{
    'path': 'navigation.headingTrue',
    'value': 0.0 - 2π radians
},
{
    'path': 'navigation.courseOverGround',
    'value': 0.0 - 2π radians
},
{
    'path': 'navigation.speedOverGround',
    'value': 0.0 - 15 m/s
},
{
    'path': 'navigation.speedThroughWater',
    'value': 0.0 - 12 m/s
}
```

#### Environmental Attributes
```python
{
    'path': 'environment.wind.speedApparent',
    'value': 0.0 - 25 m/s
},
{
    'path': 'environment.wind.directionApparent',
    'value': 0.0 - 2π radians
},
{
    'path': 'environment.water.temperature',
    'value': 278.15 - 293.15 K  # 5-20°C in Kelvin
},
{
    'path': 'environment.outside.temperature',
    'value': 273.15 - 298.15 K  # 0-25°C in Kelvin
},
{
    'path': 'environment.outside.pressure',
    'value': 96000 - 100000 Pa   # ~98kPa ±2kPa
}
```

#### Engine Attributes
```python
{
    'path': 'propulsion.main.revolutions',
    'value': 0.0 - 50 rev/s      # 0-3000 RPM
},
{
    'path': 'propulsion.main.temperature',
    'value': 353.15 - 368.15 K   # 80-95°C in Kelvin
},
{
    'path': 'propulsion.main.oilPressure',
    'value': 250000 - 350000 Pa  # ~300kPa ±50kPa
}
```

#### Electrical Attributes
```python
{
    'path': 'electrical.dc.houseBattery.voltage',
    'value': 11.5 - 14.5 V
},
{
    'path': 'electrical.dc.houseBattery.current',
    'value': -200 to +200 A      # -: discharge, +: charge
}
```

#### Tank Attributes
```python
{
    'path': 'tanks.fuelTank.level',
    'value': 0.3 - 0.9           # 30-90% full ratio
},
{
    'path': 'tanks.freshWaterTank.level',
    'value': 0.4 - 0.95
},
{
    'path': 'tanks.wasteWaterTank.level',
    'value': 0.1 - 0.7
}
```

### B. Health Vitals Attributes (Junction Provider)
**Reference:** [Simulate_Junction_health_provider_Barak.py](Simulate_Junction_health_provider_Barak.py) & [db\sql\0025_Create_EntityTypeAttribute_table.sql](db/sql/0025_Create_EntityTypeAttribute_table.sql#L77)

**LOINC Codes** (inserted into EntityTypeAttribute):
- `8867-4`: Heart Rate / Pulse / SpO2 (heart.rate)
- `8480-6`: Systolic Blood Pressure (bp.systolic)
- `9279-1`: Respiration Rate (respiratory.rate)
- `2710-2`: Glucose / BodyTemperature (temp.body)
- `8310-5`: Body Temperature

**Structure:**
```python
{
    "user": {"user_id": "033114869"},
    "loinc_code": "8867-4",
    "event_type": "vitals.heart_rate.update",
    "timestamp": "2026-02-18T...",
    "data": {
        "heart_rate_data": {
            "summary": {"avg_hr_bpm": 72},
            "detailed": {"hr_samples": [{"timestamp": "...", "bpm": 72}]}
        }
    }
}
```

---

## 3. Generic Telemetry Consumer - Processing & Validation

**File:** [generic_telemetry_consumer.py](generic_telemetry_consumer.py#L1)

### Consumer Architecture
1. **Initialization**: Starts TelemetryProcessor with provider name
2. **Kafka Connection**: Subscribes to topic from `Provider.TopicName`
3. **Message Loop**: Pulls events and delegates to `TelemetryProcessor.process_event()`
4. **Offset Management**: Commits after successful processing
5. **Stats Tracking**: Logs events/inserts/skips every 25 events

### Consumer Code Flow
```python
class GenericTelemetryConsumer:
    def consume_and_insert(self, max_events=None):
        """Main consumer loop"""
        for message in self.consumer:
            event = message.value
            
            # DELEGATE PROCESSING TO TELEMETRYPROCESSOR
            inserted_count = self.processor.process_event(event)
            
            # COMMIT OFFSET AFTER SUCCESS
            self.consumer.commit()
            
            # LOG STATS EVERY 25 EVENTS
            if stats['events_processed'] % 25 == 0:
                logger.info(f"Progress: {events_processed} events, "
                          f"{records_inserted} inserted, "
                          f"{records_skipped} skipped")
```

---

## 4. Validation Logic That Causes Skips

**File:** [telemetry_processor.py](telemetry_processor.py#L420)

### Skip Reasons (3 Validation Checks)

```python
def _should_insert(self, entity_id: str, protocol_attr_code: str) -> Tuple[bool, str]:
    """Returns (should_insert, reason)"""
    
    # CHECK 1: Entity must exist in entity_cache
    if entity_id not in self.entity_cache:
        return False, f"Entity '{entity_id}' not in entity_cache"
    
    # CHECK 2: Attribute code must be in attribute_cache
    if protocol_attr_code not in self.attribute_cache:
        return False, f"Code '{protocol_attr_code}' not in attribute_cache"
    
    # CHECK 3: Entity must be assigned to active customer
    if entity_id not in self.customer_entities_cache:
        return False, f"Entity '{entity_id}' not assigned to active customer"
    
    return True, "OK"
```

### Cache Loading Details

**Entity Cache:** [telemetry_processor.py](telemetry_processor.py#L280)
```sql
SELECT DISTINCT e.EntityId, e.EntityTypeId
FROM Entity e
WHERE e.Active = 'Y'
  AND EXISTS (
    SELECT 1 FROM EntityTypeAttribute eta 
    WHERE eta.EntityTypeId = e.EntityTypeId 
      AND eta.providerId = ? 
      AND eta.Active = 'Y'
  )
```

**Attribute Cache:** [telemetry_processor.py](telemetry_processor.py#L310)
```sql
SELECT DISTINCT eta.entityTypeAttributeCode
FROM EntityTypeAttribute eta
WHERE eta.Active = 'Y'
  AND eta.providerId = ?
```

**Customer Entities Cache:** [telemetry_processor.py](telemetry_processor.py#L334)
```sql
SELECT DISTINCT ce.entityId
FROM CustomerEntities ce
JOIN Customers c ON ce.customerId = c.customerId
WHERE ce.active = 'Y'
  AND c.active = 'Y'
```

### Protocol-Level Filtering (Pre-Validation)

**File:** [telemetry_processor.py](telemetry_processor.py#L490)

```python
def process_event(self, event: Dict) -> int:
    # SILENT PROVIDER-LEVEL SKIP (no logging)
    if provider_name == 'Junction':
        if 'context' in event and 'updates' in event:
            # This is SignalK, not Junction
            self.stats['records_skipped'] += 1
            return 0
    
    elif provider_name == 'N2KToSignalK':
        if 'user' in event and 'event_type' in event:
            # This is Junction, not SignalK
            self.stats['records_skipped'] += 1
            return 0
    
    # ADAPTER VALIDATION
    if not self.adapter.validate_message(event):
        logger.warning(f"Message validation failed")
        self.stats['records_skipped'] += 1
        return 0
```

---

## 5. Provider Adapters & Attribute Extraction

### A. N2KToSignalK Adapter (Maritime)

**File:** [provider_adapters.py](provider_adapters.py#L397)

**Validation:**
```python
def validate_message(self, message: Dict) -> bool:
    required_fields = ['context', 'updates']
    
    for field in required_fields:
        if field not in message:
            logger.warning(f"Missing required field '{field}' in SignalK message")
            return False
    
    if not isinstance(message.get('updates'), list):
        logger.warning("SignalK 'updates' must be array")
        return False
    
    return True
```

**Extraction (Rule-Based):**
```python
def parse_event(self, message: Dict) -> List[Dict]:
    # Extract MMSI from context: "vessels.urn:mrn:imo:mmsi:{MMSI}"
    mmsi = context.split(':')[-1]
    
    # TWO-PASS: First get lat/lon, then process all paths
    for value_entry in update.get('values', []):
        signal_path = value_entry.get('path')
        
        # Skip nested position - already extracted
        if signal_path == 'navigation.position':
            continue
        
        # Check event_rules (loaded from ProviderEvent table)
        if signal_path in self.event_rules:
            rule = self.event_rules[signal_path]
            events.append({
                'entity_id': mmsi,
                'protocol_attribute_code': rule['protocol_attribute_code'],
                'entity_type_attribute_id': rule.get('entity_type_attribute_id'),
                'timestamp': timestamp,
                'numeric_value': float(signal_value) if isinstance(signal_value, (int, float)) else None,
                'latitude': location_data['latitude'],
                'longitude': location_data['longitude'],
                'provider_device': 'SignalK Device'
            })
```

### B. Junction Adapter (Health Vitals)

**File:** [provider_adapters.py](provider_adapters.py#L156)

**Validation:**
```python
def validate_message(self, message: Dict) -> bool:
    required_fields = ['user', 'timestamp']
    
    for field in required_fields:
        if field not in message:
            logger.warning(f"Missing required field '{field}' in Junction event")
            return False
    
    if 'user_id' not in message.get('user', {}):
        logger.warning("Missing user.user_id in Junction event")
        return False
    
    return True
```

**Silent Cross-Protocol Skip:**
```python
# Silently skip messages clearly meant for other protocols
if 'context' in message and 'updates' in message:
    # This looks like SignalK - skip without warning
    return False
```

---

## 6. Production vs. Development Code Differences

### A. Azure Function (vxt-function) - Production Code

**File:** [azure-functions\function_app.py](azure-functions/function_app.py#L250)

**Key Differences:**

1. **Lazy Module Loading** (Cold Start Optimization):
```python
class SimpleEventProcessor:
    def _get_mssql_module(self):
        """Lazy load mssql-python only when needed"""
        if self._mssql_module is None:
            from mssql_python import connect
            self._mssql_module = {'connect': connect}
        return self._mssql_module
```

2. **Managed Identity in Production** (vs. SA auth in local):
```python
if os.environ.get('ENVIRONMENT', '').lower() == 'local':
    # LOCAL: SQL auth
    conn_str = f"Server={server},1433;Database={db};UID={user};PWD={pwd};"
else:
    # PROD: Managed Identity (no secrets)
    conn_str = f"Server={server},1433;Database={db};Authentication=ActiveDirectoryMSI;"
```

3. **Auto-Detect Provider** (Instead of single provider):
```python
detected_provider = auto_detect_provider(event)  # Detects SignalK vs Junction
adapter = get_adapter(detected_provider)
normalized_events = adapter.parse(event)
```

4. **Track Inserted Codes** (For audit):
```python
inserted_codes = []
for evt in normalized_events:
    # ... insert logic ...
    inserted_codes.append(protocol_attr_code)
```

5. **EntityTypeAttribute Lookup in Insertion**:
```python
lookup_cursor.execute("""
    SELECT eta.entityTypeAttributeId
    FROM EntityTypeAttribute eta
    JOIN Entity e ON e.entityTypeId = eta.entityTypeId
    WHERE e.entityId = ?
      AND eta.entityTypeAttributeCode = ?
      AND eta.active = 'Y'
""", (str(evt.entity_id), str(evt.attr_code)))

row = lookup_cursor.fetchone()
if not row:
    logger.warning(f"[SKIP] No EntityTypeAttribute for entity={evt.entity_id} code={evt.attr_code}")
    self.stats['records_skipped'] += 1
    continue
```

### B. Local Development - generic_telemetry_consumer.py

**File:** [generic_telemetry_consumer.py](generic_telemetry_consumer.py#L1)

**Key Differences:**

1. **Single Provider Initialization**:
```python
consumer = GenericTelemetryConsumer(provider_name=pname)
# Creates one consumer per provider in separate threads
```

2. **Direct SQL Auth** (Local docker-compose):
```python
sql_conn_str = (
    f"Server={self.db_server},1433;"
    f"Database={self.db_name};"
    f"UID={self.db_user};"
    f"PWD={self.db_password};"
    "Encrypt=no;TrustServerCertificate=yes;"
)
```

3. **Pre-cached Validation** (All lookups done at init):
```python
self.entity_cache = self._load_entity_cache()           # Query once
self.attribute_cache = self._load_attribute_cache()     # Query once
self.customer_entities_cache = self._load_customer_entities_cache()  # Query once
```

4. **Simpler Stats Reporting**:
```python
stats = self.processor.get_stats()
if stats['events_processed'] % 25 == 0:
    logger.info(f"Progress: {events_processed} events, {records_inserted} inserted, {records_skipped} skipped")
```

---

## 7. File Location Reference

| Component | File | Key Lines |
|-----------|------|-----------|
| **EntityTypeAttribute Schema** | [db\sql\0025_Create_EntityTypeAttribute_table.sql](db/sql/0025_Create_EntityTypeAttribute_table.sql) | L1-50 |
| **SignalK Attributes (Simulated)** | [simulate_signalk_vessel.py](simulate_signalk_vessel.py) | L180-350 |
| **Generic Consumer** | [generic_telemetry_consumer.py](generic_telemetry_consumer.py) | L1-150 |
| **TelemetryProcessor Core** | [telemetry_processor.py](telemetry_processor.py) | L1-100, L420-550 |
| **Skip Validation Logic** | [telemetry_processor.py](telemetry_processor.py#L420) | L420-441 |
| **Cache Loading** | [telemetry_processor.py](telemetry_processor.py#L280) | L280-360 |
| **N2KToSignalK Adapter** | [provider_adapters.py](provider_adapters.py#L397) | L397-500 |
| **Junction Adapter** | [provider_adapters.py](provider_adapters.py#L156) | L156-250 |
| **Azure Function (Prod)** | [azure-functions\function_app.py](azure-functions/function_app.py) | L250-350 |
| **LOINC Attributes** | [db\sql\0025_Create_EntityTypeAttribute_table.sql](db/sql/0025_Create_EntityTypeAttribute_table.sql#L77) | L77-100 |

---

## 8. Key Takeaways

### Validation Layers
1. **Protocol-Level**: Auto-detect & silently skip messages for wrong provider
2. **Message-Level**: Adapter validates required fields (context/updates, user/user_id, etc.)
3. **Entity-Level**: Entity must exist + be assigned to active customer
4. **Attribute-Level**: EntityTypeAttribute must exist with providerId + be active

### Attribute Mapping
- **SimulatedAttributes**: SignalK paths (navigation.*, environment.*, propulsion.*, electrical.*, tanks.*)
- **HealthAttributes**: LOINC codes (8867-4 = HR, 8480-6 = BP, 9279-1 = RR, etc.)
- **Storage**: EntityTypeAttribute.entityTypeAttributeCode stores these paths/codes

### Production vs. Development
- **Production** (vxt-function): Lazy loading, Managed Identity, auto-detect provider, in-insertion lookups
- **Development** (generic_telemetry_consumer): Eager caching, SQL auth, single provider, pre-cached validation

### Skip Rate Management
- Expected: < 20% (per DEPLOYMENT_GUIDE.md)
- Common causes: Entity not in cache, attribute code not mapped, entity not assigned to customer
- Debug: Check entity_cache size, attribute_cache size, customer_entities_cache size in logs
