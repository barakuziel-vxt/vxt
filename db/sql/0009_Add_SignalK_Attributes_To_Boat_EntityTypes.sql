-- Migration: Add SignalK (N2KToSignalK) Attributes to Boat Entity Types
-- Date: 2026-02-18
-- Purpose: Link SignalK provider events to three boat entity types
-- Entity Types: Elan Impression 40 (4), Lagoon 380 (5), Bavaria Cruiser 46 (7)

DECLARE @providerId INT = 8;  -- N2KToSignalK provider

PRINT 'Adding SignalK attributes to boat entity types...';

-- For Elan Impression 40 (entityTypeId = 4)
INSERT INTO dbo.EntityTypeAttribute (
    entityTypeId,
    entityTypeAttributeCode,
    entityTypeAttributeName,
    entityTypeAttributeTimeAspect,
    entityTypeAttributeUnit,
    providerId,
    providerEventType,
    active
)
SELECT 
    4,
    pe.protocolAttributeCode,
    pe.providerEventType,
    'Pt',
    '',
    @providerId,
    pe.providerEventType,
    'Y'
FROM dbo.ProviderEvent pe
WHERE pe.providerId = @providerId
  AND NOT EXISTS (
    SELECT 1 FROM dbo.EntityTypeAttribute eta
    WHERE eta.entityTypeId = 4
      AND eta.entityTypeAttributeCode = pe.protocolAttributeCode
  );

PRINT '  Elan Impression 40: Inserted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' attributes';

-- For Lagoon 380 (entityTypeId = 5)
INSERT INTO dbo.EntityTypeAttribute (
    entityTypeId,
    entityTypeAttributeCode,
    entityTypeAttributeName,
    entityTypeAttributeTimeAspect,
    entityTypeAttributeUnit,
    providerId,
    providerEventType,
    active
)
SELECT 
    5,
    pe.protocolAttributeCode,
    pe.providerEventType,
    'Pt',
    '',
    @providerId,
    pe.providerEventType,
    'Y'
FROM dbo.ProviderEvent pe
WHERE pe.providerId = @providerId
  AND NOT EXISTS (
    SELECT 1 FROM dbo.EntityTypeAttribute eta
    WHERE eta.entityTypeId = 5
      AND eta.entityTypeAttributeCode = pe.protocolAttributeCode
  );

PRINT '  Lagoon 380: Inserted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' attributes';

-- For Bavaria Cruiser 46 (entityTypeId = 7)
INSERT INTO dbo.EntityTypeAttribute (
    entityTypeId,
    entityTypeAttributeCode,
    entityTypeAttributeName,
    entityTypeAttributeTimeAspect,
    entityTypeAttributeUnit,
    providerId,
    providerEventType,
    active
)
SELECT 
    7,
    pe.protocolAttributeCode,
    pe.providerEventType,
    'Pt',
    '',
    @providerId,
    pe.providerEventType,
    'Y'
FROM dbo.ProviderEvent pe
WHERE pe.providerId = @providerId
  AND NOT EXISTS (
    SELECT 1 FROM dbo.EntityTypeAttribute eta
    WHERE eta.entityTypeId = 7
      AND eta.entityTypeAttributeCode = pe.protocolAttributeCode
  );

PRINT '  Bavaria Cruiser 46: Inserted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' attributes';

-- Verify the inserts
PRINT '';
PRINT 'Verification - EntityTypeAttribute counts by boat type:';
SELECT 
    et.entityTypeName,
    COUNT(*) AS attributeCount
FROM dbo.EntityTypeAttribute eta
JOIN dbo.EntityType et ON eta.entityTypeId = et.entityTypeId
WHERE eta.providerId = @providerId
  AND et.entityTypeId IN (4, 5, 7)
GROUP BY et.entityTypeName
ORDER BY et.entityTypeName;
