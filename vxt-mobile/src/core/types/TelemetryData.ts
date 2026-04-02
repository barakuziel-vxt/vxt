/**
 * TelemetryData – the canonical, provider-agnostic telemetry object
 * that flows through the entire VXT pipeline.
 *
 * Every Driver must map its raw data into this shape before handing
 * it to the GatewayService, which forwards it to Azure IoT Hub.
 */
export interface TelemetryData {
  /** ISO-8601 UTC timestamp when the measurement was recorded */
  timestamp: string;

  /** Identifies the data source driver that produced this reading */
  sourceDriver: DriverType;

  /**
   * Unique entity identifier.
   * - Vessels: MMSI  (e.g. "234567890")
   * - Users:   user-ID from Junction provider (e.g. "user_033114869")
   */
  entityId: string;

  /**
   * One or more named measurements in this sample.
   * Key = SignalK path (vessels) or LOINC code (health).
   * Value = numeric reading or nested object for composite values.
   */
  measurements: Record<string, MeasurementValue>;

  /** Optional metadata forwarded verbatim to IoT Hub */
  metadata?: Record<string, string | number | boolean>;
}

/** Scalar or composite measurement value */
export type MeasurementValue = number | string | boolean | Record<string, number>;

// ─── Supported driver types ───────────────────────────────────────────────────

export type DriverType =
  | 'SamsungHealth'
  | 'AppleHealth'    // reserved – future
  | 'SignalK'        // reserved – future
  | 'AzureCloud'     // reserved – future
  | 'Mock';

// ─── Driver capability flags ─────────────────────────────────────────────────

export interface DriverCapabilities {
  /** Driver can produce data in real time (streaming) */
  realtime: boolean;
  /** Driver requires android/iOS health permissions */
  requiresHealthPermissions: boolean;
  /** Needs background execution permission */
  requiresBackgroundExecution: boolean;
}

// ─── Session / connection status ─────────────────────────────────────────────

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface ProviderStatus {
  driver: DriverType;
  connection: ConnectionStatus;
  lastSample?: string;        // ISO timestamp
  samplesDelivered: number;
  errorMessage?: string;
}

export interface AzureConnectionStatus {
  connection: ConnectionStatus;
  lastPublished?: string;     // ISO timestamp
  messagesPublished: number;
  errorMessage?: string;
}

// ─── Gateway configuration ───────────────────────────────────────────────────

export interface GatewayConfig {
  /** Which driver to activate on startup */
  activeDriver: DriverType;
  /** Sampling interval in milliseconds */
  sampleIntervalMs: number;
  /** IoT Hub device connection string */
  iotHubConnectionString: string;
  /** MQTT QoS level (0 = at-most-once, 1 = at-least-once) */
  mqttQos: 0 | 1;
  /** User/entity ID forwarded as entityId in every telemetry frame */
  userId: string;
}
