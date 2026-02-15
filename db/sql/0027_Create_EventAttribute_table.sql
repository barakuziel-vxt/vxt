-- Create EventAttribute table
-- Stores scoring/criteria for events using entity attributes

DROP TABLE IF EXISTS EventAttribute;
GO

CREATE TABLE EventAttribute (
    eventId INT NOT NULL,
    entityTypeAttributeId INT NOT NULL,
    -- control columns
    active CHAR(1) NOT NULL CONSTRAINT DF_EventAttribute_active DEFAULT ('Y'),
    createDate DATETIME NOT NULL CONSTRAINT DF_EventAttribute_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_EventAttribute_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser NVARCHAR(128) NOT NULL CONSTRAINT DF_EventAttribute_lastUpdateUser DEFAULT (SUSER_SNAME()),

    CONSTRAINT PK_EventAttribute PRIMARY KEY (eventId, entityTypeAttributeId),
    CONSTRAINT FK_EventAttribute_Events FOREIGN KEY (eventId) REFERENCES Event(eventId),
    CONSTRAINT FK_EventAttribute_EntityTypeAttribute FOREIGN KEY (entityTypeAttributeId) REFERENCES EntityTypeAttribute(entityTypeAttributeId)
);
GO

-- Trigger to update timestamp and user on INSERT/UPDATE
IF OBJECT_ID('TRG_EventAttribute_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_EventAttribute_UpdateTimestamp;
GO

CREATE TRIGGER TRG_EventAttribute_UpdateTimestamp
ON EventAttribute
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE ea
    SET
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM EventAttribute ea
    INNER JOIN inserted i ON ea.eventId = i.eventId AND ea.entityTypeAttributeId = i.entityTypeAttributeId;
END;
GO

-- Idempotent: map NEWS low-medium events to corresponding entity attributes
IF OBJECT_ID('EventAttribute','U') IS NOT NULL AND OBJECT_ID('Event','U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM EventAttribute WHERE eventId = (SELECT eventId FROM Event WHERE eventCode = 'NEWSTemperatureLowMedium') AND entityTypeAttributeId = (SELECT entityTypeAttributeId FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5'))
        INSERT INTO EventAttribute (eventId, entityTypeAttributeId) VALUES ((SELECT eventId FROM Event WHERE eventCode = 'NEWSTemperatureLowMedium'), (SELECT entityTypeAttributeId FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5'));
    IF NOT EXISTS (SELECT 1 FROM EventAttribute WHERE eventId = (SELECT eventId FROM Event WHERE eventCode = 'NEWSSystolicBloodPressureLowMedium') AND entityTypeAttributeId = (SELECT entityTypeAttributeId FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6'))
        INSERT INTO EventAttribute (eventId, entityTypeAttributeId) VALUES ((SELECT eventId FROM Event WHERE eventCode = 'NEWSSystolicBloodPressureLowMedium'), (SELECT entityTypeAttributeId FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6'));
    IF NOT EXISTS (SELECT 1 FROM EventAttribute WHERE eventId = (SELECT eventId FROM Event WHERE eventCode = 'NEWSRespirationRatePerMinLowMedium') AND entityTypeAttributeId = (SELECT entityTypeAttributeId FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1'))
        INSERT INTO EventAttribute (eventId, entityTypeAttributeId) VALUES ((SELECT eventId FROM Event WHERE eventCode = 'NEWSRespirationRatePerMinLowMedium'), (SELECT entityTypeAttributeId FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1'));
    IF NOT EXISTS (SELECT 1 FROM EventAttribute WHERE eventId = (SELECT eventId FROM Event WHERE eventCode = 'NEWSSpO2Scale1LowMedium') AND entityTypeAttributeId = (SELECT entityTypeAttributeId FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '59408-5'))
        INSERT INTO EventAttribute (eventId, entityTypeAttributeId) VALUES ((SELECT eventId FROM Event WHERE eventCode = 'NEWSSpO2Scale1LowMedium'), (SELECT entityTypeAttributeId FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '59408-5'));
    IF NOT EXISTS (SELECT 1 FROM EventAttribute WHERE eventId = (SELECT eventId FROM Event WHERE eventCode = 'NEWSPulsePerMinLowMedium') AND entityTypeAttributeId = (SELECT entityTypeAttributeId FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4'))
        INSERT INTO EventAttribute (eventId, entityTypeAttributeId) VALUES ((SELECT eventId FROM Event WHERE eventCode = 'NEWSPulsePerMinLowMedium'), (SELECT entityTypeAttributeId FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4'));
END
GO

-- Idempotent: map aggregate NEWS events (Medium/High) to all Person attributes that have EntityTypeAttributeScore
IF OBJECT_ID('EventAttribute','U') IS NOT NULL AND OBJECT_ID('EntityTypeAttribute','U') IS NOT NULL AND OBJECT_ID('EntityTypeAttributeScore','U') IS NOT NULL
BEGIN
    -- NEWSAggregateMedium: include all Person attributes that have EntityTypeAttributeScore
    INSERT INTO EventAttribute (eventId, entityTypeAttributeId)
    SELECT (SELECT eventId FROM Event WHERE eventCode = 'NEWSAggregateMedium'), eta.entityTypeAttributeId
    FROM dbo.EntityTypeAttribute eta
    WHERE EXISTS (
          SELECT 1 FROM dbo.EntityTypeAttributeScore etc
          WHERE etc.entityTypeAttributeId = eta.entityTypeAttributeId
      )
      AND NOT EXISTS (
          SELECT 1 FROM EventAttribute ea
          WHERE ea.eventId = (SELECT eventId FROM Event WHERE eventCode = 'NEWSAggregateMedium')
            AND ea.entityTypeAttributeId = eta.entityTypeAttributeId
      );

    -- NEWSAggregateHigh: include all Person attributes that have EntityTypeAttributeScore
    INSERT INTO EventAttribute (eventId, entityTypeAttributeId)
    SELECT (SELECT eventId FROM Event WHERE eventCode = 'NEWSAggregateHigh'), eta.entityTypeAttributeId
    FROM dbo.EntityTypeAttribute eta
    WHERE EXISTS (
          SELECT 1 FROM dbo.EntityTypeAttributeScore etc
          WHERE etc.entityTypeAttributeId = eta.entityTypeAttributeId
      )
      AND NOT EXISTS (
          SELECT 1 FROM EventAttribute ea
          WHERE ea.eventId = (SELECT eventId FROM Event WHERE eventCode = 'NEWSAggregateHigh')
            AND ea.entityTypeAttributeId = eta.entityTypeAttributeId
      );
END
GO

