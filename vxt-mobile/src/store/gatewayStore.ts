import { create } from 'zustand';
import { driverRegistry } from '../core/DriverRegistry';
import { gatewayService } from '../services/GatewayService';
import { SamsungHealthDriver } from '../drivers/SamsungHealthDriver';
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
  activeDriver:     'SamsungHealth',
  sampleIntervalMs: 60000,  // 60 s → 1 frame/min, 60 frames/hr
  mqttQos:          1,
  userId:           DEFAULT_USER_ID,
};

// ─── Store shape ───────────────────────────────────────────────────────────

interface GatewayState {
  isRunning:       boolean;
  driverStatus:    ConnectionStatus;
  transportStatus: TransportStatus;
  activeDriver:    DriverType;
  framesSent:      number;
  lastError:       string | null;
  config:          GatewayConfig;

  startGateway(): Promise<void>;
  stopGateway(): Promise<void>;
  setActiveDriver(type: DriverType): Promise<void>;
  updateConfig(patch: Partial<GatewayConfig>): void;
  clearError(): void;
}

// ─── Store implementation ──────────────────────────────────────────────────

export const useGatewayStore = create<GatewayState>((set, get) => ({
  isRunning:       false,
  driverStatus:    'disconnected',
  transportStatus: 'disconnected',
  activeDriver:    DEFAULT_CONFIG.activeDriver,
  framesSent:      0,
  lastError:       null,
  config:          DEFAULT_CONFIG,

  // ── Start pipeline ────────────────────────────────────────────────────
  async startGateway() {
    const { config, isRunning } = get();
    if (isRunning) return;

    // Register the correct driver if not yet present
    if (!driverRegistry.getActive()) {
      const driver = new SamsungHealthDriver(config.userId, config.sampleIntervalMs);
      driverRegistry.register('SamsungHealth', driver);
      await driverRegistry.setActive('SamsungHealth');  // must await — sets active synchronously after initialize()
    }

    // Wire GatewayService callbacks → store updates
    gatewayService.setCallbacks({
      onFrameSent:       (total) => set({ framesSent: total }),
      onTransportStatus: (s)     => set({ transportStatus: s }),
      onDriverStatus:    (s)     => set({ driverStatus: s }),
      onDriverError:     (msg)   => set({ lastError: msg }),
    });

    try {
      await gatewayService.start(config);
      set({ isRunning: true, lastError: null });
    } catch (err) {
      console.error('[Gateway] start failed:', String(err));
      set({ lastError: String(err), isRunning: false });
    }
  },

  // ── Stop pipeline ─────────────────────────────────────────────────────
  async stopGateway() {
    if (!get().isRunning) return;
    await gatewayService.stop();
    set({
      isRunning:       false,
      driverStatus:    'disconnected',
      transportStatus: 'disconnected',
    });
  },

  // ── Hot-swap driver without restarting the whole pipeline ─────────────
  async setActiveDriver(type: DriverType) {
    const { isRunning, config } = get();
    if (isRunning) await gatewayService.stop();

    const driver = new SamsungHealthDriver(config.userId, config.sampleIntervalMs);
    driverRegistry.register(type, driver);
    await driverRegistry.setActive(type);

    set({ activeDriver: type });
    if (isRunning) await gatewayService.start(config);
  },

  // ── Config patch ──────────────────────────────────────────────────────
  updateConfig(patch) {
    set(s => ({ config: { ...s.config, ...patch } }));
  },

  clearError() { set({ lastError: null }); },
}));
