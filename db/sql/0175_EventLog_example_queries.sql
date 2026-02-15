-- Lean EventLog Query Examples
-- These queries show how to work with the optimized lean log schema

-- Example 1: Get recent high-impact events (most useful for monitoring)
SELECT TOP 100
    el.eventLogId,
    el.entityId,
    e.eventCode,
    el.cumulativeScore,
    CASE 
        WHEN el.cumulativeScore >= 100 THEN 'CRITICAL'
        WHEN el.cumulativeScore >= 50 THEN 'HIGH'
        WHEN el.cumulativeScore >= 30 THEN 'MEDIUM'
        ELSE 'LOW'
    END AS riskLevel,
    el.processingTimeMs,
    el.sourceDataTable,
    el.sourceDataId,
    el.logDate
FROM dbo.EventLog el
JOIN dbo.Event e ON el.eventId = e.eventId
WHERE el.logDate > DATEADD(HOUR, -1, GETDATE())
    AND el.cumulativeScore >= 50  -- Only HIGH and CRITICAL
ORDER BY el.logDate DESC;

-- Example 2: Analyze score contribution by attribute
SELECT
    el.eventLogId,
    eld.entityTypeAttributeId,
    eta.entityTypeAttributeName,
    eld.scoreContribution,
    eld.withinRange,
    e.eventCode
FROM dbo.EventLog el
JOIN dbo.EventLogDetails eld ON el.eventLogId = eld.eventLogId
JOIN dbo.EntityTypeAttribute eta ON eld.entityTypeAttributeId = eta.entityTypeAttributeId
JOIN dbo.Event e ON el.eventId = e.eventId
WHERE el.eventLogId = 12345  -- Replace with actual eventLogId
ORDER BY eld.scoreContribution DESC;

-- Example 3: Query actual health data for an event
-- Use the sourceDataId to get back the original EntityTelemetry record
SELECT
    el.eventLogId,
    el.entityId,
    el.cumulativeScore,
    et.entityTelemetryId,
    eta.entityTypeAttributeName,
    et.numericValue,
    et.stringValue,
    et.latitude,
    et.longitude,
    et.endTimestampUTC,
    et.providerDevice
FROM dbo.EventLog el
LEFT JOIN dbo.EntityTelemetry et ON el.sourceDataId = et.entityTelemetryId
JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
WHERE el.sourceDataTable = 'EntityTelemetry'
    AND el.logDate > DATEADD(DAY, -1, GETDATE())
ORDER BY el.logDate DESC;

-- Example 4: Get all telemetry types for an entity with their events
SELECT
    el.eventLogId,
    el.entityId,
    e.eventCode,
    el.cumulativeScore,
    et.entityTelemetryId,
    eta.entityTypeAttributeName,
    et.numericValue,
    et.endTimestampUTC,
    et.providerDevice,
    et.providerEventInterpretation
FROM dbo.EventLog el
LEFT JOIN dbo.EntityTelemetry et ON el.sourceDataId = et.entityTelemetryId
JOIN dbo.Event e ON el.eventId = e.eventId
LEFT JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
WHERE el.sourceDataTable = 'EntityTelemetry'
    AND el.entityId = '033114869'  -- Replace with your entity ID
    AND el.logDate > DATEADD(DAY, -7, GETDATE())
ORDER BY el.logDate DESC;

-- Example 5: Performance monitoring - average processing time
SELECT 
    e.eventCode,
    COUNT(*) as EventCount,
    AVG(el.processingTimeMs) as AvgProcessingMs,
    MAX(el.processingTimeMs) as MaxProcessingMs,
    AVG(el.cumulativeScore) as AvgScore
FROM dbo.EventLog el
JOIN dbo.Event e ON el.eventId = e.eventId
WHERE el.logDate > DATEADD(HOUR, -24, GETDATE())
GROUP BY e.eventCode
ORDER BY AvgProcessingMs DESC;

-- Example 6: Entity monitoring - how many events per entity in the past day
SELECT 
    el.entityId,
    en.entityFirstName,
    COUNT(*) as EventCount,
    MAX(el.cumulativeScore) as MaxScore,
    AVG(el.cumulativeScore) as AvgScore,
    MAX(el.logDate) as LastEventTime
FROM dbo.EventLog el
JOIN dbo.Entity en ON el.entityId = en.entityId
WHERE el.logDate > DATEADD(DAY, -1, GETDATE())
GROUP BY el.entityId, en.entityFirstName
ORDER BY EventCount DESC;

-- Example 7: Archive old logs (retention strategy)
-- WARNING: This is destructive - backup first!
-- Keep 30 days of logs, archive to separate table first if needed
DELETE FROM dbo.EventLogDetails 
WHERE eventLogId IN (
    SELECT eventLogId FROM dbo.EventLog 
    WHERE logDate < DATEADD(DAY, -30, GETDATE())
);

DELETE FROM dbo.EventLog 
WHERE logDate < DATEADD(DAY, -30, GETDATE());

-- Example 8: Table size monitoring
SELECT 
    'eventLog' as TableName,
    (SELECT COUNT(*) FROM dbo.EventLog) as RowCount,
    (SELECT SUM(DATALENGTH(s)) FROM dbo.EventLog s) / 1024.0 / 1024.0 as SizeMB
UNION ALL
SELECT 
    'eventLogDetails' as TableName,
    (SELECT COUNT(*) FROM dbo.EventLogDetails) as RowCount,
    (SELECT SUM(DATALENGTH(s)) FROM dbo.EventLogDetails s) / 1024.0 / 1024.0 as SizeMB;

-- Example 9: Index fragmentation check
SELECT 
    OBJECT_NAME(ips.object_id) as TableName,
    i.name as IndexName,
    ips.avg_fragmentation_in_percent as FragmentationPercent
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE OBJECT_NAME(ips.object_id) IN ('eventLog', 'eventLogDetails')
    AND ips.avg_fragmentation_in_percent > 10
ORDER BY ips.avg_fragmentation_in_percent DESC;

-- Example 10: Distribution of scores across risk levels (last 24 hours)
SELECT 
    CASE 
        WHEN cumulativeScore >= 100 THEN 'CRITICAL (100+)'
        WHEN cumulativeScore >= 50 THEN 'HIGH (50-99)'
        WHEN cumulativeScore >= 30 THEN 'MEDIUM (30-49)'
        ELSE 'LOW (<30)'
    END as RiskCategory,
    COUNT(*) as EventCount,
    MIN(cumulativeScore) as MinScore,
    MAX(cumulativeScore) as MaxScore,
    AVG(cumulativeScore) as AvgScore
FROM dbo.EventLog
WHERE logDate > DATEADD(DAY, -1, GETDATE())
GROUP BY 
    CASE 
        WHEN cumulativeScore >= 100 THEN 'CRITICAL (100+)'
        WHEN cumulativeScore >= 50 THEN 'HIGH (50-99)'
        WHEN cumulativeScore >= 30 THEN 'MEDIUM (30-49)'
        ELSE 'LOW (<30)'
    END
ORDER BY MinScore DESC;
