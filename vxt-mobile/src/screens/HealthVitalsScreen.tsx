import React, { useContext } from 'react';
import {
  AppState,
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

import CorrelationChart from '../components/CorrelationChart';
import type { ChartSeries } from '../components/CorrelationChart';
import { DrawerContext } from '../context/DrawerContext';
import { driverManager } from '../core/DriverManager';
import { useGatewayStore } from '../store/gatewayStore';
import { METRIC_DEFS, formatMetricValue, buildDynamicDef, VC } from '../vitals/VitalsDefs';
import type { MetricDef } from '../vitals/VitalsDefs';
import type { SnapshotMap, HistoryMap } from '../core/types';

// ─── Colour palette ────────────────────────────────────────────────────────
const C = {
  bg:          '#0d1117',
  card:        '#161b22',
  cardActive:  '#0d1f38',
  border:      '#30363d',
  textPrimary: '#e6edf3',
  textMuted:   '#8b949e',
  blue:        VC.blue,
  red:         VC.red,
  green:       VC.green,
};

function ago(ts: number | null): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 120_000)    return 'just now';    // < 2 min
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)} min ago`;
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const isToday = d.toDateString() === new Date().toDateString();
  if (isToday) return `today ${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

// ─── Metric tile ───────────────────────────────────────────────────────────

interface MetricTileProps {
  def:       MetricDef;
  value:     number | null;
  timestamp: number | null;
  selected:  boolean;
  onPress(): void;
}

function MetricTile({ def, value, timestamp, selected, onPress }: MetricTileProps) {
  const displayColor = value !== null ? def.rangeColor(value) : C.textMuted;
  const displayVal   = value === null ? '—' : formatMetricValue(def, value);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tile, selected && { borderColor: def.color, backgroundColor: C.cardActive }]}
      activeOpacity={0.75}
    >
      <View style={[styles.tileBar, { backgroundColor: def.color }]} />
      <Text style={styles.tileLabel}>{def.label}</Text>
      <Text style={[styles.tileValue, { color: displayColor }]}>
        {displayVal}
        {value !== null && def.unit ? <Text style={styles.tileUnit}> {def.unit}</Text> : null}
      </Text>
      <Text style={styles.tileTime}>{ago(timestamp)}</Text>
      {selected && (
        <View style={[styles.tileSelectedBadge, { backgroundColor: def.color + '33' }]}>
          <Text style={[styles.tileSelectedText, { color: def.color }]}>in graph</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Quick range presets ───────────────────────────────────────────────────

const PRESETS = [
  { label: '30m', ms: 30 * 60_000 },
  { label: '1h',  ms: 3600_000 },
  { label: '6h',  ms: 6 * 3600_000 },
  { label: '12h', ms: 12 * 3600_000 },
  { label: '24h', ms: 24 * 3600_000 },
  { label: '7d',  ms: 7 * 86400_000 },
  { label: '30d', ms: 30 * 86400_000 },
];

// ─── Main Screen ──────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 60_000;

export default function HealthVitalsScreen() {
  const { openDrawer } = useContext(DrawerContext);
  // activeDriver from store makes this screen reactive to driver changes
  const { activeDriver } = useGatewayStore();

  const driver = driverManager.get(activeDriver) ?? driverManager.getActive();

  // ── Snapshot state ───────────────────────────────────────────────────
  const [live,       setLive]       = React.useState<SnapshotMap>({});
  const [loading,    setLoading]    = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  // ── Chart state ──────────────────────────────────────────────────────
  const [selectedMetrics, setSelectedMetrics] = React.useState<Record<string,boolean>>(
    () => Object.fromEntries(METRIC_DEFS.filter(m => m.defaultOn).map(m => [m.key, true]))
  );
  const [startDate,   setStartDate]   = React.useState(() => new Date(Date.now() - 3_600_000));
  const [endDate,     setEndDate]     = React.useState(() => new Date());
  const [historyData, setHistoryData] = React.useState<HistoryMap>({});
  const [historyLoad, setHistoryLoad] = React.useState(false);
  const [historyErr,  setHistoryErr]  = React.useState<string | null>(null);
  const [activePreset, setActivePreset] = React.useState('1h');

  // ── Permissions state ────────────────────────────────────────────────
  const [permGranted,     setPermGranted]     = React.useState<boolean | null>(null);
  const [permBusy,        setPermBusy]        = React.useState(false);
  const [hcNotInstalled,  setHcNotInstalled]  = React.useState(false);

  // ── Layout state ──────────────────────────────────────────────────────
  const [chartW, setChartW] = React.useState(0);

  // ── Fetch latest ─────────────────────────────────────────────────────
  async function fetchLatest(d = driver) {
    if (!d) return;
    try {
      const snapshot = await d.getLatest();
      if (snapshot) setLive(snapshot);
    } catch { /* keep stale values */ }
  }

  // ── Fetch history ─────────────────────────────────────────────────────
  async function fetchHistory(d = driver) {
    if (!d) return;
    setHistoryLoad(true);
    setHistoryErr(null);
    try {
      const data = await d.getHistory(startDate.getTime(), endDate.getTime());
      // Only update if we got actual data — don't wipe existing chart on empty response
      if (Object.keys(data).length > 0) setHistoryData(data);

  // ── Request permissions — opens HC settings screen ──────────────────
  // After user toggles permissions in HC app and returns, the AppState
  // listener re-checks automatically.
  async function requestPerms(d = driver): Promise<boolean> {
    if (!d) return false;
    setPermBusy(true);
    try {
      await d.requestPermissions();
      // requestPermissions now opens HC settings — resolve immediately
      // Permissions are re-checked by AppState listener on foreground return
      return false;
    } catch { return false; }
    finally { setPermBusy(false); }
  }

  // ── Init (re-runs on driver switch) ──────────────────────────────────
  React.useEffect(() => {
    const d = driverManager.get(activeDriver) ?? driverManager.getActive();
    setPermGranted(null);
    setLive({});
    setHistoryData({});
    setLoading(true);

    void (async () => {
      if (!d) { setLoading(false); return; }
      // Check if the driver/hardware is installed at all (e.g. Health Connect app)
      const available = await d.isAvailable().catch(() => true);
      if (!available) {
        setHcNotInstalled(true);
        setLoading(false);
        return;
      }
      setHcNotInstalled(false);
      const already = await d.checkPermissions().catch(() => false);
      setPermGranted(already);
      // Do NOT auto-request here — HC throttles the dialog if shown more than once
      // per session. The user must tap "Grant Permissions" to trigger the dialog.
      if (!already) { setLoading(false); return; }
      await Promise.all([fetchLatest(d), fetchHistory(d)]);
      setLoading(false);
    })();

    const id = setInterval(() => { fetchLatest(); }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDriver]);

  React.useEffect(() => { fetchHistory(); }, [startDate, endDate]);

  // Re-check permissions whenever app returns to foreground
  // (covers user returning from HC settings after granting permissions)
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const d = driverManager.get(activeDriver) ?? driverManager.getActive();
      if (!d) return;
      void (async () => {
        const available = await d.isAvailable().catch(() => true);
        if (!available) { setHcNotInstalled(true); return; }
        setHcNotInstalled(false);
        const granted = await d.checkPermissions().catch(() => false);
        if (granted && !permGranted) {
          setPermGranted(true);
          setLoading(true);
          await Promise.all([fetchLatest(d), fetchHistory(d)]);
          setLoading(false);
        } else if (granted) {
          // Silently refresh data even if already granted
          await Promise.all([fetchLatest(d), fetchHistory(d)]);
        }
      })();
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDriver, permGranted]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([fetchLatest(), fetchHistory()]);
    setRefreshing(false);
  }

  function applyPreset(p: typeof PRESETS[0]) {
    const end   = new Date();
    const start = new Date(end.getTime() - p.ms);
    setEndDate(end);
    setStartDate(start);
    setActivePreset(p.label);
  }

  function toggleMetric(key: string) {
    setSelectedMetrics(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // ── Derive displayed metric defs from live snapshot ───────────────────
  // Show any key returned by the driver; use METRIC_DEFS catalog for display hints.
  // Extra keys (driver-specific, not in catalog) get a dynamic def automatically.
  const liveKeys    = Object.keys(live);
  const catalogKeys = new Set(METRIC_DEFS.map(m => m.key));
  const catalogDefs = METRIC_DEFS.filter(m => liveKeys.includes(m.key));
  const extraDefs   = liveKeys
    .filter(k => !catalogKeys.has(k))
    .map((k, i) => buildDynamicDef(k, METRIC_DEFS.length + i));
  const displayDefs: MetricDef[] = [...catalogDefs, ...extraDefs];

  // ── Chart series — time-binned for aligned multi-series display ─────────
  const chartData = React.useMemo(() => {
    const from = startDate.getTime();
    const to   = endDate.getTime();
    if (to <= from) return null;
    const candidates = displayDefs.filter(
      m => selectedMetrics[m.key] && (historyData[m.key]?.length ?? 0) > 0,
    );
    if (candidates.length === 0) return null;

    const NUM_BINS = 80;
    const binW     = (to - from) / NUM_BINS;
    const binTimes = Array.from({ length: NUM_BINS }, (_, i) => from + (i + 0.5) * binW);

    const chartSeries: ChartSeries[] = [];
    for (const def of candidates) {
      const raw  = historyData[def.key] ?? [];
      const sums = new Array<number>(NUM_BINS).fill(0);
      const cnts = new Array<number>(NUM_BINS).fill(0);
      for (const pt of raw) {
        if (pt.ts < from || pt.ts > to) continue;
        const idx = Math.min(Math.floor((pt.ts - from) / binW), NUM_BINS - 1);
        sums[idx] += pt.v;
        cnts[idx] += 1;
      }
      const values: (number | null)[] = sums.map((s, i) => cnts[i] > 0 ? s / cnts[i] : null);
      // Forward-fill gaps
      let last: number | null = null;
      for (let i = 0; i < NUM_BINS; i++) {
        if (values[i] !== null) last = values[i];
        else if (last !== null) values[i] = last;
      }
      const filled = values.filter((v): v is number => v !== null);
      if (filled.length === 0) continue;
      chartSeries.push({
        key: def.key, def, values,
        rawMin: Math.min(...filled), rawMax: Math.max(...filled),
      });
    }

    if (chartSeries.length === 0) return null;

    const unitSet   = new Set(chartSeries.map(s => s.def.unit));
    const normalise = chartSeries.length > 1 && unitSet.size > 1;

    return { chartSeries, binTimes, normalise };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyData, selectedMetrics, startDate, endDate]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} colors={[C.blue]} />}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.heading}>Health Vitals</Text>
          <Text style={styles.subHeading}>
            {driver ? driver.displayName : 'No data source configured'}
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↺ Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* No driver */}
      {!driver && (
        <View style={styles.noDataBox}>
          <Text style={styles.noDataText}>
            No data source selected.{'\n'}Open Driver Selection to enable a driver.
          </Text>
        </View>
      )}

      {/* Health Connect not installed banner */}
      {driver && hcNotInstalled && (
        <View style={styles.permBanner}>
          <Text style={styles.permBannerText}>
            ⚠ Health Connect is not installed on this device.{'\n'}It is required to read health data from your wearables.
          </Text>
          <TouchableOpacity
            style={[styles.refreshBtn, { marginTop: 8, alignSelf: 'flex-start' }]}
            onPress={() => {
              const { Linking } = require('react-native');
              Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata');
            }}
          >
            <Text style={styles.refreshText}>Install Health Connect</Text>
          </TouchableOpacity>
          <Text style={[styles.permBannerText, { marginTop: 6, fontSize: 11 }]}>
            After installing, return here and pull down to refresh.
          </Text>
        </View>
      )}

      {/* Permission banner */}
      {driver && !hcNotInstalled && permGranted === false && !permBusy && (
        <View style={styles.permBanner}>
          <Text style={styles.permBannerText}>
            ⚠ Permissions not granted for {driver.displayName}.
          </Text>
          <TouchableOpacity
            style={[styles.refreshBtn, { marginTop: 8, alignSelf: 'flex-start' }]}
            onPress={() => requestPerms()}
          >
            <Text style={styles.refreshText}>Grant Permissions</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading */}
      {loading && driver && (
        <View style={styles.centeredRow}>
          <ActivityIndicator color={C.blue} />
          <Text style={[styles.subHeading, { marginLeft: 8 }]}>Loading {driver.displayName}…</Text>
        </View>
      )}

      {/* Latest Values */}
      {!loading && displayDefs.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📌 Latest Values</Text>
            <Text style={styles.sectionSub}>Tap to show/hide in graph</Text>
          </View>
          <View style={styles.tileGrid}>
            {displayDefs.map(def => {
              const entry = live[def.key];
              return (
                <MetricTile
                  key={def.key}
                  def={def}
                  value={entry?.value ?? null}
                  timestamp={entry?.ts ?? null}
                  selected={!!selectedMetrics[def.key]}
                  onPress={() => toggleMetric(def.key)}
                />
              );
            })}
          </View>
        </>
      )}

      {!loading && driver && displayDefs.length === 0 && permGranted !== false && (
        <View style={styles.noDataBox}>
          <Text style={styles.noDataText}>No readings available from {driver.displayName} yet.</Text>
        </View>
      )}

      {/* History range */}
      {driver && (
        <View style={[styles.rangeCard, { marginTop: 20 }]}>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>📈 History Range</Text>
          <View style={styles.presetRow}>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p.label}
                onPress={() => applyPreset(p)}
                style={[styles.presetChip, p.label === activePreset && styles.presetChipActive]}
              >
                <Text style={[styles.presetText, p.label === activePreset && { color: C.bg }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Chart */}
      {chartData && chartData.chartSeries.length > 0 && (
        <View style={styles.chartCard} onLayout={e => setChartW(e.nativeEvent.layout.width)}>
          <View style={styles.chartLegend}>
            {chartData.chartSeries.map(({ def, rawMin, rawMax }) => (
              <View key={def.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: def.color }]} />
                <Text style={[styles.legendLabel, { color: def.color }]}>
                  {def.label}{def.unit ? ` (${def.unit})` : ''}
                  {chartData.normalise ? `  ${rawMin.toFixed(0)}–${rawMax.toFixed(0)}` : ''}
                </Text>
              </View>
            ))}
            {chartData.normalise && (
              <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>Y-axis: 0–100 % (normalised per metric)</Text>
            )}
          </View>
          {historyErr && <View style={styles.errorBox}><Text style={styles.errorText}>{historyErr}</Text></View>}
          {historyLoad && <View style={styles.centeredRow}><ActivityIndicator color={C.blue} /></View>}
          {!historyLoad && chartW > 0 && (
            <CorrelationChart
              series={chartData.chartSeries}
              binTimesMs={chartData.binTimes}
              normalise={chartData.normalise}
              width={chartW - 28}
            />
          )}
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}



// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 50 },

  // header
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  menuBtn:    { padding: 8, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  menuBtnText:{ color: C.textPrimary, fontSize: 20 },
  heading:    { fontSize: 26, fontWeight: '700', color: C.textPrimary },
  subHeading: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  refreshBtn: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 7 },
  refreshText:{ color: C.blue, fontWeight: '600', fontSize: 13 },

  // section headers
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  sectionSub:    { fontSize: 11, color: C.textMuted },

  // metric tile grid — 3 per row
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tile: {
    width: '31.5%',
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 8,
    paddingTop: 0,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  tileBar:          { height: 3, borderRadius: 1, marginBottom: 7, marginHorizontal: -8 },
  tileLabel:        { fontSize: 10, color: C.textMuted, marginBottom: 2 },
  tileValue:        { fontSize: 21, fontWeight: '700' },
  tileUnit:         { fontSize: 11, fontWeight: '400', color: C.textMuted },
  tileTime:         { fontSize: 9, color: C.textMuted, marginTop: 1 },
  tileSelectedBadge:{ alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 3 },
  tileSelectedText: { fontSize: 9, fontWeight: '600' },

  // date range card
  rangeCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 16,
  },
  presetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  presetChipActive: { backgroundColor: C.blue, borderColor: C.blue },
  presetText: { fontSize: 12, color: C.textPrimary, fontWeight: '500' },

  // chart cards
  chartCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 14,
    overflow: 'visible',
  },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: '600' },


  // util
  centeredRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20 },
  noDataBox:   { backgroundColor: C.card, borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  noDataText:  { color: C.textMuted, fontSize: 13, textAlign: 'center' },
  errorBox:    { backgroundColor: '#2d1215', borderRadius: 10, padding: 14, marginBottom: 12 },
  errorText:   { color: C.red, fontSize: 13 },
  permBanner:  { backgroundColor: '#2d1f00', borderRadius: 10, borderWidth: 1, borderColor: '#f0a500', padding: 12, marginBottom: 14 },
  permBannerText: { color: '#f0c040', fontSize: 13, lineHeight: 19 },
  loadingText: { color: C.textMuted, fontSize: 14 },
});
