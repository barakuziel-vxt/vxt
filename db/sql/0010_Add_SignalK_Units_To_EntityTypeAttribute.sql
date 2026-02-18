-- Migration: Add SignalK Standard Units to EntityTypeAttribute
-- Date: 2026-02-18
-- Purpose: Populate entityTypeAttributeUnit with SignalK v1.7.0 standard units
-- Applies to: All boat entity types (Elan Impression 40, Lagoon 380, Bavaria Cruiser 46)

DECLARE @providerId INT = 8;  -- N2KToSignalK provider

PRINT 'Updating EntityTypeAttribute with SignalK standard units...';

-- Navigation
UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'rad' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'navigation.headingMagnetic';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'rad' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'navigation.headingTrue';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'rad' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'navigation.courseOverGround';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'm/s' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'navigation.speedOverGround';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'rad/s' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'navigation.rateOfTurn';

-- Environmental
UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'm/s' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'environment.wind.speedApparent';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'rad' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'environment.wind.directionApparent';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'K' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'environment.outside.temperature';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'Pa' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'environment.outside.pressure';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'K' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'environment.water.temperature';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'K' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'environment.water.seawater.temperature';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'Pa' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'environment.water.seawater.pressure';

-- Engine
UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'K' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'propulsion.port.engineTemperature';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'rpm' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'propulsion.port.RPM';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'ratio' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'propulsion.port.load';

-- Electrical
UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'V' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'electrical.dc.houseBattery.voltage';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'A' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'electrical.dc.houseBattery.current';

-- Tanks
UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'ratio' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'tanks.fuel.level';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'ratio' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'tanks.water.level';

UPDATE dbo.EntityTypeAttribute SET entityTypeAttributeUnit = 'ratio' 
WHERE providerId = @providerId AND entityTypeId IN (4, 5, 7) AND entityTypeAttributeCode = 'tanks.wastewater.level';

PRINT 'EntityTypeAttribute units updated successfully';

-- Verify the updates
SELECT 
    et.entityTypeName,
    eta.entityTypeAttributeCode,
    eta.entityTypeAttributeName,
    eta.entityTypeAttributeUnit
FROM dbo.EntityTypeAttribute eta
JOIN dbo.EntityType et ON eta.entityTypeId = et.entityTypeId
WHERE eta.providerId = @providerId
  AND et.entityTypeId IN (4, 5, 7)
ORDER BY et.entityTypeName, eta.entityTypeAttributeCode;
