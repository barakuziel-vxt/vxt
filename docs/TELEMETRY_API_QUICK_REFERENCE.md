# EntityTelemetry API Quick Reference

## API Endpoints Summary

### 1. Latest Telemetry Values
```
GET /api/telemetry/latest/{entity_id}
```
**Response**: Array of current readings for each attribute

**Fields**:
- `attributeCode` - Unique identifier (e.g., "propulsion.main.revolutions")
- `attributeName` - Display name (e.g., "Engine RPM")
- `attributeUnit` - Unit of measurement (e.g., "rpm", "K")
- `numericValue` - Current value
- `endTimestampUTC` - Reading timestamp
- `defaultInGraph` - Auto-select in charts? ("Y"/"N")

**Example Response**:
```json
[
  {
    "entityTypeAttributeId": 1145,
    "attributeCode": "propulsion.main.revolutions",
    "attributeName": "Engine RPM",
    "attributeUnit": "rpm",
    "defaultInGraph": "Y",
    "numericValue": 1500.0,
    "stringValue": null,
    "endTimestampUTC": "2026-03-17T14:30:00"
  },
  {
    "entityTypeAttributeId": 1147,
    "attributeCode": "propulsion.main.temperature",
    "attributeName": "ENG TEMP",
    "attributeUnit": "K",
    "defaultInGraph": "Y",
    "numericValue": 358.15,
    "endTimestampUTC": "2026-03-17T14:30:00"
  }
]
```

---

### 2. Telemetry Range (Time-Series Data)
```
GET /api/telemetry/range/{entity_id}?startDate={ISO8601}&endDate={ISO8601}
```
**Purpose**: Retrieve historical telemetry for charting

**Parameters**:
- `startDate` - UTC ISO format (e.g., "2026-03-17T12:30:00.000Z")
- `endDate` - UTC ISO format (e.g., "2026-03-17T14:30:00.000Z")

**Response**: Array of pivot objects (timestamp as key, attributes as properties)

**Fields** (per record):
- `endTimestampUTC` - Timestamp
- `latitude` - GPS latitude
- `longitude` - GPS longitude
- `{attributeCode}` - Attribute value (e.g., `"propulsion.main.revolutions": 1200`)

**Example Response**:
```json
[
  {
    "endTimestampUTC": "2026-03-17T12:31:00",
    "latitude": 32.0,
    "longitude": 34.5,
    "propulsion.main.revolutions": 1200.0,
    "propulsion.main.temperature": 355.15,
    "tanks.wasteWaterTank.level": 60.0
  },
  {
    "endTimestampUTC": "2026-03-17T12:32:00",
    "latitude": 32.001,
    "longitude": 34.501,
    "propulsion.main.revolutions": 1250.0,
    "propulsion.main.temperature": 356.15,
    "tanks.wasteWaterTank.level": 61.2
  }
]
```

**Backend Processing**:
1. SQL query with TOP 20000 row limit
2. Pivot by timestamp in Python
3. Sort ASC by timestamp
4. Return time-series data

---

### 3. Events Range
```
GET /api/events/range/{entity_id}?startDate={ISO8601}&endDate={ISO8601}
```
**Purpose**: Retrieve detected events/anomalies for time range

**Response**: Array of EventLog records

**Fields**:
- `eventLogId` - Event record ID
- `eventId` - Event type reference
- `eventCode` - Event identifier
- `eventDescription` - Human-readable description
- `risk` - Risk level (HIGH, MEDIUM, LOW)
- `cumulativeScore` - Detection score (0-100)
- `probability` - Confidence (0.0-1.0)
- `triggeredAt` - Detection timestamp
- `analysisWindowInMin` - Lookback window

**Example Response**:
```json
[
  {
    "eventLogId": 12345,
    "eventId": 1,
    "eventCode": "HIGH_RPM",
    "eventDescription": "Engine RPM exceeded threshold",
    "risk": "HIGH",
    "cumulativeScore": 85,
    "probability": 0.92,
    "triggeredAt": "2026-03-17T14:15:30",
    "analysisWindowInMin": 5
  }
]
```

---

### 4. Event Details
```
GET /api/eventlog/{eventlog_id}/details
```
**Purpose**: Get attribute-level breakdown of event detection

**Response**: EventLog object with details array

**Fields** (per detail):
- `attributeCode` - Attribute that contributed
- `attributeName` - Display name
- `numericValue` - Attribute value at detection time
- `attributeUnit` - Unit of measurement
- `scoreContribution` - Points contributed to event score
- `withinRange` - Was value in normal range? (Y/N)

**Example Response**:
```json
{
  "eventLogId": 12345,
  "eventCode": "HIGH_RPM",
  "eventDescription": "Engine RPM exceeded threshold",
  "risk": "HIGH",
  "cumulativeScore": 85,
  "details": [
    {
      "attributeCode": "propulsion.main.revolutions",
      "attributeName": "Engine RPM",
      "numericValue": 2500,
      "attributeUnit": "rpm",
      "scoreContribution": 75,
      "withinRange": "N"
    },
    {
      "attributeCode": "propulsion.main.temperature",
      "attributeName": "ENG TEMP",
      "numericValue": 365.15,
      "attributeUnit": "K",
      "scoreContribution": 10,
      "withinRange": "N"
    }
  ]
}
```

---

### 5. Entity Attribute Scores
```
GET /api/entity-attributes/{attribute_code}/scores
```
**Purpose**: Get score ranges for an attribute (for tooltip details)

**Response**: Array of score tier definitions

**Example Response** (for "propulsion.main.revolutions"):
```json
[
  {
    "score": 0,
    "minValue": 0,
    "maxValue": 1000,
    "status": "NORMAL"
  },
  {
    "score": 25,
    "minValue": 1000,
    "maxValue": 2000,
    "status": "NORMAL"
  },
  {
    "score": 50,
    "minValue": 2000,
    "maxValue": 2500,
    "status": "WARNING"
  },
  {
    "score": 100,
    "minValue": 2500,
    "maxValue": 3500,
    "status": "CRITICAL"
  }
]
```

---

## Core SQL Queries

### SQL: Get Latest Telemetry Value Per Attribute
```sql
WITH LatestPerAttribute AS (
  SELECT
    eta.entityTypeAttributeId,
    eta.entityTypeAttributeCode,
    eta.entityTypeAttributeName,
    eta.entityTypeAttributeUnit,
    eta.defaultInGraph,
    et.numericValue,
    et.stringValue,
    et.endTimestampUTC,
    pa.protocolAttributeCode,
    pa.description,
    ROW_NUMBER() OVER (PARTITION BY eta.entityTypeAttributeId ORDER BY et.endTimestampUTC DESC) AS rn
  FROM dbo.EntityTelemetry et WITH (NOLOCK)
  JOIN dbo.EntityTypeAttribute eta WITH (NOLOCK) 
    ON et.entityTypeAttributeId = eta.entityTypeAttributeId
  LEFT JOIN dbo.ProtocolAttribute pa WITH (NOLOCK) 
    ON eta.protocolId = pa.protocolId 
    AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
  WHERE et.entityId = @entityId
    AND (et.numericValue IS NOT NULL OR et.stringValue IS NOT NULL)
)
SELECT 
  entityTypeAttributeId,
  entityTypeAttributeCode,
  entityTypeAttributeName,
  entityTypeAttributeUnit,
  defaultInGraph,
  numericValue,
  stringValue,
  endTimestampUTC,
  protocolAttributeCode,
  description
FROM LatestPerAttribute 
WHERE rn = 1
ORDER BY entityTypeAttributeCode;
```

**Key Pattern**: ROW_NUMBER with PARTITION BY ensures only latest per attribute

---

### SQL: Get Telemetry Time-Series Data
```sql
SELECT TOP 20000
    et.entityTypeAttributeId,
    eta.entityTypeAttributeCode,
    et.numericValue,
    et.endTimestampUTC,
    et.latitude,
    et.longitude
FROM dbo.EntityTelemetry et WITH (NOLOCK)
JOIN dbo.EntityTypeAttribute eta WITH (NOLOCK) 
  ON et.entityTypeAttributeId = eta.entityTypeAttributeId
WHERE et.entityId = @entityId
  AND et.endTimestampUTC >= @startDate
  AND et.endTimestampUTC <= @endDate
ORDER BY et.endTimestampUTC ASC;
```

**Key Notes**:
- TOP 20000: Safety limit prevents long scans
- NOLOCK: Non-locking reads for performance
- Index on (entityId, endTimestampUTC) is critical

---

### SQL: Get Events for Time Range
```sql
SELECT
    el.eventLogId,
    el.eventId,
    e.eventCode,
    e.eventDescription,
    el.risk,
    el.cumulativeScore,
    el.probability,
    el.triggeredAt,
    el.analysisWindowInMin
FROM dbo.EventLog el WITH (NOLOCK)
JOIN dbo.Event e WITH (NOLOCK) ON el.eventId = e.eventId
WHERE el.entityId = @entityId
  AND el.triggeredAt >= @startDate
  AND el.triggeredAt <= @endDate
ORDER BY el.risk DESC, el.triggeredAt DESC;
```

---

### SQL: Get Event Attribute Details
```sql
SELECT
    eld.attributeCode,
    eld.attributeName,
    eld.numericValue,
    eld.attributeUnit,
    eld.scoreContribution,
    eld.withinRange
FROM dbo.EventLogDetails eld WITH (NOLOCK)
WHERE eld.eventLogId = @eventLogId
ORDER BY eld.scoreContribution DESC;
```

---

## Frontend Integration Points

### Load Data Flow (EntityTelemetryRNPage)
```javascript
async function loadData() {
  // 1. Latest values
  const latestRes = await fetch(`${BASE}/api/telemetry/latest/${selectedEntity}`);
  const latest = await latestRes.json();
  setLatestValues(latest);
  
  // 2. Time-series data
  const telRes = await fetch(
    `${BASE}/api/telemetry/range/${selectedEntity}?startDate=${start}&endDate=${end}`
  );
  const tel = await telRes.json();
  setTelemetryData(tel);
  
  // 3. Events
  const evRes = await fetch(
    `${BASE}/api/events/range/${selectedEntity}?startDate=${start}&endDate=${end}`
  );
  const ev = await evRes.json();
  setEvents(ev);
}
```

### Chart Data Preparation
```javascript
const chartData = telemetryData
  .map(rec => {
    const ts = new Date(rec.endTimestampUTC).getTime();
    const point = { ts };
    
    // Apply unit conversions
    activeMetrics.forEach(metric => {
      const val = rec[metric.attributeCode];
      if (typeof val === 'number') {
        point[metric.attributeCode] = convertValue(
          val,
          metric.attributeCode,
          metric.attributeUnit
        );
      }
    });
    
    return point;
  })
  .sort((a, b) => a.ts - b.ts);
```

### Unit Conversion Application
```javascript
// Example: Temperature K → °C
const converted = convertValue(
  358.15,                           // Kelvin value
  'propulsion.main.temperature',    // Attribute code
  'K'                              // Source unit
);
// Result: 85 (after converting K→°C)
```

---

## Database Table References

### EntityTelemetry
Stores individual telemetry readings with timestamp, value, and location
- PK: `entityTelemetryId`
- FK: `entityId`, `entityTypeAttributeId`
- Index: Likely on (entityId, endTimestampUTC) for range queries

### EntityTypeAttribute
Defines what attributes exist and their metadata
- Columns: `entityTypeAttributeCode`, `entityTypeAttributeName`, `entityTypeAttributeUnit`, `defaultInGraph`, `protocolId`

### EventLog
Stores detected event records
- Columns: `eventLogId`, `eventId`, `entityId`, `risk`, `cumulativeScore`, `probability`, `triggeredAt`

### EventLogDetails
Stores per-attribute contributions to events
- Columns: `eventLogId`, `attributeCode`, `scoreContribution`, `withinRange`, `numericValue`

---

## Performance Considerations

| Query | Bottleneck | Mitigation |
|-------|-----------|-----------|
| `/api/telemetry/range` | Large COLUMNSTORE scans | TOP 20000 limit; index on (entityId, endTimestampUTC) |
| Latest values (ROW_NUMBER) | Partition function overhead | NOLOCK; narrow column selection |
| Event details join | Multiple tables | NOLOCK; consider denormalization |
| Unit conversions | Frontend loop | Minimize for 100+ attributes |

---

## Debug/Testing

### Test Latest Values Endpoint
```bash
curl "http://localhost:8000/api/telemetry/latest/033114870" \
  -H "Content-Type: application/json"
```

### Test Telemetry Range
```bash
curl "http://localhost:8000/api/telemetry/range/033114870?startDate=2026-03-17T12%3A00%3A00.000Z&endDate=2026-03-17T14%3A00%3A00.000Z" \
  -H "Content-Type: application/json"
```

### Check attribute codes in database
```sql
SELECT DISTINCT entityTypeAttributeCode, entityTypeAttributeName, entityTypeAttributeUnit
FROM dbo.EntityTypeAttribute
WHERE active = 'Y'
ORDER BY entityTypeAttributeCode;
```

### Find RPM-related attributes
```sql
SELECT *
FROM dbo.EntityTypeAttribute
WHERE entityTypeAttributeCode LIKE '%revolutions%' OR entityTypeAttributeCode LIKE '%rpm%'
ORDER BY entityTypeAttributeCode;
```

