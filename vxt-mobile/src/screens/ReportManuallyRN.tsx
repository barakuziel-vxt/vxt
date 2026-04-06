/**
 * ReportManuallyRN — WebView wrapper for the "Report Manually" page.
 *
 * Loads ReportManuallyPage from the same admin-dashboard bundle used by
 * EntityTelemetryRN (file:///android_asset/www/ for driver mode, network otherwise).
 *
 * Bridge messages handled:
 *   loadEntities   — fetch /entities from API (or driver stub)
 *   loadAttributes — fetch /entitytypeattributes from API
 *   submitManualReport — connect MqttTransport → publish → disconnect
 */
import React, { useContext, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { DrawerContext } from '../context/DrawerContext';
import { useDataSource } from '../hooks/useDataSource';
import { MqttTransport } from '../services/MqttTransport';
import { IOT_HUB_CONNECTION_STRING } from '../config/secrets';
import { useGatewayStore } from '../store/gatewayStore';

const C = {
  bg:          '#0d1117',
  card:        '#161b22',
  border:      '#30363d',
  textPrimary: '#e6edf3',
  textMuted:   '#8b949e',
  blue:        '#388bfd',
  green:       '#3fb950',
};

function deriveDashboardUrl(localUrl: string): string {
  try {
    const u = new URL(localUrl);
    return `${u.protocol}//${u.hostname}:3002`;
  } catch {
    return 'http://192.168.1.22:3002';
  }
}

export default function ReportManuallyRN() {
  const { openDrawer }    = useContext(DrawerContext);
  const ds                = useDataSource();
  const { activeDriver }  = useGatewayStore();
  const webViewRef        = useRef<WebView>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);

  const isDriver     = ds.type === 'driver';
  const dashboardUrl = deriveDashboardUrl(ds.localUrl);

  const webViewUrl = isDriver
    ? `file:///android_asset/www/index.html?embedded=true&mode=driver&activeDriver=${encodeURIComponent(activeDriver || 'SamsungHealth')}#reportManually`
    : `${dashboardUrl}/?embedded=true&dsType=${ds.type}&cloudUrl=${encodeURIComponent(ds.cloudUrl)}&localUrl=${encodeURIComponent(ds.localUrl)}#reportManually`;

  // ── Bridge message handler ────────────────────────────────────────────────
  async function handleBridgeMessage(event: WebViewMessageEvent) {
    let msg: { id?: string; type: string; data?: Record<string, unknown>; params?: Record<string, string> };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    let responseData: unknown = null;

    try {
      const apiBase = isDriver ? '' : (ds.type === 'cloud' ? ds.cloudUrl : ds.localUrl).replace(/\/$/, '');

      switch (msg.type) {
        // ── Load entities ──────────────────────────────────────────────────
        case 'loadEntities': {
          if (isDriver) {
            responseData = [{ entityId: 'driver', entityFirstName: 'Driver', entityLastName: '', entityTypeId: 99, entityTypeName: 'Driver' }];
          } else {
            const res = await fetch(`${apiBase}/entities`);
            responseData = res.ok ? await res.json() : [];
          }
          break;
        }

        // ── Load entity type attributes ────────────────────────────────────
        case 'loadAttributes': {
          if (isDriver) {
            responseData = [];
          } else {
            const res = await fetch(`${apiBase}/entitytypeattributes`);
            responseData = res.ok ? await res.json() : [];
          }
          break;
        }

        // ── Submit manual report ───────────────────────────────────────────
        case 'submitManualReport': {
          const d = (msg.params ?? msg.data) as {
            entityId: string;
            entityTypeAttributeCode: string;
            value: number;
            timestamp: string;
            source?: string;
          };

          if (!d || !d.entityId || !d.entityTypeAttributeCode) {
            responseData = { error: 'Missing required fields' };
            break;
          }

          if (ds.type === 'local') {
            // Local Endpoint: forward to the running FastAPI server (Kafka gateway)
            const apiBase = ds.localUrl.replace(/\/$/, '');
            const res = await fetch(`${apiBase}/api/manual-report`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entityId:                d.entityId,
                entityTypeAttributeCode: d.entityTypeAttributeCode,
                value:                   d.value,
                timestamp:               d.timestamp || new Date().toISOString(),
                source:                  d.source || 'Manual',
                gatewayType:             'kafka',
                kafkaBootstrap:          '127.0.0.1:9092',
                kafkaTopic:              'iot-telemetry',
              }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.detail ?? `HTTP ${res.status}`);
            responseData = { success: true };
          } else {
            // Cloud Endpoint or Driver: send directly to Azure IoT Hub via MQTT
            const telemetry = {
              deviceId:  d.entityId,
              timestamp: d.timestamp || new Date().toISOString(),
              values:    { [d.entityTypeAttributeCode]: d.value },
              source:    (d.source || 'Manual') as any,
            };
            const transport = new MqttTransport({ connectionString: IOT_HUB_CONNECTION_STRING });
            try {
              await transport.connect();
              transport.publish(telemetry as any);
              await _delay(500);
              await transport.disconnect();
              responseData = { success: true };
            } catch (mqttErr: any) {
              responseData = { error: mqttErr?.message ?? String(mqttErr) };
            }
          }
          break;
        }

        default:
          responseData = null;
      }
    } catch (e: any) {
      console.warn('[ReportManuallyRN] Bridge error:', msg.type, e);
      responseData = { error: e?.message ?? String(e) };
    }

    const response = JSON.stringify({ id: msg.id, data: responseData });
    webViewRef.current?.injectJavaScript(
      `window.__driverBridgeCallback(${response}); true;`,
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.hamburger}>
          <Text style={styles.hamburgerText}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📝 Report Manually</Text>
      </View>

      {/* ── Content ────────────────────────────────────────── */}
      {!ds.loaded ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.blue} />
          <Text style={styles.centerText}>Loading…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Cannot load page</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoadError(null); setWebViewKey(k => k + 1); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ uri: webViewUrl }}
          style={styles.webview}
          originWhitelist={['*']}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleBridgeMessage}
          onError={e => setLoadError(e.nativeEvent.description)}
          onHttpError={e => {
            if (e.nativeEvent.statusCode >= 500) setLoadError(`HTTP ${e.nativeEvent.statusCode}`);
          }}
        />
      )}
    </View>
  );
}

function _delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  webview: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 12,
    paddingVertical:   10,
    gap: 10,
  },
  hamburger:     { paddingHorizontal: 4 },
  hamburgerText: { color: C.textPrimary, fontSize: 22 },
  headerTitle:   { color: C.textPrimary, fontSize: 17, fontWeight: '600', flex: 1 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerText:    { color: C.textMuted, marginTop: 12, fontSize: 14 },
  errorTitle:    { color: C.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  errorText:     { color: C.textMuted, fontSize: 13, marginBottom: 6, textAlign: 'center' },
  retryBtn:      { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, backgroundColor: C.blue },
  retryText:     { color: '#fff', fontSize: 14, fontWeight: '600' },
});
