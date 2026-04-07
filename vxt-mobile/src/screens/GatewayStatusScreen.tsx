import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useGatewayStore } from '../store/gatewayStore';
import { useUserProfile } from '../hooks/useUserProfile';
import { DrawerContext } from '../context/DrawerContext';
import type { TransportStatus } from '../services/MqttTransport';
import type { ConnectionStatus } from '../core/types';

// ─── Colour palette ────────────────────────────────────────────────────────
const C = {
  bg:          '#0d1117',
  card:        '#161b22',
  border:      '#30363d',
  textPrimary: '#e6edf3',
  textMuted:   '#8b949e',
  green:       '#3fb950',
  yellow:      '#d29922',
  red:         '#f85149',
  blue:        '#388bfd',
  orange:      '#f0883e',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function statusColor(s: ConnectionStatus | TransportStatus) {
  return s === 'connected'  ? C.green
       : s === 'connecting' ? C.yellow
       : s === 'error'      ? C.red
       : C.textMuted;
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

/** Colour for the lag indicator — green / yellow / red */
function lagColor(ms: number) {
  if (ms <= 0)          return C.green;
  if (ms < 5 * 60_000)  return C.green;   // < 5 min
  if (ms < 60 * 60_000) return C.yellow;  // < 1 h
  return C.red;                            // ≥ 1 h
}

// ─── Toggle row component ─────────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  sub?: string;
  value: boolean;
  busy: boolean;
  onToggle(): void;
}

function ToggleRow({ label, sub, value, busy, onToggle }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
      </View>
      {busy ? (
        <ActivityIndicator color={C.blue} />
      ) : (
        <Switch
          value={value}
          onValueChange={onToggle}
          thumbColor={value ? C.green : C.textMuted}
          trackColor={{ false: C.border, true: C.green + '55' }}
        />
      )}
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────

export default function GatewayStatusScreen() {
  const [userProfile] = useUserProfile();
  const {
    driverRunning,
    gatewayRunning,
    driverStatus,
    transportStatus,
    activeDriver,
    framesSent,
    lagDisplay,
    lagMs,
    isSyncingBacklog,
    backlogSynced,
    backlogTotal,
    lastError,
    startDriver,
    stopDriver,
    startGateway,
    stopGateway,
    clearError,
    resetLag,
    updateConfig,
    config: activeConfig,
  } = useGatewayStore();
  const { openDrawer } = useContext(DrawerContext);

  const [togglingGateway, setTogglingGateway] = React.useState(false);
  const [showDiagnostics, setShowDiagnostics] = React.useState(false);

  // Auto-start the active driver when the screen first mounts
  // Also sync userId from user profile
  const hasAutoStarted = React.useRef(false);
  React.useEffect(() => {
    if (!hasAutoStarted.current) {
      hasAutoStarted.current = true;
      // Sync userId from user profile to gateway config
      if (userProfile.userId) {
        updateConfig({ userId: userProfile.userId });
      }
      // Auto-start driver
      if (!driverRunning) {
        startDriver().catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGatewayToggle() {
    if (togglingGateway) return;
    setTogglingGateway(true);
    try { gatewayRunning ? await stopGateway() : await startGateway(); }
    finally { setTogglingGateway(false); }
  }

  const syncPct = backlogTotal > 0
    ? Math.round((backlogSynced / backlogTotal) * 100)
    : 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.heading}>Event Hub</Text>
          <Text style={styles.subHeading}>Telemetry pipeline status</Text>
        </View>
      </View>

      {/* ── Status cards ─────────────────────────────────────────────── */}
      <View style={styles.cardRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Driver</Text>
          <Text style={[styles.cardValue, { color: statusColor(driverStatus) }]}>
            {capitalize(driverStatus)}
          </Text>
          <Text style={styles.cardSub}>{activeDriver}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{activeConfig.gatewayType === 'kafka' ? 'Kafka Broker' : 'Azure Event Hub'}</Text>
          <Text style={[styles.cardValue, { color: statusColor(transportStatus) }]}>
            {capitalize(transportStatus)}
          </Text>
          <Text style={styles.cardSub}>{activeConfig.gatewayType === 'kafka' ? 'Native Protocol' : 'MQTT / TLS'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Frames Sent</Text>
          <Text style={[styles.cardValue, { color: C.blue }]}>
            {framesSent.toLocaleString()}
          </Text>
          <Text style={styles.cardSub}>session</Text>
        </View>

        {/* Azure IoT Event Lag card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>IoT Event Lag</Text>
          <Text style={[styles.cardValue, { color: lagColor(lagMs) }]}>
            {lagDisplay}
          </Text>
          <TouchableOpacity onPress={resetLag}>
            <Text style={[styles.cardSub, { color: C.blue }]}>Reset ↺</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Backlog sync progress ─────────────────────────────────────── */}
      {isSyncingBacklog && (
        <View style={styles.backlogCard}>
          <View style={styles.backlogHeader}>
            <ActivityIndicator size="small" color={C.blue} style={{ marginRight: 8 }} />
            <Text style={styles.backlogTitle}>Syncing backlog…</Text>
            <Text style={styles.backlogPct}>{syncPct}%</Text>
          </View>
          <Text style={styles.backlogSub}>
            {backlogSynced.toLocaleString()} / {backlogTotal.toLocaleString()} frames
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${syncPct}%` as 'auto' }]} />
          </View>
        </View>
      )}

      {/* ── Gateway type selector ─────────────────────────────────────── */}
      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>GATEWAY TYPE</Text>
      <View style={styles.gatewayTypeRow}>
        <TouchableOpacity
          onPress={() => updateConfig({ gatewayType: 'iothub' })}
          style={[
            styles.gatewayTypeBtn,
            { borderColor: activeConfig.gatewayType === 'iothub' ? C.blue : C.border, backgroundColor: activeConfig.gatewayType === 'iothub' ? C.blue + '11' : 'transparent' }
          ]}
        >
          <Text style={[styles.gatewayTypeBtnLabel, { color: activeConfig.gatewayType === 'iothub' ? C.blue : C.textMuted }]}>☁️ Azure Event Hub</Text>
          <Text style={styles.gatewayTypeBtnSub}>MQTT via IoT Hub</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => updateConfig({ gatewayType: 'kafka' })}
          style={[
            styles.gatewayTypeBtn,
            { borderColor: activeConfig.gatewayType === 'kafka' ? C.green : C.border, backgroundColor: activeConfig.gatewayType === 'kafka' ? C.green + '11' : 'transparent' }
          ]}
        >
          <Text style={[styles.gatewayTypeBtnLabel, { color: activeConfig.gatewayType === 'kafka' ? C.green : C.textMuted }]}>🔴 Kafka Broker</Text>
          <Text style={styles.gatewayTypeBtnSub}>Native Kafka Protocol</Text>
        </TouchableOpacity>
      </View>

      {/* ── Kafka configuration fields ───────────────────────────────── */}
      {activeConfig.gatewayType === 'kafka' && (
        <View style={styles.kafkaConfigSection}>
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>KAFKA CONFIGURATION</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Bootstrap Server</Text>
            <TextInput
              style={styles.textInput}
              placeholder="192.168.1.22:9092"
              placeholderTextColor={C.textMuted}
              value={activeConfig.kafkaBootstrap}
              onChangeText={(val) => updateConfig({ kafkaBootstrap: val })}
            />
            <Text style={styles.formHint}>Default: 192.168.1.22:9092 (Redpanda on network)</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Topic Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="iot-telemetry"
              placeholderTextColor={C.textMuted}
              value={activeConfig.kafkaTopic}
              onChangeText={(val) => updateConfig({ kafkaTopic: val })}
            />
            <Text style={styles.formHint}>Default: iot-telemetry</Text>
          </View>

          <View style={styles.kafkaInfoBox}>
            <Text style={styles.kafkaInfoText}>ℹ️ Messages are published in Junction format using native Kafka protocol (not MQTT). Ensure consumer (run_consumer_local.py) is running.</Text>
          </View>
        </View>
      )}

      {/* ── Event Hub Gateway toggle ────────────────────────────────── */}
      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>CLOUD PUBLISHING</Text>
      <ToggleRow
        label="Event Hub Gateway"
        sub={gatewayRunning ? 'Live telemetry streaming active' : 'Offline — data buffered locally'}
        value={gatewayRunning}
        busy={togglingGateway}
        onToggle={handleGatewayToggle}
      />

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {lastError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{lastError}</Text>
          <TouchableOpacity onPress={clearError} style={styles.dismissBtn}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Diagnostics toggle ────────────────────────────────────────– */}
      {activeConfig.gatewayType === 'kafka' && (
        <TouchableOpacity
          onPress={() => setShowDiagnostics(!showDiagnostics)}
          style={[styles.diagnosticsToggle, { borderColor: showDiagnostics ? C.blue : C.border }]}
        >
          <Text style={[styles.diagnosticsToggleText, { color: showDiagnostics ? C.blue : C.textMuted }]}>
            {showDiagnostics ? '▼' : '▶'} Kafka Diagnostics
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Kafka diagnostics panel ───────────────────────────────────- */}
      {activeConfig.gatewayType === 'kafka' && showDiagnostics && (
        <View style={styles.diagnosticsPanel}>
          <Text style={styles.diagnosticsTitle}>Kafka Gateway Diagnostics</Text>
          
          <View style={styles.diagnosticsRow}>
            <Text style={styles.diagnosticsLabel}>Bootstrap Server</Text>
            <Text style={styles.diagnosticsValue}>{activeConfig.kafkaBootstrap}</Text>
          </View>
          
          <View style={styles.diagnosticsRow}>
            <Text style={styles.diagnosticsLabel}>Topic</Text>
            <Text style={styles.diagnosticsValue}>{activeConfig.kafkaTopic}</Text>
          </View>
          
          <View style={styles.diagnosticsRow}>
            <Text style={styles.diagnosticsLabel}>Connection Status</Text>
            <Text style={[styles.diagnosticsValue, { color: statusColor(transportStatus) }]}>
              {capitalize(transportStatus)}
            </Text>
          </View>
          
          <View style={styles.diagnosticsRow}>
            <Text style={styles.diagnosticsLabel}>Gateway Running</Text>
            <Text style={[styles.diagnosticsValue, { color: gatewayRunning ? C.green : C.red }]}>
              {gatewayRunning ? 'ON' : 'OFF'}
            </Text>
          </View>
          
          <View style={styles.diagnosticsRow}>
            <Text style={styles.diagnosticsLabel}>Frames Queued</Text>
            <Text style={styles.diagnosticsValue}>? (check app logs for details)</Text>
          </View>
          
          <Text style={[styles.diagnosticsTitle, { marginTop: 12, fontSize: 12 }]}>
            📋 Troubleshooting Tips
          </Text>
          <Text style={styles.troubleshootText}>
            ✓ Verify Kafka broker is running at {activeConfig.kafkaBootstrap}{'\n'}
            ✓ Confirm consumer (run_consumer_local.py) is running{'\n'}
            ✓ Check topic exists:{'\n'}
            {"   kafka-topics.sh --list --bootstrap-server " + activeConfig.kafkaBootstrap}{'\n'}
            ✓ View messages:{'\n'}
            {"   kafka-console-consumer.sh --topic " + activeConfig.kafkaTopic + " --bootstrap-server " + activeConfig.kafkaBootstrap}{'\n'}
            ✓ Enable verbose logging in device console (Android Studio Logcat)
          </Text>
        </View>
      )}

      {/* ── Info row ─────────────────────────────────────────────────── */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sample interval</Text>
          <Text style={styles.infoValue}>60 s</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Active driver</Text>
          <Text style={styles.infoValue}>{activeDriver}</Text>
        </View>
        {activeConfig.gatewayType === 'kafka' ? (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Kafka Bootstrap</Text>
              <Text style={styles.infoValue}>{activeConfig.kafkaBootstrap}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Topic</Text>
              <Text style={styles.infoValue}>{activeConfig.kafkaTopic}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Hub</Text>
              <Text style={styles.infoValue}>Azure IoT Hub</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Protocol</Text>
              <Text style={styles.infoValue}>MQTT</Text>
            </View>
          </>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Buffer strategy</Text>
          <Text style={styles.infoValue}>Local queue / driver history</Text>
        </View>
      </View>

    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  content:    { padding: 20, paddingBottom: 40 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  menuBtn:    { padding: 8, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  menuBtnText:{ color: C.textPrimary, fontSize: 20 },
  heading:    { fontSize: 28, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
  subHeading: { fontSize: 14, color: C.textMuted },

  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  card: {
    width: '47%',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    alignItems: 'center',
  },
  cardLabel: { fontSize: 11, color: C.textMuted, marginBottom: 6, textAlign: 'center' },
  cardValue: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardSub:   { fontSize: 10, color: C.textMuted, textAlign: 'center' },

  backlogCard: {
    backgroundColor: '#0d1f38',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.blue + '66',
    padding: 14,
    marginBottom: 20,
  },
  backlogHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  backlogTitle:  { color: C.textPrimary, fontWeight: '600', flex: 1 },
  backlogPct:    { color: C.blue, fontWeight: '700' },
  backlogSub:    { color: C.textMuted, fontSize: 12, marginBottom: 8 },
  progressBar:   { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 4, backgroundColor: C.blue, borderRadius: 2 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 8,
  },
  toggleLabel: { fontSize: 15, color: C.textPrimary, fontWeight: '600', marginBottom: 2 },
  toggleSub:   { fontSize: 12, color: C.textMuted, maxWidth: 240 },

  errorBanner: {
    backgroundColor: '#2d1215',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.red,
    padding: 14,
    marginBottom: 16,
    marginTop: 12,
  },
  errorText:   { color: C.red, fontSize: 13, marginBottom: 8 },
  dismissBtn:  { alignSelf: 'flex-end' },
  dismissText: { color: C.blue, fontWeight: '600', fontSize: 13 },

  infoSection: { marginTop: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoLabel: { color: C.textMuted, fontSize: 13 },
  infoValue: { color: C.textPrimary, fontSize: 13, fontWeight: '500' },

  // ── Gateway type selector ──
  gatewayTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  gatewayTypeBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
  },
  gatewayTypeBtnLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  gatewayTypeBtnSub: { fontSize: 11, color: C.textMuted },

  // ── Kafka configuration ──
  kafkaConfigSection: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMuted,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: C.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    color: C.textPrimary,
    padding: 10,
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  formHint: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 4,
  },
  kafkaInfoBox: {
    backgroundColor: '#1a2e1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.green + '44',
    padding: 10,
    marginTop: 8,
  },
  kafkaInfoText: {
    fontSize: 12,
    color: C.green,
  },

  // ── Diagnostics ──
  diagnosticsToggle: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  diagnosticsToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },

  diagnosticsPanel: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.blue + '44',
    padding: 14,
    marginBottom: 16,
  },
  diagnosticsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.blue,
    marginBottom: 10,
  },
  diagnosticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  diagnosticsLabel: {
    fontSize: 12,
    color: C.textMuted,
  },
  diagnosticsValue: {
    fontSize: 12,
    color: C.textPrimary,
    fontWeight: '500',
    fontFamily: 'monospace',
    maxWidth: '50%',
    textAlign: 'right',
  },
  troubleshootText: {
    fontSize: 11,
    color: C.textMuted,
    lineHeight: 16,
    marginTop: 8,
    fontFamily: 'monospace',
  },
});


