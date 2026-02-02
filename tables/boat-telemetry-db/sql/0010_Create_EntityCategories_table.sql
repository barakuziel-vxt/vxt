DROP TABLE IF EXISTS EntityCategories;

CREATE TABLE EntityCategories (
    entityCategoryId VARCHAR(50) PRIMARY KEY,
    entityCategoryName VARCHAR(50) NOT NULL UNIQUE,
    active CHAR(1) NOT NULL CONSTRAINT DF_EntityCategories_active DEFAULT 'Y',
    createDate DATETIME NOT NULL CONSTRAINT DF_EntityCategories_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_EntityCategories_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_EntityCategories_lastUpdateUser DEFAULT (SUSER_SNAME())
);

IF OBJECT_ID('TRG_EntityCategories_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_EntityCategories_UpdateTimestamp;
GO

CREATE TRIGGER TRG_EntityCategories_UpdateTimestamp
ON EntityCategories
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE pc
    SET
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM EntityCategories pc
    INNER JOIN inserted i ON pc.entityCategoryId = i.entityCategoryId;
END;
GO

-- Seed: add additional entity categories if not present
IF NOT EXISTS (SELECT 1 FROM EntityCategories WHERE entityCategoryName = 'Yacht')
    INSERT INTO EntityCategories (entityCategoryId,entityCategoryName) VALUES ('Yacht','Yacht');

IF NOT EXISTS (SELECT 1 FROM EntityCategories WHERE entityCategoryName = 'Person')
    INSERT INTO EntityCategories (entityCategoryId,entityCategoryName) VALUES ('Person');
GO

IF NOT EXISTS (SELECT 1 FROM EntityCategories WHERE entityCategoryName = 'Stock')
    INSERT INTO EntityCategories (entityCategoryId,entityCategoryName) VALUES ('Stock','Stock');
GO

IF NOT EXISTS (SELECT 1 FROM EntityCategories WHERE entityCategoryName = 'Vehicle')
    INSERT INTO EntityCategories (entityCategoryId,entityCategoryName) VALUES ('Vehicle','Vehicle');
GO