-- Create CustomerSubscriptions table
-- Tracks which customers subscribe to events for specific entities

DROP TABLE IF EXISTS CustomerSubscriptions;

CREATE TABLE CustomerSubscriptions (
    customerSubscriptionId INT PRIMARY KEY IDENTITY(1,1),
    customerId INT NOT NULL,
    entityId NVARCHAR(50) NOT NULL,
    eventId NVARCHAR(50) NULL,
    subscriptionStartDate DATETIME NOT NULL DEFAULT (GETDATE()),
    subscriptionEndDate DATETIME NULL,

    active CHAR(1) NOT NULL CONSTRAINT DF_CustomerSubscriptions_active DEFAULT ('Y'),
    createDate DATETIME NOT NULL CONSTRAINT DF_CustomerSubscriptions_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_CustomerSubscriptions_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_CustomerSubscriptions_lastUpdateUser DEFAULT (SUSER_SNAME())
);

-- Add unique constraint to prevent duplicate subscriptions
ALTER TABLE CustomerSubscriptions 
ADD CONSTRAINT UQ_CustomerSubscriptions_CustomerId_EntityId_EventId 
UNIQUE (customerId, entityId, eventId);

-- Add foreign keys if referenced tables exist
IF OBJECT_ID('Customers','U') IS NOT NULL
BEGIN
    ALTER TABLE CustomerSubscriptions ADD CONSTRAINT FK_CustomerSubscriptions_Customers FOREIGN KEY (customerId) REFERENCES Customers(customerId);
END

IF OBJECT_ID('Entity','U') IS NOT NULL
BEGIN
    ALTER TABLE CustomerSubscriptions ADD CONSTRAINT FK_CustomerSubscriptions_Entity FOREIGN KEY (entityId) REFERENCES Entity(entityId);
END

-- If an Events table exists, add FK; otherwise leave eventId as a nullable lookup field
IF OBJECT_ID('Events','U') IS NOT NULL
BEGIN
    ALTER TABLE CustomerSubscriptions ADD CONSTRAINT FK_CustomerSubscriptions_Events FOREIGN KEY (eventId) REFERENCES Events(eventId);
END

CREATE INDEX IX_CustomerSubscriptions_CustomerId ON CustomerSubscriptions (customerId);
CREATE INDEX IX_CustomerSubscriptions_EntityId ON CustomerSubscriptions (entityId);
CREATE INDEX IX_CustomerSubscriptions_EventId ON CustomerSubscriptions (eventId);

-- Trigger to maintain lastUpdate fields
IF OBJECT_ID('TRG_CustomerSubscriptions_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_CustomerSubscriptions_UpdateTimestamp;
GO

CREATE TRIGGER TRG_CustomerSubscriptions_UpdateTimestamp
ON CustomerSubscriptions
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE cs
    SET
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM CustomerSubscriptions cs
    INNER JOIN inserted i ON cs.customerSubscriptionId = i.customerSubscriptionId;
END;
GO

-- Seed: Create sample subscriptions (idempotent)
-- Subscribe SLMEDICAL customer to all events for all Person entities

IF OBJECT_ID('Customers','U') IS NOT NULL 
   AND OBJECT_ID('Entity','U') IS NOT NULL 
   AND OBJECT_ID('Event','U') IS NOT NULL
   AND OBJECT_ID('EntityType','U') IS NOT NULL
BEGIN
    DECLARE @custId INT;
    DECLARE @PersonEntityTypeId INT;
    
    SELECT @custId = customerId FROM Customers WHERE customerName = 'SLMEDICAL';
    SELECT @PersonEntityTypeId = entityTypeId FROM EntityType WHERE entityTypeName = 'Person';

    IF @custId IS NOT NULL AND @PersonEntityTypeId IS NOT NULL
    BEGIN
        INSERT INTO CustomerSubscriptions (customerId, entityId, eventId)
        SELECT 
            @custId,
            e.entityId,
            ev.eventId
        FROM dbo.Entity e
        CROSS JOIN dbo.Event ev
        WHERE e.entityTypeId = @PersonEntityTypeId
          AND ev.entityTypeId = @PersonEntityTypeId
          AND NOT EXISTS (
              SELECT 1 FROM CustomerSubscriptions cs
              WHERE cs.customerId = @custId
                AND cs.entityId = e.entityId
                AND cs.eventId = ev.eventId
          );
    END
    ELSE
    BEGIN
        IF @custId IS NULL
            RAISERROR('Customer "SLMEDICAL" not found', 16, 1);
        IF @PersonEntityTypeId IS NULL
            RAISERROR('EntityType "Person" not found', 16, 1);
    END
END;
GO



