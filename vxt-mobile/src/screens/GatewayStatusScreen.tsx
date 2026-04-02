import React from 'react';
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
};

// ─── Status badge helpers ──────────────────────────────────────────────────

function driverColor(s: ConnectionStatus) {
  return s === 'connected'   ? C.green
       : s === 'connecting'  ? C.yellow
       : s === 'error'       ? C.red
       : C.textMuted;
}

function transportColor(s: TransportStatus) {
  return s === 'connected'   ? C.green
       : s === 'connecting'  ? C.yellow
       : s === 'error'       ? C.red
       : C.textMuted;
}

function driverLabel(s: ConnectionStatus) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Main screen ───────────────────────────────────────────────────────────

export default function GatewayStatusScreen() {
  const {
    isRunning,
    driverStatus,
    transportStatus,
    activeDriver,
    framesSent,
    lastError,
    startGateway,
    stopGateway,
    clearError,
  } = useGatewayStore();

  const [toggling, setToggling] = React.useState(false);

  async function handleToggle() {
    if (toggling) return;
    setToggling(true);
    try {
      isRunning ? await stopGateway() : await startGateway();
    } finally {
      setToggling(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <Text style={styles.heading}>VXT Gateway</Text>
      <Text style={styles.subHeading}>Telemetry pipeline status</Text>

      {/* ── Status cards ─────────────────────────────────────────────── */}
      <View style={styles.cardRow}>
        {/* Driver card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Driver</Text>
          <Text style={[styles.cardValue, { color: driverColor(driverStatus) }]}>
            {driverLabel(driverStatus)}
          </Text>
          <Text style={styles.cardSub}>{activeDriver}</Text>
        </View>

        {/* Transport card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Azure IoT Hub</Text>
          <Text style={[styles.cardValue, { color: transportColor(transportStatus) }]}>
            {driverLabel(transportStatus)}
          </Text>
          <Text style={styles.cardSub}>MQTT / TLS</Text>
        </View>

        {/* Frames card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Frames Sent</Text>
          <Text style={[styles.cardValue, { color: C.blue }]}>
            {framesSent.toLocaleString()}
          </Text>
          <Text style={styles.cardSub}>session total</Text>
        </View>
      </View>

      {/* ── Toggle ───────────────────────────────────────────────────── */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>
          {isRunning ? 'Gateway running' : 'Gateway stopped'}
        </Text>
        {toggling ? (
          <ActivityIndicator color={C.blue} />
        ) : (
          <Switch
            value={isRunning}
            onValueChange={handleToggle}
            thumbColor={isRunning ? C.green : C.textMuted}
            trackColor={{ false: C.border, true: C.green + '55' }}
          />
        )}
      </View>

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
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Sample interval</Text>
        <Text style={styles.infoValue}>5 s</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>IoT Hub device</Text>
        <Text style={styles.infoValue}>TestDevice</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Hub</Text>
        <Text style={styles.infoValue}>VXT-IoT-Hub</Text>
      </View>

    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  content:   { padding: 20, paddingBottom: 40 },
  heading:   { fontSize: 28, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
  subHeading:{ fontSize: 14, color: C.textMuted, marginBottom: 24 },

  cardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  card: {
    flex: 1,
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

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginBottom: 16,
  },
  toggleLabel: { fontSize: 16, color: C.textPrimary, fontWeight: '500' },

  errorBanner: {
    backgroundColor: '#2d1215',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.red,
    padding: 14,
    marginBottom: 16,
  },
  errorText:   { color: C.red, fontSize: 13, marginBottom: 8 },
  dismissBtn:  { alignSelf: 'flex-end' },
  dismissText: { color: C.blue, fontWeight: '600', fontSize: 13 },

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
