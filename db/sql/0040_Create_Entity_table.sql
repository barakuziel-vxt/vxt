-- ...existing code...
DROP TABLE IF EXISTS Entity;

CREATE TABLE Entity (
    entityId NVARCHAR(50) NOT NULL,             -- formerly MMSI
    entityFirstName VARCHAR(50) NOT NULL,                -- person's name, boat's name, stock ticker, vehicle model, etc
    entityLastName VARCHAR(50) NULL,                -- person's last name, boat's last name, stock ticker, vehicle model, etc
    entityTypeId INT NOT NULL,          -- formerly propertyTypeId
    gender CHAR(1) NULL,                             -- 'M', 'F', 'O' (optional, for people)
    birthDate DATE NULL,                                -- birth Date (e.g., build year)
    active CHAR(1) NOT NULL CONSTRAINT DF_entity_active DEFAULT 'Y',
    createDate DATETIME NOT NULL CONSTRAINT DF_entity_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_entity_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_entity_lastUpdateUser DEFAULT (SUSER_SNAME()),
    CONSTRAINT PK_entity PRIMARY KEY (entityId)
);

IF OBJECT_ID('EntityType','U') IS NOT NULL AND OBJECT_ID('Entity','U') IS NOT NULL
BEGIN
    ALTER TABLE Entity ADD CONSTRAINT FK_entity_EntityType FOREIGN KEY (entityTypeId) REFERENCES EntityType(entityTypeId);
END


CREATE INDEX IX_entity_entityTypeId ON Entity (entityTypeId);
-- Trigger to keep last-update fields current
IF OBJECT_ID('TRG_entity_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_entity_UpdateTimestamp;
GO

CREATE TRIGGER TRG_entity_UpdateTimestamp
ON Entity
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE e
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM Entity e
    INNER JOIN inserted i 
        ON e.entityId = i.entityId;
END;
GO

-- Seed: add sample entities
IF OBJECT_ID('EntityType','U') IS NOT NULL AND OBJECT_ID('Entity','U') IS NOT NULL
BEGIN
    DECLARE @PersonEntityTypeId INT;
    DECLARE @ElanIM40EntityTypeId INT;
    DECLARE @Lagoon380EntityTypeId INT;
    
    SELECT @PersonEntityTypeId = entityTypeId FROM EntityType WHERE entityTypeName = 'Person';
    SELECT @ElanIM40EntityTypeId = entityTypeId FROM EntityType WHERE entityTypeName = 'Elan Impression 40';
    SELECT @Lagoon380EntityTypeId = entityTypeId FROM EntityType WHERE entityTypeName = 'Lagoon 380';
    
    IF NOT EXISTS (SELECT 1 FROM Entity WHERE entityId = '234567890')
    BEGIN
        INSERT INTO Entity (entityId, entityFirstName, entityLastName, entityTypeId, birthDate)
        VALUES ('234567890', 'Tomer Refael', NULL, @Lagoon380EntityTypeId, '2023-01-01');
    END

    IF NOT EXISTS (SELECT 1 FROM Entity WHERE entityId = '234567891')
    BEGIN
        INSERT INTO Entity (entityId, entityFirstName, entityLastName, entityTypeId, birthDate)
        VALUES ('234567891', 'TinyK', 'LAGOON-380', @PersonEntityTypeId, '2021-01-01');
    END

    IF NOT EXISTS (SELECT 1 FROM Entity WHERE entityId = '033114869')
    BEGIN
        INSERT INTO Entity (entityId, entityFirstName, entityLastName, entityTypeId, birthDate)
        VALUES ('033114869', 'Barak', 'Uziel', @PersonEntityTypeId, '1976-08-10');
    END

    IF NOT EXISTS (SELECT 1 FROM Entity WHERE entityId = '033114870')
    BEGIN
        INSERT INTO Entity (entityId, entityFirstName, entityLastName, entityTypeId, birthDate)
        VALUES ('033114870', 'Shula', 'Uziel', @PersonEntityTypeId, '1950-05-01');
    END
END;
GO