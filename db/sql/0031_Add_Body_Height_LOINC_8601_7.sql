-- Add Body Height LOINC code (8601-7) for Health Connect integration
-- LOINC 8601-7 = Body height (in the standing position)
-- PREREQUISITE MIGRATIONS (must be run first):
--   0002_Create_Provider_table.sql
--   0006_create_ProviderEvent_table.sql 
--   0025_Create_EntityTypeAttribute_table.sql

IF OBJECT_ID('dbo.Provider', 'U') IS NULL
BEGIN
    RAISERROR('Migration 0031 prerequisites not met. The Provider table does not exist.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

DECLARE @JunctionProviderId INT;
SELECT @JunctionProviderId = providerId FROM Provider WHERE providerName = 'Junction';

IF @JunctionProviderId IS NULL
BEGIN
    PRINT 'Error: Junction provider not found';
    ROLLBACK;
END
ELSE
BEGIN
    -- 1. Add Body Height event to ProviderEvent table (8601-7)
    IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '8601-7')
    BEGIN
        INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
        VALUES (@JunctionProviderId, 'body.height.update', 'Measures the body height from head to feet (in standing position)', 'body', 'height', '1.0', '8601-7',
            N'{"type":"object","properties":{"height":{"type":"number","description":"Body height in cm"},"unit":{"type":"string","enum":["cm","in"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
            N'["height","unit","timestamp"]');
        PRINT 'Inserted: Body height (8601-7) to ProviderEvent';
    END
    
    -- 2. Add Body Height attribute to EntityTypeAttribute table (Person entity, Protocol 1)
    IF NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '8601-7' AND entityTypeId = 1)
    BEGIN
        INSERT INTO EntityTypeAttribute (entityTypeId, protocolId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active, createDate, lastUpdateTimestamp, lastUpdateUser, defaultInGraph)
        VALUES (1, 1, '8601-7', 'Height', 'Pt', 'cm', @JunctionProviderId, 'body.height.update', 'Y', CAST(GETDATE() AS DATETIME2), CAST(GETDATE() AS DATETIME2), 'sa', 'Y');
        PRINT 'Inserted: Body height (8601-7) to EntityTypeAttribute';
    END
    
    COMMIT;
    PRINT 'Migration 0031 completed successfully: Body Height (8601-7) added.';
END

GO
