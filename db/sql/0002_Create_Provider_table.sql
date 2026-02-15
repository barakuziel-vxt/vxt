-- filepath: c:\VXT\db\sql\0005_create_Provider_table.sql
-- Provider Catalog: Stores healthcare/wellness data providers
-- References: Junction, Terra, and other data providers

DROP TABLE IF EXISTS dbo.Provider;
GO

CREATE TABLE dbo.Provider (
    providerId INT IDENTITY(1,1) PRIMARY KEY,
    providerName NVARCHAR(100) NOT NULL UNIQUE,      -- e.g., "Junction", "Terra", "Apple", "Garmin"
    providerDescription NVARCHAR(500) NOT NULL,
    providerCategory NVARCHAR(50) NOT NULL,          -- e.g., "HealthData", "Wearable", "Clinical"
    apiBaseUrl NVARCHAR(500) NULL,                   -- e.g., "https://api.junction.com"
    apiVersion NVARCHAR(20) NULL,                    -- e.g., "v1", "v2"
    documentationUrl NVARCHAR(500) NULL,             -- e.g., "https://docs.junction.com/events"
    
    -- control columns
    active CHAR(1) NOT NULL CONSTRAINT DF_Provider_active DEFAULT ('Y'),
    createDate DATETIME NOT NULL CONSTRAINT DF_Provider_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_Provider_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_Provider_lastUpdateUser DEFAULT (SUSER_SNAME())
);
GO

-- Create indexes
CREATE INDEX IX_Provider_Name ON dbo.Provider (providerName);
CREATE INDEX IX_Provider_Category ON dbo.Provider (providerCategory);
GO

-- Trigger to update timestamp and user
IF OBJECT_ID('TRG_Provider_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_Provider_UpdateTimestamp;
GO

CREATE TRIGGER TRG_Provider_UpdateTimestamp
ON dbo.Provider
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE p
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM dbo.Provider p
    INNER JOIN inserted i ON p.providerId = i.providerId;
END;
GO

-- Seed: Add major health data providers (idempotent)
IF OBJECT_ID('Provider','U') IS NOT NULL
BEGIN
    -- Junction Provider
    IF NOT EXISTS (SELECT 1 FROM Provider WHERE providerName = 'Junction')
        INSERT INTO Provider (providerName, providerDescription, providerCategory, apiBaseUrl, apiVersion, documentationUrl, active)
        VALUES ('Junction', 'Healthcare data integration platform', 'HealthData', 'https://api.junction.com', 'v1', 'https://docs.junction.com/events', 'Y');
    
    -- Terra Provider
    IF NOT EXISTS (SELECT 1 FROM Provider WHERE providerName = 'Terra')
        INSERT INTO Provider (providerName, providerDescription, providerCategory, apiBaseUrl, apiVersion, documentationUrl, active)
        VALUES ('Terra', 'Unified health data API platform', 'HealthData', 'https://api.terra.conduit.dev', 'v2', 'https://docs.terra.conduit.dev/reference/events', 'Y');
    
    -- Apple Health Provider
    IF NOT EXISTS (SELECT 1 FROM Provider WHERE providerName = 'Apple')
        INSERT INTO Provider (providerName, providerDescription, providerCategory, apiBaseUrl, apiVersion, documentationUrl, active)
        VALUES ('Apple', 'Apple Health platform', 'Wearable', NULL, 'N/A', 'https://developer.apple.com/health/', 'Y');
    
    -- Garmin Provider
    IF NOT EXISTS (SELECT 1 FROM Provider WHERE providerName = 'Garmin')
        INSERT INTO Provider (providerName, providerDescription, providerCategory, apiBaseUrl, apiVersion, documentationUrl, active)
        VALUES ('Garmin', 'Garmin wearable devices', 'Wearable', 'https://connectapi.garmin.com', 'v1', 'https://developer.garmin.com/health-api/overview/', 'Y');
    
    -- Samsung Provider
    IF NOT EXISTS (SELECT 1 FROM Provider WHERE providerName = 'Samsung')
        INSERT INTO Provider (providerName, providerDescription, providerCategory, apiBaseUrl, apiVersion, documentationUrl, active)
        VALUES ('Samsung', 'Samsung Health platform', 'Wearable', NULL, 'N/A', 'https://developer.samsung.com/health', 'Y');
    
    -- Fitbit Provider
    IF NOT EXISTS (SELECT 1 FROM Provider WHERE providerName = 'Fitbit')
        INSERT INTO Provider (providerName, providerDescription, providerCategory, apiBaseUrl, apiVersion, documentationUrl, active)
        VALUES ('Fitbit', 'Fitbit health tracking', 'Wearable', 'https://api.fitbit.com', 'v1', 'https://dev.fitbit.com/docs/', 'Y');
    
    -- Google Fit Provider
    IF NOT EXISTS (SELECT 1 FROM Provider WHERE providerName = 'GoogleFit')
        INSERT INTO Provider (providerName, providerDescription, providerCategory, apiBaseUrl, apiVersion, documentationUrl, active)
        VALUES ('GoogleFit', 'Google Fit fitness platform', 'Wearable', 'https://www.googleapis.com/fitness', 'v1', 'https://developers.google.com/fit', 'Y');
    
END
GO