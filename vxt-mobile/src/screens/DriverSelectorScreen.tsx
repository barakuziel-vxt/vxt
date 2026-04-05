import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useGatewayStore } from '../store/gatewayStore';
import { DrawerContext } from '../context/DrawerContext';
import { driverManager } from '../core/DriverManager';
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
    type:         'HealthConnect',
    label:        'Health Connect',
    description:  'Reads from the Android Health Connect platform. Supports any compatible wearable or fitness app that writes to Health Connect.',
    capabilities: [
      'Heart Rate (8867-4)',
      'SpO₂ (59408-5)',
      'Blood Pressure (8480-6 / 8462-4)',
      'Resting Heart Rate (8418-4)',
      'HRV (80404-7)',
      'Respiration Rate (9303-9)',
      'Steps (55423-8)',
    ],
    platforms:    ['android'],
    available:    Platform.OS === 'android',
    unavailableReason: Platform.OS !== 'android' ? 'Android only' : undefined,
  },
  {
    type:         'SignalK' as DriverType,
    label:        'SignalK (Marine)',
    description:  'Reads live vessel telemetry from a SignalK server on the local network via REST API. Designed for VXT maritime deployments.',
    capabilities: [
      'GPS Position & Speed',
      'Vessel Heading',
      'Engine Metrics',
      'AIS data',
      'Custom vessel sensors',
    ],
    platforms:    ['all'],
    available:    true,
    unavailableReason: undefined,
  },
  {
    type:         'AppleHealth' as DriverType,
    label:        'Apple Health (HealthKit)',
    description:  'Reads health metrics from Apple HealthKit on iOS. Integration coming in a future release.',
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
];

// ─── Screen ────────────────────────────────────────────────────────────────

export default function DriverSelectorScreen() {
  const { activeDriver, driverRunning, setActiveDriver } = useGatewayStore();
  const { openDrawer } = useContext(DrawerContext);
  const [switching, setSwitching] = React.useState(false);
  const [switchError, setSwitchError] = React.useState<string | null>(null);

  // SignalK URL management
  const signalKDriverRef = driverManager.get('SignalK' as DriverType) as any;
  const [signalKUrl, setSignalKUrl] = React.useState<string>(
    signalKDriverRef?.getBaseUrl?.() ?? 'http://localhost:3000'
  );
  const [urlSaved, setUrlSaved] = React.useState(false);

  function saveSignalKUrl() {
    signalKDriverRef?.setBaseUrl?.(signalKUrl);
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2000);
  }

  async function handleSelect(type: DriverType) {
    // Tapping the already-active driver's switch does nothing (it's locked on)
    if (type === activeDriver || switching || type === ('AppleHealth' as DriverType)) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      await setActiveDriver(type);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setSwitchError(`Could not activate ${type}: ${msg}`);
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
            Select the active data source. Only one driver runs at a time.
          </Text>
        </View>
      </View>

      {/* Error banner */}
      {switchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{switchError}</Text>
          <TouchableOpacity onPress={() => setSwitchError(null)}>
            <Text style={styles.errorDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active driver hint */}
      <View style={styles.hintBanner}>
        <Text style={styles.hintText}>
          ℹ  The active driver's switch is locked ON. Tap a different driver's switch to switch.
        </Text>
      </View>

      {DRIVERS.map(d => {
        const isActive   = d.type === activeDriver;
        const isDisabled = !d.available || switching;

        return (
          <View
            key={d.type}
            style={[
              styles.card,
              isActive   && styles.cardActive,
              isDisabled && styles.cardDisabled,
            ]}
          >
            {/* Header row: title + switch */}
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, isDisabled && styles.textDisabled]}>
                {d.label}
              </Text>
              {d.unavailableReason && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{d.unavailableReason}</Text>
                </View>
              )}
              <Switch
                value={isActive}
                disabled={isDisabled}
                onValueChange={() => handleSelect(d.type)}
                thumbColor={isActive ? C.blue : C.textMuted}
                trackColor={{ false: C.border, true: C.blue + '55' }}
              />
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

            {/* SignalK URL input (shown only when SignalK is active) */}
            {d.type === ('SignalK' as DriverType) && isActive && (
              <View style={styles.urlRow}>
                <Text style={styles.urlLabel}>Server URL</Text>
                <TextInput
                  style={styles.urlInput}
                  value={signalKUrl}
                  onChangeText={setSignalKUrl}
                  placeholder="http://localhost:3000"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <TouchableOpacity style={styles.urlSaveBtn} onPress={saveSignalKUrl}>
                  <Text style={styles.urlSaveText}>{urlSaved ? '✓ Saved' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* HealthConnect limited data warning */}
            {d.type === 'HealthConnect' && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  ℹ️ <Text style={{ fontWeight: 'bold' }}>Limited metrics on Health Connect:</Text>{'\n'}
                  HC shows only data types that Samsung Health syncs to it — some are kept internal by Samsung Health.{'\n\n'}
                  <Text style={{ fontWeight: 'bold' }}>Why you may see fewer metrics:</Text>{'\n'}
                  • RHR, HRV, RR: Samsung Health typically doesn't sync these to HC{'\n'}
                  • SpO₂, BP: Require explicit Galaxy Watch or device measurements{'\n'}
                  • Glucose: Requires manual entry or compatible monitoring device{'\n'}
                  • Steps/Calories/Distance: Show cumulative data from last 7 days{'\n'}
                  • Other metrics: Appear only after at least one measurement is recorded
                </Text>
              </View>
            )}
          </View>
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
    gap: 8,
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

  urlRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
  },
  urlLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  urlInput: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: C.textPrimary,
    fontSize: 13,
    marginBottom: 8,
  },
  urlSaveBtn: {
    alignSelf: 'flex-end',
    backgroundColor: C.blue,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  urlSaveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2d1215',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f85149',
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  errorText: { color: '#f85149', fontSize: 13, flex: 1 },
  errorDismiss: { color: '#f85149', fontWeight: '700', fontSize: 16 },

  hintBanner: {
    backgroundColor: '#0d1f38',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#388bfd55',
    padding: 10,
    marginBottom: 14,
  },
  hintText: { color: '#8b949e', fontSize: 12, lineHeight: 17 },

  warningBanner: {
    backgroundColor: '#0d1f38',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#388bfd',
    padding: 12,
    marginTop: 12,
  },
  warningText: { color: '#a0c4ff', fontSize: 12, lineHeight: 18 },
});
