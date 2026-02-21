-- Fix: Mark Yacht health attributes for auto-selection in graphs
-- Issue: Migration 0010 used wrong patterns that didn't match actual Yacht attribute codes
-- This fixes the defaultInGraph status for Yacht entities (Elan Impression 40, Lagoon 380)

-- Mark propulsion (engine) health attributes
UPDATE EntityTypeAttribute
SET defaultInGraph = 'Y'
WHERE entityTypeAttributeCode IN (
  'propulsion.main.temperature',
  'propulsion.main.oilPressure',
  'propulsion.main.revolutions'
)
AND entityTypeId IN (
  SELECT entityTypeId FROM EntityType WHERE entityTypeName IN ('Elan Impression 40', 'Lagoon 380')
);

-- Mark electrical (battery/power) health attributes  
UPDATE EntityTypeAttribute
SET defaultInGraph = 'Y'
WHERE entityTypeAttributeCode IN (
  'electrical.main.voltage',
  'electrical.dc.houseBattery.voltage',
  'electrical.dc.houseBattery.current'
)
AND entityTypeId IN (
  SELECT entityTypeId FROM EntityType WHERE entityTypeName IN ('Elan Impression 40', 'Lagoon 380')
);

-- Mark fuelRate - this one is NULL too, mark as 'N' since it's not critical health
UPDATE EntityTypeAttribute
SET defaultInGraph = 'N'
WHERE entityTypeAttributeCode = 'propulsion.port.fuelRate'
AND entityTypeId IN (
  SELECT entityTypeId FROM EntityType WHERE entityTypeName IN ('Elan Impression 40', 'Lagoon 380')
);

PRINT 'Fixed: Marked Yacht health attributes for auto-selection in graphs';
PRINT 'Marked as defaultInGraph=Y: Engine temp, oil pressure, RPM, Main voltage, House battery voltage, House battery current';
