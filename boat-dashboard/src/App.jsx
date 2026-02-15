import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// helper: format timestamp for charts (local date+time)
function formatTs(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  let dt;
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    dt = new Date(ms);
  } else {
    // If string timestamp from database (UTC), add 'Z' if missing so JavaScript parses as UTC
    const str = String(raw);
    const utcStr = (str.includes('T') && !str.endsWith('Z')) ? str + 'Z' : str;
    dt = new Date(utcStr);
  }
  if (!isNaN(dt)) {
    // Convert UTC to local time
    return dt.toLocaleString();
  }
  return String(raw).replace(/\.\d+(?=Z|$)/, '');
}

export default function App() {
  const [data, setData] = useState([]);
  const [telemetryByMmsi, setTelemetryByMmsi] = useState({});
  const [loadingAll, setLoadingAll] = useState(false);
  const [customerProps, setCustomerProps] = useState([]);
  const [selectedMmsi, setSelectedMmsi] = useState('ALL');
  // Live toggle with persistence
  const [live, setLive] = useState(() => {
    try { return localStorage.getItem('live') !== '0'; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem('live', live ? '1' : '0'); } catch {} }, [live]);

  const CUSTOMER_NAME = 'Sailor'; // change if you want dynamic customer

  useEffect(() => {
    async function loadCustomerProperties() {
      try {
        const res = await fetch(`http://192.168.1.29:8000/customers/${encodeURIComponent(CUSTOMER_NAME)}/properties`);
        if (!res.ok) {
          console.error('Failed to load properties:', await res.text());
          return;
        }
        const list = await res.json();
        setCustomerProps(list);
        // default to ALL and load telemetry for all properties (use list directly to avoid state race)
        if (list.length) {
          setSelectedMmsi('ALL');
          fetchTelemetry('ALL', 50, list);
        }
      } catch (err) {
        console.error('loadCustomerProperties error:', err);
      }
    }
    loadCustomerProperties();
  }, [CUSTOMER_NAME]);

  // fetch telemetry for a single mmsi or for ALL customer properties
  // optional third parameter propsList used to avoid waiting on state update
  async function fetchTelemetry(mmsi, limit = 50, propsList = null) {
    try {
      if (mmsi === 'ALL') {
        setLoadingAll(true);
        const result = {};
        const propsToUse = Array.isArray(propsList) ? propsList : (customerProps || []);
        const mmsis = propsToUse.map(p => p.mmsi ?? p.IMONumber ?? p.imo ?? '').filter(Boolean);
        console.debug('Fetching telemetry for ALL MMSIs:', mmsis);
        await Promise.all(mmsis.map(async (m) => {
          if (!m) return;
          try {
            const res = await fetch(`http://192.168.1.32:8000/telemetry/${encodeURIComponent(m)}?limit=${limit}`);
            result[m] = res.ok ? await res.json() : [];
          } catch {
            result[m] = [];
          }
        }));
        setTelemetryByMmsi(result);
        // set main data to first property's telemetry for backward compatibility
        const firstArr = Object.values(result)[0] || [];
        setData(firstArr);
        setLoadingAll(false);
      } else {
        const res = await fetch(`http://192.168.1.32:8000/telemetry/${encodeURIComponent(mmsi)}?limit=${limit}`);
        if (!res.ok) {
          console.error('telemetry fetch failed:', await res.text());
          setData([]);
          setTelemetryByMmsi(prev => ({ ...prev, [mmsi]: [] }));
          return;
        }
        const json = await res.json();
        setData(json);
        setTelemetryByMmsi(prev => ({ ...prev, [mmsi]: json }));
      }
    } catch (err) {
      console.error('fetchTelemetry error', err);
      if (mmsi === 'ALL') setTelemetryByMmsi({});
      else setTelemetryByMmsi(prev => ({ ...prev, [mmsi]: [] }));
      if (mmsi === 'ALL') setLoadingAll(false);
      setData([]);
    }
  }

  // Called when user selects a different boat
  function onSelectMmsi(e) {
    const mmsi = e.target.value;
    setSelectedMmsi(mmsi);
    if (mmsi) fetchTelemetry(mmsi);
  }

  const latest = (Array.isArray(data) && data.length > 0) ? data[data.length - 1] : { rpm: 0, temp: 0, speed: 0, batteryVoltage: 0, latitude: 0, longitude: 0, BoatName: 'Unknown Boat' };
  const position = (typeof latest.latitude === 'number' && typeof latest.longitude === 'number') ? [latest.latitude, latest.longitude] : null;

  // find selected property object for header display
  const selectedProperty = (Array.isArray(customerProps) ? customerProps : []).find(p => {
    const m = p.mmsi ?? p.IMONumber ?? p.imo ?? '';
    return m === selectedMmsi;
  });

  // create DivIcon that displays the boat name as the marker (pointer style)
  const boatIcon = useMemo(() => {
    const name = String(latest?.BoatName ?? 'Unknown Boat').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return new DivIcon({
      html: `<div class="boat-marker">
               <span class="boat-name">${name}</span>
               <span class="boat-pointer" aria-hidden="true"></span>
             </div>`,
      className: 'boat-marker-container',
      iconSize: null
    });
  }, [latest?.BoatName]);

  const markerRef = useRef(null);
  const fetchingAllRef = useRef(false);

  // Markers for ALL view: compute latest fix per MMSI and a DivIcon per property
  const allMarkers = useMemo(() => {
    return Object.entries(telemetryByMmsi).map(([m, arr]) => {
      const last = Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
      if (!last || typeof last.latitude !== 'number' || typeof last.longitude !== 'number') return null;
      const name = (customerProps.find(p => (p.mmsi ?? p.IMONumber ?? p.imo ?? '') === m)?.customerPropertyName) || m;
      const icon = new DivIcon({
        html: `<div class="boat-marker"><span class="boat-name">${String(name).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span><span class="boat-pointer" aria-hidden="true"></span></div>`,
        className: 'boat-marker-container',
        iconSize: null
      });
      return { m, name, position: [last.latitude, last.longitude], icon, latest: last };
    }).filter(Boolean);
  }, [telemetryByMmsi, customerProps]);

  const firstAllPosition = (allMarkers && allMarkers.length) ? allMarkers[0].position : null;

  const isAnomaly = latest?.anomaly === true || latest?.isAnomaly === true || latest?.status === 'anomaly';
  // debug
  useEffect(() => { console.debug('latest telemetry', latest, 'isAnomaly=', isAnomaly); }, [latest, isAnomaly]);

  // Unified lightweight polling for selected MMSIs (single or ALL). Polls each MMSI's latest point every 2s.
  // Updates telemetryByMmsi only when a new point arrives. When a single MMSI is selected, also update
  // the main `data` and move the marker directly for smooth updates without flicker.
  useEffect(() => {
    if (!selectedMmsi) return;
    if (selectedMmsi === 'ALL' && !customerProps.length) return;

    let cancelled = false;
    const poll = async () => {
      if (fetchingAllRef.current) return;
      fetchingAllRef.current = true;
      try {
        const mmsis = (selectedMmsi === 'ALL')
          ? customerProps.map(p => p.mmsi ?? p.IMONumber ?? p.imo ?? '').filter(Boolean)
          : [selectedMmsi];

        await Promise.all(mmsis.map(async (m) => {
          if (!m) return;
          try {
            const res = await fetch(`http://192.168.1.32:8000/telemetry/${encodeURIComponent(m)}?limit=1`);
            if (!res.ok) return;
            const arr = await res.json();
            if (!Array.isArray(arr) || arr.length === 0) return;
            const pt = arr[arr.length - 1];

            // update per-MMSI series only if timestamp differs
            setTelemetryByMmsi(prev => {
              const cur = Array.isArray(prev[m]) ? prev[m] : [];
              const lastTs = cur.length ? String(cur[cur.length - 1].timestamp ?? cur[cur.length - 1].ts ?? '') : '';
              const ptTs = String(pt.timestamp ?? pt.ts ?? pt.time ?? '');
              if (ptTs === lastTs) return prev;
              const next = [...cur, pt].slice(-50);
              return { ...prev, [m]: next };
            });

            // if single MMSI selected, update main data and marker
            if (selectedMmsi !== 'ALL' && m === selectedMmsi) {
              setData(prev => {
                const cur = Array.isArray(prev) ? prev : [];
                const lastTs = cur.length ? String(cur[cur.length - 1].timestamp ?? cur[cur.length - 1].ts ?? '') : '';
                const ptTs = String(pt.timestamp ?? pt.ts ?? pt.time ?? '');
                if (ptTs === lastTs) return prev;
                return [...cur, pt].slice(-50);
              });
              if (markerRef.current && pt.latitude && pt.longitude) {
                try { markerRef.current.setLatLng([pt.latitude, pt.longitude]); } catch (e) { /* ignore */ }
              }
            }

          } catch (err) {
            // ignore specific MMSI failures
          }
        }));
      } finally {
        fetchingAllRef.current = false;
      }
    };

    if (!live) return; // skip polling when Live is disabled
    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); fetchingAllRef.current = false; };
  }, [selectedMmsi, customerProps, live]);

  // round speed & batteryVoltage to 1 decimal, temp to integer
  const chartData = Array.isArray(data)
    ? data.map(d => ({
        ...d,
        speed: typeof d.speed === 'number' ? Number(d.speed.toFixed(1)) : d.speed,
        batteryVoltage: typeof d.batteryVoltage === 'number' ? Number(d.batteryVoltage.toFixed(1)) : d.batteryVoltage,
        temp: typeof d.temp === 'number' ? Math.round(d.temp) : d.temp,
      }))
    : [];

  // normalize timestamp field for X axis (telemetry might use 'ts', 'time' or other)
  const formatTs = (raw) => {
    if (raw === null || raw === undefined || raw === '') return '';
    // Normalize numeric seconds -> milliseconds (common server formats)
    let dt;
    if (typeof raw === 'number') {
      const ms = raw < 1e12 ? raw * 1000 : raw;
      dt = new Date(ms);
    } else {
      // If string timestamp from database (UTC), add 'Z' if missing so JavaScript parses as UTC
      const str = String(raw);
      const utcStr = (str.includes('T') && !str.endsWith('Z')) ? str + 'Z' : str;
      dt = new Date(utcStr);
    }
    if (!isNaN(dt)) {
      // Convert UTC to local time
      return dt.toLocaleString();
    }
    // fallback: strip milliseconds from ISO-like strings
    return String(raw).replace(/\.\d+(?=Z|$)/, '');
  };

  const chartDataWithTs = chartData.map(d => ({
    ...d,
    chartTs: formatTs(d.ts ?? d.time ?? d.timestamp ?? d.timeStamp ?? ''),
  }));

  return (
    <div className="app-root">
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', marginBottom: '0px', padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, color: '#38bdf8' }}>
            {latest.customerName}
            <span style={{ fontSize: '0.5em', color: '#94a3b8', marginLeft: 8 }}>v1.1</span>
          </h1>

          <select
            value={selectedMmsi}
            onChange={(e) => {
              const m = e.target.value;
              setSelectedMmsi(m);
              if (m === 'ALL') {
                // pass customerProps to avoid stale-state race
                fetchTelemetry('ALL', 50, customerProps);
              } else if (m) {
                fetchTelemetry(m);
              }
            }}
            style={{
              marginLeft: 8,
              padding: '4px 10px',
              borderRadius: 6,
              background: '#0b1220',
              color: '#38bdf8',       // match header customerName color
              fontSize: '1.25rem',    // larger font like the header
              fontWeight: 600,
              lineHeight: 1,
              border: '1px solid #334155',
              width: '180px',
              maxWidth: '40vw',
              boxSizing: 'border-box',
            }}
          >
            <option value="ALL">All boats</option>
            {customerProps.map(p => {
              const m = p.mmsi ?? p.IMONumber ?? p.imo ?? '';
              return <option key={m || p.customerPropertyName} value={m}>{p.customerPropertyName}</option>;
            })}
          </select>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8, color: '#94a3b8', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            <span style={{ marginLeft: 4 }}>Live</span>
          </label>

        </div>
      </header>

      <div style={{ height: '200px', width: '100%', marginTop: '0', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#1e293b' }}>
        {/* Map will show tiles even if position is not yet available; zoom out when unknown */}
        <MapContainer center={position ?? [0, 0]} zoom={position ? 13 : 2} style={{ height: '200px', width: '100%' }} scrollWheelZoom>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {/* Recenter + markers: single selection shows single boat, ALL shows all property markers */}
          {selectedMmsi === 'ALL' ? (
            <>
              {allMarkers.length > 0 && <FitBounds positions={allMarkers.map(a => a.position)} />}
              {allMarkers.map(({ m, name, position: pos, icon, latest }) => (
                <Marker key={m || name} position={pos} icon={icon}>
                  <Popup>
                    {name} <br />
                    Lat: {latest.latitude?.toFixed(4)} <br />
                    Lon: {latest.longitude?.toFixed(4)}
                  </Popup>
                </Marker>
              ))}
            </>
          ) : (
            <>
              {position && <RecenterOnFirstFix position={position} />}
              {position && <Marker ref={markerRef} position={position} icon={boatIcon}>
                <Popup>
                  Yacht Location <br />
                  Lat: {latest.latitude?.toFixed(4)} <br />
                  Lon: {latest.longitude?.toFixed(4)}
                </Popup>
              </Marker>}
            </>
          )}
        </MapContainer>
        {!position && <div style={{ padding: 12 }}>No GPS position available</div>}
      </div>
 
      {/* Stats: if ALL selected show stacked per-property stats, otherwise show single latest */}
      {selectedMmsi === 'ALL' ? (
        loadingAll ? <div style={{ padding: 12, color: '#94a3b8' }}>Loading telemetry for all boats...</div> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 0 }}>
          {customerProps.map(p => {
            const m = p.mmsi ?? p.IMONumber ?? p.imo ?? ''; 
            const arr = telemetryByMmsi[m] || [];
            const lt = Array.isArray(arr) && arr.length ? arr[arr.length - 1] : { speed: 0, rpm: 0, temp: 0, batteryVoltage: 0 };
            return (<PropertyPanel key={m || p.customerPropertyName} title={p.customerPropertyName} mmsi={m} telemetry={arr} />);
           })}
         </div>
       ) : (
         <PropertyPanel title={selectedProperty?.customerPropertyName ?? latest.BoatName} mmsi={selectedMmsi} telemetry={data} />
       )}
    </div>
  );
}

// Sub-component for the little boxes
function StatCard({ title, value, unit, color }) {
  return (
    <div style={{ backgroundColor: '#1e293b', padding: '8px', borderRadius: '8px', borderLeft: `3px solid ${color}`, border: '1px solid #334155' }}>
      <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: '700', margin: '6px 0', color: color }}>
        {value} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#94a3b8' }}>{unit}</span>
      </div>
    </div>
  );
}

// Recenter the map on the first valid fix only (won't interrupt user if they've already panned)
function RecenterOnFirstFix({ position, targetZoom = 13 }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    const center = map.getCenter();
    // Only recenter if map still at default world view or very zoomed out
    if ((center.lat === 0 && center.lng === 0) || map.getZoom() < 3) {
      map.setView(position, targetZoom, { animate: true });
    }
  }, [position, map, targetZoom]);
  return null;
}

// new: fit map bounds to an array of positions
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!Array.isArray(positions) || positions.length === 0) return;
    const latlngs = positions.filter(Boolean);
    if (latlngs.length === 0) return;
    try {
      map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 13 });
    } catch {
      // ignore fitBounds errors
    }
  }, [map, positions]);
  return null;
}

// Reusable panel that shows stats + chart for a property (used for single and ALL)
function PropertyPanel({ title, mmsi, telemetry }) {
  const arr = Array.isArray(telemetry) ? telemetry : [];
  const lt = arr.length ? arr[arr.length - 1] : { speed: 0, rpm: 0, temp: 0, batteryVoltage: 0 };
  const isAnomalyLocal = lt?.anomaly === true || lt?.isAnomaly === true || lt?.status === 'anomaly';
  return (
    <div style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 8, border: '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
        <div style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem' }}>{title}{mmsi ? ` (${mmsi})` : ''}</div>
        <div style={{ padding: '4px 10px', borderRadius: 12, backgroundColor: isAnomalyLocal ? '#7f1d1d' : '#064e3b', color: isAnomalyLocal ? '#fca5a5' : '#6ee7b7', fontWeight: 700, fontSize: '0.75rem' }}>
          {isAnomalyLocal ? 'ANOMALY' : 'HEALTHY'}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '6px' }}>
        <StatCard title="Speed" value={(lt.speed ?? 0).toFixed(1)} unit="kn" color="#41b922" />
        <StatCard title="Engine RPM" value={(lt.rpm ?? 0).toFixed(0)} unit="RPM" color="#bb4c99" />
        <StatCard title="Engine Temp" value={(lt.temp ?? 0).toFixed(1)} unit="°C" color="#ff7300" />
        <StatCard title="Battery" value={(lt.batteryVoltage ?? 0).toFixed(1)} unit="V" color="#38bdf8" />
      </div>
      <div style={{ width: '100%', height: 132, marginTop: 6 }}>
        {arr.length > 0 ? (
          (() => {
            const arrWithTs = arr.map(e => ({ ...e, chartTs: formatTs(e.ts ?? e.time ?? e.timestamp ?? e.timeStamp ?? '') }));
            return (
              <ResponsiveContainer>
                <LineChart data={arrWithTs} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="chartTs" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                    labelStyle={{ color: '#94a3b8' }}
                    // Add a clear title for the timestamp label in the tooltip
                    labelFormatter={(label) => `Time: ${label}`}
                    formatter={(value, name) => {
                      // Show 1 decimal for batteryVoltage, speed, and temp in tooltip
                      if (name === 'batteryVoltage' || name === 'speed' || name === 'temp') {
                        return (typeof value === 'number') ? value.toFixed(1) : value;
                      }
                      // Default: rpm as integer if numeric
                      if (typeof value === 'number') return Number(value.toFixed(0));
                      return value;
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="rpm" stroke="#bb4c99" dot={false} strokeWidth={1} />
                  <Line type="monotone" dataKey="batteryVoltage" stroke="#38a3b8" dot={false} strokeWidth={1} />
                  <Line type="monotone" dataKey="speed" stroke="#41b922" dot={false} strokeWidth={1} />
                  <Line type="monotone" dataKey="temp" stroke="#ff7300" dot={false} strokeWidth={1} />
                </LineChart>
              </ResponsiveContainer>
            );
          })()
        ) : (
          <div style={{ padding: 8, color: '#94a3b8' }}>No telemetry</div>
        )}
      </div>
    </div>
  );
}