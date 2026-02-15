
DROP TABLE IF EXISTS EntityTelemetry;

CREATE TABLE EntityTelemetry (
    -- Identifiers
    entityTelemetryId BIGINT IDENTITY(1,1) NOT NULL,  -- EntityTelemetryId
    entityId NVARCHAR(50) NOT NULL, -- PersonId, SystemId, etc
    entityTypeAttributeId INT NOT NULL,   -- FK to EntityTypeAttribute (e.g. 'HeartRate', 'SystolicBP', 'EngineRPM', 'BoatSpeed', etc)
    
      -- Timestamps
    startTimestampUTC DATETIME2(7) NOT NULL, -- mesurement start time (UTC)
    endTimestampUTC DATETIME2(7) NOT NULL,   -- mesurement end time (UTC)
    ingestionTimestampUTC DATETIME2(7) DEFAULT SYSUTCDATETIME(), -- ingestion time (UTC)
    
    -- Provider Telemetry Codes and identification (LOINC / SignalK / VSS code-id)
    providerEventInterpretation NVARCHAR(50) NULL, -- 'Normal', 'High', 'Low', 'Arrhythmia', etc (optional, for quick querying)
    providerDevice NVARCHAR(50) NOT NULL,    -- 'Garmin', 'Samsung', 'Apple', 'SensorX', etc
        
    -- Values
    numericValue FLOAT NULL,
    latitude FLOAT NULL,
    longitude FLOAT NULL,
    stringValue NVARCHAR(500) NULL, -- Complex values or Json
    
    -- Index ColumnStore (On all columns)
    INDEX IX_EntityTelemetry_ColumnStore CLUSTERED COLUMNSTORE
);