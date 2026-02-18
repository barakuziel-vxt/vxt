-- Complete setup examples for all protocols
-- Run this AFTER 0007_Create_Protocol_and_Mapping_tables.sql

-- ============================================================
-- SECTION 1: VERIFY PROTOCOL SETUP
-- ============================================================

-- Check all protocols loaded
SELECT * FROM Protocol ORDER BY protocolName;
GO

-- Count attributes per protocol
SELECT 
    p.protocolName,
    COUNT(DISTINCT pa.protocolAttributeId) AS AttributeCount,
    COUNT(DISTINCT pam.entityTypeAttributeCode) AS MappingCount
FROM Protocol p
LEFT JOIN ProtocolAttribute pa ON p.protocolId = pa.protocolId AND pa.active = 'Y'
LEFT JOIN ProtocolAttributeMapping pam ON pa.protocolAttributeId = pam.protocolAttributeId AND pam.active = 'Y'
GROUP BY p.protocolName
ORDER BY p.protocolName;
GO

-- ============================================================
-- SECTION 2: ADD JUNCTION PROTOCOL CONFIGURATION
-- ============================================================

-- Check if Junction protocol exists
DECLARE @junctionProtocolId INT = (SELECT protocolId FROM Protocol WHERE protocolName = 'Junction');

IF @junctionProtocolId IS NULL
BEGIN
    INSERT INTO Protocol (protocolName, protocolVersion, description, kafkaTopic)
    VALUES ('Junction', '1.0', 'Junction Health Provider IoT Protocol', 'junction-events');
    
    SET @junctionProtocolId = SCOPE_IDENTITY();
    
    -- Add Junction attributes
    INSERT INTO ProtocolAttribute 
    (protocolId, protocolAttributeCode, protocolAttributeName, description, unit, dataType, jsonPath)
    VALUES
    (@junctionProtocolId, 'junction.userId', 'User ID', 'Patient/User identifier', NULL, 'string', '$.userId'),
    (@junctionProtocolId, 'junction.timestamp', 'Timestamp', 'Event timestamp', NULL, 'string', '$.timestamp'),
    (@junctionProtocolId, 'junction.heartRate', 'Heart Rate', 'Heart rate from wearable', '{beats}/min', 'number', '$.vitals.heartRate'),
    (@junctionProtocolId, 'junction.bloodPressureSys', 'Blood Pressure Systolic', 'Systolic pressure', 'mmHg', 'number', '$.vitals.bloodPressure.systolic'),
    (@junctionProtocolId, 'junction.bloodPressureDia', 'Blood Pressure Diastolic', 'Diastolic pressure', 'mmHg', 'number', '$.vitals.bloodPressure.diastolic'),
    (@junctionProtocolId, 'junction.bodyTemp', 'Body Temperature', 'Measured body temperature', 'C', 'number', '$.vitals.bodyTemperature'),
    (@junctionProtocolId, 'junction.spO2', 'Blood Oxygen Saturation', 'SpO2 percentage', '%', 'number', '$.vitals.oxygenSaturation'),
    (@junctionProtocolId, 'junction.bloodGlucose', 'Blood Glucose', 'Glucose level', 'mg/dL', 'number', '$.vitals.bloodGlucose'),
    (@junctionProtocolId, 'junction.respirationRate', 'Respiration Rate', 'Breaths per minute', '{breaths}/min', 'number', '$.vitals.respirationRate');
    
    -- Map Junction attributes to EntityTypeAttribute
    DECLARE @attrId INT;
    
    -- Heart Rate
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @junctionProtocolId AND protocolAttributeCode = 'junction.heartRate';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'AvgHR', 'NONE', 2);
    
    -- Systolic
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @junctionProtocolId AND protocolAttributeCode = 'junction.bloodPressureSys';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'Systolic', 'NONE', 2);
    
    -- Diastolic
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @junctionProtocolId AND protocolAttributeCode = 'junction.bloodPressureDia';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'Diastolic', 'NONE', 2);
    
    -- Body Temperature
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @junctionProtocolId AND protocolAttributeCode = 'junction.bodyTemp';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'BodyTemp', 'NONE', 2);
    
    -- Oxygen Saturation
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @junctionProtocolId AND protocolAttributeCode = 'junction.spO2';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'OxygenSat', 'NONE', 2);
    
    -- Blood Glucose
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @junctionProtocolId AND protocolAttributeCode = 'junction.bloodGlucose';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'AvgGlucose', 'NONE', 2);
    
    -- Respiration Rate
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @junctionProtocolId AND protocolAttributeCode = 'junction.respirationRate';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'BreathsPerMin', 'NONE', 2);
    
    PRINT 'Junction protocol and mappings configured successfully';
END
ELSE
BEGIN
    PRINT 'Junction protocol already exists';
END
GO

-- ============================================================
-- SECTION 3: ADD TERRA PROTOCOL CONFIGURATION
-- ============================================================

DECLARE @terraProtocolId INT = (SELECT protocolId FROM Protocol WHERE protocolName = 'Terra');

IF @terraProtocolId IS NULL
BEGIN
    INSERT INTO Protocol (protocolName, protocolVersion, description, kafkaTopic)
    VALUES ('Terra', '1.0', 'Terra Health Wearable Platform', 'health-vitals');
    
    SET @terraProtocolId = SCOPE_IDENTITY();
    
    -- Add Terra attributes
    INSERT INTO ProtocolAttribute 
    (protocolId, protocolAttributeCode, protocolAttributeName, description, unit, dataType, jsonPath, rangeMin, rangeMax)
    VALUES
    (@terraProtocolId, 'terra.userId', 'User ID', 'Patient identifier from Terra', NULL, 'string', '$.userId', NULL, NULL),
    (@terraProtocolId, 'terra.heart_rate', 'Heart Rate', 'Real-time heart rate', '{beats}/min', 'number', '$.heart_rate', 30, 200),
    (@terraProtocolId, 'terra.heart_rate_variability', 'HRV', 'Heart rate variability', 'ms', 'number', '$.heart_rate_variability', 0, 500),
    (@terraProtocolId, 'terra.systolic', 'Systolic Pressure', 'Systolic blood pressure', 'mmHg', 'number', '$.blood_pressure.systolic', 80, 200),
    (@terraProtocolId, 'terra.diastolic', 'Diastolic Pressure', 'Diastolic blood pressure', 'mmHg', 'number', '$.blood_pressure.diastolic', 40, 120),
    (@terraProtocolId, 'terra.body_temperature', 'Body Temperature', 'Core body temperature', 'C', 'number', '$.body_temperature', 35, 40),
    (@terraProtocolId, 'terra.spo2', 'SpO2', 'Blood oxygen saturation', '%', 'number', '$.spo2', 70, 100),
    (@terraProtocolId, 'terra.steps', 'Steps', 'Daily step count', 'steps', 'number', '$.steps', 0, 100000),
    (@terraProtocolId, 'terra.calories', 'Calories Burned', 'Estimated calories', 'kcal', 'number', '$.calories', 0, 5000),
    (@terraProtocolId, 'terra.active_duration', 'Active Duration', 'Time spent active', 'minutes', 'number', '$.active_duration', 0, 1440);
    
    -- Map Terra attributes
    DECLARE @attrId INT;
    
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @terraProtocolId AND protocolAttributeCode = 'terra.heart_rate';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'AvgHR', 'NONE', 3);
    
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @terraProtocolId AND protocolAttributeCode = 'terra.heart_rate_variability';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'HRV_RMSSD', 'NONE', 3);
    
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @terraProtocolId AND protocolAttributeCode = 'terra.systolic';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'Systolic', 'NONE', 3);
    
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @terraProtocolId AND protocolAttributeCode = 'terra.diastolic';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'Diastolic', 'NONE', 3);
    
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @terraProtocolId AND protocolAttributeCode = 'terra.body_temperature';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'BodyTemp', 'NONE', 3);
    
    SELECT @attrId = protocolAttributeId FROM ProtocolAttribute WHERE protocolId = @terraProtocolId AND protocolAttributeCode = 'terra.spo2';
    INSERT INTO ProtocolAttributeMapping (protocolAttributeId, entityTypeAttributeCode, transformationLanguage, priority)
    VALUES (@attrId, 'OxygenSat', 'NONE', 3);
    
    PRINT 'Terra protocol and mappings configured successfully';
END
ELSE
BEGIN
    PRINT 'Terra protocol already exists';
END
GO

-- ============================================================
-- SECTION 4: VERIFY COMPLETE SETUP
-- ============================================================

-- Show complete protocol mapping overview
SELECT 
    'Protocol Overview' AS Section,
    p.protocolName,
    COUNT(DISTINCT pa.protocolAttributeId) AS TotalAttributes,
    COUNT(DISTINCT pam.entityTypeAttributeCode) AS MappedAttributes,
    STRING_AGG(DISTINCT pam.entityTypeAttributeCode, ', ') AS MappedCodes
FROM Protocol p
LEFT JOIN ProtocolAttribute pa ON p.protocolId = pa.protocolId AND pa.active = 'Y'
LEFT JOIN ProtocolAttributeMapping pam ON pa.protocolAttributeId = pam.protocolAttributeId AND pam.active = 'Y'
WHERE p.active = 'Y'
GROUP BY p.protocolName
ORDER BY p.protocolName;
GO

-- Show detailed mappings for each protocol
SELECT 
    p.protocolName,
    pa.protocolAttributeCode,
    pa.protocolAttributeName,
    pa.jsonPath,
    pam.entityTypeAttributeCode,
    pam.transformationRule,
    pam.priority
FROM ProtocolAttributeMapping pam
JOIN ProtocolAttribute pa ON pam.protocolAttributeId = pa.protocolAttributeId
JOIN Protocol p ON pa.protocolId = p.protocolId
WHERE p.active = 'Y' AND pa.active = 'Y' AND pam.active = 'Y'
ORDER BY p.protocolName, pam.entityTypeAttributeCode, pam.priority DESC;
GO

-- ============================================================
-- SECTION 5: SAMPLE EVENT STRUCTURES (For Reference)
-- ============================================================

/*
LOINC/HealthVitals Event from Terra:
{
  "entityId": "033114869",
  "timestamp": "2024-02-13T10:30:00Z",
  "protocolAttributes": {
    "userId": "033114869",
    "heart_rate": 75,
    "heart_rate_variability": 45.2,
    "blood_pressure": {
      "systolic": 120,
      "diastolic": 80
    },
    "body_temperature": 36.8,
    "spo2": 98.5,
    "steps": 8542,
    "calories": 350.5,
    "active_duration": 45
  }
}

Junction Health Provider Event:
{
  "entityId": "033114869",
  "timestamp": "2024-02-13T10:35:00Z",
  "protocolAttributes": {
    "userId": "033114869",
    "vitals": {
      "heartRate": 78,
      "bloodPressure": {
        "systolic": 118,
        "diastolic": 82
      },
      "bodyTemperature": 36.7,
      "oxygenSaturation": 97.8,
      "bloodGlucose": 105,
      "respirationRate": 16
    }
  }
}

SignalK Event from Yacht:
{
  "entityId": "234567890",
  "timestamp": "2024-02-13T10:40:00Z",
  "protocolAttributes": {
    "context": {
      "vessel": {
        "navigation": {
          "courseOverGroundMagnetic": 1.5708,
          "courseOverGroundTrue": 1.6209,
          "speedOverGround": 5.5,
          "position": {
            "latitude": 40.7128,
            "longitude": -74.0060
          }
        },
        "propulsion": {
          "port": {
            "engineSpeed": 2000,
            "engineTemperature": 363.15,
            "engineLoad": 65
          }
        }
      }
    }
  }
}
*/

-- ============================================================
-- SECTION 6: TESTING THE SMART CONSUMER
-- ============================================================

-- Create a test event in a temp table to verify extraction would work
CREATE TABLE #TestEvent (
    eventId INT IDENTITY(1,1),
    eventJson NVARCHAR(MAX),
    insertedAt DATETIME DEFAULT GETDATE()
);

-- Insert test events
INSERT INTO #TestEvent (eventJson) VALUES (
    '{"entityId": "033114869", "timestamp": "2024-02-13T10:30:00Z", "protocolAttributes": {"heart_rate": 75, "blood_pressure": {"systolic": 120, "diastolic": 80}, "body_temperature": 36.8, "spo2": 98.5}}'
);

INSERT INTO #TestEvent (eventJson) VALUES (
    '{"entityId": "234567890", "timestamp": "2024-02-13T10:40:00Z", "protocolAttributes": {"context": {"vessel": {"navigation": {"speedOverGround": 5.5, "position": {"latitude": 40.7128, "longitude": -74.0060}}}}}}'
);

-- Query test events
SELECT * FROM #TestEvent;

-- Cleanup
DROP TABLE #TestEvent;
GO

PRINT '=== Protocol Configuration Complete ===';
PRINT 'Run the smart_protocol_consumer.py to start consuming events!';
