DROP TABLE IF EXISTS EntityType;

CREATE TABLE EntityType (
    entityTypeId NVARCHAR(50) PRIMARY KEY, -- matches BoatTelemetry.BoatId if used
    entityTypeName VARCHAR(100),
    entityCategoryId VARCHAR(50) NOT NULL,
    active CHAR(1) NOT NULL CONSTRAINT DF_EntityType_active DEFAULT 'Y',
    createDate DATETIME NOT NULL CONSTRAINT DF_EntityType_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_EntityType_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_EntityType_lastUpdateUser DEFAULT (SUSER_SNAME()),
    CONSTRAINT FK_EntityType_EntityCategories FOREIGN KEY (entityCategoryId) REFERENCES EntityCategories(entityCategoryId)
);

-- Drop existing trigger if present and create a new one to keep last update info current
IF OBJECT_ID('TRG_EntityType_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_EntityType_UpdateTimestamp;
GO

CREATE TRIGGER TRG_EntityType_UpdateTimestamp
ON EntityType
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE pt
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM EntityType pt
    INNER JOIN inserted i ON pt.entityTypeId = i.entityTypeId;
END;
GO

-- Seed: add entity types if not present (requires EntityCategories)
IF OBJECT_ID('EntityCategories','U') IS NOT NULL
BEGIN

IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeId = 'Male')
        INSERT INTO EntityType (entityTypeId, entityTypeName, entityCategoryId) 
        VALUES ('Male', 'Male', (SELECT entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Person'));
     
     IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeId = 'Female')
        INSERT INTO EntityType (entityTypeId, entityTypeName, entityCategoryId) 
        VALUES ('Female', 'Female', (SELECT entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Person'));

    IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeId = 'ELAN-IM40')
        INSERT INTO EntityType (entityTypeId, entityTypeName, entityCategoryId) 
        VALUES ('ELAN-IM40', 'Elan Impression 40', (SELECT entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Yacht'));

    IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeId = 'LAGOON-380')
        INSERT INTO EntityType (entityTypeId, entityTypeName, entityCategoryId) 
        VALUES ('LAGOON-380', 'Lagoon 380', (SELECT entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Yacht'));

    IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeId = 'LAGOON-420')
        INSERT INTO EntityType (entityTypeId, entityTypeName, entityCategoryId) 
        VALUES ('LAGOON-420', 'Lagoon 420', (SELECT entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Yacht'));

    IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeId = 'BAV-C46')
        INSERT INTO EntityType (entityTypeId, entityTypeName, entityCategoryId) 
        VALUES ('BAV-C46', 'Bavaria Cruiser 46', (SELECT entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Yacht'));

     
END;
GO