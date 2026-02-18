-- Protocol-agnostic event streaming architecture
-- Maps multiple protocol standards (LOINC, SignalK, Junction, Terra, etc.) to EntityTypeAttribute

-- 1. CREATE PROTOCOL TABLE
DROP TABLE IF EXISTS Protocol;
GO

CREATE TABLE Protocol (
    protocolId INT IDENTITY(1,1) NOT NULL,
    protocolName NVARCHAR(50) NOT NULL,      -- e.g., 'LOINC', 'SignalK', 'Junction', 'Terra'
    protocolVersion NVARCHAR(20),             -- e.g., '2.73' for LOINC, '1.7.0' for SignalK
    description NVARCHAR(500),
    kafkaTopic NVARCHAR(100) NOT NULL,        -- Kafka topic for this protocol
    entityTypeId INT,                         -- Which EntityType does this protocol serve? (NULL = multiple)
    active CHAR(1) NOT NULL CONSTRAINT DF_Protocol_active DEFAULT 'Y',
    createDate DATETIME NOT NULL CONSTRAINT DF_Protocol_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_Protocol_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_Protocol_lastUpdateUser DEFAULT (SUSER_SNAME()),
    CONSTRAINT PK_Protocol PRIMARY KEY (protocolId),
    CONSTRAINT UQ_Protocol_Name UNIQUE (protocolName)
);
GO

-- 2. CREATE PROTOCOL ATTRIBUTE TABLE
DROP TABLE IF EXISTS ProtocolAttribute;
GO

CREATE TABLE ProtocolAttribute (
    protocolAttributeId INT IDENTITY(1,1) NOT NULL,
    protocolId INT NOT NULL,
    protocolAttributeCode NVARCHAR(100) NOT NULL,  -- e.g., '8867-4' for LOINC, 'navigation.courseOverGroundMagnetic' for SignalK
    protocolAttributeName NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    component NVARCHAR(100) NULL,                   -- e.g., 'Vital Signs', 'Navigation', 'Engine' (from protocol's component classification)
    unit NVARCHAR(50),
    dataType NVARCHAR(50) NOT NULL,                -- 'number', 'string', 'boolean', 'integer', 'decimal'
    jsonPath NVARCHAR(255),                        -- JSON path in incoming event (e.g., '$.AvgHR', '$.navigation.courseOverGroundMagnetic')
    rangeMin DECIMAL(18,2),
    rangeMax DECIMAL(18,2),
    active CHAR(1) NOT NULL CONSTRAINT DF_ProtocolAttribute_active DEFAULT 'Y',
    createDate DATETIME NOT NULL CONSTRAINT DF_ProtocolAttribute_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_ProtocolAttribute_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_ProtocolAttribute_lastUpdateUser DEFAULT (SUSER_SNAME()),
    CONSTRAINT PK_ProtocolAttribute PRIMARY KEY (protocolAttributeId),
    CONSTRAINT FK_ProtocolAttribute_Protocol FOREIGN KEY (protocolId) REFERENCES Protocol(protocolId),
    CONSTRAINT UQ_ProtocolAttribute_Code UNIQUE (protocolId, protocolAttributeCode)
);
GO

-- Trigger for ProtocolAttribute
IF OBJECT_ID('TRG_ProtocolAttribute_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_ProtocolAttribute_UpdateTimestamp;
GO

CREATE TRIGGER TRG_ProtocolAttribute_UpdateTimestamp
ON ProtocolAttribute
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE pa
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM ProtocolAttribute pa
    INNER JOIN inserted i ON pa.protocolAttributeId = i.protocolAttributeId;
END;
GO

-- Trigger for Protocol
IF OBJECT_ID('TRG_Protocol_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_Protocol_UpdateTimestamp;
GO

CREATE TRIGGER TRG_Protocol_UpdateTimestamp
ON Protocol
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE p
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM Protocol p
    INNER JOIN inserted i ON p.protocolId = i.protocolId;
END;
GO

-- ============================================
-- INSERT PROTOCOL DEFINITIONS
-- ============================================

-- LOINC Protocol (Healthcare - HealthVitals)
INSERT INTO Protocol (protocolName, protocolVersion, description, kafkaTopic)
VALUES 
    ('LOINC', '2.73', 'Logical Observation Identifiers Names and Codes - Healthcare standard', 'health-vitals'),
    ('Terra', '1.0', 'Terra Health wearable protocol', 'health-vitals'),
    ('SignalK', '1.7.0', 'SignalK maritime data protocol', 'boat-telemetry'),
    ('Junction', '1.0', 'Junction IoT event protocol', 'junction-events');
GO


-- ============================================
-- VERIFY PROTOCOL ATTRIBUTES INSERTED
-- ============================================

-- View all protocol attributes by protocol
SELECT 
    p.protocolName,
    pa.protocolAttributeCode,
    pa.protocolAttributeName,
    pa.description,
    pa.jsonPath
FROM ProtocolAttribute pa
JOIN Protocol p ON pa.protocolId = p.protocolId
ORDER BY p.protocolName, pa.protocolAttributeCode;
GO
