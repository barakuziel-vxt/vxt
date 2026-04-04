/**
 * SignalKDriver — Marine telemetry driver reading from a SignalK REST API.
 *
 * SignalK is an open-source data standard for marine vessels. It exposes
 * a self-describing REST endpoint at /signalk/v1/api/vessels/self/ that
 * returns all vessel data as a nested JSON object.
 *
 * This driver:
 *  1. Polls  GET {baseUrl}/signalk/v1/api/vessels/self/ on a schedule
 *  2. Flattens the nested JSON to dot-notation paths (e.g. "navigation.speedOverGround")
 *  3. Emits TelemetryData frames for the Gateway pipeline
 *  4. Provides getLatest() / getHistory() for HealthVitalsScreen
 *
 * The SignalK baseUrl is configurable via setBaseUrl() and persisted in the store.
 * Default: http://localhost:3000
 */

import { BaseDriver } from '../core/BaseDriver';
import { DriverError } from '../core/types/TelemetryProvider';
import type { TelemetryData, DriverCapabilities, SnapshotMap, HistoryMap } from '../core/types';

const DEFAULT_BASE_URL = 'http://localhost:3000';

/** Flatten a nested SignalK vessel object to { 'path.subpath': numericValue } */
function flattenSignalK(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      // SignalK value wrapper: { value: number, ... }
      const wrapped = v as Record<string, unknown>;
      if (typeof wrapped.value === 'number') {
        result[path] = wrapped.value;
      } else {
        const nested = flattenSignalK(wrapped as Record<string, unknown>, path);
        Object.assign(result, nested);
      }
    } else if (typeof v === 'number') {
      result[path] = v;
    }
  }
  return result;
}

export class SignalKDriver extends BaseDriver {
  readonly id = 'SignalK' as const;
  readonly displayName = 'SignalK';
  readonly platform = 'cross' as const;
  readonly capabilities: DriverCapabilities = {
    realtime: true,
    requiresHealthPermissions: false,
    requiresBackgroundExecution: false,
  };

  private baseUrl: string;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private latestSnapshot: SnapshotMap = {};
  // Simple ring-buffer history: last 1000 frames per key
  private historyBuffer: Record<string, Array<{ v: number; ts: number }>> = {};
  private readonly HISTORY_LIMIT = 1000;

  constructor(
    private readonly userId: string = 'vessel',
    private readonly sampleIntervalMs: number = 60_000,
    baseUrl: string = DEFAULT_BASE_URL,
  ) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, ''); // strip trailing slash
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  // ─── Availability & Permissions ──────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    try {
      const r = await fetch(`${this.baseUrl}/signalk`, { method: 'HEAD' });
      return r.ok;
    } catch { return false; }
  }

  async checkPermissions(): Promise<boolean> { return true; }
  async requestPermissions(): Promise<boolean> { return true; }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (!this.baseUrl) {
      throw new DriverError(this.displayName, 'CONNECTION_FAILED', 'SignalK baseUrl not configured');
    }
    const available = await this.isAvailable();
    if (!available) {
      throw new DriverError(
        this.displayName, 'CONNECTION_FAILED',
        `SignalK server not reachable at ${this.baseUrl}`,
      );
    }
  }

  protected async doStart(): Promise<void> {
    // Immediate first fetch
    await this.fetchAndEmit();
    this.pollTimer = setInterval(() => { void this.fetchAndEmit(); }, this.sampleIntervalMs);
  }

  protected async doStop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ─── Data collection ─────────────────────────────────────────────────────

  private async fetchAndEmit(): Promise<void> {
    try {
      const flat = await this.fetchFlat();
      const now = Date.now();

      // Update snapshot
      for (const [key, value] of Object.entries(flat)) {
        this.latestSnapshot[key] = { value, ts: now };

        // Append to ring buffer
        if (!this.historyBuffer[key]) this.historyBuffer[key] = [];
        this.historyBuffer[key].push({ v: value, ts: now });
        if (this.historyBuffer[key].length > this.HISTORY_LIMIT) {
          this.historyBuffer[key].shift();
        }
      }

      const measurements: TelemetryData['measurements'] = {};
      for (const [key, value] of Object.entries(flat)) {
        measurements[key] = value;
      }

      if (Object.keys(measurements).length > 0) {
        this.emit({
          timestamp: new Date(now).toISOString(),
          sourceDriver: 'SignalK',
          entityId: this.userId,
          measurements,
          metadata: { baseUrl: this.baseUrl },
        });
      }
    } catch (err) {
      this.emitError(new DriverError(this.displayName, 'CONNECTION_FAILED', String(err), err));
    }
  }

  private async fetchFlat(): Promise<Record<string, number>> {
    const url = `${this.baseUrl}/signalk/v1/api/vessels/self/`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`SignalK returned HTTP ${response.status}`);
    }
    const json: Record<string, unknown> = await response.json();
    return flattenSignalK(json);
  }

  // ─── One-shot Vitals ─────────────────────────────────────────────────────

  async getLatest(): Promise<SnapshotMap | null> {
    try {
      const flat = await this.fetchFlat();
      const now = Date.now();
      const snapshot: SnapshotMap = {};
      for (const [key, value] of Object.entries(flat)) {
        snapshot[key] = { value, ts: now };
      }
      // Also update internal snapshot for history
      Object.assign(this.latestSnapshot, snapshot);
      return Object.keys(snapshot).length > 0 ? snapshot : null;
    } catch (e: any) {
      console.warn(`[SignalK] getLatest error: ${e?.message ?? e}`);
      // Return cached snapshot if available
      return Object.keys(this.latestSnapshot).length > 0 ? { ...this.latestSnapshot } : null;
    }
  }

  async getHistory(fromMs: number, toMs: number): Promise<HistoryMap> {
    const result: HistoryMap = {};
    for (const [key, samples] of Object.entries(this.historyBuffer)) {
      const filtered = samples.filter(s => s.ts >= fromMs && s.ts <= toMs);
      if (filtered.length > 0) result[key] = filtered;
    }
    return result;
  }
}
