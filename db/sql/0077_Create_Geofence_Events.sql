-- Migration: Create Geofence Event types
-- Purpose: Define 3 geofence severity levels that trigger based on customer geofences
-- Events use cumulative score from GeofenceAnalyzer (0 = no breach, 1+ = inside geofence)

-- First, find or create the AnalyzeFunction entry for geofence_event_analyzer
IF NOT EXISTS (SELECT 1 FROM AnalyzeFunction WHERE FunctionName = 'analyze_geofence_event')
BEGIN
    INSERT INTO AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, Description, CreatedAt)
    VALUES (
        'analyze_geofence_event',
        'PYTHON',
        'geofence_event_analyzer.analyze_geofence_event',
        'Analyzes entity position against customer-defined geofences for polygon/circle containment',
        GETDATE()
    );
END

-- Get the AnalyzeFunctionId for the geofence analyzer
DECLARE @geofenceAnalyzeFunctionId INT;
SELECT @geofenceAnalyzeFunctionId = AnalyzeFunctionId 
FROM AnalyzeFunction 
WHERE FunctionName = 'analyze_geofence_event';

-- Create the 3 geofence events
-- Score is 0 (no geofences breached) or 1+ (inside one or more geofences)
-- Each event level uses a different score range

IF NOT EXISTS (SELECT 1 FROM Event WHERE eventCode = 'GEOFENCE_WARN')
BEGIN
    INSERT INTO Event (
        eventCode,
        eventDescription,
        risk,
        minCumulatedScore,
        maxCumulatedScore,
        AnalyzeFunctionId,
        LookbackMinutes,
        CreatedAt
    )
    VALUES (
        'GEOFENCE_WARN',
        'Entity approaching or inside monitored geofence (Warning level)',
        'LOW',
        1,  -- Score 1+: inside at least 1 geofence
        999,
        @geofenceAnalyzeFunctionId,
        15,  -- 15 minute lookback window
        GETDATE()
    );
END

IF NOT EXISTS (SELECT 1 FROM Event WHERE eventCode = 'GEOFENCE_ALERT')
BEGIN
    INSERT INTO Event (
        eventCode,
        eventDescription,
        risk,
        minCumulatedScore,
        maxCumulatedScore,
        AnalyzeFunctionId,
        LookbackMinutes,
        CreatedAt
    )
    VALUES (
        'GEOFENCE_ALERT',
        'Entity inside geofence - Alert level',
        'MEDIUM',
        2,  -- Score 2+: inside 2 or more geofences
        999,
        @geofenceAnalyzeFunctionId,
        15,
        GETDATE()
    );
END

IF NOT EXISTS (SELECT 1 FROM Event WHERE eventCode = 'GEOFENCE_CRITICAL')
BEGIN
    INSERT INTO Event (
        eventCode,
        eventDescription,
        risk,
        minCumulatedScore,
        maxCumulatedScore,
        AnalyzeFunctionId,
        LookbackMinutes,
        CreatedAt
    )
    VALUES (
        'GEOFENCE_CRITICAL',
        'Entity inside multiple critical geofences - Critical level',
        'HIGH',
        3,  -- Score 3+: inside 3 or more geofences
        999,
        @geofenceAnalyzeFunctionId,
        15,
        GETDATE()
    );
END

-- Verify
SELECT 'Geofence events created successfully' AS Message;
SELECT eventCode, eventDescription, risk, minCumulatedScore, maxCumulatedScore, LookbackMinutes
FROM Event 
WHERE eventCode LIKE 'GEOFENCE_%'
ORDER BY minCumulatedScore;
