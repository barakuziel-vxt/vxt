/**
 * CorrelationChart — custom SVG multi-series line chart
 *
 * Replaces react-native-gifted-charts (buggy: black lines, missing labels,
 * scale overflow).  Uses react-native-svg directly for full control.
 *
 * Features:
 *   - All series share a time-binned X axis (aligned for correlation)
 *   - Each series is normalised 0–100% when units differ (HR vs SpO₂ vs Steps)
 *   - Same-unit series share a natural Y scale
 *   - Touch/press shows vertical crosshair with tooltip of real values
 *   - X-axis labels always fit inside the chart width
 */

import React from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import Svg, { Line, Polyline, Circle, Rect, G, Text as SvgText } from 'react-native-svg';
import { formatMetricValue } from '../vitals/VitalsDefs';
import type { MetricDef } from '../vitals/VitalsDefs';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChartSeries {
  key:      string;
  def:      MetricDef;
  /** One value per bin (null = gap) */
  values:   (number | null)[];
  rawMin:   number;
  rawMax:   number;
}

export interface CorrelationChartProps {
  series:     ChartSeries[];
  /** Timestamps for the centre of each bin */
  binTimesMs: number[];
  /** Whether to normalise Y-axis 0–100 (mixed units) */
  normalise:  boolean;
  width:      number;
  height?:    number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PAD = { top: 16, right: 12, bottom: 42, left: 44 };
const BG  = '#161b22';
const GRID = '#30363d';
const MUTED = '#8b949e';

// ─── Component ──────────────────────────────────────────────────────────────

export default function CorrelationChart({
  series,
  binTimesMs,
  normalise,
  width,
  height = 220,
}: CorrelationChartProps) {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const numBins = binTimesMs.length;

  if (numBins < 2 || series.length === 0) return null;

  // ── Y domain ──────────────────────────────────────────────────────────
  let yMin: number;
  let yMax: number;
  if (normalise) {
    yMin = 0;
    yMax = 100;
  } else {
    // All series share same unit — use natural range with 5% padding
    const allVals = series.flatMap(s => s.values.filter((v): v is number => v !== null));
    const mn = Math.min(...allVals);
    const mx = Math.max(...allVals);
    const pad = (mx - mn) * 0.05 || 1;
    yMin = mn - pad;
    yMax = mx + pad;
  }
  const yRange = yMax - yMin || 1;

  // ── Coordinate helpers ────────────────────────────────────────────────
  const xOf = (i: number) => PAD.left + (i / (numBins - 1)) * plotW;
  const yOf = (v: number) => PAD.top + plotH - ((v - yMin) / yRange) * plotH;

  const toDisplay = (v: number, s: ChartSeries) => {
    if (!normalise) return v;
    const r = s.rawMax - s.rawMin;
    return r === 0 ? 50 : ((v - s.rawMin) / r) * 100;
  };

  const fromDisplay = (dispV: number, s: ChartSeries) => {
    if (!normalise) return dispV;
    const r = s.rawMax - s.rawMin;
    return s.rawMin + (dispV / 100) * r;
  };

  // ── Build polyline points per series ──────────────────────────────────
  const polylines = series.map(s => {
    const segments: string[] = [];
    let currentSegment: string[] = [];

    for (let i = 0; i < numBins; i++) {
      const v = s.values[i];
      if (v === null) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment.join(' '));
          currentSegment = [];
        }
        continue;
      }
      const dv = toDisplay(v, s);
      currentSegment.push(`${xOf(i).toFixed(1)},${yOf(dv).toFixed(1)}`);
    }
    if (currentSegment.length > 0) segments.push(currentSegment.join(' '));
    return { series: s, segments };
  });

  // ── X-axis labels ─────────────────────────────────────────────────────
  const span = binTimesMs[numBins - 1] - binTimesMs[0];
  const multiDay = span > 23 * 3_600_000;
  const labelStep = Math.max(1, Math.ceil(numBins / 8));
  const xLabels = binTimesMs.map((ts, i) => {
    if (i % labelStep !== 0) return null;
    const d = new Date(ts);
    return multiDay
      ? `${d.getMonth() + 1}/${d.getDate()}`
      : `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  // ── Y-axis labels ─────────────────────────────────────────────────────
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = yMin + (i / yTicks) * yRange;
    return { v, y: yOf(v), label: normalise ? `${v.toFixed(0)}%` : v.toFixed(v >= 100 ? 0 : 1) };
  });

  // ── Touch handling ────────────────────────────────────────────────────
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX - PAD.left;
        const idx = Math.round((x / plotW) * (numBins - 1));
        setHoverIdx(Math.max(0, Math.min(numBins - 1, idx)));
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX - PAD.left;
        const idx = Math.round((x / plotW) * (numBins - 1));
        setHoverIdx(Math.max(0, Math.min(numBins - 1, idx)));
      },
      onPanResponderRelease: () => {
        // Keep tooltip visible for a moment
        setTimeout(() => setHoverIdx(null), 2500);
      },
    })
  ).current;

  // ── Tooltip data ──────────────────────────────────────────────────────
  const tooltipData = hoverIdx !== null ? (() => {
    const ts = binTimesMs[hoverIdx];
    const d  = new Date(ts);
    const timeStr = multiDay
      ? `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      : `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const values = series.map(s => {
      const raw = s.values[hoverIdx];
      return { def: s.def, raw, label: raw !== null ? formatMetricValue(s.def, raw) : '—' };
    });
    return { timeStr, values, x: xOf(hoverIdx) };
  })() : null;

  return (
    <View style={cc.wrapper}>
      <View {...panResponder.panHandlers}>
        <Svg width={width} height={height}>
          {/* Background */}
          <Rect x={0} y={0} width={width} height={height} fill={BG} rx={10} />

          {/* Grid lines */}
          {yLabels.map(({ y }, i) => (
            <Line key={`g${i}`} x1={PAD.left} y1={y} x2={width - PAD.right} y2={y}
              stroke={GRID} strokeWidth={0.5} strokeDasharray="4,3" />
          ))}

          {/* Y-axis labels */}
          <G>
            {yLabels.map(({ y, label }, i) => (
              <React.Fragment key={`yl${i}`}>
                <Rect x={0} y={y - 7} width={PAD.left - 4} height={14} fill={BG} />
                <SvgText x={PAD.left - 6} y={y + 3} fill={MUTED} fontSize={9}
                  textAnchor="end">{label}</SvgText>
              </React.Fragment>
            ))}
          </G>

          {/* X-axis labels */}
          <G>
            {xLabels.map((label, i) => label ? (
              <SvgText key={`xl${i}`} x={xOf(i)} y={height - PAD.bottom + 16} fill={MUTED}
                fontSize={9} textAnchor="middle">{label}</SvgText>
            ) : null)}
          </G>

          {/* Data lines */}
          {polylines.map(({ series: s, segments }) =>
            segments.map((pts, si) => (
              <Polyline key={`${s.key}-${si}`} points={pts}
                fill="none" stroke={s.def.color} strokeWidth={2}
                strokeLinejoin="round" strokeLinecap="round" />
            ))
          )}

          {/* Hover crosshair */}
          {hoverIdx !== null && (
            <>
              <Line x1={xOf(hoverIdx)} y1={PAD.top} x2={xOf(hoverIdx)}
                y2={height - PAD.bottom} stroke="#ffffff44" strokeWidth={1} />
              {series.map(s => {
                const v = s.values[hoverIdx];
                if (v === null) return null;
                const dv = toDisplay(v, s);
                return (
                  <Circle key={`dot-${s.key}`} cx={xOf(hoverIdx)} cy={yOf(dv)}
                    r={4} fill={s.def.color} stroke="#fff" strokeWidth={1.5} />
                );
              })}
            </>
          )}
        </Svg>
      </View>

      {/* Tooltip overlay */}
      {tooltipData && (
        <View style={[cc.tooltip, {
          left: Math.min(tooltipData.x - 60, width - 150),
        }]}>
          <Text style={cc.tooltipTime}>{tooltipData.timeStr}</Text>
          {tooltipData.values.map(({ def, raw, label }) => (
            <Text key={def.key} style={[cc.tooltipVal, { color: def.color }]}>
              {def.label}: {label}{raw !== null && def.unit ? ` ${def.unit}` : ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const cc = StyleSheet.create({
  wrapper: { position: 'relative' },
  tooltip: {
    position: 'absolute',
    top: 4,
    backgroundColor: '#2d2d2dee',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    minWidth: 130,
    zIndex: 10,
  },
  tooltipTime: { color: MUTED, fontSize: 10, marginBottom: 4 },
  tooltipVal:  { fontSize: 12, fontWeight: '700' },
});
