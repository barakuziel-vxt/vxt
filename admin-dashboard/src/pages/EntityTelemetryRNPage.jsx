/**
 * EntityTelemetryRNPage — web admin version of EntityTelemetryRN.tsx
 *
 * Mirrors the React Native mobile screen:
 *   - Entity selector
 *   - Start / End date-time inputs (no preset chips)
 *   - Attribute multi-select tiles (tap to toggle in chart)
 *   - Multi-series recharts line chart with full tooltip
 *   - Events list with detail modal
 */
import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import '../styles/ManagementPage.css';
import { convertValue, getUnit } from '../utils/unitConversion';
import LocationMap from '../components/LocationMap';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { bridgeRequest, waitForBridge } from '../utils/bridge';

const C = {
  bg: '#0d1117',
  card: '#161b22',
  border: '#30363d',
  textPrimary: '#e6edf3',
  textMuted: '#8b949e',
};

// ─── Chart colours ──────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#ff7300', '#38a3b8', '#41b922', '#bb4c99',
  '#ff4d4d', '#8884d8', '#f5a623', '#50e3c2',
];

// ─── Embedded / driver mode detection ───────────────────────────────────────

/** True when page is loaded inside the RN WebView with mode=driver */
const IS_DRIVER_MODE = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'driver';
  } catch { return false; }
})();

/** True when page is loaded inside the RN WebView (embedded=true) */
const IS_EMBEDDED = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('embedded') === 'true';
  } catch { return false; }
})();

// driverRequest is the shared bridgeRequest (alias for readability)
const driverRequest = bridgeRequest;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalISOString(date) {
  const y   = date.getFullYear();
  const mo  = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const h   = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${min}`;
}

function formatDate(iso) {
  try {
    const s = iso.endsWith('Z') ? iso : iso + 'Z';
    return new Date(s).toLocaleString();
  } catch { return iso; }
}

// ─── Tooltip styling ────────────────────────────────────────────────────────
const TOOLTIP_STYLE = {
  backgroundColor: '#2d2d2d',
  border: '1px solid #555',
  borderRadius: '4px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function EntityTelemetryRNPage() {
  // Get base URL from URL parameters (passed from RN) or env var
  const getBaseUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const dsType = params.get('dsType');
      const cloudUrl = params.get('cloudUrl');
      const localUrl = params.get('localUrl');
      
      if (dsType && cloudUrl && localUrl) {
        const url = dsType === 'cloud' ? cloudUrl : localUrl;
        return url.endsWith('/') ? url.slice(0, -1) : url;
      }
    } catch (e) { /* ignore */ }
    return import.meta.env.VITE_API_BASE_URL ?? '';
  };
  
  const BASE = getBaseUrl();

  // Entity
  const [entities,       setEntities]       = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Date range
  const [startDate, setStartDate] = useState(() => toLocalISOString(new Date(Date.now() - 2 * 3_600_000)));
  const [endDate,   setEndDate]   = useState(() => toLocalISOString(new Date()));

  // Data
  const [latestValues,    setLatestValues]    = useState([]);
  const [telemetryData,   setTelemetryData]   = useState([]);
  const [events,          setEvents]          = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState({});

  // UI state
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState(null);
  const [selectedEventLog,    setSelectedEventLog]    = useState(null);
  const [eventDetailsLoading,  setEventDetailsLoading]  = useState(false);
  const [selectedScoreDetail,  setSelectedScoreDetail]  = useState(null);
  const [scoreDetailsLoading,  setScoreDetailsLoading]  = useState(false);

  // ── Load entities on mount ─────────────────────────────────────────────────
  useEffect(() => { loadEntities(); }, []);

  // ── Load data when entity or date range changes ────────────────────────────
  useEffect(() => {
    if (selectedEntity && startDate && endDate) {
      setSelectedMetrics({});
      loadData();
    }
  }, [selectedEntity, startDate, endDate]);

  // ── Auto-select default metrics ────────────────────────────────────────────
  useEffect(() => {
    if (latestValues.length > 0 && Object.keys(selectedMetrics).length === 0) {
      const defaults = {};
      latestValues.forEach(v => { if (v.defaultInGraph === 'Y') defaults[v.attributeCode] = true; });
      if (Object.keys(defaults).length > 0) setSelectedMetrics(defaults);
    }
  }, [latestValues]);

  // ── API calls ──────────────────────────────────────────────────────────────
  async function loadEntities() {
    try {
      setLoading(true);
      setError(null);
      let data;
      if (IS_EMBEDDED) {
        data = await driverRequest('loadEntities');
        if (!data) data = [];
      } else {
        const res = await fetch(`${BASE}/entities`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      }
      setEntities(data);
      if (data.length > 0) {
        const preferred = data.find(e => e.entityFirstName === 'Shula') ?? data[0];
        setSelectedEntity(preferred.entityId);
      }
    } catch (e) {
      setError('Failed to load entities: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    if (!selectedEntity) return;
    try {
      setLoading(true);
      setError(null);
      const start = new Date(startDate).toISOString();
      const end   = new Date(endDate).toISOString();
      console.log('[EntityTelemetryRNPage] Loading entity', selectedEntity, 'from', start, 'to', end);

      if (IS_EMBEDDED) {
        // Bridge: request data from RN native layer (driver APIs or HTTP proxy)
        const [latest, tel, ev] = await Promise.all([
          driverRequest('loadLatest', { entityId: String(selectedEntity) }),
          driverRequest('loadRange',  { entityId: String(selectedEntity), startDate: start, endDate: end }),
          driverRequest('loadEvents', { entityId: String(selectedEntity), startDate: start, endDate: end }),
        ]);
        setLatestValues(latest || []);
        setTelemetryData(tel || []);
        setEvents(ev || []);
      } else {
        const [latestRes, telRes, evRes] = await Promise.all([
          fetch(`${BASE}/api/telemetry/latest/${selectedEntity}`),
          fetch(`${BASE}/api/telemetry/range/${selectedEntity}?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`),
          fetch(`${BASE}/api/events/range/${selectedEntity}?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`),
        ]);

        if (latestRes.ok) {
          const latest = await latestRes.json();
          console.log('[EntityTelemetryRNPage] Latest values:', latest.length, 'metrics -', latest.slice(0,3).map(v => ({ code: v.attributeCode, numericValue: v.numericValue, unit: v.attributeUnit })));
          setLatestValues(latest);
        } else {
          console.error('[EntityTelemetryRNPage] Latest failed:', latestRes.status);
        }
        if (telRes.ok) {
          const tel = await telRes.json();
          console.log('[EntityTelemetryRNPage] Telemetry:', tel.length, 'records');
          setTelemetryData(tel);
        } else {
          console.error('[EntityTelemetryRNPage] Telemetry failed:', telRes.status);
          setTelemetryData([]);
        }
        if (evRes.ok) {
          const ev = await evRes.json();
          console.log('[EntityTelemetryRNPage] Events:', ev.length);
          setEvents(ev);
        } else {
          setEvents([]);
        }
      }
    } catch (e) {
      setError('Failed to load data: ' + e.message);
      console.error('[EntityTelemetryRNPage] Error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEventDetails(eventLogId) {
    try {
      setEventDetailsLoading(true);
      let data;
      if (IS_EMBEDDED) {
        data = await driverRequest('loadEventDetails', { eventLogId: String(eventLogId) });
        if (!data) return;
      } else {
        const res = await fetch(`${BASE}/api/eventlog/${eventLogId}/details`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      }
      setSelectedEventLog(data);
    } catch (e) {
      setError('Failed to load event details: ' + e.message);
    } finally {
      setEventDetailsLoading(false);
    }
  }

  function getRiskColor(risk) {
    if (!risk) return '#999';
    const r = risk.toUpperCase();
    if (r === 'HIGH') return '#ff4444';
    if (r === 'MEDIUM') return '#ff9900';
    if (r === 'LOW') return '#ffdd00';
    return '#999';
  }

  function getRiskLabel(risk) {
    if (!risk) return 'N/A';
    return risk.charAt(0).toUpperCase() + risk.slice(1).toLowerCase();
  }

  async function showScoreDetails(detail) {
    try {
      setScoreDetailsLoading(true);
      const attributeCode = detail.attributeCode;
      const detailToShow = { ...detail };

      if (selectedEventLog?.analysisMetadata) {
        try {
          const metadata = typeof selectedEventLog.analysisMetadata === 'string'
            ? JSON.parse(selectedEventLog.analysisMetadata)
            : selectedEventLog.analysisMetadata;
          if (metadata && metadata.functionType === 'PYTHON') {
            detailToShow.analysisMetadata = metadata;
            detailToShow.isPythonAnalysis = true;
            setSelectedScoreDetail(detailToShow);
            return;
          }
        } catch (e) {
          console.warn('Could not parse analysisMetadata:', e);
        }
      }

      let scores;
      if (IS_EMBEDDED) {
        scores = await driverRequest('loadScores', { attributeCode });
      } else {
        const response = await fetch(`${BASE}/api/entity-attributes/${attributeCode}/scores`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        scores = await response.json();
      }
      detailToShow.scores = scores || [];
      detailToShow.isPythonAnalysis = false;
      setSelectedScoreDetail(detailToShow);
    } catch (err) {
      console.error('Error fetching score details:', err);
      setError('Failed to load score details: ' + (err.message || String(err)));
    } finally {
      setScoreDetailsLoading(false);
    }
  }

  // ── Build chart data ───────────────────────────────────────────────────────
  const activeMetrics = latestValues.filter(v => selectedMetrics[v.attributeCode]);
  const colorMap = {};
  activeMetrics.forEach((v, i) => { colorMap[v.attributeCode] = CHART_COLORS[i % CHART_COLORS.length]; });

  // Pivot telemetry records into recharts format: [{ts, code1: val, code2: val, ...}]
  const chartData = telemetryData
    .map(rec => {
      const tsStr = rec.endTimestampUTC ?? rec.timestamp ?? '';
      const ts = new Date(tsStr.endsWith('Z') ? tsStr : tsStr + 'Z').getTime();
      const point = { ts };
      activeMetrics.forEach(v => {
        const val = rec[v.attributeCode];
        if (typeof val === 'number')
          point[v.attributeCode] = convertValue(val, v.attributeCode, v.attributeUnit);
      });
      return point;
    })
    .filter(p => !isNaN(p.ts))
    .sort((a, b) => a.ts - b.ts);

  const hasChart = chartData.length > 0 && activeMetrics.length > 0;

  const exportToPDF = async () => {
    if (IS_EMBEDDED) {
      // Mobile: send PDF via bridge to RN for sharing
      try {
        const element = document.getElementById('telemetry-rn-content');
        if (!element) { alert('Content not found for export'); return; }
        const clonedElement = element.cloneNode(true);
        const filterSection = clonedElement.querySelector('.filter-section');
        if (filterSection) filterSection.remove();
        clonedElement.style.position = 'absolute';
        clonedElement.style.left = '-9999px';
        clonedElement.style.width = element.offsetWidth + 'px';
        document.body.appendChild(clonedElement);
        clonedElement.style.backgroundColor = '#ffffff';
        clonedElement.style.color = '#000000';
        clonedElement.querySelectorAll('*').forEach(el => {
          const computedStyle = window.getComputedStyle(el);
          const bg = computedStyle.backgroundColor.match(/\d+/g);
          if (bg && bg.length >= 3 && (parseInt(bg[0]) + parseInt(bg[1]) + parseInt(bg[2])) / 3 < 150)
            el.style.backgroundColor = '#ffffff';
          const fg = computedStyle.color.match(/\d+/g);
          if (fg && fg.length >= 3 && (parseInt(fg[0]) + parseInt(fg[1]) + parseInt(fg[2])) / 3 > 150)
            el.style.color = '#000000';
        });
        const canvas = await html2canvas(clonedElement, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
        document.body.removeChild(clonedElement);
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const entity = entities.find(e => String(e.entityId) === String(selectedEntity));
        const entityName = entity ? (entity.entityFirstName || entity.entityName || selectedEntity) : selectedEntity;
        pdf.setFillColor(240, 240, 240);
        pdf.rect(0, 0, 210, 25, 'F');
        pdf.setFontSize(16); pdf.setTextColor(0, 0, 0);
        pdf.text(`Telemetry Report - ${entityName}`, 10, 12);
        pdf.setFontSize(9); pdf.setTextColor(80, 80, 80);
        pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, 18);
        pdf.text(`Date Range: ${startDate} to ${endDate}`, 10, 23);
        let yPosition = 28;
        let heightLeft = imgHeight;
        while (heightLeft > 0) {
          if (yPosition + Math.min(heightLeft, pageHeight - yPosition) > pageHeight) {
            pdf.addPage(); yPosition = 10;
          }
          const contentHeight = Math.min(heightLeft, pageHeight - yPosition);
          pdf.addImage(imgData, 'PNG', 0, yPosition, imgWidth, contentHeight);
          heightLeft -= contentHeight;
          yPosition = pageHeight;
        }
        const pdfData = pdf.output('datauristring');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sharePDF', pdfData, entityName }));
      } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Failed to export PDF: ' + (error.message || String(error)));
      }
      return;
    }
    // PC: use pdf.save()
    try {
      const element = document.getElementById('telemetry-rn-content');
      if (!element) { alert('Content not found for export'); return; }
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const entity = entities.find(e => String(e.entityId) === String(selectedEntity));
      const entityName = entity ? (entity.entityFirstName || entity.entityName || selectedEntity) : selectedEntity;
      pdf.setFillColor(240, 240, 240);
      pdf.rect(0, 0, 210, 25, 'F');
      pdf.setFontSize(16); pdf.setTextColor(0, 0, 0);
      pdf.text(`Telemetry Report - ${entityName}`, 10, 12);
      pdf.setFontSize(9); pdf.setTextColor(80, 80, 80);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, 18);
      pdf.text(`Date Range: ${startDate} to ${endDate}`, 10, 23);
      let yPosition = 28;
      let heightLeft = imgHeight;
      while (heightLeft > 0) {
        if (yPosition + Math.min(heightLeft, pageHeight - yPosition) > pageHeight) {
          pdf.addPage(); yPosition = 10;
        }
        const contentHeight = Math.min(heightLeft, pageHeight - yPosition);
        pdf.addImage(imgData, 'PNG', 0, yPosition, imgWidth, contentHeight);
        heightLeft -= contentHeight;
        yPosition = pageHeight;
      }
      pdf.save(`telemetry-${entityName}-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF: ' + (error.message || String(error)));
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="management-page" style={IS_EMBEDDED ? { padding: 0, margin: 0, borderRadius: 0, boxShadow: 'none', background: '#0d1117', minHeight: '100vh' } : undefined}>
      {IS_EMBEDDED ? (
        // Embedded mode: entity selector + buttons in one compact row
        <div style={{ display: 'flex', gap: '6px', padding: '4px 4px', alignItems: 'center', borderBottom: '1px solid #30363d', backgroundColor: '#0d1117' }}>
          {!IS_DRIVER_MODE && (
            <select
              value={selectedEntity ?? ''}
              onChange={e => setSelectedEntity(e.target.value)}
              disabled={loading}
              style={{ flex: 1, padding: '5px 10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: '4px', fontSize: '12px', minWidth: 0 }}
            >
              <option value="">-- Entity --</option>
              {entities.map(e => (
                <option key={e.entityId} value={e.entityId}>
                  {e.entityFirstName || e.entityName}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={exportToPDF}
            disabled={loading}
            style={{ padding: '5px 10px', backgroundColor: '#5a6a8a', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap' }}
            title="Export to PDF"
          >
            📄 PDF
          </button>
          <button
            onClick={() => { setLoading(true); loadData(); }}
            disabled={loading}
            style={{ padding: '5px 10px', backgroundColor: '#5a6a8a', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap' }}
            title="Refresh data"
          >
            🔄 {loading ? '...' : 'Refresh'}
          </button>
        </div>
      ) : (
        // PC admin dashboard: entity selector (left, dynamic width) + buttons (right)
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!IS_DRIVER_MODE && (
            <div style={{ flex: '0 0 auto', minWidth: 0, maxWidth: '300px' }}>
              <select
                value={selectedEntity ?? ''}
                onChange={e => setSelectedEntity(e.target.value)}
                disabled={loading}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: '#353535', color: '#e0e0e0', border: '1px solid #444', borderRadius: '4px', fontSize: '14px' }}
              >
                <option value="">-- Select Entity --</option>
                {entities.map(e => (
                  <option key={e.entityId} value={e.entityId}>
                    {e.entityFirstName || e.entityName} ({e.entityId})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={exportToPDF}
              disabled={loading}
              style={{ padding: '8px 14px', backgroundColor: '#5a6a8a', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500' }}
              title="Export to PDF"
            >
              📄 Export PDF
            </button>
            <button 
              className="refresh-button"
              onClick={() => { setLoading(true); loadData(); }}
              disabled={loading}
              title="Refresh data"
            >
              🔄 {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="error-message" style={IS_EMBEDDED ? { margin: '4px 4px', borderRadius: 0 } : undefined}>{error}</div>}

      <div id="telemetry-rn-content" style={IS_EMBEDDED ? { padding: 0 } : undefined}>

      {/* ── Filter Section (Compact, left-aligned) ── */}
      <div className="filter-section" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '6px', padding: IS_EMBEDDED ? '4px 4px' : '8px 10px', alignItems: 'center', backgroundColor: IS_EMBEDDED ? '#0d1117' : undefined, margin: IS_EMBEDDED ? '4px 0 0 0' : undefined, borderRadius: IS_EMBEDDED ? 0 : undefined }}> 
        <label style={{ fontSize: IS_EMBEDDED ? '11px' : '12px', fontWeight: '500', color: '#aaa', marginRight: IS_EMBEDDED ? '3px' : '6px', whiteSpace: 'nowrap' }}>Range:</label>
        <div className="filter-group" style={{ flex: IS_EMBEDDED ? '1 1 auto' : '0 0 auto', minWidth: 0 }}>
          <input 
            type="datetime-local" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            disabled={loading}
            style={{ width: '100%', fontSize: '12px', padding: IS_EMBEDDED ? '4px 4px' : '5px 6px', backgroundColor: '#353535', color: '#e0e0e0', border: '1px solid #444', borderRadius: '3px' }}
            title="Start date and time"
          />
        </div>

        <div className="filter-group" style={{ flex: IS_EMBEDDED ? '1 1 auto' : '0 0 auto', minWidth: 0 }}>
          <input 
            type="datetime-local" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            disabled={loading}
            style={{ width: '100%', fontSize: '12px', padding: IS_EMBEDDED ? '4px 4px' : '5px 6px', backgroundColor: '#353535', color: '#e0e0e0', border: '1px solid #444', borderRadius: '3px' }}
            title="End date and time"
          />
        </div>
      </div>

      {/* ── Location Map — below filters, above attributes ── */}
      <div style={IS_EMBEDDED ? { margin: 0, padding: 0, width: '100%' } : undefined}>
        <LocationMap telemetryData={telemetryData} title="Location History" />
      </div>

      {/* ── Latest Value Metrics ── */}
      {latestValues.length > 0 && (
        <div className="analytics-section" style={IS_EMBEDDED ? { margin: '4px 0', padding: '6px 4px', borderLeft: 'none', borderRadius: 0 } : undefined}>
          <h3 style={IS_EMBEDDED ? { fontSize: '14px', margin: '0 0 4px 0' } : undefined}>📌 Attributes (Click to toggle in graph)</h3>
          <div className="metrics-display" style={{ display: 'grid', gridTemplateColumns: IS_EMBEDDED ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: IS_EMBEDDED ? '4px' : '8px' }}>
            {latestValues.map((v, idx) => {
              const isSelected = selectedMetrics[v.attributeCode] || false;
              const color = isSelected ? (colorMap[v.attributeCode] || '#60a5fa') : 'inherit';
              
              return (
                <div 
                  key={idx} 
                  className="metric-card"
                  onClick={() => setSelectedMetrics(prev => ({ ...prev, [v.attributeCode]: !prev[v.attributeCode] }))}
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #60a5fa' : '2px solid transparent',
                    transition: 'border-color 0.2s ease',
                    padding: IS_EMBEDDED ? 'calc(6px - 2px)' : 'calc(12px - 2px)'
                  }}
                >
                  <div className="metric-key" title={v.attributeCode}>
                    {v.attributeName || v.attributeCode}
                  </div>
                  <div 
                    className="metric-val"
                    style={{ 
                      color: color,
                      fontFamily: 'Inter, Arial, sans-serif',
                      fontSize: IS_EMBEDDED ? '18px' : '24px',
                      fontWeight: 'bold'
                    }}
                  >
                    {v.numericValue != null ? convertValue(v.numericValue, v.attributeCode, v.attributeUnit) : '—'}
                    <span style={{ fontSize: '14px', marginLeft: '4px', color: '#aaa' }}>
                      {getUnit(v.attributeCode) || v.attributeUnit || ''}
                    </span>
                  </div>
                  <div className="metric-timestamp">
                    {v.endTimestampUTC ? formatDate(v.endTimestampUTC) : v.timestamp ? formatDate(v.timestamp) : 'N/A'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Chart ── */}
      {hasChart && (
        <div className="analytics-section" style={IS_EMBEDDED ? { margin: '4px 0', padding: '6px 4px', borderLeft: 'none', borderRadius: 0 } : undefined}>
          <h3 style={IS_EMBEDDED ? { fontSize: '14px', margin: '0 0 4px 0' } : undefined}>📈 Chart</h3>
          <ResponsiveContainer width="100%" height={IS_EMBEDDED ? 240 : 320}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                stroke="#8b949e"
                tick={{ fill: '#8b949e', fontSize: 11 }}
              />
              <YAxis stroke="#8b949e" tick={{ fill: '#8b949e', fontSize: 11 }} width={40} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              />
              <Legend wrapperStyle={{ color: '#8b949e', fontSize: 12 }} />
              {activeMetrics.map(v => (
                <Line
                  key={v.attributeCode}
                  type="monotone"
                  dataKey={v.attributeCode}
                  name={v.attributeName || v.attributeCode}
                  stroke={colorMap[v.attributeCode]}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── No data hint ── */}
      {!loading && !error && latestValues.length === 0 && selectedEntity && (
        <div className="analytics-section" style={{ textAlign: 'center', color: '#8b949e' }}>
          No data found for the selected entity and date range.
        </div>
      )}

      {/* ── Events table (matches TelemetryAnalyticsPage) ── */}
      {events.length > 0 && (
        <div className="analytics-section" style={IS_EMBEDDED ? { margin: '4px 0', padding: '6px 4px', borderLeft: 'none', borderRadius: 0 } : undefined}>
          <h3>⚠️ Detected Events ({events.length})</h3>
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
                    <td>{event.eventDescription || event.eventName || `Event ${event.eventId || ''}`}</td>
                    <td>
                      <span
                        className="risk-badge"
                        style={{
                          backgroundColor: getRiskColor(event.risk),
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        {getRiskLabel(event.risk)}
                      </span>
                    </td>
                    <td>{event.cumulativeScore ?? 0}</td>
                    <td>{event.probability != null ? (event.probability * 100).toFixed(1) + '%' : 'N/A'}</td>
                    <td>{formatDate(event.triggeredAt || event.endTimestampUTC || event.timestamp || '')}</td>
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
                          }}
                          onMouseOver={e => e.target.style.backgroundColor = '#2a8a9f'}
                          onMouseOut={e => e.target.style.backgroundColor = '#38a3b8'}
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
        </div>
      )}

      {/* ── Score detail modal (zIndex 1001, above event modal) ── */}
      {selectedScoreDetail && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1001,
        }}
        onClick={() => setSelectedScoreDetail(null)}
        >
          <div style={{
            backgroundColor: '#2d2d2d', borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            maxWidth: '700px', maxHeight: '80vh', overflow: 'auto',
            padding: '25px', width: '90%', color: '#e6edf3',
          }}
          onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Value Scores for Selected Attributes</h2>
              <button onClick={() => setSelectedScoreDetail(null)}
                style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', padding: 0 }}
              >✕</button>
            </div>

            {scoreDetailsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>⌛ Loading score details...</div>
            ) : (
              <>
                {/* Attribute info */}
                <div style={{ backgroundColor: '#353535', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px' }}>
                    <div><strong>Attribute:</strong> {selectedScoreDetail.attributeName || 'Unknown'}</div>
                    <div><strong>Code:</strong> {selectedScoreDetail.attributeCode}</div>
                    <div>
                      <strong>Measured Value:</strong>
                      <span style={{ marginLeft: '8px', fontWeight: 'bold', color: '#2196F3' }}>
                        {selectedScoreDetail.numericValue != null
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

                {/* Python vs TSQL section */}
                {selectedScoreDetail.isPythonAnalysis ? (
                  <>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold' }}>Analysis Statistics</h3>
                    {selectedScoreDetail.analysisMetadata ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                        {selectedScoreDetail.analysisMetadata.baselineAnalysis && (
                          <div style={{ backgroundColor: '#3a3a3a', padding: '12px', borderRadius: '4px', borderLeft: '4px solid #6db3f2' }}>
                            <strong>Baseline (7 days)</strong>
                            <div>Average: <strong>{selectedScoreDetail.analysisMetadata.baselineAnalysis.avgValue}</strong></div>
                            <div>Samples: {selectedScoreDetail.analysisMetadata.baselineAnalysis.sampleCount}</div>
                          </div>
                        )}
                        {selectedScoreDetail.analysisMetadata.currentAnalysis && (
                          <div style={{ backgroundColor: '#3a3a3a', padding: '12px', borderRadius: '4px', borderLeft: '4px solid #ffaa44' }}>
                            <strong>Current Analysis</strong>
                            <div>Average: <strong>{selectedScoreDetail.analysisMetadata.currentAnalysis.avgValue}</strong></div>
                            <div>Samples: {selectedScoreDetail.analysisMetadata.currentAnalysis.sampleCount}</div>
                          </div>
                        )}
                        {selectedScoreDetail.analysisMetadata.detectionMetadata && (
                          <div style={{ backgroundColor: '#3a3a3a', padding: '12px', borderRadius: '4px', borderLeft: '4px solid #44dd44' }}>
                            <strong>Detection Results</strong>
                            <div>Method: <strong>{selectedScoreDetail.analysisMetadata.detectionMetadata.method}</strong></div>
                            <div>Z-Score: <strong>{selectedScoreDetail.analysisMetadata.detectionMetadata.z_score}σ</strong></div>
                            <div>Drift: <strong>{selectedScoreDetail.analysisMetadata.detectionMetadata.drift_percentage}%</strong></div>
                            <div>Sensitivity: <strong>{selectedScoreDetail.analysisMetadata.detectionMetadata.sensitivity}</strong></div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ color: '#8b949e', fontStyle: 'italic' }}>No analysis metadata available</p>
                    )}
                  </>
                ) : (
                  <>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold' }}>Scoring Ranges</h3>
                    {selectedScoreDetail.scores && selectedScoreDetail.scores.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #555' }}>
                        <thead style={{ backgroundColor: '#3a3a3a' }}>
                          <tr>
                            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #555', fontWeight: 'bold' }}>Score</th>
                            <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #555', fontWeight: 'bold' }}>Min Value</th>
                            <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #555', fontWeight: 'bold' }}>Max Value</th>
                            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #555', fontWeight: 'bold' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedScoreDetail.scores
                            .sort((a, b) => (a.minValue === null ? 1 : b.minValue === null ? -1 : a.minValue - b.minValue))
                            .map((rule, idx) => {
                              const isMatched = selectedScoreDetail.numericValue != null
                                && selectedScoreDetail.numericValue >= rule.minValue
                                && selectedScoreDetail.numericValue <= rule.maxValue;
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #444', backgroundColor: isMatched ? '#3a3a2a' : 'transparent' }}>
                                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{rule.score}</td>
                                  <td style={{ padding: '10px', textAlign: 'right' }}>{rule.minValue}</td>
                                  <td style={{ padding: '10px', textAlign: 'right' }}>{rule.maxValue}</td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    {isMatched ? (
                                      <span style={{ padding: '3px 8px', borderRadius: '3px', backgroundColor: '#1a3a1a', color: '#44dd44', fontSize: '11px', fontWeight: 'bold' }}>✓ MATCHED</span>
                                    ) : (
                                      <span style={{ color: '#8b949e', fontSize: '11px' }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ color: '#8b949e', fontStyle: 'italic' }}>No scoring rules available</p>
                    )}
                  </>
                )}

                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                  <button
                    onClick={() => setSelectedScoreDetail(null)}
                    style={{ padding: '10px 20px', backgroundColor: '#38a3b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                    onMouseOver={e => e.target.style.backgroundColor = '#2a8a9f'}
                    onMouseOut={e => e.target.style.backgroundColor = '#38a3b8'}
                  >Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Event detail modal ── */}
      {selectedEventLog && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setSelectedEventLog(null)}
        >
          <div style={{
            backgroundColor: '#2d2d2d',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto',
            padding: '30px',
            width: '90%',
          }}
          onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>
                Event Details (ID: {selectedEventLog.eventLogId})
              </h2>
              <button
                onClick={() => setSelectedEventLog(null)}
                style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', padding: 0 }}
              >
                ✕
              </button>
            </div>

            {eventDetailsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>⌛ Loading details...</div>
            ) : (
              <>
                {/* Summary grid */}
                <div style={{
                  backgroundColor: '#353535',
                  padding: '15px',
                  borderRadius: '6px',
                  marginBottom: '20px',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px' }}>
                    <div><strong>Event Code:</strong> {selectedEventLog.eventCode}</div>
                    <div><strong>Description:</strong> {selectedEventLog.eventDescription}</div>
                    <div>
                      <strong>Risk Level:</strong>
                      <span style={{
                        marginLeft: '8px',
                        padding: '3px 8px',
                        borderRadius: '3px',
                        backgroundColor: getRiskColor(selectedEventLog.risk),
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '12px',
                      }}>
                        {getRiskLabel(selectedEventLog.risk)}
                      </span>
                    </div>
                    <div><strong>Cumulative Score:</strong> {selectedEventLog.cumulativeScore}</div>
                    <div><strong>Probability:</strong> {selectedEventLog.probability != null ? (selectedEventLog.probability * 100).toFixed(1) + '%' : 'N/A'}</div>
                    <div><strong>Analysis Window:</strong> {selectedEventLog.analysisWindowInMin} minutes</div>
                    <div><strong>Triggered At:</strong> {formatDate(selectedEventLog.triggeredAt)}</div>
                    <div><strong>Processing Time:</strong> {selectedEventLog.processingTimeMs != null ? selectedEventLog.processingTimeMs + ' ms' : 'N/A'}</div>
                  </div>
                </div>

                {/* Attribute details table */}
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>Attribute Details</h3>
                  {selectedEventLog.details && selectedEventLog.details.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', border: '1px solid #555' }}>
                      <thead style={{ backgroundColor: '#3a3a3a' }}>
                        <tr>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Attribute</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Code</th>
                          <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #555' }}>Value</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #555' }}>Score</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #555' }}>In Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedEventLog.details.map((detail, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #444' }}>
                            <td style={{ padding: '10px' }}>{detail.attributeName || 'Unknown'}</td>
                            <td style={{ padding: '10px', fontSize: '12px', color: '#8b949e' }}>{detail.attributeCode}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              {detail.numericValue != null ? `${Number(detail.numericValue).toFixed(2)} ${detail.attributeUnit || ''}` : 'N/A'}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600' }}>
                              <span
                                onClick={() => showScoreDetails(detail)}
                                style={{ cursor: 'pointer', color: '#66bbff', textDecoration: 'underline' }}
                                title="Click to see scoring ranges"
                              >
                                {detail.scoreContribution}
                              </span>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '3px',
                                backgroundColor: detail.withinRange === 'Y' ? '#1a3a1a' : '#3a1a1a',
                                color: detail.withinRange === 'Y' ? '#44dd44' : '#ff6666',
                                fontSize: '12px',
                                fontWeight: 'bold',
                              }}>
                                {detail.withinRange === 'Y' ? 'Yes' : 'No'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ color: '#8b949e', fontSize: '13px' }}>No attribute details available.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
