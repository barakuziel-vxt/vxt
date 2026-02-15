# AI Analysis Metadata Architecture - Implementation Guide

## Architecture Decision

**TSQL Functions (NEWS)**: Use predefined `entityTypeAttributeScore` table ranges
**Python Functions (DriftDetector, future AI)**: Use dynamic `EventLog.analysisMetadata` JSON with statistical findings

---

## 1. Database Schema Change

**File**: `db/sql/0180_Add_AnalysisMetadata_to_EventLog.sql`

Added `analysisMetadata` column to `EventLog` table:
```sql
ALTER TABLE dbo.EventLog ADD analysisMetadata NVARCHAR(MAX) NULL;
```

### JSON Structure Example (DriftDetector):
```json
{
  "functionType": "PYTHON",
  "analysisType": "DriftDetector",
  "analysisWindow": {
    "lookbackMinutes": 1440,
    "baselineDays": 7
  },
  "baselineAnalysis": {
    "avgValue": 65.2,
    "sampleCount": 342,
    "dateRange": "2026-02-08 to 2026-02-15"
  },
  "currentAnalysis": {
    "avgValue": 92.3,
    "sampleCount": 24,
    "dateRange": "2026-02-15 to 2026-02-16"
  },
  "multiAttributeFindings": {
    "correlations": [...]
  },
  "detectionMetadata": {
    "method": "z-score",
    "threshold": 1.8,
    "z_score": 2.45,
    "drift_percentage": 38.5,
    "sensitivity": "high"
  }
}
```

---

## 2. Python DriftDetector Updates

**File**: `drift_detector.py` (lines ~420-460)

### Enhanced Response Structure:
```python
return {
    'status': 'success',
    'cumulative_score': 100,
    'probability': 0.95,
    'details': [
        {
            'entityTypeAttributeId': 7,
            'scoreContribution': 100,
            'withinRange': 'true',
            'z_score': 2.45,
            'drift_percentage': 38.5,
            'current_avg': 92.3,
            'baseline_avg': 65.2,
            'confidence': 0.95
        }
    ],
    'analysisMetadata': { ... }  # NEW: Statistical context
}
```

**Key Addition**: DriftDetector now returns `analysisMetadata` containing:
- Baseline statistics (avg, sample count, date range)
- Current analysis statistics
- Detection method and threshold
- Z-score and drift calculations

---

## 3. Worker Updates

**File**: `subscription_analysis_worker.py`

### 3A. Updated `register_event()` method (line 255):
```python
def register_event(self, entity_id, event_id, cumulative_score, probability, 
                   triggered_at, analysis_window_min, processing_time_ms, 
                   details=None, analysis_metadata=None):
```

- Now accepts optional `analysis_metadata` parameter
- Stores `analysisMetadata` in EventLog INSERT statement
- Only stores for PYTHON functions (TSQL functions pass `None`)

### 3B. Updated EventLog INSERT:
```sql
INSERT INTO dbo.EventLog (
    entityId, eventId, cumulativeScore, probability,
    triggeredAt, AnalysisWindowInMin, processingTimeMs,
    analysisMetadata  -- NEW
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);
```

### 3C. Call site improvement (line ~560):
```python
# Extract analysisMetadata from Python function results (not used for TSQL)
analysis_metadata = analysis_result.get('analysisMetadata', None)
function_type = subscription.get('functionType', 'PYTHON')

# Pass to register_event only for PYTHON functions
event_log_id = self.register_event(
    entity_id, event_id, cumulative_score, probability,
    triggered_at, analysis_window_min, processing_time_ms, details,
    analysis_metadata=analysis_metadata if function_type == 'PYTHON' else None
)
```

---

## 4. UI Component Updates

**File**: `admin-dashboard/src/pages/EntityTelemetryAnalyticsPage.jsx`

### 4A. Enhanced `showScoreDetails()` function (line ~360):

**Smart Detection Logic**:
1. Check if EventLog has `analysisMetadata`
2. If `functionType === 'PYTHON'`: Use analysis statistics
3. If TSQL or null: Fetch predefined `entityTypeAttributeScore` ranges

```javascript
// Check if event has analysisMetadata (PYTHON/AI functions)
if (selectedEventLog?.analysisMetadata) {
  const metadata = typeof selectedEventLog.analysisMetadata === 'string' 
    ? JSON.parse(selectedEventLog.analysisMetadata) 
    : selectedEventLog.analysisMetadata;
  
  if (metadata && metadata.functionType === 'PYTHON') {
    detailToShow.analysisMetadata = metadata;
    detailToShow.isPythonAnalysis = true;
    setSelectedScoreDetail(detailToShow);
    return;  // Skip predefined score fetch
  }
}

// For TSQL/NEWS: fetch predefined scoring rules as before
```

### 4B. Display Logic (line ~910):

**Conditional Rendering**:

**For PYTHON/AI Functions** (NEW):
```
Analysis Statistics
├─ Baseline (7 days)
│  ├─ Average: 65.2
│  └─ Samples: 342
├─ Current Analysis
│  ├─ Average: 92.3
│  └─ Samples: 24
└─ Detection Results
   ├─ Method: z-score
   ├─ Z-Score: 2.45σ
   ├─ Drift: +38.5%
   └─ Sensitivity: high
```

**For TSQL/NEWS Events** (UNCHANGED):
```
Scoring Ranges
├─ Score 0: 60-70 (normal)
├─ Score 50: 70-80 (elevated)
└─ Score 100: 80+ (critical)
```

---

## 5. Usage Pattern

### For TSQL/NEWS Events (Existing):
```
EventLog: eventLogId, cumulativeScore, probability, AnalysisWindowInMin
EventLogDetails: predefined entityTypeAttributeScore ranges displayed
analysisMetadata: NULL
```

### For Python AI Events (New):
```
EventLog: eventLogId, cumulativeScore, probability, analysisMetadata (JSON)
EventLogDetails: z_score, drift_percentage, baseline_avg, current_avg, confidence
```

---

## 6. Migration Steps

1. **Run SQL Migration**: `0180_Add_AnalysisMetadata_to_EventLog.sql`
   ```bash
   python deploy_sql.py
   ```

2. **Updated Files Ready**:
   - ✅ `drift_detector.py` - Returns analysisMetadata
   - ✅ `subscription_analysis_worker.py` - Stores analysisMetadata
   - ✅ `EntityTelemetryAnalyticsPage.jsx` - Displays intelligently

3. **Test**:
   - Trigger RestHeartRateDrift event
   - View EventLog details
   - Should display "Analysis Statistics" instead of "Scoring Ranges"

---

## 7. Future-Proof Design

Any new Python/AI function can:

1. **Return analysisMetadata** with its findings:
```python
{
  'analysisType': 'CorrelationAnalyzer',
  'correlations': [...],
  'confidence': 0.92,
  ...
}
```

2. **Worker automatically stores it** in EventLog

3. **UI automatically displays it** if `functionType === 'PYTHON'`

No UI changes needed for each new AI function!

---

## 8. Key Advantages

✅ **Separation of Concerns**: TSQL ≠ Python logic  
✅ **Extensible**: New AI functions don't need UI updates  
✅ **Backward Compatible**: Existing TSQL functions unaffected  
✅ **Data Preservation**: All statistical findings captured  
✅ **Multi-Attribute Ready**: Can store correlations, patterns  
✅ **Generic Pattern**: Works for any complex analysis
