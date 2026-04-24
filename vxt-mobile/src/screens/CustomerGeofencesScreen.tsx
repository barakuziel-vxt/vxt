import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

import { DrawerContext } from '../context/DrawerContext';
import { loadDataSource } from '../hooks/useDataSource';

type LatLng = { latitude: number; longitude: number };

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

type ActiveFlag = 'Y' | 'N';

type Customer = {
  customerId: number;
  customerName: string;
};

type EntityType = {
  entityTypeId: number;
  entityTypeName: string;
};

type EntityTypeAttribute = {
  entityTypeAttributeId: number;
  entityTypeId: number;
  entityTypeAttributeCode?: string;
  attributeCode?: string;
  entityTypeAttributeName?: string;
  attributeName?: string;
};

type Geofence = {
  customerGeofenceCriteriaId: number;
  customerId: number;
  customerName: string;
  entityTypeAttributeId: number | null;
  geofenceName: string;
  geoType: string;
  coordinates: unknown;
  description?: string;
  active: ActiveFlag;
};

type FormState = {
  customerId: string;
  entityTypeId: string;
  entityTypeAttributeId: string;
  geofenceName: string;
  geoType: 'Polygon';
  geoJson: string;
  description: string;
  active: ActiveFlag;
};

const DEFAULT_REGION = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const EMPTY_FORM: FormState = {
  customerId: '',
  entityTypeId: '',
  entityTypeAttributeId: '',
  geofenceName: '',
  geoType: 'Polygon',
  geoJson: '',
  description: '',
  active: 'Y',
};

function safeParseJson(value: unknown): unknown {
  let parsed: unknown = value;
  while (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    if (!trimmed) return null;
    parsed = JSON.parse(trimmed);
  }
  return parsed;
}

function toLatLngPoints(input: unknown): LatLng[] {
  try {
    const parsed = safeParseJson(input);
    let ring: unknown = parsed;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const candidate = parsed as { type?: unknown; coordinates?: unknown };
      if (candidate.type === 'Polygon' && Array.isArray(candidate.coordinates)) {
        ring = candidate.coordinates[0];
      }
    }

    if (Array.isArray(ring) && Array.isArray(ring[0]) && Array.isArray((ring[0] as unknown[])[0])) {
      ring = (ring[0] as unknown[]);
    }

    if (!Array.isArray(ring)) return [];

    const points: LatLng[] = [];
    for (const pair of ring) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const lon = Number(pair[0]);
      const lat = Number(pair[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        points.push({ latitude: lat, longitude: lon });
      }
    }

    if (points.length > 2) {
      const first = points[0];
      const last = points[points.length - 1];
      if (first.latitude === last.latitude && first.longitude === last.longitude) {
        return points.slice(0, -1);
      }
    }

    return points;
  } catch {
    return [];
  }
}

function buildGeoJsonPolygon(points: LatLng[]): { type: 'Polygon'; coordinates: number[][][] } | null {
  if (points.length < 3) return null;

  const ring: number[][] = points.map((p) => [Number(p.longitude.toFixed(7)), Number(p.latitude.toFixed(7))]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

function computeRegionFromPoints(points: LatLng[]) {
  if (points.length === 0) return DEFAULT_REGION;

  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.8),
    longitudeDelta: Math.max(0.02, (maxLon - minLon) * 1.8),
  };
}

// Safely encode data for injection via injectJavaScript — escapes </script> and similar
function safeJson(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

type EditorData = {
  customers: Customer[];
  entityTypes: EntityType[];
  attributes: EntityTypeAttribute[];
  pts: LatLng[];
  closed: boolean;
  editingId: number | null;
  customerId: string;
  entityTypeId: string;
  entityTypeAttributeId: string;
  geofenceName: string;
  description: string;
  active: string;
  showMarine: boolean;
  centerLat: number;
  centerLng: number;
};

// Static HTML — no data baked in. Data is injected via window.initApp() after onLoadEnd.
const EDITOR_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:-apple-system,system-ui,sans-serif;font-size:14px}
.sec{padding:14px}.field{margin-bottom:11px}
.lbl{display:block;font-size:11px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
select,input[type=text],textarea{width:100%;padding:10px 12px;border:1px solid #30363d;border-radius:8px;background:#0d1117;color:#e6edf3;font-size:14px;-webkit-appearance:none;appearance:none;outline:none}
select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%238b949e' d='M8 11L2 5h12z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;background-size:12px;padding-right:30px}
textarea{resize:none}
.row{display:flex;align-items:center;justify-content:space-between;padding:7px 0}
.toggle{position:relative;display:inline-block;width:46px;height:26px;flex-shrink:0}
.toggle input{opacity:0;width:0;height:0}
.slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#30363d;border-radius:13px;transition:.2s}
.slider:before{position:absolute;content:'';height:20px;width:20px;left:3px;bottom:3px;background:white;border-radius:50%;transition:.2s}
.toggle input:checked+.slider{background:#3fb950}.toggle input:checked+.slider:before{transform:translateX(20px)}
.divider{height:1px;background:#21262d}.hint{font-size:11px;color:#8b949e;padding:6px 14px 4px}
#map{width:100%;height:280px;background:#1c2128;display:block}
.leaflet-container{position:relative;overflow:hidden}
.leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-pane>svg,.leaflet-pane>canvas,.leaflet-zoom-box,.leaflet-image-layer,.leaflet-layer{position:absolute;left:0;top:0}
.leaflet-tile-pane{z-index:200}.leaflet-overlay-pane{z-index:400}.leaflet-shadow-pane{z-index:500}.leaflet-marker-pane{z-index:600}.leaflet-popup-pane{z-index:700}.leaflet-map-pane canvas{z-index:100}.leaflet-map-pane svg{z-index:200}
.leaflet-tile{visibility:hidden;pointer-events:none}.leaflet-tile-loaded{visibility:inherit}
.leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}.leaflet-top{top:0}.leaflet-bottom{bottom:0}.leaflet-left{left:0}.leaflet-right{right:0}
.leaflet-control{float:left;clear:both;pointer-events:auto}.leaflet-control-attribution{display:none}
#mbar{display:flex;align-items:center;background:#161b22;padding:8px 14px;gap:8px;border-top:1px solid #30363d;border-bottom:1px solid #30363d;flex-wrap:wrap}
#mst{flex:1;min-width:80px;font-size:12px;color:#8b949e}
.mc{border:none;border-radius:6px;padding:8px 12px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.mc:disabled{opacity:.3;pointer-events:none}.mc-c{background:#238636}.mc-u{background:#388bfd}.mc-x{background:#da3633}
#gjpre{font-family:monospace;font-size:11px;min-height:52px;color:#8b949e}
#acts{display:flex;gap:10px;padding:14px 14px 24px}
#bc{flex:1;padding:13px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;border-radius:9px;font-size:15px;font-weight:600;cursor:pointer}
#bs{flex:2;padding:13px;background:#238636;border:none;color:#fff;border-radius:9px;font-size:15px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent}
#bs:disabled{opacity:.5}
</style>
</head>
<body>
<div class="sec">
  <div class="field"><label class="lbl">Customer *</label><select id="cid"><option value="">Loading...</option></select></div>
  <div class="field"><label class="lbl">Geofence Name *</label><input type="text" id="fn" placeholder="e.g. Port Zone A"></div>
  <div class="field"><label class="lbl">Entity Type</label><select id="eid"><option value="">Loading...</option></select></div>
  <div class="field"><label class="lbl">Entity Attribute *</label><select id="aid"><option value="">Loading...</option></select></div>
  <div class="row"><span class="lbl" style="margin:0">&#127754; Marine Overlay</span><label class="toggle"><input type="checkbox" id="mi" checked><span class="slider"></span></label></div>
</div>
<div class="divider"></div>
<p class="hint">Tap map to place polygon vertices</p>
<div id="map"></div>
<div id="mbar">
  <span id="mst">Loading...</span>
  <button type="button" class="mc mc-c" id="bco" disabled>&#10003; Close</button>
  <button type="button" class="mc mc-u" id="bun" disabled>&#8617; Undo</button>
  <button type="button" class="mc mc-x" id="bcl" disabled>&#10005; Clear</button>
</div>
<div class="sec">
  <div class="field"><label class="lbl">GeoJSON Output</label><textarea id="gjpre" rows="3" readonly placeholder="Draw and close polygon first"></textarea></div>
  <div class="field"><label class="lbl">Description</label><textarea id="de" rows="2" placeholder="Optional notes"></textarea></div>
  <div class="row"><span class="lbl" style="margin:0">Active</span><label class="toggle"><input type="checkbox" id="ac" checked><span class="slider"></span></label></div>
</div>
<div id="acts"><button type="button" id="bc">Cancel</button><button type="button" id="bs">Create Geofence</button></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
var map, dg, ml, pts=[], polyClosed=false, BTN='Create Geofence';

window.initApp = function(d) {
  try {
    BTN = d.editingId ? 'Update Geofence' : 'Create Geofence';
    document.getElementById('bs').textContent = BTN;
    pts = d.pts || [];
    polyClosed = !!d.closed;

    var cs = document.getElementById('cid');
    cs.innerHTML = '<option value="">Select customer...</option>';
    (d.customers || []).forEach(function(c) {
      var o = document.createElement('option');
      o.value = c.customerId; o.textContent = c.customerName;
      if (String(c.customerId) === d.customerId) o.selected = true;
      cs.appendChild(o);
    });

    var es = document.getElementById('eid');
    es.innerHTML = '<option value="">All entity types</option>';
    (d.entityTypes || []).forEach(function(e) {
      var o = document.createElement('option');
      o.value = e.entityTypeId; o.textContent = e.entityTypeName;
      if (String(e.entityTypeId) === d.entityTypeId) o.selected = true;
      es.appendChild(o);
    });

    function fillAttrs(fid) {
      var el = document.getElementById('aid');
      el.innerHTML = '<option value="">Select attribute...</option>';
      (d.attributes || []).filter(function(a) {
        return (a.entityTypeAttributeCode || a.attributeCode) &&
               (!fid || String(a.entityTypeId) === String(fid));
      }).forEach(function(a) {
        var o = document.createElement('option');
        o.value = a.entityTypeAttributeId;
        o.textContent = (a.entityTypeAttributeCode || a.attributeCode || 'Attr') + ' - ' +
                        (a.entityTypeAttributeName || a.attributeName || '');
        if (String(a.entityTypeAttributeId) === d.entityTypeAttributeId) o.selected = true;
        el.appendChild(o);
      });
    }
    fillAttrs(d.entityTypeId);
    es.addEventListener('change', function() { fillAttrs(this.value); });

    document.getElementById('fn').value = d.geofenceName || '';
    document.getElementById('de').value = d.description || '';
    document.getElementById('ac').checked = d.active !== 'N';
    document.getElementById('mi').checked = !!d.showMarine;

    if (typeof L === 'undefined') {
      document.getElementById('mst').textContent = 'Map failed to load — check internet';
      return;
    }
    map = L.map('map', {center:[d.centerLat, d.centerLng], zoom:12, attributionControl:false, tap:false});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);
    ml = L.tileLayer('https://a.tile.opentopomap.org/{z}/{x}/{y}.png', {maxZoom:17, opacity:0.6});
    if (d.showMarine) ml.addTo(map);
    document.getElementById('mi').addEventListener('change', function() {
      if (this.checked) ml.addTo(map); else { try { map.removeLayer(ml); } catch(e) {} }
    });
    dg = L.layerGroup().addTo(map);
    if (pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts.map(function(p){return[p.latitude,p.longitude];})),{padding:[30,30]});
    }
    draw();
    setTimeout(function(){map.invalidateSize(true);}, 200);
    setTimeout(function(){map.invalidateSize(true);}, 600);

    map.on('click', function(e) { if (polyClosed) return; pts.push({latitude:e.latlng.lat,longitude:e.latlng.lng}); draw(); });

    function addTap(id, fn) {
      var el = document.getElementById(id);
      el.addEventListener('touchstart', function(e) {
        e.preventDefault(); e.stopPropagation();
        if (!el.disabled) fn();
      }, { passive: false });
      el.addEventListener('touchend', function(e) {
        e.preventDefault(); e.stopPropagation();
      }, { passive: false });
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!el.disabled) fn();
      });
    }
    addTap('bco', function() { if (!polyClosed && pts.length>=3) { polyClosed=true; draw(); } });
    addTap('bun', function() { if (polyClosed) { polyClosed=false; } else if (pts.length>0) { pts.pop(); } draw(); });
    addTap('bcl', function() { pts=[]; polyClosed=false; dg.clearLayers(); ui(); });

    document.getElementById('bc').addEventListener('click', function() {
      try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'cancel'})); } catch(e) {}
    });
    document.getElementById('bs').addEventListener('click', function() {
      var cid = document.getElementById('cid').value;
      var nm  = document.getElementById('fn').value.trim();
      var aid = document.getElementById('aid').value;
      var errs = [];
      if (!cid) errs.push('Customer is required.');
      if (!nm)  errs.push('Geofence name is required.');
      if (!aid) errs.push('Entity type attribute is required.');
      if (!polyClosed || pts.length < 3) errs.push('Draw and close a polygon first.');
      if (errs.length) { alert(errs.join('\\n')); return; }
      var gj = buildGJ();
      var payload = {
        type:'save',
        customerId: parseInt(cid, 10),
        entityTypeAttributeId: parseInt(aid, 10),
        geofenceName: nm,
        coordinates: JSON.stringify(gj),
        description: document.getElementById('de').value,
        active: document.getElementById('ac').checked ? 'Y' : 'N'
      };
      document.getElementById('bs').disabled = true;
      document.getElementById('bs').textContent = 'Saving...';
      try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch(e) {}
    });
  } catch(e) {
    document.getElementById('mst').textContent = 'Init error: ' + e.message;
  }
};

function buildGJ() {
  if (pts.length < 3) return null;
  var r = pts.map(function(p){return[parseFloat(p.longitude.toFixed(7)),parseFloat(p.latitude.toFixed(7))];});
  r.push([r[0][0], r[0][1]]);
  return {type:'Polygon', coordinates:[r]};
}
function ui() {
  if (!map) return;
  var s = document.getElementById('mst');
  if (polyClosed) s.textContent = 'Closed \u2014 ' + pts.length + ' vertices';
  else if (pts.length === 0) s.textContent = 'Tap map to add vertices';
  else s.textContent = pts.length + (pts.length===1?' vertex':' vertices') + ' \u2014 add more or close';
  document.getElementById('bco').disabled = (polyClosed || pts.length < 3);
  document.getElementById('bun').disabled = (pts.length===0 && !polyClosed);
  document.getElementById('bcl').disabled = pts.length===0;
  var gj = polyClosed ? buildGJ() : null;
  document.getElementById('gjpre').value = gj ? JSON.stringify(gj,null,2) : '';
  try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'pts',count:pts.length,closed:polyClosed})); } catch(e) {}
}
function draw() {
  if (!dg) return;
  dg.clearLayers();
  pts.forEach(function(p){L.circleMarker([p.latitude,p.longitude],{radius:7,color:'#fff',fillColor:'#388bfd',fillOpacity:1,weight:2}).addTo(dg);});
  if (pts.length >= 2) {
    var ll = pts.map(function(p){return[p.latitude,p.longitude];});
    if (polyClosed && pts.length>=3) { L.polygon(ll,{color:'#388bfd',weight:3,fillColor:'#388bfd',fillOpacity:0.28}).addTo(dg); }
    else { L.polyline(ll,{color:'#388bfd',weight:3,dashArray:'8,8'}).addTo(dg); }
  }
  ui();
}
window.onSaveError = function() { var b=document.getElementById('bs'); if(b){b.disabled=false;b.textContent=BTN;} };
</script>
</body>
</html>`;

export default function CustomerGeofencesScreen() {
  const { openDrawer } = useContext(DrawerContext);

  const webViewRef = useRef<WebView>(null);
  const [editorPayload, setEditorPayload] = useState('');
  const [modalKey, setModalKey] = useState(0);

  const [baseUrl, setBaseUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [attributes, setAttributes] = useState<EntityTypeAttribute[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ActiveFlag>('all');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const refreshGeofences = useCallback(async (apiBase: string, status: 'all' | ActiveFlag) => {
    const params = new URLSearchParams();
    if (status !== 'all') params.append('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${apiBase}/customergeofencecriteria${qs}`);
    if (!res.ok) throw new Error(`Failed geofence fetch: HTTP ${res.status}`);
    const data = (await res.json()) as Geofence[];
    setGeofences(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ds = await loadDataSource();
        if (!ds.baseUrl) {
          Alert.alert('Configuration required', 'Please configure API Endpoints first.');
          return;
        }
        setBaseUrl(ds.baseUrl);

        const [customerRes, typeRes, attrRes] = await Promise.all([
          fetch(`${ds.baseUrl}/customers`),
          fetch(`${ds.baseUrl}/entitytypes`),
          fetch(`${ds.baseUrl}/entitytypeattributes`),
        ]);

        if (customerRes.ok) {
          setCustomers((await customerRes.json()) as Customer[]);
        }
        if (typeRes.ok) {
          setEntityTypes((await typeRes.json()) as EntityType[]);
        }
        if (attrRes.ok) {
          setAttributes((await attrRes.json()) as EntityTypeAttribute[]);
        }

        await refreshGeofences(ds.baseUrl, statusFilter);
      } catch (err: any) {
        Alert.alert('Load error', err.message || 'Failed to load geofence data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!baseUrl) return;
    refreshGeofences(baseUrl, statusFilter).catch((err: any) => {
      Alert.alert('Load error', err.message || 'Failed to load geofences');
    });
  }, [statusFilter, baseUrl, refreshGeofences]);

  const filteredGeofences = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return geofences;
    return geofences.filter((g) => {
      return (
        g.customerName?.toLowerCase().includes(query) ||
        g.geofenceName?.toLowerCase().includes(query) ||
        String(g.customerGeofenceCriteriaId).includes(query)
      );
    });
  }, [geofences, search]);

  function openCreateModal() {
    setEditingId(null);
    const cl = DEFAULT_REGION.latitude;
    const cn = DEFAULT_REGION.longitude;
    setEditorPayload(safeJson({
      customers, entityTypes, attributes,
      pts: [], closed: false, editingId: null,
      customerId: '', entityTypeId: '', entityTypeAttributeId: '',
      geofenceName: '', description: '', active: 'Y', showMarine: true,
      centerLat: cl, centerLng: cn,
    } as EditorData));
    setModalKey((k) => k + 1);
    setModalVisible(true);
  }

  function openEditModal(item: Geofence) {
    const points = toLatLngPoints(item.coordinates);
    let linkedEntityTypeId = '';
    if (item.entityTypeAttributeId) {
      const attr = attributes.find((a) => Number(a.entityTypeAttributeId) === Number(item.entityTypeAttributeId));
      if (attr?.entityTypeId != null) linkedEntityTypeId = String(attr.entityTypeId);
    }
    const centerLat = points.length > 0 ? points.reduce((s, p) => s + p.latitude, 0) / points.length : DEFAULT_REGION.latitude;
    const centerLng = points.length > 0 ? points.reduce((s, p) => s + p.longitude, 0) / points.length : DEFAULT_REGION.longitude;
    setEditingId(item.customerGeofenceCriteriaId);
    setEditorPayload(safeJson({
      customers, entityTypes, attributes,
      pts: points, closed: points.length >= 3,
      editingId: item.customerGeofenceCriteriaId,
      customerId: String(item.customerId),
      entityTypeId: linkedEntityTypeId,
      entityTypeAttributeId: item.entityTypeAttributeId ? String(item.entityTypeAttributeId) : '',
      geofenceName: item.geofenceName || '',
      description: item.description || '',
      active: item.active || 'Y',
      showMarine: true,
      centerLat, centerLng,
    } as EditorData));
    setModalKey((k) => k + 1);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditingId(null);
  }

  const handleWebViewLoad = useCallback(() => {
    if (editorPayload) {
      webViewRef.current?.injectJavaScript(`window.initApp(${editorPayload}); true;`);
    }
  }, [editorPayload]);

  async function handleWebViewMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { type: string; [k: string]: unknown };
      if (msg.type === 'cancel') {
        closeModal();
      } else if (msg.type === 'save') {
        setSaving(true);
        try {
          const endpoint = editingId
            ? `${baseUrl}/customergeofencecriteria/${editingId}`
            : `${baseUrl}/customergeofencecriteria`;
          const res = await fetch(endpoint, {
            method: editingId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: msg.customerId,
              entityTypeAttributeId: msg.entityTypeAttributeId,
              geofenceName: msg.geofenceName,
              geoType: 'Polygon',
              coordinates: msg.coordinates,
              description: msg.description,
              active: msg.active,
            }),
          });
          if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try { const body = await res.json(); if (body?.detail) detail = String(body.detail); } catch {}
            throw new Error(detail);
          }
          await refreshGeofences(baseUrl, statusFilter);
          closeModal();
        } catch (err: any) {
          Alert.alert('Save failed', err.message || 'Could not save geofence');
          webViewRef.current?.injectJavaScript('window.onSaveError && window.onSaveError(); true;');
        } finally {
          setSaving(false);
        }
      }
    } catch {
      // ignore malformed messages
    }
  }

  function removeGeofence(item: Geofence) {
    Alert.alert(
      'Delete Geofence',
      `Delete geofence "${item.geofenceName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!baseUrl) return;
            try {
              const res = await fetch(`${baseUrl}/customergeofencecriteria/${item.customerGeofenceCriteriaId}`, {
                method: 'DELETE',
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              await refreshGeofences(baseUrl, statusFilter);
            } catch (err: any) {
              Alert.alert('Delete failed', err.message || 'Could not delete geofence');
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuBtnFloating}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <ActivityIndicator size="large" color={C.blue} />
        <Text style={styles.loadingTxt}>Loading geofences...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>🗺️ Geofences</Text>
          <Text style={styles.subtitle}>Draw polygons visually and store as GeoJSON</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
          <Text style={styles.addBtnText}>＋ New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer or geofence..."
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterBtnRow}>
        {(['all', 'Y', 'N'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterBtn, statusFilter === s && styles.filterBtnActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterBtnText, statusFilter === s && styles.filterBtnTextActive]}>
              {s === 'all' ? 'All' : s === 'Y' ? 'Active' : 'Inactive'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredGeofences}
        keyExtractor={(item) => String(item.customerGeofenceCriteriaId)}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.geofenceName || 'Unnamed Geofence'}</Text>
                <Text style={styles.cardSub}>{item.customerName}</Text>
                <Text style={styles.cardSub}>Type: {item.geoType || 'Polygon'}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: item.active === 'Y' ? C.green + '22' : C.red + '22' },
                ]}
              >
                <Text style={[styles.statusText, { color: item.active === 'Y' ? C.green : C.red }]}>
                  {item.active === 'Y' ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardSub}>ID: {item.customerGeofenceCriteriaId}</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openEditModal(item)}>
                  <Text style={styles.iconBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => removeGeofence(item)}>
                  <Text style={styles.iconBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 48 }]}>No geofences found</Text>
        }
      />

      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalScreen}>
          <View style={styles.modalBar}>
            <Text style={styles.modalTitle}>{editingId ? '✏️ Edit Geofence' : '＋ New Geofence'}</Text>
            <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <WebView
            key={modalKey}
            ref={webViewRef}
            style={{ flex: 1 }}
            source={{ html: EDITOR_HTML, baseUrl: 'https://unpkg.com' }}
            onLoadEnd={handleWebViewLoad}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            mixedContentMode="always"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loadingRoot: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTxt: { marginTop: 10, color: C.textMuted, fontSize: 14 },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuBtnFloating: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: C.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuBtnText: { fontSize: 22, color: C.textPrimary },
  title: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.blue,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  searchInput: {
    backgroundColor: C.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: C.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
  },

  filterBtnRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterBtnActive: { backgroundColor: C.blue, borderColor: C.blue },
  filterBtnText: { fontSize: 13, color: C.textMuted },
  filterBtnTextActive: { color: '#fff', fontWeight: '600' },

  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  cardSub: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  iconBtnText: { fontSize: 16 },

  modalScreen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  modalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: C.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
    marginLeft: 12,
  },
  modalCloseBtnText: {
    fontSize: 20,
    color: C.textMuted,
  },
});
