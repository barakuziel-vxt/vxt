-- ============================================================================
-- Fix EntityTypeAttribute for SignalK standard compliance
-- ============================================================================
-- Problem: Several entityTypeAttributeCode values in the DB do NOT match
-- the actual SignalK paths produced by the SignalK server from NMEA 0183.
--
-- Mismatches found:
--   DB: environment.wind.directionApparent  → SignalK: environment.wind.angleApparent
--   DB: navigation.courseOverGround          → SignalK: navigation.courseOverGroundTrue
--   DB: environment.depth.belowTransducer    → MISSING (produced by $SDDBT sentence)
--   DB: entityTypeId=4 has wrong codes for voltage, current, air temp, engine temp
--   DB: entityTypeId=6 (Lagoon 420) has ZERO attributes
--
-- This script:
--   1. Fixes wrong codes for entityTypeId 4, 5, 7
--   2. Adds missing attributes (depth, etc.)
--   3. Creates full attribute set for entityTypeId 6
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 1: Fix wrong attribute codes for ALL yacht types (4, 5, 7)
-- ────────────────────────────────────────────────────────────────────────────

-- Fix: environment.wind.directionApparent → environment.wind.angleApparent
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'environment.wind.angleApparent',
    providerEventType       = 'environment.wind.angleApparent',
    lastUpdateTimestamp      = GETUTCDATE(),
    lastUpdateUser           = 'fix-signalk'
WHERE entityTypeAttributeCode = 'environment.wind.directionApparent'
  AND entityTypeId IN (4, 5, 7);

-- Fix: navigation.courseOverGround → navigation.courseOverGroundTrue
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'navigation.courseOverGroundTrue',
    providerEventType       = 'navigation.courseOverGroundTrue',
    lastUpdateTimestamp      = GETUTCDATE(),
    lastUpdateUser           = 'fix-signalk'
WHERE entityTypeAttributeCode = 'navigation.courseOverGround'
  AND entityTypeId IN (4, 5, 7);

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 2: Fix entityTypeId=4 specific wrong codes
-- ────────────────────────────────────────────────────────────────────────────

-- Fix: electrical.batteries.house.voltage → electrical.dc.houseBattery.voltage
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'electrical.dc.houseBattery.voltage',
    providerEventType       = 'electrical.dc.houseBattery.voltage',
    lastUpdateTimestamp      = GETUTCDATE(),
    lastUpdateUser           = 'fix-signalk'
WHERE entityTypeAttributeCode = 'electrical.batteries.house.voltage'
  AND entityTypeId = 4;

-- Fix: electrical.batteries.house.current → electrical.dc.houseBattery.current
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'electrical.dc.houseBattery.current',
    providerEventType       = 'electrical.dc.houseBattery.current',
    lastUpdateTimestamp      = GETUTCDATE(),
    lastUpdateUser           = 'fix-signalk'
WHERE entityTypeAttributeCode = 'electrical.batteries.house.current'
  AND entityTypeId = 4;

-- Fix: environment.air.temperature → environment.outside.temperature
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'environment.outside.temperature',
    providerEventType       = 'environment.outside.temperature',
    lastUpdateTimestamp      = GETUTCDATE(),
    lastUpdateUser           = 'fix-signalk'
WHERE entityTypeAttributeCode = 'environment.air.temperature'
  AND entityTypeId = 4;

-- Fix: propulsion.port.engineTemperature → propulsion.main.temperature
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'propulsion.main.temperature',
    providerEventType       = 'propulsion.main.temperature',
    lastUpdateTimestamp      = GETUTCDATE(),
    lastUpdateUser           = 'fix-signalk'
WHERE entityTypeAttributeCode = 'propulsion.port.engineTemperature'
  AND entityTypeId = 4;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 3: Add missing attributes for entityTypeId 4, 5, 7
--         (environment.depth.belowTransducer — from $SDDBT sentence)
-- ────────────────────────────────────────────────────────────────────────────

-- entityTypeId = 4 (Elan Impression 40)
IF NOT EXISTS (
    SELECT 1 FROM EntityTypeAttribute
    WHERE entityTypeId = 4 AND entityTypeAttributeCode = 'environment.depth.belowTransducer'
)
INSERT INTO EntityTypeAttribute
    (entityTypeId, entityTypeAttributeCode, entityTypeAttributeName,
     entityTypeAttributeTimeAspect, entityTypeAttributeUnit,
     providerId, providerEventType, active, protocolId, defaultInGraph,
     createDate, lastUpdateTimestamp, lastUpdateUser)
VALUES
    (4, 'environment.depth.belowTransducer', 'Depth',
     'Pt', 'm',
     8, 'environment.depth.belowTransducer', 'Y', 3, 'Y',
     GETUTCDATE(), GETUTCDATE(), 'fix-signalk');

-- entityTypeId = 5 (Lagoon 380)
IF NOT EXISTS (
    SELECT 1 FROM EntityTypeAttribute
    WHERE entityTypeId = 5 AND entityTypeAttributeCode = 'environment.depth.belowTransducer'
)
INSERT INTO EntityTypeAttribute
    (entityTypeId, entityTypeAttributeCode, entityTypeAttributeName,
     entityTypeAttributeTimeAspect, entityTypeAttributeUnit,
     providerId, providerEventType, active, protocolId, defaultInGraph,
     createDate, lastUpdateTimestamp, lastUpdateUser)
VALUES
    (5, 'environment.depth.belowTransducer', 'Depth',
     'Pt', 'm',
     8, 'environment.depth.belowTransducer', 'Y', 3, 'Y',
     GETUTCDATE(), GETUTCDATE(), 'fix-signalk');

-- entityTypeId = 7 (Bavaria Cruiser 46)
IF NOT EXISTS (
    SELECT 1 FROM EntityTypeAttribute
    WHERE entityTypeId = 7 AND entityTypeAttributeCode = 'environment.depth.belowTransducer'
)
INSERT INTO EntityTypeAttribute
    (entityTypeId, entityTypeAttributeCode, entityTypeAttributeName,
     entityTypeAttributeTimeAspect, entityTypeAttributeUnit,
     providerId, providerEventType, active, protocolId, defaultInGraph,
     createDate, lastUpdateTimestamp, lastUpdateUser)
VALUES
    (7, 'environment.depth.belowTransducer', 'Depth',
     'Pt', 'm',
     8, 'environment.depth.belowTransducer', 'Y', 3, 'Y',
     GETUTCDATE(), GETUTCDATE(), 'fix-signalk');

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 4: Create FULL attribute set for entityTypeId = 6 (Lagoon 420)
--         Using corrected SignalK standard codes.
-- ────────────────────────────────────────────────────────────────────────────

-- Also activate the entity type if it was deactivated
UPDATE EntityType
SET active = 'Y', lastUpdateTimestamp = GETUTCDATE(), lastUpdateUser = 'fix-signalk'
WHERE entityTypeId = 6 AND active = 'N';

-- Navigation
INSERT INTO EntityTypeAttribute (entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active, protocolId, defaultInGraph, createDate, lastUpdateTimestamp, lastUpdateUser)
SELECT 6, code, name, 'Pt', unit, 8, code, 'Y', 3, dflt, GETUTCDATE(), GETUTCDATE(), 'fix-signalk'
FROM (VALUES
    ('navigation.position',              'Position',    '',    'N'),
    ('navigation.headingMagnetic',       'Hdg Mag',     'rad', 'N'),
    ('navigation.headingTrue',           'Hdg True',    'rad', 'N'),
    ('navigation.courseOverGroundTrue',   'COG',         'rad', 'N'),
    ('navigation.speedOverGround',       'SOG',         'm/s', 'N'),
    ('navigation.speedThroughWater',     'STW',         'm/s', 'N')
) AS v(code, name, unit, dflt)
WHERE NOT EXISTS (
    SELECT 1 FROM EntityTypeAttribute
    WHERE entityTypeId = 6 AND entityTypeAttributeCode = v.code
);

-- Environment
INSERT INTO EntityTypeAttribute (entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active, protocolId, defaultInGraph, createDate, lastUpdateTimestamp, lastUpdateUser)
SELECT 6, code, name, 'Pt', unit, 8, code, 'Y', 3, dflt, GETUTCDATE(), GETUTCDATE(), 'fix-signalk'
FROM (VALUES
    ('environment.wind.speedApparent',         'Wind Speed',    'm/s', 'N'),
    ('environment.wind.angleApparent',         'Wind Angle',    'rad', 'N'),
    ('environment.water.temperature',          'Water Temp',    'K',   'N'),
    ('environment.outside.temperature',        'Air Temp',      'K',   'N'),
    ('environment.outside.pressure',           'Atm Pressure',  'Pa',  'N'),
    ('environment.depth.belowTransducer',      'Depth',         'm',   'Y'),
    ('environment.water.seawater.pressure',    'Water Press',   'Pa',  'N'),
    ('environment.water.seawater.temperature', 'Seawater Temp', 'K',   'N')
) AS v(code, name, unit, dflt)
WHERE NOT EXISTS (
    SELECT 1 FROM EntityTypeAttribute
    WHERE entityTypeId = 6 AND entityTypeAttributeCode = v.code
);

-- Propulsion
INSERT INTO EntityTypeAttribute (entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active, protocolId, defaultInGraph, createDate, lastUpdateTimestamp, lastUpdateUser)
SELECT 6, code, name, 'Pt', unit, 8, code, 'Y', 3, dflt, GETUTCDATE(), GETUTCDATE(), 'fix-signalk'
FROM (VALUES
    ('propulsion.main.revolutions',  'RPM',        'Hz',  'Y'),
    ('propulsion.main.temperature',  'Eng Temp',   'K',   'Y'),
    ('propulsion.main.oilPressure',  'Oil Press',  'Pa',  'Y')
) AS v(code, name, unit, dflt)
WHERE NOT EXISTS (
    SELECT 1 FROM EntityTypeAttribute
    WHERE entityTypeId = 6 AND entityTypeAttributeCode = v.code
);

-- Electrical
INSERT INTO EntityTypeAttribute (entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active, protocolId, defaultInGraph, createDate, lastUpdateTimestamp, lastUpdateUser)
SELECT 6, code, name, 'Pt', unit, 8, code, 'Y', 3, dflt, GETUTCDATE(), GETUTCDATE(), 'fix-signalk'
FROM (VALUES
    ('electrical.dc.houseBattery.voltage', 'Batt Voltage', 'V', 'Y'),
    ('electrical.dc.houseBattery.current', 'Batt Current', 'A', 'Y')
) AS v(code, name, unit, dflt)
WHERE NOT EXISTS (
    SELECT 1 FROM EntityTypeAttribute
    WHERE entityTypeId = 6 AND entityTypeAttributeCode = v.code
);

-- Tanks
INSERT INTO EntityTypeAttribute (entityTypeId, entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active, protocolId, defaultInGraph, createDate, lastUpdateTimestamp, lastUpdateUser)
SELECT 6, code, name, 'Pt', unit, 8, code, 'Y', 3, dflt, GETUTCDATE(), GETUTCDATE(), 'fix-signalk'
FROM (VALUES
    ('tanks.fuelTank.level',       'Fuel',        'ratio', 'N'),
    ('tanks.freshWaterTank.level', 'Fresh Water', 'ratio', 'N'),
    ('tanks.wasteWaterTank.level', 'Waste Water', 'ratio', 'N')
) AS v(code, name, unit, dflt)
WHERE NOT EXISTS (
    SELECT 1 FROM EntityTypeAttribute
    WHERE entityTypeId = 6 AND entityTypeAttributeCode = v.code
);

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 5: Verify results
-- ────────────────────────────────────────────────────────────────────────────

-- Show all yacht SignalK attributes after fixes
SELECT
    et.entityTypeName,
    eta.entityTypeId,
    eta.entityTypeAttributeCode,
    eta.entityTypeAttributeName,
    eta.entityTypeAttributeUnit,
    eta.active
FROM EntityTypeAttribute eta
JOIN EntityType et ON et.entityTypeId = eta.entityTypeId
WHERE eta.entityTypeId IN (4, 5, 6, 7)
  AND eta.active = 'Y'
ORDER BY eta.entityTypeId, eta.entityTypeAttributeCode;

-- Verify entity 234567891 can now resolve all standard SignalK codes
SELECT
    'environment.wind.angleApparent' AS testCode,
    eta.entityTypeAttributeId,
    eta.entityTypeAttributeCode
FROM EntityTypeAttribute eta
JOIN Entity e ON e.entityTypeId = eta.entityTypeId
WHERE e.entityId = '234567891'
  AND eta.entityTypeAttributeCode = 'environment.wind.angleApparent'
  AND eta.active = 'Y'
UNION ALL
SELECT
    'navigation.courseOverGroundTrue',
    eta.entityTypeAttributeId,
    eta.entityTypeAttributeCode
FROM EntityTypeAttribute eta
JOIN Entity e ON e.entityTypeId = eta.entityTypeId
WHERE e.entityId = '234567891'
  AND eta.entityTypeAttributeCode = 'navigation.courseOverGroundTrue'
  AND eta.active = 'Y'
UNION ALL
SELECT
    'environment.depth.belowTransducer',
    eta.entityTypeAttributeId,
    eta.entityTypeAttributeCode
FROM EntityTypeAttribute eta
JOIN Entity e ON e.entityTypeId = eta.entityTypeId
WHERE e.entityId = '234567891'
  AND eta.entityTypeAttributeCode = 'environment.depth.belowTransducer'
  AND eta.active = 'Y';
