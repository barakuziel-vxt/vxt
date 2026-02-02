import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://192.168.1.32:8000'; // use Vite's import.meta.env (set VITE_API_BASE in .env)
const CUSTOMER_NAME = 'SLMEDICAL';

function formatTs(raw) {
  if (!raw && raw !== 0) return '';
  let dt;
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    dt = new Date(ms);
  } else dt = new Date(String(raw));
  if (!isNaN(dt)) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
  }
  return String(raw).replace(/\.\d+(?=Z|$)/, '');
}

export default function App() {
  const [customerProps, setCustomerProps] = useState([]);
  const [selectedId, setSelectedId] = useState('ALL');
  const [dataById, setDataById] = useState({});
  const [data, setData] = useState([]);
  const [live, setLive] = useState(true);

  useEffect(() => {
    async function loadProps() {
      try {
        const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(CUSTOMER_NAME)}/properties`);
        if (!res.ok) return;
        const list = await res.json();
        setCustomerProps(list);
        if (list.length) {
          setSelectedId('ALL');
          fetchHealth('ALL', 50, list);
        }
      } catch (e) { console.error(e); }
    }
    loadProps();
  }, []);

  async function fetchHealth(id, limit = 50, propsList = null) {
    try {
      if (id === 'ALL') {
        const props = Array.isArray(propsList) ? propsList : customerProps;
        const result = {};
        await Promise.all(props.map(async (p) => {
          const uid = p.mmsi ?? '';
          if (!uid) return;
          try { const r = await fetch(`${API_BASE}/health/${encodeURIComponent(uid)}?limit=${limit}`); result[uid] = r.ok ? await r.json() : []; } catch { result[uid] = []; }
        }));
        setDataById(result);
        setData(Object.values(result)[0] || []);
      } else {
        const r = await fetch(`${API_BASE}/health/${encodeURIComponent(id)}?limit=${limit}`);
        if (!r.ok) { setData([]); setDataById(prev => ({ ...prev, [id]: [] })); return; }
        const json = await r.json();
        setData(json);
        setDataById(prev => ({ ...prev, [id]: json }));
      }
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (!selectedId) return;
    const poll = async () => {
      if (selectedId === 'ALL') return;
      try {
        const r = await fetch(`${API_BASE}/health/${encodeURIComponent(selectedId)}?limit=1`);
        if (!r.ok) return;
        const arr = await r.json();
        if (!Array.isArray(arr) || !arr.length) return;
        const pt = arr[arr.length - 1];
        setData(prev => {
          const lastTs = prev.length ? String(prev[prev.length - 1].timestamp ?? '') : '';
          const ptTs = String(pt.timestamp ?? '');
          if (ptTs === lastTs) return prev;
          return [...prev, pt].slice(-100);
        });
      } catch (e) { }
    };
    if (!live) return;
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [selectedId, live]);

  const latest = data.length ? data[data.length - 1] : {};
  const position = (typeof latest.latitude === 'number' && typeof latest.longitude === 'number') ? [latest.latitude, latest.longitude] : null;

  // color map used to style metric values. Prefer the chart palette when the key appears in numericKeys.
  const metricColorForKey = (k) => {
    const key = (k || '').toLowerCase();
    const palette = ["#ff7300","#38a3b8","#41b922","#bb4c99","#ff4d4d","#8884d8"];
    // If numericKeys contains this metric, use the same color index as the chart
    if (Array.isArray(numericKeys)) {
      const normalizedKey = key.replace(/[^a-z0-9]/g, '');
      const idx = numericKeys.findIndex(nk => {
        const nkNorm = String(nk).toLowerCase().replace(/[^a-z0-9]/g, '');
        return nkNorm === normalizedKey || nk.toLowerCase().includes(normalizedKey) || normalizedKey.includes(nkNorm);
      });
      if (idx >= 0) return palette[idx % palette.length];
    }

    // fallback explicit map for common keys
    const map = {
      'avghr': '#ff7300', 'avg_hr': '#ff7300', 'maxhr': '#ff7300', 'minhr': '#ff7300', 'restinghr': '#ff7300',
      'hrv_rmssd': '#bb4c99', 'bodytemp': '#ff4d4d', 'systolic': '#38a3b8', 'diastolic': '#41b922',
      'oxygensat': '#8884d8', 'avgglucose': '#8884d8', 'breathspermin': '#41b922'
    };
    for (const pattern in map) if (key.includes(pattern)) return map[pattern];
    return '#ffffff';
  };

  // dynamic numeric keys to chart (exclude id/startTime/endTime/deviceName/timestamp/loadedAt)
  const numericKeys = useMemo(() => {
    const keys = new Set();
    const exclude = new Set(['id','starttime','endtime','devicename','timestamp','loadedat']);
    data.forEach(d => {
      Object.entries(d).forEach(([k, v]) => {
        const kl = k.toLowerCase();
        if (exclude.has(kl)) return;
        if (v !== null && v !== undefined && !Number.isNaN(Number(v)) && typeof v !== 'string') keys.add(k);
        else if (!Number.isNaN(Number(v))) keys.add(k);
      });
    });
    return Array.from(keys);
  }, [data]);

  const chartData = data.map(d => ({ ...d, chartTs: formatTs(d.Timestamp ?? d.timestamp ?? '') }));
  const chartDataRounded = chartData.map(d => {
    const nd = { ...d };
    // round specific metrics to one decimal if present
    ['avghr','maxhr','minhr','restinghr','hrv_rmssd','bodytemp','systolic','diastolic'].forEach(keyLow => {
      const matchingKey = Object.keys(nd).find(k => k.toLowerCase() === keyLow);
      if (matchingKey) {
        const val = Number(nd[matchingKey]);
        if (!Number.isNaN(val)) nd[matchingKey] = Number(val.toFixed(1));
      }
    });
    // coerce numeric-looking fields to numbers so charts render correctly
    Object.keys(nd).forEach(k => {
      if (k === 'chartTs') return;
      const num = Number(nd[k]);
      if (!Number.isNaN(num)) nd[k] = num;
    });
    return nd;
  });

  return (
    <div className="health-root">
      <header className="header">
        <h1>{latest.customerName ?? CUSTOMER_NAME} <small>Health dashboard</small></h1>
        <div className="controls">
          <select value={selectedId} onChange={(e) => { const v = e.target.value; setSelectedId(v); if (v === 'ALL') fetchHealth('ALL', 50); else fetchHealth(v, 50); }}>
            <option value="ALL">All patients</option>
            {customerProps.map(p => <option key={p.mmsi} value={p.mmsi}>{p.customerPropertyName}</option>)}
          </select>
          <label><input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} /> Live</label>
        </div>
      </header>



      { /* helper to format displayed metric values */ }
      <div className="metrics">
        {Object.entries(latest)
          .filter(([k]) => k && k.toLowerCase() !== 'customername' && k.toLowerCase() !== 'loadedat')
          .map(([k, v]) => {
            const displayValue = (key, val) => {
              if (val === null || val === undefined) return '—';
              const keyLow = key.toLowerCase();
              // timestamp/startTime/endTime: remove milliseconds and show local datetime
              if (keyLow === 'timestamp' || keyLow === 'starttime' || keyLow === 'endtime') {
                // If val is a Date use it directly; if string convert it to Date so local tz values are used
                const d = (val instanceof Date) ? val : new Date(String(val));
                if (!Number.isNaN(d.getTime())) {
                  const pad = (n) => String(n).padStart(2, '0');
                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                }
                // fallback: strip fractional seconds from string values
                return String(val).replace(/\.\d+(?=Z|$)/, '');
              }
              if (['avghr','maxhr','minhr','restinghr','hrv_rmssd','bodytemp','systolic','diastolic'].includes(keyLow)) {
                const n = Number(val);
                return Number.isNaN(n) ? String(val) : n.toFixed(1);
              }
              return (typeof val === 'number') ? String(val) : String(val);
            };
            return (
              <div key={k} className="metric-card">
                <div className="metric-key">{k}</div>
                <div className="metric-val" style={{ color: metricColorForKey(k), fontFamily: 'Inter, Arial, sans-serif' }}>{displayValue(k, v)}</div>
              </div>
            );
          })}
      </div>

      <div className="chart">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartDataRounded} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="#ccc" strokeDasharray="3 3" />
              <XAxis dataKey="chartTs" />
              <YAxis />
              <Tooltip />
              <Legend />
              {numericKeys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={["#ff7300","#38a3b8","#41b922","#bb4c99","#ff4d4d","#8884d8"][i % 6]} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : <div style={{padding:12}}>No data</div>}
      </div>
    </div>
  );
}
