/**
 * RegisterDevicePage — RN-style device registration screen
 *
 * Mirrors the React Native mobile pattern (like EntityTelemetryRN):
 *   - Entity name read-only (passed via navigation context)
 *   - Device ID input
 *   - IoT Hub hostname (defaulted)
 *   - Register button → POST /api/v1/device/register
 *   - Success modal with connection string + copy button
 *   - Error state handling
 */
import React, { useState } from 'react';
import '../styles/ManagementPage.css';
import { twinAPI } from '../services/api';

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
};

const DEFAULT_HUB = 'VXT-IoT-Hub.azure-devices.net';

// ─── Embedded mode detection ────────────────────────────────────────────────
const IS_EMBEDDED = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('embedded') === 'true';
  } catch { return false; }
})();

// ─── Component ───────────────────────────────────────────────────────────────
export default function RegisterDevicePage({ entityId: propEntityId, entityName: propEntityName }) {
  // Allow entity context from props (navigation) or URL params (embedded)
  const urlParams = new URLSearchParams(window.location.search);
  const entityId   = propEntityId   || urlParams.get('entityId')   || '';
  const entityName = propEntityName || urlParams.get('entityName') || entityId;

  const [deviceId, setDeviceId]           = useState('');
  const [iotHubHostname, setIotHubHostname] = useState(DEFAULT_HUB);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [result, setResult]               = useState(null);   // success payload
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [copied, setCopied]               = useState(false);

  // ── Register handler ──────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!deviceId.trim()) {
      setError('Device ID is required');
      return;
    }
    if (!entityId) {
      setError('No entity selected. Go back and choose an entity first.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await twinAPI.registerDevice(entityId, deviceId.trim());
      setResult(data);
      setShowSuccessModal(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail && typeof detail === 'string' && detail.toLowerCase().includes('already')) {
        setError(`Device "${deviceId}" is already registered in Azure IoT Hub. Use a different Device ID or manage the existing device.`);
      } else {
        setError(detail || err.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!result?.connectionString) return;
    try {
      await navigator.clipboard.writeText(result.connectionString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      // Also relay to RN if embedded
      if (IS_EMBEDDED && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'copyToClipboard',
          text: result.connectionString,
        }));
      }
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = result.connectionString;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // ── Navigate back ─────────────────────────────────────────────────────────
  const handleBack = () => {
    window.dispatchEvent(new CustomEvent('vxt:navigate', {
      detail: { page: 'entityIoTDevice', data: { entityId, entityName } },
    }));
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="management-page"
      style={{
        background: C.bg,
        minHeight: IS_EMBEDDED ? '100vh' : undefined,
        padding: IS_EMBEDDED ? 0 : undefined,
        margin: IS_EMBEDDED ? 0 : undefined,
        borderRadius: IS_EMBEDDED ? 0 : undefined,
        boxShadow: IS_EMBEDDED ? 'none' : undefined,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: IS_EMBEDDED ? '10px 12px' : '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          backgroundColor: C.card,
        }}
      >
        <button
          onClick={handleBack}
          style={{
            background: 'none',
            border: 'none',
            color: C.accent,
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
          title="Back to IoT Devices"
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: IS_EMBEDDED ? '16px' : '18px', color: C.textPrimary }}>
          Register New Device
        </h2>
      </div>

      {/* ── Form card ── */}
      <div
        style={{
          margin: IS_EMBEDDED ? '12px' : '20px auto',
          maxWidth: '520px',
          backgroundColor: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
          padding: IS_EMBEDDED ? '14px' : '24px',
        }}
      >
        {/* Entity name (read-only) */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: C.textMuted }}>
            Entity
          </label>
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#0d1117',
              border: `1px solid ${C.border}`,
              borderRadius: '6px',
              color: C.textPrimary,
              fontSize: '14px',
              opacity: 0.85,
            }}
          >
            {entityName || '—'} {entityId && entityId !== entityName ? <span style={{ color: C.textMuted, fontSize: '12px' }}>({entityId})</span> : null}
          </div>
        </div>

        {/* Device ID */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: C.textMuted }}>
            Device ID *
          </label>
          <input
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="e.g. VXT-YACHT-001"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: '#0d1117',
              border: `1px solid ${C.border}`,
              borderRadius: '6px',
              color: C.textPrimary,
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: C.textMuted }}>
            Must be unique across your IoT Hub. Letters, numbers, and hyphens only.
          </span>
        </div>

        {/* IoT Hub Hostname */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: C.textMuted }}>
            IoT Hub Hostname
          </label>
          <input
            type="text"
            value={iotHubHostname}
            onChange={(e) => setIotHubHostname(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: '#0d1117',
              border: `1px solid ${C.border}`,
              borderRadius: '6px',
              color: C.textPrimary,
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '12px 14px',
              marginBottom: '16px',
              borderRadius: '6px',
              backgroundColor: C.errorBg,
              color: C.error,
              border: `1px solid ${C.errorBorder}`,
              fontSize: '13px',
              lineHeight: '1.45',
            }}
          >
            {error}
          </div>
        )}

        {/* Register button */}
        <button
          onClick={handleRegister}
          disabled={loading || !deviceId.trim()}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#333' : C.accent,
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: (!deviceId.trim() && !loading) ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {loading ? (
            <>
              <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Provisioning...
            </>
          ) : (
            <>🚀 Register Device</>
          )}
        </button>
      </div>

      {/* ── Spinner keyframes (injected once) ── */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Success Modal ── */}
      {showSuccessModal && result && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => setShowSuccessModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: C.card,
              border: `1px solid ${C.successBorder}`,
              borderRadius: '10px',
              maxWidth: '520px',
              width: '100%',
              overflow: 'hidden',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '22px' }}>✅</span>
              <h3 style={{ margin: 0, color: C.success, fontSize: '16px' }}>Device Registered Successfully</h3>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px' }}>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 14px', fontSize: '13px', marginBottom: '18px' }}>
                <span style={{ color: C.textMuted }}>Device ID:</span>
                <span style={{ color: C.textPrimary, fontWeight: 600 }}>{result.deviceId}</span>
                <span style={{ color: C.textMuted }}>Entity:</span>
                <span style={{ color: C.textPrimary }}>{result.entityId}</span>
                <span style={{ color: C.textMuted }}>Hostname:</span>
                <span style={{ color: C.textPrimary }}>{result.hostname}</span>
                <span style={{ color: C.textMuted }}>Status:</span>
                <span style={{ color: C.success, fontWeight: 600 }}>{result.provisioningStatus}</span>
              </div>

              {/* Connection string */}
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: C.textMuted }}>
                🔑 Azure Connection String
              </label>
              <div
                style={{
                  position: 'relative',
                  backgroundColor: '#0d1117',
                  border: `1px solid ${C.border}`,
                  borderRadius: '6px',
                  padding: '12px',
                  paddingRight: '80px',
                  fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
                  fontSize: '12px',
                  color: C.textPrimary,
                  wordBreak: 'break-all',
                  lineHeight: '1.5',
                }}
              >
                {result.connectionString}
                <button
                  onClick={handleCopy}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    padding: '5px 12px',
                    backgroundColor: copied ? C.successBg : '#30363d',
                    color: copied ? C.success : C.textPrimary,
                    border: `1px solid ${copied ? C.successBorder : C.border}`,
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>

              <p style={{ margin: '14px 0 0', fontSize: '12px', color: C.textMuted, lineHeight: '1.5' }}>
                Paste this connection string into the Raspberry Pi's environment variable{' '}
                <code style={{ backgroundColor: '#0d1117', padding: '2px 5px', borderRadius: '3px', fontSize: '11px' }}>
                  IOTHUB_DEVICE_CONNECTION_STRING
                </code>{' '}
                to connect the Edge module.
              </p>
            </div>

            {/* Modal footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: `1px solid ${C.border}`,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  handleBack();
                }}
                style={{
                  padding: '8px 18px',
                  backgroundColor: C.successBg,
                  color: C.success,
                  border: `1px solid ${C.successBorder}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
