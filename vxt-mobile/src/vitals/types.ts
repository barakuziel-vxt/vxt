/**
 * Vitals Provider abstraction
 *
 * Any data source (Samsung Health native, Apple Health native, REST API,
 * SignalK server, etc.) implements this interface and the HealthVitalsScreen
 * works without modification.
 *
 * REST contract expected by RestApiVitalsProvider:
 *   GET {baseUrl}/vitals/latest
 *     → VitalSnapshot[]
 *
 *   GET {baseUrl}/vitals/history?from={epochMs}&to={epochMs}
 *     → Record<string, Array<{v:number; ts:number}>>
 *
 * LOINC codes used as keys:
 *   8867-4   Heart Rate (bpm)
 *   59408-5  SpO2 (%)
 *   8480-6   Systolic BP (mmHg)
 *   8462-4   Diastolic BP (mmHg)
 *   55423-8  Steps
 *   8310-5   Body Temperature (°C)
 *   2339-0   Blood Glucose (mmol/L)
 *   73773-1  AFib (0=normal, 1=detected)
 *   8638-5   HR Min (bpm)
 *   8639-3   HR Max (bpm)
 */

/** A single latest reading from any source */
export interface VitalSnapshot {
  key:       string;  // LOINC code or custom key
  value:     number;
  timestamp: number;  // epoch ms
}

/** History returned from getHistory() — key → ASC sorted samples */
export type VitalHistory = Record<string, Array<{ v: number; ts: number }>>;

/**
 * VitalsProvider
 * Implement this interface for any health data source.
 */
export interface VitalsProvider {
  /** Machine-stable identifier, e.g. "samsung-health" */
  readonly id: string;
  /** Human-readable name shown in source selector */
  readonly name: string;
  /** Optional longer description */
  readonly description?: string;
  /** Platform hint — shown in UI ("Android", "iOS", "Network", "All") */
  readonly platform?: string;
  /** Whether the provider is currently usable (permissions, connectivity, etc.) */
  isAvailable(): Promise<boolean>;
  /** Return the most recent value for each supported metric */
  getLatest(): Promise<VitalSnapshot[]>;
  /** Return history for all supported metrics between epochs */
  getHistory(fromMs: number, toMs: number): Promise<VitalHistory>;
}

/** Config stored per REST provider entry */
export interface RestApiProviderConfig {
  id:           string;
  name:         string;
  description?: string;
  baseUrl:      string;
  headers?:     Record<string, string>;
  /** Override path, default: /vitals/latest */
  latestPath?:  string;
  /** Override path, default: /vitals/history */
  historyPath?: string;
}
