-- Migration 0030: Add Health Connect LOINC Codes for Activity and Body Metrics
-- LOINC (Logical Observation Identifiers Names & Codes) integration
-- For Health Connect integration with Android Health Platform
--
-- PREREQUISITE MIGRATIONS (must be run first):
--   0002_Create_Provider_table.sql
--   0006_create_ProviderEvent_table.sql 
--   0025_Create_EntityTypeAttribute_table.sql
--
-- LOINC Codes being added:
--   55423-8 (Number of steps)
--   93832-4 (Sleep duration)
--   55430-3 (Distance traveled)
--   29463-7 (Body weight)
--   41982-0 (Percentage of body fat)
--
-- Design Notes:
-- - Maintains idempotent behavior: Can be run multiple times safely
-- - Follows Health Connect standard LOINC code assignments
-- - Integrates with both ProviderEvent and EntityTypeAttribute tables
-- - Ensures consistency between provider events and entity type attributes

IF OBJECT_ID('dbo.Provider', 'U') IS NULL
BEGIN
    RAISERROR('Migration 0030 prerequisites not met. The Provider table does not exist. Please run migrations 0002-0025 first.', 16, 1);
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
    -- 1. Number of steps (55423-8)
    IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '55423-8')
    BEGIN
        INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
        VALUES (@JunctionProviderId, 'activity.steps.update', 'Tracks the total count of steps taken, typically measured via a pedometer or accelerometer', 'activity', 'steps', '1.0', '55423-8',
            N'{"type":"object","properties":{"steps":{"type":"number","description":"Total number of steps"},"unit":{"type":"string","enum":["count"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
            N'["steps","timestamp"]');
        PRINT 'Inserted: Number of steps (55423-8)';
    END
    
    -- 2. Sleep duration (93832-4)
    IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '93832-4')
    BEGIN
        INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
        VALUES (@JunctionProviderId, 'sleep.duration.update', 'Measures the total amount of time spent sleeping in a specific period (e.g., nightly sleep)', 'sleep', 'duration', '1.0', '93832-4',
            N'{"type":"object","properties":{"sleepDuration":{"type":"number","description":"Sleep duration in minutes"},"unit":{"type":"string","enum":["min"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
            N'["sleepDuration","timestamp"]');
        PRINT 'Inserted: Sleep duration (93832-4)';
    END
    
    -- 3. Distance traveled (55430-3)
    IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '55430-3')
    BEGIN
        INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
        VALUES (@JunctionProviderId, 'activity.distance.update', 'Tracks the physical distance covered (e.g., in meters or miles) during walking, running, or cycling', 'activity', 'distance', '1.0', '55430-3',
            N'{"type":"object","properties":{"distance":{"type":"number","description":"Distance traveled"},"unit":{"type":"string","enum":["m","km","mi"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
            N'["distance","unit","timestamp"]');
        PRINT 'Inserted: Distance traveled (55430-3)';
    END
    
    -- 4. Body weight (29463-7)
    IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '29463-7')
    BEGIN
        INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
        VALUES (@JunctionProviderId, 'body.weight.update', 'A standard clinical code for measuring total patient body mass', 'body', 'weight', '1.0', '29463-7',
            N'{"type":"object","properties":{"weight":{"type":"number","description":"Body weight"},"unit":{"type":"string","enum":["kg","lbs"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
            N'["weight","unit","timestamp"]');
        PRINT 'Inserted: Body weight (29463-7)';
    END
    
    -- 5. Percentage of body fat (41982-0)
    IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND protocolAttributeCode = '41982-0')
    BEGIN
        INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
        VALUES (@JunctionProviderId, 'body.fat_percentage.update', 'Percentage of body fat', 'body', 'fat_percentage', '1.0', '41982-0',
            N'{"type":"object","properties":{"bodyFatPercentage":{"type":"number","description":"Body fat percentage","minimum":0,"maximum":100},"unit":{"type":"string","enum":["%"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
            N'["bodyFatPercentage","timestamp"]');
        PRINT 'Inserted: Percentage of body fat (41982-0)';
    END
    
    -- Now insert the corresponding EntityTypeAttribute entries for 'Person' type
    DECLARE @PersonEntityTypeId INT;
    SELECT @PersonEntityTypeId = entityTypeId FROM EntityType WHERE entityTypeName = 'Person';
    
    IF @PersonEntityTypeId IS NOT NULL
    BEGIN
        -- Insert missing LOINC codes as entity type attributes
        INSERT INTO EntityTypeAttribute (entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active)
        SELECT 
            @PersonEntityTypeId,
            pe.protocolAttributeCode,
            CASE 
                WHEN pe.protocolAttributeCode = '55423-8' THEN 'Number of steps'
                WHEN pe.protocolAttributeCode = '93832-4' THEN 'Sleep duration'
                WHEN pe.protocolAttributeCode = '55430-3' THEN 'Distance traveled'
                WHEN pe.protocolAttributeCode = '29463-7' THEN 'Body weight'
                WHEN pe.protocolAttributeCode = '41982-0' THEN 'Percentage of body fat'
                ELSE REPLACE(REPLACE(pe.providerEventName, '_', ' '), 'activity.', '')
            END,
            'Pt',
            CASE 
                WHEN pe.protocolAttributeCode = '55423-8' THEN 'count'
                WHEN pe.protocolAttributeCode = '93832-4' THEN 'min'
                WHEN pe.protocolAttributeCode = '55430-3' THEN 'm'
                WHEN pe.protocolAttributeCode = '29463-7' THEN 'kg'
                WHEN pe.protocolAttributeCode = '41982-0' THEN '%'
                ELSE ''
            END,
            @JunctionProviderId,
            pe.providerEventType,
            'Y'
        FROM ProviderEvent pe
        WHERE pe.providerId = @JunctionProviderId
          AND pe.protocolAttributeCode IN ('55423-8', '93832-4', '55430-3', '29463-7', '41982-0')
          AND NOT EXISTS (
              SELECT 1 FROM EntityTypeAttribute eta
              WHERE eta.entityTypeId = @PersonEntityTypeId
                AND eta.entityTypeAttributeCode = pe.protocolAttributeCode
          );
        
        PRINT 'Inserted/updated EntityTypeAttribute entries';
    END
    ELSE
    BEGIN
        PRINT 'Warning: Person EntityType not found';
    END
    
    COMMIT;
    PRINT '✅ Migration complete: Added 5 LOINC codes for Health Connect integration';
END
