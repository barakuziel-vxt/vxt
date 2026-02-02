DROP TABLE IF EXISTS Customers;

CREATE TABLE Customers (
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
    active CHAR(1) NOT NULL CONSTRAINT DF_Customers_active DEFAULT 'Y',
    createDate DATETIME NOT NULL CONSTRAINT DF_Customers_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_Customers_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_Customers_lastUpdateUser DEFAULT (SUSER_SNAME())
);

CREATE INDEX IX_Customers_Name ON Customers (customerName);
CREATE INDEX IX_Customers_Email ON Customers (primaryContactEmail);

-- Seed: add sample customer "Sailor"
IF NOT EXISTS (SELECT 1 FROM Customers WHERE customerName = 'Sailor' AND primaryContactName = 'Amit Hari')
    INSERT INTO Customers (customerName, primaryContactName) VALUES ('Sailor', 'Amit Hari');
GO

IF NOT EXISTS (SELECT 1 FROM Customers WHERE customerName = 'sl-medical' AND primaryContactName = 'Eyal')
    INSERT INTO Customers (customerName, primaryContactName) VALUES ('sl-medical', 'Eyal');
GO

-- Drop existing trigger if present and create a new one to keep last update info current
IF OBJECT_ID('TRG_Customers_UpdateTimestamp', 'TR') IS NOT NULL
    DROP TRIGGER TRG_Customers_UpdateTimestamp;
GO

CREATE TRIGGER TRG_Customers_UpdateTimestamp
ON Customers
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE c
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM Customers c
    INNER JOIN inserted i ON c.customerId = i.customerId;
END;
GO
