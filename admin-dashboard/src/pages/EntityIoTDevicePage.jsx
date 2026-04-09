/**
 * EntityIoTDevicePage — RN-style IoT Device Management
 *
 * Mirrors the React Native mobile pattern (like EntityTelemetryRN):
 *   - Auto-filters by entityId when navigated from CustomerEntities
 *   - Device list with status chips
 *   - Twin preview modal
 *   - Push to Azure
 *   - Register New Device → navigates to RegisterDevicePage
 */
import React, { useState, useEffect } from 'react';
import '../styles/ManagementPage.css';
import { entityIoTDeviceAPI, twinAPI } from '../services/api';

// ─── Theme constants (matches EntityTelemetryRNPage) ─────────────────────────
const C = {
  bg: '#0d1117',
  card: '#161b22',
  border: '#30363d',
  textPrimary: '#e6edf3',
  textMuted: '#8b949e',
  accent: '#58a6ff',
  success: '#3fb950',
  successBg: '#0d2818',
  successBorder: '#238636',
  error: '#f85149',
  errorBg: '#3d1214',
  errorBorder: '#da3633',
  warn: '#d29922',
  warnBg: '#2d2006',
  warnBorder: '#bb8009',
};

const IS_EMBEDDED = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('embedded') === 'true';
  } catch { return false; }
})();

// ─── Component ───────────────────────────────────────────────────────────────
export default function EntityIoTDevicePage({ entityId: propEntityId, entityName: propEntityName }) {
  const entityId   = propEntityId   || '';
  const entityName = propEntityName || entityId;

  const [devices, setDevices]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  // Twin preview
  const [twinJson, setTwinJson]         = useState(null);
  const [twinLoading, setTwinLoading]   = useState(false);
  const [showTwinModal, setShowTwinModal] = useState(false);
  const [twinError, setTwinError]       = useState(null);

  // Push
  const [pushLoading, setPushLoading]   = useState(null); // holds deviceId being pushed
  const [pushMsg, setPushMsg]           = useState(null);

  useEffect(() => { loadDevices(); }, [entityId]);

  const loadDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = entityId
        ? await entityIoTDeviceAPI.getByEntityId(entityId)
        : await entityIoTDeviceAPI.getAll();
      setDevices(Array.isArray(data) ? data : [data].filter(Boolean));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this IoT device registration?')) return;
    try {
      await entityIoTDeviceAPI.delete(id);
      await loadDevices();
    } catch (err) { setError(err.message); }
  };

  const handlePreviewTwin = async (eId) => {
    setTwinLoading(true);
    setTwinError(null);
    setTwinJson(null);
    setShowTwinModal(true);
    try {
      const data = await twinAPI.preview(eId);
      setTwinJson(data);
    } catch (err) {
      setTwinError(err.response?.data?.detail || err.message);
    } finally { setTwinLoading(false); }
  };

  const handlePush = async (eId) => {
    setPushLoading(eId);
    setPushMsg(null);
    try {
      await twinAPI.pushToAzure(eId);
      setPushMsg({ type: 'success', text: `✓ Twin pushed for ${eId}` });
    } catch (err) {
      setPushMsg({ type: 'error', text: `Push failed: ${err.response?.data?.detail || err.message}` });
    } finally { setPushLoading(null); }
  };

  const handleBack = () => {
    window.dispatchEvent(new CustomEvent('vxt:navigate', { detail: 'customerEntities' }));
  };

  const handleRegisterNew = () => {
    window.dispatchEvent(new CustomEvent('vxt:navigate', {
      detail: { page: 'registerDevice', data: { entityId, entityName } },
    }));
  };

  const statusChip = (status) => {
    let bg, color, border;
    switch (status) {
      case 'Provisioned': bg = C.successBg; color = C.success; border = C.successBorder; break;
      case 'Failed':      bg = C.errorBg;  color = C.error;   border = C.errorBorder;  break;
      default:            bg = C.warnBg;   color = C.warn;    border = C.warnBorder;   break;
    }
    return (
      <span style={{
        display: 'inline-block', padding: '3px 10px', borderRadius: '12px',
        fontSize: '11px', fontWeight: 600,
        backgroundColor: bg, color, border: `1px solid ${border}`,
      }}>
        {status || 'Pending'}
      </span>
    );
  };

  // ── Copy handler ──
  const [copied, setCopied] = useState(null);
  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="management-page"
      style={{
        background: C.bg,
        minHeight: IS_EMBEDDED ? '100vh' : undefined,
        padding: IS_EMBEDDED ? 0 : undefined,
      }}
    >
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: IS_EMBEDDED ? '10px 12px' : '12px 16px',
        borderBottom: `1px solid ${C.border}`, backgroundColor: C.card,
      }}>
        <button onClick={handleBack} style={{ background: 'none', border: 'none', color: C.accent, fontSize: '18px', cursor: 'pointer', padding: '4px 8px' }} title="Back to Customer Entities">
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: IS_EMBEDDED ? '16px' : '18px', color: C.textPrimary }}>
            IoT Device Management
          </h2>
          {entityName && (
            <span style={{ fontSize: '13px', color: C.textMuted }}>
              {entityName} {entityId && entityId !== entityName ? `(${entityId})` : ''}
            </span>
          )}
        </div>
        <button
          onClick={handleRegisterNew}
          style={{
            padding: '8px 16px', backgroundColor: C.accent, color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          🚀 Register New Device
        </button>
      </div>

      {/* ── Messages ── */}
      {error && (
        <div style={{ margin: '12px 16px', padding: '12px', borderRadius: '6px', backgroundColor: C.errorBg, color: C.error, border: `1px solid ${C.errorBorder}`, fontSize: '13px' }}>
          {error}
        </div>
      )}
      {pushMsg && (
        <div style={{
          margin: '12px 16px', padding: '12px', borderRadius: '6px', fontSize: '13px',
          backgroundColor: pushMsg.type === 'success' ? C.successBg : C.errorBg,
          color: pushMsg.type === 'success' ? C.success : C.error,
          border: `1px solid ${pushMsg.type === 'success' ? C.successBorder : C.errorBorder}`,
        }}>
          {pushMsg.text}
        </div>
      )}

      {/* ── Device list ── */}
      <div style={{ padding: IS_EMBEDDED ? '8px' : '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: C.textMuted }}>Loading devices...</div>
        ) : devices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📡</div>
            <h3 style={{ color: C.textPrimary, marginBottom: '8px' }}>No IoT Devices Registered</h3>
            <p style={{ color: C.textMuted, marginBottom: '20px', fontSize: '14px' }}>
              Register a device to connect this entity to Azure IoT Hub.
            </p>
            <button
              onClick={handleRegisterNew}
              style={{
                padding: '10px 24px', backgroundColor: C.accent, color: '#fff',
                border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              🚀 Register First Device
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {devices.map((device) => (
              <div
                key={device.entityIoTDeviceId}
                style={{
                  backgroundColor: C.card, border: `1px solid ${C.border}`,
                  borderRadius: '8px', padding: '16px', overflow: 'hidden',
                }}
              >
                {/* Header row: device name + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: C.textPrimary }}>
                    {device.deviceId || '—'}
                  </div>
                  {statusChip(device.provisioningStatus)}
                  <span style={{ fontSize: '11px', color: C.textMuted }}>
                    ID: {device.entityIoTDeviceId}
                  </span>
                </div>

                {/* All attributes grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px',
                  fontSize: '13px', marginBottom: '14px',
                  padding: '12px', backgroundColor: '#0d1117', borderRadius: '6px',
                  border: `1px solid ${C.border}`,
                }}>
                  <span style={{ color: C.textMuted }}>Entity ID:</span>
                  <span style={{ color: C.textPrimary }}>{device.entityId}</span>

                  <span style={{ color: C.textMuted }}>Device ID:</span>
                  <span style={{ color: C.textPrimary, fontWeight: 600 }}>{device.deviceId || '—'}</span>

                  <span style={{ color: C.textMuted }}>IoT Hub Hostname:</span>
                  <span style={{ color: C.textPrimary }}>{device.iotHubHostname || '—'}</span>

                  <span style={{ color: C.textMuted }}>Connection String:</span>
                  <span style={{ color: C.textPrimary, wordBreak: 'break-all' }}>
                    {device.connectionString ? (
                      <>
                        <code style={{ fontSize: '11px', color: C.accent }}>{device.connectionString}</code>
                        <button
                          onClick={() => handleCopy(device.connectionString, `cs-${device.entityIoTDeviceId}`)}
                          style={{
                            marginLeft: '8px', padding: '2px 8px', fontSize: '11px',
                            backgroundColor: '#21262d', color: C.textPrimary,
                            border: `1px solid ${C.border}`, borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          {copied === `cs-${device.entityIoTDeviceId}` ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </>
                    ) : <span style={{ color: C.textMuted, fontStyle: 'italic' }}>Not set</span>}
                  </span>

                  <span style={{ color: C.textMuted }}>Provisioning Status:</span>
                  <span>{statusChip(device.provisioningStatus)}</span>

                  <span style={{ color: C.textMuted }}>Active:</span>
                  <span style={{ color: device.active === 'Y' ? C.success : C.error }}>
                    {device.active === 'Y' ? '✓ Active' : '✗ Inactive'}
                  </span>

                  <span style={{ color: C.textMuted }}>Last Twin Sync:</span>
                  <span style={{ color: C.textPrimary }}>{fmtDate(device.lastTwinSyncUTC)}</span>

                  <span style={{ color: C.textMuted }}>Created:</span>
                  <span style={{ color: C.textPrimary }}>{fmtDate(device.createDate)}</span>

                  <span style={{ color: C.textMuted }}>Last Updated:</span>
                  <span style={{ color: C.textPrimary }}>{fmtDate(device.lastUpdateTimestamp)}</span>

                  <span style={{ color: C.textMuted }}>Updated By:</span>
                  <span style={{ color: C.textPrimary }}>{device.lastUpdateUser || '—'}</span>
                </div>

                {/* Twin Desired / Reported (collapsible previews) */}
                {device.deviceTwinDesired && (
                  <details style={{ marginBottom: '8px' }}>
                    <summary style={{ color: C.accent, fontSize: '12px', cursor: 'pointer', marginBottom: '6px' }}>
                      📄 Device Twin Desired (saved)
                    </summary>
                    <pre style={{
                      backgroundColor: '#0d1117', padding: '10px', borderRadius: '6px',
                      fontSize: '11px', color: C.textPrimary, overflow: 'auto', maxHeight: '200px',
                      border: `1px solid ${C.border}`, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {(() => { try { return JSON.stringify(JSON.parse(device.deviceTwinDesired), null, 2); } catch { return device.deviceTwinDesired; } })()}
                    </pre>
                  </details>
                )}
                {device.deviceTwinReported && (
                  <details style={{ marginBottom: '8px' }}>
                    <summary style={{ color: C.accent, fontSize: '12px', cursor: 'pointer', marginBottom: '6px' }}>
                      📄 Device Twin Reported
                    </summary>
                    <pre style={{
                      backgroundColor: '#0d1117', padding: '10px', borderRadius: '6px',
                      fontSize: '11px', color: C.textPrimary, overflow: 'auto', maxHeight: '200px',
                      border: `1px solid ${C.border}`, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {(() => { try { return JSON.stringify(JSON.parse(device.deviceTwinReported), null, 2); } catch { return device.deviceTwinReported; } })()}
                    </pre>
                  </details>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    onClick={() => handlePreviewTwin(device.entityId)}
                    style={{
                      padding: '6px 14px', backgroundColor: '#21262d', color: C.textPrimary,
                      border: `1px solid ${C.border}`, borderRadius: '6px',
                      fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    👁 Preview Twin
                  </button>
                  <button
                    onClick={() => handlePush(device.entityId)}
                    disabled={pushLoading === device.entityId}
                    style={{
                      padding: '6px 14px', backgroundColor: '#1c3a5f', color: '#58a6ff',
                      border: '1px solid #1f4d8a', borderRadius: '6px',
                      fontSize: '12px', fontWeight: 600, cursor: pushLoading === device.entityId ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {pushLoading === device.entityId ? '⏳ Pushing...' : '🚀 Push Twin'}
                  </button>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => handleDelete(device.entityIoTDeviceId)}
                    style={{
                      padding: '6px 14px', backgroundColor: C.errorBg, color: C.error,
                      border: `1px solid ${C.errorBorder}`, borderRadius: '6px',
                      fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Twin Preview Modal ── */}
      {showTwinModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
          onClick={() => setShowTwinModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', maxWidth: '700px', width: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
              <h3 style={{ margin: 0, color: C.textPrimary, fontSize: '16px' }}>Device Twin Preview</h3>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {twinLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: C.textMuted }}>Loading twin...</div>
              ) : twinError ? (
                <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: C.errorBg, color: C.error, border: `1px solid ${C.errorBorder}`, fontSize: '13px' }}>
                  {twinError}
                </div>
              ) : (
                <pre style={{
                  backgroundColor: '#0d1117', padding: '16px', borderRadius: '6px',
                  fontSize: '13px', fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
                  color: C.textPrimary, overflow: 'auto', maxHeight: '500px',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  border: `1px solid ${C.border}`, lineHeight: '1.5', margin: 0,
                }}>
                  {JSON.stringify(twinJson, null, 2)}
                </pre>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTwinModal(false)} style={{ padding: '8px 18px', backgroundColor: '#21262d', color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
