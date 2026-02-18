-- filepath: c:\VXT\db\sql\0003_create_ProviderEvent_table.sql
-- ProviderEvent Catalog: Standard provider event types from Junction, Terra, and other providers
-- References Provider table for provider details
-- Includes JSON schema payloads from provider documentation

DROP TABLE IF EXISTS dbo.ProviderEvent;
GO

CREATE TABLE dbo.ProviderEvent (
    providerEventId INT IDENTITY(1,1) PRIMARY KEY,
    providerId INT NOT NULL,                          -- FK to Provider table
    providerEventType NVARCHAR(100) NOT NULL,         -- e.g., "vitals.heart_rate.update", "body.heart_rate"
    providerEventDescription NVARCHAR(500) NOT NULL,
    providerNamespace NVARCHAR(50) NOT NULL,          -- e.g., "vitals", "activity", "sleep", "location", "body"
    providerEventName NVARCHAR(100) NOT NULL,         -- e.g., "heart_rate", "blood_pressure", "update"
    providerVersion NVARCHAR(20) NOT NULL DEFAULT '1.0',
    
    -- Schema/payload information
    payloadSchema NVARCHAR(MAX) NULL,  -- JSON schema for event payload
    requiredFields NVARCHAR(MAX) NULL, -- JSON array of required fields
    
    -- Mapping to local protocolAttributeCode (optional cross-reference)
    protocolAttributeCode NVARCHAR(100) NULL,
    
    -- Configuration for database-driven extraction (added 2026-02-18)
    ProtocolId INT NULL,                             -- FK to Protocol table
    ProtocolAttributeId INT NULL,                    -- FK to ProtocolAttribute table
    ValueJsonPath NVARCHAR(MAX) NULL,                -- JSONPath to numeric/string value in payload
    SampleArrayPath NVARCHAR(MAX) NULL,              -- JSONPath to array of samples (if event contains multiple measurements)
    CompositeValueTemplate NVARCHAR(MAX) NULL,       -- Template for composing value from multiple JSON paths
    FieldMappingJSON NVARCHAR(MAX) NULL,             -- JSON mapping of event fields to standard attributes
    
    -- control columns
    active CHAR(1) NOT NULL CONSTRAINT DF_ProviderEvent_active DEFAULT ('Y'),
    createDate DATETIME NOT NULL CONSTRAINT DF_ProviderEvent_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_ProviderEvent_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_ProviderEvent_lastUpdateUser DEFAULT (SUSER_SNAME()),
    
    CONSTRAINT FK_ProviderEvent_Provider FOREIGN KEY (providerId) REFERENCES dbo.Provider(providerId),
    CONSTRAINT FK_ProviderEvent_Protocol FOREIGN KEY (ProtocolId) REFERENCES dbo.Protocol(ProtocolId),
    CONSTRAINT FK_ProviderEvent_ProtocolAttribute FOREIGN KEY (ProtocolAttributeId) REFERENCES dbo.ProtocolAttribute(ProtocolAttributeId),
    CONSTRAINT UQ_ProviderEvent_Type UNIQUE (providerId, providerEventType)
);
GO

-- Create indexes
CREATE INDEX IX_ProviderEvent_ProviderId ON dbo.ProviderEvent (providerId);
CREATE INDEX IX_ProviderEvent_Namespace ON dbo.ProviderEvent (providerNamespace);
CREATE INDEX IX_ProviderEvent_ProtocolAttributeCode ON dbo.ProviderEvent (protocolAttributeCode);
CREATE NONCLUSTERED INDEX IX_ProviderEvent_ProtocolId 
ON dbo.ProviderEvent(ProtocolId) INCLUDE (ProviderEventType, ProtocolAttributeId);
CREATE NONCLUSTERED INDEX IX_ProviderEvent_ProtocolAttributeId 
ON dbo.ProviderEvent(ProtocolAttributeId) INCLUDE (ProviderEventType, ValueJsonPath);
GO

-- Trigger to update timestamp and user
IF OBJECT_ID('TRG_ProviderEvent_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_ProviderEvent_UpdateTimestamp;
GO

CREATE TRIGGER TRG_ProviderEvent_UpdateTimestamp
ON dbo.ProviderEvent
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE pe
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM dbo.ProviderEvent pe
    INNER JOIN inserted i ON pe.providerEventId = i.providerEventId;
END;
GO

-- ============================================================================
-- ProviderEvent Table Schema Summary (2026-02-18)
-- ============================================================================
-- Complete multi-protocol provider event catalog with configuration-driven extraction
-- Supports: Junction (LOINC), Terra (Health API), SignalK (Maritime), and custom protocols
-- 
-- Configuration Columns:
--   ProtocolId - Links to Protocol (e.g., LOINC, SignalK)
--   ProtocolAttributeId - Links to ProtocolAttribute for extraction rules
--   ValueJsonPath - JSONPath to scalar value (e.g., $.data.heart_rate_data.summary.avg_hr_bpm)
--   SampleArrayPath - JSONPath to array of samples for detailed metrics
--   CompositeValueTemplate - Template for extracting values from array elements
--   FieldMappingJSON - Entity field mappings (EntityIdField, TimestampField, Unit, etc.)
--
-- Indexes: Performance optimization for Protocol/Provider lookups
--   IX_ProviderEvent_ProtocolId - For protocol-based event filtering
--   IX_ProviderEvent_ProtocolAttributeId - For attribute extraction rule lookups
-- ============================================================================

-- Seed: Standard provider event types catalog with schemas (idempotent)
-- Reference: https://docs.junction.com/events and https://docs.terra.conduit.dev/reference/events

IF OBJECT_ID('ProviderEvent','U') IS NOT NULL AND OBJECT_ID('Provider','U') IS NOT NULL
BEGIN
    DECLARE @JunctionProviderId INT;
    DECLARE @TerraProviderId INT;
    
    SELECT @JunctionProviderId = providerId FROM Provider WHERE providerName = 'Junction';
    SELECT @TerraProviderId = providerId FROM Provider WHERE providerName = 'Terra';
    
    -- ============ JUNCTION EVENTS ============
    IF @JunctionProviderId IS NOT NULL
    BEGIN
        -- Vitals: Heart Rate
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.heart_rate.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.heart_rate.update', 'Heart rate measurement update', 'vitals', 'heart_rate', '1.0', '8867-4',
                N'{"type":"object","properties":{"heartRate":{"type":"number","description":"Heart rate in beats per minute"},"unit":{"type":"string","enum":["bpm"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["heartRate","timestamp"]');
        
        -- Vitals: Blood Pressure
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.blood_pressure.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.blood_pressure.update', 'Blood pressure (systolic/diastolic) measurement update', 'vitals', 'blood_pressure', '1.0', '8480-6',
                N'{"type":"object","properties":{"systolic":{"type":"number","description":"Systolic pressure in mmHg"},"diastolic":{"type":"number","description":"Diastolic pressure in mmHg"},"unit":{"type":"string","enum":["mmHg"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["systolic","diastolic","timestamp"]');
        
        -- Vitals: Body Temperature
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.body_temperature.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.body_temperature.update', 'Body temperature measurement update', 'vitals', 'body_temperature', '1.0', '8310-5',
                N'{"type":"object","properties":{"temperature":{"type":"number","description":"Temperature value"},"unit":{"type":"string","enum":["C","F"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["temperature","unit","timestamp"]');
        
        -- Vitals: Oxygen Saturation
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.oxygen_saturation.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.oxygen_saturation.update', 'Oxygen saturation (SpO2) measurement update', 'vitals', 'oxygen_saturation', '1.0', '59408-5',
                N'{"type":"object","properties":{"spO2":{"type":"number","description":"Oxygen saturation percentage","minimum":0,"maximum":100},"unit":{"type":"string","enum":["%"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["spO2","timestamp"]');
        
        -- Vitals: Respiration Rate
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.respiration_rate.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.respiration_rate.update', 'Respiration rate measurement update', 'vitals', 'respiration_rate', '1.0', '9279-1',
                N'{"type":"object","properties":{"respirationRate":{"type":"number","description":"Breaths per minute"},"unit":{"type":"string","enum":["breaths/min"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["respirationRate","timestamp"]');
        
        -- Vitals: Heart Rate Variability
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.heart_rate_variability.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.heart_rate_variability.update', 'Heart rate variability (HRV) measurement update', 'vitals', 'heart_rate_variability', '1.0', '80404-7',
                N'{"type":"object","properties":{"hrv":{"type":"number","description":"Heart rate variability in milliseconds"},"unit":{"type":"string","enum":["ms"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["hrv","timestamp"]');
        
        -- Vitals: Glucose (Blood)
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.glucose.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.glucose.update', 'Glucose measurement update (blood)', 'vitals', 'glucose', '1.0', '2339-0',
                N'{"type":"object","properties":{"glucose":{"type":"number","description":"Glucose concentration in blood"},"unit":{"type":"string","enum":["mg/dL","mmol/L"]},"sampleType":{"type":"string","enum":["blood","serum","plasma"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["glucose","unit","timestamp"]');
        
        -- Vitals: Glucose (Serum/Plasma)
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.glucose.serum.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.glucose.serum.update', 'Glucose measurement update (serum/plasma)', 'vitals', 'glucose_serum', '1.0', '2345-7',
                N'{"type":"object","properties":{"glucose":{"type":"number","description":"Glucose concentration in serum or plasma"},"unit":{"type":"string","enum":["mg/dL","mmol/L"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["glucose","unit","timestamp"]');
        
         IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.diastolic_blood_pressure.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.diastolic_blood_pressure.update', 'Diastolic blood pressure measurement update', 'vitals', 'diastolic_blood_pressure', '1.0', '8462-4',
                N'{"type":"object","properties":{"diastolic":{"type":"number","description":"Diastolic pressure in mmHg"},"unit":{"type":"string","enum":["mmHg"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["diastolic","timestamp"]');
        
        -- Vitals: Heart Rate - Resting
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.heart_rate.resting.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.heart_rate.resting.update', 'Resting heart rate measurement update', 'vitals', 'heart_rate_resting', '1.0', '8418-4',
                N'{"type":"object","properties":{"restingHeartRate":{"type":"number","description":"Resting heart rate in beats per minute"},"unit":{"type":"string","enum":["bpm"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["restingHeartRate","timestamp"]');
        
        -- Vitals: Heart Rate - Minimum
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.heart_rate.minimum.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.heart_rate.minimum.update', 'Minimum heart rate measurement update', 'vitals', 'heart_rate_minimum', '1.0', '8638-5',
                N'{"type":"object","properties":{"minimumHeartRate":{"type":"number","description":"Minimum heart rate in beats per minute"},"unit":{"type":"string","enum":["bpm"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["minimumHeartRate","timestamp"]');
        
        -- Vitals: Heart Rate - Maximum
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.heart_rate.maximum.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.heart_rate.maximum.update', 'Maximum heart rate measurement update', 'vitals', 'heart_rate_maximum', '1.0', '8639-3',
                N'{"type":"object","properties":{"maximumHeartRate":{"type":"number","description":"Maximum heart rate in beats per minute"},"unit":{"type":"string","enum":["bpm"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["maximumHeartRate","timestamp"]');
        
        -- Vitals: Atrial Fibrillation Detection
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'vitals.atrial_fibrillation_detection.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'vitals.atrial_fibrillation_detection.update', 'Atrial fibrillation detection update', 'vitals', 'atrial_fibrillation_detection', '1.0', '80358-0',
                N'{"type":"object","properties":{"atrialFibrillationDetected":{"type":"boolean","description":"Whether atrial fibrillation was detected"},"confidence":{"type":"number","description":"Confidence level (0-100)"},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["atrialFibrillationDetected","timestamp"]');
        
        -- Activity: Steps
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'activity.steps.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'activity.steps.update', 'Step count update', 'activity', 'steps', '1.0', '55411-3',
                N'{"type":"object","properties":{"steps":{"type":"integer","description":"Number of steps"},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["steps","timestamp"]');
        
        -- Activity: Calories
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'activity.calories.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'activity.calories.update', 'Calorie burn update', 'activity', 'calories', '1.0', '41981-2',
                N'{"type":"object","properties":{"calories":{"type":"number","description":"Calories burned"},"unit":{"type":"string","enum":["kcal"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["calories","timestamp"]');
        
        -- Activity: Distance
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'activity.distance.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'activity.distance.update', 'Distance traveled update', 'activity', 'distance', '1.0', '8466-5',
                N'{"type":"object","properties":{"distance":{"type":"number","description":"Distance traveled"},"unit":{"type":"string","enum":["km","mi"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["distance","unit","timestamp"]');
        
        -- Sleep: Session Created
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'sleep.session.created')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'sleep.session.created', 'Sleep session started', 'sleep', 'session', '1.0', '93831-0',
                N'{"type":"object","properties":{"sessionId":{"type":"string"},"startTime":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["sessionId","startTime"]');
        
        -- Sleep: Session Updated
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'sleep.session.updated')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'sleep.session.updated', 'Sleep session updated', 'sleep', 'session', '1.0', '93831-0',
                N'{"type":"object","properties":{"sessionId":{"type":"string"},"startTime":{"type":"string","format":"date-time"},"endTime":{"type":"string","format":"date-time"},"duration":{"type":"number","description":"Duration in minutes"},"source":{"type":"string"}}}',
                N'["sessionId","startTime","endTime"]');
        
        -- Location: Update
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'location.update')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'location.update', 'Location coordinates update', 'location', 'update', '1.0', '33018-7',
                N'{"type":"object","properties":{"latitude":{"type":"number","minimum":-90,"maximum":90},"longitude":{"type":"number","minimum":-180,"maximum":180},"accuracy":{"type":"number"},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
                N'["latitude","longitude","timestamp"]');
        
        -- Device: Sync Completed
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'device.sync.completed')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'device.sync.completed', 'Device data sync completed', 'device', 'sync', '1.0', 'device.sync.completed',
                N'{"type":"object","properties":{"deviceId":{"type":"string"},"syncTime":{"type":"string","format":"date-time"},"status":{"type":"string","enum":["success","partial","failed"]}}}',
                N'["deviceId","syncTime"]');
        
        -- Device: Connected
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'device.connected')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'device.connected', 'Device connected', 'device', 'connected', '1.0', 'device.connected',
                N'{"type":"object","properties":{"deviceId":{"type":"string"},"deviceName":{"type":"string"},"connectTime":{"type":"string","format":"date-time"}}}',
                N'["deviceId","connectTime"]');
        
        -- Device: Disconnected
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @JunctionProviderId AND providerEventType = 'device.disconnected')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@JunctionProviderId, 'device.disconnected', 'Device disconnected', 'device', 'disconnected', '1.0', 'device.disconnected',
                N'{"type":"object","properties":{"deviceId":{"type":"string"},"disconnectTime":{"type":"string","format":"date-time"}}}',
                N'["deviceId","disconnectTime"]');
    END
    
    -- ============ TERRA EVENTS ============
    IF @TerraProviderId IS NOT NULL
    BEGIN
        -- Body: Heart Rate
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.heart_rate')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.heart_rate', 'Heart rate measurement', 'body', 'heart_rate', '1.0', '8867-4',
                N'{"type":"object","properties":{"bpm":{"type":"number","description":"Heart rate in beats per minute"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["bpm","timestamp"]');
        
        -- Body: Blood Pressure
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.blood_pressure')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.blood_pressure', 'Blood pressure measurement', 'body', 'blood_pressure', '1.0', '8480-6',
                N'{"type":"object","properties":{"systolic_mmhg":{"type":"number"},"diastolic_mmhg":{"type":"number"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["systolic_mmhg","diastolic_mmhg","timestamp"]');
        
        -- Body: Temperature
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.temperature')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.temperature', 'Body temperature measurement', 'body', 'temperature', '1.0', '8310-5',
                N'{"type":"object","properties":{"celsius":{"type":"number"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["celsius","timestamp"]');
        
        -- Body: Oxygen Saturation
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.oxygen_saturation')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.oxygen_saturation', 'Oxygen saturation measurement', 'body', 'oxygen_saturation', '1.0', '59408-5',
                N'{"type":"object","properties":{"percentage":{"type":"number","minimum":0,"maximum":100},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["percentage","timestamp"]');
        
        -- Body: Respiration Rate
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.respiration_rate')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.respiration_rate', 'Respiration rate measurement', 'body', 'respiration_rate', '1.0', '9279-1',
                N'{"type":"object","properties":{"breaths_per_minute":{"type":"number"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["breaths_per_minute","timestamp"]');
        
        -- Body: Heart Rate Variability
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.heart_rate_variability')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.heart_rate_variability', 'Heart rate variability measurement', 'body', 'heart_rate_variability', '1.0', '80404-7',
                N'{"type":"object","properties":{"rmssd_ms":{"type":"number","description":"RMSSD in milliseconds"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["rmssd_ms","timestamp"]');
        
        -- Body: Glucose (Blood)
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.glucose')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.glucose', 'Glucose measurement (blood)', 'body', 'glucose', '1.0', '2339-0',
                N'{"type":"object","properties":{"mg_dl":{"type":"number","description":"Glucose in mg/dL"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["mg_dl","timestamp"]');
        
        -- Body: Glucose (Serum/Plasma)
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.glucose.serum')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.glucose.serum', 'Glucose measurement (serum/plasma)', 'body', 'glucose_serum', '1.0', '2345-7',
                N'{"type":"object","properties":{"mg_dl":{"type":"number","description":"Glucose in serum/plasma (mg/dL)"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["mg_dl","timestamp"]');
        
         IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.diastolic_blood_pressure')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.diastolic_blood_pressure', 'Diastolic blood pressure measurement', 'body', 'diastolic_blood_pressure', '1.0', '8462-4',
                N'{"type":"object","properties":{"diastolic_mmhg":{"type":"number"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["diastolic_mmhg","timestamp"]');
        
        -- Body: Heart Rate - Resting
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.heart_rate.resting')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.heart_rate.resting', 'Resting heart rate measurement', 'body', 'heart_rate_resting', '1.0', '8418-4',
                N'{"type":"object","properties":{"bpm":{"type":"number","description":"Resting heart rate in beats per minute"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["bpm","timestamp"]');
        
        -- Body: Heart Rate - Minimum
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.heart_rate.minimum')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.heart_rate.minimum', 'Minimum heart rate measurement', 'body', 'heart_rate_minimum', '1.0', '8638-5',
                N'{"type":"object","properties":{"bpm":{"type":"number","description":"Minimum heart rate in beats per minute"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["bpm","timestamp"]');
        
        -- Body: Heart Rate - Maximum
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.heart_rate.maximum')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.heart_rate.maximum', 'Maximum heart rate measurement', 'body', 'heart_rate_maximum', '1.0', '8639-3',
                N'{"type":"object","properties":{"bpm":{"type":"number","description":"Maximum heart rate in beats per minute"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["bpm","timestamp"]');
        
        -- Body: Atrial Fibrillation Detection
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'body.atrial_fibrillation_detection')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'body.atrial_fibrillation_detection', 'Atrial fibrillation detection', 'body', 'atrial_fibrillation_detection', '1.0', '80358-0',
                N'{"type":"object","properties":{"detected":{"type":"boolean","description":"Whether atrial fibrillation was detected"},"confidence":{"type":"number","description":"Confidence level (0-100)"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["detected","timestamp"]');
      
        -- Activity: Steps
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'activity.steps')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'activity.steps', 'Step count', 'activity', 'steps', '1.0', '55411-3',
                N'{"type":"object","properties":{"count":{"type":"integer"},"start_time":{"type":"string","format":"date-time"},"end_time":{"type":"string","format":"date-time"}}}',
                N'["count","start_time","end_time"]');
        
        -- Activity: Calories
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'activity.calories')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'activity.calories', 'Calorie expenditure', 'activity', 'calories', '1.0', '41981-2',
                N'{"type":"object","properties":{"total_kcal":{"type":"number"},"start_time":{"type":"string","format":"date-time"},"end_time":{"type":"string","format":"date-time"}}}',
                N'["total_kcal","start_time","end_time"]');
        
        -- Activity: Distance
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'activity.distance')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'activity.distance', 'Distance traveled', 'activity', 'distance', '1.0', '8466-5',
                N'{"type":"object","properties":{"meters":{"type":"number"},"start_time":{"type":"string","format":"date-time"},"end_time":{"type":"string","format":"date-time"}}}',
                N'["meters","start_time","end_time"]');
        
        -- Activity: Duration
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'activity.duration')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'activity.duration', 'Activity duration', 'activity', 'duration', '1.0', '73985-4',
                N'{"type":"object","properties":{"seconds":{"type":"integer"},"start_time":{"type":"string","format":"date-time"},"end_time":{"type":"string","format":"date-time"}}}',
                N'["seconds","start_time","end_time"]');
        
        -- Sleep: Get
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'sleep.get')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'sleep.get', 'Sleep data', 'sleep', 'get', '1.0', '93831-0',
                N'{"type":"object","properties":{"duration_seconds":{"type":"integer"},"start_time":{"type":"string","format":"date-time"},"end_time":{"type":"string","format":"date-time"},"quality":{"type":"string"}}}',
                N'["duration_seconds","start_time","end_time"]');
        
        -- Nutrition: Get
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'nutrition.get')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'nutrition.get', 'Nutrition data', 'nutrition', 'get', '1.0', '33479-0',
                N'{"type":"object","properties":{"calories_kcal":{"type":"number"},"macros":{"type":"object","properties":{"protein_g":{"type":"number"},"carbs_g":{"type":"number"},"fat_g":{"type":"number"}}},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["calories_kcal","timestamp"]');
        
        -- Menstruation: Get
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'menstruation.get')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'menstruation.get', 'Menstruation data', 'menstruation', 'get', '1.0', '29554-3',
                N'{"type":"object","properties":{"startDate":{"type":"string","format":"date"},"endDate":{"type":"string","format":"date"},"cycle_length":{"type":"integer"}}}',
                N'["startDate"]');
        
        -- User: Authentication Success
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'user.authentication_success')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'user.authentication_success', 'User authentication successful', 'user', 'authentication_success', '1.0',
                N'{"type":"object","properties":{"userId":{"type":"string"},"timestamp":{"type":"string","format":"date-time"},"provider":{"type":"string"}}}',
                N'["userId","timestamp"]');
        
        -- User: Authentication Failed
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'user.authentication_failed')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'user.authentication_failed', 'User authentication failed', 'user', 'authentication_failed', '1.0',
                N'{"type":"object","properties":{"userId":{"type":"string"},"timestamp":{"type":"string","format":"date-time"},"reason":{"type":"string"}}}',
                N'["userId","timestamp","reason"]');
        
        -- User: Deauthentication
        IF NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = @TerraProviderId AND providerEventType = 'user.deauthentication')
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, payloadSchema, requiredFields)
            VALUES (@TerraProviderId, 'user.deauthentication', 'User deauthentication', 'user', 'deauthentication', '1.0',
                N'{"type":"object","properties":{"userId":{"type":"string"},"timestamp":{"type":"string","format":"date-time"}}}',
                N'["userId","timestamp"]');
    END
    
END
GO

-- ============================================================================
-- Completion Message
-- ============================================================================
PRINT '✓ ProviderEvent table created successfully with complete configuration';
PRINT '  Base columns: providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName';
PRINT '  Schema info: payloadSchema, requiredFields, protocolAttributeCode';
PRINT '  Configuration: ProtocolId, ProtocolAttributeId, ValueJsonPath, SampleArrayPath, CompositeValueTemplate, FieldMappingJSON';
PRINT '  Indexes: ProviderId, Namespace, ProtocolAttributeCode, ProtocolId (composite), ProtocolAttributeId (composite)';
PRINT '  Seed data: Junction and Terra provider event catalogs populated';
PRINT '';
PRINT 'Ready for generic multi-protocol consumer implementation';