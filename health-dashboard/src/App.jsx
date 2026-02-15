import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://192.168.1.29:8000'; // use Vite's import.meta.env (set VITE_API_BASE in .env)
const CUSTOMER_NAME = 'SLMEDICAL';

function formatTs(raw) {
  if (!raw && raw !== 0) return '';
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
          fetchHealth('ALL', 500, list);
        }
      } catch (e) { console.error(e); }
    }
    loadProps();
  }, []);

  async function fetchHealth(id, limit = 500, propsList = null) {
    try {
      if (id === 'ALL') {
        const props = Array.isArray(propsList) ? propsList : customerProps;
        const result = {};
        await Promise.all(props.map(async (p) => {
          const uid = p.entityId ?? '';
          if (!uid) return;
          try {
            const r = await fetch(`${API_BASE}/health/new/${encodeURIComponent(uid)}?limit=${limit}`);
            if (!r.ok) {
              // fallback to previously cached values for this uid if present
              result[uid] = dataById[uid] || [];
              return;
            }
            const json = await r.json();
            let arr = [];
            // handle APIs or proxies that wrap arrays in { value: [...] }
            if (Array.isArray(json)) arr = json;
            else if (json && Array.isArray(json.value)) arr = json.value;
            else arr = [];
            result[uid] = arr;
          } catch (e) {
            result[uid] = dataById[uid] || [];
          }
        }));
        setDataById(result);
        // Combine all patients' arrays, sort by timestamp (parseable values) and keep the latest `limit` records overall
        const combined = Object.values(result).flat().filter(Boolean);
        combined.sort((a, b) => {
          const ta = Date.parse(String(a.timestamp ?? a.Timestamp ?? '')) || 0;
          const tb = Date.parse(String(b.timestamp ?? b.Timestamp ?? '')) || 0;
          return ta - tb;
        });
        // Avoid overwriting existing UI with empty results caused by transient fetch failures
        if (combined.length) setData(combined.slice(-limit));
      } else {
        const r = await fetch(`${API_BASE}/health/new/${encodeURIComponent(id)}?limit=${limit * 2}`);
        if (!r.ok) { setData([]); setDataById(prev => ({ ...prev, [id]: [] })); return; }
        const json = await r.json();
        // Sort single patient data by timestamp in ascending order
        const arr = Array.isArray(json) ? json : (json && Array.isArray(json.value) ? json.value : []);
        arr.sort((a, b) => {
          const ta = Date.parse(String(a.timestamp ?? a.Timestamp ?? '')) || 0;
          const tb = Date.parse(String(b.timestamp ?? b.Timestamp ?? '')) || 0;
          return ta - tb;
        });
        setData(arr);
        setDataById(prev => ({ ...prev, [id]: arr }));
      }
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (!selectedId) return;
    const poll = async () => {
      if (selectedId === 'ALL') {
        // refresh all patients when viewing 'All' to keep dashboard updated
        try { await fetchHealth('ALL', 500); } catch (e) { /* ignore */ }
        return;
      }
      try {
        const r = await fetch(`${API_BASE}/health/new/${encodeURIComponent(selectedId)}?limit=1`);
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
    // use a slightly longer interval to reduce transient flicker when any per-patient fetch fails
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [selectedId, live]);

  const latest = data.length ? data[data.length - 1] : {};
  const position = (typeof latest.latitude === 'number' && typeof latest.longitude === 'number') ? [latest.latitude, latest.longitude] : null;

  // color map used to style metric values. Use color palette based on position in numericKeys
  const metricColorForKey = (k) => {
    const palette = ["#ff7300","#38a3b8","#41b922","#bb4c99","#ff4d4d","#8884d8"];
    if (Array.isArray(numericKeys)) {
      const idx = numericKeys.findIndex(nk => nk.toLowerCase() === k.toLowerCase());
      if (idx >= 0) return palette[idx % palette.length];
    }
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
    // round all numeric metrics to one decimal and coerce to numbers for chart rendering
    Object.keys(nd).forEach(k => {
      if (k === 'chartTs') return;
      const num = Number(nd[k]);
      if (!Number.isNaN(num)) nd[k] = Number(num.toFixed(1));
    });
    return nd;
  });

  return (
    <div className="health-root">
      <header className="header">
        <h1>{latest.customerName ?? CUSTOMER_NAME} <small>Health dashboard</small></h1>
        <div className="controls">
          <select value={selectedId} onChange={(e) => { const v = e.target.value; setSelectedId(v); if (v === 'ALL') fetchHealth('ALL', 500); else fetchHealth(v, 500); }}>
            <option value="ALL">All patients</option>
            {customerProps.map(p => <option key={p.entityId} value={p.entityId}>{p.customerPropertyName}</option>)}
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
                // If val is a Date use it directly; if string convert it to Date
                let d;
                if (val instanceof Date) {
                  d = val;
                } else {
                  // If string timestamp from database (UTC), add 'Z' if missing so JavaScript parses as UTC
                  const str = String(val);
                  const utcStr = (str.includes('T') && !str.endsWith('Z')) ? str + 'Z' : str;
                  d = new Date(utcStr);
                }
                if (!Number.isNaN(d.getTime())) {
                  const pad = (n) => String(n).padStart(2, '0');
                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                }
                // fallback: strip fractional seconds from string values
                return String(val).replace(/\.\d+(?=Z|$)/, '');
              }
              // For numeric values, format with one decimal place
              const n = Number(val);
              if (!Number.isNaN(n)) return n.toFixed(1);
              return String(val);
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
