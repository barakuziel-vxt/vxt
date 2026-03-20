# Subscription Analysis Worker - Complete System

A comprehensive real-time event analysis system that runs every 5 minutes to analyze active subscriptions, calculate risk scores, and execute advanced analysis functions.

## What This System Does

The Subscription Analysis Worker automates the process of monitoring entities (patients, boats, etc.) by:

1. **Analyzing Active Subscriptions** - Every 5 minutes, the worker retrieves all active subscriptions
2. **Scoring Events** - Calculates cumulative risk scores based on entity attributes and scoring rules
3. **Logging Results** - Records all analysis in `eventLog` and `eventLogDetails` tables
4. **Executing Functions** - Runs Python-based analysis functions (anomaly detection, ML models, notifications)

## System Components

### Database Components (T-SQL)

| File | Purpose |
|------|---------|
| `db/sql/0160_Create_eventLog_tables.sql` | Creates eventLog and eventLogDetails tables for storing analysis results |
| `db/sql/0165_Create_AnalyzeScore_function.sql` | T-SQL function that calculates scores for an entity-event pair |
| `db/sql/0170_Create_ExecuteSubscriptionAnalysis_procedure.sql` | Stored procedure that orchestrates the 5-minute analysis cycle |

### Python Components

| File | Purpose |
|------|---------|
| `subscription_analysis_worker.py` | Main worker that runs every 5 minutes |
| `analysis_functions.py` | Library of example analysis functions (anomaly detection, trending, ML, alerts) |
| `test_integration.py` | Integration test suite to verify the complete system |

### Documentation

| File | Purpose |
|------|---------|
| `SUBSCRIPTION_WORKER_GUIDE.md` | Comprehensive setup and configuration guide |
| `WORKER_SETUP.md` | This file - quick start reference |

## Quick Start

### 1. Deploy Database Schema (5 minutes)

```powershell
# Run SQL migration files
sqlcmd -S localhost -U sa -P YourPassword -d VXT -i "db/sql/0160_Create_eventLog_tables.sql"
sqlcmd -S localhost -U sa -P YourPassword -d VXT -i "db/sql/0165_Create_AnalyzeScore_function.sql"
sqlcmd -S localhost -U sa -P YourPassword -d VXT -i "db/sql/0170_Create_ExecuteSubscriptionAnalysis_procedure.sql"
```

### 2. Install Python Dependencies (2 minutes)

```bash
pip install pyodbc schedule python-dotenv
```

### 3. Configure Environment (1 minute)

Create/update `.env` file:
```env
DB_SERVER=localhost
DB_NAME=VXT
DB_USER=sa
DB_PASSWORD=YourSQLPassword
```

### 4. Run Integration Tests (1 minute)

```powershell
.\.venv\Scripts\python.exe test_integration.py
```

### 5. Start the Worker (Continuous)

```powershell
.\.venv\Scripts\python.exe subscription_analysis_worker.py
```

Monitor the logs:
```powershell
Get-Content c:\VXT\worker_analysis.log -Tail 50 -Wait
```

## How It Works

### The 5-Minute Analysis Cycle

```
┌─────────────────────────────────────────────┐
│     Every 5 Minutes (Automated)             │
└─────────────────────┬───────────────────────┘
                      │
        ┌─────────────▼──────────────┐
        │ 1. Get Active Subscriptions │
        │    - Active Customers      │
        │    - Active Entities       │
        │    - Active Events         │
        └─────────────┬──────────────┘
                      │
        ┌─────────────▼──────────────────┐
        │ 2. Execute AnalyzeScore        │
        │    - Fetch Latest Attributes   │
        │    - Apply Scoring Rules       │
        │    - Calculate Total Score     │
        └─────────────┬──────────────────┘
                      │
        ┌─────────────▼──────────────────┐
        │ 3. Log Results (if needed)     │
        │    - Insert into eventLog      │
        │    - Log Attribute Details     │
        │    - Tag Risk Level            │
        └─────────────┬──────────────────┘
                      │
        ┌─────────────▼──────────────────┐
        │ 4. Execute Python Functions    │
        │    - ML Models                 │
        │    - Anomaly Detection         │
        │    - Send Alerts               │
        └─────────────┬──────────────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │ Ready for Next Cycle  │
          │ (5 min later)         │
          └───────────────────────┘
```

### Entity Scoring Example

**Scenario**: Monitoring patient 033114869 for health event

```sql
Event: NEWS (National Early Warning Score)
Attributes to check: Heart Rate, Blood Pressure, Temperature, etc.

Scoring Rules:
- AvgHR 55-100 bpm     = 0 points
- AvgHR 101-120 bpm    = 2 points  
- AvgHR 121-140 bpm    = 5 points
- AvgHR > 140 bpm      = 10 points

Same for: Systolic BP, Temperature, O2 Sat, Glucose, etc.

Cumulative Score >= 50  = HIGH RISK → Log to eventLog
Cumulative Score >= 100 = CRITICAL → Trigger alerts
```

## Configuration

### Creating Events with Scoring

```sql
-- 1. Define scoring rules for attributes
INSERT INTO EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
VALUES ((SELECT id FROM EntityTypeAttribute WHERE code='AvgHR'), 55, 100, 0);

INSERT INTO EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
VALUES ((SELECT id FROM EntityTypeAttribute WHERE code='AvgHR'), 101, 120, 2);

-- 2. Link attributes to event
INSERT INTO EventAttribute (eventId, entityTypeAttributeId)
VALUES (1, (SELECT id FROM EntityTypeAttribute WHERE code='AvgHR'));

-- 3. Set event thresholds
UPDATE Event 
SET minCumulatedScore = 50, maxCumulatedScore = 100
WHERE eventId = 1;
```

### Adding Python Analysis Functions

```sql
-- 1. Register the function
INSERT INTO AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, CustomParams)
VALUES (
    'Anomaly Detector',
    'PYTHON',
    'analysis_functions.detect_anomaly',
    '{"sensitivity": 2.0, "lookback_hours": 24}'
);

-- 2. Link to an event
UPDATE Event 
SET AnalyzeFunctionId = (SELECT AnalyzeFunctionId FROM AnalyzeFunction WHERE FunctionName='Anomaly Detector'),
    FunctionType = 'PYTHON'
WHERE eventCode = 'MyEventCode';
```

## Querying Results

### Recent High-Risk Events

```sql
SELECT TOP 20
    el.eventLogId,
    el.entityId,
    e.eventCode,
    el.cumulativeScore,
    el.riskLevel,
    el.processingTimeMs,
    el.createDate
FROM eventLog el
JOIN Event e ON el.eventId = e.eventId
WHERE el.createDate > DATEADD(HOUR, -1, GETDATE())
    AND el.riskLevel IN ('HIGH', 'CRITICAL')
ORDER BY el.createDate DESC;
```

### Event Contribution Breakdown

```sql
SELECT
    el.eventLogId,
    eld.entityTypeAttributeId,
    eta.entityTypeAttributeName,
    eld.attributeValue,
    eld.scoreContribution,
    eld.withinRange
FROM eventLog el
JOIN eventLogDetails eld ON el.eventLogId = eld.eventLogId
JOIN EntityTypeAttribute eta ON eld.entityTypeAttributeId = eta.entityTypeAttributeId
WHERE el.eventLogId = 12345;
```

## Example Analysis Functions

The system includes 4 ready-to-use analysis functions:

### 1. Anomaly Detection
```python
# Automatically detects statistical anomalies
from analysis_functions import detect_anomaly
```
- Configuration-driven sensitivity
- Lookback window for baseline comparison
- Automatic alert generation

### 2. Trend Analysis
```python
# Analyzes trends over time
from analysis_functions import analyze_trend
```
- Direction detection (up/down/stable)
- Trajectory prediction
- Momentum calculation

### 3. Custom ML Models
```python
# Execute your own ML models
from analysis_functions import execute_custom_model
```
- Load trained models
- Predictions with confidence scores
- Factor contribution breakdown

### 4. Alert Notifications
```python
# Send alerts via multiple channels
from analysis_functions import send_alert_notification
```
- Email notifications
- SMS alerts
- Webhook integrations

## Creating Custom Analysis Functions

### Template

```python
# my_analyzer.py
def analyze_my_event(entity_id: str, event_id: int, cumulative_score: int,
                     risk_level: str, function_params: dict, event_params: dict,
                     connection=None, **kwargs):
    """
    Your custom analysis logic here.
    
    Args:
        entity_id: The entity being analyzed
        event_id: The event ID triggering the analysis
        cumulative_score: Score from TSQL AnalyzeScore function
        risk_level: Risk classification (LOW, MEDIUM, HIGH, CRITICAL)
        function_params: Custom parameters from AnalyzeFunction.CustomParams
        event_params: Event-specific parameters
        connection: Direct database connection if needed
        
    Returns:
        dict: {'status': 'success'|'error', 'finding': '...', ...}
    """
    
    # Your logic here - query database, run ML, send alerts, etc.
    result = {
        'status': 'success',
        'entity_id': entity_id,
        'finding': 'Your analysis result'
    }
    
    return result
```

### Register in Database

```sql
INSERT INTO AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, CustomParams)
VALUES ('My Analyzer', 'PYTHON', 'my_analyzer.analyze_my_event', '{}');
```

## Monitoring & Troubleshooting

### Check Worker Status

```powershell
# View recent logs
Get-Content c:\VXT\worker_analysis.log -Tail 100

# Check for errors
Select-String "ERROR" c:\VXT\worker_analysis.log | Tail -20
```

### Verify Database Connectivity

```sql
-- Run this in SSMS to verify stored procedure
EXEC sp_ExecuteActiveSubscriptionAnalysis @ProcessingWindowMinutes = 5, @LogDetails = 1;

-- Should return recent analysis results
SELECT TOP 10 * FROM eventLog ORDER BY createDate DESC;
```

### Performance Monitoring

```sql
-- Check average processing time
SELECT 
    AVG(processingTimeMs) as AvgTimeMs,
    MAX(processingTimeMs) as MaxTimeMs,
    COUNT(*) as TotalAnalyses
FROM eventLog
WHERE createDate > DATEADD(DAY, -1, GETDATE());

-- Check analysis frequency per event
SELECT 
    e.eventCode,
    COUNT(*) as AnalysisCount,
    AVG(el.cumulativeScore) as AvgScore
FROM eventLog el
JOIN Event e ON el.eventId = e.eventId
WHERE el.createDate > DATEADD(HOUR, -1, GETDATE())
GROUP BY e.eventCode;
```

## Installing in Production

### Option 1: Add to start_all.ps1

```powershell
Write-Host "[X/7] Starting Subscription Analysis Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\.venv\Scripts\python.exe subscription_analysis_worker.py" -WindowStyle Normal
```

### Option 2: Windows Task Scheduler

```powershell
# Create a scheduled task
$trigger = New-ScheduledTaskTrigger -AtStartup
$action = New-ScheduledTaskAction -Execute "C:\VXT\.venv\Scripts\python.exe" -Argument "C:\VXT\subscription_analysis_worker.py"
Register-ScheduledTask -TaskName "VXT_AnalysisWorker" -Trigger $trigger -Action $action -RunLevel Highest
```

### Option 3: Docker Container

```yaml
services:
  analysis-worker:
    build: .
    command: python subscription_analysis_worker.py
    environment:
      - DB_SERVER=mssql
      - DB_NAME=VXT
      - DB_USER=sa
      - DB_PASSWORD=${SA_PASSWORD}
    depends_on:
      - mssql
    restart: always
```

## Key Databases Tables Created

| Table | Purpose | Rows |
|-------|---------|------|
| `eventLog` | Master log of all analysis results | Thousands |
| `eventLogDetails` | Detailed attribute contributions per event log | Millions |

### Schema Example

**eventLog**:
- eventLogId (PK)
- entityId, eventId (FK)
- cumulativeScore, riskLevel
- eventType ('SIMPLE', 'AI', 'ANOMALY')
- processingTimeMs
- createDate

**eventLogDetails**:
- eventLogDetailsId (PK)
- eventLogId (FK)
- entityTypeAttributeId (FK)
- attributeValue, scoreContribution
- withinRange ('Y'/'N')
- createDate

## Query Performance Tips

1. **Add index for common queries**:
   ```sql
   CREATE INDEX IX_eventLog_Entity_Date ON eventLog(entityId, createDate DESC);
   CREATE INDEX IX_eventLog_RiskDate ON eventLog(riskLevel, createDate DESC);
   ```

2. **Archive old data**:
   ```sql
   -- Weekly archive (adjust as needed)
   DELETE FROM eventLogDetails 
   WHERE eventLogId IN (
       SELECT eventLogId FROM eventLog 
       WHERE createDate < DATEADD(DAY, -90, GETDATE())
   );
   ```

3. **Regular maintenance**:
   ```sql
   -- Rebuild fragmented indexes
   ALTER INDEX ALL ON eventLog REBUILD;
   ALTER INDEX ALL ON eventLogDetails REBUILD;
   ```

## Frequently Asked Questions

**Q: How often does analysis run?**  
A: Every 5 minutes by default (configurable in code)

**Q: What happens if a subscription is paused?**  
A: Set `active = 'N'` on CustomerSubscriptions; it will be skipped

**Q: Can I add new scoring rules dynamically?**  
A: Yes, insert new rows into EntityTypeAttributeScore; they take effect immediately

**Q: How long are logs retained?**  
A: Indefinitely by default; configure cleanup in sp_ExecuteActiveSubscriptionAnalysis

**Q: Can I run Python functions without TSQL analysis?**  
A: Yes, set FunctionType='PYTHON' on the Event directly

**Q: What if a Python function fails?**  
A: Error is logged; analysis continues; no impact on other subscriptions

## Support & Resources

- **Setup Guide**: See `SUBSCRIPTION_WORKER_GUIDE.md`
- **Logs**: `c:\VXT\worker_analysis.log`
- **Tests**: Run `python test_integration.py`
- **Schema Docs**: Check individual SQL files in `db/sql/`

## Architecture Diagram

```
    ┌──────────────────┐
    │   SQL Server     │
    │   VXT Database   │
    └────────┬─────────┘
             │
    ┌────────▼───────────────────────┐
    │ Subscription Analysis Worker   │
    │ (Python - runs every 5 min)    │
    └────────┬───────────────────────┘
             │
    ┌────────┴─────────────────────┐
    │                              │
    ▼                              ▼
┌─────────────┐            ┌──────────────┐
│   TSQL      │            │ Python Funcs │
│ AnalyzeScore│            │ - Anomaly    │
│             │            │ - Trends     │
│ Functions   │            │ - ML Models  │
└────────┬────┘            │ - Alerts     │
         │                 └──────┬───────┘
         └────────┬────────────────┘
                  │
         ┌────────▼────────┐
         │  eventLog       │
         │  eventLogDetails│
         └─────────────────┘
```

---

**Last Updated**: February 2026  
**Version**: 1.0  
**Status**: Production Ready
