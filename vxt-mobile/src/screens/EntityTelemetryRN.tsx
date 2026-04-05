/**
 * EntityTelemetryRN — WebView wrapper for Entity Telemetry page.
 *
 * Always renders the admin dashboard's EntityTelemetryRNPage inside a WebView.
 *
 * When data source is 'driver':
 *   Adds ?mode=driver to the URL. The WebView page detects this and sends
 *   data requests via postMessage instead of HTTP fetch. This component
 *   handles those requests by calling the active driver's APIs, converts
 *   the response to the same format as the HTTP API, and posts it back.
 *
 * When data source is 'cloud' or 'local':
 *   Plain WebView — the page fetches from HTTP APIs as usual.
 */
import React, { useContext, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { DrawerContext } from '../context/DrawerContext';
import { useDataSource } from '../hooks/useDataSource';
import { driverManager } from '../core/DriverManager';
import { useGatewayStore } from '../store/gatewayStore';
import { METRIC_DEFS } from '../vitals/VitalsDefs';
import type { SnapshotMap, HistoryMap } from '../core/types';

const C = {
  bg:          '#0d1117',
  card:        '#161b22',
  border:      '#30363d',
  textPrimary: '#e6edf3',
  textMuted:   '#8b949e',
  blue:        '#388bfd',
  green:       '#3fb950',
};

/** Derive dashboard WebView URL from the local API URL */
function deriveDashboardUrl(localUrl: string): string {
  try {
    const u = new URL(localUrl);
    return `${u.protocol}//${u.hostname}:3002`;
  } catch {
    return 'http://192.168.1.22:3002';
  }
}

/** Convert driver SnapshotMap → API /api/telemetry/latest format */
function snapshotToLatest(snapshot: SnapshotMap): Array<Record<string, unknown>> {
  return Object.entries(snapshot).map(([key, { value, ts }]) => {
    const def = METRIC_DEFS.find(m => m.key === key);
    return {
      attributeCode: key,
      attributeName: def?.label || key,
      attributeUnit: def?.unit || '',
      numericValue: value,
      endTimestampUTC: new Date(ts).toISOString(),
      defaultInGraph: def?.defaultOn ? 'Y' : 'N',
      stringValue: null,
      description: def?.label || key,
    };
  });
}

/** Convert driver HistoryMap → API /api/telemetry/range pivoted format */
function historyToTelemetry(history: HistoryMap): Array<Record<string, unknown>> {
  const byTs: Record<string, Record<string, unknown>> = {};
  for (const [key, points] of Object.entries(history)) {
    for (const pt of points) {
      const isoTs = new Date(pt.ts).toISOString();
      if (!byTs[isoTs]) byTs[isoTs] = { endTimestampUTC: isoTs };
      byTs[isoTs][key] = pt.v;
    }
  }
  return Object.values(byTs).sort(
    (a, b) => new Date(a.endTimestampUTC as string).getTime() - new Date(b.endTimestampUTC as string).getTime(),
  );
}

export default function EntityTelemetryRN() {
  const { openDrawer } = useContext(DrawerContext);
  const ds = useDataSource();
  const { activeDriver } = useGatewayStore();
  const webViewRef = useRef<WebView>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isDriver = ds.type === 'driver';
  const dashboardUrl = deriveDashboardUrl(ds.localUrl);
  const webViewUrl = isDriver
    ? `${dashboardUrl}/?embedded=true&mode=driver&activeDriver=${encodeURIComponent(activeDriver || 'SamsungHealth')}#telemetryRN`
    : `${dashboardUrl}/?embedded=true&dsType=${ds.type}&cloudUrl=${encodeURIComponent(ds.cloudUrl)}&localUrl=${encodeURIComponent(ds.localUrl)}#telemetryRN`;

  // ── Bridge: handle requests from WebView ─────────────────────────────────────
  async function handleBridgeMessage(event: WebViewMessageEvent) {
    let msg: { id?: string; type: string; pdfData?: string; entityName?: string; params?: Record<string, string> };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    // Handle PDF sharing (fire-and-forget, no response)
    if (msg.type === 'sharePDF') {
      try {
        const { pdfData, entityName } = msg;
        if (!pdfData) return;
        await Share.share({
          url: pdfData,
          title: `Telemetry Report - ${entityName || 'Export'}`,
          message: `Telemetry report for ${entityName || 'entity'}`,
        });
      } catch (e) {
        console.warn('[EntityTelemetryRN] Share error:', e);
      }
      return;
    }

    // Handle driver data requests (only in driver mode)
    if (!isDriver) return;

    const driver = driverManager.get(activeDriver) ?? driverManager.getActive();
    let responseData: unknown = null;

    try {
      switch (msg.type) {
        case 'loadEntities': {
          responseData = [{
            entityId: 'driver',
            entityFirstName: driver?.displayName || 'Driver',
            entityLastName: '',
            entityTypeId: 99,
            entityTypeName: 'Driver',
          }];
          break;
        }

        case 'loadLatest': {
          if (!driver) { responseData = []; break; }
          const snapshot = await driver.getLatest();
          responseData = snapshot ? snapshotToLatest(snapshot) : [];
          break;
        }

        case 'loadRange': {
          if (!driver) { responseData = []; break; }
          const startMs = msg.params?.startDate
            ? new Date(msg.params.startDate).getTime()
            : Date.now() - 3_600_000;
          const endMs = msg.params?.endDate
            ? new Date(msg.params.endDate).getTime()
            : Date.now();
          const history: HistoryMap = await driver.getHistory(startMs, endMs);
          responseData = historyToTelemetry(history);
          break;
        }

        case 'loadEvents': {
          responseData = [];
          break;
        }

        case 'loadEventDetails': {
          responseData = {};
          break;
        }

        case 'loadScores': {
          responseData = [];
          break;
        }

        default:
          responseData = null;
      }
    } catch (e) {
      console.warn('[EntityTelemetryRN] Bridge error:', msg.type, e);
      responseData = null;
    }

    const response = JSON.stringify({ id: msg.id, data: responseData });
    webViewRef.current?.injectJavaScript(
      `window.__driverBridgeCallback(${response}); true;`,
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Header bar ─────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.hamburger}>
          <Text style={styles.hamburgerText}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📊 Entity Telemetry</Text>
        {isDriver && (
          <View style={styles.driverBadge}>
            <Text style={styles.driverBadgeText}>Driver Mode</Text>
          </View>
        )}
      </View>

      {/* ── Content ────────────────────────────────────────── */}
      {!ds.loaded ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.blue} />
          <Text style={styles.centerText}>Loading config…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Cannot load dashboard</Text>
          <Text style={styles.errorText}>{webViewUrl}</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <Text style={styles.hintText}>
            Make sure the admin dashboard is running{'\n'}
            (start_all.ps1, or: cd admin-dashboard && npm run dev)
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => setLoadError(null)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: webViewUrl }}
          style={styles.webView}
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <ActivityIndicator size="large" color={C.blue} />
              <Text style={styles.centerText}>Loading dashboard…</Text>
            </View>
          )}
          onError={(e) => {
            setLoadError(e.nativeEvent.description || 'Connection failed');
          }}
          onMessage={isDriver ? handleBridgeMessage : undefined}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mixedContentMode="compatibility"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  hamburger: {
    marginRight: 16,
    padding: 4,
  },
  hamburgerText: {
    color: C.textPrimary,
    fontSize: 22,
  },
  headerTitle: {
    color: C.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  driverBadge: {
    backgroundColor: C.green + '22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.green,
  },
  driverBadgeText: {
    color: C.green,
    fontSize: 11,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
    backgroundColor: C.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bg,
    padding: 32,
  },
  centerText: {
    marginTop: 12,
    color: C.textMuted,
    fontSize: 14,
  },
  errorTitle: {
    color: '#ff4d4d',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorText: {
    color: C.textMuted,
    fontSize: 13,
    marginBottom: 6,
    textAlign: 'center',
  },
  hintText: {
    color: C.textPrimary,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: C.blue,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
