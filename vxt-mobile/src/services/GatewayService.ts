import { driverRegistry } from '../core/DriverRegistry';
import { MqttTransport } from './MqttTransport';
import type { TelemetryData, GatewayConfig, ConnectionStatus } from '../core/types';
import type { TransportStatus } from './MqttTransport';

// ─── GatewayService ────────────────────────────────────────────────────────

/**
 * GatewayService
 *
 * Singleton orchestrator that wires the active TelemetryProvider to
 * the MQTT transport and forwards every incoming frame to Azure IoT Hub.
 *
 * Lifecycle:
 *   gatewayService.start(config)   → initialise driver + connect MQTT
 *   gatewayService.stop()          → flush queue, disconnect, stop driver
 *
 * The Zustand store owns the visible state; GatewayService fires
 * onStatusChange callbacks so the store can update the UI reactively.
 */
export class GatewayService {
  private transport: MqttTransport | null = null;
  private running = false;
  private framesSent = 0;

  private onFrameSent?:       (total: number) => void;
  private onTransportStatus?: (s: TransportStatus) => void;
  private onDriverStatus?:    (s: ConnectionStatus) => void;
  private onDriverError?:     (msg: string) => void;

  // ─── Public API ──────────────────────────────────────────────────────────

  isRunning() { return this.running; }
  getFramesSent() { return this.framesSent; }

  setCallbacks(cbs: {
    onFrameSent?:       (total: number) => void;
    onTransportStatus?: (s: TransportStatus) => void;
    onDriverStatus?:    (s: ConnectionStatus) => void;
    onDriverError?:     (msg: string) => void;
  }) {
    this.onFrameSent       = cbs.onFrameSent;
    this.onTransportStatus = cbs.onTransportStatus;
    this.onDriverStatus    = cbs.onDriverStatus;
    this.onDriverError     = cbs.onDriverError;
  }

  async start(config: GatewayConfig): Promise<void> {
    if (this.running) return;

    // 1. Get the active driver from registry
    const driver = driverRegistry.getActive();
    if (!driver) throw new Error('No active driver registered');

    // 2. Initialise and start the driver
    await driver.initialize();
    this.onDriverStatus?.('connecting');

    driver.onData((data: TelemetryData) => this.handleFrame(data));
    driver.onError(err => this.onDriverError?.(err.message));

    await driver.start();
    this.onDriverStatus?.('connected');

    // 3. Connect MQTT transport
    this.transport = new MqttTransport(
      {
        connectionString: config.iotHubConnectionString,
        offlineQueueLimit: 100,
        keepalive: 60,
      },
      { onStatusChange: s => this.onTransportStatus?.(s) },
    );
    await this.transport.connect();

    this.running = true;
    this.framesSent = 0;
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    // Stop driver first so no more frames arrive
    const driver = driverRegistry.getActive();
    await driver?.stop();
    this.onDriverStatus?.('disconnected');

    // Then disconnect transport
    await this.transport?.disconnect();
    this.transport = null;

    this.running = false;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private handleFrame(data: TelemetryData): void {
    if (!this.transport) return;
    console.log('[GatewayService] frame received, transport status:', this.transport.getStatus());
    const sent = this.transport.publish(data);
    console.log('[GatewayService] publish result:', sent);
    if (sent) {
      this.framesSent += 1;
      this.onFrameSent?.(this.framesSent);
    }
  }
}

/** Module-level singleton — import and use directly */
export const gatewayService = new GatewayService();
