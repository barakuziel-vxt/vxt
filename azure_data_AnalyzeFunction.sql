-- Data for table: AnalyzeFunction
-- Row count: 4
UPDATE [dbo].[AnalyzeFunction]
SET 
    [AnalyzePath] = 'multivariate_correlation_shift.detect_correlation_shift',
    [lastUpdateTimestamp] = GETDATE(),
    [lastUpdateUser] = SYSTEM_USER
WHERE [FunctionName] = 'MultivariateCorrectionShift';

-- Verify the update
SELECT 
    [AnalyzeFunctionId],
    [FunctionName],
    [FunctionType],
    [AnalyzePath],
    [lastUpdateTimestamp]
FROM [dbo].[AnalyzeFunction]
WHERE [FunctionName] = 'MultivariateCorrectionShift';

INSERT INTO [AnalyzeFunction] ([AnalyzeFunctionId], [FunctionName], [FunctionType], [AnalyzePath], [active], [createDate], [lastUpdateTimestamp], [lastUpdateUser], [functionDescription]) VALUES (1, 'AnalyzeScore', 'TSQL', 'dbo.AnalyzeScore', 'Y', CAST('2026-02-14 15:14:34.440000' AS DATETIME2), CAST('2026-02-16 18:52:49.080000' AS DATETIME2), 'sa', 'T-SQL function that calculates cumulative scores based on configured threshold values and criteria. Returns numerical score representing severity and match confidence. Used for event triggering and priority ranking.');
INSERT INTO [AnalyzeFunction] ([AnalyzeFunctionId], [FunctionName], [FunctionType], [AnalyzePath], [active], [createDate], [lastUpdateTimestamp], [lastUpdateUser], [functionDescription]) VALUES (2, 'DriftDetector', 'Python', 'drift_detector.detect_entity_drift', 'Y', CAST('2026-02-15 18:22:15.993000' AS DATETIME2), CAST('2026-02-16 18:52:49.083000' AS DATETIME2), 'sa', 'AI-powered Python function that detects statistical drift in telemetry data patterns. Identifies significant changes from historical baseline behavior using machine learning anomaly detection algorithms.');
INSERT INTO [AnalyzeFunction] ([AnalyzeFunctionId], [FunctionName], [FunctionType], [AnalyzePath], [active], [createDate], [lastUpdateTimestamp], [lastUpdateUser], [functionDescription]) VALUES (3, 'MultivariateCorrectionShift', 'Python', 'multivariate_correlation_shift.detect_entity_correlation_shift', 'Y', CAST('2026-02-15 23:52:55.870000' AS DATETIME2), CAST('2026-02-16 18:52:49.090000' AS DATETIME2), 'sa', 'AI-powered Python function that performs multivariate correlation analysis on telemetry data. Detects relationships between multiple data streams and identifies correlation shifts indicating systemic changes.');
INSERT INTO [AnalyzeFunction] ([AnalyzeFunctionId], [FunctionName], [FunctionType], [AnalyzePath], [active], [createDate], [lastUpdateTimestamp], [lastUpdateUser], [functionDescription]) VALUES (4, 'AnalyzeGeofence', 'Geofence', 'geofence_analyzer.check_location_in_zone', 'Y', CAST('2026-02-23 19:49:03.207000' AS DATETIME2), CAST('2026-02-23 19:49:03.220000' AS DATETIME2), 'sa', NULL);

-- Fix MultivariateCorrectionShift function path in AnalyzeFunction table
-- Corrects the function name from detect_entity_correlation_shift to detect_correlation_shift

