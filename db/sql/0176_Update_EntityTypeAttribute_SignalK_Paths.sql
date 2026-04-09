-- Migration: Update EntityTypeAttribute codes to match new SignalK paths
-- Date: 2026-03-23
-- Purpose: Align attribute codes with updated SignalK path formats
--   - Nested paths: e.g., propulsion.main.fuel.rate (was propulsion.main.fuelRate)
--   - Array indices: e.g., tanks.fuel.0.currentLevel (was tanks.fuelTank.level)
--   - Fully qualified paths: e.g., navigation.position.value.latitude (was navigation.position.latitude)
--
-- Affected Entity Types: Elan Impression 40 (4), Lagoon 380 (5), Bavaria Cruiser 46 (7), and other yacht types
--
-- Background: SignalK XDR parser plugin deployed to halos.local generates telemetry using standard 
-- SignalK paths with nested objects and array indices. These updates ensure attribute codes in the 
-- EntityTypeAttribute table match the actual paths coming from the XDR plugin.
--
-- Changes applied:
--   1. propulsion.main.fuelRate → propulsion.main.fuel.rate
--   2. propulsion.main.fuelPressure → propulsion.main.fuel.pressure
--   3. navigation.position.latitude → navigation.position.value.latitude
--   4. navigation.position.longitude → navigation.position.value.longitude
--   5. propulsion.main.waterTemperature → propulsion.main.coolantTemperature (also removed from simulator)
--   6. propulsion.main.gearboxOilTemperature → propulsion.main.transmission.oilTemperature
--   7. tanks.fuelTank.level → tanks.fuel.0.currentLevel
--   8. tanks.freshWaterTank.level → tanks.freshWater.0.currentLevel
--   9. electrical.dc.houseBattery.voltage → electrical.batteries.main.voltage
--   10. propulsion.main.alternatorOutput → electrical.alternators.main.voltage
--   11. propulsion.port.fuelRate → propulsion.main.fuel.rate
--   12. tanks.wasteWaterTank.level → tanks.wasteWater.0.currentLevel
--   13. environment.depth.belowTransducer → navigation.depth
--
-- Status: ✅ Applied via manual SQL execution on March 23, 2026
-- Updated: April 9, 2026 - Added missing attribute mappings

PRINT '=== Update EntityTypeAttribute codes to match SignalK paths ==='
PRINT 'Applying attribute code updates for yacht entity types (4, 5, 6, 7)...'
GO

-- Disable foreign key constraint temporarily to allow code updates
ALTER TABLE EntityTypeAttribute NOCHECK CONSTRAINT FK_EntityTypeAttribute_Protocol;
PRINT 'FK constraint disabled for updates';
GO

-- 1. Update Fuel Rate
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'propulsion.main.fuel.rate'
WHERE entityTypeAttributeCode = 'propulsion.main.fuelRate' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 1/10: propulsion.main.fuelRate → propulsion.main.fuel.rate (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 2. Update Fuel Pressure
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'propulsion.main.fuel.pressure'
WHERE entityTypeAttributeCode = 'propulsion.main.fuelPressure' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 2/10: propulsion.main.fuelPressure → propulsion.main.fuel.pressure (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 3. Update Navigation Latitude
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'navigation.position.value.latitude'
WHERE entityTypeAttributeCode = 'navigation.position.latitude' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 3/10: navigation.position.latitude → navigation.position.value.latitude (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 4. Update Navigation Longitude
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'navigation.position.value.longitude'
WHERE entityTypeAttributeCode = 'navigation.position.longitude' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 4/10: navigation.position.longitude → navigation.position.value.longitude (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 5. Update Water Temperature → Coolant Temperature
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'propulsion.main.coolantTemperature'
WHERE entityTypeAttributeCode = 'propulsion.main.waterTemperature' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 5/10: propulsion.main.waterTemperature → propulsion.main.coolantTemperature (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 6. Update Gearbox Oil Temperature
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'propulsion.main.transmission.oilTemperature'
WHERE entityTypeAttributeCode = 'propulsion.main.gearboxOilTemperature' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 6/10: propulsion.main.gearboxOilTemperature → propulsion.main.transmission.oilTemperature (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 7. Update Fuel Tank Level
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'tanks.fuel.0.currentLevel'
WHERE entityTypeAttributeCode = 'tanks.fuelTank.level' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 7/10: tanks.fuelTank.level → tanks.fuel.0.currentLevel (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 8. Update Fresh Water Tank Level
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'tanks.freshWater.0.currentLevel'
WHERE entityTypeAttributeCode = 'tanks.freshWaterTank.level' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 8/10: tanks.freshWaterTank.level → tanks.freshWater.0.currentLevel (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 9. Update House Battery Voltage
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'electrical.batteries.main.voltage'
WHERE entityTypeAttributeCode = 'electrical.dc.houseBattery.voltage' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 9/10: electrical.dc.houseBattery.voltage → electrical.batteries.main.voltage (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 10. Update Alternator Output
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'electrical.alternators.main.voltage'
WHERE entityTypeAttributeCode = 'propulsion.main.alternatorOutput' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 10/13: propulsion.main.alternatorOutput → electrical.alternators.main.voltage (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 11. Update Port Fuel Rate → Main Fuel Rate
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'propulsion.main.fuel.rate'
WHERE entityTypeAttributeCode = 'propulsion.port.fuelRate' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 11/13: propulsion.port.fuelRate → propulsion.main.fuel.rate (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 12. Update Waste Water Tank Level
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'tanks.wasteWater.0.currentLevel'
WHERE entityTypeAttributeCode = 'tanks.wasteWaterTank.level' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 12/13: tanks.wasteWaterTank.level → tanks.wasteWater.0.currentLevel (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- 13. Update Depth Below Transducer → Navigation Depth
UPDATE EntityTypeAttribute
SET entityTypeAttributeCode = 'navigation.depth'
WHERE entityTypeAttributeCode = 'environment.depth.belowTransducer' 
  AND entityTypeId IN (4, 5, 6, 7);
PRINT 'Updated 13/13: environment.depth.belowTransducer → navigation.depth (' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows)';
GO

-- Re-enable foreign key constraint
ALTER TABLE EntityTypeAttribute CHECK CONSTRAINT FK_EntityTypeAttribute_Protocol;
PRINT 'FK constraint re-enabled';
GO

-- Verify the updates
PRINT '';
PRINT '=== Verification: Updated attribute codes ===';
SELECT 
    entityTypeId,
    entityTypeAttributeCode,
    entityTypeAttributeName,
    COUNT(*) AS count
FROM EntityTypeAttribute
WHERE entityTypeAttributeCode IN (
    'propulsion.main.fuel.rate',
    'propulsion.main.fuel.pressure',
    'navigation.position.value.latitude',
    'navigation.position.value.longitude',
    'propulsion.main.coolantTemperature',
    'propulsion.main.transmission.oilTemperature',
    'tanks.fuel.0.currentLevel',
    'tanks.freshWater.0.currentLevel',
    'tanks.wasteWater.0.currentLevel',
    'electrical.batteries.main.voltage',
    'electrical.alternators.main.voltage',
    'navigation.depth'
)
  AND entityTypeId IN (4, 5, 6, 7)
GROUP BY entityTypeId, entityTypeAttributeCode, entityTypeAttributeName
ORDER BY entityTypeId, entityTypeAttributeCode;

PRINT '';
PRINT '✅ Migration 0176 completed: EntityTypeAttribute codes updated to match SignalK paths';
