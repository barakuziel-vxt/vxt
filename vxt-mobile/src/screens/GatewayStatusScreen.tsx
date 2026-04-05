import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
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
  } = useGatewayStore();
  const { openDrawer } = useContext(DrawerContext);

  const [togglingGateway, setTogglingGateway] = React.useState(false);

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
          <Text style={styles.heading}>VXT Gateway</Text>
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
          <Text style={styles.cardLabel}>Azure IoT Hub</Text>
          <Text style={[styles.cardValue, { color: statusColor(transportStatus) }]}>
            {capitalize(transportStatus)}
          </Text>
          <Text style={styles.cardSub}>MQTT / TLS</Text>
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

      {/* ── Gateway toggle ────────────────────────────────────────────── */}
      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>CLOUD PUBLISHING</Text>
      <ToggleRow
        label="Azure IoT Gateway"
        sub={gatewayRunning ? 'Live telemetry streaming to Azure IoT Hub' : 'Offline — data buffered in Samsung Health'}
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

      {/* ── Info row ─────────────────────────────────────────────────── */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sample interval</Text>
          <Text style={styles.infoValue}>60 s</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>IoT Hub device</Text>
          <Text style={styles.infoValue}>TestDevice</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Hub</Text>
          <Text style={styles.infoValue}>VXT-IoT-Hub</Text>
        </View>
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
});


