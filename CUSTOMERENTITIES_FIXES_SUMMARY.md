# CustomerEntities Schema Migration - Comprehensive Summary

## Overview
This document summarizes the changes made to align the `CustomerEntities` table schema across the codebase with a revised data model that removes the `iotDeviceId` column in favor of using `entityId` as the primary foreign key relationship.

**Date:** 2025-01-27 (Current Session)
**Scope:** Complete codebase alignment including root and azure-deployment directories

---

## Changes Made

### 1. **Database Schema Changes**
The schema modification removes the `iotDeviceId` column from `CustomerEntities`:

```sql
-- Before:
ALTER TABLE CustomerEntities DROP COLUMN iotDeviceId;

-- After:
customerEntityId (PK)
customerId (FK → Customers)
entityId (FK → Entity)
active (bool)
```

**Rationale:** 
- Simplifies the data model by using Entity as the single device reference
- The Entity table already maintains relationships to both the device (via entityId) and device metadata
- Reduces redundancy and improves data integrity

### 2. **Code Changes by File**

#### **Root Directory: main.py**
Applied fixes to all CustomerEntities-related database operations:

**Change 2.1: GET /customerentities endpoint (list all)**
- **Removed:** `ce.iotDeviceId` from SELECT clause
- **Removed:** `ce.iotDeviceId` from the response dictionary
- **Result:** Returns 7 columns instead of 8
- **Files Affected:** main.py (root)

**Change 2.2: GET /customerentities/{id} endpoint (get single)**
- **Removed:** `ce.iotDeviceId` from SELECT clause  
- **Removed:** `ce.iotDeviceId` from the WHERE clause retrieval
- **Removed:** `ce.iotDeviceId` from the response dictionary (row[6] → active becomes row[5])
- **Files Affected:** main.py (root)

**Change 2.3: POST /customerentities endpoint (create)**
- **Removed:** `iotDeviceId` parameter from INSERT statement
- **Changed:** INSERT columns from 4 to 3 parameters: `(customerId, entityId, active)`
- **Changed:** VALUES from `(?, ?, ?, ?)` to `(?, ?, ?)`
- **Files Affected:** main.py (root)

**Change 2.4: PUT /customerentities/{id} endpoint (update)**
- **Removed:** `iotDeviceId` parameter from UPDATE statement
- **Changed:** UPDATE SET columns from 4 to 3 parameters: `customerId, entityId, active`
- **Changed:** WHERE clause parameter position adjusted from ?, ?, ?, ? to ?, ?, ?, ?
- **Files Affected:** main.py (root)

**Change 2.5: POST /customerentities/{id}/sync-setup endpoint (sync setup)**
- **Removed:** `iotDeviceId` parameter from SELECT query
- **Removed:** Null check for iotDeviceId (no longer applicable)
- **Removed:** `device_id` from sync URL parameter
- **Changed:** Sync endpoint uses `entity_id` parameter instead of `device_id`
- **Updated:** Response dictionary no longer includes `device_id` and `iot_device_id` fields
- **Files Affected:** main.py (root)

#### **Azure Deployment: azure-deployment/main.py**
Applied the same 5 changes to ensure consistency across deployments:
- All fixes from root main.py replicated
- Ensures parity between production code and azure deployment

### 3. **Response Data Structure Changes**

**Before (8 fields):**
```json
{
  "customerEntityId": int,
  "customerId": int,
  "customerName": str,
  "entityId": int,
  "entityName": str,
  "entityTypeCode": str,
  "iotDeviceId": str | null,
  "active": bool
}
```

**After (7 fields):**
```json
{
  "customerEntityId": int,
  "customerId": int,
  "customerName": str,
  "entityId": int,
  "entityName": str,
  "entityTypeCode": str,
  "active": bool
}
```

**Breaking Change Alert:** 
- ❌ API responses will NOT include `iotDeviceId` field
- ✅ Clients expecting this field must be updated
- ✅ All device references now go through the Entity relationship

---

## Migration Checklist

### ✅ Completed
- [x] Updated GET /customerentities (list) endpoint
- [x] Updated GET /customerentities/{id} (single) endpoint  
- [x] Updated POST /customerentities (create) endpoint
- [x] Updated PUT /customerentities/{id} (update) endpoint
- [x] Updated POST /customerentities/{id}/sync-setup endpoint
- [x] Applied changes to root main.py
- [x] Applied changes to azure-deployment/main.py
- [x] Removed iotDeviceId from all response dictionaries
- [x] Updated all database queries (SELECT, INSERT, UPDATE)

### ⏳ Pending (Outside Scope)
- [ ] Update database schema with migration script
- [ ] Update API documentation (Swagger/OpenAPI)
- [ ] Update client applications expecting iotDeviceId
- [ ] Update API tests with new response structure
- [ ] Update frontend/UI that displays customer entities
- [ ] Update any stored procedures referencing iotDeviceId
- [ ] Database backup before applying schema changes
- [ ] Performance testing after schema change

---

## Files Modified

### Files in Root Directory (c:\VXT\):
1. **main.py** - Primary API file with all 5 endpoint fixes

### Files in Azure Deployment:
1. **azure-deployment/main.py** - Synchronized copy with same 5 endpoint fixes

**Total Files Modified:** 2

---

## Testing Recommendations

### Unit Tests to Create:
1. Test GET /customerentities returns 7-field objects (not 8)
2. Test GET /customerentities/{id} returns 7-field object
3. Test POST /customerentities creates entity without iotDeviceId
4. Test PUT /customerentities/{id} updates without iotDeviceId parameter
5. Test POST /customerentities/{id}/sync-setup uses entity_id parameter

### Integration Tests:
1. Verify sync endpoint works with new entity_id parameter
2. Test database queries execute without errors
3. Verify response structures match new schema

### Manual Testing:
1. Create a new customer entity and verify no iotDeviceId in response
2. Retrieve entities and confirm structure
3. Update an entity and confirm changes persist
4. Test sync-setup endpoint with revised parameters

---

## Rollback Strategy

If issues arise, the changes can be reverted by:

1. **Restore the original code** from version control:
   ```
   git checkout <original-commit> -- main.py azure-deployment/main.py
   ```

2. **Revert database schema** (if schema change was applied):
   ```sql
   ALTER TABLE CustomerEntities ADD COLUMN iotDeviceId nvarchar(255) NULL;
   ```

3. **Clear any cached data** and restart services

---

## Notes

- The `iotDeviceId` column concept is being replaced with a more flexible model where device relationships are established through the Entity table
- This change maintains backward compatibility at the database level (column still exists until dropped) but breaks API compatibility (field no longer returned)
- The sync-setup endpoint may need additional configuration to map entity_id to actual device IDs in your IoT platform
- Consider implementing a view or stored procedure to maintain compatibility if needed

---

## Questions & Clarifications

**Q: Where does the device/IoT device ID come from now?**
A: It's derived through the Entity relationship: `CustomerEntities.entityId → Entity.entityId`

**Q: Why remove iotDeviceId?**
A: Simplifies the data model, reduces redundancy, and ensures a single source of truth for device references.

**Q: What about existing data?**
A: The column can be dropped after applications are updated or migrated to use entity_id instead.

**Q: Is database migration included?**
A: No. SQL schema changes should follow your standard change management process.

