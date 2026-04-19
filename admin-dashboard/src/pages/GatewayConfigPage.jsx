/**
 * GatewayConfigPage — PC-only gateway configuration.
 *
 * Lets the user choose where manual telemetry reports are sent:
 *   - Local Kafka broker (Redpanda / confluent-compatible)
 *   - Azure IoT Hub
 *
 * Config is saved to localStorage under key 'vxt_gateway_config' and read
 * by ReportManuallyPage when building the POST /api/manual-report payload.
 */
import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'vxt_gateway_config';

const DEFAULT_KAFKA = {
  type:           'kafka',
  kafkaBootstrap: '127.0.0.1:9092',
  kafkaTopic:     'iot-telemetry',
};

const DEFAULT_IOTHUB = {
  type:                  'iothub',
  iotHubConnectionString: '',
};

export default function GatewayConfigPage() {
  const [gatewayType, setGatewayType] = useState('kafka');
  const [kafkaBootstrap, setKafkaBootstrap] = useState('127.0.0.1:9092');
  const [kafkaTopic,     setKafkaTopic]     = useState('iot-telemetry');
  const [iotConnString,  setIotConnString]  = useState('');
  const [saved,          setSaved]          = useState(false);
  const [testResult,     setTestResult]     = useState(null);
  const [testing,        setTesting]        = useState(false);

  // ── Load saved config on mount ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cfg = JSON.parse(raw);
        setGatewayType(cfg.type ?? 'kafka');
        setKafkaBootstrap(cfg.kafkaBootstrap ?? '127.0.0.1:9092');
        // Migrate old 'boat-telemetry' default to 'iot-telemetry'
        const topic = cfg.kafkaTopic === 'boat-telemetry' ? 'iot-telemetry' : (cfg.kafkaTopic ?? 'iot-telemetry');
        setKafkaTopic(topic);
        setIotConnString(cfg.iotHubConnectionString ?? '');
      }
    } catch { /* ignore */ }
  }, []);

  function handleSave() {
    const cfg = gatewayType === 'kafka'
      ? { type: 'kafka', kafkaBootstrap, kafkaTopic }
      : { type: 'iothub', iotHubConnectionString: iotConnString };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? '';
      const testPayload = {
        entityId:                'TEST',
        entityTypeAttributeCode: 'TEST',
        entityTypeAttributeId:   0,
        value:                   0,
        timestamp:               new Date().toISOString(),
        source:                  'Manual',
        gatewayType:             gatewayType,
        ...(gatewayType === 'kafka'
          ? { kafkaBootstrap, kafkaTopic }
          : { iotHubConnectionString: iotConnString }),
        _dryRun: true,
      };
      const res = await fetch(`${base}/api/manual-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });
      const body = await res.json();
      setTestResult(res.ok
        ? { ok: true,  msg: `Connected: ${body.message ?? 'OK'}` }
        : { ok: false, msg: body.detail ?? 'Connection failed' });
    } catch (ex) {
      setTestResult({ ok: false, msg: ex.message ?? String(ex) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="page">
      <h2>⚡ Gateway Configuration</h2>

      <p style={{ color: '#8b949e', marginBottom: 20, fontSize: 13 }}>
        Configure the message broker that receives manual telemetry reports from the PC dashboard.
        This does not affect the mobile app — the mobile always uses Azure IoT Hub directly via MQTT.
      </p>

      {/* ── Gateway type selector ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { key: 'kafka',  label: '🔴 Local Kafka Broker',  sub: 'Redpanda / Confluent (localhost)' },
          { key: 'iothub', label: '☁️ Azure IoT Hub',        sub: 'Device-to-Cloud via REST' },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setGatewayType(opt.key)}
            style={{
              flex: 1,
              padding: '14px 16px',
              backgroundColor: gatewayType === opt.key ? '#1f3a5f' : '#161b22',
              color: gatewayType === opt.key ? '#388bfd' : '#8b949e',
              border: `2px solid ${gatewayType === opt.key ? '#388bfd' : '#30363d'}`,
              borderRadius: 8,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all .15s',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{opt.label}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{opt.sub}</div>
          </button>
        ))}
      </div>

      {/* ── Kafka fields ── */}
      {gatewayType === 'kafka' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 4, display: 'block' }}>
              Bootstrap Servers
            </label>
            <input
              type="text"
              value={kafkaBootstrap}
              onChange={e => setKafkaBootstrap(e.target.value)}
              placeholder="127.0.0.1:9092"
              style={{ width: '100%', padding: '8px 10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
            />
            <p style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
              Default: <code>127.0.0.1:9092</code> — Redpanda running in Docker on this PC.
            </p>
          </div>
          <div className="form-group">
            <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 4, display: 'block' }}>
              Topic
            </label>
            <input
              type="text"
              value={kafkaTopic}
              onChange={e => setKafkaTopic(e.target.value)}
              placeholder="iot-telemetry"
              style={{ width: '100%', padding: '8px 10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ background: '#1a1a0d', border: '1px solid #555522', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#ccbb55' }}>
            ℹ️ Messages are published in <strong>Junction format</strong> on topic <code>{kafkaTopic || 'iot-telemetry'}</code>.
            The local consumer (<code>run_consumer_local.py</code>) must be running to process them.
          </div>
        </div>
      )}

      {/* ── IoT Hub fields ── */}
      {gatewayType === 'iothub' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 4, display: 'block' }}>
              Device Connection String
            </label>
            <input
              type="text"
              value={iotConnString}
              onChange={e => setIotConnString(e.target.value)}
              placeholder="HostName=...azure-devices.net;DeviceId=...;SharedAccessKey=..."
              style={{ width: '100%', padding: '8px 10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 4, fontSize: 12, boxSizing: 'border-box', fontFamily: 'monospace' }}
            />
            <p style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
              Found in Azure Portal → IoT Hub → Devices → [device] → Connection strings.
            </p>
          </div>
          <div style={{ background: '#0d1a2a', border: '1px solid #224488', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#6699cc' }}>
            ℹ️ Messages are sent as device-to-cloud telemetry via the Azure IoT Hub REST API (no MQTT library needed).
            The Azure Function will process the message and store it in the database.
          </div>
        </div>
      )}

      {/* ── Test result feedback ── */}
      {testResult && (
        <div style={{
          marginTop: 16,
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 13,
          background: testResult.ok ? 'rgba(63, 185, 80, 0.1)' : 'rgba(218, 54, 51, 0.1)',
          border: `1px solid ${testResult.ok ? '#3fb950' : '#f85149'}`,
          color:  testResult.ok ? '#3fb950' : '#f85149',
        }}>
          {testResult.ok ? '✅' : '❌'} {testResult.msg}
        </div>
      )}

      {/* ── Saved feedback ── */}
      {saved && (
        <div style={{ marginTop: 16, padding: '8px 12px', borderRadius: 6, fontSize: 13, background: 'rgba(63, 185, 80, 0.1)', border: '1px solid #3fb950', color: '#3fb950' }}>
          ✅ Gateway configuration saved.
        </div>
      )}

      {/* ── Buttons ── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button
          onClick={handleSave}
          style={{ padding: '9px 20px', backgroundColor: '#388bfd', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          💾 Save Configuration
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          style={{ padding: '9px 20px', backgroundColor: '#5a6a8a', color: 'white', border: 'none', borderRadius: 4, cursor: testing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: testing ? 0.7 : 1 }}
        >
          {testing ? '⏳ Testing…' : '🔌 Test Connection'}
        </button>
      </div>
    </div>
  );
}
