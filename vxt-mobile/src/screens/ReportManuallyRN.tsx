/**
 * ReportManuallyRN — WebView wrapper for the "Report Manually" page.
 *
 * Loads ReportManuallyPage from the same admin-dashboard bundle used by
 * EntityTelemetryRN (file:///android_asset/www/ for driver mode, network otherwise).
 *
 * Bridge messages handled:
 *   loadEntities   — fetch /entities from API (or driver stub)
 *   loadAttributes — fetch /entitytypeattributes from API
 *   submitManualReport — Kafka: REST API to backend; IoT Hub: direct MQTT publish
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
import type { GatewayConfig } from '../core/types';

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

function _delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function ReportManuallyRN() {
  const { openDrawer }      = useContext(DrawerContext);
  const ds                  = useDataSource();
  const { activeDriver, config: gatewayConfig } = useGatewayStore();
  const webViewRef          = useRef<WebView>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);

  const isDriver     = ds.type === 'driver';

  // All modes: load from bundled APK assets (bridge proxies API calls)
  const webViewUrl = `file:///android_asset/www/index.html?embedded=true${isDriver ? '&mode=driver' : ''}&dsType=${ds.type}&activeDriver=${encodeURIComponent(activeDriver || 'SamsungHealth')}&cloudUrl=${encodeURIComponent(ds.cloudUrl)}&localUrl=${encodeURIComponent(ds.localUrl)}#reportManually`;

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

          if (!gatewayConfig) {
            responseData = { error: 'Gateway configuration not loaded. Please try again.' };
            console.error('[ReportManuallyRN] gatewayConfig is missing');
            break;
          }

          try {
            // Check actual gateway type configuration (with fallback to default)
            const isKafkaGateway = gatewayConfig?.gatewayType === 'kafka';

            if (isKafkaGateway && gatewayConfig) {
              // ── Route to Kafka via REST API endpoint ─────────────────────
              // Derive API base from bootstrap address (e.g., "192.168.1.22:9092" → "http://192.168.1.22:8000")
              const bootstrapHost = (gatewayConfig.kafkaBootstrap || '192.168.1.22').split(':')[0];
              const kafkaApiBase = `http://${bootstrapHost}:8000`;
              
              console.log('[ReportManuallyRN] Kafka route:', { kafkaApiBase, bootstrap: gatewayConfig.kafkaBootstrap, topic: gatewayConfig.kafkaTopic });

              const kafkaReport = {
                entityId:                d.entityId,
                entityTypeAttributeCode: d.entityTypeAttributeCode,
                value:                   d.value,
                timestamp:               d.timestamp || new Date().toISOString(),
                source:                  d.source || 'Manual',
                gatewayType:             'kafka',
                kafkaBootstrap:          gatewayConfig.kafkaBootstrap || '192.168.1.22:9092',
                kafkaTopic:              gatewayConfig.kafkaTopic || 'iot-telemetry',
              };

              console.log('[ReportManuallyRN] Sending to Kafka:', kafkaReport);

              const kafkaRes = await fetch(`${kafkaApiBase}/api/manual-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(kafkaReport),
              });

              const kafkaBody = await kafkaRes.text();
              console.log('[ReportManuallyRN] Kafka response:', { status: kafkaRes.status, body: kafkaBody });

              if (!kafkaRes.ok) {
                let errorDetail = 'Unknown error';
                try {
                  const parsed = JSON.parse(kafkaBody);
                  errorDetail = parsed.detail || parsed.error || kafkaBody;
                } catch {
                  errorDetail = kafkaBody || `HTTP ${kafkaRes.status}`;
                }
                throw new Error(`Kafka API error: ${errorDetail}`);
              }

              responseData = { success: true, message: 'Published to Kafka via REST API' };
            } else {
              // ── Route to Azure IoT Hub via direct MQTT ──────────────────
              console.log('[ReportManuallyRN] MQTT route (Azure IoT Hub)');

              const connStr = gatewayConfig.iotHubConnectionString || IOT_HUB_CONNECTION_STRING;

              const telemetry = {
                sourceDriver: 'Manual',
                entityId:     d.entityId,
                timestamp:    d.timestamp || new Date().toISOString(),
                measurements: { [d.entityTypeAttributeCode]: parseFloat(d.value) || d.value },
                metadata:     { platform: 'android', source: 'ManualReport' },
              };

              console.log('[ReportManuallyRN] Creating MQTT transport...');
              const transport = new MqttTransport({ connectionString: connStr });

              console.log('[ReportManuallyRN] Connecting to MQTT...');
              await transport.connect();

              console.log('[ReportManuallyRN] Publishing telemetry...');
              transport.publish(telemetry as any);

              await _delay(500);

              console.log('[ReportManuallyRN] Disconnecting MQTT...');
              await transport.disconnect();

              responseData = { success: true, message: 'Published to Azure IoT Hub via MQTT' };
            }
          } catch (e: any) {
            const errorMsg = e?.message ?? String(e);
            console.error('[ReportManuallyRN] submitManualReport error:', errorMsg, e);
            responseData = { error: errorMsg };
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
