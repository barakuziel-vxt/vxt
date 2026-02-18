# Quick Deployment Guide - Generic Telemetry Consumer

## Overview
This guide walks through deploying the database-driven multi-provider consumer system with Junction and Terra health providers.

## Files Created/Modified

### New Files
1. **generic_telemetry_consumer.py** - Main generic consumer (~450 lines)
2. **provider_adapters.py** - Provider adapters with JSONPath extraction (~550 lines)
3. **db/sql/ALTER_ProviderEvent_AddColumns.sql** - Schema migration
4. **db/sql/SEED_ProviderEvent_JunctionTerra_Schemas.sql** - Configuration seed data
5. **GENERIC_CONSUMER_ARCHITECTURE.md** - Full documentation

## Prerequisites

### Database
- SQL Server with VXT database
- Existing tables: Provider, Protocol, ProtocolAttribute, Entity, EntityType, EntityTypeAttribute, EntityTelemetry

### Python Packages
- kafka (existing)
- pyodbc (existing)
- **jsonpath-ng** (NEW - required for JSONPath extraction)

## Deployment Steps

### 1. Install JSONPath Library (Required)

```powershell
# Activate virtual environment
cd C:\VXT
.\.venv\Scripts\Activate.ps1

# Install jsonpath-ng
pip install jsonpath-ng
```

### 2. Apply Database Migrations

#### 2a. Add new columns to ProviderEvent table

```powershell
# Run ALTER TABLE script
sqlcmd -S localhost -d VXT -U sa -P YourPassword -i "db\sql\ALTER_ProviderEvent_AddColumns.sql"
```

Expected output:
```
✓ ProviderEvent table migration completed successfully
  Columns added: ProtocolId, ProtocolAttributeId, ValueJsonPath, SampleArrayPath, CompositeValueTemplate, FieldMappingJSON
  Foreign keys created for Protocol and ProtocolAttribute
  Performance indexes created
```

#### 2b. Populate ProviderEvent with Junction and Terra configurations

```powershell
# Run SEED data script
sqlcmd -S localhost -d VXT -U sa -P YourPassword -i "db\sql\SEED_ProviderEvent_JunctionTerra_Schemas.sql"
```

Expected output:
```
✓ ProviderEvent seed data loaded successfully
  Junction mappings: 5 LOINC codes (HR, SBP, DBP, Temp, O2)
  Terra mappings: 7 LOINC codes (HR, SBP, DBP, Temp, O2, Glucose, Respiration)
  All with detailed ValueJsonPath and SampleArrayPath for data extraction
```

### 3. Verify Database Configuration

Check that Provider table has AdapterClassName values:

```powershell
sqlcmd -S localhost -d VXT -U sa -P YourPassword -Q `
  "SELECT ProviderName, AdapterClassName, TopicName FROM Provider WHERE Active = 'Y';"
```

Expected output:
```
ProviderName     AdapterClassName         TopicName
---------------- ----------------------- ------------------
Junction         JunctionAdapter         junction-events
Terra            TerraAdapter             terra_health_vitals
```

### 4. Verify Provider Event Mappings

```powershell
sqlcmd -S localhost -d VXT -U sa -P YourPassword -Q `
  "SELECT ProviderEventType, protocolAttributeCode, ValueJsonPath FROM ProviderEvent WHERE Active = 'Y' ORDER BY ProviderId, ProviderEventType;"
```

Should show configurations like:
```
ProviderEventType                protocolAttributeCode   ValueJsonPath
-------------------------------- ----------------------- -----------------------------------------------
vitals.blood_pressure.update     diastolic_mmhg          $.data.blood_pressure_data.summary.avg_diastolic_mmhg
vitals.blood_pressure.update     systolic_mmhg           $.data.blood_pressure_data.summary.avg_systolic_mmhg
vitals.heart_rate.update         avg_hr_bpm              $.data.heart_rate_data.summary.avg_hr_bpm
...
```

### 5. Update start_all.ps1 Script

Replace the hardcoded consumer with the generic consumer:

```powershell
# OLD:
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe Consumes_Junction_events_into_EntityTelemetry.py" -WindowStyle Normal

# NEW - Junction consumer (provider_id=1)
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe generic_telemetry_consumer.py 1" -WindowStyle Normal

# NEW - Terra consumer (provider_id=2)
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe generic_telemetry_consumer.py 2" -WindowStyle Normal
```

### 6. Test Consumer Startup

#### Test Junction Consumer (Dry Run)

```powershell
cd C:\VXT
.\.venv\Scripts\Activate.ps1
python.exe generic_telemetry_consumer.py 1 --log-level DEBUG
```

Expected startup logs:
```
2026-02-18 14:30:45,123 - generic_telemetry_consumer - INFO - ✓ Consumer initialized: Junction
  Entities cached: 12
  EntityTypeAttributes cached: 5
2026-02-18 14:30:45,234 - generic_telemetry_consumer - INFO - ✓ Connected to Kafka topic: junction-events
2026-02-18 14:30:45,345 - generic_telemetry_consumer - DEBUG -   vitals.heart_rate.update -> entityTypeAttributeId 1
2026-02-18 14:30:45,345 - generic_telemetry_consumer - DEBUG -   vitals.blood_pressure.update -> entityTypeAttributeId 2
```

If you see errors, check:
1. Kafka running: `docker ps | grep redpanda`
2. Provider exists: Query Provider table
3. AdapterClassName correct: Should be exactly `JunctionAdapter`

### 7. Full System Startup

```powershell
cd C:\VXT
.\start_all.ps1
```

This will launch:
- ✓ SQL Server + Redpanda (docker-compose)
- ✓ Subscription Analysis Worker
- ✓ Junction Consumer (generic_telemetry_consumer.py 1)
- ✓ Terra Consumer (generic_telemetry_consumer.py 2)
- ✓ Junction Simulators (Barak & Shula)
- ✓ API Server (FastAPI)
- ✓ Admin Dashboard

## Monitoring

### Consumer Logs

Watch the generic consumers in their PowerShell windows:

```
Progress: 10 events, 8 inserted, 2 skipped
Progress: 20 events, 17 inserted, 3 skipped
Progress: 30 events, 28 inserted, 2 skipped
...
```

### Database Verification

Check EntityTelemetry inserts:

```powershell
sqlcmd -S localhost -d VXT -U sa -P YourPassword -Q `
  "SELECT TOP 20 entityId, startTimestampUTC, numericValue FROM EntityTelemetry ORDER BY startTimestampUTC DESC;"
```

### Performance Metrics

In consumer logs after processing:

```
================================================================================
Consumer stopped
Total events processed: 1000
Total records inserted: 850
Total records skipped: 150
Success rate: 85.0%
================================================================================
```

## Common Issues & Solutions

### Issue: "No module named 'jsonpath_ng'"
**Solution:**
```powershell
pip install jsonpath-ng
```

### Issue: "Adapter MyAdapter not found"
**Check:**
1. Spelling in Provider.AdapterClassName
2. Class defined in provider_adapters.py
3. Both names must match exactly

**Debug:**
```powershell
python -c "from provider_adapters import JunctionAdapter; print('OK')"
```

### Issue: No records inserted, all skipped
**Check:**
1. Entities exist: `SELECT COUNT(*) FROM Entity WHERE Active = 'Y'`
2. EntityTypeAttribute mappings exist: 
   ```sql
   SELECT eta.entityTypeAttributeCode FROM EntityTypeAttribute eta
   WHERE eta.providerId = 1 AND eta.Active = 'Y'
   ```
3. ProtocolAttribute codes match:
   ```sql
   SELECT pe.protocolAttributeCode FROM ProviderEvent pe
   WHERE pe.providerId = 1
   ```

### Issue: Simulators not sending events
**Check:**
1. Kafka running: `docker logs redpanda 2>&1 | grep -i "started"`
2. Topic exists: 
   ```powershell
   docker exec -it redpanda rpk topic list
   ```
3. Simulator logs for errors

## Rollback Plan

If issues occur, revert to old consumer:

```powershell
# Restore old consumer in start_all.ps1
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe Consumes_Junction_events_into_EntityTelemetry.py" -WindowStyle Normal
```

The generic consumer doesn't modify any data - it only reads and inserts to EntityTelemetry, so no data loss risk.

## Next Steps

1. **Add SignalK Support** - Create SignalKAdapter and register in Provider table
2. **Add Custom Protocol** - Follow "Adding a New Provider" in GENERIC_CONSUMER_ARCHITECTURE.md
3. **Performance Tuning** - Adjust batch sizes based on event volume
4. **Monitoring Alerts** - Add alerts for skip rates > threshold
5. **Schema Evolution** - Add new LOINC codes to ProviderEvent as needed

## Support Resources

- **Full Documentation:** [GENERIC_CONSUMER_ARCHITECTURE.md](GENERIC_CONSUMER_ARCHITECTURE.md)
- **Junction Docs:**Reference the Simulate_Junction_health_provider_Barak.py for event format
- **Terra Docs:** Reference create_generate_terra_json_function.py for event format
- **JSONPath Documentation:** https://github.com/jg-rp/jsonpath-ng
- **LOINC Code Reference:** https://loinc.org/

## Success Criteria

After deployment, verify:
- ✓ Consumer starts without adapter errors
- ✓ Entities are cached (> 0 count in logs)
- ✓ EntityTelemetry records are inserted (> 0 in last 5 minutes)
- ✓ Skip rate is < 20% (indicates good filtering)
- ✓ No JSONPath extraction errors in logs
