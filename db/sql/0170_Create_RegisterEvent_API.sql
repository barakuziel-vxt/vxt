-- Register Event API - Unified API for both TSQL and Python to record detected events
-- This must be created BEFORE sp_ExecuteActiveSubscriptionAnalysis (which calls it)

DROP PROCEDURE IF EXISTS dbo.sp_RegisterEvent;
GO

CREATE PROCEDURE dbo.sp_RegisterEvent
    @entityId NVARCHAR(50),
    @eventId INT,
    @cumulativeScore INT,
    @probability DECIMAL(3, 2) = 0.50,
    @triggeredAt DATETIME = NULL,
    @analysisWindowInMin INT = 5,
    @processingTimeMs INT = NULL,
    @detailsJson NVARCHAR(MAX) = NULL,  -- JSON array of attribute details
    @eventLogId BIGINT OUTPUT  -- Returns the ID of the registered event
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        DECLARE @TriggeredAt_Actual DATETIME = COALESCE(@triggeredAt, GETDATE());
        
        -- Step 1: Insert into EventLog (lean schema - minimal columns)
        INSERT INTO dbo.EventLog (
            entityId,
            eventId,
            cumulativeScore,
            probability,
            triggeredAt,
            AnalysisWindowInMin,
            processingTimeMs
        )
        VALUES (
            @entityId,
            @eventId,
            @cumulativeScore,
            @probability,
            @TriggeredAt_Actual,
            @analysisWindowInMin,
            @processingTimeMs
        );
        
        SET @eventLogId = SCOPE_IDENTITY();
        
        -- Step 2: Insert detailed attribute results if provided
        IF @detailsJson IS NOT NULL AND LEN(@detailsJson) > 0
        BEGIN
            -- Parse JSON and insert into EventLogDetails
            -- JSON format: [{"entityTypeAttributeId": 1, "entityTelemetryId": 100, "scoreContribution": 10, "withinRange": "Y"}, ...]
            INSERT INTO dbo.EventLogDetails (
                eventLogId,
                entityTypeAttributeId,
                entityTelemetryId,
                scoreContribution,
                withinRange
            )
            SELECT 
                @eventLogId,
                JSON_VALUE(value, '$.entityTypeAttributeId') AS entityTypeAttributeId,
                JSON_VALUE(value, '$.entityTelemetryId') AS entityTelemetryId,
                JSON_VALUE(value, '$.scoreContribution') AS scoreContribution,
                JSON_VALUE(value, '$.withinRange') AS withinRange
            FROM OPENJSON(@detailsJson) AS details;
        END;
        
        -- Return the eventLogId via OUTPUT parameter
        PRINT 'Event registered: entity=' + @entityId + ', event=' + CAST(@eventId AS NVARCHAR(10)) + 
              ', score=' + CAST(@cumulativeScore AS NVARCHAR(10)) + ', eventLogId=' + CAST(@eventLogId AS NVARCHAR(20));
        
    END TRY
    BEGIN CATCH
        PRINT 'Error in sp_RegisterEvent: ' + ERROR_MESSAGE();
        SET @eventLogId = -1;
    END CATCH;
END;
GO
