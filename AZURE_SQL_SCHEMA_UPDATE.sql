-- YachtSense AI - SQL Schema Update
-- Copy and paste this into Azure Portal > SQL Database > Query Editor

-- Add iotDeviceId column to CustomerEntities table
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CustomerEntities' AND COLUMN_NAME = 'iotDeviceId'
)
BEGIN
    ALTER TABLE CustomerEntities
    ADD iotDeviceId NVARCHAR(128) NULL;
    
    PRINT 'Column iotDeviceId added to CustomerEntities table';
END
ELSE
BEGIN
    PRINT 'Column iotDeviceId already exists';
END

-- Populate device IDs for existing entities
UPDATE CustomerEntities
SET iotDeviceId = CASE 
    WHEN entityId = '033114869' THEN 'vessel-033114869'
    WHEN entityId = '234567890' THEN 'TomerRefael'
    WHEN entityId = '234567891' THEN 'vessel-234567891'
    WHEN entityId = '234567892' THEN 'vessel-234567892'
    WHEN entityId = '234567893' THEN 'vessel-234567893'
    ELSE NULL
END
WHERE iotDeviceId IS NULL AND entityId IN (
    '033114869', '234567890', '234567891', '234567892', '234567893'
);

PRINT 'Device IDs populated';

-- Verify the changes
SELECT 
    entityId,
    entityName,
    iotDeviceId,
    createdAt
FROM CustomerEntities
WHERE iotDeviceId IS NOT NULL
ORDER BY entityId;

-- Summary statistics
SELECT 
    COUNT(DISTINCT entityId) AS TotalEntities,
    SUM(CASE WHEN iotDeviceId IS NOT NULL THEN 1 ELSE 0 END) AS EntitiesWithDeviceIDs,
    SUM(CASE WHEN iotDeviceId IS NULL THEN 1 ELSE 0 END) AS EntitiesWithoutDeviceIDs
FROM CustomerEntities;
