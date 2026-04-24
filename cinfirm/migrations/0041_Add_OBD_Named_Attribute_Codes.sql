-- =============================================================================
-- Migration 0041: Rename hex OBD PID codes → obd.* named codes
-- =============================================================================
-- Migration 0040 inserted EntityTypeAttribute rows using 4-char hex PID codes
-- (e.g. '010C'). The React Native ELM327Driver and the simulator now emit
-- human-readable dotted keys (e.g. 'obd.engineRpm').
--
-- This migration renames the 14 core EntityTypeAttributeCode values in-place.
-- EntityTelemetry rows are unaffected (they reference entityTypeAttributeId FK).
-- The unique-name constraint prevents adding new rows with the same names,
-- so UPDATE is the correct approach.
--
-- Idempotent — safe to run multiple times (only updates where old code exists).
-- =============================================================================

SET NOCOUNT ON;

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.engineRpm'
WHERE entityTypeAttributeCode = '010C'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.vehicleSpeed'
WHERE entityTypeAttributeCode = '010D'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.coolantTemp'
WHERE entityTypeAttributeCode = '0105'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.throttlePos'
WHERE entityTypeAttributeCode = '0111'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.fuelLevel'
WHERE entityTypeAttributeCode = '012F'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.mafRate'
WHERE entityTypeAttributeCode = '0110'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.engineLoad'
WHERE entityTypeAttributeCode = '0104'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.intakeAirTemp'
WHERE entityTypeAttributeCode = '010F'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.manifoldPressure'
WHERE entityTypeAttributeCode = '010B'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.timingAdvance'
WHERE entityTypeAttributeCode = '010E'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.oilTemp'
WHERE entityTypeAttributeCode = '015C'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.moduleVoltage'
WHERE entityTypeAttributeCode = '0142'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.fuelRate'
WHERE entityTypeAttributeCode = '015E'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

UPDATE dbo.EntityTypeAttribute
SET entityTypeAttributeCode = 'obd.accelPedalPos'
WHERE entityTypeAttributeCode = '015A'
  AND entityTypeId = (SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car');

