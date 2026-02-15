import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import '../styles/ManagementPage.css';

export default function EntityTelemetryAnalyticsPage() {
  // State for entity selection
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  
  // State for date range (initialize with empty strings for controlled inputs)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // State for data
  const [latestValues, setLatestValues] = useState([]);
  const [telemetryData, setTelemetryData] = useState([]);
  const [decimatedTelemetryData, setDecimatedTelemetryData] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for event details modal
  const [selectedEventLog, setSelectedEventLog] = useState(null);
  const [eventDetailsLoading, setEventDetailsLoading] = useState(false);
  
  // State for score contribution details popup
  const [selectedScoreDetail, setSelectedScoreDetail] = useState(null);
  const [scoreDetailsLoading, setScoreDetailsLoading] = useState(false);

  // Initialize default date range (2 hours ago to now - balanced for performance and data)
  useEffect(() => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    // Convert to local time string for datetime-local input
    const toLocalISOString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    const endDateStr = toLocalISOString(now);
    const startDateStr = toLocalISOString(twoHoursAgo);
    
    setEndDate(endDateStr);
    setStartDate(startDateStr);
    
    loadEntities();
  }, []);

  // Load entities on mount
  const loadEntities = async () => {
    try {
      setLoading(true);
      console.log('Fetching entities from /entities...');
      const response = await fetch('/entities', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      console.log(`Entities response status: ${response.status}`);
      
      if (!response.ok) {
        const errText = await response.text();
        console.error('Error response:', errText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Entities loaded successfully: ${data.length} entities`);
      setEntities(data);
      setError(null);
      if (data.length > 0) {
        setSelectedEntity(data[0].entityId);
      }
    } catch (err) {
      console.error('Error loading entities:', err);
      setError('Failed to load entities: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Load data when entity or date range changes
  useEffect(() => {
    if (selectedEntity && startDate && endDate) {
      loadAnalyticsData();
    }
  }, [selectedEntity, startDate, endDate]);

  // Convert local datetime string to UTC ISO format
  const convertLocalToUTC = (localDateTimeStr) => {
    try {
      // Parse the datetime-local format (e.g., "2026-02-15T14:48")
      const localDate = new Date(localDateTimeStr);
      
      // Get the UTC ISO string
      return localDate.toISOString();
    } catch (err) {
      console.error('Error converting to UTC:', err);
      return localDateTimeStr;
    }
  };

  const formatDate = (dateString) => {
    try {
      // Database returns timestamps without timezone indicator
      // Since they're stored as UTC in the database column named endTimestampUTC,
      // we explicitly add 'Z' to ensure JavaScript parses them as UTC
      const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
      const date = new Date(utcString);
      
      // Verify the date is valid before formatting
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      // toLocaleString() automatically converts UTC to browser's local timezone
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Format ISO datetime range string (e.g., "2026-02-14T23:01:55.827783+00:00 to 2026-02-15T23:01:56.880744+00:00")
  // Returns local time format without UTC suffix
  const formatDateRange = (dateRangeString) => {
    try {
      if (!dateRangeString || !dateRangeString.includes(' to ')) {
        return dateRangeString;
      }
      
      const [startStr, endStr] = dateRangeString.split(' to ').map(s => s.trim());
      
      // Parse ISO datetime and remove UTC timezone indicator
      const parseDateTime = (isoString) => {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString;
        
        // Format: "Feb 14, 2026, 11:01:55 PM" (local time)
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      };
      
      const formattedStart = parseDateTime(startStr);
      const formattedEnd = parseDateTime(endStr);
      
      return `${formattedStart} to ${formattedEnd}`;
    } catch {
      return dateRangeString;
    }
  };

  // Calculate duration from dateRange and return formatted string (e.g., "24 hours", "30 minutes")
  const calculateDurationFromDateRange = (dateRangeString) => {
    try {
      if (!dateRangeString || !dateRangeString.includes(' to ')) {
        return null;
      }
      
      const [startStr, endStr] = dateRangeString.split(' to ').map(s => s.trim());
      const startDate = new Date(startStr);
      const endDate = new Date(endStr);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return null;
      }
      
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffMinutes = Math.round(diffMs / 60000);
      const diffHours = Math.round(diffMinutes / 60);
      
      if (diffHours >= 1) {
        return diffHours === 1 ? '1 hour' : `${diffHours} hours`;
      } else {
        return diffMinutes === 1 ? '1 minute' : `${diffMinutes} minutes`;
      }
    } catch {
      return null;
    }
  };

  // Format timestamp to show only time portion (e.g., "11:30 PM")
  const formatTimeOnly = (dateString) => {
    try {
      const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
      const date = new Date(utcString);
      
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      return date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Convert local times to UTC ISO format for API calls
      const startDateUTC = convertLocalToUTC(startDate);
      const endDateUTC = convertLocalToUTC(endDate);
      
      console.log(`Loading data for entity ${selectedEntity}`);
      console.log(`Local time range: ${startDate} to ${endDate}`);
      console.log(`UTC time range: ${startDateUTC} to ${endDateUTC}`);

      // Load latest values
      const latestRes = await fetch(
        `/api/telemetry/latest/${selectedEntity}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (!latestRes.ok) {
        console.error(`Failed to load latest values: ${latestRes.status}`);
      } else {
        const latest = await latestRes.json();
        console.log(`Latest values loaded: ${latest.length} metrics`);
        setLatestValues(latest);
      }

      // Load telemetry data for chart
      const telemetryUrl = `/api/telemetry/range/${selectedEntity}?startDate=${encodeURIComponent(startDateUTC)}&endDate=${encodeURIComponent(endDateUTC)}`;
      console.log(`Fetching telemetry from: ${telemetryUrl}`);
      const telemetryRes = await fetch(telemetryUrl, { headers: { 'Content-Type': 'application/json' } });
      if (!telemetryRes.ok) {
        console.error(`Failed to load telemetry: ${telemetryRes.status} ${telemetryRes.statusText}`);
      } else {
        const telemetry = await telemetryRes.json();
        console.log(`Telemetry loaded: ${telemetry.length} records`);
        // Log sample data to debug timezone
        if (telemetry.length > 0) {
          console.log('Sample telemetry record:', telemetry[0]);
          console.log('Sample timestamp:', telemetry[0].endTimestampUTC);
          console.log('Formatted with formatDate():', formatDate(telemetry[0].endTimestampUTC));
        }
        setTelemetryData(telemetry);
      }

      // Load events
      const eventsUrl = `/api/events/range/${selectedEntity}?startDate=${encodeURIComponent(startDateUTC)}&endDate=${encodeURIComponent(endDateUTC)}`;
      console.log(`Fetching events from: ${eventsUrl}`);
      const eventsRes = await fetch(eventsUrl, { headers: { 'Content-Type': 'application/json' } });
      if (!eventsRes.ok) {
        console.error(`Failed to load events: ${eventsRes.status} ${eventsRes.statusText}`);
      } else {
        const eventsData = await eventsRes.json();
        console.log(`Events loaded: ${eventsData.length} events`);
        setEvents(eventsData);
      }
    } catch (err) {
      console.error('Error loading analytics data:', err);
      setError('Failed to load analytics data: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const getMetricsFromTelemetry = () => {
    if (telemetryData.length === 0) return [];
    
    const attributeCodes = new Set();
    telemetryData.forEach(record => {
      // The telemetry data has attribute codes as keys (e.g., "2339-0", "59408-5")
      // and "endTimestampUTC" as the timestamp key
      Object.keys(record).forEach(key => {
        if (key !== 'endTimestampUTC' && key !== 'attributeCode') {
          attributeCodes.add(key);
        }
      });
    });
    
    return Array.from(attributeCodes).sort();
  };

  // Decimate data for better performance with large datasets
  // Keeps max ~300 points visible while preserving data trends
  const decimateData = (data, maxPoints = 300) => {
    if (data.length <= maxPoints) {
      return data; // No decimation needed
    }
    
    const step = Math.ceil(data.length / maxPoints);
    const decimated = [];
    
    // Always include first and last points
    decimated.push(data[0]);
    
    for (let i = step; i < data.length - 1; i += step) {
      decimated.push(data[i]);
    }
    
    decimated.push(data[data.length - 1]);
    
    return decimated;
  };

  // When telemetry data changes, decimate it
  useEffect(() => {
    if (telemetryData.length > 0) {
      const decimated = decimateData(telemetryData);
      setDecimatedTelemetryData(decimated);
      console.log(`Telemetry data decimated: ${telemetryData.length} points → ${decimated.length} points for display`);
    }
  }, [telemetryData]);

  // Get a human-readable name for an attribute code
  const getAttributeNameForCode = (code) => {
    const latest = latestValues.find(v => v.attributeCode === code);
    if (latest) {
      return latest.attributeName;
    }
    return code; // Fallback to code if name not found
  };

  // Custom tooltip for telemetry metrics chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0];
      const attributeCode = dataPoint.dataKey;
      const attributeName = getAttributeNameForCode(attributeCode);
      const value = Number(dataPoint.value);
      
      return (
        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
          border: '1px solid #ccc', 
          borderRadius: '4px', 
          padding: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <p style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 'bold' }}>
            {formatDate(label)}
          </p>
          <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '500', color: dataPoint.color }}>
            {attributeName}
          </p>
          <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
            <span style={{ fontStyle: 'italic' }}>{attributeCode}</span>: <strong>{Number.isNaN(value) ? dataPoint.value : value.toFixed(2)}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  // Get all attribute names for legend
  const getMetricLabels = () => {
    return getMetricsFromTelemetry().map(code => ({
      code: code,
      name: getAttributeNameForCode(code)
    }));
  };

  const getRiskColor = (risk) => {
    if (!risk) return '#999';
    const riskUpper = risk.toUpperCase();
    if (riskUpper === 'HIGH') return '#ff4444';
    if (riskUpper === 'MEDIUM') return '#ff9900';
    if (riskUpper === 'LOW') return '#ffdd00';
    return '#999';
  };

  const getRiskLabel = (risk) => {
    if (!risk) return 'N/A';
    return risk.charAt(0).toUpperCase() + risk.slice(1).toLowerCase();
  };

  // Color palette for metrics - similar to health-dashboard
  const metricColorForIndex = (index) => {
    const palette = ['#ff7300', '#38a3b8', '#41b922', '#bb4c99', '#ff4d4d', '#8884d8'];
    return palette[index % palette.length];
  };

  // Fetch event details from API
  const fetchEventDetails = async (eventLogId) => {
    try {
      setEventDetailsLoading(true);
      const url = `/api/eventlog/${eventLogId}/details`;
      console.log(`Fetching event details from: ${url}`);
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`Response status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error response: ${errorText}`);
        throw new Error(`Failed to load event details: HTTP ${response.status}`);
      }
      const data = await response.json();
      console.log('Event details loaded:', data);
      setSelectedEventLog(data);
    } catch (err) {
      console.error('Error fetching event details:', err);
      setError('Failed to load event details: ' + (err.message || String(err)));
    } finally {
      setEventDetailsLoading(false);
    }
  };

  // Close event details modal
  const closeEventDetailsModal = () => {
    setSelectedEventLog(null);
  };

  // Fetch and display score details for an attribute
  const showScoreDetails = async (detail) => {
    try {
      setScoreDetailsLoading(true);
      const attributeCode = detail.attributeCode;
      
      const detailToShow = { ...detail };
      
      // Check if event has analysisMetadata (PYTHON/AI functions)
      if (selectedEventLog?.analysisMetadata) {
        // Parse analysisMetadata for PYTHON functions
        try {
          const metadata = typeof selectedEventLog.analysisMetadata === 'string' 
            ? JSON.parse(selectedEventLog.analysisMetadata) 
            : selectedEventLog.analysisMetadata;
          
          if (metadata && metadata.functionType === 'PYTHON') {
            // For AI functions: use analysisMetadata instead of predefined scores
            detailToShow.analysisMetadata = metadata;
            detailToShow.isPythonAnalysis = true;
            setSelectedScoreDetail(detailToShow);
            return;
          }
        } catch (e) {
          console.warn('Could not parse analysisMetadata:', e);
        }
      }
      
      // For TSQL/NEWS functions: fetch predefined scoring rules
      const response = await fetch(`http://localhost:8000/api/entity-attributes/${attributeCode}/scores`);
      if (!response.ok) {
        throw new Error(`Failed to load score details: HTTP ${response.status}`);
      }
      const scores = await response.json();
      
      detailToShow.scores = scores;
      detailToShow.isPythonAnalysis = false;
      setSelectedScoreDetail(detailToShow);
    } catch (err) {
      console.error('Error fetching score details:', err);
      setError('Failed to load score details: ' + (err.message || String(err)));
    } finally {
      setScoreDetailsLoading(false);
    }
  };

  // Close score details popup
  const closeScoreDetailsPopup = () => {
    setSelectedScoreDetail(null);
  };

  // Sort latest values by attribute name (ascending)
  const getSortedLatestValues = () => {
    return [...latestValues].sort((a, b) => {
      const nameA = (a.attributeName || a.attributeCode || '').toLowerCase();
      const nameB = (b.attributeName || b.attributeCode || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <h2>📊 Entity Telemetry & Events Analytics</h2>
        <p>Monitor real-time data and detected events for selected entities</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Filters Section */}
      <div className="filter-section">
        <div className="filter-group">
          <label>
            Entity:
            <select 
              value={selectedEntity || ''} 
              onChange={(e) => setSelectedEntity(e.target.value)}
              disabled={loading}
            >
              <option value="">-- Select Entity --</option>
              {entities.map(entity => (
                <option key={entity.entityId} value={entity.entityId}>
                  {entity.entityFirstName || entity.entityName} ({entity.entityId})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-group">
          <label>
            Start Date:
            <input 
              type="datetime-local" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              disabled={loading}
            />
          </label>
        </div>

        <div className="filter-group">
          <label>
            End Date:
            <input 
              type="datetime-local" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              disabled={loading}
            />
          </label>
        </div>

        <button 
          onClick={loadAnalyticsData}
          disabled={!selectedEntity || loading}
          className="btn-primary"
        >
          {loading ? '⌛ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Section 1: Latest Values */}
      <div className="analytics-section">
        <h3>📌 Latest Values</h3>
        {latestValues.length > 0 ? (
          <div className="metrics-display">
            {getSortedLatestValues().map((value, idx) => (
              <div key={idx} className="metric-card">
                <div className="metric-key">{value.attributeName || value.attributeCode}</div>
                <div 
                  className="metric-val"
                  style={{ 
                    color: metricColorForIndex(idx),
                    fontFamily: 'Inter, Arial, sans-serif',
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}
                >
                  {value.numericValue !== null ? value.numericValue.toFixed(1) : 'N/A'}
                  <span style={{ fontSize: '14px', marginLeft: '4px' }}>{value.attributeUnit}</span>
                </div>
                <div className="metric-timestamp">
                  {value.endTimestampUTC ? formatDate(value.endTimestampUTC) : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">No latest values available</p>
        )}
      </div>

      {/* Section 2: Telemetry Chart */}
      <div className="analytics-section">
        <h3>📈 Telemetry Metrics ({getMetricsFromTelemetry().length} metrics)</h3>
        {telemetryData.length > 0 ? (
          <div className="chart-container">
            <div style={{ fontSize: '10px', color: '#666', marginBottom: '0px', padding: '2px 3px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
              <strong>Data Points:</strong> Displaying {decimatedTelemetryData.length} / {telemetryData.length} points (optimized for performance)
            </div>
            <ResponsiveContainer width="100%" height={378}>
              <AreaChart data={decimatedTelemetryData} margin={{ top: 10, right: 20, left: 20, bottom: 25 }}>
                <defs>
                  {getMetricLabels().map((metric, idx) => {
                    const palette = ['#ff7300', '#38a3b8', '#41b922', '#bb4c99', '#ff4d4d', '#8884d8'];
                    const color = palette[idx % palette.length];
                    return (
                      <linearGradient key={`gradient-${metric.code}`} id={`gradient-${metric.code}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3"/>
                <XAxis 
                  dataKey="endTimestampUTC" 
                  tickFormatter={(value) => formatTimeOnly(value)}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12 }}
                  interval={Math.floor(decimatedTelemetryData.length / 10)}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ stroke: '#999', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Legend wrapperStyle={{ paddingTop: '0px', marginBottom: '0px' }} />
                {getMetricLabels().map((metric, idx) => {
                  const palette = ['#ff7300', '#38a3b8', '#41b922', '#bb4c99', '#ff4d4d', '#8884d8'];
                  return (
                    <Area 
                      key={metric.code}
                      type="linear"
                      dataKey={metric.code}
                      name={metric.name}
                      fill={`url(#gradient-${metric.code})`}
                      stroke={palette[idx % palette.length]}
                      dot={false}
                      isAnimationActive={false}
                      strokeWidth={2}
                      connectNulls={true}
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="no-data">No telemetry data available for selected date range. Try extending the date range.</p>
        )}
      </div>

      {/* Section 3: Events */}
      <div className="analytics-section">
        <h3>⚠️ Detected Events ({events.length})</h3>
        {events.length > 0 ? (
          <div className="events-table-container">
            <table className="events-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Event Description</th>
                  <th>Risk Level</th>
                  <th>Score</th>
                  <th>Probability</th>
                  <th>Triggered At</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, idx) => (
                  <tr key={idx} className="event-row">
                    <td>{event.eventLogId}</td>
                    <td>{event.eventDescription || `Event ${event.eventId}`}</td>
                    <td>
                      <span 
                        className="risk-badge"
                        style={{ 
                          backgroundColor: getRiskColor(event.risk),
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        {getRiskLabel(event.risk)}
                      </span>
                    </td>
                    <td>{event.cumulativeScore || 0}</td>
                    <td>{event.probability ? (event.probability * 100).toFixed(1) + '%' : 'N/A'}</td>
                    <td>{formatDate(event.triggeredAt)}</td>
                    <td>
                      {event.detailCount && event.detailCount > 0 ? (
                        <button 
                          onClick={() => fetchEventDetails(event.eventLogId)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#38a3b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => e.target.style.backgroundColor = '#2a8a9f'}
                          onMouseOut={(e) => e.target.style.backgroundColor = '#38a3b8'}
                        >
                          View ({event.detailCount})
                        </button>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no-data">
            No events detected in the selected date range ({startDate} to {endDate}). 
            <br/>
            <small>Try extending the date range or selecting a different entity to see event data.</small>
          </p>
        )}
      </div>

      {/* Event Details Modal */}
      {selectedEventLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto',
            padding: '30px',
            width: '90%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>
                Event Details (ID: {selectedEventLog.eventLogId})
              </h2>
              <button 
                onClick={closeEventDetailsModal}
                style={{
                  fontSize: '24px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#999',
                  padding: 0
                }}
              >
                ✕
              </button>
            </div>

            {eventDetailsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>⌛ Loading details...</div>
            ) : (
              <>
                {/* Event Header Information */}
                <div style={{
                  backgroundColor: '#f5f5f5',
                  padding: '15px',
                  borderRadius: '6px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px' }}>
                    <div>
                      <strong>Event Code:</strong> {selectedEventLog.eventCode}
                    </div>
                    <div>
                      <strong>Description:</strong> {selectedEventLog.eventDescription}
                    </div>
                    <div>
                      <strong>Risk Level:</strong> 
                      <span 
                        style={{
                          marginLeft: '8px',
                          padding: '3px 8px',
                          borderRadius: '3px',
                          backgroundColor: getRiskColor(selectedEventLog.risk),
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}
                      >
                        {getRiskLabel(selectedEventLog.risk)}
                      </span>
                    </div>
                    <div>
                      <strong>Cumulative Score:</strong> {selectedEventLog.cumulativeScore}
                    </div>
                    <div>
                      <strong>Probability:</strong> {selectedEventLog.probability ? (selectedEventLog.probability * 100).toFixed(1) + '%' : 'N/A'}
                    </div>
                    <div>
                      <strong>Analysis Window:</strong> {selectedEventLog.analysisWindowInMin} minutes
                    </div>
                    <div>
                      <strong>Triggered At:</strong> {formatDate(selectedEventLog.triggeredAt)}
                    </div>
                    <div>
                      <strong>Processing Time:</strong> {selectedEventLog.processingTimeMs ? selectedEventLog.processingTimeMs + ' ms' : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* AI Analysis Results Section - Dynamically rendered for different AI functions */}
                {selectedEventLog.analysisMetadata && (
                  <div style={{ marginTop: '30px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#1976d2' }}>
                      🔬 AI Analysis Results
                    </h3>
                    <div style={{
                      backgroundColor: '#f0f7ff',
                      padding: '20px',
                      borderRadius: '6px',
                      borderLeft: '4px solid #1976d2'
                    }}>
                      {(() => {
                        try {
                          const metadata = typeof selectedEventLog.analysisMetadata === 'string' 
                            ? JSON.parse(selectedEventLog.analysisMetadata) 
                            : selectedEventLog.analysisMetadata;
                          
                          // Get analysis type to determine rendering
                          const analysisType = metadata.analysisType || 'Unknown';
                          
                          return (
                            <div>
                              <div style={{ marginBottom: '15px', fontSize: '12px', color: '#666' }}>
                                <strong>Function Type:</strong> {metadata.functionType || 'N/A'} | 
                                <strong style={{ marginLeft: '10px' }}>Analysis:</strong> {analysisType}
                              </div>

                              {/* DriftDetector Specific Rendering */}
                              {analysisType === 'DriftDetector' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  {metadata.baselineAnalysis && (
                                    <div style={{ 
                                      backgroundColor: 'white', 
                                      padding: '12px', 
                                      borderRadius: '4px',
                                      borderLeft: '4px solid #2196F3'
                                    }}>
                                      <strong style={{ fontSize: '13px', color: '#2196F3' }}>📊 Baseline (7-day Average)</strong>
                                      <div style={{ marginTop: '8px', fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>Avg Value: <strong>{Number(metadata.baselineAnalysis.avgValue).toFixed(2)}</strong></div>
                                        <div>Samples: <strong>{metadata.baselineAnalysis.sampleCount}</strong></div>
                                        {metadata.baselineAnalysis.dateRange && (
                                          <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#999' }}>
                                            Period: {formatDateRange(metadata.baselineAnalysis.dateRange)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {metadata.currentAnalysis && (
                                    <div style={{ 
                                      backgroundColor: 'white', 
                                      padding: '12px', 
                                      borderRadius: '4px',
                                      borderLeft: '4px solid #FF9800'
                                    }}>
                                      <strong style={{ fontSize: '13px', color: '#FF9800' }}>
                                        📈 Current Analysis {metadata.currentAnalysis.dateRange && (
                                          <span style={{ fontSize: '12px', color: '#FF9800', fontWeight: 'normal' }}>
                                            ({calculateDurationFromDateRange(metadata.currentAnalysis.dateRange)})
                                          </span>
                                        )}
                                      </strong>
                                      <div style={{ marginTop: '8px', fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>Avg Value: <strong>{Number(metadata.currentAnalysis.avgValue).toFixed(2)}</strong></div>
                                        <div>Samples: <strong>{metadata.currentAnalysis.sampleCount}</strong></div>
                                        {metadata.currentAnalysis.dateRange && (
                                          <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#999' }}>
                                            Period: {formatDateRange(metadata.currentAnalysis.dateRange)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {metadata.detectionMetadata && (
                                    <div style={{ 
                                      backgroundColor: 'white', 
                                      padding: '12px', 
                                      borderRadius: '4px',
                                      borderLeft: '4px solid #4CAF50'
                                    }}>
                                      <strong style={{ fontSize: '13px', color: '#4CAF50' }}>✓ Detection Results</strong>
                                      <div style={{ marginTop: '8px', fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>Method: <strong>{metadata.detectionMetadata.method}</strong></div>
                                        <div>Z-Score: <strong>{Number(metadata.detectionMetadata.z_score).toFixed(2)}σ</strong></div>
                                        <div>Drift: <strong style={{ color: '#FF5722' }}>{Number(metadata.detectionMetadata.drift_percentage).toFixed(1)}%</strong></div>
                                        <div>Sensitivity: <strong>{metadata.detectionMetadata.sensitivity}</strong></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Generic JSON Renderer for other AI functions */}
                              {analysisType !== 'DriftDetector' && (
                                <div style={{ fontSize: '13px' }}>
                                  <pre style={{
                                    backgroundColor: 'white',
                                    padding: '12px',
                                    borderRadius: '4px',
                                    overflow: 'auto',
                                    fontSize: '12px',
                                    lineHeight: '1.4',
                                    maxHeight: '400px',
                                    border: '1px solid #e0e0e0'
                                  }}>
                                    {JSON.stringify(metadata, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {/* Analysis Window Info */}
                              {metadata.analysisWindow && (
                                <div style={{ marginTop: '12px', fontSize: '12px', color: '#999', paddingTop: '12px', borderTop: '1px solid #e0e0e0' }}>
                                  Analysis Window: {metadata.analysisWindow.lookbackMinutes}min | 
                                  Baseline: {metadata.analysisWindow.baselineDays}d
                                </div>
                              )}
                            </div>
                          );
                        } catch (e) {
                          return (
                            <div style={{ color: '#d32f2f', fontSize: '13px' }}>
                              ⚠️ Error parsing analysis metadata: {e.message}
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                )}

                {/* Event Details Table */}
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>Attribute Details</h3>
                  {selectedEventLog.details && selectedEventLog.details.length > 0 ? (
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <thead style={{ backgroundColor: '#f9f9f9' }}>
                        <tr>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Attribute</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Code</th>
                          <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Value</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Score Contrib.</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>In Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedEventLog.details.map((detail, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                            <td style={{ padding: '10px', textAlign: 'left' }}>{detail.attributeName || 'Unknown'}</td>
                            <td style={{ padding: '10px', textAlign: 'left', fontSize: '12px', color: '#666' }}>{detail.attributeCode}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              {detail.numericValue !== null && detail.numericValue !== undefined 
                                ? `${Number(detail.numericValue).toFixed(2)} ${detail.attributeUnit || ''}` 
                                : 'N/A'}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600' }}>
                              <span 
                                onClick={() => showScoreDetails(detail)}
                                style={{
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  borderRadius: '3px',
                                  backgroundColor: '#e3f2fd',
                                  color: '#1976d2',
                                  transition: 'background-color 0.2s',
                                  display: 'inline-block'
                                }}
                                onMouseOver={(e) => e.target.style.backgroundColor = '#bbdefb'}
                                onMouseOut={(e) => e.target.style.backgroundColor = '#e3f2fd'}
                                title="Click to view scoring rules"
                              >
                                {detail.scoreContribution}
                              </span>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span 
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '3px',
                                  backgroundColor: detail.withinRange === 'Y' ? '#e8f5e9' : '#ffebee',
                                  color: detail.withinRange === 'Y' ? '#2e7d32' : '#c62828',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              >
                                {detail.withinRange === 'Y' ? 'Yes' : 'No'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: '#999', fontStyle: 'italic' }}>No attribute details available</p>
                  )}
                </div>

                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                  <button 
                    onClick={closeEventDetailsModal}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#38a3b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#2a8a9f'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#38a3b8'}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Score Details Popup Modal */}
      {selectedScoreDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflow: 'auto',
            padding: '25px',
            width: '90%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                Value Scores for Selected Attributes
              </h2>
              <button 
                onClick={closeScoreDetailsPopup}
                style={{
                  fontSize: '24px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#999',
                  padding: 0
                }}
              >
                ✕
              </button>
            </div>

            {scoreDetailsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>⌛ Loading score details...</div>
            ) : (
              <>
                {/* Attribute Details */}
                <div style={{
                  backgroundColor: '#f5f5f5',
                  padding: '15px',
                  borderRadius: '6px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px' }}>
                    <div>
                      <strong>Attribute:</strong> {selectedScoreDetail.attributeName || 'Unknown'}
                    </div>
                    <div>
                      <strong>Code:</strong> {selectedScoreDetail.attributeCode}
                    </div>
                    <div>
                      <strong>Measured Value:</strong> 
                      <span style={{ marginLeft: '8px', fontWeight: 'bold', color: '#2196F3' }}>
                        {selectedScoreDetail.numericValue !== null && selectedScoreDetail.numericValue !== undefined 
                          ? `${Number(selectedScoreDetail.numericValue).toFixed(2)} ${selectedScoreDetail.attributeUnit || ''}` 
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <strong>Score Contribution:</strong>
                      <span style={{ marginLeft: '8px', fontWeight: 'bold', color: '#FF5722' }}>
                        {selectedScoreDetail.scoreContribution}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scoring Rules or Analysis Statistics based on function type */}
                <div>
                  {selectedScoreDetail.isPythonAnalysis ? (
                    <>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold' }}>Analysis Statistics</h3>
                      {selectedScoreDetail.analysisMetadata ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                          {selectedScoreDetail.analysisMetadata.baselineAnalysis && (
                            <div style={{ 
                              backgroundColor: '#f9f9f9', 
                              padding: '12px', 
                              borderRadius: '4px',
                              borderLeft: '4px solid #2196F3'
                            }}>
                              <strong>Baseline (7 days)</strong>
                              <div>Average: <strong>{selectedScoreDetail.analysisMetadata.baselineAnalysis.avgValue}</strong></div>
                              <div>Samples: {selectedScoreDetail.analysisMetadata.baselineAnalysis.sampleCount}</div>
                            </div>
                          )}
                          
                          {selectedScoreDetail.analysisMetadata.currentAnalysis && (
                            <div style={{ 
                              backgroundColor: '#f9f9f9', 
                              padding: '12px', 
                              borderRadius: '4px',
                              borderLeft: '4px solid #FF9800'
                            }}>
                              <strong>Current Analysis</strong>
                              <div>Average: <strong>{selectedScoreDetail.analysisMetadata.currentAnalysis.avgValue}</strong></div>
                              <div>Samples: {selectedScoreDetail.analysisMetadata.currentAnalysis.sampleCount}</div>
                            </div>
                          )}
                          
                          {selectedScoreDetail.analysisMetadata.detectionMetadata && (
                            <div style={{ 
                              backgroundColor: '#f9f9f9', 
                              padding: '12px', 
                              borderRadius: '4px',
                              borderLeft: '4px solid #4CAF50'
                            }}>
                              <strong>Detection Results</strong>
                              <div>Method: <strong>{selectedScoreDetail.analysisMetadata.detectionMetadata.method}</strong></div>
                              <div>Z-Score: <strong>{selectedScoreDetail.analysisMetadata.detectionMetadata.z_score}σ</strong></div>
                              <div>Drift: <strong>{selectedScoreDetail.analysisMetadata.detectionMetadata.drift_percentage}%</strong></div>
                              <div>Sensitivity: <strong>{selectedScoreDetail.analysisMetadata.detectionMetadata.sensitivity}</strong></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="no-data">No analysis metadata available</p>
                      )}
                    </>
                  ) : (
                    <>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold' }}>Scoring Ranges</h3>
                  {selectedScoreDetail.scores && selectedScoreDetail.scores.length > 0 ? (
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '12px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <thead style={{ backgroundColor: '#f0f0f0' }}>
                        <tr>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Score</th>
                          <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Min Value</th>
                          <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Max Value</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedScoreDetail.scores.sort((a, b) => {
                          if (a.minValue === null) return 1;
                          if (b.minValue === null) return -1;
                          return a.minValue - b.minValue;
                        }).map((rule, idx) => {
                          const isMatched = selectedScoreDetail.numericValue !== null 
                            && selectedScoreDetail.numericValue !== undefined
                            && selectedScoreDetail.numericValue >= rule.minValue 
                            && selectedScoreDetail.numericValue <= rule.maxValue;
                          
                          return (
                            <tr 
                              key={idx} 
                              style={{
                                borderBottom: '1px solid #e0e0e0',
                                backgroundColor: isMatched ? '#fffacd' : 'transparent'
                              }}
                            >
                              <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                                {rule.score}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right' }}>
                                {rule.minValue}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right' }}>
                                {rule.maxValue}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                {isMatched ? (
                                  <span style={{
                                    padding: '3px 8px',
                                    borderRadius: '3px',
                                    backgroundColor: '#c8e6c9',
                                    color: '#2e7d32',
                                    fontSize: '11px',
                                    fontWeight: 'bold'
                                  }}>
                                    ✓ MATCHED
                                  </span>
                                ) : (
                                  <span style={{ color: '#999', fontSize: '11px' }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: '#999', fontStyle: 'italic' }}>No scoring rules available</p>
                  )}
                    </>
                  )}
                </div>

                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                  <button 
                    onClick={closeScoreDetailsPopup}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#38a3b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#2a8a9f'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#38a3b8'}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
