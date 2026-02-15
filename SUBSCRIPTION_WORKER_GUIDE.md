# Subscription Analysis Worker - Setup & Integration Guide

This guide explains how to set up and use the Subscription Analysis Worker for real-time event analysis and scoring.

## Overview

The Subscription Analysis Worker is a 5-minute cycle processor that:

1. **Executes TSQL Analysis**: Runs `sp_ExecuteActiveSubscriptionAnalysis` to score all active subscriptions
2. **Calculates Scores**: Uses `AnalyzeScore` function to compute event scores based on entity attributes
3. **Logs Results**: Records all analysis results in `eventLog` and `eventLogDetails` tables
4. **Executes Python Functions**: Processes advanced Python-based analysis functions for specific events

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Subscription Analysis Worker                     │
│                    (5-minute cycles)                             │
└─────────────────────────────────────────────────────────────────┘
         │                           │                     │
         ▼                           ▼                     ▼
    ┌─────────┐            ┌──────────────┐      ┌────────────────┐
    │ Get     │            │ Execute      │      │ Retrieve &     │
    │ Active  │            │ AnalyzeScore │      │ Execute Python │
    │ Subs    │            │ TSQL Func    │      │ Functions      │
    │ & Events│            │              │      │                │
    └────┬────┘            └──────┬───────┘      └────────┬───────┘
         │                       │                        │
         └───────────┬───────────┴────────────┬───────────┘
                     │                        │
                     ▼                        ▼
              ┌──────────────┐        ┌──────────────┐
              │  eventLog    │        │ Python Funcs │
              │  eventLog    │        │ (e.g. anomaly│
              │  Details     │        │ detection)   │
              └──────────────┘        └──────────────┘
```

## Database Setup

### Step 1: Create the Required Tables and Functions

Run these SQL files in order:

```sql
-- In MSSQL Management Studio or sqlcmd:
1. db/sql/0160_Create_eventLog_tables.sql      -- Creates eventLog & eventLogDetails
2. db/sql/0165_Create_AnalyzeScore_function.sql -- Creates AnalyzeScore function
3. db/sql/0170_Create_ExecuteSubscriptionAnalysis_procedure.sql -- Creates stored procedure
```

Example using sqlcmd:
```powershell
sqlcmd -S localhost -U sa -P YourPassword -d VXT -i "c:\VXT\db\sql\0160_Create_eventLog_tables.sql"
sqlcmd -S localhost -U sa -P YourPassword -d VXT -i "c:\VXT\db\sql\0165_Create_AnalyzeScore_function.sql"
sqlcmd -S localhost -U sa -P YourPassword -d VXT -i "c:\VXT\db\sql\0170_Create_ExecuteSubscriptionAnalysis_procedure.sql"
```

### Step 2: Verify Database Objects

```sql
-- Check that all objects were created:
SELECT * FROM sys.objects WHERE name LIKE '%eventLog%' OR name LIKE '%AnalyzeScore%';

-- Check stored procedure
SELECT * FROM sys.procedures WHERE name = 'sp_ExecuteActiveSubscriptionAnalysis';
```

## Python Worker Setup

### Step 1: Install Required Python Packages

```bash
pip install pyodbc schedule python-dotenv
```

Or add to your requirements.txt:
```
pyodbc>=4.0.0
schedule>=1.1.0
python-dotenv>=0.19.0
```

### Step 2: Configure Environment Variables

Create or update a `.env` file in the workspace root:

```env
# Database Configuration
DB_SERVER=localhost
DB_NAME=VXT
DB_USER=sa
DB_PASSWORD=YourSQLPassword

# Worker Configuration (optional)
WORKER_PROCESSING_WINDOW_MINUTES=5
WORKER_LOG_DETAILS=1
```

### Step 3: Run the Worker

In a PowerShell terminal:

```powershell
# Using the virtual environment
.\.venv\Scripts\python.exe subscription_analysis_worker.py
```

Or in a background PowerShell:

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe subscription_analysis_worker.py" -WindowStyle Normal
```

## Configuration

### Setting Up Events with Analysis Functions

Events can be configured to use TSQL or Python-based analysis functions. Here's how:

#### 1. Create an AnalyzeFunction Entry

```sql
INSERT INTO dbo.AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, active)
VALUES (
    'Anomaly Detector',
    'PYTHON',
    'analysis_functions.detect_anomaly',
    'Y'
);

-- Or for TSQL-based functions:
INSERT INTO dbo.AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, active)
VALUES (
    'Basic Score Analysis',
    'TSQL',
    'dbo.AnalyzeScore',
    'Y'
);
```

#### 2. Link Event to AnalyzeFunction

```sql
UPDATE dbo.Event
SET AnalyzeFunctionId = (SELECT AnalyzeFunctionId FROM dbo.AnalyzeFunction WHERE FunctionName = 'Anomaly Detector'),
    FunctionType = 'PYTHON'
WHERE eventCode = 'YourEventCode';
```

#### 3. Set Event Score Thresholds

Configure when an event should trigger analysis:

```sql
UPDATE dbo.Event
SET minCumulatedScore = 50,          -- Log if score >= 50
    maxCumulatedScore = 100,         -- Critical if score >= 100
    risk = 'MEDIUM'
WHERE eventCode = 'YourEventCode';
```

## Available Analysis Functions

The system includes several example analysis functions in `analysis_functions.py`:

### 1. `detect_anomaly`
Detects statistical anomalies in entity data.

**Configuration Example:**
```sql
INSERT INTO dbo.AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, CustomParams)
VALUES (
    'Anomaly Detector',
    'PYTHON',
    'analysis_functions.detect_anomaly',
    '{"sensitivity": 2.0, "lookback_hours": 24}'
);
```

### 2. `analyze_trend`
Analyzes trends over time.

**Configuration Example:**
```sql
INSERT INTO dbo.AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, CustomParams)
VALUES (
    'Trend Analyzer',
    'PYTHON',
    'analysis_functions.analyze_trend',
    '{"lookback_days": 7, "min_samples": 10}'
);
```

### 3. `execute_custom_model`
Executes custom ML models.

**Configuration Example:**
```sql
INSERT INTO dbo.AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, CustomParams)
VALUES (
    'ML Model',
    'PYTHON',
    'analysis_functions.execute_custom_model',
    '{"model_name": "risk_predictor", "model_version": "1.2"}'
);
```

### 4. `send_alert_notification`
Sends alerts based on risk levels.

**Configuration Example:**
```sql
INSERT INTO dbo.AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, CustomParams)
VALUES (
    'Alert Notifier',
    'PYTHON',
    'analysis_functions.send_alert_notification',
    '{"channels": ["email", "sms"], "recipients": ["admin@example.com"]}'
);
```

## Event Attribute Scoring

The system scores events based on `EntityTypeAttributeScore` ranges:

```sql
-- Example: Set HR risk scores
-- Normal: 55-100 = 0 points
-- Elevated: 101-120 = 2 points
-- High: 121-140 = 5 points
-- Critical: 140+ = 10 points

INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
SELECT id, 55, 100, 0 FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = 'AvgHR';
INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
SELECT id, 101, 120, 2 FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = 'AvgHR';
INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
SELECT id, 121, 140, 5 FROM dbo.EntityTypeAttributeScore WHERE entityTypeAttributeCode = 'AvgHR';
INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
SELECT id, 140, 999, 10 FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = 'AvgHR';
```

## Querying Results

### View All Logged Events

```sql
SELECT TOP 100
    el.eventLogId,
    el.entityId,
    e.eventCode,
    el.cumulativeScore,
    el.riskLevel,
    el.createDate
FROM dbo.eventLog el
JOIN dbo.Event e ON el.eventId = e.eventId
ORDER BY el.createDate DESC;
```

### View Event Details (Attribute Contributions)

```sql
SELECT
    el.eventLogId,
    eld.entityTypeAttributeId,
    eta.entityTypeAttributeName,
    eld.attributeValue,
    eld.scoreContribution,
    eld.minThreshold,
    eld.maxThreshold,
    eld.withinRange
FROM dbo.eventLog el
JOIN dbo.eventLogDetails eld ON el.eventLogId = eld.eventLogId
JOIN dbo.EntityTypeAttribute eta ON eld.entityTypeAttributeId = eta.entityTypeAttributeId
WHERE el.eventLogId = 12345;
```

### Get High-Risk Events in the Last Hour

```sql
SELECT
    el.eventLogId,
    el.entityId,
    e.eventCode,
    el.cumulativeScore,
    el.riskLevel,
    el.createDate
FROM dbo.eventLog el
JOIN dbo.Event e ON el.eventId = e.eventId
WHERE el.riskLevel IN ('HIGH', 'CRITICAL')
    AND el.createDate > DATEADD(HOUR, -1, GETDATE())
ORDER BY el.createDate DESC;
```

## Custom Analysis Functions

To create your own analysis function:

### 1. Create a Python Module

```python
# my_analysis.py
def my_custom_analyzer(entity_id: str, event_id: int, cumulative_score: int,
                       risk_level: str, function_params: dict, event_params: dict,
                       connection=None, **kwargs):
    """
    Custom analysis function.
    
    Args:
        entity_id: The entity being analyzed
        event_id: The event ID
        cumulative_score: Score from TSQL analysis
        risk_level: Risk level (LOW, MEDIUM, HIGH, CRITICAL)
        function_params: Parameters from AnalyzeFunction.CustomParams
        event_params: Parameters from Event.CustomParams
        connection: Database connection for queries
        
    Returns:
        dict: Results dictionary with status and findings
    """
    # Your logic here
    return {'status': 'success', 'finding': 'Your analysis result'}
```

### 2. Register in Database

```sql
INSERT INTO dbo.AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, CustomParams)
VALUES (
    'My Custom Analyzer',
    'PYTHON',
    'my_analysis.my_custom_analyzer',
    '{}'
);
```

### 3. Link to Event

```sql
UPDATE dbo.Event
SET AnalyzeFunctionId = (SELECT AnalyzeFunctionId FROM dbo.AnalyzeFunction WHERE FunctionName = 'My Custom Analyzer'),
    FunctionType = 'PYTHON'
WHERE eventId = 123;
```

## Troubleshooting

### Worker Not Connecting to Database

- Verify connection string in `.env` file
- Check that SQL Server is running
- Verify credentials are correct
- Check firewall rules if connecting remotely

### Events Not Being Logged

- Verify subscriptions are active: `SELECT * FROM dbo.CustomerSubscriptions WHERE active = 'Y'`
- Check event score thresholds are configured
- Verify entity attribute scores exist for the event
- Check worker logs in `worker_analysis.log`

### Python Function Not Executing

- Verify function path is correct (module.function_name)
- Check that the module is importable from the VXT directory
- Verify `FunctionType = 'PYTHON'` on the Event record
- Check worker logs for import errors

### Performance Issues

- Check index creation on eventLog and eventLogDetails
- Monitor database query performance
- Consider archiving old eventLog data: `DELETE FROM dbo.eventLog WHERE createDate < DATEADD(DAY, -90, GETDATE())`
- Adjust processing window if needed

## Integration with Existing Service

### Adding to start_all.ps1

Add this line to your startup script:

```powershell
# Start Subscription Analysis Worker
Write-Host "[X/7] Starting Subscription Analysis Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe subscription_analysis_worker.py" -WindowStyle Normal
```

### Adding to Docker Compose

If running in containers:

```yaml
subscription-worker:
  build: .
  command: python subscription_analysis_worker.py
  environment:
    - DB_SERVER=mssql
    - DB_NAME=VXT
    - DB_USER=sa
    - DB_PASSWORD=${SA_PASSWORD}
  depends_on:
    - mssql
  volumes:
    - ./:/app
    - ./worker_analysis.log:/app/worker_analysis.log
```

## Performance Considerations

- **Processing Window**: Adjust `@ProcessingWindowMinutes` parameter based on data volume
- **Log Retention**: Implement cleanup policy for old event logs
- **Batch Processing**: Worker operates on all active subscriptions in parallel
- **Python Functions**: Each function executes sequentially; consider async for faster processing

## Monitoring

### Key Metrics to Monitor

1. **Processing Time**: Check `processingTimeMs` in eventLog
2. **Logged Events**: Track how many events exceed thresholds
3. **Risk Distribution**: Monitor distribution of risk levels
4. **Function Execution**: Track Python function success/failure rates

### Sample Monitoring Query

```sql
SELECT
    COUNT(*) as TotalEvents,
    riskLevel,
    AVG(processingTimeMs) as AvgProcessingMs,
    AVG(cumulativeScore) as AvgScore,
    MAX(DATEDIFF(SECOND, createDate, GETDATE())) as SecondsSinceLastEvent
FROM dbo.eventLog
WHERE createDate > DATEADD(HOUR, -1, GETDATE())
GROUP BY riskLevel
ORDER BY riskLevel DESC;
```

## Support & Debugging

For detailed logs, check `c:\VXT\worker_analysis.log`:

```powershell
# Tail the log file
Get-Content c:\VXT\worker_analysis.log -Tail 50 -Wait
```

For TSQL procedure debugging:

```sql
-- Run procedure with debug output
EXEC dbo.sp_ExecuteActiveSubscriptionAnalysis @ProcessingWindowMinutes = 5, @LogDetails = 1;

-- Check for recent errors in eventLog
SELECT TOP 20
    eventLogId,
    entityId,
    riskLevel,
    createDate,
    processingTimeMs
FROM dbo.eventLog
ORDER BY createDate DESC;
```
