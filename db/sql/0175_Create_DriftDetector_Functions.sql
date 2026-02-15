-- DriftDetector SQL Support
-- Helper function to get telemetry data for drift analysis

-- Create or replace the GetTelemetryForDrift function
CREATE OR ALTER FUNCTION dbo.GetTelemetryForDrift(
    @entityId NVARCHAR(100),
    @entityTypeAttributeId INT,
    @lookbackHours INT = 6,
    @baselineDays INT = 7
)
RETURNS TABLE AS
RETURN (
    SELECT
        'current' as window_type,
        et.entityTelemetryId,
        eta.entityTypeAttributeId,
        eta.entityTypeAttributeCode,
        et.numericValue,
        et.endTimestampUTC,
        DATEDIFF(HOUR, et.endTimestampUTC, GETUTCDATE()) as hours_ago,
        0 as days_ago
    FROM dbo.EntityTelemetry et
    JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
    WHERE et.entityId = @entityId
      AND eta.entityTypeAttributeId = @entityTypeAttributeId
      AND et.endTimestampUTC >= DATEADD(HOUR, -@lookbackHours, GETUTCDATE())
      AND et.endTimestampUTC <= GETUTCDATE()
      AND et.numericValue IS NOT NULL
    
    UNION ALL
    
    SELECT
        'baseline' as window_type,
        et.entityTelemetryId,
        eta.entityTypeAttributeId,
        eta.entityTypeAttributeCode,
        et.numericValue,
        et.endTimestampUTC,
        0 as hours_ago,
        DATEDIFF(DAY, et.endTimestampUTC, GETUTCDATE()) as days_ago
    FROM dbo.EntityTelemetry et
    JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
    WHERE et.entityId = @entityId
      AND eta.entityTypeAttributeId = @entityTypeAttributeId
      AND et.endTimestampUTC >= DATEADD(DAY, -@baselineDays, GETUTCDATE())
      AND et.endTimestampUTC < DATEADD(HOUR, -@lookbackHours, GETUTCDATE())
      AND et.numericValue IS NOT NULL
);
GO

-- Helper stored procedure to get aggregated drift analysis
CREATE OR ALTER PROCEDURE dbo.AnalyzeDrift
    @entityId NVARCHAR(100),
    @entityTypeAttributeId INT,
    @lookbackHours INT = 6,
    @baselineDays INT = 7
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Get current window statistics
    SELECT
        'current' as window_type,
        COUNT(*) as point_count,
        AVG(CAST(numericValue AS FLOAT)) as avg_value,
        STDEV(CAST(numericValue AS FLOAT)) as std_value,
        MIN(CAST(numericValue AS FLOAT)) as min_value,
        MAX(CAST(numericValue AS FLOAT)) as max_value,
        MIN(endTimestampUTC) as window_start,
        MAX(endTimestampUTC) as window_end
    FROM dbo.EntityTelemetry
    WHERE entityId = @entityId
      AND entityTypeAttributeId = @entityTypeAttributeId
      AND endTimestampUTC >= DATEADD(HOUR, -@lookbackHours, GETUTCDATE())
      AND endTimestampUTC <= GETUTCDATE()
      AND numericValue IS NOT NULL
    
    UNION ALL
    
    -- Get baseline window statistics
    SELECT
        'baseline' as window_type,
        COUNT(*) as point_count,
        AVG(CAST(numericValue AS FLOAT)) as avg_value,
        STDEV(CAST(numericValue AS FLOAT)) as std_value,
        MIN(CAST(numericValue AS FLOAT)) as min_value,
        MAX(CAST(numericValue AS FLOAT)) as max_value,
        MIN(endTimestampUTC) as window_start,
        MAX(endTimestampUTC) as window_end
    FROM dbo.EntityTelemetry
    WHERE entityId = @entityId
      AND entityTypeAttributeId = @entityTypeAttributeId
      AND endTimestampUTC >= DATEADD(DAY, -@baselineDays, GETUTCDATE())
      AND endTimestampUTC < DATEADD(HOUR, -@lookbackHours, GETUTCDATE())
      AND numericValue IS NOT NULL;
END
GO
