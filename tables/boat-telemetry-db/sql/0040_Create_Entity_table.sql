-- ...existing code...
DROP TABLE IF EXISTS Entity;

CREATE TABLE Entity (
    entityId NVARCHAR(50) NOT NULL,             -- formerly MMSI
    entityName VARCHAR(200) NULL,                -- formerly customerPropertyName
    entityTypeId NVARCHAR(50) NOT NULL,          -- formerly propertyTypeId
    year INT NULL,                                -- year (e.g., build year)
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
    IF NOT EXISTS (SELECT 1 FROM Entity WHERE entityId = '234567890')
    BEGIN
        INSERT INTO Entity (entityId, entityName, entityTypeId, year)
        VALUES ('234567890', 'Tomer Refael', 'ELAN-IM40', 2023);
    END

    IF NOT EXISTS (SELECT 1 FROM Entity WHERE entityId = '234567891')
    BEGIN
        INSERT INTO Entity (entityId, entityName, entityTypeId, year)
        VALUES ('234567891', 'TinyK', 'LAGOON-380', 2021);
    END

    IF NOT EXISTS (SELECT 1 FROM Entity WHERE entityId = '033114869')
    BEGIN
        INSERT INTO Entity (entityId, entityName, entityTypeId, year)
        VALUES ('033114869', 'Barak Uziel', 'Male', NULL);
    END

      IF NOT EXISTS (SELECT 1 FROM Entity WHERE entityId = '033114870')
    BEGIN
        INSERT INTO Entity (entityId, entityName, entityTypeId, year)
        VALUES ('033114870', 'Anat Manor', 'Female', NULL);
    END
END;
GO