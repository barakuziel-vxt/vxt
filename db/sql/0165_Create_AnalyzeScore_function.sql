-- Create AnalyzeScore TSQL function
-- Calculates cumulative score for an entity-event based on event criteria and attribute scoring rules
-- Uses generic EntityTelemetry table for all telemetry data
-- Much simplified compared to separate HealthVitals/BoatTelemetry tables

DROP FUNCTION IF EXISTS dbo.AnalyzeScore;
GO

CREATE FUNCTION dbo.AnalyzeScore (
    @entityId NVARCHAR(50),
    @eventId INT,
    @triggeredAt DATETIME = NULL,                    -- Time of analysis (default: now)
    @analysisWindowInMin INT = 5                      -- Minutes to look back (default: 5 min)
)
RETURNS TABLE
AS
RETURN 
SELECT 
    ea.entityTypeAttributeId,
    eta.entityTypeAttributeCode,
    COALESCE(etas.Score, 0) AS scoreContribution,
    CASE 
        WHEN et.numericValue IS NULL THEN 'N'  -- No telemetry = out of range
        WHEN et.numericValue BETWEEN COALESCE(etas.MinValue, 0) AND COALESCE(etas.MaxValue, 999999)
        THEN 'Y'
        ELSE 'N'
    END AS withinRange,
    et.entityTelemetryId,
    -- Probability calculation: based on how far from threshold the value is
    CAST(CASE
        WHEN et.numericValue IS NULL THEN 0.0  -- No telemetry = 0 probability
        WHEN COALESCE(etas.MaxValue, 999999) = 0 THEN 0.5
        WHEN et.numericValue BETWEEN COALESCE(etas.MinValue, 0) AND COALESCE(etas.MaxValue, 999999)
        THEN CAST(1.0 - ABS(CAST(et.numericValue AS FLOAT) - (COALESCE(etas.MinValue, 0) + COALESCE(etas.MaxValue, 999999)) / 2.0) / (COALESCE(etas.MaxValue, 999999) - COALESCE(etas.MinValue, 0)) AS DECIMAL(3, 2))
        ELSE CAST(ABS(CAST(et.numericValue AS FLOAT) - (COALESCE(etas.MinValue, 0) + COALESCE(etas.MaxValue, 999999)) / 2.0) / (COALESCE(etas.MaxValue, 999999) - COALESCE(etas.MinValue, 0)) AS DECIMAL(3, 2))
    END AS DECIMAL(3, 2)) AS probability
FROM dbo.EventAttribute ea
JOIN dbo.EntityTypeAttribute eta ON ea.entityTypeAttributeId = eta.entityTypeAttributeId
-- Get the latest telemetry value for this attribute within the analysis window
LEFT JOIN (
    SELECT DISTINCT 
        entityTelemetryId,
        entityTypeAttributeId,
        numericValue,
        endTimestampUTC,
        ROW_NUMBER() OVER (PARTITION BY entityTypeAttributeId ORDER BY endTimestampUTC DESC) as rn
    FROM dbo.EntityTelemetry
    WHERE entityId = @entityId
      AND endTimestampUTC >= DATEADD(MINUTE, -@analysisWindowInMin, COALESCE(@triggeredAt, GETDATE()))
      AND endTimestampUTC <= COALESCE(@triggeredAt, GETDATE())
) et ON eta.entityTypeAttributeId = et.entityTypeAttributeId AND et.rn = 1
-- Find the MATCHING active score rule for this attribute's value
LEFT JOIN dbo.EntityTypeAttributeScore etas ON eta.entityTypeAttributeId = etas.entityTypeAttributeId
    AND etas.active = 'Y'
    AND (et.numericValue BETWEEN etas.MinValue AND etas.MaxValue)
WHERE ea.eventId = @eventId
    AND ea.active = 'Y'
    AND eta.active = 'Y';
GO
