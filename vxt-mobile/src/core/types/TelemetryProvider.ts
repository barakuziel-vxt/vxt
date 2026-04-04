import type { TelemetryData, DriverCapabilities, ConnectionStatus, DriverType, SnapshotMap, HistoryMap } from './TelemetryData';

/**
 * TelemetryProvider – Unified driver interface.
 *
 * All drivers (SamsungHealth, HealthConnect, AppleHealth, SignalK, …)
 * implement this single contract, enabling:
 *   - Hot-swap at runtime without changes to UI layers
 *   - Generic Health Vitals display (driver-agnostic)
 *   - Generic Gateway streaming (driver-agnostic)
 *
 * The UI always interacts with this interface — never with a concrete driver.
 */
export interface TelemetryProvider {
  // ─── Identity ────────────────────────────────────────────────────────────

  /** Stable machine ID, matches DriverType */
  readonly id: DriverType;

  /** Human-readable display name shown in the UI */
  readonly displayName: string;

  /** Platform hint for the Driver Selection UI */
  readonly platform: 'android' | 'ios' | 'cross';

  /** Static capability flags */
  readonly capabilities: DriverCapabilities;

  // ─── Availability & Permissions ───────────────────────────────────────────

  /** Returns true if this driver is usable on the current device/platform */
  isAvailable(): Promise<boolean>;

  /** Check if required permissions are already granted (no dialog) */
  checkPermissions(): Promise<boolean>;

  /** Request permissions — may show a system dialog. Returns granted state. */
  requestPermissions(): Promise<boolean>;

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * One-time initialisation: check availability, request permissions if needed,
   * open SDK connections. Called before start().
   * @throws DriverError if initialisation fails unrecoverably.
   */
  initialize(): Promise<void>;

  /** Begin continuous data collection (foreground service / polling). */
  start(): Promise<void>;

  /** Gracefully stop data collection and release resources. */
  stop(): Promise<void>;

  // ─── One-shot Vitals (used by HealthVitalsScreen) ─────────────────────────

  /**
   * Return the latest reading for every metric this driver supports.
   * Key = LOINC code or provider-specific path (e.g. "navigation.speedOverGround").
   * Returns null if the driver has no data yet.
   */
  getLatest(): Promise<SnapshotMap | null>;

  /**
   * Return per-metric history between two epoch-ms timestamps.
   * Returned arrays are ASC-sorted by ts.
   */
  getHistory(fromMs: number, toMs: number): Promise<HistoryMap>;

  // ─── Streaming (used by Gateway pipeline) ────────────────────────────────

  /** Register a callback fired each time a new TelemetryData frame is ready. */
  onData(callback: (data: TelemetryData) => void): void;

  /** Register a callback for non-fatal errors. The driver keeps running. */
  onError(callback: (error: DriverError) => void): void;

  // ─── Status ──────────────────────────────────────────────────────────────

  getStatus(): ConnectionStatus;

  /** @deprecated Use getLatest() instead */
  getTelemetry(): Promise<TelemetryData | null>;
}

// ─── Error type ──────────────────────────────────────────────────────────────

export class DriverError extends Error {
  constructor(
    public readonly driver: string,
    public readonly code: DriverErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${driver}] ${message}`);
    this.name = 'DriverError';
  }
}

export type DriverErrorCode =
  | 'PERMISSION_DENIED'
  | 'SDK_UNAVAILABLE'
  | 'CONNECTION_FAILED'
  | 'SENSOR_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';
