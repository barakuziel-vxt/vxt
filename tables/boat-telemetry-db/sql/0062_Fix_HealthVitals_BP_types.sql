-- Migration: Fix HealthVitals blood pressure computed column types
-- This converts Systolic/Diastolic from INT (error on fractional values) to FLOAT using TRY_CAST.
-- Run in BoatTelemetryDB after taking backups.

SET NOCOUNT ON;

BEGIN TRAN;

-- 1) Ensure table exists
IF OBJECT_ID('dbo.HealthVitals','U') IS NULL
BEGIN
    PRINT 'HealthVitals does not exist. Aborting.';
    ROLLBACK TRAN;
    RETURN;
END

-- 2) Drop dependent index (if exists)
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HealthVitals_BloodPressure' AND object_id = OBJECT_ID('dbo.HealthVitals'))
BEGIN
    DROP INDEX IX_HealthVitals_BloodPressure ON dbo.HealthVitals;
    PRINT 'Dropped IX_HealthVitals_BloodPressure';
END

-- 3) Drop computed columns if they are present (safe even if types already correct)
IF COL_LENGTH('dbo.HealthVitals','Systolic') IS NOT NULL
BEGIN
    ALTER TABLE dbo.HealthVitals DROP COLUMN Systolic;
    PRINT 'Dropped column Systolic';
END

IF COL_LENGTH('dbo.HealthVitals','Diastolic') IS NOT NULL
BEGIN
    ALTER TABLE dbo.HealthVitals DROP COLUMN Diastolic;
    PRINT 'Dropped column Diastolic';
END

-- 4) Recreate computed columns with FLOAT using TRY_CAST to avoid conversion errors
ALTER TABLE dbo.HealthVitals
ADD
    Systolic AS TRY_CAST(JSON_VALUE(RawJson, '$.data[0].blood_pressure_data.blood_pressure_samples[0].systolic_bp_mmHg') AS FLOAT) PERSISTED,
    Diastolic AS TRY_CAST(JSON_VALUE(RawJson, '$.data[0].blood_pressure_data.blood_pressure_samples[0].diastolic_bp_mmHg') AS FLOAT) PERSISTED;

PRINT 'Added computed columns Systolic and Diastolic as FLOAT (TRY_CAST)';

-- 5) Recreate the index
CREATE INDEX IX_HealthVitals_BloodPressure ON dbo.HealthVitals (Systolic, Diastolic);
PRINT 'Created IX_HealthVitals_BloodPressure on (Systolic, Diastolic)';

COMMIT TRAN;

-- Verification
SELECT TOP (5) HealthVitalsId, UserId, StartTime, Systolic, Diastolic FROM dbo.HealthVitals ORDER BY LoadedAt DESC;

PRINT 'Migration complete.';