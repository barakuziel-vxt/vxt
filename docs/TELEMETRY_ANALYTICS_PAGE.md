# Entity Telemetry & Events Analytics Page

## Overview
A new comprehensive analytics page has been added to the admin dashboard that provides real-time monitoring of entity telemetry data and detected events. This page enables users to analyze health vitals, sensor data, and system-detected anomalies with interactive visualizations and detailed event logs.

## Features

### 1. Entity & Date Range Filters
- **Entity Selection**: Dropdown to select any active entity in the system
- **Date Range Selection**: 
  - Start Date: Customizable datetime picker
  - End Date: Customizable datetime picker
  - Default: Last 1 hour of data
  - Refresh button to reload data

### 2. Latest Values Section
Displays the most recent telemetry value for each attribute/metric:
- **Format**: Grid of cards showing:
  - Attribute name
  - Latest numeric value
  - Unit of measurement (HR bpm, BP mmHg, Temperature °C, etc.)
  - Timestamp of the reading

Example cards:
```
┌─ Heart Rate ─────────┐
│                       │
│       72 bpm          │
│                       │
│ 2026-02-14 18:30:00   │
└───────────────────────┘
```

### 3. Telemetry Metrics Line Chart
Interactive multi-line chart showing all telemetry attributes over the selected time period:
- **X-Axis**: Time (hourly granularity, expandable)
- **Y-Axis**: Metric values
- **Features**:
  - Multiple color-coded lines (one per metric)
  - Hover tooltips showing exact values and timestamps
  - Responsive sizing
  - Automatic legend based on available metrics
  - Zoom and pan capabilities (via Recharts)

### 4. Detected Events Table
Complete log of all detected anomalies/events in the date range, ordered by risk level and timestamp:

| Column | Description |
|--------|-------------|
| Event ID | Unique event log ID |
| Event Name | Event code/name |
| Risk Level | Color-coded badge (HIGH=Red, MEDIUM=Yellow, LOW=Green) |
| Score | Cumulative anomaly score |
| Probability | Probability percentage of the event |
| Triggered At | Date/time when event was detected |
| Details | Number of attribute details contributing to the event |

## API Endpoints

### 1. Latest Telemetry
```
GET /api/telemetry/latest/{entity_id}
```
**Response:**
```json
[
  {
    "entityTypeAttributeId": 1,
    "attributeCode": "HR",
    "attributeName": "Heart Rate",
    "attributeUnit": "bpm",
    "numericValue": 72,
    "stringValue": null,
    "endTimestampUTC": "2026-02-14T18:30:00"
  },
  ...
]
```

### 2. Telemetry Range
```
GET /api/telemetry/range/{entity_id}?startDate={ISO8601}&endDate={ISO8601}
```
**Response:**
```json
[
  {
    "endTimestampUTC": "2026-02-14T17:30:00",
    "HR": 68,
    "BP_Systolic": 120,
    "SpO2": 95,
    ...
  },
  ...
]
```
Charts use this data with attributes as Y series and timestamps as X axis.

### 3. Events Range
```
GET /api/events/range/{entity_id}?startDate={ISO8601}&endDate={ISO8601}
```
**Response:**
```json
[
  {
    "eventLogId": 49,
    "eventId": 7,
    "eventName": "NEWSAggregateHigh",
    "eventDescription": "Aggregate News score indicates high risk",
    "risk": "HIGH",
    "cumulativeScore": 41,
    "probability": 0.85,
    "triggeredAt": "2026-02-14T18:28:55",
    "detailCount": 5
  },
  ...
]
```

## Installation & Setup

### 1. Install Dashboard Dependencies
```bash
cd admin-dashboard
npm install
```

This will install the required Recharts charting library along with other dependencies.

### 2. Run the Dashboard
```bash
cd admin-dashboard
npm run dev
```

The dashboard will be available at `http://localhost:3001`

### 3. Verify API Endpoints
Run the test script to verify all endpoints are working:
```bash
cd C:\VXT
C:\VXT\.venv\Scripts\python.exe test_analytics_endpoints.py
```

## Data Sources

### EntityTelemetry Table Structure
The page queries from:
- `dbo.EntityTelemetry`: Latest readings for each entity/attribute
- `dbo.EntityTypeAttribute`: Attribute metadata (names, units, codes)

### EventLog & EventLogDetails Tables
- `dbo.EventLog`: Event detection records with scores and timing
- `dbo.Event`: Event definitions with risk levels
- `dbo.EventLogDetails`: Individual attribute contributions to events

## UI/UX Features

### Responsive Design
- **Desktop**: Full 3-column layout with large charts
- **Tablet**: Stacked sections with adjusted grid
- **Mobile**: Single column with responsive charts

### Color Coding
- **Risk Levels**:
  - 🔴 HIGH: Red (#ff4444)
  - 🟠 MEDIUM: Orange (#ff9900)
  - 🟡 LOW: Yellow (#ffdd00)

### Loading States
- Disabled controls during data fetch
- "Loading..." indicator on refresh button
- Graceful error messages

### Empty States
- "No latest values available" - when entity has no recent telemetry
- "No telemetry data available" - when date range has no data
- "No events detected" - when no anomalies in date range

## Example Workflows

### Monitor Patient Vitals
1. Select entity (patient ID)
2. View latest heart rate, blood pressure, oxygen saturation
3. Examine trends over past 24 hours
4. Review detected anomalies (NEWS scores, cardiac alerts, etc.)

### Investigate Event
1. Select entity
2. Navigate to Events section
3. Find event by risk level or timestamp
4. Check "Details" count to see which vitals triggered it
5. Correlate with telemetry chart to see values at time of event

### Analyze Trends
1. Select entity
2. Set custom date range (e.g., 7 days)
3. Observe metric patterns in line chart
4. Note events and correlation with metric changes

## Performance Notes

### Data Limits
- Latest telemetry: Returns all attributes (typically 5-25 records)
- Telemetry range: Depends on collection frequency (typically 100-1000s of records per day)
- Events range: Typically 1-100 events per day per entity

### Optimization Tips
- For longer date ranges (>7 days), data points on chart may need aggregation
- Consider implementing data sampling for very large date ranges

## Future Enhancements

- [ ] Event detail modal showing contributing attributes
- [ ] Comparison mode (multiple entities side by side)
- [ ] Custom metric selection for chart
- [ ] Threshold lines on chart
- [ ] Export/download data as CSV
- [ ] Event filtering by type/risk
- [ ] Real-time updates via WebSocket
- [ ] Baseline comparison (current vs historical)

## Troubleshooting

### Chart not displaying
- Verify entity has telemetry data in date range
- Check browser console for API errors
- Ensure recharts library is installed: `npm list recharts`

### No events appearing
- Events are only logged when detected by subscription analysis worker
- Verify worker is running: `Get-Process python | Where-Object {$_.CommandLine -like "*subscription_analysis_worker*"}`
- Check `EventLog` table has records: `SELECT COUNT(*) FROM dbo.EventLog`

### API 404 errors
- Verify FastAPI is running on port 8000
- Check CORS configuration includes `http://localhost:3001`
- Try accessing endpoint directly: `http://localhost:8000/telemetry/latest/033114870`

### Slow loading
- Check database connection performance
- Reduce date range
- Check if multiple browsers are open with the dashboard
