# EntityTelemetry: Data Flow & Code Integration Guide

## Part 1: Component Hierarchy & Module Relationships

```
Application Layer
├─ Mobile (React Native)
│  └─ EntityTelemetryRN.tsx (Screen wrapper)
│     └─ WebView (loads web dashboard)
│        └─ EntityTelemetryRNPage.jsx (Web admin page)
│
├─ Web Admin
│  └─ EntityTelemetryRNPage.jsx (Main dashboard)
│     ├─ EntityTelemetryAnalyticsPage.jsx (Alternative analytics view)
│     └─ UI Components:
│        ├─ Entity selector
│        ├─ Date range filters
│        ├─ Metric toggle tiles
│        ├─ LineChart (Recharts)
│        ├─ Events table
│        └─ Event details modal
│
├─ Utilities
│  ├─ unitConversion.js (K→°C, Pa→Bar conversions)
│  ├─ bridge.js (Mobile WebView bridge)
│  └─ LocationMap.jsx (GPS visualization)
│
└─ API Layer
   └─ FastAPI (main.py)
      ├─ GET /api/telemetry/latest/{entity_id}
      ├─ GET /api/telemetry/range/{entity_id}
      ├─ GET /api/events/range/{entity_id}
      ├─ GET /api/eventlog/{id}/details
      └─ GET /api/entity-attributes/{code}/scores
         │
         └─ Database Layer
            ├─ EntityTelemetry (telemetry readings)
            ├─ EntityTypeAttribute (attribute metadata)
            ├─ EventLog (anomalies)
            └─ EventLogDetails (attribute contributions)
```

---

## Part 2: Bridge Communication (Mobile ↔ Web)

### How It Works: WebView Bridge Pattern

**Mobile**: React Native app creates WebView
```tsx
// EntityTelemetryRN.tsx
const webViewUrl = `file:///android_asset/www/index.html?embedded=true&mode=driver
  &dsType=${ds.type}
  &activeDriver=${encodeURIComponent(activeDriver)}
  &cloudUrl=${encodeURIComponent(ds.cloudUrl)}
  &localUrl=${encodeURIComponent(ds.localUrl)}
  #telemetryRN`;

<WebView
  ref={webViewRef}
  source={{ uri: webViewUrl }}
  onMessage={handleBridgeMessage}
/>
```

**Web Page**: Detects it's embedded and uses bridge
```jsx
// EntityTelemetryRNPage.jsx
const IS_EMBEDDED = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('embedded') === 'true';
  } catch { return false; }
})();

const IS_DRIVER_MODE = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'driver';
  } catch { return false; }
})();

// Bridge alias for readability
const driverRequest = bridgeRequest;  // From utils/bridge.js

// Use bridge instead of HTTP fetch
if (IS_EMBEDDED) {
  const [latest, tel, ev] = await Promise.all([
    driverRequest('loadLatest', { entityId: String(selectedEntity) }),
    driverRequest('loadRange',  { entityId: String(selectedEntity), startDate: start, endDate: end }),
    driverRequest('loadEvents', { entityId: String(selectedEntity), startDate: start, endDate: end }),
  ]);
}
```

**Bridge Implementation**: bidirectional postMessage
```js
// bridge.js
export async function bridgeRequest(type, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36);
    
    window.__driverBridgeCallbacks = window.__driverBridgeCallbacks || {};
    window.__driverBridgeCallbacks[id] = (response) => {
      resolve(response);
    };
    
    // Send to React Native layer via postMessage
    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type,
      params,
      id
    }));
    
    // Timeout after 5 seconds
    setTimeout(() => {
      reject(new Error(`Bridge timeout: ${type}`));
    }, 5000);
  });
}

// Global callback receiver
window.__driverBridgeCallback = (msg) => {
  const { id, data } = JSON.parse(msg);
  if (window.__driverBridgeCallbacks?.[id]) {
    window.__driverBridgeCallbacks[id](data);
    delete window.__driverBridgeCallbacks[id];
  }
};
```

**Mobile Handler**: Intercepts bridge messages and proxies to driver
```tsx
// EntityTelemetryRN.tsx
async function handleBridgeMessage(event: WebViewMessageEvent) {
  const msg = JSON.parse(event.nativeEvent.data);
  let responseData;
  
  try {
    const { entityId = '', startDate = '', endDate = '', eventLogId = '', attributeCode = '' } = msg.params || {};
    
    switch (msg.type) {
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
        // Get current snapshot from driver
        const snapshot = await driver?.getLatest();
        // Convert SnapshotMap → /api/telemetry/latest format
        responseData = snapshot ? snapshotToLatest(snapshot) : [];
        break;
      }
      
      case 'loadRange': {
        // Get historical data from driver
        const startMs = msg.params?.startDate
          ? new Date(msg.params.startDate).getTime()
          : Date.now() - 3_600_000;
        const endMs = msg.params?.endDate
          ? new Date(msg.params.endDate).getTime()
          : Date.now();
        
        const history = await driver?.getHistory(startMs, endMs);
        // Convert HistoryMap → /api/telemetry/range format
        responseData = historyToTelemetry(history);
        break;
      }
      
      case 'loadEvents': {
        responseData = [];  // No events from driver
        break;
      }
      
      default: responseData = null;
    }
  } catch (e) {
    console.warn('[EntityTelemetryRN] Bridge error:', msg.type, e);
    responseData = null;
  }
  
  // Send response back to WebView
  const response = JSON.stringify({ id: msg.id, data: responseData });
  webViewRef.current?.injectJavaScript(
    `window.__driverBridgeCallback(${response}); true;`,
  );
}
```

---

## Part 3: Data Conversion Functions

### Convert Driver Snapshot → Latest Telemetry Format

```tsx
function snapshotToLatest(snapshot: SnapshotMap): Array<Record<string, unknown>> {
  const result = [];
  
  // Iterate all keys in snapshot (e.g., 'engine.RPM', 'navigation.depth')
  Object.entries(snapshot).forEach(([key, value]) => {
    if (value !== null && value !== undefined && typeof value === 'number') {
      result.push({
        entityTypeAttributeId: 0,  // Placeholder (mobile driver doesn't have DB IDs)
        attributeCode: key,
        attributeName: key,        // Could beautify this
        attributeUnit: getUnit(key),  // Look up default unit
        defaultInGraph: isDefaultMetric(key) ? 'Y' : 'N',
        numericValue: value,
        stringValue: null,
        endTimestampUTC: new Date().toISOString()
      });
    }
  });
  
  return result;
}
```

**Maps**:
- Driver snapshot keys: `'engine.RPM'`, `'tanks.water.level'`, `'navigation.depth'`
- To API format: `'propulsion.main.revolutions'`, `'tanks.wasteWaterTank.level'`, `'environment.depth.belowTransducer'`

### Convert Driver History → Telemetry Range Format

```tsx
function historyToTelemetry(history: HistoryMap): Array<Record<string, unknown>> {
  const result = [];
  
  // HistoryMap structure: { timestamp: { key: value, ... }, ... }
  Object.entries(history).forEach(([timestampStr, metrics]) => {
    const point = {
      endTimestampUTC: new Date(parseInt(timestampStr)).toISOString(),
      latitude: metrics.latitude || null,
      longitude: metrics.longitude || null
    };
    
    // Flatten all metrics into the point object
    Object.entries(metrics).forEach(([key, value]) => {
      if (key !== 'latitude' && key !== 'longitude' && typeof value === 'number') {
        point[key] = value;  // Key as attribute code
      }
    });
    
    result.push(point);
  });
  
  return result.sort((a, b) => 
    new Date(a.endTimestampUTC).getTime() - new Date(b.endTimestampUTC).getTime()
  );
}
```

---

## Part 4: Admin Mode HTTP Flow

### Fallback to HTTP when bridge unavailable

```jsx
// EntityTelemetryRNPage.jsx
async function loadData() {
  if (!selectedEntity) return;
  
  try {
    setLoading(true);
    const start = new Date(startDate).toISOString();
    const end = new Date(endDate).toISOString();
    
    if (IS_EMBEDDED) {
      // EMBEDDED MODE: Use bridge
      const [latest, tel, ev] = await Promise.all([
        driverRequest('loadLatest', { entityId: String(selectedEntity) }),
        driverRequest('loadRange', { entityId: String(selectedEntity), startDate: start, endDate: end }),
        driverRequest('loadEvents', { entityId: String(selectedEntity), startDate: start, endDate: end }),
      ]);
      setLatestValues(latest || []);
      setTelemetryData(tel || []);
      setEvents(ev || []);
    } else {
      // ADMIN MODE: Direct HTTP calls
      const [latestRes, telRes, evRes] = await Promise.all([
        fetch(`${BASE}/api/telemetry/latest/${selectedEntity}`),
        fetch(`${BASE}/api/telemetry/range/${selectedEntity}?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`),
        fetch(`${BASE}/api/events/range/${selectedEntity}?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`),
      ]);
      
      if (latestRes.ok) {
        const latest = await latestRes.json();
        console.log('[EntityTelemetryRNPage] Latest values:', latest.length, 'metrics');
        setLatestValues(latest);
      }
      
      if (telRes.ok) {
        const tel = await telRes.json();
        console.log('[EntityTelemetryRNPage] Telemetry:', tel.length, 'records');
        setTelemetryData(tel);
      }
      
      if (evRes.ok) {
        const ev = await evRes.json();
        console.log('[EntityTelemetryRNPage] Events:', ev.length);
        setEvents(ev);
      }
    }
  } catch (e) {
    setError('Failed to load data: ' + e.message);
  } finally {
    setLoading(false);
  }
}
```

---

## Part 5: Unit Conversion Pipeline

### Frontend Conversion (Recharts Chart Data)

```jsx
// EntityTelemetryRNPage.jsx - Prepare chart data with conversions

const chartData = telemetryData
  .map(rec => {
    const tsStr = rec.endTimestampUTC ?? rec.timestamp ?? '';
    const ts = new Date(tsStr.endsWith('Z') ? tsStr : tsStr + 'Z').getTime();
    const point = { ts };
    
    // activeMetrics = [{attributeCode: "propulsion.main.revolutions", attributeUnit: "rpm"}, ...]
    activeMetrics.forEach(v => {
      const val = rec[v.attributeCode];
      if (typeof val === 'number') {
        // ✓ Apply conversion: K→°C, Pa→Bar, etc.
        point[v.attributeCode] = convertValue(val, v.attributeCode, v.attributeUnit);
      }
    });
    
    return point;
  })
  .filter(p => !isNaN(p.ts))
  .sort((a, b) => a.ts - b.ts);

// Result example:
// [{ts: 1710683400000, "propulsion.main.revolutions": 1500, "propulsion.main.temperature": 85}, ...]
```

### Conversion Function (unitConversion.js)

```js
export function convertValue(value, attributeCode, sourceUnit) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'number') return value;
  
  // Look up source unit (what's in database)
  const actualSourceUnit = sourceUnit || SOURCE_UNIT_ASSUMPTIONS[attributeCode] || '';
  
  // Look up target display unit
  const targetUnit = DISPLAY_UNIT_PREFERENCES[attributeCode] || actualSourceUnit;
  
  if (actualSourceUnit === targetUnit) return value;
  
  // Find conversion function in conversion map
  const conversionKey = `${actualSourceUnit}→${targetUnit}`;
  if (CONVERSIONS[conversionKey]) {
    return CONVERSIONS[conversionKey](value);
  }
  
  return value;  // No conversion found
}

// Example conversions map:
const CONVERSIONS = {
  'K→°C': (k) => k - 273.15,
  '°C→K': (c) => c + 273.15,
  'Pa→Bar': (pa) => pa / 100000,
  'Bar→Pa': (bar) => bar * 100000,
  'rad→°': (rad) => (rad * 180) / Math.PI,
  '°→rad': (deg) => (deg * Math.PI) / 180,
  'm/s→kn': (ms) => ms * 1.94384,
  'kn→m/s': (kn) => kn / 1.94384,
};
```

---

## Part 6: Chart Rendering with Recharts

```jsx
// EntityTelemetryRNPage.jsx - Main chart render

const colorMap = {};
activeMetrics.forEach((v, i) => {
  colorMap[v.attributeCode] = CHART_COLORS[i % CHART_COLORS.length];
});

return (
  <ResponsiveContainer width="100%" height={IS_EMBEDDED ? 240 : 320}>
    <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
      
      <XAxis
        dataKey="ts"
        type="number"
        domain={['dataMin', 'dataMax']}
        tickFormatter={(ms) => new Date(ms).toLocaleTimeString()}
      />
      
      <YAxis />
      
      <Tooltip
        formatter={(value, name) => [value.toFixed(2), name]}
        labelFormatter={(ms) => new Date(ms).toLocaleString()}
        contentStyle={TOOLTIP_STYLE}
      />
      
      <Legend />
      
      {/* Render a line for each selected metric */}
      {activeMetrics.map(v => (
        <Line
          key={v.attributeCode}
          dataKey={v.attributeCode}
          name={v.attributeName}
          stroke={colorMap[v.attributeCode]}
          dot={false}
          strokeWidth={2}
          connectNulls
        />
      ))}
    </LineChart>
  </ResponsiveContainer>
);
```

---

## Part 7: Event Details Modal

### Open Event Details
```jsx
// EntityTelemetryRNPage.jsx
const handleEventClick = (event) => {
  setSelectedEventLog(event);
  fetchEventDetails(event.eventLogId);
};

async function fetchEventDetails(eventLogId) {
  try {
    setEventDetailsLoading(true);
    let data;
    
    if (IS_EMBEDDED) {
      data = await driverRequest('loadEventDetails', { eventLogId: String(eventLogId) });
    } else {
      const res = await fetch(`${BASE}/api/eventlog/${eventLogId}/details`);
      data = await res.json();
    }
    
    setSelectedEventLog(data);
  } finally {
    setEventDetailsLoading(false);
  }
}
```

### Render Event Details Modal
```jsx
{selectedEventLog && (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
    <div style={{ backgroundColor: '#2d2d2d', padding: '30px', maxWidth: '800px' }}>
      
      {/* Event Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div><strong>Event Code:</strong> {selectedEventLog.eventCode}</div>
        <div><strong>Risk Level:</strong> <span style={{ backgroundColor: getRiskColor(selectedEventLog.risk) }}>
          {selectedEventLog.risk}
        </span></div>
        <div><strong>Score:</strong> {selectedEventLog.cumulativeScore}</div>
        <div><strong>Probability:</strong> {(selectedEventLog.probability * 100).toFixed(1)}%</div>
      </div>
      
      {/* Attribute Details Table */}
      {selectedEventLog.details && (
        <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#3a3a3a' }}>
            <tr>
              <th style={{ padding: '10px', textAlign: 'left' }}>Attribute</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Code</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Value</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>Score Contribution</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>In Range</th>
            </tr>
          </thead>
          <tbody>
            {selectedEventLog.details.map((detail, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #444' }}>
                <td style={{ padding: '10px' }}>{detail.attributeName}</td>
                <td style={{ padding: '10px', fontSize: '12px', color: '#8b949e' }}>{detail.attributeCode}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {detail.numericValue?.toFixed(2)} {detail.attributeUnit}
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <span style={{ fontWeight: 'bold' }}>{detail.scoreContribution}</span>
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <span style={{
                    backgroundColor: detail.withinRange === 'Y' ? '#1a3a1a' : '#3a1a1a',
                    padding: '3px 8px',
                    borderRadius: '3px'
                  }}>
                    {detail.withinRange === 'Y' ? '✓ Yes' : '✗ No'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
)}
```

---

## Part 8: Attribute Selection & Filtering

### Metric Selection Tiles
```jsx
{latestValues.map(attr => (
  <div
    key={attr.entityTypeAttributeId}
    onClick={() => toggleMetric(attr.attributeCode)}
    style={{
      padding: '10px 15px',
      backgroundColor: selectedMetrics[attr.attributeCode] ? '#3fb950' : '#30363d',
      border: '1px solid #444',
      borderRadius: '4px',
      cursor: 'pointer',
      color: selectedMetrics[attr.attributeCode] ? '#000' : '#e6edf3'
    }}
  >
    {attr.attributeName}
  </div>
))}
```

### Toggle Metric Logic
```jsx
function toggleMetric(code) {
  setSelectedMetrics(prev => ({
    ...prev,
    [code]: !prev[code]
  }));
}

// Get active metrics for chart
const activeMetrics = latestValues.filter(
  v => selectedMetrics[v.attributeCode]
);
```

---

## Part 9: Export to PDF

```jsx
const exportToPDF = async () => {
  try {
    // Clone content
    const element = document.getElementById('telemetry-rn-content');
    const clonedElement = element.cloneNode(true);
    
    // Remove filter section
    const filterSection = clonedElement.querySelector('.filter-section');
    if (filterSection) filterSection.remove();
    
    // Prepare for rendering
    clonedElement.style.position = 'absolute';
    clonedElement.style.left = '-9999px';
    clonedElement.style.backgroundColor = '#ffffff';
    clonedElement.style.color = '#000000';
    document.body.appendChild(clonedElement);
    
    // Convert to canvas
    const canvas = await html2canvas(clonedElement, {
      backgroundColor: '#ffffff'
    });
    
    // Generate PDF
    const imgWidth = 210;  // A4 width in mm
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Add header
    pdf.setFillColor(240, 240, 240);
    pdf.rect(0, 0, 210, 25, 'F');
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Telemetry Report - ${entityName}`, 10, 12);
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, 18);
    
    // Add content
    let yPosition = 28;
    let heightLeft = imgHeight;
    while (heightLeft > 0) {
      pdf.addImage(canvas.toDataURL(), 'PNG', 0, yPosition, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      yPosition += pageHeight;
    }
    
    // Save
    pdf.save(`telemetry-${entityName}-${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Cleanup
    document.body.removeChild(clonedElement);
  } catch (e) {
    setError('PDF export failed: ' + e.message);
  }
};
```

---

## Part 10: Error Handling & Debugging

### Console Logging Strategy
```js
console.log('[EntityTelemetryRNPage] Latest values:', latest.length, 'metrics -', 
  latest.slice(0,3).map(v => ({ 
    code: v.attributeCode, 
    numericValue: v.numericValue, 
    unit: v.attributeUnit 
  }))
);

console.log('[EntityTelemetryRNPage] Telemetry:', tel.length, 'records');

console.log('[EntityTelemetryRNPage] Events:', ev.length);
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "No data found" | Entity has no telemetry | Check data source; verify entity exists |
| Chart appears empty | No metrics selected | Ensure attributes have `defaultInGraph='Y'` |
| Bridge timeout | Mobile driver slow | Increase timeout; check driver health |
| Unit display incorrect | Wrong conversion applied | Check SOURCE_UNIT_ASSUMPTIONS & DISPLAY_UNIT_PREFERENCES |
| Events not showing | EventLog table empty | Check event detection criteria |

