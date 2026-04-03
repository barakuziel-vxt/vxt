import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { DrawerContext } from '../context/DrawerContext';

import { vitalsRegistry }                                  from '../vitals/registry';
import { METRIC_DEFS, formatMetricValue,
         buildDynamicDef, VC }                             from '../vitals/VitalsDefs';
import type { MetricDef }                                  from '../vitals/VitalsDefs';
import type { VitalHistory, VitalSnapshot }                from '../vitals/types';

const { width: SCREEN_W } = Dimensions.get('window');

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
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(ts).toLocaleDateString();
}
function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

// ─── Types used inside this screen ────────────────────────────────────────

type LiveMap = Record<string, { value: number; timestamp: number } | null>;

// ─── Metric tile (click-to-select, EntityTelemetry style) ─────────────────

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

const REFRESH_INTERVAL_MS = 30_000;
const MAX_CHART_POINTS    = 300;

export default function HealthVitalsScreen() {
  const { openDrawer } = useContext(DrawerContext);

  // ── Provider state ───────────────────────────────────────────────────
  const allProviders  = vitalsRegistry.getAll();
  const [activeId, setActiveId] = React.useState<string>(
    () => vitalsRegistry.getActive()?.id ?? ''
  );

  function selectProvider(id: string) {
    vitalsRegistry.setActive(id);
    setActiveId(id);
  }

  const provider = vitalsRegistry.getActive();

  // ── Live latest values ───────────────────────────────────────────────
  const [live,        setLive]        = React.useState<LiveMap>({});
  const [latestLoad,  setLatestLoad]  = React.useState(true);
  const [refreshing,  setRefreshing]  = React.useState(false);

  // ── Graph state ──────────────────────────────────────────────────────
  const [selectedMetrics, setSelectedMetrics] = React.useState<Record<string,boolean>>(
    () => Object.fromEntries(METRIC_DEFS.filter(m => m.defaultOn).map(m => [m.key, true]))
  );
  const [startDate,    setStartDate]   = React.useState(() => new Date(Date.now() - 3600_000));
  const [endDate,      setEndDate]     = React.useState(() => new Date());
  const [historyData,  setHistoryData] = React.useState<VitalHistory>({});
  const [historyLoad,  setHistoryLoad] = React.useState(false);
  const [historyErr,   setHistoryErr]  = React.useState<string | null>(null);
  const [activePreset, setActivePreset] = React.useState('1h');
  const [deviceName,   setDeviceName]  = React.useState<string | null>(null);
  const [permGranted,  setPermGranted] = React.useState<boolean | null>(null);
  const [permBusy,     setPermBusy]    = React.useState(false);

  // ── Fetch latest values ──────────────────────────────────────────────
  async function fetchLatest() {
    if (!provider) return;
    try {
      const snapshots: VitalSnapshot[] = await provider.getLatest();
      const map: LiveMap = {};
      for (const s of snapshots) {
        map[s.key] = { value: s.value, timestamp: s.timestamp };
      }
      setLive(map);
    } catch {
      // provider unavailable — keep stale values
    }
  }

  // ── Fetch history for chart ──────────────────────────────────────────
  async function fetchHistory() {
    if (!provider) return;
    setHistoryLoad(true);
    setHistoryErr(null);
    try {
      const data = await provider.getHistory(startDate.getTime(), endDate.getTime());
      setHistoryData(data);
    } catch (e: any) {
      setHistoryErr(String(e?.message ?? e));
    } finally {
      setHistoryLoad(false);
    }
  }

  // ── Samsung Health permission request ──────────────────────────────
  async function requestSamsungPerms() {
    if (!(provider && typeof (provider as any).requestHealthPermissions === 'function')) return;
    setPermBusy(true);
    try {
      const granted: boolean = await (provider as any).requestHealthPermissions();
      setPermGranted(granted);
      if (granted) {
        setLive({});
        setLatestLoad(true);
        fetchLatest().finally(() => setLatestLoad(false));
        fetchHistory();
      }
    } catch {
      setPermGranted(false);
    } finally {
      setPermBusy(false);
    }
  }

  // ── Permission + init effect ─────────────────────────────────────────
  React.useEffect(() => {
    setPermGranted(null);
    setDeviceName(null);

    if (provider && typeof (provider as any).getConnectedDeviceName === 'function') {
      (provider as any).getConnectedDeviceName()
        .then((n: string | null) => setDeviceName(n))
        .catch(() => {});
    }

    const hasPerm = provider && typeof (provider as any).requestHealthPermissions === 'function';

    void (async () => {
      if (hasPerm) {
        setLive({});
        setHistoryData({});
        setLatestLoad(true);
        // Check existing grants silently — only show dialog if not already granted
        const alreadyGranted: boolean =
          typeof (provider as any).checkHealthPermissions === 'function'
            ? await (provider as any).checkHealthPermissions().catch(() => false)
            : false;

        if (alreadyGranted) {
          console.log('[VXT] Permissions already granted — skipping dialog');
          setPermGranted(true);
          fetchLatest().finally(() => setLatestLoad(false));
          fetchHistory();
        } else {
          console.log('[VXT] Permissions not granted — showing Samsung Health consent dialog...');
          try {
            const granted: boolean = await (provider as any).requestHealthPermissions();
            console.log(`[VXT] Permissions resolved: granted=${granted}`);
            setPermGranted(granted);
            fetchLatest().finally(() => setLatestLoad(false));
            fetchHistory();
          } catch (e: any) {
            console.warn(`[VXT] Permission request threw: ${e?.message ?? e}`);
            setPermGranted(false);
            setLatestLoad(false);
          }
        }
      } else {
        // Non-Samsung provider — fetch immediately
        setLive({});
        setHistoryData({});
        setLatestLoad(true);
        fetchLatest().finally(() => setLatestLoad(false));
        fetchHistory();
      }
    })();

    const id = setInterval(fetchLatest, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  React.useEffect(() => { fetchHistory(); }, [startDate, endDate]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([fetchLatest(), fetchHistory()]);
    setRefreshing(false);
  }

  // ── Preset range handler ─────────────────────────────────────────────
  function applyPreset(p: typeof PRESETS[0]) {
    const end   = new Date();
    const start = new Date(end.getTime() - p.ms);
    setEndDate(end);
    setStartDate(start);
    setActivePreset(p.label);
  }

  // ── Toggle metric in graph ───────────────────────────────────────────
  function toggleMetric(key: string) {
    setSelectedMetrics(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // ── Derive displayed metric defs ─────────────────────────────────────
  // Include catalog metrics + any extra keys returned by the provider.
  // Hide metrics that are permanently unavailable on the active provider.
  const isSamsung   = provider?.id === 'samsung-health';
  const liveKeys    = Object.keys(live);
  const catalogKeys = new Set(METRIC_DEFS.map(m => m.key));
  const extraKeys   = liveKeys.filter(k => !catalogKeys.has(k));
  const displayDefs = [
    ...METRIC_DEFS.filter(m => !isSamsung || !m.samsungUnavailable),
    ...extraKeys.map((k, i) => buildDynamicDef(k, METRIC_DEFS.length + i)),
  ];

  // ── Build combined chart datasets (all selected metrics in one chart) ─
  const activeSeries = React.useMemo(() => {
    return displayDefs
      .filter(m => selectedMetrics[m.key] && (historyData[m.key]?.length ?? 0) > 0)
      .map(def => {
        const raw     = historyData[def.key] ?? [];
        const step    = Math.max(1, Math.floor(raw.length / MAX_CHART_POINTS));
        const sampled = raw.filter((_, idx) => idx % step === 0);
        // If data spans more than one calendar day, show MM/DD instead of HH:MM
        // (daily aggregates are pinned to noon so HH:MM would show "12:00" everywhere)
        const multiDay = sampled.length > 1 &&
          (sampled[sampled.length - 1].ts - sampled[0].ts) > 23 * 3_600_000;
        const fmtLabel = (ts: number) => {
          const d = new Date(ts);
          if (multiDay) {
            return `${(d.getMonth() + 1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
          }
          return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        };
        const pts = sampled.map(s => ({ value: s.v, label: fmtLabel(s.ts), dataPointText: '' }));
        return { key: def.key, def, pts };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyData, selectedMetrics]);

  const noProvider = !provider;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} colors={[C.blue]} />}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.heading}>Health Vitals</Text>
          <Text style={styles.subHeading}>
            {deviceName ?? (provider ? provider.name : 'No data source configured')}
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↺ Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* ── Source Selector ───────────────────────────────────────────── */}
      {allProviders.length > 1 && (
        <View style={styles.sourceRow}>
          <Text style={styles.sourceLabel}>Source  </Text>
          {allProviders.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => selectProvider(p.id)}
              style={[styles.sourceChip, p.id === activeId && styles.sourceChipActive]}
            >
              <Text style={[styles.sourceChipText, p.id === activeId && { color: C.bg }]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {noProvider && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>No vitals provider available on this platform.</Text>
        </View>
      )}

      {/* ── Permission banner (shown when Samsung Health perms denied) ─ */}
      {permGranted === false && (
        <TouchableOpacity
          style={styles.permBanner}
          onPress={requestSamsungPerms}
          disabled={permBusy}
          activeOpacity={0.7}
        >
          <Text style={styles.permBannerText}>
            {permBusy
              ? '⏳ Waiting for Samsung Health…'
              : '⚠️ Health permissions not fully granted. Tap to authorize in Samsung Health.'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* Section 1 — Latest Values (click to toggle in graph)           */}
      {/* ─────────────────────────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>📌 Latest Values</Text>
        <Text style={styles.sectionSub}>Tap a tile to show/hide in graph</Text>
      </View>

      {latestLoad ? (
        <View style={styles.centeredRow}>
          <ActivityIndicator color={C.blue} />
          <Text style={[styles.subHeading, { marginLeft: 8 }]}>Loading…</Text>
        </View>
      ) : (
        <View style={styles.tileGrid}>
          {displayDefs.map(def => {
            const reading = live[def.key] ?? null;
            return (
              <MetricTile
                key={def.key}
                def={def}
                value={reading?.value ?? null}
                timestamp={reading?.timestamp ?? null}
                selected={!!selectedMetrics[def.key]}
                onPress={() => toggleMetric(def.key)}
              />
            );
          })}
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* Section 2 — Date Range + History Chart                         */}
      {/* ─────────────────────────────────────────────────────────────── */}
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>📈 History Chart</Text>
      </View>

      {/* Date range card */}
      <View style={styles.rangeCard}>
        {/* Preset chips */}
        <View style={styles.presetRow}>
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p.label}
              onPress={() => applyPreset(p)}
              style={[styles.presetChip, activePreset === p.label && styles.presetChipActive]}
            >
              <Text style={[styles.presetText, activePreset === p.label && { color: C.bg }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Chart area */}
      {historyLoad ? (
        <View style={[styles.centeredRow, { marginTop: 20 }]}>
          <ActivityIndicator color={C.blue} />
          <Text style={[styles.subHeading, { marginLeft: 8 }]}>Loading history…</Text>
        </View>
      ) : historyErr ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{historyErr}</Text>
        </View>
      ) : activeSeries.length === 0 ? (
        <View style={styles.noDataBox}>
          <Text style={styles.noDataText}>
            {Object.values(selectedMetrics).some(v => v)
              ? 'No data in this date range. Try a wider range.'
              : 'Tap a metric tile above to display history.'}
          </Text>
        </View>
      ) : (
        <View style={styles.chartCard}>
          {/* Legend row */}
          <View style={styles.chartLegend}>
            {activeSeries.map(({ def, pts }) => (
              <View key={def.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: def.color }]} />
                <Text style={[styles.legendLabel, { color: def.color }]}>
                  {def.label}{def.unit ? ` (${def.unit})` : ''}
                </Text>
                <Text style={styles.legendPts}> {pts.length}pts</Text>
              </View>
            ))}
          </View>

          {activeSeries[0].pts.length < 2 ? (
            <Text style={styles.noDataText}>Not enough data points</Text>
          ) : (
            <LineChart
              data={activeSeries[0].pts}
              dataSet={activeSeries.slice(1).map(({ def, pts }) => ({
                data: pts,
                color: def.color,
                thickness: 2,
                curved: true,
                areaChart: true,
                startFillColor: def.color,
                endFillColor: C.bg,
                startOpacity: 0.15,
                endOpacity: 0.01,
                hideDataPoints: pts.length > 80,
                dataPointsColor: def.color,
                dataPointsRadius: 2,
              }))}
              width={SCREEN_W - 96}
              height={220}
              color={activeSeries[0].def.color}
              thickness={2}
              dataPointsColor={activeSeries[0].def.color}
              dataPointsRadius={2}
              startFillColor={activeSeries[0].def.color}
              endFillColor={C.bg}
              startOpacity={0.15}
              endOpacity={0.01}
              areaChart
              curved
              hideDataPoints={activeSeries[0].pts.length > 80}
              noOfSections={4}
              yAxisTextStyle={{ color: C.textMuted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: C.textMuted, fontSize: 9 }}
              backgroundColor={C.card}
              rulesColor={C.border}
              xAxisColor={C.border}
              yAxisColor={C.border}
              hideYAxisText={false}
              showVerticalLines={false}
              isAnimated={false}
              scrollAnimation={false}
              hideRules={false}
              hideOrigin
              xAxisLabelTexts={
                activeSeries[0].pts.length > 12
                  ? activeSeries[0].pts.map((p, i) =>
                      i % Math.ceil(activeSeries[0].pts.length / 8) === 0 ? p.label : '')
                  : activeSeries[0].pts.map(p => p.label)
              }
              pointerConfig={{
                pointerStripWidth: 1,
                pointerStripColor: C.textMuted,
                pointerColorForDataSet: activeSeries.slice(1).map(s => s.def.color),
                radius: 5,
                pointerLabelWidth: 130,
                pointerLabelHeight: activeSeries.length * 26 + 16,
                activatePointersOnLongPress: false,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (items: any[]) => (
                  <View style={[styles.tooltipBox, { marginTop: 8 }]}>
                    {items.map((item: any, i: number) => {
                      const s = activeSeries[i];
                      if (!s || item?.value == null) return null;
                      return (
                        <Text key={s.key} style={[styles.tooltipVal, { color: s.def.color, fontSize: 12 }]}>
                          {s.def.label}: {Number(item.value).toFixed(1)} {s.def.unit}
                        </Text>
                      );
                    })}
                    <Text style={styles.tooltipTime}>{items[0]?.label}</Text>
                  </View>
                ),
              }}
            />
          )}
        </View>
      )}

      {/* Bottom spacer */}
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
  legendPts:   { fontSize: 10, color: C.textMuted },
  chartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  chartDot:    { width: 10, height: 10, borderRadius: 5 },
  chartTitle:  { fontSize: 14, fontWeight: '700', color: C.textPrimary, flex: 1 },
  chartUnit:   { fontSize: 12, color: C.textMuted },
  chartPts:    { fontSize: 10, color: C.textMuted, marginLeft: 4 },

  tooltipBox: {
    backgroundColor: '#2d2d2d',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  tooltipVal:  { color: C.textPrimary, fontWeight: '700', fontSize: 14 },
  tooltipTime: { color: C.textMuted, fontSize: 11, marginTop: 2 },

  // source selector
  sourceRow:       { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sourceLabel:     { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  sourceChip:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  sourceChipActive:{ backgroundColor: C.blue, borderColor: C.blue },
  sourceChipText:  { fontSize: 12, color: C.textPrimary, fontWeight: '500' },

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
