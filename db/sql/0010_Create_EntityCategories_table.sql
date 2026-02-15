
DROP TABLE IF EXISTS EntityCategory;

CREATE TABLE EntityCategory (
    entityCategoryId INT IDENTITY(1,1) PRIMARY KEY,
    entityCategoryName VARCHAR(50) NOT NULL UNIQUE,
    active CHAR(1) NOT NULL CONSTRAINT DF_EntityCategory_active DEFAULT 'Y',
    createDate DATETIME NOT NULL CONSTRAINT DF_EntityCategory_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_EntityCategory_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_EntityCategory_lastUpdateUser DEFAULT (SUSER_SNAME())
);

IF OBJECT_ID('TRG_EntityCategory_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_EntityCategory_UpdateTimestamp;
GO

CREATE TRIGGER TRG_EntityCategory_UpdateTimestamp
ON EntityCategory
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE pc
    SET
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM EntityCategory pc
    INNER JOIN inserted i ON pc.entityCategoryId = i.entityCategoryId;
END;
GO

-- Seed: add additional entity categories if not present
IF NOT EXISTS (SELECT 1 FROM EntityCategory WHERE entityCategoryName = 'Yacht')
    INSERT INTO EntityCategory (entityCategoryName) VALUES ('Yacht');

IF NOT EXISTS (SELECT 1 FROM EntityCategory WHERE entityCategoryName = 'Person')
    INSERT INTO EntityCategory (entityCategoryName) VALUES ('Person');
GO

IF NOT EXISTS (SELECT 1 FROM EntityCategory WHERE entityCategoryName = 'Stock')
    INSERT INTO EntityCategory (entityCategoryName) VALUES ('Stock');
GO

IF NOT EXISTS (SELECT 1 FROM EntityCategory WHERE entityCategoryName = 'Vehicle')
    INSERT INTO EntityCategory (entityCategoryName) VALUES ('Vehicle');
GO