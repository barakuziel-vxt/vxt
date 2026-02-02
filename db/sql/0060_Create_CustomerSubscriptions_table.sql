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
IF OBJECT_ID('Customers','U') IS NOT NULL AND OBJECT_ID('Entity','U') IS NOT NULL AND OBJECT_ID('Events','U') IS NOT NULL
BEGIN
    DECLARE @custId INT, @eventPerson NVARCHAR(50), @sailorId INT, @eventYacht NVARCHAR(50), @ent NVARCHAR(50);

    -- si-medical -> PERSON_HEALTH on entities 033114869 and 033114870
    SET @custId = (SELECT TOP 1 customerId FROM Customers WHERE customerName IN ('si-medical','sl-medical'));
    SET @eventPerson = (SELECT TOP 1 eventId FROM Events WHERE eventId = 'PERSON_HEALTH');
    IF @custId IS NOT NULL AND @eventPerson IS NOT NULL
    BEGIN
        SET @ent = '033114869';
        IF EXISTS (SELECT 1 FROM Entity WHERE entityId = @ent)
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM CustomerSubscriptions WHERE customerId = @custId AND entityId = @ent AND eventId = @eventPerson)
                INSERT INTO CustomerSubscriptions (customerId, entityId, eventId) VALUES (@custId, @ent, @eventPerson);
        END

        SET @ent = '033114870';
        IF EXISTS (SELECT 1 FROM Entity WHERE entityId = @ent)
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM CustomerSubscriptions WHERE customerId = @custId AND entityId = @ent AND eventId = @eventPerson)
                INSERT INTO CustomerSubscriptions (customerId, entityId, eventId) VALUES (@custId, @ent, @eventPerson);
        END
    END

    -- Sailor -> YACHT_HEALTH on entities 234567891 and 234567890
    SET @sailorId = (SELECT TOP 1 customerId FROM Customers WHERE customerName = 'Sailor');
    SET @eventYacht = (SELECT TOP 1 eventId FROM Events WHERE eventId = 'YACHT_HEALTH');
    IF @sailorId IS NOT NULL AND @eventYacht IS NOT NULL
    BEGIN
        SET @ent = '234567891';
        IF EXISTS (SELECT 1 FROM Entity WHERE entityId = @ent)
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM CustomerSubscriptions WHERE customerId = @sailorId AND entityId = @ent AND eventId = @eventYacht)
                INSERT INTO CustomerSubscriptions (customerId, entityId, eventId) VALUES (@sailorId, @ent, @eventYacht);
        END

        SET @ent = '234567890';
        IF EXISTS (SELECT 1 FROM Entity WHERE entityId = @ent)
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM CustomerSubscriptions WHERE customerId = @sailorId AND entityId = @ent AND eventId = @eventYacht)
                INSERT INTO CustomerSubscriptions (customerId, entityId, eventId) VALUES (@sailorId, @ent, @eventYacht);
        END
    END
END
GO

