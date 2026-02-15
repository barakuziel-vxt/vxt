-- Create EntityTypeAttribute table and seed attributes from HealthVitals
-- Composite PK (entityTypeId + entityTypeAttributeCode), unique name, control columns and FK to EntityType

DROP TABLE IF EXISTS EntityTypeAttribute;
GO

CREATE TABLE EntityTypeAttribute (
    entityTypeAttributeId INT IDENTITY(1,1) NOT NULL,
    entityTypeId INT NOT NULL,
    protocolId INT NULL,
    entityTypeAttributeCode NVARCHAR(100) NOT NULL, -- e.g. '8867-4', '8480-6', '9279-1', '2710-2', '8867-4', etc
    entityTypeAttributeName VARCHAR(200) NOT NULL, -- e.g. 'HeartRate', 'SystolicBP', 'RespirationRate', 'SpO2', 'Pulse', etc
    entityTypeAttributeTimeAspect NVARCHAR(50) NOT NULL, -- e.g., 'Pt' (point in time), 'Mean', 'Max', 'Min'
    entityTypeAttributeUnit NVARCHAR(50) NOT NULL, -- e.g. 'bpm', 'mmHg', '°C', 'knots', etc (optional, for quick querying)
    providerId INT NULL,  
    providerEventType NVARCHAR(100) NULL,
    active CHAR(1) NOT NULL CONSTRAINT DF_EntityTypeAttribute_active DEFAULT 'Y',
    createDate DATETIME NOT NULL CONSTRAINT DF_EntityTypeAttribute_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_EntityTypeAttribute_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_EntityTypeAttribute_lastUpdateUser DEFAULT (SUSER_SNAME()),
    CONSTRAINT PK_EntityTypeAttribute PRIMARY KEY (entityTypeAttributeId),
    CONSTRAINT UQ_EntityTypeAttribute_Name UNIQUE (entityTypeId,entityTypeAttributeName),
    CONSTRAINT FK_EntityTypeAttribute_EntityType FOREIGN KEY (entityTypeId) REFERENCES EntityType(entityTypeId),
    CONSTRAINT FK_EntityTypeAttribute_Protocol FOREIGN KEY (protocolId, entityTypeAttributeCode) REFERENCES ProtocolAttribute(protocolId, protocolAttributeCode),
    CONSTRAINT FK_EntityTypeAttribute_ProviderEvent FOREIGN KEY (providerId,providerEventType) REFERENCES ProviderEvent(providerId,providerEventType)
);
GO

-- Trigger to keep lastUpdateTimestamp and lastUpdateUser current
IF OBJECT_ID('TRG_EntityTypeAttribute_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_EntityTypeAttribute_UpdateTimestamp;
GO

CREATE TRIGGER TRG_EntityTypeAttribute_UpdateTimestamp
ON EntityTypeAttribute
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE t
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM EntityTypeAttribute t
    INNER JOIN inserted i ON t.entityTypeId = i.entityTypeId AND t.entityTypeAttributeId = i.entityTypeAttributeId;
END;
GO

-- Ensure an EntityType exists for Person (uses 'Person' category if available)
IF OBJECT_ID('EntityCategories','U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM EntityType WHERE entityTypeName = 'Person')
    BEGIN
        INSERT INTO EntityType (entityTypeName, entityCategoryId) 
        VALUES ('Person', (SELECT entityCategoryId FROM EntityCategories WHERE entityCategoryName = 'Person'));
    END
END
GO

-- Optional: show what was inserted (commented out by default)
-- SELECT * FROM EntityTypeAttribute WHERE entityTypeId = (SELECT entityTypeId FROM EntityType WHERE entityTypeName = 'Person') ORDER BY entityTypeAttributeCode;

-- Insert LOINC-based health vital attributes for 'Person' entityType
-- Includes mapping to Junction provider events
INSERT INTO EntityTypeAttribute (entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType)
SELECT 
    et.entityTypeId,
    l.loincCode AS entityTypeAttributeCode,
    l.component AS entityTypeAttributeName,
    l.timeAspect AS entityTypeAttributeTimeAspect,
    l.telemetryUnit AS entityTypeAttributeUnit,
    pe.providerId,
    pe.providerEventType
FROM LOINC l
CROSS JOIN EntityType et
LEFT JOIN Provider p ON p.providerName = 'Junction'
LEFT JOIN ProviderEvent pe ON pe.providerId = p.providerId 
    AND pe.loincCode = l.loincCode
    AND pe.active = 'Y'
WHERE et.entityTypeName = 'Person'
  AND l.active = 'Y'
  AND NOT EXISTS (
      SELECT 1 FROM EntityTypeAttribute a
      WHERE a.entityTypeId = et.entityTypeId 
        AND a.entityTypeAttributeCode = l.loincCode
  );
GO

-- Optional: Display inserted records
SELECT * FROM EntityTypeAttribute 
WHERE entityTypeId = (SELECT entityTypeId FROM EntityType WHERE entityTypeName = 'Person') 
  AND providerId IS NOT NULL
ORDER BY entityTypeAttributeCode;
