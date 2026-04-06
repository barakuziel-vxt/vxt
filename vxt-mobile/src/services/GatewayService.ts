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

    // Create transport based on gateway type
    if (config.gatewayType === 'kafka') {
      this.transport = new KafkaTransport(
        { bootstrap: config.kafkaBootstrap, topic: config.kafkaTopic, offlineQueueLimit: 200 },
        { onStatusChange: s => this.onTransportStatus?.(s) },
      );
    } else {
      // default: Azure IoT Hub via MQTT
      this.transport = new MqttTransport(
        { connectionString: config.iotHubConnectionString, offlineQueueLimit: 200, keepalive: 60 },
        { onStatusChange: s => this.onTransportStatus?.(s) },
      );
    }

    await this.transport.connect();
    this.running = true;
    this.framesSent = 0;

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
    const { SamsungHealthModule } = NativeModules as {
      SamsungHealthModule?: {
        fetchAllHistory(fromMs: number, toMs: number): Promise<HistoryMap>;
      };
    };
    if (!SamsungHealthModule?.fetchAllHistory) return;

    const now  = Date.now();
    const from = this.lastSentTs > 0
      ? this.lastSentTs
      : now - 24 * 60 * 60 * 1000; // default: last 24 h if never sent

    if (now - from < 5_000) return; // lag < 5 s → no backlog

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

