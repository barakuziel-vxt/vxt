-- ============================================================================
-- Azure SQL Database Schema Deployment Script
-- IoT Device ID Integration for CustomerEntities
-- ============================================================================
-- 
-- Database: free-sql-db-5949639 (vxtdb.database.windows.net)
-- 
-- INSTRUCTIONS:
-- 1. Go to https://portal.azure.com
-- 2. Navigate to your SQL Database: free-sql-db-5949639
-- 3. Open Query Editor (SQL Query Editor)
-- 4. Copy and paste the entire content below
-- 5. Click "Run" to execute
-- 
-- ============================================================================

-- Step 1: Add iotDeviceId column if it doesn't exist
-- ============================================================================

IF NOT EXISTS (
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CustomerEntities' AND COLUMN_NAME = 'iotDeviceId'
)
BEGIN
    ALTER TABLE CustomerEntities
    ADD iotDeviceId NVARCHAR(128) NULL;
    
    PRINT '[✓] Added iotDeviceId column to CustomerEntities';
END
ELSE
BEGIN
    PRINT '[✓] iotDeviceId column already exists';
END
GO

-- Step 2: Populate device IDs for entities
-- ============================================================================

DECLARE @updates INT = 0;

UPDATE CustomerEntities
SET iotDeviceId = CASE 
    WHEN entityId = '033114869' THEN 'vessel-033114869'
    WHEN entityId = '234567890' THEN 'TomerRefael'
    WHEN entityId = '234567891' THEN 'vessel-234567891'
    ELSE 'device-' + entityId
END
WHERE iotDeviceId IS NULL;

SET @updates = @@ROWCOUNT;

PRINT '[✓] Updated ' + CAST(@updates AS VARCHAR(10)) + ' records with device IDs';
GO

-- Step 3: Verification - Display all entities
-- ============================================================================

PRINT '';
PRINT '[VERIFICATION] Current entity assignments with device IDs:';
PRINT '================================================================';

SELECT 
    customerEntityId AS 'ID',
    entityId AS 'Entity ID',
    iotDeviceId AS 'IoT Device ID',
    CASE WHEN active = 'Y' THEN 'Active' ELSE 'Inactive' END AS 'Status'
FROM CustomerEntities
ORDER BY customerEntityId;

GO

-- Step 4: Summary
-- ============================================================================

SELECT 
    COUNT(*) AS 'Total Entities',
    SUM(CASE WHEN iotDeviceId IS NOT NULL THEN 1 ELSE 0 END) AS 'With Device IDs',
    SUM(CASE WHEN iotDeviceId IS NULL THEN 1 ELSE 0 END) AS 'Without Device IDs'
FROM CustomerEntities;

PRINT '';
PRINT '[SUCCESS] Azure SQL Database deployment complete! ✓';
PRINT '=================================================================';
GO

-- ============================================================================
-- DONE! The schema changes are now deployed to Azure SQL Database
-- ============================================================================
