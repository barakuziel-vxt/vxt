-- Create CustomerEntities table
-- Tracks which entities (boats, people) belong to which customers

DROP TABLE IF EXISTS CustomerEntities;

CREATE TABLE CustomerEntities (
    customerEntityId INT PRIMARY KEY IDENTITY(1,1),
    customerId INT NOT NULL,
    entityId NVARCHAR(50) NOT NULL,

    active CHAR(1) NOT NULL CONSTRAINT DF_CustomerEntities_active DEFAULT ('Y'),
    createDate DATETIME NOT NULL CONSTRAINT DF_CustomerEntities_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_CustomerEntities_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_CustomerEntities_lastUpdateUser DEFAULT (SUSER_SNAME())
);

-- Add unique constraint to prevent duplicate entity assignments
ALTER TABLE CustomerEntities 
ADD CONSTRAINT UQ_CustomerEntities_CustomerId_EntityId 
UNIQUE (customerId, entityId);

-- Add foreign keys if referenced tables exist
IF OBJECT_ID('Customers','U') IS NOT NULL
BEGIN
    ALTER TABLE CustomerEntities ADD CONSTRAINT FK_CustomerEntities_Customers FOREIGN KEY (customerId) REFERENCES Customers(customerId);
END

IF OBJECT_ID('Entity','U') IS NOT NULL
BEGIN
    ALTER TABLE CustomerEntities ADD CONSTRAINT FK_CustomerEntities_Entity FOREIGN KEY (entityId) REFERENCES Entity(entityId);
END

CREATE INDEX IX_CustomerEntities_CustomerId ON CustomerEntities (customerId);
CREATE INDEX IX_CustomerEntities_EntityId ON CustomerEntities (entityId);

-- Trigger to maintain lastUpdate fields
IF OBJECT_ID('TRG_CustomerEntities_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_CustomerEntities_UpdateTimestamp;
GO

CREATE TRIGGER TRG_CustomerEntities_UpdateTimestamp
ON CustomerEntities
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE CustomerEntities
    SET lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    WHERE customerEntityId IN (SELECT customerEntityId FROM INSERTED)
END;
GO
