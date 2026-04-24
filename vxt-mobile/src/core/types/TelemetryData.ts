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

/**
 * Generic snapshot returned by IDriver.getLatest().
 * Each key maps to the latest reading for that metric (LOINC code, SignalK path, etc.).
 */
export type SnapshotMap = Record<string, { value: number; ts: number }>;

/**
 * History map returned by IDriver.getHistory().
 * Each key maps to an ASC-sorted array of { value, timestamp } pairs.
 */
export type HistoryMap = Record<string, Array<{ v: number; ts: number }>>;

// ─── Supported driver types ───────────────────────────────────────────────────

export type DriverType =
  | 'SamsungHealth'
  | 'HealthConnect'  // Android Health Connect — any wearable
  | 'AppleHealth'    // iOS HealthKit — future
  | 'SignalK'        // Marine telemetry via SignalK REST API
  | 'ELM327'         // Automotive OBD-II via ELM327 Bluetooth Classic (SAE J1979)
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
  /** Gateway type: 'iothub' (Azure) or 'kafka' (Redpanda/Confluent) */
  gatewayType: 'iothub' | 'kafka';
  /** IoT Hub device connection string */
  iotHubConnectionString: string;
  /** Kafka bootstrap servers (e.g., '192.168.1.22:9092') */
  kafkaBootstrap: string;
  /** Kafka topic name (default: 'iot-telemetry') */
  kafkaTopic: string;
  /** MQTT QoS level (0 = at-most-once, 1 = at-least-once) */
  mqttQos: 0 | 1;
  /** User/entity ID forwarded as entityId in every telemetry frame */
  userId: string;
}
