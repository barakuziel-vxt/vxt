import type { TelemetryData, DriverCapabilities, ConnectionStatus } from './TelemetryData';

/**
 * TelemetryProvider – Strategy-Pattern interface.
 *
 * Every data-source driver (SamsungHealth, AppleHealth, SignalK …)
 * must implement this contract. The GatewayService depends only on
 * this interface, never on a concrete driver, enabling hot-swap at
 * runtime without any changes to upper layers.
 */
export interface TelemetryProvider {
  // ─── Identity ────────────────────────────────────────────────────────────

  /** Human-readable display name shown in the UI */
  readonly displayName: string;

  /** Static capability flags for this driver */
  readonly capabilities: DriverCapabilities;

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Perform one-time initialisation (request permissions, open SDK
   * connections …). Must be called once before start().
   * @throws DriverError if initialisation fails unrecoverably.
   */
  initialize(): Promise<void>;

  /**
   * Begin data collection.  After this call the driver will emit
   * samples via the callback registered in onData().
   */
  start(): Promise<void>;

  /** Gracefully stop data collection and release resources. */
  stop(): Promise<void>;

  // ─── Data callbacks ──────────────────────────────────────────────────────

  /**
   * Register a callback that the driver calls every time a new
   * TelemetryData sample is ready.
   */
  onData(callback: (data: TelemetryData) => void): void;

  /**
   * Register a callback for non-fatal errors (e.g. transient sensor
   * read failure).  The driver stays running after calling this.
   */
  onError(callback: (error: DriverError) => void): void;

  // ─── Status ──────────────────────────────────────────────────────────────

  /** Current connection / health status of this driver */
  getStatus(): ConnectionStatus;

  /**
   * One-shot snapshot (used for UI polling fallback).
   * Drivers that support streaming should still implement this for
   * initial page load.
   */
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
