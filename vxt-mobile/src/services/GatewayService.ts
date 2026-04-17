/**
 * GatewayService — orchestrates Driver ↔ MQTT transport with backlog replay from Samsung Health.
 *
 * Architecture:
 *   - Driver and Gateway are independently controllable.
 *   - `lastSentTs` is persisted in AsyncStorage (survives app restarts).
 *   - When Gateway is turned ON, it first fetches ALL Samsung Health data since
 *     `lastSentTs` (the backlog), chunks it into batches of CHUNK_SIZE frames,
 *     and sends each chunk before resuming live telemetry.
 *   - Samsung Health stores years of data locally — it IS the buffer, no extra DB needed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { driverRegistry } from '../core/DriverRegistry';
import { MqttTransport } from './MqttTransport';
import { KafkaTransport } from './KafkaTransport';
import type { TelemetryData, GatewayConfig, ConnectionStatus } from '../core/types';
import type { TransportStatus } from './MqttTransport';

const LAST_SENT_TS_KEY = 'gateway:lastSentTs';
/** Number of telemetry frames sent in a single MQTT batch during backlog replay */
const CHUNK_SIZE = 25;

// ── Samsung Health history return type ───────────────────────────────────────
interface HistorySample { v: number; ts: number; }
type HistoryMap = Record<string, HistorySample[]>; // keyed by LOINC code

// ─── GatewayService ────────────────────────────────────────────────────────

/**
 * GatewayService
 *
 * Singleton orchestrator.  Driver and Gateway have separate lifecycles:
 *
 *   startDriver()  → Initialises + starts data collection (no cloud)
 *   startGateway() → Connects MQTT, syncs backlog, then live data flows
 *   stopGateway()  → Disconnects MQTT (driver keeps running)
 *   stopDriver()   → Stops driver (implies stopGateway first)
 */
export class GatewayService {
  private transport:     MqttTransport | KafkaTransport | null = null;
  private running        = false;
  private driverActive   = false;
  private framesSent     = 0;
  private lastSentTs     = 0;
  private syncingBacklog = false;
  private backlogTotal   = 0;
  private backlogSynced  = 0;
  private logs: Array<{ ts: string; msg: string; level: string }> = [];
  private maxLogs        = 100; // Keep last 100 log entries

  private onFrameSent?:       (total: number) => void;
  private onTransportStatus?: (s: TransportStatus) => void;
  private onDriverStatus?:    (s: ConnectionStatus) => void;
  private onDriverError?:     (msg: string) => void;
  private onLastSentTs?:      (ts: number) => void;
  private onBacklogProgress?: (synced: number, total: number) => void;

  // ── Public accessors ────────────────────────────────────────────────────────

  isRunning()        { return this.running; }
  isDriverActive()   { return this.driverActive; }
  isSyncingBacklog() { return this.syncingBacklog; }
  getFramesSent()    { return this.framesSent; }
  getLastSentTs()    { return this.lastSentTs; }
  getBacklogTotal()  { return this.backlogTotal; }
  getBacklogSynced() { return this.backlogSynced; }
  getLogs()          { return [...this.logs]; }
  getTransportStats() {
    if (this.transport instanceof KafkaTransport) {
      return (this.transport as any).getStats?.();
    }
    return null;
  }

  private addLog(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const ts = new Date().toISOString();
    this.logs.push({ ts, msg, level });
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  setCallbacks(cbs: {
    onFrameSent?:       (total: number) => void;
    onTransportStatus?: (s: TransportStatus) => void;
    onDriverStatus?:    (s: ConnectionStatus) => void;
    onDriverError?:     (msg: string) => void;
    onLastSentTs?:      (ts: number) => void;
    onBacklogProgress?: (synced: number, total: number) => void;
  }) {
    this.onFrameSent       = cbs.onFrameSent;
    this.onTransportStatus = cbs.onTransportStatus;
    this.onDriverStatus    = cbs.onDriverStatus;
    this.onDriverError     = cbs.onDriverError;
    this.onLastSentTs      = cbs.onLastSentTs;
    this.onBacklogProgress = cbs.onBacklogProgress;
  }

  // ── Driver lifecycle ────────────────────────────────────────────────────────

  async startDriver(config: GatewayConfig): Promise<void> {
    if (this.driverActive) return;

    const driver = driverRegistry.getActive();
    if (!driver) throw new Error('No active driver registered');

    // Sync userId from gateway config into the active driver
    if (config.userId && typeof (driver as any).setUserId === 'function') {
      (driver as any).setUserId(config.userId);
    }

    await driver.initialize();
    this.onDriverStatus?.('connecting');

    driver.onError(err => this.onDriverError?.(err.message));
    driver.onData((data: TelemetryData) => {
      // When Gateway is also running, forward live frames to MQTT
      if (this.running) this.handleFrame(data);
    });

    await driver.start();
    this.onDriverStatus?.('connected');
    this.driverActive = true;

    // Load persisted lastSentTs — default to now on first-ever launch so
    // lag starts at 0 instead of showing 56 years since Unix epoch
    const raw = await AsyncStorage.getItem(LAST_SENT_TS_KEY);
    if (raw) {
      this.lastSentTs = Number(raw);
    } else {
      this.lastSentTs = Date.now();
      await AsyncStorage.setItem(LAST_SENT_TS_KEY, String(this.lastSentTs));
    }
    this.onLastSentTs?.(this.lastSentTs);
  }

  async stopDriver(): Promise<void> {
    if (!this.driverActive) return;
    if (this.running) await this.stopGateway();
    const driver = driverRegistry.getActive();
    await driver?.stop();
    this.onDriverStatus?.('disconnected');
    this.driverActive = false;
  }

  // ── Gateway lifecycle ───────────────────────────────────────────────────────

  async startGateway(config: GatewayConfig): Promise<void> {
    if (this.running) return;

    // Ensure driver is running first
    if (!this.driverActive) await this.startDriver(config);

    this.addLog(`Starting gateway with type: ${config.gatewayType}`, 'info');

    // Create transport based on gateway type
    if (config.gatewayType === 'kafka') {
      // Derive API base URL from bootstrap server (e.g., "192.168.1.36:9092" → "http://192.168.1.36:8000")
      const bootstrapHost = config.kafkaBootstrap.split(':')[0] || '192.168.1.36';
      const apiBase = `http://${bootstrapHost}:8000`;
      
      this.addLog(`Connecting to Kafka broker: ${config.kafkaBootstrap} / topic: ${config.kafkaTopic}`, 'info');
      this.addLog(`Using REST API at: ${apiBase}`, 'info');
      this.transport = new KafkaTransport(
        { bootstrap: config.kafkaBootstrap, topic: config.kafkaTopic, offlineQueueLimit: 200, apiBase },
        { 
          onStatusChange: s => {
            this.addLog(`Kafka transport status: ${s}`, s === 'connected' ? 'info' : s === 'error' ? 'error' : 'warn');
            this.onTransportStatus?.(s);
          },
          onLog: (msg, level) => this.addLog(msg, level),
        },
      );
    } else {
      // default: Azure IoT Hub via MQTT
      this.addLog(`Connecting to Azure IoT Hub`, 'info');
      this.transport = new MqttTransport(
        { connectionString: config.iotHubConnectionString, offlineQueueLimit: 200, keepalive: 60 },
        { onStatusChange: s => {
            this.addLog(`MQTT transport status: ${s}`, s === 'connected' ? 'info' : s === 'error' ? 'error' : 'warn');
            this.onTransportStatus?.(s);
          },
        },
      );
    }

    await this.transport.connect();
    this.running = true;
    this.framesSent = 0;
    this.addLog(`Gateway started successfully`, 'info');

    // Reload persisted lastSentTs (may have advanced while driver was solo)
    const raw = await AsyncStorage.getItem(LAST_SENT_TS_KEY);
    if (raw) {
      this.lastSentTs = Number(raw);
    } else {
      this.lastSentTs = Date.now();
      await AsyncStorage.setItem(LAST_SENT_TS_KEY, String(this.lastSentTs));
    }
    this.onLastSentTs?.(this.lastSentTs);

    // Kick off backlog sync in background
    this.syncBacklog(config).catch(e =>
      console.warn('[GatewayService] backlog sync error:', e),
    );
  }

  async stopGateway(): Promise<void> {
    if (!this.running) return;
    await this.transport?.disconnect();
    this.transport = null;
    this.running = false;
    this.onTransportStatus?.('disconnected');
  }

  // ── Backlog sync ────────────────────────────────────────────────────────────

  private async syncBacklog(config: GatewayConfig): Promise<void> {
    // ── Samsung Health: use native module for years of local history ─────
    const { SamsungHealthModule } = NativeModules as {
      SamsungHealthModule?: {
        fetchAllHistory(fromMs: number, toMs: number): Promise<HistoryMap>;
      };
    };

    const now  = Date.now();
    const from = this.lastSentTs > 0
      ? this.lastSentTs
      : now - 24 * 60 * 60 * 1000; // default: last 24 h if never sent

    if (now - from < 5_000) return; // lag < 5 s → no backlog

    // Try Samsung Health native module first (has years of data)
    if (config.activeDriver === 'SamsungHealth' && SamsungHealthModule?.fetchAllHistory) {
      await this.syncSamsungBacklog(SamsungHealthModule, config, from, now);
      return;
    }

    // Generic backlog: use the active driver's getHistory() (e.g. SignalK ring buffer)
    const driver = driverRegistry.getActive();
    if (!driver) return;

    this.syncingBacklog = true;
    let history: HistoryMap = {};
    try {
      history = await driver.getHistory(from, now);
    } catch (e) {
      console.warn('[GatewayService] getHistory failed:', e);
      this.syncingBacklog = false;
      return;
    }

    if (Object.keys(history).length === 0) {
      this.syncingBacklog = false;
      return;
    }

    // Group all readings into 1-minute time buckets
    const buckets = new Map<number, TelemetryData['measurements']>();
    for (const [key, samples] of Object.entries(history)) {
      for (const { v, ts } of samples) {
        const bucket = Math.floor(ts / 60_000) * 60_000;
        if (!buckets.has(bucket)) buckets.set(bucket, {});
        if (buckets.get(bucket)![key] == null) {
          buckets.get(bucket)![key] = v;
        }
      }
    }

    const sorted = [...buckets.entries()].sort(([a], [b]) => a - b);
    this.backlogTotal  = sorted.length;
    this.backlogSynced = 0;
    this.onBacklogProgress?.(0, this.backlogTotal);
    console.log(`[GatewayService] generic backlog: ${sorted.length} frames to send`);

    for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
      if (!this.running) break;

      const chunk   = sorted.slice(i, i + CHUNK_SIZE);
      let chunkMaxTs = this.lastSentTs;

      for (const [bucketTs, measurements] of chunk) {
        if (Object.keys(measurements).length === 0) continue;
        const frame: TelemetryData = {
          timestamp:    new Date(bucketTs).toISOString(),
          sourceDriver: config.activeDriver,
          entityId:     config.userId,
          measurements,
          metadata:     { platform: 'android', backfill: true },
        };
        if (this.transport?.publish(frame)) {
          this.framesSent += 1;
          this.onFrameSent?.(this.framesSent);
          if (bucketTs > chunkMaxTs) chunkMaxTs = bucketTs;
        }
      }

      if (chunkMaxTs > this.lastSentTs) {
        this.lastSentTs = chunkMaxTs;
        await AsyncStorage.setItem(LAST_SENT_TS_KEY, String(chunkMaxTs));
        this.onLastSentTs?.(this.lastSentTs);
      }

      this.backlogSynced = Math.min(i + CHUNK_SIZE, sorted.length);
      this.onBacklogProgress?.(this.backlogSynced, this.backlogTotal);

      await new Promise(r => setTimeout(r, 50));
    }

    this.syncingBacklog = false;
    this.onBacklogProgress?.(this.backlogTotal, this.backlogTotal);
    console.log('[GatewayService] generic backlog sync complete');
  }

  /** Samsung Health specific backlog sync using native module */
  private async syncSamsungBacklog(
    SamsungHealthModule: { fetchAllHistory(fromMs: number, toMs: number): Promise<HistoryMap> },
    config: GatewayConfig,
    from: number,
    now: number,
  ): Promise<void> {
    this.syncingBacklog = true;
    let history: HistoryMap = {};
    try {
      history = await SamsungHealthModule.fetchAllHistory(from, now);
    } catch (e) {
      console.warn('[GatewayService] fetchAllHistory failed:', e);
      this.syncingBacklog = false;
      return;
    }

    // Group all readings into 1-minute time buckets
    const buckets = new Map<number, TelemetryData['measurements']>();
    for (const [loincCode, samples] of Object.entries(history)) {
      for (const { v, ts } of samples) {
        const bucket = Math.floor(ts / 60_000) * 60_000;
        if (!buckets.has(bucket)) buckets.set(bucket, {});
        // Keep first reading per metric per bucket (already sorted ASC)
        if (buckets.get(bucket)![loincCode] == null) {
          buckets.get(bucket)![loincCode] = v;
        }
      }
    }

    const sorted = [...buckets.entries()].sort(([a], [b]) => a - b);
    this.backlogTotal  = sorted.length;
    this.backlogSynced = 0;
    this.onBacklogProgress?.(0, this.backlogTotal);
    console.log(`[GatewayService] backlog: ${sorted.length} frames to send`);

    for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
      if (!this.running) break;

      const chunk   = sorted.slice(i, i + CHUNK_SIZE);
      let chunkMaxTs = this.lastSentTs;

      for (const [bucketTs, measurements] of chunk) {
        if (Object.keys(measurements).length === 0) continue;
        const frame: TelemetryData = {
          timestamp:    new Date(bucketTs).toISOString(),
          sourceDriver: 'SamsungHealth',
          entityId:     config.userId,
          measurements,
          metadata:     { platform: 'android', backfill: true },
        };
        if (this.transport?.publish(frame)) {
          this.framesSent += 1;
          this.onFrameSent?.(this.framesSent);
          if (bucketTs > chunkMaxTs) chunkMaxTs = bucketTs;
        }
      }

      if (chunkMaxTs > this.lastSentTs) {
        this.lastSentTs = chunkMaxTs;
        await AsyncStorage.setItem(LAST_SENT_TS_KEY, String(chunkMaxTs));
        this.onLastSentTs?.(this.lastSentTs);
      }

      this.backlogSynced = Math.min(i + CHUNK_SIZE, sorted.length);
      this.onBacklogProgress?.(this.backlogSynced, this.backlogTotal);

      await new Promise(r => setTimeout(r, 50)); // yield between chunks
    }

    this.syncingBacklog = false;
    this.onBacklogProgress?.(this.backlogTotal, this.backlogTotal);
    console.log('[GatewayService] backlog sync complete');
  }

  // ── Live frame handling ─────────────────────────────────────────────────────

  private handleFrame(data: TelemetryData): void {
    if (!this.transport) return;
    if (!this.transport.publish(data)) return;
    this.framesSent += 1;
    this.onFrameSent?.(this.framesSent);
    const ts = new Date(data.timestamp).getTime();
    if (ts > this.lastSentTs) {
      this.lastSentTs = ts;
      this.onLastSentTs?.(ts);
      AsyncStorage.setItem(LAST_SENT_TS_KEY, String(ts)).catch(() => {});
    }
  }

  // ── Reset lag (sets lastSentTs to now & persists it) ────────────────────────

  async resetLastSentTs(): Promise<void> {
    const now = Date.now();
    this.lastSentTs = now;
    await AsyncStorage.setItem(LAST_SENT_TS_KEY, String(now));
    this.onLastSentTs?.(now);
  }
}

export const gatewayService = new GatewayService();

