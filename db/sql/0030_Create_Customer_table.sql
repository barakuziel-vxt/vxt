
DROP TABLE IF EXISTS Customer;

CREATE TABLE Customer (
    customerId INT PRIMARY KEY IDENTITY(1,1),
    customerName VARCHAR(200) NOT NULL,
    primaryContactName VARCHAR(100) NULL,
    primaryContactEmail VARCHAR(320) NULL,
    primaryContactPhone VARCHAR(50) NULL,
    billingAddress1 VARCHAR(200) NULL,
    billingAddress2 VARCHAR(200) NULL,
    billingCity VARCHAR(100) NULL,
    billingState VARCHAR(100) NULL,
    billingPostalCode VARCHAR(30) NULL,
    billingCountry VARCHAR(100) NULL,
    propertyId INT NULL, -- optional link to Entities(propertyId)
    active CHAR(1) NOT NULL CONSTRAINT DF_Customer_active DEFAULT 'Y',
    createDate DATETIME NOT NULL CONSTRAINT DF_Customer_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_Customer_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_Customer_lastUpdateUser DEFAULT (SUSER_SNAME())
);

CREATE INDEX IX_Customer_Name ON Customer (customerName);
CREATE INDEX IX_Customer_Email ON Customer (primaryContactEmail);
-- Seed: add sample customer "Sailor"
IF NOT EXISTS (SELECT 1 FROM Customer WHERE customerName = 'SAILOR' AND primaryContactName = 'Amit Hari')
    INSERT INTO Customer (customerName, primaryContactName) VALUES ('SAILOR', 'Amit Hari');
GO

IF NOT EXISTS (SELECT 1 FROM Customer WHERE customerName = 'SLMEDICAL' AND primaryContactName = 'Eyal')
    INSERT INTO Customer (customerName, primaryContactName) VALUES ('SLMEDICAL', 'Eyal');
GO

-- Drop existing trigger if present and create a new one to keep last update info current
IF OBJECT_ID('TRG_Customer_UpdateTimestamp', 'TR') IS NOT NULL
    DROP TRIGGER TRG_Customer_UpdateTimestamp;
GO

CREATE TRIGGER TRG_Customer_UpdateTimestamp
ON Customer
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE c
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM Customer c
    INNER JOIN inserted i ON c.customerId = i.customerId;
END;
GO
