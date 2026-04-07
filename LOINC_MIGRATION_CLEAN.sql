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
