import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useGatewayStore } from '../store/gatewayStore';
import { DrawerContext } from '../context/DrawerContext';
import type { DriverType } from '../core/types';

// ─── Colour palette ────────────────────────────────────────────────────────
const C = {
  bg:          '#0d1117',
  card:        '#161b22',
  cardActive:  '#0d2137',
  border:      '#30363d',
  borderActive:'#388bfd',
  textPrimary: '#e6edf3',
  textMuted:   '#8b949e',
  green:       '#3fb950',
  yellow:      '#d29922',
  red:         '#f85149',
  blue:        '#388bfd',
};

// ─── Driver catalogue ─────────────────────────────────────────────────────

interface DriverEntry {
  type:          DriverType;
  label:         string;
  description:   string;
  capabilities:  string[];
  platforms:     ('android' | 'ios' | 'all')[];
  available:     boolean;
  unavailableReason?: string;
}

const DRIVERS: DriverEntry[] = [
  {
    type:         'SamsungHealth',
    label:        'Samsung Health',
    description:  'Reads health metrics from Samsung Health app via the official Health Data SDK. Requires a paired Galaxy Watch for continuous vitals.',
    capabilities: [
      'Heart Rate (LOINC 8867-4)',
      'SpO₂ / Oxygen Saturation (59408-5)',
      'Blood Pressure SBP/DBP (8480-6 / 8462-4)',
      'Body Temperature (8310-5)',
      'Blood Glucose (2339-0)',
      'Steps (55423-8)',
      'AFib Detection (73773-1)',
    ],
    platforms:    ['android'],
    available:    Platform.OS === 'android',
    unavailableReason: Platform.OS !== 'android' ? 'Android only' : undefined,
  },
  {
    type:         'AppleHealth' as DriverType,
    label:        'Apple Health (HealthKit)',
    description:  'Reads health metrics from Apple HealthKit. Requires iOS and appropriate permissions.',
    capabilities: [
      'Heart Rate',
      'SpO₂',
      'Blood Pressure',
      'Body Temperature',
      'Steps',
    ],
    platforms:    ['ios'],
    available:    false,
    unavailableReason: 'Coming soon',
  },
  {
    type:         'SignalK' as DriverType,
    label:        'SignalK (Marine)',
    description:  'Reads telemetry from a SignalK server on the local network. Designed for VXT vessel deployments.',
    capabilities: [
      'GPS Position',
      'Vessel Speed & Heading',
      'Engine Metrics',
      'AIS',
    ],
    platforms:    ['all'],
    available:    false,
    unavailableReason: 'Coming soon',
  },
  {
    type:         'Manual' as DriverType,
    label:        'Manual Entry',
    description:  'Manually submit health readings from the app. Useful for devices without automatic sensors.',
    capabilities: [
      'Heart Rate (manual)',
      'Blood Pressure (manual)',
      'Blood Glucose (manual)',
    ],
    platforms:    ['all'],
    available:    false,
    unavailableReason: 'Coming soon',
  },
];

// ─── Screen ────────────────────────────────────────────────────────────────

export default function DriverSelectorScreen() {
  const { activeDriver, driverRunning, setActiveDriver } = useGatewayStore();
  const { openDrawer } = useContext(DrawerContext);
  const [switching, setSwitching] = React.useState(false);

  async function handleSelect(type: DriverType) {
    if (type === activeDriver || switching) return;
    setSwitching(true);
    try {
      await setActiveDriver(type);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.heading}>Driver Selection</Text>
          <Text style={styles.subHeading}>
            Choose the data source for telemetry collection.
            {driverRunning ? ' Driver will restart on change.' : ''}
          </Text>
        </View>
      </View>

      {DRIVERS.map(d => {
        const isActive   = d.type === activeDriver;
        const isDisabled = !d.available || switching;

        return (
          <TouchableOpacity
            key={d.type}
            activeOpacity={isDisabled ? 1 : 0.75}
            onPress={() => d.available && handleSelect(d.type)}
            style={[
              styles.card,
              isActive   && styles.cardActive,
              isDisabled && styles.cardDisabled,
            ]}
          >
            {/* Header row */}
            <View style={styles.cardHeader}>
              <View style={styles.radioOuter}>
                {isActive && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.cardTitle, isDisabled && styles.textDisabled]}>
                {d.label}
              </Text>
              {d.unavailableReason && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{d.unavailableReason}</Text>
                </View>
              )}
              {isActive && !d.unavailableReason && (
                <View style={[styles.badge, styles.badgeActive]}>
                  <Text style={[styles.badgeText, { color: C.green }]}>Active</Text>
                </View>
              )}
            </View>

            {/* Description */}
            <Text style={[styles.cardDesc, isDisabled && styles.textDisabled]}>
              {d.description}
            </Text>

            {/* Capabilities */}
            <View style={styles.capsRow}>
              {d.capabilities.map(cap => (
                <View key={cap} style={[styles.cap, isDisabled && styles.capDisabled]}>
                  <Text style={[styles.capText, isDisabled && styles.textDisabled]}>
                    {cap}
                  </Text>
                </View>
              ))}
            </View>

            {/* Platform */}
            <Text style={styles.platform}>
              Platform: {d.platforms.includes('all') ? 'iOS / Android' : d.platforms.join(', ')}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingBottom: 40 },

  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  menuBtn:    { padding: 8, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  menuBtnText:{ color: C.textPrimary, fontSize: 20 },
  heading:    { fontSize: 28, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
  subHeading: { fontSize: 14, color: C.textMuted },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 14,
  },
  cardActive: {
    backgroundColor: C.cardActive,
    borderColor: C.borderActive,
  },
  cardDisabled: {
    opacity: 0.55,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.blue,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
    flex: 1,
  },
  textDisabled: { color: C.textMuted },

  badge: {
    backgroundColor: '#1c2128',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  badgeActive: { borderColor: C.green + '55' },
  badgeText: { fontSize: 11, color: C.textMuted, fontWeight: '600' },

  cardDesc: {
    fontSize: 13,
    color: C.textMuted,
    lineHeight: 19,
    marginBottom: 12,
  },

  capsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  cap: {
    backgroundColor: '#1c2128',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  capDisabled: { borderColor: C.border },
  capText: { fontSize: 11, color: C.blue },

  platform: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
