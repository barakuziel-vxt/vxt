-- Create Events table
-- Tracks event types that can be associated with entity categories

DROP TABLE IF EXISTS Events;

CREATE TABLE Events (
    eventId NVARCHAR(50) PRIMARY KEY,
    eventName VARCHAR(200) NOT NULL,
    entityCategoryId INT NULL,

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
    INNER JOIN inserted i ON e.eventId = i.eventId;
END;
GO

-- Seed: common sample events (only if EntityCategories present or null entityCategoryId allowed)
IF OBJECT_ID('Events','U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Events WHERE eventId = 'HIGH_TEMP')
        INSERT INTO Events (eventId, eventName, entityCategoryId) VALUES ('HIGH_TEMP', 'High Temperature', NULL);

    IF NOT EXISTS (SELECT 1 FROM Events WHERE eventId = 'LOW_BATTERY')
        INSERT INTO Events (eventId, eventName, entityCategoryId) VALUES ('LOW_BATTERY', 'Low Battery', NULL);

    IF OBJECT_ID('EntityCategories','U') IS NOT NULL
    BEGIN
        -- ensure category 'Person' exists
        IF NOT EXISTS (SELECT 1 FROM EntityCategories WHERE entityCategoryName = 'Person')
            INSERT INTO EntityCategories (entityCategoryName) VALUES ('Person');

        -- ensure category 'Yacht' exists
        IF NOT EXISTS (SELECT 1 FROM EntityCategories WHERE entityCategoryName = 'Yacht')
            INSERT INTO EntityCategories (entityCategoryName) VALUES ('Yacht');

        -- existing NAV_ISSUE seed (keeps old behavior)
        IF NOT EXISTS (SELECT 1 FROM Events WHERE eventId = 'NAV_ISSUE')
        BEGIN
            INSERT INTO Events (eventId, eventName, entityCategoryId)
            VALUES ('NAV_ISSUE', 'Navigation Issue', (SELECT TOP 1 entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Sailing Yacht'));
        END

        -- New event: Person health status
        IF NOT EXISTS (SELECT 1 FROM Events WHERE eventId = 'PERSON_HEALTH')
        BEGIN
            INSERT INTO Events (eventId, eventName, entityCategoryId)
            VALUES ('PERSON_HEALTH', 'Person health status', (SELECT TOP 1 entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Person'));
        END

        -- New event: Yacht health status
        IF NOT EXISTS (SELECT 1 FROM Events WHERE eventId = 'YACHT_HEALTH')
        BEGIN
            INSERT INTO Events (eventId, eventName, entityCategoryId)
            VALUES ('YACHT_HEALTH', 'Yacht health status', (SELECT TOP 1 entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Yacht'));
        END
    END
END;
GO