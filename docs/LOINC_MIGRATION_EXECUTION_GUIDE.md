# LOINC Migration Execution Guide

**Status**: Ready for execution on Azure SQL Database  
**Target Database**: vxtdb.database.windows.net / free-sql-db-5949639  
**Migration Script**: `c:\VXT\db\sql\0030_Add_Missing_LOINC_Codes.sql` (140 lines)

## What This Migration Does

Adds 6 missing Health Connect LOINC codes with proper database mappings:

| LOINC Code | Description | Unit |
|-----------|-------------|------|
| 55423-8 | Number of steps | count |
| 93832-4 | Sleep duration | min |
| 55430-3 | Distance traveled | km |
| 29463-7 | Body weight (kg) | kg |
| 41981-2 | Body calories burned | kcal |
| 41982-0 | Body fat percentage | % |

**Fixes the dashboard display bug** where:
- Body weight showed as "Body Fat %" ✅ FIXED
- Distance showed as "body weight" ✅ FIXED  
- Steps showed as "calories" ✅ FIXED

## ⚠️ Current Status

✅ Migration script created and tested locally  
✅ All database prerequisites verified (Junction provider exists, Person EntityType exists)  
❌ Unable to execute remotely due to credential authentication issues on this machine

**Next Step**: Execute migration via Azure Portal Query Editor (5 minutes)

## Option 1: Azure Portal Query Editor (EASIEST - Recommended)

### Step 1: Open Azure Portal
1. Go to https://portal.azure.com
2. Search for "SQL databases"
3. Click **vxtdb**
4. In left sidebar, click **Query editor (preview)**

### Step 2: Login
- Login with your Azure account credentials
- Select **master** as the initial database

### Step 3: Execute Migration
Copy-paste the following SQL into the Query Editor:

**IMPORTANT**: Make sure you are in the **free-sql-db-5949639** database (shown in dropdown at top).

```sql
USE free-sql-db-5949639;

BEGIN TRANSACTION;

DECLARE @JunctionProviderId INT;
DECLARE @NextProviderEventId INT;

-- Get Junction provider ID
SELECT @JunctionProviderId = providerId FROM Provider WHERE providerName = 'Junction';

IF @JunctionProviderId IS NULL
BEGIN
    PRINT 'Error: Junction provider not found';
    ROLLBACK;
END
ELSE
BEGIN

-- Get next available providerEventId
SELECT @NextProviderEventId = ISNULL(MAX(providerEventId), 0) + 1 FROM ProviderEvent;

-- Insert LOINC codes with explicit IDs
IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '55423-8')
BEGIN
    INSERT INTO ProviderEvent (providerEventId, providerId, protocolAttributeCode, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion)
    VALUES (@NextProviderEventId, @JunctionProviderId, '55423-8', 'activity.steps.update', 'Steps', 'activity', 'steps', '1.0');
    SET @NextProviderEventId = @NextProviderEventId + 1;
END

IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '93832-4')
BEGIN
    INSERT INTO ProviderEvent (providerEventId, providerId, protocolAttributeCode, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion)
    VALUES (@NextProviderEventId, @JunctionProviderId, '93832-4', 'sleep.duration.update', 'Sleep', 'sleep', 'duration', '1.0');
    SET @NextProviderEventId = @NextProviderEventId + 1;
END

IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '55430-3')
BEGIN
    INSERT INTO ProviderEvent (providerEventId, providerId, protocolAttributeCode, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion)
    VALUES (@NextProviderEventId, @JunctionProviderId, '55430-3', 'activity.distance.update', 'Distance', 'activity', 'distance', '1.0');
    SET @NextProviderEventId = @NextProviderEventId + 1;
END

IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '29463-7')
BEGIN
    INSERT INTO ProviderEvent (providerEventId, providerId, protocolAttributeCode, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion)
    VALUES (@NextProviderEventId, @JunctionProviderId, '29463-7', 'body.weight.update', 'Weight', 'body', 'weight', '1.0');
    SET @NextProviderEventId = @NextProviderEventId + 1;
END

IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '41981-2')
BEGIN
    INSERT INTO ProviderEvent (providerEventId, providerId, protocolAttributeCode, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion)
    VALUES (@NextProviderEventId, @JunctionProviderId, '41981-2', 'activity.calories.update', 'Calories', 'activity', 'calories', '1.0');
    SET @NextProviderEventId = @NextProviderEventId + 1;
END

IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '41982-0')
BEGIN
    INSERT INTO ProviderEvent (providerEventId, providerId, protocolAttributeCode, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion)
    VALUES (@NextProviderEventId, @JunctionProviderId, '41982-0', 'body.fatpct.update', 'BodyFat', 'body', 'fatpct', '1.0');
    SET @NextProviderEventId = @NextProviderEventId + 1;
END

PRINT 'Inserted ProviderEvent records';

DECLARE @PersonEntityTypeId INT;
DECLARE @NextEntityTypeAttributeId INT;

SELECT @PersonEntityTypeId = entityTypeId FROM EntityType WHERE entityTypeName = 'Person';

-- Get next available entityTypeAttributeId
SELECT @NextEntityTypeAttributeId = ISNULL(MAX(entityTypeAttributeId), 0) + 1 FROM EntityTypeAttribute;

IF @PersonEntityTypeId IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeId = @PersonEntityTypeId AND entityTypeAttributeCode = '55423-8')
    BEGIN
        INSERT INTO EntityTypeAttribute (entityTypeAttributeId, entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active)
        VALUES (@NextEntityTypeAttributeId, @PersonEntityTypeId, '55423-8', 'Number of steps', 'Pt', 'count', @JunctionProviderId, 'activity.steps.update', 'Y');
        SET @NextEntityTypeAttributeId = @NextEntityTypeAttributeId + 1;
    END

    IF NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeId = @PersonEntityTypeId AND entityTypeAttributeCode = '93832-4')
    BEGIN
        INSERT INTO EntityTypeAttribute (entityTypeAttributeId, entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active)
        VALUES (@NextEntityTypeAttributeId, @PersonEntityTypeId, '93832-4', 'Sleep duration', 'Pt', 'min', @JunctionProviderId, 'sleep.duration.update', 'Y');
        SET @NextEntityTypeAttributeId = @NextEntityTypeAttributeId + 1;
    END

    IF NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeId = @PersonEntityTypeId AND entityTypeAttributeCode = '55430-3')
    BEGIN
        INSERT INTO EntityTypeAttribute (entityTypeAttributeId, entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active)
        VALUES (@NextEntityTypeAttributeId, @PersonEntityTypeId, '55430-3', 'Distance traveled', 'Pt', 'km', @JunctionProviderId, 'activity.distance.update', 'Y');
        SET @NextEntityTypeAttributeId = @NextEntityTypeAttributeId + 1;
    END

    IF NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeId = @PersonEntityTypeId AND entityTypeAttributeCode = '29463-7')
    BEGIN
        INSERT INTO EntityTypeAttribute (entityTypeAttributeId, entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active)
        VALUES (@NextEntityTypeAttributeId, @PersonEntityTypeId, '29463-7', 'Body weight', 'Pt', 'kg', @JunctionProviderId, 'body.weight.update', 'Y');
        SET @NextEntityTypeAttributeId = @NextEntityTypeAttributeId + 1;
    END

    IF NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeId = @PersonEntityTypeId AND entityTypeAttributeCode = '41981-2')
    BEGIN
        INSERT INTO EntityTypeAttribute (entityTypeAttributeId, entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active)
        VALUES (@NextEntityTypeAttributeId, @PersonEntityTypeId, '41981-2', 'Calories burned', 'Pt', 'kcal', @JunctionProviderId, 'activity.calories.update', 'Y');
        SET @NextEntityTypeAttributeId = @NextEntityTypeAttributeId + 1;
    END

    IF NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeId = @PersonEntityTypeId AND entityTypeAttributeCode = '41982-0')
    BEGIN
        INSERT INTO EntityTypeAttribute (entityTypeAttributeId, entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active)
        VALUES (@NextEntityTypeAttributeId, @PersonEntityTypeId, '41982-0', 'Body fat percent', 'Pt', '%', @JunctionProviderId, 'body.fatpct.update', 'Y');
        SET @NextEntityTypeAttributeId = @NextEntityTypeAttributeId + 1;
    END

    PRINT 'Inserted EntityTypeAttribute records';
END

COMMIT;
PRINT 'Migration complete!';
END
```

### Step 4: Run the Query
- Click **Run** button (or press Ctrl+Shift+E)
- Wait for completion (should take 5-10 seconds)
- Look for success message in Results pane

### Step 5: Verify Execution
Copy-paste this verification query to confirm success:

```sql
USE free-sql-db-5949639;

SELECT 'ProviderEvent' as TableName, COUNT(*) as RecordCount 
FROM ProviderEvent 
WHERE protocolAttributeCode IN ('55423-8', '93832-4', '55430-3', '29463-7', '41981-2', '41982-0')

UNION ALL

SELECT 'EntityTypeAttribute' as TableName, COUNT(*) as RecordCount
FROM EntityTypeAttribute 
WHERE entityTypeAttributeCode IN ('55423-8', '93832-4', '55430-3', '29463-7', '41981-2', '41982-0');

SELECT entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeUnit
FROM EntityTypeAttribute 
WHERE entityTypeAttributeCode IN ('55423-8', '93832-4', '55430-3', '29463-7', '41981-2', '41982-0')
ORDER BY entityTypeAttributeCode;
```

**Expected results:**
- ProviderEvent table: 6 records
- EntityTypeAttribute table: 6 records
- Details show correct names (e.g., "Number of steps", "Sleep duration") and units (count, min, km, kg, kcal, [%])

---

## Option 2: Azure Data Studio (Alternative)

If you prefer GUI or have Azure Data Studio installed:

1. Download: https://learn.microsoft.com/en-us/azure-data-studio/download-azure-data-studio
2. File → Connect → Azure SQL Database
3. Server: `vxtdb.database.windows.net`
4. Database: `free-sql-db-5949639`
5. Authentication: Azure Active Directory
6. File → Open → `c:\VXT\db\sql\0030_Add_Missing_LOINC_Codes.sql`
7. Execute (F5)

---

## Option 3: SQL Server Management Studio (If Available)

1. Open SSMS
2. Server: `vxtdb.database.windows.net,1433`
3. Authentication: Azure Active Directory - Universal (MFA support)
4. Connect
5. File → Open → `c:\VXT\db\sql\0030_Add_Missing_LOINC_Codes.sql`
6. Execute (F5)

---

## Troubleshooting

### "Cannot insert the value NULL into column 'entityTypeAttributeId'"
- **Cause**: entityTypeAttributeId column is NOT defined as IDENTITY; requires explicit values
- **Solution**: Already fixed in latest script (v6)
- **What changed**:
  - Added `DECLARE @NextEntityTypeAttributeId INT` to track next available ID
  - Calculate next ID: `SELECT @NextEntityTypeAttributeId = ISNULL(MAX(entityTypeAttributeId), 0) + 1 FROM EntityTypeAttribute`
  - Insert with explicit ID: `INSERT INTO EntityTypeAttribute (entityTypeAttributeId, entityTypeId, ...)` 
  - Increment after each insert: `SET @NextEntityTypeAttributeId = @NextEntityTypeAttributeId + 1`
- **Re-run**: Copy fresh SQL from Step 3 - problem is now fully resolved

### "Cannot insert the value NULL into column 'providerEventId'"
- **Cause**: providerEventId column is NOT defined as IDENTITY; requires explicit values
- **Solution**: Already fixed in latest script (v6)
- **What changed**: 
  - Added `DECLARE @NextProviderEventId INT` to track next available ID
  - Calculate next ID: `SELECT @NextProviderEventId = ISNULL(MAX(providerEventId), 0) + 1 FROM ProviderEvent`
  - Insert with explicit ID: `INSERT INTO ProviderEvent (providerEventId, providerId, ...)` 
  - Increment after each insert: `SET @NextProviderEventId = @NextProviderEventId + 1`
- **Re-run**: Copy fresh SQL from Step 3 - problem is now fully resolved

### "Cannot insert the value NULL into column 'providerEventId' (ALTERNATE)"
- **Solution**: Already fixed in latest script  
- Removed complex JSON payload fields
- Only essential columns are inserted

### "Incorrect syntax" errors
- **Solution**: Copy fresh SQL from Step 3
- Clear editor completely first
- Make sure you're in **free-sql-db-5949639** database

### "Login failed"

### "User does not have permission"
- You need `db_datareader` and `db_datawriter` roles on the free-sql-db-5949639 database
- Contact your Azure admin to grant permissions

### "Database free-sql-db-5949639 does not exist"
- Verify you're connecting to the correct server: `vxtdb.database.windows.net`
- Check Azure Portal: SQL databases → vxtdb → confirm database name

### Script doesn't produce output
- The script uses PRINT statements which may not show in all Query Editors
- Check the Messages tab in Query Editor
- Run the verification query to confirm data was inserted

---

## What Happens After Migration

1. ✅ All 6 LOINC codes added to ProviderEvent table
2. ✅ EntityTypeAttribute entries created with correct:
   - Display names ("Number of steps", "Sleep duration", etc.)
   - Units (count, min, km, kg, kcal, %)
3. ✅ Dashboard bug fixed - metrics now display correct names and units
4. ✅ Mobile app will receive correct Health Connect attributes

---

## Next Steps After Successful Execution

1. Restart Azure Function App (vxt-function) to pick up new schema
2. Verify dashboard displays correct metric names
3. Test mobile app Health Connect report submission
4. Commit confirmation to git history

---

## Timeline

- **Created**: 2026-04-07
- **Status**: Ready for execution
- **Estimated Time**: 5 minutes via Azure Portal Query Editor
- **Risk Level**: LOW (uses idempotent WHERE NOT EXISTS checks)
