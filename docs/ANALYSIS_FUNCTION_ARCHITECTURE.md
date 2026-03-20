# Analysis Function Architecture Pattern

## Overview

All analysis functions now follow a **Two-Layer Pattern**:

1. **Pure Mathematical Layer** - Reusable calculation engine
2. **Worker Integration Layer** - Worker-specific formatting and orchestration

This pattern ensures maximum code reusability and clean separation of concerns.

## Pattern Comparison

### Geofence System

```
┌─────────────────────────────────────────┐
│   subscription_analysis_worker.py       │
│   (executes every 5 minutes)            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  geofence_event_analyzer.py             │
│  Worker Integration Layer               │
│  - Receives: entity_id, telemetry_data  │
│  - Returns: {status, score, details[]}  │
└──────────────┬──────────────────────────┘
               │ Calls
               ▼
┌─────────────────────────────────────────┐
│  geofence_analyzer.py                   │
│  Pure Mathematical Layer                │
│  - Receives: lat, lon, geofences[]      │
│  - Returns: cumulative_score            │
│  - Reusable in other contexts           │
└─────────────────────────────────────────┘
```

**Usage Example:**
```python
# Can be used standalone (pure math)
from geofence_analyzer import analyze_geofence
score = analyze_geofence(connection, customer_id, lat, lon)

# Or through worker integration
from geofence_event_analyzer import analyze_geofence_event
result = analyze_geofence_event(entity_id, event_id, ..., connection)
```

---

### Anomaly Detection System

```
┌─────────────────────────────────────────┐
│   subscription_analysis_worker.py       │
│   (executes every 5 minutes)            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  analysis_functions.py                  │
│  Worker Integration Layer               │
│  - Receives: entity_id, telemetry_data  │
│  - Returns: {status, score, details[]}  │
│  - Function: detect_anomaly()           │
└──────────────┬──────────────────────────┘
               │ Calls
               ▼
┌─────────────────────────────────────────┐
│  anomaly_calculator.py                  │
│  Pure Mathematical Layer                │
│  - Receives: criteria[], telemetry[]    │
│  - Returns: {score, probability, risk}  │
│  - Function: calculate_anomaly_score()  │
│  - Reusable in other contexts           │
└─────────────────────────────────────────┘
```

**Usage Example:**
```python
# Can be used standalone (pure math)
from anomaly_calculator import calculate_anomaly_score
result = calculate_anomaly_score(criteria, telemetry)
# Returns: {cumulative_score, probability, risk_level, details[], analysis_notes}

# Or through worker integration
from analysis_functions import detect_anomaly
result = detect_anomaly(entity_id, event_id, criteria, telemetry, ...)
# Returns: {status, cumulative_score, probability, details[]}
```

---

## Module Responsibilities

### Pure Mathematical Layer

**Purpose**: Reusable calculation engine independent of worker integration.

**Characteristics**:
- ✅ No dependencies on worker/subscription context
- ✅ Pure input → output transformations
- ✅ Can be used standalone in any context (scripts, APIs, testing, etc.)
- ✅ No database connections required
- ✅ No logging of worker context
- ✅ Comprehensive error handling for invalid inputs
- ✅ Full docstrings with examples

**Modules**:
- `geofence_analyzer.py` - Shapely geometry calculations
- `anomaly_calculator.py` - Scoring logic

**Example Methods**:
```python
# Pure math - no worker context
def analyze_geofence(db_connection, customer_id, lat, lon):
    """Returns cumulative_score"""
    
def calculate_anomaly_score(event_criteria, telemetry_data):
    """Returns {cumulative_score, probability, risk_level, details[], analysis_notes}"""
```

---

### Worker Integration Layer

**Purpose**: Bridge between worker and pure math layer; format results for event registration.

**Characteristics**:
- ✅ Knows about subscriptions, events, entity context
- ✅ Receives worker parameters: entity_id, event_id, triggered_at, etc.
- ✅ Calls pure math layer functions
- ✅ Formats results for `register_event()` method
- ✅ Contains business logic: data extraction, composition
- ✅ Handles worker-specific error cases
- ✅ Logs analysis lifecycle with worker context

**Modules**:
- `geofence_event_analyzer.py` - Geofence event detection
- `analysis_functions.py` - Anomaly detection, trends, etc.

**Example Methods**:
```python
# Worker integration - knows about subscriptions
def analyze_geofence_event(entity_id, event_id, event_criteria, telemetry_data, connection):
    """
    Returns {status, cumulative_score, probability, details[]}
    Formatted for worker.register_event()
    """
    
def detect_anomaly(entity_id, event_id, event_criteria, telemetry_data, connection):
    """
    Returns {status, cumulative_score, probability, details[]}
    Formatted for worker.register_event()
    """
```

---

## Data Flow: Anomaly Detection Example

### Input Data Structure

**Event Criteria** (from EventAttribute mapping):
```python
event_criteria = [
    {
        'entityTypeAttributeId': 1,
        'attributeCode': 'heartRate',
        'score': 10,           # Points if out of range
        'minValue': 60,        # Normal range
        'maxValue': 100
    },
    {
        'entityTypeAttributeId': 2,
        'attributeCode': 'bloodPressure',
        'score': 20,
        'minValue': 80,
        'maxValue': 120
    }
]
```

**Telemetry Data** (from EntityTelemetry):
```python
telemetry_data = [
    {
        'entityTelemetryId': 100,
        'entityTypeAttributeId': 1,
        'attributeCode': 'heartRate',
        'numericValue': 95        # Within range [60-100]
    },
    {
        'entityTelemetryId': 101,
        'entityTypeAttributeId': 2,
        'attributeCode': 'bloodPressure',
        'numericValue': 145       # Out of range [80-120]
    }
]
```

### Pure Math Calculation

```python
from anomaly_calculator import calculate_anomaly_score

result = calculate_anomaly_score(event_criteria, telemetry_data)
```

**Returns**:
```python
{
    'cumulative_score': 20,        # Score from out-of-range attribute
    'probability': 0.65,            # Confidence score
    'risk_level': 'MEDIUM',         # Risk classification
    'details': [
        {
            'entityTypeAttributeId': 1,
            'entityTelemetryId': 100,
            'scoreContribution': 0,        # In range
            'withinRange': 'Y'
        },
        {
            'entityTypeAttributeId': 2,
            'entityTelemetryId': 101,
            'scoreContribution': 20,       # Out of range
            'withinRange': 'N'
        }
    ],
    'analysis_notes': 'Analyzed 2 criteria, found 1 out of range'
}
```

### Worker Integration

```python
from analysis_functions import detect_anomaly

result = detect_anomaly(
    entity_id=1001,
    event_id=5,
    event_criteria=criteria,
    telemetry_data=telemetry,
    connection=db_conn
)
```

**Returns** (formatted for `register_event()`):
```python
{
    'status': 'success',
    'entity_id': 1001,
    'event_id': 5,
    'cumulative_score': 20,
    'probability': 0.65,
    'details': [
        {
            'entityTypeAttributeId': 1,
            'entityTelemetryId': 100,
            'scoreContribution': 0,
            'withinRange': 'Y'
        },
        {
            'entityTypeAttributeId': 2,
            'entityTelemetryId': 101,
            'scoreContribution': 20,
            'withinRange': 'N'
        }
    ]
}
```

### Event Registration

```python
# Worker calls register_event with result
worker.register_event(
    entity_id=1001,
    event_id=5,
    cumulative_score=20,    # From detect_anomaly
    probability=0.65,
    details=result['details'],
    triggered_at=datetime.now()
)
```

**Inserts into EventLog + EventLogDetails**:
- `EventLog`: 1 row with cumulative_score=20, probability=0.65
- `EventLogDetails`: 2 rows (one per attribute with details)

---

## Adding New Analysis Functions

### Step 1: Create Pure Math Module

File: `my_analyzer.py`

```python
def calculate_my_score(input_data: list) -> dict:
    """
    Pure mathematical calculation.
    
    Args:
        input_data: List of data points
        
    Returns:
        dict: {cumulative_score, probability, risk_level, details[], analysis_notes}
    """
    try:
        # Your calculation logic here
        result = {
            'cumulative_score': 50,
            'probability': 0.8,
            'risk_level': 'HIGH',
            'details': [...],
            'analysis_notes': '...'
        }
        return result
    except Exception as e:
        logger.error(f"Calculation error: {e}")
        return {'cumulative_score': 0, ...}
```

### Step 2: Create Worker Integration Function

File: `analysis_functions.py` (or separate file)

```python
from my_analyzer import calculate_my_score

def analyze_my_event(entity_id: str, event_id: int, event_criteria: list, 
                     telemetry_data: list, **kwargs):
    """
    Worker integration layer.
    
    Args:
        entity_id: Entity being analyzed
        event_id: Event ID
        event_criteria: Event configuration
        telemetry_data: Telemetry to analyze
        
    Returns:
        dict: {status, cumulative_score, probability, details[]}
    """
    try:
        # Call pure math function
        calc_result = calculate_my_score(telemetry_data)
        
        # Format for worker
        result = {
            'status': 'success',
            'cumulative_score': calc_result['cumulative_score'],
            'probability': calc_result['probability'],
            'details': calc_result['details']
        }
        return result
    except Exception as e:
        return {'status': 'error', 'error': str(e)}
```

### Step 3: Register in Database

```sql
INSERT INTO AnalyzeFunction (FunctionName, FunctionType, AnalyzePath, active)
VALUES ('My Custom Analyzer', 'PYTHON', 'analysis_functions.analyze_my_event', 'Y');
```

---

## Testing Strategy

### Unit Test: Pure Math Layer

```python
import unittest
from anomaly_calculator import calculate_anomaly_score

class TestAnomalyCalculator(unittest.TestCase):
    def test_all_in_range(self):
        criteria = [{'entityTypeAttributeId': 1, 'score': 10, 'minValue': 60, 'maxValue': 100}]
        telemetry = [{'entityTypeAttributeId': 1, 'entityTelemetryId': 100, 'numericValue': 85}]
        
        result = calculate_anomaly_score(criteria, telemetry)
        
        assert result['cumulative_score'] == 0
        assert result['risk_level'] == 'LOW'
```

### Integration Test: Worker Layer

```python
import unittest
from analysis_functions import detect_anomaly

class TestDetectAnomaly(unittest.TestCase):
    def test_worker_integration(self):
        result = detect_anomaly(
            entity_id=1,
            event_id=5,
            event_criteria=criteria,
            telemetry_data=telemetry,
            connection=mock_conn
        )
        
        assert result['status'] == 'success'
        assert 'entity_id' in result
        assert 'cumulative_score' in result
```

---

## Summary Table

| Aspect | Pure Math | Worker Integration |
|--------|-----------|-------------------|
| **Module** | `geofence_analyzer`, `anomaly_calculator` | `geofence_event_analyzer`, `analysis_functions` |
| **Purpose** | Calculation engine | Event detection |
| **Inputs** | Raw data (positions, values) | Worker context (entity_id, event_id) |
| **Outputs** | Scores, probabilities, details | Worker-formatted dict + EventLog/Details |
| **Dependencies** | None (except data structures) | Worker, subscription context |
| **Error Handling** | Input validation | Worker integration errors |
| **Reusability** | High (any context) | Worker-specific |
| **Testing** | Unit tests | Integration tests |

---

## Key Benefits

✅ **Separation of Concerns** - Math logic isolated from worker integration  
✅ **Reusability** - Pure math functions usable in scripts, APIs, testing  
✅ **Maintainability** - Changes to calculation don't affect worker integration  
✅ **Testability** - Pure math trivial to unit test without worker  
✅ **Consistency** - All analyzers follow same pattern  
✅ **Composability** - Can chain multiple pure math functions
