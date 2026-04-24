import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const C = {
  bg: '#0d1117',
  card: '#161b22',
  border: '#30363d',
  textPrimary: '#e6edf3',
  textMuted: '#8b949e',
  blue: '#388bfd',
  green: '#3fb950',
  red: '#da3633',
  orange: '#d29922',
};

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const DEFAULT_CENTER = [32.0853, 34.7818];

const markerIcon = L.divIcon({
  className: 'geo-point-pin',
  html: '<div style="width:12px;height:12px;border-radius:50%;background:#388bfd;border:2px solid white;"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function toPoints(coordsRaw) {
  try {
    let parsed = coordsRaw;
    while (typeof parsed === 'string') parsed = JSON.parse(parsed);

    let ring = parsed;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.type === 'Polygon') {
      ring = parsed.coordinates?.[0] ?? [];
    }
    if (Array.isArray(ring) && Array.isArray(ring[0]) && Array.isArray(ring[0][0])) {
      ring = ring[0];
    }

    if (!Array.isArray(ring)) return [];

    const points = ring
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map(([lon, lat]) => [Number(lat), Number(lon)])
      .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));

    if (points.length > 2) {
      const [fLat, fLon] = points[0];
      const [lLat, lLon] = points[points.length - 1];
      if (fLat === lLat && fLon === lLon) return points.slice(0, -1);
    }
    return points;
  } catch {
    return [];
  }
}

function toGeoJson(points) {
  if (!Array.isArray(points) || points.length < 3) return null;
  const ring = points.map(([lat, lon]) => [Number(lon.toFixed(7)), Number(lat.toFixed(7))]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return { type: 'Polygon', coordinates: [ring] };
}

function DrawEvents({ locked, onAddPoint }) {
  useMapEvents({
    click(e) {
      if (locked) return;
      onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function CustomerGeofenceRNPage() {
  const [customers, setCustomers] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [geofences, setGeofences] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [mapPoints, setMapPoints] = useState([]);
  const [closed, setClosed] = useState(false);
  const [showMarineOverlay, setShowMarineOverlay] = useState(true);

  const [form, setForm] = useState({
    customerId: '',
    entityTypeId: '',
    entityTypeAttributeId: '',
    geofenceName: '',
    description: '',
    active: 'Y',
  });

  const geoJson = useMemo(() => (closed ? toGeoJson(mapPoints) : null), [closed, mapPoints]);

  const filteredAttributes = useMemo(() => {
    const valid = attributes.filter((a) => (a.entityTypeAttributeCode || a.attributeCode));
    if (!form.entityTypeId) return valid;
    return valid.filter((a) => Number(a.entityTypeId) === Number(form.entityTypeId));
  }, [attributes, form.entityTypeId]);

  const filteredGeofences = useMemo(() => {
    const q = search.trim().toLowerCase();
    return geofences.filter((g) => {
      if (statusFilter !== 'all' && g.active !== statusFilter) return false;
      if (!q) return true;
      return (
        String(g.customerGeofenceCriteriaId).includes(q) ||
        (g.customerName || '').toLowerCase().includes(q) ||
        (g.geofenceName || '').toLowerCase().includes(q)
      );
    });
  }, [geofences, search, statusFilter]);

  const loadGeofences = useCallback(async (status) => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    const res = await fetch(`${BASE}/customergeofencecriteria${params.toString() ? `?${params.toString()}` : ''}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setGeofences(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, etRes, aRes] = await Promise.all([
          fetch(`${BASE}/customers`),
          fetch(`${BASE}/entitytypes`),
          fetch(`${BASE}/entitytypeattributes`),
        ]);
        if (cRes.ok) setCustomers(await cRes.json());
        if (etRes.ok) setEntityTypes(await etRes.json());
        if (aRes.ok) setAttributes(await aRes.json());
        await loadGeofences(statusFilter);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!BASE) return;
    loadGeofences(statusFilter).catch((e) => setError(String(e)));
  }, [statusFilter, loadGeofences]);

  function openCreate() {
    setEditingId(null);
    setForm({ customerId: '', entityTypeId: '', entityTypeAttributeId: '', geofenceName: '', description: '', active: 'Y' });
    setMapPoints([]);
    setClosed(false);
    setShowModal(true);
  }

  function openEdit(g) {
    setEditingId(g.customerGeofenceCriteriaId);
    const attr = attributes.find((a) => Number(a.entityTypeAttributeId) === Number(g.entityTypeAttributeId));
    setForm({
      customerId: String(g.customerId || ''),
      entityTypeId: attr?.entityTypeId ? String(attr.entityTypeId) : '',
      entityTypeAttributeId: g.entityTypeAttributeId ? String(g.entityTypeAttributeId) : '',
      geofenceName: g.geofenceName || '',
      description: g.description || '',
      active: g.active || 'Y',
    });
    const pts = toPoints(g.coordinates);
    setMapPoints(pts);
    setClosed(pts.length >= 3);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setMapPoints([]);
    setClosed(false);
    setError('');
  }

  async function save() {
    if (!form.customerId || !form.entityTypeAttributeId || !form.geofenceName.trim()) {
      setError('Customer, attribute, and geofence name are required.');
      return;
    }
    if (!geoJson) {
      setError('Draw and close a polygon first.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        customerId: Number(form.customerId),
        entityTypeAttributeId: Number(form.entityTypeAttributeId),
        geofenceName: form.geofenceName.trim(),
        geoType: 'Polygon',
        coordinates: JSON.stringify(geoJson),
        description: form.description,
        active: form.active,
      };

      const endpoint = editingId
        ? `${BASE}/customergeofencecriteria/${editingId}`
        : `${BASE}/customergeofencecriteria`;

      const res = await fetch(endpoint, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }

      await loadGeofences(statusFilter);
      closeModal();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this geofence?')) return;
    try {
      const res = await fetch(`${BASE}/customergeofencecriteria/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadGeofences(statusFilter);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.textPrimary }}>
      <div style={{ padding: '14px 16px', background: C.card, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🗺️ Geofences</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>Visual polygon drawing with GeoJSON output</div>
        </div>
        <button onClick={openCreate} style={{ border: 'none', borderRadius: 8, padding: '8px 12px', background: C.blue, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+ New</button>
      </div>

      {error && <div style={{ margin: '12px 16px', padding: '10px 12px', borderRadius: 8, background: '#3d1214', border: `1px solid ${C.red}`, color: '#ff9b9b' }}>{error}</div>}

      <div style={{ padding: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search geofence or customer...'
          style={{ minWidth: 260, flex: 1, background: C.card, border: `1px solid ${C.border}`, color: C.textPrimary, borderRadius: 8, padding: '8px 10px' }}
        />
        {['all', 'Y', 'N'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{ border: `1px solid ${statusFilter === s ? C.blue : C.border}`, background: statusFilter === s ? C.blue : C.card, color: '#fff', borderRadius: 14, padding: '6px 12px', cursor: 'pointer' }}>
            {s === 'all' ? 'All' : s === 'Y' ? 'Active' : 'Inactive'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 24, color: C.textMuted }}>Loading...</div>
      ) : (
        <div style={{ padding: '0 16px 16px' }}>
          {filteredGeofences.map((g) => (
            <div key={g.customerGeofenceCriteriaId} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{g.geofenceName || 'Unnamed Geofence'}</div>
                  <div style={{ color: C.textMuted, fontSize: 13 }}>{g.customerName} • {g.geoType}</div>
                </div>
                <span style={{ padding: '4px 8px', borderRadius: 10, background: g.active === 'Y' ? 'rgba(63,185,80,0.2)' : 'rgba(218,54,51,0.2)', color: g.active === 'Y' ? C.green : C.red, fontSize: 12, fontWeight: 700 }}>
                  {g.active === 'Y' ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => openEdit(g)} style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => remove(g.customerGeofenceCriteriaId)} style={{ border: `1px solid ${C.red}`, background: '#2d1212', color: '#ff9b9b', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
          {filteredGeofences.length === 0 && <div style={{ color: C.textMuted, textAlign: 'center', padding: 30 }}>No geofences found</div>}
        </div>
      )}

      {showModal && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(980px,95vw)', maxHeight: '92vh', overflow: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{editingId ? 'Edit Geofence' : 'Create Geofence'}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Customer *</div>
                <select value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))} style={{ width: '100%', background: C.bg, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8 }}>
                  <option value=''>Select customer</option>
                  {customers.map((c) => <option key={c.customerId} value={c.customerId}>{c.customerName}</option>)}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Geofence Name *</div>
                <input value={form.geofenceName} onChange={(e) => setForm((p) => ({ ...p, geofenceName: e.target.value }))} style={{ width: '100%', background: C.bg, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8 }} />
              </div>

              <div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Entity Type</div>
                <select value={form.entityTypeId} onChange={(e) => setForm((p) => ({ ...p, entityTypeId: e.target.value, entityTypeAttributeId: '' }))} style={{ width: '100%', background: C.bg, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8 }}>
                  <option value=''>All Entity Types</option>
                  {entityTypes.map((t) => <option key={t.entityTypeId} value={t.entityTypeId}>{t.entityTypeName}</option>)}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Entity Type Attribute *</div>
                <select value={form.entityTypeAttributeId} onChange={(e) => setForm((p) => ({ ...p, entityTypeAttributeId: e.target.value }))} style={{ width: '100%', background: C.bg, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8 }}>
                  <option value=''>Select attribute</option>
                  {filteredAttributes.map((a) => (
                    <option key={a.entityTypeAttributeId} value={a.entityTypeAttributeId}>
                      {(a.entityTypeAttributeCode || a.attributeCode)} - {(a.entityTypeAttributeName || a.attributeName || '')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type='checkbox' checked={showMarineOverlay} onChange={(e) => setShowMarineOverlay(e.target.checked)} />
                <span>Marine chart overlay (OpenTopoMap)</span>
              </label>
              <button onClick={() => { if (mapPoints.length >= 3) setClosed(true); }} style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Close Polygon</button>
              <button onClick={() => { if (closed) setClosed(false); else setMapPoints((p) => p.slice(0, -1)); }} style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Undo</button>
              <button onClick={() => { setMapPoints([]); setClosed(false); }} style={{ border: `1px solid ${C.red}`, background: '#2d1212', color: '#ff9b9b', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Clear</button>
              <span style={{ color: C.orange, fontSize: 12 }}>Vertices: {mapPoints.length} • Closed: {closed ? 'Yes' : 'No'}</span>
            </div>

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
              <MapContainer center={mapPoints[0] || DEFAULT_CENTER} zoom={12} style={{ height: 360, width: '100%' }}>
                <TileLayer url='https://tile.openstreetmap.org/{z}/{x}/{y}.png' maxZoom={19} />
                {showMarineOverlay && <TileLayer url='https://a.tile.opentopomap.org/{z}/{x}/{y}.png' maxZoom={17} opacity={0.55} />}
                <DrawEvents locked={closed} onAddPoint={(p) => setMapPoints((prev) => [...prev, p])} />
                {mapPoints.map((p, i) => <Marker key={`${p[0]}-${p[1]}-${i}`} position={p} icon={markerIcon} />)}
                {!closed && mapPoints.length >= 2 && <Polyline positions={mapPoints} pathOptions={{ color: C.blue, weight: 3, dashArray: '6,6' }} />}
                {closed && mapPoints.length >= 3 && <Polygon positions={mapPoints} pathOptions={{ color: C.blue, weight: 3, fillColor: C.blue, fillOpacity: 0.3 }} />}
              </MapContainer>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>GeoJSON Polygon Output</div>
              <textarea readOnly value={geoJson ? JSON.stringify(geoJson, null, 2) : 'Draw and close polygon to generate GeoJSON'} style={{ width: '100%', minHeight: 110, background: '#0b0f14', color: C.green, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, fontFamily: 'Consolas, monospace' }} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Description</div>
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={{ width: '100%', minHeight: 65, background: C.bg, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type='checkbox' checked={form.active === 'Y'} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked ? 'Y' : 'N' }))} />
                <span>Active</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={closeModal} style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={save} disabled={saving} style={{ border: 'none', background: C.green, color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
