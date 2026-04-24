/**
 * VitalsDefs — shared metric catalog
 *
 * Single source of truth for all display metadata: labels, units, chart
 * colours, and range-coloring rules.  Providers return raw numeric values
 * keyed by the same codes defined here.
 */

// ─── Colour constants (also used in HealthVitalsScreen) ───────────────────

export const VC = {
  green:      '#3fb950',
  yellow:     '#d29922',
  red:        '#f85149',
  blue:       '#388bfd',
  orange:     '#f0883e',
  purple:     '#bc8cff',
  teal:       '#39d0d8',
  muted:      '#8b949e',
  pink:       '#ff7eb6',
  lime:       '#a8ff3e',
  coral:      '#ff6b6b',
  skyblue:    '#56cfe1',
  gold:       '#ffd166',
  violet:     '#9b5de5',
  mintgreen:  '#06d6a0',
  rose:       '#ff4d6d',
  sand:       '#e9c46a',
  steel:      '#4cc9f0',
};

// ─── Range-colour helpers (exported for unit tests / future reuse) ─────────

export function hrColor(v: number)        { return v < 40 || v > 120 ? VC.red : v > 100 ? VC.yellow : VC.green; }
export function spo2Color(v: number)      { return v < 90 ? VC.red : v < 95 ? VC.yellow : VC.green; }
export function bpSysColor(v: number)     { return v > 140 || v < 90 ? VC.red : v > 130 ? VC.yellow : VC.green; }
export function bpDiaColor(v: number)     { return v > 90  || v < 60  ? VC.red : v > 80  ? VC.yellow : VC.green; }
export function tempColor(v: number)      { return v > 38  ? VC.red : v > 37.4 ? VC.yellow : VC.green; }
export function skinTempColor(v: number)  { return v > 37  ? VC.red : v > 36.5 ? VC.yellow : VC.green; }
export function glucoseColor(v: number)   { return v > 11.1 ? VC.red : v > 7.8 ? VC.yellow : v < 3.9 ? VC.red : VC.green; }
export function afibColor(v: number)      { return v === 1 ? VC.red : VC.green; }
export function weightColor(_v: number)   { return VC.blue; }
export function bmiColor(v: number)       { return v > 30 ? VC.red : v > 25 ? VC.yellow : v < 18.5 ? VC.yellow : VC.green; }
export function bodyFatColor(v: number)   { return v > 30 ? VC.red : v > 25 ? VC.yellow : VC.green; }
export function sleepColor(v: number)     { return v < 6 ? VC.red : v < 7 ? VC.yellow : VC.green; }
export function neutralColor(_v: number)  { return VC.blue; }

// ─── MetricDef ────────────────────────────────────────────────────────────

export interface MetricDef {
  key:          string;        // LOINC code / custom key
  label:        string;        // display name
  unit:         string;        // display unit string (may be '')
  color:        string;        // chart / tile accent colour
  defaultOn:    boolean;       // selected in graph by default
  rangeColor:   (v: number) => string;
  /** Format a raw numeric value for display (optional, default: auto decimal) */
  format?:      (v: number) => string;
  /** True = Samsung Health SDK 1.1.0 cannot supply this metric — hide tile on Samsung provider */
  samsungUnavailable?: boolean;
  /** True = hide this metric from map location extraction (e.g., position attributes) */
  hideInMap?: boolean;
}

// ─── Catalog ──────────────────────────────────────────────────────────────

export const METRIC_DEFS: MetricDef[] = [
  // ── Heart Rate ─────────────────────────────────────────────────────────────
  { key: '8867-4',  label: 'Heart Rate',        unit: 'bpm',    color: VC.orange,    defaultOn: true,  rangeColor: hrColor },
  { key: '8638-5',  label: 'HR Min',             unit: 'bpm',    color: VC.teal,      defaultOn: false, rangeColor: hrColor },
  { key: '8639-3',  label: 'HR Max',             unit: 'bpm',    color: VC.coral,     defaultOn: false, rangeColor: hrColor },
  { key: '8418-4',  label: 'Resting HR',         unit: 'bpm',    color: VC.rose,      defaultOn: false, rangeColor: hrColor,    samsungUnavailable: true },

  // ── Blood ──────────────────────────────────────────────────────────────────
  // readData()-only types: unavailable on Samsung Health 6.31.x (ERR_INTERNAL_ERROR 9003)
  { key: '59408-5', label: 'SpO₂',             unit: '%',      color: VC.skyblue,   defaultOn: true,  rangeColor: spo2Color,     samsungUnavailable: true },
  { key: '8480-6',  label: 'Systolic BP',      unit: 'mmHg',   color: VC.red,       defaultOn: false, rangeColor: bpSysColor,    samsungUnavailable: true },
  { key: '8462-4',  label: 'Diastolic BP',     unit: 'mmHg',   color: VC.purple,    defaultOn: false, rangeColor: bpDiaColor,    samsungUnavailable: true },
  { key: '2339-0',  label: 'Blood Glucose',    unit: 'mmol/L', color: VC.gold,      defaultOn: false, rangeColor: glucoseColor,  samsungUnavailable: true },

  // ── Body Temperature ───────────────────────────────────────────────────────
  { key: '8310-5',  label: 'Body Temperature', unit: '°C',     color: VC.yellow,    defaultOn: false, rangeColor: tempColor,     samsungUnavailable: true },
  { key: '8327-9',  label: 'Skin Temperature', unit: '°C',     color: VC.sand,      defaultOn: false, rangeColor: skinTempColor, samsungUnavailable: true },

  // ── Body Composition ───────────────────────────────────────────────────────
  { key: '29463-7', label: 'Weight',           unit: 'kg',     color: VC.blue,      defaultOn: false, rangeColor: weightColor,   format: (v) => v.toFixed(1), samsungUnavailable: true },
  { key: '39156-5', label: 'BMI',              unit: 'kg/m²',  color: VC.steel,     defaultOn: false, rangeColor: bmiColor,      format: (v) => v.toFixed(1), samsungUnavailable: true },
  { key: '41982-0', label: 'Body Fat',         unit: '%',      color: VC.lime,      defaultOn: false, rangeColor: bodyFatColor,  format: (v) => v.toFixed(1), samsungUnavailable: true },

  // ── Activity ───────────────────────────────────────────────────────────────
  { key: '55423-8', label: 'Steps',            unit: 'steps',     color: VC.green,     defaultOn: false, rangeColor: neutralColor },
  { key: '55426-1', label: 'Floors Climbed',   unit: 'floors',    color: VC.mintgreen, defaultOn: false, rangeColor: neutralColor },
  { key: '41981-2', label: 'Active Calories',  unit: 'kcal',      color: VC.orange,    defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(0), samsungUnavailable: true },
  { key: '55430-3', label: 'Distance',         unit: 'km',        color: VC.teal,      defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(2), samsungUnavailable: true },

  // ── Fitness ────────────────────────────────────────────────────────────────
  { key: '60842-2', label: 'VO₂ Max',          unit: 'mL/kg·min', color: VC.steel,     defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(1), samsungUnavailable: true },

  // ── Cardiac Events ─────────────────────────────────────────────────────────
  { key: '73773-1', label: 'AFib',             unit: '',       color: VC.pink,      defaultOn: false, rangeColor: afibColor,     format: (v) => (v === 1 ? 'AFib' : 'Normal'), samsungUnavailable: true },

  // ── Sleep ──────────────────────────────────────────────────────────────────
  { key: '93832-4', label: 'Sleep Duration',   unit: 'hrs',    color: VC.violet,    defaultOn: false, rangeColor: sleepColor,  format: (v) => v.toFixed(1) },

  // ── Not in SDK 1.1.0 (hide on Samsung Health provider) ────────────────────
  { key: '80404-7', label: 'HRV (rMSSD)',      unit: 'ms',     color: VC.rose,      defaultOn: false, rangeColor: neutralColor, samsungUnavailable: true },
  { key: '9303-9',  label: 'Respiration Rate', unit: 'br/min', color: VC.muted,     defaultOn: false, rangeColor: neutralColor, samsungUnavailable: true },

  // ── SignalK Maritime Attributes ─────────────────────────────────────────────
  { key: 'navigation.courseOverGroundTrue',    label: 'COG',           unit: '°',     color: VC.blue,      defaultOn: false, rangeColor: neutralColor },
  { key: 'navigation.headingTrue',             label: 'Heading',       unit: '°',     color: VC.blue,      defaultOn: false, rangeColor: neutralColor },
  { key: 'environment.depth.belowTransducer',  label: 'Depth',         unit: 'm',     color: VC.teal,      defaultOn: false, rangeColor: neutralColor },
  { key: 'environment.wind.speedApparent',     label: 'Wind Spd',      unit: 'm/s',   color: VC.yellow,    defaultOn: false, rangeColor: neutralColor },
  { key: 'environment.wind.angleApparent',     label: 'Wind Angle',    unit: '°',     color: VC.yellow,    defaultOn: false, rangeColor: neutralColor },
  { key: 'environment.water.temperature',      label: 'Water Temp',    unit: '°C',    color: VC.skyblue,   defaultOn: false, rangeColor: tempColor },

  // ── Position (used by LocationMap for map display) ─────────────────────────
  // flattenSignalK extracts these from navigation.position.value.{latitude,longitude}
  // getHistory extracts them from position objects {latitude, longitude}
  // LocationMap finds keys containing 'latitude'/'longitude' with numeric values
  { key: 'navigation.position.value.latitude', label: 'Latitude',      unit: '°',     color: VC.green,     defaultOn: false, rangeColor: neutralColor },
  { key: 'navigation.position.value.longitude',label: 'Longitude',     unit: '°',     color: VC.green,     defaultOn: false, rangeColor: neutralColor },
  
  // ── Engine & Yacht Health Attributes (Full SignalK Paths) ────────────────────
  // Propulsion attributes
  { key: 'propulsion.main.revolutions',                label: 'Engine RPM',           unit: 'rpm',    color: VC.orange,    defaultOn: true,  rangeColor: neutralColor, format: (v) => (v * 60).toFixed(0) },
  { key: 'propulsion.main.temperature',                label: 'Engine Temp',          unit: '°C',     color: VC.coral,     defaultOn: true,  rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'propulsion.main.oilTemperature',             label: 'Oil Temp',             unit: '°C',     color: VC.orange,    defaultOn: true,  rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'propulsion.main.oilPressure',                label: 'Oil Pressure',         unit: 'bar',    color: VC.orange,    defaultOn: true,  rangeColor: neutralColor, format: (v) => (v / 100000).toFixed(2) },
  { key: 'propulsion.main.exhaustTemperature',         label: 'Exhaust Temp',         unit: '°C',     color: VC.red,       defaultOn: true,  rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'propulsion.main.coolantTemperature',         label: 'Coolant Temp',         unit: '°C',     color: VC.coral,     defaultOn: true,  rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'propulsion.main.load',                       label: 'Engine Load',          unit: '%',      color: VC.yellow,    defaultOn: true,  rangeColor: neutralColor, format: (v) => (v * 100).toFixed(0) },
  { key: 'propulsion.main.fuel.pressure',              label: 'Fuel Pressure',        unit: 'bar',    color: VC.gold,      defaultOn: false, rangeColor: neutralColor, format: (v) => (v / 100000).toFixed(2) },
  { key: 'propulsion.main.fuel.rate',                  label: 'Fuel Rate',            unit: 'L/h',    color: VC.gold,      defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(1) },
  { key: 'propulsion.main.runTime',                    label: 'Engine Run Time',       unit: 'h',      color: VC.muted,     defaultOn: true,  rangeColor: neutralColor, format: (v) => (v / 3600).toFixed(0) },
  { key: 'propulsion.main.transmission.oilTemperature',label: 'Trans Oil Temp',        unit: '°C',     color: VC.coral,     defaultOn: true,  rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  
  // Tank level attributes (SignalK ratio 0-1 → %)
  { key: 'tanks.fuel.0.currentLevel',      label: 'Fuel Tank Level',       unit: '%',   color: VC.gold,      defaultOn: false, rangeColor: neutralColor, format: (v) => (v * 100).toFixed(0) },
  { key: 'tanks.freshWater.0.currentLevel', label: 'Fresh Water Level',     unit: '%',   color: VC.skyblue,   defaultOn: false, rangeColor: neutralColor, format: (v) => (v * 100).toFixed(0) },
  { key: 'tanks.wasteWater.0.currentLevel', label: 'Waste Water Level',     unit: '%',   color: VC.muted,     defaultOn: false, rangeColor: neutralColor, format: (v) => (v * 100).toFixed(0) },

  // Navigation attributes
  { key: 'navigation.speedOverGround',                 label: 'SOG',                  unit: 'kn',     color: VC.blue,      defaultOn: true,  rangeColor: neutralColor, format: (v) => v.toFixed(2) },
  { key: 'navigation.speedThroughWater',               label: 'STW',                  unit: 'kn',     color: VC.blue,      defaultOn: true,  rangeColor: neutralColor, format: (v) => v.toFixed(2) },
  
  // Electrical attributes
  { key: 'electrical.batteries.main.voltage',          label: 'Battery Voltage',      unit: 'V',      color: VC.yellow,    defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(2) },
  { key: 'electrical.alternators.main.voltage',        label: 'Alternator Voltage',   unit: 'V',      color: VC.yellow,    defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(2) },
  
  // Legacy/fallback short keys (for backward compatibility)
  { key: 'revolutions',                       label: 'Engine RPM',         unit: 'rpm',    color: VC.orange,    defaultOn: false, rangeColor: neutralColor, format: (v) => (v * 60).toFixed(0) },
  { key: 'main.temperature',                  label: 'Engine Temp',        unit: '°C',     color: VC.coral,     defaultOn: false, rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'main.coolantTemperature',           label: 'Coolant Temp',       unit: '°C',     color: VC.coral,     defaultOn: false, rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'coolantTemperature',                label: 'Coolant Temp',       unit: '°C',     color: VC.coral,     defaultOn: false, rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'exhaustTemperature',                label: 'Exhaust Temp',       unit: '°C',     color: VC.red,       defaultOn: false, rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'oilPressure',                       label: 'Oil Pressure',       unit: 'bar',    color: VC.orange,    defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(2) },
  { key: 'transmission.oilTemperature',       label: 'Trans Oil Temp',     unit: '°C',     color: VC.coral,     defaultOn: false, rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'speedThroughWater',                 label: 'STW',               unit: 'kn',     color: VC.blue,      defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(2) },
  { key: 'speedOverGround',                   label: 'SOG',               unit: 'kn',     color: VC.blue,      defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(2) },
  
  { key: 'engine.RPM',                        label: 'Engine RPM',    unit: 'rpm',   color: VC.orange,    defaultOn: false, rangeColor: neutralColor },
  { key: 'engine.hours',                      label: 'Engine Hours',  unit: 'h',     color: VC.muted,     defaultOn: false, rangeColor: neutralColor },
  { key: 'engine.oilPressure',                label: 'Oil Pressure',  unit: 'PSI',   color: VC.orange,    defaultOn: false, rangeColor: neutralColor },
  { key: 'engine.coolantTemp',                label: 'Coolant Temp',  unit: '°C',    color: VC.coral,     defaultOn: false, rangeColor: tempColor },
  { key: 'tanks.fuel.level',                  label: 'Fuel Level',    unit: '%',     color: VC.gold,      defaultOn: false, rangeColor: neutralColor },
  { key: 'tanks.water.level',                 label: 'Water Level',   unit: '%',     color: VC.skyblue,   defaultOn: false, rangeColor: neutralColor },
  { key: 'electrical.battery.voltage',        label: 'Battery Volt',  unit: 'V',     color: VC.yellow,    defaultOn: false, rangeColor: neutralColor },

  // ── ELM327 OBD-II Automotive PIDs ─────────────────────────────────────────
  { key: 'obd.engineRpm',        label: 'Engine RPM',         unit: 'rpm',  color: VC.orange,    defaultOn: true,  rangeColor: neutralColor },
  { key: 'obd.vehicleSpeed',     label: 'Vehicle Speed',      unit: 'km/h', color: VC.blue,      defaultOn: true,  rangeColor: neutralColor },
  { key: 'obd.coolantTemp',      label: 'Coolant Temp',       unit: '°C',   color: VC.coral,     defaultOn: true,  rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'obd.throttlePos',      label: 'Throttle',           unit: '%',    color: VC.green,     defaultOn: true,  rangeColor: neutralColor, format: (v) => v.toFixed(1) },
  { key: 'obd.fuelLevel',        label: 'Fuel Level',         unit: '%',    color: VC.gold,      defaultOn: true,  rangeColor: neutralColor, format: (v) => v.toFixed(1) },
  { key: 'obd.engineLoad',       label: 'Engine Load',        unit: '%',    color: VC.purple,    defaultOn: true,  rangeColor: neutralColor, format: (v) => v.toFixed(1) },
  { key: 'obd.oilTemp',          label: 'Oil Temp',           unit: '°C',   color: VC.red,       defaultOn: false, rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'obd.mafRate',          label: 'MAF Rate',           unit: 'g/s',  color: VC.teal,      defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(2) },
  { key: 'obd.intakeAirTemp',    label: 'Intake Air Temp',    unit: '°C',   color: VC.skyblue,   defaultOn: false, rangeColor: tempColor,    format: (v) => v.toFixed(1) },
  { key: 'obd.manifoldPressure', label: 'Manifold Pressure',  unit: 'kPa',  color: VC.steel,     defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(1) },
  { key: 'obd.timingAdvance',    label: 'Timing Advance',     unit: '°',    color: VC.muted,     defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(1) },
  { key: 'obd.moduleVoltage',    label: 'Module Voltage',     unit: 'V',    color: VC.yellow,    defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(2) },
  { key: 'obd.fuelRate',         label: 'Fuel Rate',          unit: 'L/h',  color: VC.sand,      defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(2) },
  { key: 'obd.accelPedalPos',    label: 'Accel Pedal',        unit: '%',    color: VC.lime,      defaultOn: false, rangeColor: neutralColor, format: (v) => v.toFixed(1) },
];

/** Look up a MetricDef by key.  Returns undefined if the key is from a REST
 *  source that is not in our catalog — callers should handle gracefully. */
export function getMetricDef(key: string): MetricDef | undefined {
  return METRIC_DEFS.find(m => m.key === key);
}

/** Format a raw number for display using the metric's optional formatter,
 *  or auto-detect integer vs. 1-decimal. */
export function formatMetricValue(def: MetricDef, value: number): string {
  if (def.format) return def.format(value);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Build a MetricDef on the fly for unknown keys coming from REST sources.
 *  Converts camelCase paths to Title Case labels:
 *  e.g. "engine.coolantTemp" → "Coolant Temp"
 */
export function buildDynamicDef(key: string, index: number): MetricDef {
  const palette = [VC.orange, VC.teal, VC.green, VC.purple, VC.red, VC.yellow, VC.blue];
  
  // Extract the last segment after a dot (e.g., "navigation.speedOverGround" → "speedOverGround")
  const lastSegment = key.includes('.') ? key.split('.').pop() || key : key;
  
  // Convert camelCase to Title Case (e.g., "speedOverGround" → "Speed Over Ground")
  const label = lastSegment
    .replace(/([A-Z])/g, ' $1')  // Insert space before uppercase letters
    .trim()
    .replace(/^./, c => c.toUpperCase());  // Capitalize first letter
  
  return {
    key,
    label,
    unit:       '',
    color:      palette[index % palette.length],
    defaultOn:  false,
    rangeColor: neutralColor,
  };
}
