/**
 * DataSourceScreen — configure where EntityTelemetryRN pulls data from.
 *
 * Options:
 *   Cloud Endpoint  — the VXT Azure cloud API (configurable URL)
 *   Local Endpoint  — a local network server (configurable URL)
 *   Driver Endpoint — the currently active driver (Health Connect, Samsung, etc.)
 *
 * Settings are saved to AsyncStorage on tap of "Save".
 */
import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { DrawerContext } from '../context/DrawerContext';
import {
  DataSourceType,
  DEFAULT_CLOUD_URL,
  DEFAULT_LOCAL_URL,
  loadDataSource,
  saveDataSource,
} from '../hooks/useDataSource';
import { driverManager } from '../core/DriverManager';
import { useGatewayStore } from '../store/gatewayStore';

const C = {
  bg:          '#0d1117',
  card:        '#161b22',
  cardActive:  '#0d1f38',
  border:      '#30363d',
  borderActive:'#388bfd',
  textPrimary: '#e6edf3',
  textMuted:   '#8b949e',
  blue:        '#388bfd',
  green:       '#3fb950',
  red:         '#f85149',
};

// ── Option card ────────────────────────────────────────────────────────────

interface OptionCardProps {
  selected: boolean;
  onPress():  void;
  icon:       string;
  title:      string;
  description:string;
}

function OptionCard({ selected, onPress, icon, title, description }: OptionCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.optionCard, selected && styles.optionCardActive]}
    >
      <View style={styles.optionRadio}>
        <View style={[styles.radioOuter, selected && { borderColor: C.blue }]}>
          {selected && <View style={styles.radioInner} />}
        </View>
      </View>
      <View style={styles.optionContent}>
        <Text style={styles.optionTitle}>{icon}  {title}</Text>
        <Text style={styles.optionDesc}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function DataSourceScreen() {
  const { openDrawer }   = useContext(DrawerContext);
  const { activeDriver } = useGatewayStore();
  const driver = driverManager.get(activeDriver) ?? driverManager.getActive();

  const [type,     setType]     = useState<DataSourceType>('cloud');
  const [cloudUrl, setCloudUrl] = useState(DEFAULT_CLOUD_URL);
  const [localUrl, setLocalUrl] = useState(DEFAULT_LOCAL_URL);
  const [loading,  setLoading]  = useState(true);
  const [saved,    setSaved]    = useState(false);

  // Load saved settings
  useEffect(() => {
    loadDataSource().then(ds => {
      setType(ds.type);
      setCloudUrl(ds.cloudUrl);
      setLocalUrl(ds.localUrl);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    await saveDataSource(type, cloudUrl, localUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.blue} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.heading}>API Endpoints</Text>
          <Text style={styles.subHeading}>Where to pull entity telemetry from</Text>
        </View>
      </View>

      {/* Options */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Select API Endpoint</Text>
      </View>

      <OptionCard
        selected={type === 'cloud'}
        onPress={() => setType('cloud')}
        icon="☁️"
        title="Cloud Endpoint"
        description="Pull data from the VXT cloud API (Azure). Requires internet connection."
      />

      <OptionCard
        selected={type === 'local'}
        onPress={() => setType('local')}
        icon="🏠"
        title="Local Endpoint"
        description="Pull data from a server on your local network. Useful for offline/onboard use."
      />

      <OptionCard
        selected={type === 'driver'}
        onPress={() => setType('driver')}
        icon="🔌"
        title="Driver Endpoint"
        description={
          driver
            ? `Use ${driver.displayName} directly (no server needed).`
            : 'Use the active driver directly (no server needed).'
        }
      />

      {/* URL inputs */}
      {(type === 'cloud' || type === 'local') && (
        <View style={styles.urlSection}>
          <Text style={styles.sectionTitle}>
            {type === 'cloud' ? 'Cloud API URL' : 'Local Server URL'}
          </Text>
          <Text style={styles.urlHint}>
            {type === 'cloud'
              ? 'Base URL of the VXT cloud API (no trailing slash).'
              : 'Base URL of the local VXT API server (e.g. http://192.168.1.29:8000).'}
          </Text>
          <TextInput
            style={styles.urlInput}
            value={type === 'cloud' ? cloudUrl : localUrl}
            onChangeText={type === 'cloud' ? setCloudUrl : setLocalUrl}
            placeholder={type === 'cloud' ? DEFAULT_CLOUD_URL : DEFAULT_LOCAL_URL}
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
      )}

      {/* Current driver info */}
      {type === 'driver' && (
        <View style={styles.driverInfo}>
          <Text style={styles.driverInfoTitle}>Active Driver</Text>
          {driver ? (
            <>
              <Text style={styles.driverInfoName}>{driver.displayName}</Text>
              <Text style={styles.driverInfoNote}>
                Latest values and history will come directly from {driver.displayName}.{'\n'}
                Events are not available in driver mode.
              </Text>
            </>
          ) : (
            <Text style={[styles.driverInfoNote, { color: C.red }]}>
              No driver is currently active. Go to Driver Selection to enable one.
            </Text>
          )}
        </View>
      )}

      {/* Save button */}
      <TouchableOpacity
        onPress={handleSave}
        style={[styles.saveBtn, saved && { backgroundColor: C.green }]}
        activeOpacity={0.8}
      >
        <Text style={styles.saveBtnText}>{saved ? '✓ Saved' : 'Save'}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 50 },
  centered:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  // header
  pageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  menuBtn:    { padding: 8, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  menuBtnText:{ color: C.textPrimary, fontSize: 20 },
  heading:    { fontSize: 26, fontWeight: '700', color: C.textPrimary },
  subHeading: { fontSize: 12, color: C.textMuted, marginTop: 2 },

  sectionHeader: { marginBottom: 12 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: C.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8 },

  // option cards
  optionCard: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: C.card,
    borderRadius:    12,
    borderWidth:     1.5,
    borderColor:     C.border,
    padding:         14,
    marginBottom:    10,
  },
  optionCardActive: { borderColor: C.blue, backgroundColor: C.cardActive },

  optionRadio:  { marginRight: 14 },
  radioOuter:   { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  radioInner:   { width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue },
  optionContent:{ flex: 1 },
  optionTitle:  { fontSize: 15, fontWeight: '600', color: C.textPrimary, marginBottom: 3 },
  optionDesc:   { fontSize: 12, color: C.textMuted, lineHeight: 17 },

  // URL section
  urlSection: {
    backgroundColor: C.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         14,
    marginTop:       8,
    marginBottom:    16,
  },
  urlHint:  { fontSize: 12, color: C.textMuted, marginTop: 4, marginBottom: 10, lineHeight: 17 },
  urlInput: {
    backgroundColor: '#0d1117',
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     C.border,
    color:           C.textPrimary,
    fontSize:        13,
    fontFamily:      'monospace',
    paddingHorizontal: 12,
    paddingVertical:   10,
  },

  // driver info
  driverInfo: {
    backgroundColor: C.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         14,
    marginTop:       8,
    marginBottom:    16,
  },
  driverInfoTitle:{ fontSize: 12, color: C.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  driverInfoName: { fontSize: 18, fontWeight: '700', color: C.blue, marginBottom: 6 },
  driverInfoNote: { fontSize: 12, color: C.textMuted, lineHeight: 18 },

  // save button
  saveBtn:     { backgroundColor: C.blue, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
