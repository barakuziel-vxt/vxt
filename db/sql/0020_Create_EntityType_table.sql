
DROP TABLE IF EXISTS EntityType;

CREATE TABLE EntityType (
    entityTypeId INT IDENTITY(1,1) PRIMARY KEY, -- matches BoatTelemetry.BoatId if used
    entityTypeName VARCHAR(50) NOT NULL UNIQUE,
    entityCategoryId INT NOT NULL,
    active CHAR(1) NOT NULL CONSTRAINT DF_EntityType_active DEFAULT 'Y',
    createDate DATETIME NOT NULL CONSTRAINT DF_EntityType_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_EntityType_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_EntityType_lastUpdateUser DEFAULT (SUSER_SNAME()),
    CONSTRAINT FK_EntityType_EntityCategory FOREIGN KEY (entityCategoryId) REFERENCES EntityCategory(entityCategoryId)
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

-- Seed: add entity types if not present (requires EntityCategory)
IF OBJECT_ID('EntityCategory','U') IS NOT NULL
BEGIN
IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeName = 'Person')
        INSERT INTO EntityType (entityTypeName, entityCategoryId) 
        VALUES ('Person', (SELECT entityCategoryId FROM EntityCategory WHERE entityCategoryName = 'Person'));
    
IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeName = 'Male')
        INSERT INTO EntityType (entityTypeName, entityCategoryId) 
        VALUES ('Male', (SELECT entityCategoryId FROM EntityCategory WHERE entityCategoryName = 'Person'));
     
     IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeName = 'Female')
        INSERT INTO EntityType (entityTypeName, entityCategoryId) 
        VALUES ('Female', (SELECT entityCategoryId FROM EntityCategory WHERE entityCategoryName = 'Person'));
    IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeName = 'ELAN-IM40')
        INSERT INTO EntityType (entityTypeName, entityCategoryId) 
        VALUES ('Elan Impression 40', (SELECT entityCategoryId FROM EntityCategory WHERE entityCategoryName = 'Yacht'));

    IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeName = 'LAGOON-380')
        INSERT INTO EntityType (entityTypeName, entityCategoryId) 
        VALUES ('Lagoon 380', (SELECT entityCategoryId FROM EntityCategory WHERE entityCategoryName = 'Yacht'));
    IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeName = 'LAGOON-420')
        INSERT INTO EntityType (entityTypeName, entityCategoryId) 
        VALUES ('Lagoon 420', (SELECT entityCategoryId FROM EntityCategory WHERE entityCategoryName = 'Yacht'));

    IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeName = 'BAV-C46')
        INSERT INTO EntityType (entityTypeName, entityCategoryId) 
        VALUES ('Bavaria Cruiser 46', (SELECT entityCategoryId FROM EntityCategory WHERE entityCategoryName = 'Yacht'));
     
END;
GO