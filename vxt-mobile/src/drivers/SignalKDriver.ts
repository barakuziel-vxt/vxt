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

const DEFAULT_BASE_URL = 'http://halos.local:3000';

/** Keys in SignalK JSON that are metadata — skip during flattening */
const SKIP_KEYS = new Set(['meta', '$source', 'source', 'timestamp', 'sentence', 'pgn', 'gnss', 'magneticVariation', 'magneticVariationAgeOfService', 'datetime']);

/** Flatten a nested SignalK vessel object to { 'path.subpath': numericValue } */
function flattenSignalK(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SKIP_KEYS.has(k)) continue; // skip metadata, not telemetry
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      // SignalK value wrapper: { value: number, ... }
      const wrapped = v as Record<string, unknown>;
      if (typeof wrapped.value === 'number') {
        result[path] = wrapped.value;
      } else if (wrapped.value !== null && wrapped.value !== undefined && typeof wrapped.value === 'object') {
        // Position-like: { value: { latitude: N, longitude: N } }
        // Flatten value's contents directly under path (skip the .value level)
        const inner = wrapped.value as Record<string, unknown>;
        for (const [ik, iv] of Object.entries(inner)) {
          if (typeof iv === 'number') {
            result[`${path}.${ik}`] = iv;
          }
        }
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
    private userId: string = 'vessel',
    private readonly sampleIntervalMs: number = 60_000,
    baseUrl: string = DEFAULT_BASE_URL,
  ) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, ''); // strip trailing slash
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  setUserId(id: string): void {
    this.userId = id;
  }

  getUserId(): string {
    return this.userId;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  // ─── Availability & Permissions ──────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    try {
      const r = await fetch(`${this.baseUrl}/signalk`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
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
    // Allow starting even if server is temporarily unreachable — the polling
    // loop will retry on each interval and emit errors to listeners.
    const available = await this.isAvailable();
    if (!available) {
      console.warn(`[SignalK] Server not reachable at ${this.baseUrl} — will retry on poll`);
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
    // Try /vessels/self first; fall back to /vessels/ root and extract self
    const selfUrl = `${this.baseUrl}/signalk/v1/api/vessels/self`;
    let response = await fetch(selfUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const json: Record<string, unknown> = await response.json();
      return flattenSignalK(json);
    }
    // /vessels/self returned non-OK (404 when no vessel data) — try /vessels/
    const rootUrl = `${this.baseUrl}/signalk/v1/api/vessels`;
    response = await fetch(rootUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`SignalK returned HTTP ${response.status}`);
    }
    const vessels: Record<string, unknown> = await response.json();
    // Find 'self' key or pick the first vessel
    const selfKey = Object.keys(vessels).find(k =>
      k.includes('urn:mrn:signalk:uuid') || k === 'self',
    ) ?? Object.keys(vessels)[0];
    if (!selfKey) {
      throw new Error('No vessel data available on SignalK server');
    }
    return flattenSignalK(vessels[selfKey] as Record<string, unknown>);
  }

  // ─── One-shot Vitals ─────────────────────────────────────────────────────

  async getLatest(): Promise<SnapshotMap | null> {
    try {
      console.log(`[SignalK] getLatest → GET ${this.baseUrl}/signalk/v1/api/vessels/self/`);
      const flat = await this.fetchFlat();
      const now = Date.now();
      const snapshot: SnapshotMap = {};
      for (const [key, value] of Object.entries(flat)) {
        snapshot[key] = { value, ts: now };
        // Also populate ring buffer so getHistory can inject position data
        if (!this.historyBuffer[key]) this.historyBuffer[key] = [];
        this.historyBuffer[key].push({ v: value, ts: now });
        if (this.historyBuffer[key].length > this.HISTORY_LIMIT) {
          this.historyBuffer[key].shift();
        }
      }
      console.log(`[SignalK] getLatest OK — ${Object.keys(snapshot).length} keys`);
      // Also update internal snapshot for history
      Object.assign(this.latestSnapshot, snapshot);
      return Object.keys(snapshot).length > 0 ? snapshot : null;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.error(`[SignalK] getLatest FAILED: ${msg}`);
      // Return cached snapshot if available, otherwise throw so UI can show error
      if (Object.keys(this.latestSnapshot).length > 0) {
        console.warn(`[SignalK] returning cached snapshot (${Object.keys(this.latestSnapshot).length} keys)`);
        return { ...this.latestSnapshot };
      }
      throw new Error(`Cannot reach SignalK server at ${this.baseUrl}: ${msg}`);
    }
  }

  async getHistory(fromMs: number, toMs: number): Promise<HistoryMap> {
    try {
      // Build ISO 8601 timestamps for the API
      const fromISO = new Date(fromMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const toISO = new Date(toMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
      
      // Get list of available paths from history
      const pathsUrl = `${this.baseUrl}/signalk/v1/history/paths?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`;
      const pathsResp = await fetch(pathsUrl, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!pathsResp.ok) {
        console.warn(`[SignalK] history paths returned ${pathsResp.status}, falling back to ring buffer`);
        return this.getHistoryFromBuffer(fromMs, toMs);
      }
      
      const paths: string[] = await pathsResp.json();
      if (paths.length === 0) {
        console.log('[SignalK] no paths in history range');
        return {};
      }

      // Query history for all paths with reasonable resolution
      const resolution = Math.max(10, Math.floor((toMs - fromMs) / 80000)); // ~80 data points max
      const pathsParam = paths.join(',');
      const historyUrl = `${this.baseUrl}/signalk/v1/history/values?context=vessels.self&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&paths=${encodeURIComponent(pathsParam)}&resolution=${resolution}`;
      
      console.log(`[SignalK] getHistory → GET ${historyUrl.substring(0, 120)}...`);
      const histResp = await fetch(historyUrl, { method: 'GET', headers: { Accept: 'application/json' } });
      
      if (!histResp.ok) {
        console.warn(`[SignalK] history API returned ${histResp.status}, falling back to ring buffer`);
        return this.getHistoryFromBuffer(fromMs, toMs);
      }

      const historyData: any = await histResp.json();
      const result: HistoryMap = {};
      
      if (Array.isArray(historyData?.data)) {
        // historyData.data is: [timestamp, values[], timestamp, values[], ...]
        // OR: [[timestamp, val], [timestamp, val], ...] per path
        
        // Parse based on structure. The plugin returns an array where each entry is [timestamp, ...values]
        const dataArray = historyData.data as any[];
        const pathsList = (historyData.values || []).map((v: any) => v.path);
        
        console.log(`[SignalK] history: ${pathsList.length} paths, ${dataArray.length} data points`);
        
        // Initialize result for each path
        for (const path of pathsList) {
          result[path] = [];
        }
        
        // Parse data entries
        for (const entry of dataArray) {
          if (Array.isArray(entry) && entry.length > 0) {
            const timestamp = entry[0];
            if (typeof timestamp === 'string') {
              const ts = new Date(timestamp).getTime();
              // entry[1..n] are values for each path
              for (let i = 0; i < pathsList.length; i++) {
                const val = entry[i + 1];
                if (typeof val === 'number') {
                  result[pathsList[i]].push({ v: val, ts });
                } else if (val && typeof val === 'object' && typeof val.latitude === 'number' && typeof val.longitude === 'number') {
                  // Position object {latitude, longitude} — extract as separate keys for LocationMap
                  const latKey = pathsList[i] + '.value.latitude';
                  const lonKey = pathsList[i] + '.value.longitude';
                  if (!result[latKey]) result[latKey] = [];
                  if (!result[lonKey]) result[lonKey] = [];
                  result[latKey].push({ v: val.latitude, ts });
                  result[lonKey].push({ v: val.longitude, ts });
                }
              }
            }
          }
        }
      }

      // InfluxDB doesn't store position objects — inject lat/lon via 3 fallbacks
      let hasPosition = Object.keys(result).some(k => k.toLowerCase().includes('latitude'));

      // Fallback 1: ring buffer (populated by polling or prior getLatest)
      if (!hasPosition) {
        for (const [key, samples] of Object.entries(this.historyBuffer)) {
          if (key.toLowerCase().includes('latitude') || key.toLowerCase().includes('longitude')) {
            const filtered = samples.filter(s => s.ts >= fromMs && s.ts <= toMs);
            if (filtered.length > 0) { result[key] = filtered; hasPosition = true; }
          }
        }
      }

      // Fallback 2: latestSnapshot (populated by concurrent getLatest or prior poll)
      if (!hasPosition) {
        for (const [key, entry] of Object.entries(this.latestSnapshot)) {
          if (key.toLowerCase().includes('latitude') || key.toLowerCase().includes('longitude')) {
            if (entry.ts >= fromMs && entry.ts <= toMs) {
              result[key] = [{ v: entry.value, ts: entry.ts }];
              hasPosition = true;
            }
          }
        }
      }

      // Fallback 3: fetch current position directly from SignalK
      if (!hasPosition) {
        try {
          const flat = await this.fetchFlat();
          const now = Date.now();
          for (const [key, value] of Object.entries(flat)) {
            if (key.toLowerCase().includes('latitude') || key.toLowerCase().includes('longitude')) {
              if (now >= fromMs && now <= toMs) {
                result[key] = [{ v: value, ts: now }];
              }
            }
          }
        } catch { /* position just won't show */ }
      }

      console.log(`[SignalK] getHistory OK — ${Object.keys(result).length} paths with data`);
      return result;
    } catch (err) {
      console.error(`[SignalK] getHistory FAILED: ${err}, falling back to ring buffer`);
      return this.getHistoryFromBuffer(fromMs, toMs);
    }
  }

  private getHistoryFromBuffer(fromMs: number, toMs: number): HistoryMap {
    const result: HistoryMap = {};
    for (const [key, samples] of Object.entries(this.historyBuffer)) {
      const filtered = samples.filter(s => s.ts >= fromMs && s.ts <= toMs);
      if (filtered.length > 0) result[key] = filtered;
    }
    return result;
  }
}
