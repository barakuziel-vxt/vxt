-- ============================================================================
-- SQL SYNC SCRIPT: Align Azure EntityTypeAttribute with Local DB
-- ============================================================================
-- Generated: April 9, 2026
-- Purpose: Insert 52 missing attributes from local DB into Azure production
-- Entity Types: 4 (Elan Impression 40), 5 (Lagoon 380), 6 (Lagoon 420), 7 (Bavaria Cruiser 46)
-- ============================================================================

PRINT 'Starting EntityTypeAttribute sync from Local to Azure...';
GO

-- Insert missing attributes (starting from ID 1126)
INSERT INTO EntityTypeAttribute
(entityTypeAttributeId, entityTypeId, entityTypeAttributeCode, entityTypeAttributeName,
 entityTypeAttributeTimeAspect, entityTypeAttributeUnit, providerId, providerEventType, active)
VALUES
(1126, 4, 'electrical.alternators.main.voltage', 'Alternator Output', 'Pt', 'V', 8, 'propulsion.main.alternatorOutput', 'Y'),
(1127, 4, 'environment.depth.belowTransducer', 'Depth', 'Pt', 'm', 8, 'environment.depth.belowTransducer', 'Y'),
(1128, 4, 'navigation.position.value.latitude', 'Latitude', 'Pt', 'deg', 8, 'navigation.position.latitude', 'Y'),
(1129, 4, 'navigation.position.value.longitude', 'Longitude', 'Pt', 'deg', 8, 'navigation.position.longitude', 'Y'),
(1130, 4, 'propulsion.main.coolantTemperature', 'Water Temperature', 'Pt', 'K', 8, 'propulsion.main.waterTemperature', 'Y'),
(1131, 4, 'propulsion.main.exhaustTemperature', 'Exhaust Temp', 'Pt', 'K', 8, 'propulsion.main.exhaustTemperature', 'Y'),
(1132, 4, 'propulsion.main.fuel.pressure', 'Fuel Pressure', 'Pt', 'Pa', 8, 'propulsion.main.fuelPressure', 'Y'),
(1133, 4, 'propulsion.main.load', 'Engine Load', 'Pt', 'ratio', 8, 'propulsion.main.load', 'Y'),
(1134, 4, 'propulsion.main.oilTemperature', 'Oil Temperature', 'Pt', 'K', 8, 'propulsion.main.oilTemperature', 'Y'),
(1135, 4, 'propulsion.main.runTime', 'Engine Run Time', 'Pt', 's', 8, 'propulsion.main.runTime', 'Y'),
(1136, 4, 'propulsion.main.transmission.oilTemperature', 'Gearbox Oil Temp', 'Pt', 'K', 8, 'propulsion.main.gearboxOilTemperature', 'Y'),
(1137, 4, 'propulsion.port.fuelRate', 'FuleRate', 'Pt', 'm3/s', NULL, '', 'Y'),
(1138, 4, 'tanks.wasteWaterTank.level', 'Waste Water', 'Pt', '', 8, 'tanks.wasteWaterTank.level', 'Y'),
(1139, 5, 'electrical.alternators.main.voltage', 'Alternator Output', 'Pt', 'V', 8, 'propulsion.main.alternatorOutput', 'Y'),
(1140, 5, 'environment.depth.belowTransducer', 'Depth', 'Pt', 'm', 8, 'environment.depth.belowTransducer', 'Y'),
(1141, 5, 'navigation.position.value.latitude', 'Latitude', 'Pt', 'deg', 8, 'navigation.position.latitude', 'Y'),
(1142, 5, 'navigation.position.value.longitude', 'Longitude', 'Pt', 'deg', 8, 'navigation.position.longitude', 'Y'),
(1143, 5, 'propulsion.main.coolantTemperature', 'Water Temperature', 'Pt', 'K', 8, 'propulsion.main.waterTemperature', 'Y'),
(1144, 5, 'propulsion.main.exhaustTemperature', 'Exhaust Temp', 'Pt', 'K', 8, 'propulsion.main.exhaustTemperature', 'Y'),
(1145, 5, 'propulsion.main.fuel.pressure', 'Fuel Pressure', 'Pt', 'Pa', 8, 'propulsion.main.fuelPressure', 'Y'),
(1146, 5, 'propulsion.main.fuel.rate', 'Fuel Rate', 'Pt', 'L/h', 8, 'propulsion.main.fuelRate', 'Y'),
(1147, 5, 'propulsion.main.load', 'Engine Load', 'Pt', 'ratio', 8, 'propulsion.main.load', 'Y'),
(1148, 5, 'propulsion.main.oilTemperature', 'Oil Temperature', 'Pt', 'K', 8, 'propulsion.main.oilTemperature', 'Y'),
(1149, 5, 'propulsion.main.runTime', 'Engine Run Time', 'Pt', 's', 8, 'propulsion.main.runTime', 'Y'),
(1150, 5, 'propulsion.main.transmission.oilTemperature', 'Gearbox Oil Temp', 'Pt', 'K', 8, 'propulsion.main.gearboxOilTemperature', 'Y'),
(1151, 5, 'tanks.wasteWaterTank.level', 'Waste Water', 'Pt', '', 8, 'tanks.wasteWaterTank.level', 'Y'),
(1152, 6, 'electrical.alternators.main.voltage', 'Alternator Output', 'Pt', 'V', 8, 'propulsion.main.alternatorOutput', 'Y'),
(1153, 6, 'environment.depth.belowTransducer', 'Depth', 'Pt', 'm', 8, 'environment.depth.belowTransducer', 'Y'),
(1154, 6, 'navigation.position.value.latitude', 'Latitude', 'Pt', 'deg', 8, 'navigation.position.latitude', 'Y'),
(1155, 6, 'navigation.position.value.longitude', 'Longitude', 'Pt', 'deg', 8, 'navigation.position.longitude', 'Y'),
(1156, 6, 'propulsion.main.coolantTemperature', 'Water Temperature', 'Pt', 'K', 8, 'propulsion.main.waterTemperature', 'Y'),
(1157, 6, 'propulsion.main.exhaustTemperature', 'Exhaust Temp', 'Pt', 'K', 8, 'propulsion.main.exhaustTemperature', 'Y'),
(1158, 6, 'propulsion.main.fuel.pressure', 'Fuel Pressure', 'Pt', 'Pa', 8, 'propulsion.main.fuelPressure', 'Y'),
(1159, 6, 'propulsion.main.fuel.rate', 'Fuel Rate', 'Pt', 'L/h', 8, 'propulsion.main.fuelRate', 'Y'),
(1160, 6, 'propulsion.main.load', 'Engine Load', 'Pt', 'ratio', 8, 'propulsion.main.load', 'Y'),
(1161, 6, 'propulsion.main.oilTemperature', 'Oil Temperature', 'Pt', 'K', 8, 'propulsion.main.oilTemperature', 'Y'),
(1162, 6, 'propulsion.main.runTime', 'Engine Run Time', 'Pt', 's', 8, 'propulsion.main.runTime', 'Y'),
(1163, 6, 'propulsion.main.transmission.oilTemperature', 'Gearbox Oil Temp', 'Pt', 'K', 8, 'propulsion.main.gearboxOilTemperature', 'Y'),
(1164, 6, 'tanks.wasteWaterTank.level', 'Waste Water', 'Pt', 'ratio', 8, 'tanks.wasteWaterTank.level', 'Y'),
(1165, 7, 'electrical.alternators.main.voltage', 'Alternator Output', 'Pt', 'V', 8, 'propulsion.main.alternatorOutput', 'Y'),
(1166, 7, 'environment.depth.belowTransducer', 'Depth', 'Pt', 'm', 8, 'environment.depth.belowTransducer', 'Y'),
(1167, 7, 'navigation.position.value.latitude', 'Latitude', 'Pt', 'deg', 8, 'navigation.position.latitude', 'Y'),
(1168, 7, 'navigation.position.value.longitude', 'Longitude', 'Pt', 'deg', 8, 'navigation.position.longitude', 'Y'),
(1169, 7, 'propulsion.main.coolantTemperature', 'Water Temperature', 'Pt', 'K', 8, 'propulsion.main.waterTemperature', 'Y'),
(1170, 7, 'propulsion.main.exhaustTemperature', 'Exhaust Temp', 'Pt', 'K', 8, 'propulsion.main.exhaustTemperature', 'Y'),
(1171, 7, 'propulsion.main.fuel.pressure', 'Fuel Pressure', 'Pt', 'Pa', 8, 'propulsion.main.fuelPressure', 'Y'),
(1172, 7, 'propulsion.main.fuel.rate', 'Fuel Rate', 'Pt', 'L/h', 8, 'propulsion.main.fuelRate', 'Y'),
(1173, 7, 'propulsion.main.load', 'Engine Load', 'Pt', 'ratio', 8, 'propulsion.main.load', 'Y'),
(1174, 7, 'propulsion.main.oilTemperature', 'Oil Temperature', 'Pt', 'K', 8, 'propulsion.main.oilTemperature', 'Y'),
(1175, 7, 'propulsion.main.runTime', 'Engine Run Time', 'Pt', 's', 8, 'propulsion.main.runTime', 'Y'),
(1176, 7, 'propulsion.main.transmission.oilTemperature', 'Gearbox Oil Temp', 'Pt', 'K', 8, 'propulsion.main.gearboxOilTemperature', 'Y'),
(1177, 7, 'tanks.wasteWaterTank.level', 'Waste Water', 'Pt', '', 8, 'tanks.wasteWaterTank.level', 'Y');

PRINT 'Inserted 52 missing attributes';
GO

-- Update existing attributes that differ between local and Azure
-- Attribute: propulsion.main.fuel.rate (Entity Type 4)
UPDATE EntityTypeAttribute
SET entityTypeAttributeName = 'Fuel Rate', entityTypeAttributeUnit = 'L/h', providerId = 8, providerEventType = 'propulsion.main.fuelRate'
WHERE entityTypeId = 4 AND entityTypeAttributeCode = 'propulsion.main.fuel.rate';
PRINT 'Updated propulsion.main.fuel.rate for entity type 4';
GO

-- Mark certain attributes as inactive (active = 'N') in Azure
-- These are environment/navigation attributes that should default to inactive
UPDATE EntityTypeAttribute SET active = 'N'
WHERE entityTypeId IN (4, 5, 6, 7) AND entityTypeAttributeCode IN (
  'environment.water.temperature',
  'environment.wind.angleApparent',
  'environment.wind.speedApparent',
  'navigation.headingTrue'
);
PRINT 'Marked environment/navigation attributes as inactive';
GO

-- Verification
PRINT '';
PRINT '=== Verification: Attribute counts by entity type ===';
SELECT 
    entityTypeId,
    COUNT(*) AS total_attributes,
    SUM(CASE WHEN active = 'Y' THEN 1 ELSE 0 END) AS active_count,
    SUM(CASE WHEN active = 'N' THEN 1 ELSE 0 END) AS inactive_count
FROM EntityTypeAttribute
WHERE entityTypeId IN (4, 5, 6, 7)
GROUP BY entityTypeId
ORDER BY entityTypeId;

PRINT '';
PRINT 'Sync completed successfully';
