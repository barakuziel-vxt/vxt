# API QUERY ANALYSIS - GetEntityTelemetry Duplicate Issue

## ❌ CURRENT QUERY PROBLEM

**Location**: [main.py line 2600-2634](main.py#L2600-L2634)  
**Endpoint**: `GET /api/telemetry/latest/{entity_id}`

### Current Query Structure
```sql
WITH LatestPerAttribute AS (
  SELECT
    eta.entityTypeAttributeId,
    eta.entityTypeAttributeCode,
    eta.entityTypeAttributeName,
    ...
    ROW_NUMBER() OVER (PARTITION BY eta.entityTypeAttributeId ...) AS rn
  FROM dbo.EntityTelemetry et
  JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
  LEFT JOIN dbo.ProtocolAttribute pa ON eta.protocolId = pa.protocolId ...
  WHERE et.entityId = ?                    ← ONLY filters by entity
    AND (et.numericValue IS NOT NULL OR et.stringValue IS NOT NULL)
)
SELECT * FROM LatestPerAttribute WHERE rn = 1
ORDER BY entityTypeAttributeCode
```

### 🔴 THE BUG

**Missing**: No join with Entity table to get `entity.entityTypeId`

**Result**: The query returns ALL EntityTypeAttribute records that have telemetry data, regardless of the entity's type.

**Example**:
- Entity "Shula" belongs to EntityTypeId 6
- Query finds:
  - `propulsion.main.revolutions` ID 3114 (EntityTypeId 6) ✅ Correct
  - `propulsion.main.revolutions` ID 1063 (EntityTypeId 5) ✅ Should NOT be here
  - `propulsion.main.revolutions` ID 1084 (EntityTypeId 7) ✅ Should NOT be here
- Result: 3 RPM entries instead of 1

### Why This Happens

1. EntityTelemetry stores data for all entity instances
2. Multiple EntityTypeIds have generated telemetry
3. Query returns all matching attributes without filtering by entity type
4. User sees duplicates for the same attribute across different entity types

---

## ✅ CORRECTED QUERY

### Fixed Query:
```sql
WITH LatestPerAttribute AS (
  SELECT
    eta.entityTypeAttributeId,
    eta.entityTypeAttributeCode,
    eta.entityTypeAttributeName,
    eta.entityTypeAttributeUnit,
    eta.defaultInGraph,
    et.numericValue,
    et.stringValue,
    et.endTimestampUTC,
    pa.protocolAttributeCode,
    pa.description,
    ROW_NUMBER() OVER (PARTITION BY eta.entityTypeAttributeCode ORDER BY et.endTimestampUTC DESC) AS rn
  FROM dbo.Entity e WITH (NOLOCK)
  JOIN dbo.EntityTelemetry et WITH (NOLOCK) ON et.entityId = e.entityId
  JOIN dbo.EntityTypeAttribute eta WITH (NOLOCK) 
    ON et.entityTypeAttributeId = eta.entityTypeAttributeId
    AND eta.entityTypeId = e.entityTypeId              ← ✅ CRITICAL FIX
  LEFT JOIN dbo.ProtocolAttribute pa WITH (NOLOCK) 
    ON eta.protocolId = pa.protocolId 
    AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
  WHERE e.entityId = ?
    AND (et.numericValue IS NOT NULL OR et.stringValue IS NOT NULL)
)
SELECT 
  entityTypeAttributeId,
  entityTypeAttributeCode,
  entityTypeAttributeName,
  entityTypeAttributeUnit,
  defaultInGraph,
  numericValue,
  stringValue,
  endTimestampUTC,
  protocolAttributeCode,
  description
FROM LatestPerAttribute 
WHERE rn = 1
ORDER BY entityTypeAttributeCode
```

### Key Changes:

1. **Added Entity join**:
   ```sql
   FROM dbo.Entity e WITH (NOLOCK)
   JOIN dbo.EntityTelemetry et ... ON et.entityId = e.entityId
   ```

2. **Added EntityTypeId filter**:
   ```sql
   JOIN dbo.EntityTypeAttribute eta ...
   AND eta.entityTypeId = e.entityTypeId    ← ✅ ESSENTIAL
   ```

3. **Changed ROW_NUMBER partition** (optional improvement):
   ```sql
   PARTITION BY eta.entityTypeAttributeCode    ← Groups by attribute name, not ID
   ```
   This makes it more robust if you want to pick latest across IDs (though with the EntityTypeId filter, there's only 1 ID per code anyway)

---

## 📊 IMPACT

### Before Fix (Current):
```
Entity: Shula (EntityTypeId 6)

Results from query:
├─ RPM [ID 3114, EntityTypeId 6]      ✅ Correct
├─ RPM [ID 1063, EntityTypeId 5]      ❌ Wrong entity type
├─ RPM [ID 1084, EntityTypeId 7]      ❌ Wrong entity type
├─ Eng Temp [ID 1064, EntityTypeId 5] ❌ Wrong
├─ Eng Temp [ID 3115, EntityTypeId 6] ✅ Correct
└─ Waste Water [ID 3121, EntityTypeId 6] ✅ Correct

Total: 7 attributes returned (includes duplicates)
```

### After Fix (Corrected):
```
Entity: Shula (EntityTypeId 6)

Results from query:
├─ RPM [ID 3114, EntityTypeId 6]      ✅ Correct
├─ Eng Temp [ID 3115, EntityTypeId 6] ✅ Correct
└─ Waste Water [ID 3121, EntityTypeId 6] ✅ Correct

Total: 3 attributes returned (only entity type 6)
```

---

## 🔍 OTHER ENDPOINTS TO CHECK

Review these endpoints for the same issue:

1. **`GET /api/telemetry/range/{entity_id}`** (line ~2660)
   - Used for time-series chart data
   - Likely has same issue

2. **`GET /api/events/range/{entity_id}`** (line ~2750)
   - Event detection queries
   - Should also filter by entity type

3. **`GET /api/eventlog/{id}/details`**
   - Event details modal
   - Check if it references EntityTypeAttribute

---

## ✅ SOLUTION READY TO IMPLEMENT

I can fix this immediately. Would you like me to:

1. ✅ Fix the `/api/telemetry/latest/{entity_id}` query
2. ✅ Fix the `/api/telemetry/range/{entity_id}` query  
3. ✅ Fix the `/api/events/range/{entity_id}` query
4. ✅ Check all other EntityTypeAttribute queries in main.py

All changes will:
- Add `JOIN dbo.Entity e` with entityId filter
- Add `AND eta.entityTypeId = e.entityTypeId` to each EntityTypeAttribute join
- Maintain backward compatibility (same response format)
- Improve query performance (fewer rows to process)

Shall I proceed with the fixes?
