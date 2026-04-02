import type { TelemetryData, DriverCapabilities, ConnectionStatus } from '../types';
import type { TelemetryProvider, DriverError } from '../types/TelemetryProvider';

/**
 * BaseDriver – abstract class that every concrete driver extends.
 *
 * Handles:
 *  - Callback registration / fan-out
 *  - Status tracking
 *  - Lifecycle guards (prevent double-start, etc.)
 *
 * Subclasses only need to implement:
 *  - initialize()
 *  - doStart()
 *  - doStop()
 *  - fetchOnce()  – for one-shot getTelemetry()
 */
export abstract class BaseDriver implements TelemetryProvider {
  abstract readonly displayName: string;
  abstract readonly capabilities: DriverCapabilities;

  protected status: ConnectionStatus = 'disconnected';
  protected running = false;

  private dataCallbacks: Array<(data: TelemetryData) => void> = [];
  private errorCallbacks: Array<(err: DriverError) => void> = [];

  // ─── TelemetryProvider contract ──────────────────────────────────────────

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

  async getTelemetry(): Promise<TelemetryData | null> {
    return this.fetchOnce();
  }

  // ─── Subclass hooks ──────────────────────────────────────────────────────

  abstract initialize(): Promise<void>;
  protected abstract doStart(): Promise<void>;
  protected abstract doStop(): Promise<void>;
  protected abstract fetchOnce(): Promise<TelemetryData | null>;

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
