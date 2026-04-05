import type { TelemetryData, DriverCapabilities, ConnectionStatus, DriverType, SnapshotMap, HistoryMap } from '../types';
import type { TelemetryProvider, DriverError } from '../types/TelemetryProvider';

/**
 * BaseDriver – abstract class that every concrete driver extends.
 *
 * Handles:
 *  - Callback registration / fan-out
 *  - Status tracking
 *  - Lifecycle guards (prevent double-start, etc.)
 *
 * Subclasses must implement:
 *  - id, displayName, platform, capabilities
 *  - initialize(), doStart(), doStop()
 *  - isAvailable(), checkPermissions(), requestPermissions()
 *  - getLatest(), getHistory()
 */
export abstract class BaseDriver implements TelemetryProvider {
  abstract readonly id: DriverType;
  abstract readonly displayName: string;
  abstract readonly platform: 'android' | 'ios' | 'cross';
  abstract readonly capabilities: DriverCapabilities;

  protected status: ConnectionStatus = 'disconnected';
  protected running = false;

  private dataCallbacks: Array<(data: TelemetryData) => void> = [];
  private errorCallbacks: Array<(err: DriverError) => void> = [];

  // ─── TelemetryProvider contract ──────────────────────────────────────────

  abstract isAvailable(): Promise<boolean>;
  abstract checkPermissions(): Promise<boolean>;
  abstract requestPermissions(): Promise<boolean>;

  onData(cb: (data: TelemetryData) => void): void {
    this.dataCallbacks.push(cb);
  }

  onError(cb: (err: DriverError) => void): void {
    this.errorCallbacks.push(cb);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.status = 'connecting';
    await this.doStart();
    this.status = 'connected';
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.doStop();
    this.status = 'disconnected';
  }

  /** @deprecated Use getLatest() */
  async getTelemetry(): Promise<TelemetryData | null> {
    return null;
  }

  // ─── One-shot vitals (HealthVitalsScreen) ────────────────────────────────

  abstract getLatest(): Promise<SnapshotMap | null>;
  abstract getHistory(fromMs: number, toMs: number): Promise<HistoryMap>;

  // ─── Subclass hooks ──────────────────────────────────────────────────────

  abstract initialize(): Promise<void>;
  protected abstract doStart(): Promise<void>;
  protected abstract doStop(): Promise<void>;

  // ─── Emit helpers for subclasses ─────────────────────────────────────────

  protected emit(data: TelemetryData): void {
    for (const cb of this.dataCallbacks) {
      try { cb(data); } catch { /* never crash the driver loop */ }
    }
  }

  protected emitError(err: DriverError): void {
    this.status = 'error';
    for (const cb of this.errorCallbacks) {
      try { cb(err); } catch {}
    }
  }
}
