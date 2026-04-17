# TELEMETRY DUPLICATE ATTRIBUTES - DIAGNOSTIC REPORT

## 🎯 EXECUTIVE SUMMARY

**Issue Found**: ✅ YES - Duplicates identified in `EntityTypeAttribute` table  
**Severity**: MEDIUM - Affects UI display and telemetry queries  
**Root Cause**: Database design issue - attributes defined per EntityType instead of globally  
**Location**: Database (EntityTypeAttribute table)  
**Impact**: EntityTelemetryRN page displays 3 RPM entries, 2 ENG TEMP entries, 1-2 WASTE WATER entries

---

## 🔍 DIAGNOSIS DETAILS

### 1. **ROOT CAUSE: EntityTypeAttribute Table Has Duplicates**

Each telemetry attribute is defined **4 times** - once for each EntityTypeId (4, 5, 6, 7):

```
Attribute: RPM (propulsion.main.revolutions)
├─ ID: 3114 | EntityTypeId: 6
├─ ID: 1084 | EntityTypeId: 7
├─ ID: 1063 | EntityTypeId: 5
└─ ID: 1042 | EntityTypeId: 4

Attribute: Eng Temp (propulsion.main.temperature)
├─ ID: 1043 | EntityTypeId: 4
├─ ID: 1064 | EntityTypeId: 5
├─ ID: 1085 | EntityTypeId: 7
└─ ID: 3115 | EntityTypeId: 6

Attribute: Waste Water (tanks.wasteWaterTank.level)
├─ ID: 3121 | EntityTypeId: 6
├─ ID: 1091 | EntityTypeId: 7
├─ ID: 1070 | EntityTypeId: 5
└─ ID: 1049 | EntityTypeId: 4
```

**Similarly affected attributes (4 duplicates each)**:
- Air Temp
- Seawater Temp
- Water Temp
- Water Temperature (Coolant)
- Exhaust Temp
- Oil Temperature
- Gearbox Oil Temp

### 2. **DATA FLOW - Where Duplicates Enter the System**

```
┌─────────────────────────────────────────────┐
│   EntityTypeAttribute Table (DATABASE)       │
│  ─ 40 entries total for target attributes   │
│  ─ 4 duplicates per attribute name           │
│  ✅ This is the SOURCE of the problem       │
└────────────┬────────────────────────────────┘
             │
             ▼ ROW_NUMBER() OVER (PARTITION BY entityTypeAttributeId)
┌─────────────────────────────────────────────┐
│   /api/telemetry/latest/{entity_id}         │
│  ─ Returns 14+ records (all 4 RPM IDs)      │
│  ─ Uses ROW_NUMBER by ID, not by code       │
│  ✅ API correctly returns duplicates        │
└────────────┬────────────────────────────────┘
             │
             ▼ latestValues array
┌─────────────────────────────────────────────┐
│   EntityTelemetryRNPage.jsx (UI)            │
│  ─ Renders ALL latestValues                 │
│  ─ No deduplication by name                 │
│  ✅ Frontend displays duplicates            │
└─────────────────────────────────────────────┘
```

### 3. **Why EntityTelemetry Table Stores All 4 IDs**

The EntityTelemetry table has entries for **all 4 attribute IDs**:

| Attribute       | ID   | EntityTypeId | Records | Entities |
|-----------------|------|-------------|---------|----------|
| RPM            | 1042 |      4      |    1    |    1     |
| RPM            | 1063 |      5      | 14,493  |    2     |
| RPM            | 3114 |      6      | 24,429  |    2     |
| Eng Temp       | 1064 |      5      | 14,447  |    1     |
| Eng Temp       | 3115 |      6      | 24,426  |    2     |
| Waste Water    | 1070 |      5      | 14,446  |    1     |
| Waste Water    | 3121 |      6      | 24,426  |    2     |

---

## 📊 IMPACT ANALYSIS

### Current Behavior
- **RPM**: Shows 3 times (IDs: 3114, 1084, 1063) because only these have telemetry data
- **Eng Temp**: Shows 2 times (IDs: 1064, 3115)
- **Waste Water**: Shows once (varies by entity)

### Why Different Counts Per Entity?
The diagnostic shows:
- EntityTypeId 4 & 7: Older configurations, few/no telemetry records
- EntityTypeId 5 & 6: Active configurations, lots of telemetry records

When you query an entity's telemetry:
- If entity belongs to Type 5 → Shows ID 1063 (RPM), ID 1064 (Eng Temp), ID 1070 (Waste Water)
- If entity belongs to Type 6 → Shows ID 3114 (RPM), ID 3115 (Eng Temp), ID 3121 (Waste Water)
- If entity belongs to multiple types → Shows both sets (duplicates!)

---

## 🔧 THREE SOLUTION OPTIONS

### **OPTION A: Fix at Database Level** ⭐ RECOMMENDED
**Location**: EntityTypeAttribute table  
**Approach**: Consolidate duplicates into single global attributes  
**Complexity**: MEDIUM  
**Impact**: Requires data migration; fixes issue at source  

**Pros**:
✅ Cleanest solution - fixes root cause  
✅ No frontend code changes  
✅ Better data integrity  
✅ Easier to maintain long-term  
✅ Single source of truth per attribute  

**Cons**:
❌ Requires careful data migration  
❌ May affect other queries using entityTypeId  
❌ Need to verify all stored procedures  

**Implementation Steps**:
1. Create a new "global" EntityTypeAttribute table without entity type duplication
2. Migrate EntityTelemetry to reference new global attributes
3. Archive old EntityTypeAttribute entries
4. Update any dependent queries (e.g., scoring criteria)
5. Test thoroughly with all entity types

---

### **OPTION B: Fix at API Level**
**Location**: main.py `/api/telemetry/latest/{entity_id}` endpoint  
**Approach**: Deduplicate by `entityTypeAttributeCode` instead of ID  
**Complexity**: LOW  
**Impact**: Quick fix; doesn't address schema issue  

**Pros**:
✅ Fast to implement (5-10 min)  
✅ No database changes needed  
✅ Fixes UI immediately  
✅ Backward compatible  

**Cons**:
❌ Hides the root problem  
❌ Other queries still have duplicates  
❌ May cause inconsistencies with other APIs  
❌ Technical debt increases  

**Implementation Steps**:
1. Modify query to use `DISTINCT ON (entityTypeAttributeCode)` or add grouping
2. When multiple IDs exist for same code, pick the one with latest data
3. Test with all entities
4. Update documentation

**Code Change Location**: [main.py line 2550-2570](main.py#L2550-L2570)

---

### **OPTION C: Fix at Frontend Level**
**Location**: admin-dashboard/src/pages/EntityTelemetryRNPage.jsx  
**Approach**: Deduplicate by `attributeName` when rendering  
**Complexity**: LOW  
**Impact**: Cosmetic fix; doesn't fix underlying issue  

**Pros**:
✅ Very quick to implement (5 min)  
✅ No backend changes  
✅ Works with existing data  

**Cons**:
❌ Only hides UI duplicates, doesn't fix root  
❌ Chart still plots all duplicates  
❌ Other pages/APIs still affected  
❌ Problematic for REST API consumers  
❌ Most temporary solution  

**Implementation Steps**:
1. In `latestValues` array, deduplicate by `attributeName`
2. Keep first/latest occurrence of each name
3. In chart data, deduplicate similarly
4. Display consolidated attribute card

**Code Change Location**: [EntityTelemetryRNPage.jsx line 225-240](admin-dashboard/src/pages/EntityTelemetryRNPage.jsx#L225-L240)

---

## 💡 RECOMMENDATION

### **Use OPTION A (Database Fix) + OPTION B (API Safety Net)**

**Phase 1** (Immediate): Implement Option B
- Protects API consumers from duplicates
- Solves the immediate UI problem
- Buys time for proper database refactor

**Phase 2** (Soon): Design Option A
- Plan entity type attribute consolidation
- Create migration script
- Test comprehensively

**Phase 3** (After validation): Execute Option A
- Run migration during maintenance window
- Update all dependent code
- Retire old EntityTypeAttribute mappings

---

## 📝 DETAILED FINDINGS

### EntityTypeAttribute Duplicates Found: 10 attributes × 4 copies = 40 total

```
1. Air Temp                              (4 copies)
2. Seawater Temp                         (4 copies)
3. Water Temp                            (4 copies)
4. Water Temperature                     (4 copies) ← different from Water Temp!
5. Exhaust Temp                          (4 copies)
6. Oil Temperature                       (4 copies)
7. RPM                                   (4 copies) ⚠️ VISIBLE IN PAGE
8. Eng Temp                              (4 copies) ⚠️ VISIBLE IN PAGE
9. Gearbox Oil Temp                      (4 copies)
10. Waste Water                          (4 copies) ⚠️ VISIBLE IN PAGE
```

### Telemetry Data Distribution

| Attribute Code | Most Active ID | Records | Least Active ID | Records |
|---|---|---|---|---|
| propulsion.main.revolutions | 3114 | 24,429 | 1042 | 1 |
| propulsion.main.temperature | 3115 | 24,426 | 1043 | 0 |
| tanks.wasteWaterTank.level | 3121 | 24,426 | 1049 | 0 |

This explains why you see 3 RPM entries - IDs 1063, 3114 have active data, but others don't.

---

## 🚀 NEXT STEPS

1. **Acknowledge**: Confirm this diagnosis matches what you see in the UI
2. **Choose Solution**: Pick Option A, B, or both
3. **Implement**: I'll help with the code changes
4. **Test**: Verify with multiple entity types
5. **Monitor**: Check for any dependent systems affected

---

## 📞 QUESTIONS FOR CLARIFICATION

Before implementing, please confirm:

1. **Entity Types 4-7**: What do they represent? Why are attributes duplicated per type?
2. **Backward Compatibility**: Are there existing API consumers relying on the current structure?
3. **Timeline**: When can we make breaking changes?
4. **Priority**: Should we do quick fix (Option B) first, or wait for full refactor (Option A)?

---

**Diagnostic Report Generated**: 2026-04-17  
**Database**: free-sql-db-5949639  
**Status**: Ready for implementation
