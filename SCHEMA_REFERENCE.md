# Schema Reference & File Manifest

## Files Created

### Python Consumer & Adapters

| File | Lines | Purpose |
|------|-------|---------|
| `generic_telemetry_consumer.py` | 448 | Main consumer orchestrator - loads provider config, instantiates adapters, manages caches |
| `provider_adapters.py` | 550+ | Abstract ProviderAdapter + 3 concrete implementations (Junction, Terra, SignalK) |

### Database Migration & Configuration

| File | Purpose |
|------|---------|
| `db/sql/ALTER_ProviderEvent_AddColumns.sql` | Adds 6 new columns for configuration-driven extraction |
| `db/sql/SEED_ProviderEvent_JunctionTerra_Schemas.sql` | Populates Junction (5 metrics) + Terra (7 metrics) with JSONPath rules |

### Documentation

| File | Purpose |
|------|---------|
| `GENERIC_CONSUMER_ARCHITECTURE.md` | Complete architecture guide with all schemas, JSONPath examples, troubleshooting |
| `DEPLOYMENT_GUIDE.md` | Step-by-step deployment with SQL commands and verification checks |
| `SCHEMA_REFERENCE.md` | (This file) Quick reference for JSON schemas and mapping tables |

---

## ProviderEvent Table - New Columns

All 6 columns added to enable database-driven configuration:

```sql
ProtocolId INT
  → Foreign key to Protocol table
  → Links to LOINC, SignalK, or custom protocol

ProtocolAttributeId INT
  → Foreign key to ProtocolAttribute table
  → Links to standard attribute definitions

ValueJsonPath NVARCHAR(MAX)
  → JSONPath string to extract scalar value from event
  → Example: "$.data.heart_rate_data.summary.avg_hr_bpm"

SampleArrayPath NVARCHAR(MAX)
  → JSONPath string to extract array of detailed samples
  → Used when event contains multiple measurements over time
  → Example: "$.data.heart_rate_data.detailed.hr_samples"

CompositeValueTemplate NVARCHAR(MAX)
  → JSON object with extraction rules for sample arrays
  → Keys: "valueKey" (field name in each sample), "timestampKey"
  → Example: {"valueKey": "bpm", "timestampKey": "timestamp"}

FieldMappingJSON NVARCHAR(MAX)
  → JSON object mapping event fields to standardized names
  → Helps adapters understand which fields to extract
  → Example: {"EntityIdField": "user.user_id", "Unit": "bpm"}
```

---

## Junction Health Provider Schema v2.0

### Event Structure

```
user.user_id                                        → Entity ID
data.{TYPE}_data.summary.{metric}                  → Summary value
data.{TYPE}_data.detailed.{TYPE}_samples[]         → Detailed samples array
```

### Configured Metrics (5 LOINC codes)

| LOINC | Metric | Summary Path | Samples Path | Sample Fields |
|-------|--------|--------------|--------------|---------------|
| **8867-4** | Heart Rate | `data.heart_rate_data.summary.avg_hr_bpm` | `data.heart_rate_data.detailed.hr_samples` | `{timestamp, bpm}` |
| **8480-6** | Systolic BP | `data.blood_pressure_data.summary.avg_systolic_mmhg` | `data.blood_pressure_data.detailed.bp_samples` | `{timestamp, systolic_mmhg}` |
| **8462-4** | Diastolic BP | `data.blood_pressure_data.summary.avg_diastolic_mmhg` | `data.blood_pressure_data.detailed.bp_samples` | `{timestamp, diastolic_mmhg}` |
| **8310-5** | Temperature | `data.temperature_data.body_temperature_celsius` | NULL | N/A |
| **2708-6** | Oxygen Sat | `data.oxygen_data.avg_saturation_percentage` | NULL | N/A |

### Data Extraction Rules

**Heart Rate Event:**
```
ValueJsonPath: $.data.heart_rate_data.summary.avg_hr_bpm
SampleArrayPath: $.data.heart_rate_data.detailed.hr_samples
CompositeValueTemplate: {"valueKey": "bpm", "timestampKey": "timestamp"}
```

**Blood Pressure Event:**
```
ValueJsonPath: $.data.blood_pressure_data.summary.avg_systolic_mmhg
SampleArrayPath: $.data.blood_pressure_data.detailed.bp_samples
CompositeValueTemplate: {"valueKey": "systolic_mmhg", "timestampKey": "timestamp"}
```

---

## Terra Health API Schema v3.0

### Event Structure

```
user_id                                     → Entity ID
timestamp                                   → Event timestamp
data[0].{TYPE}_data.summary.{metric}       → Summary values in array
data[0].{TYPE}_data.{SAMPLES}[]            → Detailed samples
metadata.end_timestamp                      → Optional end time
```

### Configured Metrics (7 LOINC codes)

| LOINC | Metric | Summary Path | Samples Path | Sample Fields |
|-------|--------|--------------|--------------|---------------|
| **8867-4** | Heart Rate | `data[0].heart_rate_data.summary.avg_hr_bpm` | `data[0].heart_rate_data.detailed.hr_samples` | `{timestamp, bpm}` |
| **8480-6** | Systolic BP | `data[0].blood_pressure_data.blood_pressure_samples[0].systolic_bp_mmHg` | `data[0].blood_pressure_data.blood_pressure_samples` | `{systolic_bp_mmHg}` |
| **8462-4** | Diastolic BP | `data[0].blood_pressure_data.blood_pressure_samples[0].diastolic_bp_mmHg` | `data[0].blood_pressure_data.blood_pressure_samples` | `{diastolic_bp_mmHg}` |
| **8310-5** | Temperature | `data[0].temperature_data.body_temperature_celsius` | NULL | N/A |
| **2708-6** | Oxygen Sat | `data[0].oxygen_data.avg_saturation_percentage` | NULL | N/A |
| **2345-7** | Glucose | `data[0].glucose_data.day_avg_glucose_mg_per_dL` | NULL | N/A |
| **9279-1** | Respiration | `data[0].respiration_data.avg_breaths_per_min` | NULL | N/A |

### Data Extraction Rules

**Terra Heart Rate:**
```
ValueJsonPath: $.data[0].heart_rate_data.summary.avg_hr_bpm
SampleArrayPath: $.data[0].heart_rate_data.detailed.hr_samples
CompositeValueTemplate: {"valueKey": "bpm", "timestampKey": "timestamp"}
```

**Terra Blood Pressure:**
```
ValueJsonPath: $.data[0].blood_pressure_data.blood_pressure_samples[0].systolic_bp_mmHg
SampleArrayPath: $.data[0].blood_pressure_data.blood_pressure_samples
CompositeValueTemplate: {"valueKey": "systolic_bp_mmHg"}
```

---

## Entity Filtering Logic

### Cache-based Filtering (O(1) per message)

**Entity Cache:**
```
LOAD: SELECT EntityId, EntityTypeId FROM Entity WHERE Active = 'Y'
STRUCTURE: {entity_id → entity_type_id}
USAGE: Fast lookup to verify entity exists
```

**Attribute Cache:**
```
LOAD: SELECT DISTINCT eta.EntityTypeId, eta.entityTypeAttributeCode
      FROM EntityTypeAttribute eta
      WHERE eta.Active = 'Y' AND eta.providerId = ?
STRUCTURE: {entityTypeAttributeCode → set(entity_type_ids)}
USAGE: Check if entity_type matches configured attributes for provider
```

### Filter Rules

```python
def _should_insert(entity_id, protocol_attr_code):
    # Rule 1: Entity must exist
    if entity_id not in entity_cache:
        return False
    
    entity_type_id = entity_cache[entity_id]
    
    # Rule 2: EntityTypeAttribute must exist with matching code and provider
    allowed_types = attribute_cache.get(protocol_attr_code, set())
    if entity_type_id not in allowed_types:
        return False
    
    # Rule 3: Active requirement checked in cache load
    return True
```

---

## Kafka Topics

| Provider | Topic | Format | Frequency |
|----------|-------|--------|-----------|
| **Junction** | `junction-events` | Bulk samples | Every 5 min |
| **Terra** | `terra_health_vitals` | Array-based | On-demand |
| **SignalK** | `signalk-events` | Updates array | Real-time |

---

## Quick Integration Checklist

- [ ] Run ALTER TABLE migration
- [ ] Run SEED data script
- [ ] Verify provider configurations in Provider table
- [ ] Verify ProviderEvent mappings with JSONPath rules
- [ ] Verify EntityTypeAttribute mappings exist
- [ ] Install `pip install jsonpath-ng`
- [ ] Test consumer startup: `python generic_telemetry_consumer.py 1`
- [ ] Verify Kafka topic connectivity
- [ ] Monitor EntityTelemetry inserts

---

## Key Differences from Old System

| Aspect | Old (Hardcoded) | New (DB-Driven) |
|--------|----------------|-----------------|
| **Event Mapping** | Hardcoded in code (diastolic_mmhg) | ProviderEvent table with JSONPath |
| **Protocol Support** | Junction only | Junction + Terra + SignalK + custom |
| **Data Extraction** | Custom code per provider | JSONPath in database |
| **Filtering** | Query-based (slow) | Cache-based (O(1)) |
| **New Protocols** | Requires code change + deployment | Add to database, no code change |
| **Unit Mapping** | Hardcoded dictionary | In CompositeValueTemplate |
| **Maintenance** | Developer responsibility | DBA responsibility |

---

## Deployment Order

1. **Database First:**
   - ALTER TABLE
   - SEED data
   - Verify Provider/ProviderEvent records

2. **Python Environment:**
   - Install jsonpath-ng
   - Place generic_telemetry_consumer.py
   - Place provider_adapters.py

3. **Testing:**
   - Test consumer startup
   - Monitor logs for cache loading
   - Verify first inserts to EntityTelemetry

4. **Production:**
   - Update start_all.ps1
   - Run full system startup
   - Monitor success rates

---

## File Locations (All in C:\VXT)

```
C:\VXT\
├── generic_telemetry_consumer.py          ← Main consumer
├── provider_adapters.py                   ← Adapters (Junction, Terra, SignalK)
├── GENERIC_CONSUMER_ARCHITECTURE.md       ← Full documentation
├── DEPLOYMENT_GUIDE.md                    ← Step-by-step guide
├── SCHEMA_REFERENCE.md                    ← This file
└── db\sql\
    ├── ALTER_ProviderEvent_AddColumns.sql
    └── SEED_ProviderEvent_JunctionTerra_Schemas.sql
```

---

## Support & Debugging

**For JSONPath issues:**
- Use https://jsonpath.com/ to test paths on sample events
- Check SampleArrayPath with `$.path[*]` to get all elements

**For adapter issues:**
- Verify AdapterClassName matches file class exactly
- Test with `python -c "from provider_adapters import JunctionVitalsAdapter"`

**For filtering issues:**
- Check entity exists: `SELECT * FROM Entity WHERE entityId = 'xxx'`
- Check EntityTypeAttribute mapped: `SELECT * FROM EntityTypeAttribute WHERE providerId = X AND entityTypeAttributeCode = 'YYY'`
