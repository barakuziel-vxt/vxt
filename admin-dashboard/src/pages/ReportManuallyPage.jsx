/**
 * ReportManuallyPage — shared "Report Manually" form.
 *
 * Runs in two contexts:
 *   1. Admin-dashboard (PC): sends payload to POST /api/manual-report using
 *      the gateway config saved to localStorage by GatewayConfigPage.
 *   2. Mobile WebView (embedded=true): sends payload via ReactNativeWebView
 *      postMessage → ReportManuallyRN.tsx handles routing by data source type.
 */
import React, { useState, useEffect } from 'react';
import '../styles/ManagementPage.css';
import { bridgeRequest, waitForBridge } from '../utils/bridge';

// ─── Embedded / driver detection ─────────────────────────────────────────────
const IS_EMBEDDED = (() => {
  try {
    return new URLSearchParams(window.location.search).get('embedded') === 'true';
  } catch { return false; }
})();

// ─── Base URL ────────────────────────────────────────────────────────────────
function getBaseUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const dsType = params.get('dsType'), cloudUrl = params.get('cloudUrl'), localUrl = params.get('localUrl');
    if (dsType && cloudUrl && localUrl) {
      const url = dsType === 'cloud' ? cloudUrl : localUrl;
      return url.endsWith('/') ? url.slice(0, -1) : url;
    }
  } catch (e) { /* ignore */ }
  return import.meta.env.VITE_API_BASE_URL ?? '';
}

// ─── Gateway config from localStorage (PC mode only) ─────────────────────────
function loadGatewayConfig() {
  try {
    const raw = localStorage.getItem('vxt_gateway_config');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReportManuallyPage() {
  const BASE = getBaseUrl();

  const [entities, setEntities]               = useState([]);
  const [allAttributes, setAllAttributes]     = useState([]);
  const [filteredAttrs, setFilteredAttrs]     = useState([]);

  const [selectedEntity,    setSelectedEntity]    = useState('');
  const [selectedEntityTypeId, setSelectedEntityTypeId] = useState(null);
  const [selectedAttrId,    setSelectedAttrId]    = useState('');
  const [selectedAttr,      setSelectedAttr]      = useState(null);
  const [value,             setValue]             = useState('');
  const [timestamp,         setTimestamp]         = useState(() => toLocalISOString(new Date()));

  const [loading,   setLoading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState(null);
  const [success,   setSuccess]   = useState(null);

  // ── Load entities ───────────────────────────────────────────────────────
  useEffect(() => {
    loadEntities();
    loadAllAttributes();
  }, []);

  async function loadEntities() {
    setLoading(true);
    try {
      let data;
      if (IS_EMBEDDED) {
        data = await bridgeRequest('loadEntities');
      } else {
        const res = await fetch(`${BASE}/entities`);
        data = res.ok ? await res.json() : [];
      }
      setEntities(data ?? []);
    } catch (e) {
      setError('Failed to load entities: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllAttributes() {
    try {
      let data;
      if (IS_EMBEDDED) {
        data = await bridgeRequest('loadAttributes');
      } else {
        const res = await fetch(`${BASE}/entitytypeattributes`);
        data = res.ok ? await res.json() : [];
      }
      setAllAttributes(data ?? []);
    } catch (e) {
      console.warn('Failed to load attributes:', e);
    }
  }

  // ── Filter attributes when entity changes ──────────────────────────────
  useEffect(() => {
    if (!selectedEntity) {
      setFilteredAttrs([]);
      setSelectedAttrId('');
      setSelectedAttr(null);
      setSelectedEntityTypeId(null);
      return;
    }
    const entity = entities.find(e => String(e.entityId) === String(selectedEntity));
    const typeId = entity?.entityTypeId ?? null;
    setSelectedEntityTypeId(typeId);
    const filtered = typeId
      ? allAttributes.filter(a => a.entityTypeId === typeId && a.active !== 'N')
      : allAttributes;
    setFilteredAttrs(filtered);
    setSelectedAttrId('');
    setSelectedAttr(null);
  }, [selectedEntity, entities, allAttributes]);

  // ── Update selected attr unit when attribute selection changes ─────────
  useEffect(() => {
    if (!selectedAttrId) { setSelectedAttr(null); return; }
    const attr = filteredAttrs.find(a => String(a.entityTypeAttributeId) === String(selectedAttrId));
    setSelectedAttr(attr ?? null);
  }, [selectedAttrId, filteredAttrs]);

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedEntity || !selectedAttrId || value === '') {
      setError('Please fill in Entity, Attribute, and Value.');
      return;
    }

    const attr = filteredAttrs.find(a => String(a.entityTypeAttributeId) === String(selectedAttrId));
    if (!attr) { setError('Selected attribute not found.'); return; }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) { setError('Value must be a number.'); return; }

    const payload = {
      entityId:                  selectedEntity,
      entityTypeAttributeCode:   attr.entityTypeAttributeCode,
      entityTypeAttributeId:     attr.entityTypeAttributeId,
      value:                     numValue,
      timestamp:                 new Date(timestamp).toISOString(),
      source:                    'Manual',
    };

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (IS_EMBEDDED) {
        // Mobile: send to RN bridge; bridge connects IoT Hub and publishes
        const result = await bridgeRequest('submitManualReport', payload);
        if (result?.error) throw new Error(result.error);
        setSuccess('Report submitted!');
      } else {
        // PC: send via backend API using saved gateway config
        const gwConfig = loadGatewayConfig();
        if (!gwConfig) {
          setError('No gateway configured. Please visit Gateway Configuration first.');
          return;
        }
        const res = await fetch(`${BASE}/api/manual-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, gatewayType: gwConfig.type, ...gwConfig }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.detail ?? 'Submission failed');
        setSuccess(`Report submitted to ${gwConfig.type === 'kafka' ? 'Kafka' : 'Azure IoT Hub'}!`);
      }
      // Reset value after successful submit
      setValue('');
      setTimestamp(toLocalISOString(new Date()));
    } catch (ex) {
      setError('Submission failed: ' + (ex.message ?? String(ex)));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const embedded = IS_EMBEDDED;

  return (
    <div
      className="management-page"
      style={embedded ? { padding: 0, margin: 0, borderRadius: 0, boxShadow: 'none', background: '#0d1117', minHeight: '100vh' } : undefined}
    >
      {/* Header (PC only — mobile has its own native header) */}
      {!embedded && (
        <div className="page-header">
          <h2>📝 Report Manually</h2>
        </div>
      )}

      {!embedded && (
        <p style={{ color: '#8b949e', marginBottom: 16, fontSize: 13 }}>
          Submit a manual telemetry measurement to the configured gateway.
          Configure the gateway destination in{' '}
          <span
            style={{ color: '#388bfd', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => {
              // Trigger parent to navigate to gatewayConfig
              window.dispatchEvent(new CustomEvent('vxt:navigate', { detail: 'gatewayConfig' }));
            }}
          >
            Gateway Configuration
          </span>.
        </p>
      )}

      {/* Feedback */}
      {error   && <div className="error-message"   style={embedded ? { margin: '4px', borderRadius: 0 } : undefined}>{error}</div>}
      {success && (
        <div style={{ background: 'rgba(63, 185, 80, 0.1)', border: '1px solid #3fb950', borderRadius: 6, padding: '8px 12px', color: '#3fb950', marginBottom: 12, fontSize: 13 }}>
          ✅ {success}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ padding: embedded ? '4px' : 0 }}>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: embedded ? 8 : 10,
          padding: embedded ? 4 : 12,
          maxWidth: embedded ? undefined : 480,
          background: embedded ? 'transparent' : '#161b22',
          borderRadius: embedded ? 0 : 6,
        }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: embedded ? 11 : 12, fontWeight: 600, color: '#aaa' }}>Entity</label>
            <select
              value={selectedEntity}
              onChange={e => { setSelectedEntity(e.target.value); setError(null); }}
              disabled={loading || submitting}
              required
              style={{ width: '100%', padding: embedded ? '6px 8px' : '8px 10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 4, fontSize: embedded ? 12 : 13 }}
            >
              <option value="">-- Select Entity --</option>
              {entities.map(e => (
                <option key={e.entityId} value={e.entityId}>
                  {e.entityFirstName || e.entityName || e.entityId}{e.entityLastName ? ' ' + e.entityLastName : ''} ({e.entityId})
                </option>
              ))}
            </select>
          </div>

          {/* ── Attribute Name ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: embedded ? 11 : 12, fontWeight: 600, color: '#aaa' }}>Attribute Name</label>
            <select
              value={selectedAttrId}
              onChange={e => { setSelectedAttrId(e.target.value); setError(null); }}
              disabled={!selectedEntity || filteredAttrs.length === 0 || submitting}
              required
              style={{ width: '100%', padding: embedded ? '6px 8px' : '8px 10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 4, fontSize: embedded ? 12 : 13 }}
            >
              <option value="">-- Select Attribute --</option>
              {filteredAttrs.map(a => (
                <option key={a.entityTypeAttributeId} value={a.entityTypeAttributeId}>
                  {a.entityTypeAttributeName} ({a.entityTypeAttributeCode})
                </option>
              ))}
            </select>
          </div>

          {/* ── Unit (read-only) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: embedded ? 11 : 12, fontWeight: 600, color: '#aaa' }}>Unit</label>
            <div style={{
              padding: embedded ? '6px 8px' : '7px 10px',
              backgroundColor: '#0d1117',
              color: selectedAttr?.entityTypeAttributeUnit ? '#e6edf3' : '#555',
              border: '1px solid #30363d',
              borderRadius: 4,
              fontSize: embedded ? 12 : 13,
              minHeight: embedded ? 28 : 32,
            }}>
              {selectedAttr?.entityTypeAttributeUnit || '—'}
            </div>
          </div>

          {/* ── Value ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: embedded ? 11 : 12, fontWeight: 600, color: '#aaa' }}>
              Measurement Value{selectedAttr?.entityTypeAttributeUnit ? ` (${selectedAttr.entityTypeAttributeUnit})` : ''}
            </label>
            <input
              type="number"
              step="any"
              value={value}
              onChange={e => { setValue(e.target.value); setError(null); }}
              disabled={submitting}
              required
              placeholder="Enter numeric value"
              style={{ width: '100%', padding: embedded ? '6px 8px' : '7px 10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 4, fontSize: embedded ? 12 : 13, boxSizing: 'border-box' }}
            />
          </div>

          {/* ── Timestamp ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: embedded ? 11 : 12, fontWeight: 600, color: '#aaa' }}>Measurement Timestamp</label>
            <input
              type="datetime-local"
              value={timestamp}
              onChange={e => setTimestamp(e.target.value)}
              disabled={submitting}
              style={{ width: '100%', padding: embedded ? '6px 8px' : '7px 10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 4, fontSize: embedded ? 12 : 13, boxSizing: 'border-box' }}
            />
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={submitting || !selectedEntity || !selectedAttrId || value === ''}
            style={{
              padding: embedded ? '8px 12px' : '9px 20px',
              backgroundColor: submitting ? '#444' : '#3fb950',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: (submitting || !selectedEntity || !selectedAttrId || value === '') ? 'not-allowed' : 'pointer',
              fontSize: embedded ? 13 : 14,
              fontWeight: 600,
              opacity: (submitting || !selectedEntity || !selectedAttrId || value === '') ? 0.6 : 1,
              marginTop: 2,
              alignSelf: 'flex-start',
            }}
          >
            {submitting ? '⏳ Submitting…' : '📤 Submit Report'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function toLocalISOString(date) {
  const y   = date.getFullYear();
  const mo  = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const h   = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${min}`;
}
