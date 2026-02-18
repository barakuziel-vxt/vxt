-- Migration: Add consumer configuration columns to Provider table
-- Purpose: Support GenericTelemetryConsumer with adapter pattern and Kafka configuration

-- Check if columns exist and add them if missing
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Provider' AND COLUMN_NAME = 'TopicName')
BEGIN
    ALTER TABLE dbo.Provider
    ADD TopicName NVARCHAR(100) NULL;
    PRINT 'Added TopicName column';
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Provider' AND COLUMN_NAME = 'BatchSize')
BEGIN
    ALTER TABLE dbo.Provider
    ADD BatchSize INT NOT NULL DEFAULT 50;
    PRINT 'Added BatchSize column';
END;

GO

-- Set Kafka topics based on provider name
UPDATE dbo.Provider 
SET TopicName = 'junction-events'
WHERE providerName = 'Junction' AND TopicName IS NULL;

UPDATE dbo.Provider 
SET TopicName = 'terra-health-vitals'
WHERE providerName = 'Terra' AND TopicName IS NULL;

UPDATE dbo.Provider 
SET TopicName = 'signalk-events'
WHERE providerName = 'SignalK' AND TopicName IS NULL;

GO

PRINT 'Provider table migration completed successfully';
