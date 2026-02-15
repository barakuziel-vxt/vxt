-- Create Events table
-- Tracks event types that can be associated with entity categories

DROP TABLE IF EXISTS Events;

CREATE TABLE Events (
    eventCode NVARCHAR(50) PRIMARY KEY,
    eventName VARCHAR(200) NOT NULL,
    entityCategoryId NVARCHAR(50) NOT NULL,

    active CHAR(1) NOT NULL CONSTRAINT DF_Events_active DEFAULT ('Y'),
    createDate DATETIME NOT NULL CONSTRAINT DF_Events_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_Events_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_Events_lastUpdateUser DEFAULT (SUSER_SNAME())
);

-- Add foreign key to EntityCategories if it exists
IF OBJECT_ID('EntityCategories','U') IS NOT NULL
BEGIN
    ALTER TABLE Events ADD CONSTRAINT FK_Events_EntityCategories FOREIGN KEY (entityCategoryId) REFERENCES EntityCategories(entityCategoryId);
END

CREATE INDEX IX_Events_EntityCategoryId ON Events (entityCategoryId);

-- Trigger to maintain lastUpdate fields
IF OBJECT_ID('TRG_Events_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_Events_UpdateTimestamp;
GO

CREATE TRIGGER TRG_Events_UpdateTimestamp
ON Events
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE e
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM Events e
    INNER JOIN inserted i ON e.eventCode = i.eventCode;
END;
GO

-- Seed: common sample events (only if EntityCategories present or null entityCategoryId allowed)
IF OBJECT_ID('Events','U') IS NOT NULL
BEGIN
   
        -- New event: Person health status
        IF NOT EXISTS (SELECT 1 FROM Events WHERE eventCode = 'PERSON_HEALTH')
        BEGIN
            INSERT INTO Events (eventCode, eventName, entityCategoryId)
            VALUES ('PERSON_HEALTH', 'Person health status', (SELECT TOP 1 entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Person'));
        END

        -- New event: Yacht health status
        IF NOT EXISTS (SELECT 1 FROM Events WHERE eventCode = 'YACHT_HEALTH')
        BEGIN
            INSERT INTO Events (eventCode, eventName, entityCategoryId)
            VALUES ('YACHT_HEALTH', 'Yacht health status', (SELECT TOP 1 entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Yacht'));
        END
   END;
GO