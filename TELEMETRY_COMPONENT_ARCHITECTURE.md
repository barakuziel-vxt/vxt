# EntityTelemetryRN Component & API Architecture

## Overview
The EntityTelemetry system displays real-time maritime and health telemetry with event detection. It has two implementations:
- **Mobile**: React Native WebView wrapper that proxies data via native driver APIs
- **Web Admin**: React dashboard for entity telemetry visualization and analytics

---

## 1. Component Files & Structure

### 1.1 EntityTelemetryRN (Mobile)
**File**: [vxt-mobile/src/screens/EntityTelemetryRN.tsx](vxt-mobile/src/screens/EntityTelemetryRN.tsx)

**Purpose**: React Native wrapper that embeds the web dashboard in a WebView and bridges API calls to native drivers

**Key Features**:
- Loads admin dashboard's EntityTelemetryRNPage inside a WebView
- Bridge communication: intercepts fetch requests and proxies them via native driver APIs
- Supports three data source modes:
  - `driver`: Uses active driver (e.g., SamsungHealth, Barak Junction Health)
  - `cloud`: HTTP proxy to cloud API
  - `local`: HTTP proxy to local API
- URL parameters passed to WebView: `?embedded=true&mode=driver&dsType=&activeDriver=&cloudUrl=&localUrl=`

**Bridge Request Handlers**:
```tsx
case 'loadEntities': {
  responseData = [{
    entityId: 'driver',
    entityFirstName: driver?.displayName || 'Driver',
    entityLastName: '',
    entityTypeId: 99,
    entityTypeName: 'Driver',
  }];
  break;
}
case 'loadLatest': {
  const snapshot = await driver.getLatest();
  responseData = snapshot ? snapshotToLatest(snapshot) : [];
  break;
}
case 'loadRange': {
  const history = await driver.getHistory(startMs, endMs);
  responseData = historyToTelemetry(history);
  break;
}
case 'loadEvents': { responseData = []; break; }  // No events from driver
case 'loadEventDetails': { responseData = {}; break; }
case 'loadScores': { responseData = []; break; }
```

**Data Conversion Functions**:
- `snapshotToLatest(snapshot: SnapshotMap)`: Converts driver snapshot → `/api/telemetry/latest` format
- `historyToTelemetry(history: HistoryMap)`: Converts driver history → `/api/telemetry/range` format

---

### 1.2 EntityTelemetryRNPage (Web Admin)
**File**: [admin-dashboard/src/pages/EntityTelemetryRNPage.jsx](admin-dashboard/src/pages/EntityTelemetryRNPage.jsx)

**Purpose**: Dashboard page showing telemetry charts, latest values, and detected events

**Features**:
- **Entity Selection**: Dropdown to select from available entities
- **Date Range**: Start/End datetime pickers (default: last 2 hours)
- **Attribute Toggle**: Multi-select tiles to choose which metrics to display
- **Interactive Chart**: Multi-series line chart using Recharts
- **Latest Values**: Grid of current readings with units
- **Events Table**: Detected anomalies with risk levels
- **Event Details Modal**: Breakdown of attribute contributions to events
- **PDF Export**: Generate telemetry report

**State Management**:
```jsx
const [entities, setEntities] = useState([]);
const [selectedEntity, setSelectedEntity] = useState(null);
const [startDate, setStartDate] = useState(() => toLocalISOString(new Date(Date.now() - 2 * 3_600_000)));
const [endDate, setEndDate] = useState(() => toLocalISOString(new Date()));

const [latestValues, setLatestValues] = useState([]);     // Current readings
const [telemetryData, setTelemetryData] = useState([]);   // Time-series data
const [events, setEvents] = useState([]);                 // Detected events
const [selectedMetrics, setSelectedMetrics] = useState({});  // Chart selection
```

**Modes**:
- **Embedded Mode** (`IS_EMBEDDED`): Runs inside React Native WebView, uses bridge for data
- **Driver Mode** (`IS_DRIVER_MODE`): Bridge proxies all data calls
- **Admin Mode**: Standalone dashboard with direct HTTP API calls

---

## 2. API Endpoints & Data Flow

### 2.1 Get Latest Telemetry
**Endpoint**: `GET /api/telemetry/latest/{entity_id}`

**Location**: [main.py](main.py#L2535)

**SQL Query**:
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
  WHERE et.entityId = ?
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
ORDER BY entityTypeAttributeCode
```

**Response Format**:
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
    "endTimestampUTC": "2026-03-17T14:30:00",
    "protocolAttributeCode": "propulsion.main.revolutions",
    "description": "Engine revolutions per second (Hz)"
  },
  {
    "entityTypeAttributeId": 1147,
    "attributeCode": "propulsion.main.temperature",
    "attributeName": "ENG TEMP",
    "attributeUnit": "K",
    "defaultInGraph": "Y",
    "numericValue": 358.15,
    "stringValue": null,
    "endTimestampUTC": "2026-03-17T14:30:00"
  },
  {
    "entityTypeAttributeId": 1151,
    "attributeCode": "tanks.wasteWaterTank.level",
    "attributeName": "Waste Water",
    "attributeUnit": "%",
    "defaultInGraph": "N",
    "numericValue": 65.5,
    "stringValue": null,
    "endTimestampUTC": "2026-03-17T14:30:00"
  }
]
```

---

### 2.2 Get Telemetry Range (for Charts)
**Endpoint**: `GET /api/telemetry/range/{entity_id}?startDate={ISO8601}&endDate={ISO8601}`

**Location**: [main.py](main.py#L2658)

**SQL Query**:
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
WHERE et.entityId = ?
  AND et.endTimestampUTC >= ?
  AND et.endTimestampUTC <= ?
ORDER BY et.endTimestampUTC ASC
```

**Response Format** (Pivoted by timestamp):
```json
[
  {
    "endTimestampUTC": "2026-03-17T13:30:00",
    "latitude": 32.0,
    "longitude": 34.5,
    "propulsion.main.revolutions": 1200.0,
    "propulsion.main.temperature": 355.15,
    "tanks.wasteWaterTank.level": 60.0
  },
  {
    "endTimestampUTC": "2026-03-17T13:31:00",
    "latitude": 32.001,
    "longitude": 34.501,
    "propulsion.main.revolutions": 1250.0,
    "propulsion.main.temperature": 356.15,
    "tanks.wasteWaterTank.level": 61.2
  }
]
```

---

### 2.3 Get Events Range
**Endpoint**: `GET /api/events/range/{entity_id}?startDate={ISO8601}&endDate={ISO8601}`

**Returns**: Detected anomalies (EventLog records) with risk levels and scores

---

### 2.4 Get Event Details
**Endpoint**: `GET /api/eventlog/{eventlog_id}/details`

**Returns**: Individual attribute contributions to event detection

---

## 3. Data Flow Diagram

```
┌─────────────────────┐
│  EntityTelemetryRN  │ (Mobile React Native)
│   (WebView Wrapper) │
└──────────┬──────────┘
           │ Embeds web page with bridge
           ↓
┌─────────────────────────────────────────┐
│ EntityTelemetryRNPage (Web Dashboard)   │
├─────────────────────────────────────────┤
│ IS_EMBEDDED=true, IS_DRIVER_MODE=true  │
└──────────┬──────────────────────────────┘
           │ 
           ├─→ (EMBEDDED MODE) ─────────────────────┐
           │   driverRequest('loadLatest', {...})    │
           │   driverRequest('loadRange', {...})     │
           │   driverRequest('loadEvents', {...})    │
           │                                          │
           │                ┌─────────────────────────┘
           │                │ Bridge Message Handler
           │                ↓ (EntityTelemetryRN.tsx)
           │         Call native driver APIs:
           │         - driver.getLatest()
           │         - driver.getHistory(startMs, endMs)
           │         - Convert to API format
           │         - postMessage back to WebView
           │
           └─→ (ADMIN MODE) ──────────────────────────────────┐
               fetch('/api/telemetry/latest/{id}')             │
               fetch('/api/telemetry/range/{id}?...')           │
               fetch('/api/events/range/{id}?...')              │
                                                                 │
                        ┌────────────────────────────────────────┘
                        │
                        ↓
              ┌──────────────────────┐
              │   FastAPI (main.py)  │
              └──────────┬───────────┘
                         │
                    SQL Queries
                         │
              ┌──────────────────────┐
              │  SQL Server Database │
              │  - EntityTelemetry   │
              │  - EntityTypeAttr    │
              │  - EventLog          │
              │  - ProtocolAttribute │
              └──────────────────────┘

Response Flow:
└─ Convert units (K→°C, Pa→Bar, rpm→rpm)
└─ Pivot by timestamp
└─ Sort chronologically
└─ Return to frontend

Chart Rendering (EntityTelemetryRNPage):
└─ Select metrics (toggles)
└─ Group by attribute code
└─ Create color mapping
└─ Render multi-series LineChart (Recharts)
```

---

## 4. EntityTelemetry Table Structure

**File**: [schema-deployment-temp.sql](schema-deployment-temp.sql#L169)

```sql
CREATE TABLE [EntityTelemetry] (
    [entityTelemetryId] bigint NOT NULL,
    [entityId] nvarchar(50) NOT NULL,              -- Entity reference (MMSI, UUID, etc.)
    [entityTypeAttributeId] int NOT NULL,          -- Links to EntityTypeAttribute
    [startTimestampUTC] datetime2 NOT NULL,        -- When reading started
    [endTimestampUTC] datetime2 NOT NULL,          -- When reading ended
    [ingestionTimestampUTC] datetime2 NULL,        -- When inserted into DB
    [providerEventInterpretation] nvarchar(50) NULL,  -- Provider's event type
    [providerDevice] nvarchar(50) NOT NULL,        -- Device source (e.g., "SignalK")
    [numericValue] float NULL,                     -- Numeric reading
    [latitude] float NULL,                         -- GPS latitude
    [longitude] float NULL,                        -- GPS longitude
    [stringValue] nvarchar(500) NULL               -- String-type readings
);
```

**Indexes**: 
- Primary key on `entityTelemetryId`
- Likely composite index on `(entityId, endTimestampUTC)` for range queries
- Likely index on `entityTypeAttributeId`

---

## 5. EntityTypeAttribute Mapping

**File**: [schema-deployment-temp.sql](schema-deployment-temp.sql#L200)

```sql
CREATE TABLE [EntityTypeAttribute] (
    [entityTypeAttributeId] int NOT NULL,
    [entityTypeId] int NOT NULL,
    [entityTypeAttributeCode] nvarchar(100) NOT NULL,   -- e.g., "propulsion.main.revolutions"
    [entityTypeAttributeName] varchar(200) NOT NULL,    -- e.g., "Engine RPM"
    [entityTypeAttributeTimeAspect] nvarchar(50) NOT NULL,
    [entityTypeAttributeUnit] nvarchar(50) NOT NULL,    -- Storage unit (K, Pa, rpm)
    [providerId] int NULL,
    [providerEventType] nvarchar(100) NULL,
    [protocolId] int NULL,
    [defaultInGraph] char(1) NULL DEFAULT ('N'),        -- Auto-select on page load
    [active] char(1) NOT NULL DEFAULT ('Y')
);
```

---

## 6. Telemetry-Related Attributes (RPM, ENG TEMP, WASTE WATER)

### 6.1 Engine RPM
| Property | Value |
|----------|-------|
| **Attribute Code** | `propulsion.main.revolutions` |
| **Display Name** | Engine RPM |
| **Unit (Storage)** | rpm (or Hz - revolutions per second) |
| **Unit (Display)** | rpm |
| **Default in Graph** | Y |
| **EntityTypeId** | 5 (Yacht) |
| **Source Protocol** | SignalK |
| **Range** | 0-3000 RPM typical |

**SQL Attribute ID**: ~1145 (from db/sql/0178_Sync_EntityTypeAttribute_Local_to_Azure.sql)

---

### 6.2 Engine Temperature
| Property | Value |
|----------|-------|
| **Attribute Code** | `propulsion.main.temperature` |
| **Display Name** | ENG TEMP / Engine Temperature |
| **Unit (Storage)** | K (Kelvin, from SignalK) |
| **Unit (Display)** | °C (converted by frontend) |
| **Conversion** | K → °C: subtract 273.15 |
| **Default in Graph** | Y |
| **EntityTypeId** | 5 (Yacht) |
| **Source Protocol** | SignalK |
| **Typical Range** | 353-363 K (80-90°C) |

**SQL Attribute ID**: ~1147

**Frontend Conversion** (unitConversion.js):
```jsx
'propulsion.main.temperature': '°C',  // Display preference
SOURCE_UNIT_ASSUMPTIONS['propulsion.main.temperature'] = 'K';
```

---

### 6.3 Waste Water Tank Level
| Property | Value |
|----------|-------|
| **Attribute Code** | `tanks.wasteWaterTank.level` |
| **Display Name** | Waste Water |
| **Unit (Storage)** | % (percentage) or L (liters) |
| **Unit (Display)** | % |
| **Default in Graph** | N |
| **EntityTypeId** | 5 (Yacht) |
| **Source Protocol** | SignalK |
| **Typical Range** | 0-100% |

**SQL Attribute ID**: ~1151 (from db/sql/0178_Sync_EntityTypeAttribute_Local_to_Azure.sql)

---

## 7. Unit Conversion Logic

**File**: [admin-dashboard/src/utils/unitConversion.js](admin-dashboard/src/utils/unitConversion.js)

### Source Unit Assumptions (Database Storage Format)
```js
const SOURCE_UNIT_ASSUMPTIONS = {
  // Yacht propulsion - always in standard SI units from SignalK
  'propulsion.main.oilPressure': 'Pa',           // Pascal
  'propulsion.main.temperature': 'K',            // Kelvin
  'propulsion.main.revolutions': 'rpm',          // RPM (already user-friendly)
  'propulsion.main.oilTemperature': 'K',         // Kelvin
  
  // Yacht tanks - assuming liters or percentage
  'tanks.freshWaterTank.level': 'L',
  'tanks.wasteWaterTank.level': 'L',             // May be %, convert if needed
};
```

### Display Unit Preferences
```js
const DISPLAY_UNIT_PREFERENCES = {
  // Propulsion
  'propulsion.main.temperature': '°C',           // Show Celsius to user
  'propulsion.main.oilPressure': 'Bar',          // Pa → Bar
  'propulsion.main.revolutions': 'rpm',          // No conversion
  
  // Tanks - Water and Fuel (displayed as percentage)
  'tanks.freshWaterTank.level': '%',
  'tanks.wasteWaterTank.level': '%',
  'tanks.fuelTank.level': '%',
};
```

### Conversion Execution in Component

**EntityTelemetryRNPage.jsx** (Chart data preparation):
```jsx
const chartData = telemetryData
  .map(rec => {
    const tsStr = rec.endTimestampUTC ?? rec.timestamp ?? '';
    const ts = new Date(tsStr.endsWith('Z') ? tsStr : tsStr + 'Z').getTime();
    const point = { ts };
    activeMetrics.forEach(v => {
      const val = rec[v.attributeCode];
      if (typeof val === 'number')
        // convertValue(numericValue, attributeCode, sourceUnit)
        point[v.attributeCode] = convertValue(val, v.attributeCode, v.attributeUnit);
    });
    return point;
  })
  .filter(p => !isNaN(p.ts))
  .sort((a, b) => a.ts - b.ts);
```

---

## 8. Filtering & Mapping Logic

### 8.1 Latest Values Filtering (Frontend)

1. **Load Latest**: `latestValues` array from API
2. **Auto-select Metrics**: Mark attributes where `defaultInGraph === 'Y'`
3. **Display**: Grid of attribute tiles with current value + unit

```jsx
useEffect(() => {
  if (latestValues.length > 0 && Object.keys(selectedMetrics).length === 0) {
    const defaults = {};
    latestValues.forEach(v => { 
      if (v.defaultInGraph === 'Y') 
        defaults[v.attributeCode] = true; 
    });
    if (Object.keys(defaults).length > 0) 
      setSelectedMetrics(defaults);
  }
}, [latestValues]);
```

### 8.2 Telemetry Range Filtering (Backend - SQL)

```sql
WHERE et.entityId = ?
  AND et.endTimestampUTC >= ?
  AND et.endTimestampUTC <= ?
ORDER BY et.endTimestampUTC ASC
```

**Limitations**: TOP 20000 rows safety cap (prevents query blocking)

### 8.3 Chart Data Mapping

1. **Pivot by Timestamp**: Group attribute values by time
2. **Filter Active Metrics**: Only include attributes toggled in UI
3. **Apply Color Scheme**: Each metric gets a color from `CHART_COLORS` array
4. **Sort Chronologically**: ASC by timestamp

```jsx
const colorMap = {};
activeMetrics.forEach((v, i) => { 
  colorMap[v.attributeCode] = CHART_COLORS[i % CHART_COLORS.length]; 
});
```

---

## 9. Event Detection Integration

### Events Table Columns
- `eventLogId`: Unique event detection record
- `eventId`: Event type reference
- `eventCode`: Machine-readable event identifier
- `eventDescription`: Human-readable message
- `risk`: Risk level (HIGH, MEDIUM, LOW)
- `cumulativeScore`: Detection score (0-100)
- `probability`: Confidence percentage
- `triggeredAt`: Detection timestamp
- `analysisWindowInMin`: Lookback window (e.g., 5 min)
- `processingTimeMs`: Query execution time

### Event Details Modal
Shows attribute contributions to event detection:
- Attribute name, code, current value
- Score contribution to event
- "In Range" status (Y/N)
- Scoring ranges (min/max values for each score tier)

---

## 10. Data Flow Example: Complete Journey

### Scenario: User views RPM chart for entity "Shula" (last 2 hours)

```
1. Page Load (EntityTelemetryRNPage)
   └─ loadEntities() → fetch /entities
   └─ User selects "Shula"
   └─ useEffect triggered → loadData()

2. Load Latest Values
   └─ fetch /api/telemetry/latest/Shula
   └─ SQL: SELECT LatestPerAttribute WHERE entityId='Shula' AND rn=1
   └─ Returns: [...{ attributeCode: "propulsion.main.revolutions", numericValue: 1500, attributeUnit: "rpm", defaultInGraph: "Y" }...]
   └─ React state: setLatestValues(latest)
   └─ Auto-select: selectedMetrics['propulsion.main.revolutions'] = true

3. Load Telemetry Range
   └─ startDate = now - 2 hours = "2026-03-17T12:30:00Z"
   └─ endDate = now = "2026-03-17T14:30:00Z"
   └─ fetch /api/telemetry/range/Shula?startDate=...&endDate=...
   └─ SQL: SELECT ET, ETA WHERE entityId='Shula' AND endTimestampUTC BETWEEN ? AND ?
   └─ Returns: [...{ endTimestampUTC: "2026-03-17T12:31:00", propulsion.main.revolutions: 1200, propulsion.main.temperature: 355.15, ... }...]
   └─ React state: setTelemetryData(tel)

4. Build Chart Data
   └─ chartData = telemetryData.map(rec => {
       ts: Date(rec.endTimestampUTC),
       "propulsion.main.revolutions": convertValue(1200, "propulsion.main.revolutions", "rpm") → 1200 rpm
      })
   └─ Result: [{ ts: 1710683400000, "propulsion.main.revolutions": 1200 }, ...]

5. Render Chart
   └─ Recharts LineChart:
     - XAxis: timestamps (ms)
     - YAxis: numeric values
     - Line: "propulsion.main.revolutions" series (color: #ff7300)
     - Tooltip: shows all metrics at timestamp

6. Load Events
   └─ fetch /api/events/range/Shula?startDate=...&endDate=...
   └─ Returns: [...{ eventLogId: 12345, eventCode: "HIGH_RPM", risk: "HIGH", score: 85, ... }...]
   └─ React state: setEvents(ev)
   └─ Render: Events table with risk badges

7. User clicks event → fetchEventDetails(12345)
   └─ fetch /api/eventlog/12345/details
   └─ Returns: { ..., details: [{ attributeCode: "propulsion.main.revolutions", attributeName: "Engine RPM", numericValue: 2500, scoreContribution: 75, withinRange: "N" }...] }
   └─ setSelectedEventLog(data) → Modal opens showing attribute breakdown
```

---

## 11. File Cross-References

| Component | File | Purpose |
|-----------|------|---------|
| Mobile Wrapper | `vxt-mobile/src/screens/EntityTelemetryRN.tsx` | WebView + bridge |
| Web Dashboard | `admin-dashboard/src/pages/EntityTelemetryRNPage.jsx` | Main UI |
| Analytic Page (Alternative) | `admin-dashboard/src/pages/EntityTelemetryAnalyticsPage.jsx` | Older version |
| API Endpoints | `main.py` (lines 2535, 2658+) | FastAPI handlers |
| Unit Conversion | `admin-dashboard/src/utils/unitConversion.js` | K→°C, Pa→Bar, etc. |
| Styling | `admin-dashboard/src/styles/ManagementPage.css` | Grid/table/modal CSS |
| Schema | `schema-deployment-temp.sql` | EntityTelemetry table |
| Attributes | `db/sql/0178_Sync_EntityTypeAttribute_Local_to_Azure.sql` | Attribute metadata (RPM, TEMP, etc.) |
| Simulators | `simulate_signalk_vessel.py` | Generates sample data |

---

## 12. Quick Reference: Key Attribute Codes

```
Propulsion:
  propulsion.main.revolutions           → Engine RPM (rpm)
  propulsion.main.temperature           → ENG TEMP (K→°C)
  propulsion.main.oilPressure           → Oil Pressure (Pa→Bar)
  propulsion.main.oilTemperature        → Oil Temp (K→°C)
  propulsion.main.runTime               → Engine Hours (s)

Tanks:
  tanks.wasteWaterTank.level            → Waste Water (%)
  tanks.freshWaterTank.level            → Fresh Water (%)
  tanks.fuelTank.level                  → Fuel Level (%)

Environment:
  environment.outside.temperature       → Air Temp (K→°C)
  environment.water.temperature         → Water Temp (K→°C)
  environment.outside.pressure          → Barometric (Pa→Bar)

Navigation:
  navigation.speedOverGround            → SOG (m/s→kn)
  navigation.depth.belowTransducer      → Depth (m)
  navigation.heading                    → Heading (°)
```

