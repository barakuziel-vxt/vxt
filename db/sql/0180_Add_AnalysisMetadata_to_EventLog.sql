-- Migration: Add analysisMetadata column to EventLog for AI function results
-- Purpose: Store complex analysis findings from Python AI functions (correlations, multi-attribute analysis, etc.)
-- For TSQL functions, predefined entityTypeAttributeScore is used instead

BEGIN TRANSACTION;

-- Check if column already exists
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'EventLog' AND COLUMN_NAME = 'analysisMetadata')
BEGIN
    ALTER TABLE dbo.EventLog 
    ADD analysisMetadata NVARCHAR(MAX) NULL;
    
    PRINT 'Column analysisMetadata added to EventLog table safely.';
END
ELSE
BEGIN
    PRINT 'Column analysisMetadata already exists in EventLog table.';
END

COMMIT TRANSACTION;

-- Index for efficient querying (optional but recommended)
-- IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventLog_AnalysisMetadata')
-- BEGIN
--     CREATE INDEX IX_EventLog_AnalysisMetadata ON dbo.EventLog (eventId) WHERE analysisMetadata IS NOT NULL;
-- END

GO

-- ===== DOCUMENTATION =====
/*
SCHEMA: EventLog.analysisMetadata (JSON)

PURPOSE: 
Store complex analysis findings from Python/AI functions. TSQL functions use predefined entityTypeAttributeScore instead.

STRUCTURE (example for DriftDetector):
{
  "functionType": "PYTHON",
  "analysisType": "DriftDetector",
  "analysisWindow": {
    "lookbackMinutes": 1440,
    "baselineDays": 7
  },
  "baselineAnalysis": {
    "avgValue": 65.2,
    "stdDev": 5.3,
    "sampleCount": 342,
    "dateRange": "2026-02-08 to 2026-02-15"
  },
  "multiAttributeFindings": {
    "correlations": [
      {
        "attribute1": "Heart Rate",
        "attribute2": "Respiratory Rate",
        "coefficient": 0.87,
        "strength": "strong positive correlation"
      }
    ],
    "anomalyPattern": "synchronized elevation across related attributes"
  },
  "detectionMetadata": {
    "method": "z-score",
    "threshold": 1.8,
    "sensitivity": "high"
  }
}

USAGE PATTERN:
- Python AI functions return this in their response
- Worker stores it when registering events from Python functions
- UI queries EventLog.analysisMetadata to display statistical context
- TSQL functions do NOT populate this (they use entityTypeAttributeScore)

QUERY EXAMPLE:
SELECT eventLogId, eventId, analysisMetadata 
FROM EventLog
WHERE JSON_VALUE(analysisMetadata, '$.functionType') = 'PYTHON'
*/
