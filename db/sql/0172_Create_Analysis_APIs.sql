-- Create TSQL APIs for Python worker to call
-- These procedures provide data and logging services for Python-based analysis
-- NOTE: sp_RegisterEvent is created separately in 0171_Create_RegisterEvent_API.sql (must execute first)

-- API 1: Get subscription details with event criteria
DROP PROCEDURE IF EXISTS dbo.sp_GetSubscriptionDetails;
GO

CREATE PROCEDURE dbo.sp_GetSubscriptionDetails
    @customerSubscriptionId INT = NULL,   -- Optional: get specific subscription
    @entityId NVARCHAR(50) = NULL,        -- Optional: get subscriptions for entity
    @onlyActive BIT = 1                   -- Return only active subscriptions
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        cs.customerSubscriptionId,
        cs.customerId,
        c.customerName,
        cs.entityId,
        et.entityTypeName as entityType,
        e.eventId,
        e.eventCode,
        e.eventDescription,
        e.minCumulatedScore,
        e.maxCumulatedScore,
        e.risk,
        af.AnalyzeFunctionId,
        af.FunctionName,
        af.FunctionType,
        af.AnalyzePath,
        e.CustomParams as EventParams,
        cs.subscriptionStartDate,
        cs.subscriptionEndDate
    FROM dbo.CustomerSubscriptions cs
    JOIN dbo.Customers c ON cs.customerId = c.customerId
    JOIN dbo.Entity ent ON cs.entityId = ent.entityId
    JOIN dbo.EntityType et ON ent.entityTypeId = et.entityTypeId
    JOIN dbo.Event e ON cs.eventId = e.eventId
    LEFT JOIN dbo.AnalyzeFunction af ON e.AnalyzeFunctionId = af.AnalyzeFunctionId
    WHERE (@customerSubscriptionId IS NULL OR cs.customerSubscriptionId = @customerSubscriptionId)
        AND (@entityId IS NULL OR cs.entityId = @entityId)
        AND (@onlyActive = 0 OR (
            cs.active = 'Y'
            AND c.active = 'Y'
            AND ent.active = 'Y'
            AND e.active = 'Y'
            AND cs.subscriptionStartDate <= GETDATE()
            AND (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
        ))
    ORDER BY cs.customerSubscriptionId;
END;
GO

-- API 2: Get event criteria (attributes to check)
DROP PROCEDURE IF EXISTS dbo.sp_GetEventCriteria;
GO

CREATE PROCEDURE dbo.sp_GetEventCriteria
    @eventId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        ea.eventId,
        ea.entityTypeAttributeId,
        eta.entityTypeAttributeCode,
        eta.entityTypeAttributeName,
        eta.entityTypeAttributeUnit,
        etas.entityTypeAttributeScoreId,
        etas.Score,
        etas.MinValue,
        etas.MaxValue
    FROM dbo.EventAttribute ea
    JOIN dbo.EntityTypeAttribute eta ON ea.entityTypeAttributeId = eta.entityTypeAttributeId
    LEFT JOIN dbo.EntityTypeAttributeScore etas ON eta.entityTypeAttributeId = etas.EntityTypeAttributeId
    WHERE ea.eventId = @eventId
        AND ea.active = 'Y'
        AND eta.active = 'Y'
    ORDER BY eta.entityTypeAttributeCode;
END;
GO

-- API 3: Get entity telemetry within time window
DROP PROCEDURE IF EXISTS dbo.sp_GetEntityTelemetryData;
GO

CREATE PROCEDURE dbo.sp_GetEntityTelemetryData
    @entityId NVARCHAR(50),
    @triggeredAt DATETIME = NULL,
    @analysisWindowInMin INT = 5,
    @entityTypeAttributeId INT = NULL   -- Optional: get specific attribute
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @WindowEnd DATETIME = COALESCE(@triggeredAt, GETDATE());
    DECLARE @WindowStart DATETIME = DATEADD(MINUTE, -@analysisWindowInMin, @WindowEnd);
    
    SELECT 
        et.entityTelemetryId,
        et.entityId,
        et.entityTypeAttributeId,
        eta.entityTypeAttributeCode,
        et.numericValue,
        et.stringValue,
        et.latitude,
        et.longitude,
        et.startTimestampUTC,
        et.endTimestampUTC
    FROM dbo.EntityTelemetry et
    JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
    WHERE et.entityId = @entityId
        AND et.endTimestampUTC >= @WindowStart
        AND et.endTimestampUTC <= @WindowEnd
        AND (@entityTypeAttributeId IS NULL OR et.entityTypeAttributeId = @entityTypeAttributeId)
    ORDER BY et.endTimestampUTC DESC, eta.entityTypeAttributeCode;
END;
GO

