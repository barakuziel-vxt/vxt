import { create } from 'zustand';
import { driverRegistry } from '../core/DriverRegistry';
import { driverManager } from '../core/DriverManager';
import { gatewayService } from '../services/GatewayService';
import { SamsungHealthDriver }  from '../drivers/SamsungHealthDriver';
import { HealthConnectDriver }  from '../drivers/HealthConnectDriver';
import { IOT_HUB_CONNECTION_STRING, DEFAULT_USER_ID } from '../config/secrets';
import type {
  DriverType,
  GatewayConfig,
  ConnectionStatus,
} from '../core/types';
import type { TransportStatus } from '../services/MqttTransport';

// ─── Default config ────────────────────────────────────────────────────────
const DEFAULT_CONFIG: GatewayConfig = {
  iotHubConnectionString: IOT_HUB_CONNECTION_STRING,
  activeDriver:     'HealthConnect',
  sampleIntervalMs: 60000,  // 60 s → 1 frame/min, 60 frames/hr
  gatewayType:      'iothub',
  kafkaBootstrap:   '192.168.1.22:9092',
  kafkaTopic:       'iot-telemetry',
  mqttQos:          1,
  userId:           DEFAULT_USER_ID,
};

/** Human-readable lag string, e.g. "2 h 15 min" or "47 min" */
function formatLag(ms: number): string {
  if (ms <= 0) return 'live';
  const minutes = Math.floor(ms / 60_000);
  const hours   = Math.floor(minutes / 60);
  const mins    = minutes % 60;
  if (hours > 0) return `${hours} h ${mins} min`;
  return `${minutes} min`;
}

// ─── Store shape ───────────────────────────────────────────────────────────

interface GatewayState {
  driverRunning:    boolean;
  gatewayRunning:   boolean;
  driverStatus:     ConnectionStatus;
  transportStatus:  TransportStatus;
  activeDriver:     DriverType;
  framesSent:       number;
  lastSentTs:       number;       // epoch ms of last successfully sent frame
  lagMs:            number;       // Date.now() - lastSentTs (updated every 30 s)
  lagDisplay:       string;       // human-readable lag, e.g. "2 h 15 min"
  isSyncingBacklog: boolean;
  backlogSynced:    number;
  backlogTotal:     number;
  lastError:        string | null;
  config:           GatewayConfig;

  startDriver():  Promise<void>;
  stopDriver():   Promise<void>;
  startGateway(): Promise<void>;
  stopGateway():  Promise<void>;
  setActiveDriver(type: DriverType): Promise<void>;
  updateConfig(patch: Partial<GatewayConfig>): void;
  clearError(): void;
  resetLag(): Promise<void>;
}

// ─── Lag ticker (updates lagMs every 30 s while store is alive) ────────────
let _lagInterval: ReturnType<typeof setInterval> | null = null;

function ensureLagTicker(getState: () => GatewayState) {
  if (_lagInterval) return;
  _lagInterval = setInterval(() => {
    const { lastSentTs, lagMs: prev } = getState();
    if (lastSentTs <= 0) return;
    const next = Date.now() - lastSentTs;
    if (Math.abs(next - prev) > 5_000) {
      // Only write if changed meaningfully — avoids unnecessary re-renders
      useGatewayStore.setState({ lagMs: next, lagDisplay: formatLag(next) });
    }
  }, 30_000);
}

// ─── Store implementation ──────────────────────────────────────────────────

export const useGatewayStore = create<GatewayState>((set, get) => ({
  driverRunning:    false,
  gatewayRunning:   false,
  driverStatus:     'disconnected',
  transportStatus:  'disconnected',
  activeDriver:     DEFAULT_CONFIG.activeDriver,
  framesSent:       0,
  lastSentTs:       0,
  lagMs:            0,
  lagDisplay:       '—',
  isSyncingBacklog: false,
  backlogSynced:    0,
  backlogTotal:     0,
  lastError:        null,
  config:           DEFAULT_CONFIG,

  // ── Start Driver only (no MQTT) ───────────────────────────────────────
  async startDriver() {
    const { driverRunning, config } = get();
    if (driverRunning) return;

    try {
      if (!driverRegistry.getActive()) {
        if (config.activeDriver === 'HealthConnect') {
          const driver = new HealthConnectDriver(config.userId, config.sampleIntervalMs);
          driverRegistry.register('HealthConnect', driver);
          await driverRegistry.setActive('HealthConnect');
        } else {
          const driver = new SamsungHealthDriver(config.userId, config.sampleIntervalMs);
          driverRegistry.register('SamsungHealth', driver);
          await driverRegistry.setActive('SamsungHealth');
        }
      }

      gatewayService.setCallbacks({
        onFrameSent:       (total) => set({ framesSent: total }),
        onTransportStatus: (s)     => set({ transportStatus: s }),
        onDriverStatus:    (s)     => set({ driverStatus: s }),
        onDriverError:     (msg)   => set({ lastError: msg }),
        onLastSentTs:      (ts) => {
          const lagMs = Date.now() - ts;
          set({ lastSentTs: ts, lagMs, lagDisplay: formatLag(lagMs) });
        },
        onBacklogProgress: (synced, total) =>
          set({ backlogSynced: synced, backlogTotal: total, isSyncingBacklog: synced < total }),
      });

      await gatewayService.startDriver(config);
      set({ driverRunning: true, lastError: null });
      ensureLagTicker(get);
    } catch (err) {
      set({ lastError: String(err), driverRunning: false });
    }
  },

  // ── Stop Driver (and gateway if running) ──────────────────────────────
  async stopDriver() {
    if (!get().driverRunning) return;
    await gatewayService.stopDriver();
    set({
      driverRunning:   false,
      gatewayRunning:  false,
      driverStatus:    'disconnected',
      transportStatus: 'disconnected',
    });
  },

  // ── Start Gateway (MQTT to Azure) — starts driver first if needed ─────
  async startGateway() {
    const { gatewayRunning } = get();
    if (gatewayRunning) return;

    try {
      if (!get().driverRunning) await get().startDriver();
      // If driver failed to start, lastError is already set — abort
      if (!get().driverRunning) return;

      await gatewayService.startGateway(get().config);
      set({ gatewayRunning: true, lastError: null });
    } catch (err) {
      set({ lastError: String(err), gatewayRunning: false });
    }
  },

  // ── Stop Gateway only (driver keeps running) ──────────────────────────
  async stopGateway() {
    if (!get().gatewayRunning) return;
    await gatewayService.stopGateway();
    set({ gatewayRunning: false, transportStatus: 'disconnected' });
  },

  // ── Hot-swap driver ───────────────────────────────────────────────────
  async setActiveDriver(type: DriverType) {
    const { driverRunning, activeDriver: prevDriver, config } = get();
    if (driverRunning) await get().stopDriver();

    // Always keep driverManager in sync
    driverManager.setActive(type);

    if (!driverRegistry.has(type)) {
      if (type === 'SamsungHealth') {
        driverRegistry.register('SamsungHealth', new SamsungHealthDriver(config.userId, config.sampleIntervalMs));
      } else if (type === 'HealthConnect') {
        driverRegistry.register('HealthConnect', new HealthConnectDriver(config.userId, config.sampleIntervalMs));
      } else {
        // SignalK / AppleHealth: managed via driverManager only
        set({ activeDriver: type, config: { ...config, activeDriver: type } });
        return;
      }
    }

    if (driverRegistry.has(type)) {
      try {
        await driverRegistry.setActive(type);
        set({ activeDriver: type, config: { ...config, activeDriver: type } });
      } catch (err) {
        // Restore previous driver on failure
        driverManager.setActive(prevDriver);
        if (driverRegistry.has(prevDriver)) {
          try { await driverRegistry.setActive(prevDriver); } catch { /* best effort */ }
        }
        set({ activeDriver: prevDriver });
        throw err; // Re-throw so DriverSelectorScreen can show the error
      }
    }
  },

  updateConfig(patch: Partial<GatewayConfig>) {
    set(s => ({ config: { ...s.config, ...patch } }));
  },

  clearError() {
    set({ lastError: null });
  },

  async resetLag() {
    const now = Date.now();
    await gatewayService.resetLastSentTs();
    set({ lastSentTs: now, lagMs: 0, lagDisplay: '\u2014' });
  },
}));
