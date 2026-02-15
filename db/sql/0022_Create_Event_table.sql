-- Create Events table
-- Tracks event types that can be associated with entity categories

DROP TABLE IF EXISTS Event;

CREATE TABLE Event (
    eventId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    eventCode NVARCHAR(50) NOT NULL UNIQUE,
    eventDescription NVARCHAR(200) NOT NULL,
    entityTypeId INT NOT NULL CONSTRAINT FK_Event_EntityType FOREIGN KEY REFERENCES EntityType(entityTypeId),
    minCumulatedScore INT NULL DEFAULT 0,
    maxCumulatedScore INT NULL DEFAULT 100,
    risk NVARCHAR(50) NOT NULL DEFAULT 'NONE',
    AnalyzeFunctionId INT NULL CONSTRAINT FK_Event_AnalyzeFunction FOREIGN KEY REFERENCES AnalyzeFunction(AnalyzeFunctionId),
    LookbackMinutes INT NULL,           -- How far back to pull data (e.g., 360 for 6h)
    BaselineDays INT NULL,              -- Number of past days to use for baseline calculations / Normal state (e.g., 30)
    SensitivityThreshold FLOAT NULL,    -- Threshold for sensitivity analysis (0.0 to 1.0)
    MinSamplesRequired INT NULL,        -- Minimum number of samples required for analysis - Don't analyze if there isn't enough data
    CustomParams NVARCHAR(MAX) NULL,    -- Optional JSON for function-specific tweaks for specific events
    AggregationType NVARCHAR(50) NULL,  -- e.g., 'SUM', 'AVG', 'MAX' for how to aggregate multiple protocol attributes into this event
    AnomalyDirection NVARCHAR(20) NULL, -- e.g., 'UP', 'DOWN', 'BOTH' for which direction(s) of deviation from normal should trigger this event
    -- control columns
    active CHAR(1) NOT NULL CONSTRAINT DF_Event_active DEFAULT ('Y'),
    createDate DATETIME NOT NULL CONSTRAINT DF_Event_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_Event_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser NVARCHAR(128) NOT NULL CONSTRAINT DF_Event_lastUpdateUser DEFAULT (SUSER_SNAME())
);


-- Trigger to maintain lastUpdate fields
IF OBJECT_ID('TRG_Event_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_Event_UpdateTimestamp;
GO

CREATE TRIGGER TRG_Event_UpdateTimestamp
ON Event
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE e
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM Event e
    INNER JOIN inserted i ON e.eventCode = i.eventCode;
END;
GO

-- Seed additional NEWS events (idempotent)
IF OBJECT_ID('Event','U') IS NOT NULL
BEGIN
    DECLARE @PersonEntityTypeId INT;
    SELECT @PersonEntityTypeId = entityTypeId FROM EntityType WHERE entityTypeName = 'Person';
    
    IF @PersonEntityTypeId IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM Event WHERE eventCode = 'NEWSTemperatureLowMedium')
            INSERT INTO Event (eventCode, eventDescription, entityTypeId, minCumulatedScore, risk) 
            VALUES ('NEWSTemperatureLowMedium', 'NEWS: Body temperature concern', @PersonEntityTypeId, 3, 'MEDIUM');

        IF NOT EXISTS (SELECT 1 FROM Event WHERE eventCode = 'NEWSSystolicBloodPressureLowMedium')
            INSERT INTO Event (eventCode, eventDescription, entityTypeId, minCumulatedScore, risk) 
            VALUES ('NEWSSystolicBloodPressureLowMedium', 'NEWS: Systolic blood pressure concern', @PersonEntityTypeId, 3, 'MEDIUM');

        IF NOT EXISTS (SELECT 1 FROM Event WHERE eventCode = 'NEWSRespirationRatePerMinLowMedium')
            INSERT INTO Event (eventCode, eventDescription, entityTypeId, minCumulatedScore, risk) 
            VALUES ('NEWSRespirationRatePerMinLowMedium', 'NEWS: Respiration rate (per min) concern', @PersonEntityTypeId, 3, 'MEDIUM');

        IF NOT EXISTS (SELECT 1 FROM Event WHERE eventCode = 'NEWSSpO2Scale1LowMedium')
            INSERT INTO Event (eventCode, eventDescription, entityTypeId, minCumulatedScore, risk) 
            VALUES ('NEWSSpO2Scale1LowMedium', 'NEWS: SpO2 (scale 1) concern', @PersonEntityTypeId, 3, 'MEDIUM');

        IF NOT EXISTS (SELECT 1 FROM Event WHERE eventCode = 'NEWSPulsePerMinLowMedium')
            INSERT INTO Event (eventCode, eventDescription, entityTypeId, minCumulatedScore, risk) 
            VALUES ('NEWSPulsePerMinLowMedium', 'NEWS: Pulse rate (per min) concern', @PersonEntityTypeId, 3, 'MEDIUM');

        IF NOT EXISTS (SELECT 1 FROM Event WHERE eventCode = 'NEWSAggregateMedium')
            INSERT INTO Event (eventCode, eventDescription, entityTypeId, minCumulatedScore, maxCumulatedScore, risk) 
            VALUES ('NEWSAggregateMedium', 'NEWS: Aggregation metrics medium alert', @PersonEntityTypeId, 5, 6, 'MEDIUM');

        IF NOT EXISTS (SELECT 1 FROM Event WHERE eventCode = 'NEWSAggregateHigh')
            INSERT INTO Event (eventCode, eventDescription, entityTypeId, minCumulatedScore, risk) 
            VALUES ('NEWSAggregateHigh', 'NEWS: Aggregation metrics high alert', @PersonEntityTypeId, 7, 'HIGH');
    END
    ELSE
    BEGIN
        RAISERROR('EntityType "Person" not found', 16, 1);
    END
END
GO
