-- Add missing LOINC codes for Health Connect integration
-- LOINC Codes:
--   8601-7 (Body Height)
--   11524-6 (Basophil count percentage)
--   11524-8 (Basophil count absolute)
--   13132-6 (Monocyte count percentage)
--   42303-8 (Diabetes screening test)

-- ============================================================================
-- INSERT statements for ProviderEvent table (Junction provider)
-- ============================================================================

-- Body Height (8601-7)
INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
SELECT 
    (SELECT providerId FROM Provider WHERE providerName = 'Junction'),
    'body.height.update',
    'Measures body height from head to feet (in standing position)',
    'body',
    'height',
    '1.0',
    '8601-7',
    N'{"type":"object","properties":{"height":{"type":"number","description":"Body height in cm"},"unit":{"type":"string","enum":["cm","in"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
    N'["height","unit","timestamp"]'
WHERE NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = (SELECT providerId FROM Provider WHERE providerName = 'Junction') AND protocolAttributeCode = '8601-7');

-- Basophil Count Percentage (11524-6)
INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
SELECT 
    (SELECT providerId FROM Provider WHERE providerName = 'Junction'),
    'blood.basophil.percentage.update',
    'Basophil count as percentage of total white blood cells',
    'blood',
    'basophil_percentage',
    '1.0',
    '11524-6',
    N'{"type":"object","properties":{"basophilPercent":{"type":"number","description":"Basophil percentage"},"unit":{"type":"string","enum":["%"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
    N'["basophilPercent","timestamp"]'
WHERE NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = (SELECT providerId FROM Provider WHERE providerName = 'Junction') AND protocolAttributeCode = '11524-6');

-- Basophil Count Absolute (11524-8)
INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
SELECT 
    (SELECT providerId FROM Provider WHERE providerName = 'Junction'),
    'blood.basophil.count.update',
    'Absolute basophil count in blood',
    'blood',
    'basophil_count',
    '1.0',
    '11524-8',
    N'{"type":"object","properties":{"basophilCount":{"type":"number","description":"Basophil count"},"unit":{"type":"string","enum":["#/μL","K/μL"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
    N'["basophilCount","unit","timestamp"]'
WHERE NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = (SELECT providerId FROM Provider WHERE providerName = 'Junction') AND protocolAttributeCode = '11524-8');

-- Monocyte Count Percentage (13132-6)
INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
SELECT 
    (SELECT providerId FROM Provider WHERE providerName = 'Junction'),
    'blood.monocyte.percentage.update',
    'Monocyte count as percentage of total white blood cells',
    'blood',
    'monocyte_percentage',
    '1.0',
    '13132-6',
    N'{"type":"object","properties":{"monocytePercent":{"type":"number","description":"Monocyte percentage"},"unit":{"type":"string","enum":["%"]},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
    N'["monocytePercent","timestamp"]'
WHERE NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = (SELECT providerId FROM Provider WHERE providerName = 'Junction') AND protocolAttributeCode = '13132-6');

-- Diabetes Screening Test (42303-8)
INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName, providerVersion, protocolAttributeCode, payloadSchema, requiredFields)
SELECT 
    (SELECT providerId FROM Provider WHERE providerName = 'Junction'),
    'clinical.diabetes.screening.update',
    'Diabetes mellitus screening test recommendation',
    'clinical',
    'diabetes_screening',
    '1.0',
    '42303-8',
    N'{"type":"object","properties":{"status":{"type":"string","description":"Screening status"},"timestamp":{"type":"string","format":"date-time"},"source":{"type":"string"}}}',
    N'["status","timestamp"]'
WHERE NOT EXISTS (SELECT 1 FROM ProviderEvent WHERE providerId = (SELECT providerId FROM Provider WHERE providerName = 'Junction') AND protocolAttributeCode = '42303-8');

-- ============================================================================
-- INSERT statements for EntityTypeAttribute table (Person entity, Protocol 1)
-- ============================================================================

-- Body Height (8601-7)
INSERT INTO EntityTypeAttribute (entityTypeId, protocolId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active, createDate, lastUpdateTimestamp, lastUpdateUser, defaultInGraph)
SELECT 
    1,
    1,
    '8601-7',
    'Height',
    'Pt',
    'cm',
    (SELECT providerId FROM Provider WHERE providerName = 'Junction'),
    'body.height.update',
    'Y',
    CAST(GETDATE() AS DATETIME2),
    CAST(GETDATE() AS DATETIME2),
    'sa',
    'Y'
WHERE NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '8601-7' AND entityTypeId = 1);

-- Basophil Count Percentage (11524-6)
INSERT INTO EntityTypeAttribute (entityTypeId, protocolId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active, createDate, lastUpdateTimestamp, lastUpdateUser, defaultInGraph)
SELECT 
    1,
    1,
    '11524-6',
    'Basophil %',
    'Pt',
    '%',
    (SELECT providerId FROM Provider WHERE providerName = 'Junction'),
    'blood.basophil.percentage.update',
    'Y',
    CAST(GETDATE() AS DATETIME2),
    CAST(GETDATE() AS DATETIME2),
    'sa',
    'N'
WHERE NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '11524-6' AND entityTypeId = 1);

-- Basophil Count Absolute (11524-8)
INSERT INTO EntityTypeAttribute (entityTypeId, protocolId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active, createDate, lastUpdateTimestamp, lastUpdateUser, defaultInGraph)
SELECT 
    1,
    1,
    '11524-8',
    'Basophil Count',
    'Pt',
    '#/μL',
    (SELECT providerId FROM Provider WHERE providerName = 'Junction'),
    'blood.basophil.count.update',
    'Y',
    CAST(GETDATE() AS DATETIME2),
    CAST(GETDATE() AS DATETIME2),
    'sa',
    'N'
WHERE NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '11524-8' AND entityTypeId = 1);

-- Monocyte Count Percentage (13132-6)
INSERT INTO EntityTypeAttribute (entityTypeId, protocolId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active, createDate, lastUpdateTimestamp, lastUpdateUser, defaultInGraph)
SELECT 
    1,
    1,
    '13132-6',
    'Monocyte %',
    'Pt',
    '%',
    (SELECT providerId FROM Provider WHERE providerName = 'Junction'),
    'blood.monocyte.percentage.update',
    'Y',
    CAST(GETDATE() AS DATETIME2),
    CAST(GETDATE() AS DATETIME2),
    'sa',
    'N'
WHERE NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '13132-6' AND entityTypeId = 1);

-- Diabetes Screening Test (42303-8)
INSERT INTO EntityTypeAttribute (entityTypeId, protocolId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active, createDate, lastUpdateTimestamp, lastUpdateUser, defaultInGraph)
SELECT 
    1,
    1,
    '42303-8',
    'Diabetes Screening',
    'Pt',
    'text',
    (SELECT providerId FROM Provider WHERE providerName = 'Junction'),
    'clinical.diabetes.screening.update',
    'Y',
    CAST(GETDATE() AS DATETIME2),
    CAST(GETDATE() AS DATETIME2),
    'sa',
    'N'
WHERE NOT EXISTS (SELECT 1 FROM EntityTypeAttribute WHERE entityTypeAttributeCode = '42303-8' AND entityTypeId = 1);

-- ============================================================================
-- INSERT statements for ProtocolAttribute table (Protocol 1 - Health/Vitals)
-- ============================================================================

-- Body Height (8601-7)
INSERT INTO ProtocolAttribute (protocolId, protocolAttributeCode, protocolAttributeName, description, unit, dataType, jsonPath, rangeMin, rangeMax, active, createDate, lastUpdateTimestamp, lastUpdateUser, component)
SELECT 
    1,
    '8601-7',
    'Body Height',
    'Body height from head to feet (standing position)',
    'cm',
    'Qn',
    '$.loincCode_8601_7',
    100,
    250,
    'Y',
    CAST(GETDATE() AS DATETIME2),
    CAST(GETDATE() AS DATETIME2),
    'sa',
    'Anthropometric'
WHERE NOT EXISTS (SELECT 1 FROM ProtocolAttribute WHERE protocolId = 1 AND protocolAttributeCode = '8601-7');

-- Basophil Count Percentage (11524-6)
INSERT INTO ProtocolAttribute (protocolId, protocolAttributeCode, protocolAttributeName, description, unit, dataType, jsonPath, rangeMin, rangeMax, active, createDate, lastUpdateTimestamp, lastUpdateUser, component)
SELECT 
    1,
    '11524-6',
    'Basophil Count %',
    'Basophil count as percentage of total white blood cells',
    '%',
    'Qn',
    '$.loincCode_11524_6',
    0,
    100,
    'Y',
    CAST(GETDATE() AS DATETIME2),
    CAST(GETDATE() AS DATETIME2),
    'sa',
    'Hematology'
WHERE NOT EXISTS (SELECT 1 FROM ProtocolAttribute WHERE protocolId = 1 AND protocolAttributeCode = '11524-6');

-- Basophil Count Absolute (11524-8)
INSERT INTO ProtocolAttribute (protocolId, protocolAttributeCode, protocolAttributeName, description, unit, dataType, jsonPath, rangeMin, rangeMax, active, createDate, lastUpdateTimestamp, lastUpdateUser, component)
SELECT 
    1,
    '11524-8',
    'Basophil Count',
    'Absolute basophil count in blood',
    '#/μL',
    'Qn',
    '$.loincCode_11524_8',
    0,
    100,
    'Y',
    CAST(GETDATE() AS DATETIME2),
    CAST(GETDATE() AS DATETIME2),
    'sa',
    'Hematology'
WHERE NOT EXISTS (SELECT 1 FROM ProtocolAttribute WHERE protocolId = 1 AND protocolAttributeCode = '11524-8');

-- Monocyte Count Percentage (13132-6)
INSERT INTO ProtocolAttribute (protocolId, protocolAttributeCode, protocolAttributeName, description, unit, dataType, jsonPath, rangeMin, rangeMax, active, createDate, lastUpdateTimestamp, lastUpdateUser, component)
SELECT 
    1,
    '13132-6',
    'Monocyte Count %',
    'Monocyte count as percentage of total white blood cells',
    '%',
    'Qn',
    '$.loincCode_13132_6',
    0,
    100,
    'Y',
    CAST(GETDATE() AS DATETIME2),
    CAST(GETDATE() AS DATETIME2),
    'sa',
    'Hematology'
WHERE NOT EXISTS (SELECT 1 FROM ProtocolAttribute WHERE protocolId = 1 AND protocolAttributeCode = '13132-6');

-- Diabetes Screening Test (42303-8)
INSERT INTO ProtocolAttribute (protocolId, protocolAttributeCode, protocolAttributeName, description, unit, dataType, jsonPath, active, createDate, lastUpdateTimestamp, lastUpdateUser, component)
SELECT 
    1,
    '42303-8',
    'Diabetes Screening Test',
    'Diabetes mellitus screening test recommendation',
    'text',
    'Nom',
    '$.loincCode_42303_8',
    'Y',
    CAST(GETDATE() AS DATETIME2),
    CAST(GETDATE() AS DATETIME2),
    'sa',
    'Clinical Screening'
WHERE NOT EXISTS (SELECT 1 FROM ProtocolAttribute WHERE protocolId = 1 AND protocolAttributeCode = '42303-8');

-- ============================================================================
-- AFib Enum Values (LOINC 80358-0) - Already exists, no insert needed
-- Enum mapping is handled in JavaScript unitConversion.js:
--   0 = Inconclusive
--   1 = Detected
--   2 = Not Detected
--   3 = Low/High HR
-- ============================================================================
