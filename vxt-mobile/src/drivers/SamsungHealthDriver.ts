import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';
import { BaseDriver } from '../core/BaseDriver';
import { DriverError } from '../core/types/TelemetryProvider';
import type { TelemetryData, DriverCapabilities } from '../core/types';

// ─── Native Module bridge declaration ────────────────────────────────────────
// This matches the Java module we expose in SamsungHealthModule.kt
const { SamsungHealthModule } = NativeModules as {
  SamsungHealthModule: {
    requestPermissions(): Promise<boolean>;
    isAvailable(): Promise<boolean>;
    startDataCollection(intervalMs: number): Promise<void>;
    stopDataCollection(): Promise<void>;
    // Core vitals
    getLatestHeartRate(): Promise<RawSamsungSample>;
    getLatestBloodPressure(): Promise<RawSamsungSample>;        // SBP
    getLatestDiastolicBloodPressure(): Promise<RawSamsungSample>; // DBP
    getLatestStepCount(): Promise<RawSamsungSample>;
    getLatestSpo2(): Promise<RawSamsungSample>;
    getLatestBodyTemperature(): Promise<RawSamsungSample>;
    getLatestGlucose(): Promise<RawSamsungSample>;
    getLatestAvgGlucose(): Promise<RawSamsungSample>;
    // Derived heart metrics
    getLatestRestingHeartRate(): Promise<RawSamsungSample>;
    getLatestHrv(): Promise<RawSamsungSample>;
    getLatestHrMin(): Promise<RawSamsungSample>;
    getLatestHrMax(): Promise<RawSamsungSample>;
    // Respiratory / cardiac
    getLatestRespirationRate(): Promise<RawSamsungSample>;
    getLatestAfib(): Promise<RawSamsungSample>;
  };
};

interface RawSamsungSample {
  /** Unix epoch ms */
  timestamp: number;
  value: number;
  unit: string;
  /** Device serial / model identifier */
  deviceId?: string;
}

/** User ID injected at runtime from config */
let configuredUserId = 'user_unknown';

// ─── Samsung Health Driver ────────────────────────────────────────────────────

/**
 * SamsungHealthDriver
 *
 * Reads health vitals from Samsung Health (via Galaxy Watch / phone
 * sensors) through the Native Module bridge (SamsungHealthModule.kt).
 *
 * LOINC codes map to these Samsung-specific data types:
 *   8867-4  → Heart Rate
 *   8480-6  → BP Systolic
 *   8462-4  → BP Diastolic
 *   55411-3 → Step Count (daily)
 *   59408-5 → SpO2
 *   8310-5  → Body Temperature
 *   2339-0  → Blood Glucose
 *   2345-7  → Average Glucose
 *   8418-4  → Resting Heart Rate
 *   80404-7 → Heart Rate Variability
 *   8638-5  → HR Min
 *   8639-3  → HR Max
 *   9279-1  → Respiration Rate
 *   80358-0 → AFib detection
 *
 * Only measurements whose value changed since the last transmission
 * are included in each telemetry frame (delta mode).
 */
export class SamsungHealthDriver extends BaseDriver {
  readonly displayName = 'Samsung Health';
  readonly capabilities: DriverCapabilities = {
    realtime: true,
    requiresHealthPermissions: true,
    requiresBackgroundExecution: true,
  };

  private emitter: ReturnType<typeof DeviceEventEmitter.addListener> | null = null;
  private samplingTimer: ReturnType<typeof setInterval> | null = null;
  /** Last values sent — used for delta (changed-only) transmission */
  private lastSent: Record<string, number> = {};
  /** Last Samsung Health recording timestamp per metric (epoch ms) — skip if not newer */
  private lastTimestamp: Record<string, number> = {};

  // Sampling interval: default 5 s (overridable via GatewayConfig)
  constructor(
    private readonly userId: string,
    private readonly sampleIntervalMs: number = 5000,
  ) {
    super();
    configuredUserId = userId;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new DriverError(
        this.displayName,
        'SDK_UNAVAILABLE',
        'SamsungHealthDriver is Android-only',
      );
    }

    if (!SamsungHealthModule) {
      throw new DriverError(
        this.displayName,
        'SDK_UNAVAILABLE',
        'SamsungHealthModule native module not found. Ensure the Android project is built.',
      );
    }

    const available = await SamsungHealthModule.isAvailable();
    if (!available) {
      throw new DriverError(
        this.displayName,
        'SDK_UNAVAILABLE',
        'Samsung Health app is not installed on this device',
      );
    }

    const granted = await SamsungHealthModule.requestPermissions();
    if (!granted) {
      throw new DriverError(
        this.displayName,
        'PERMISSION_DENIED',
        'User denied Samsung Health permissions',
      );
    }
  }

  protected async doStart(): Promise<void> {
    // Pass the interval to Kotlin so the foreground service Handler fires at the
    // correct rate — this runs reliably even when the screen is off, unlike JS setInterval.
    await SamsungHealthModule.startDataCollection(this.sampleIntervalMs);

    this.emitter = DeviceEventEmitter.addListener('GatewaySampleTick', async () => {
      try {
        const sample = await this.collectAllMetrics();
        console.log('[SamsungHealthDriver] sample:', sample ? JSON.stringify(Object.keys(sample.measurements)) : 'null');
        if (sample) this.emit(sample);
      } catch (err) {
        this.emitError(
          new DriverError(this.displayName, 'SENSOR_ERROR', String(err), err),
        );
      }
    });
  }

  protected async doStop(): Promise<void> {
    if (this.emitter) {
      this.emitter.remove();
      this.emitter = null;
    }
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = null;
    }
    await SamsungHealthModule.stopDataCollection();
  }

  protected async fetchOnce(): Promise<TelemetryData | null> {
    try {
      return await this.collectAllMetrics();
    } catch {
      return null;
    }
  }

  // ─── Data collection ───────────────────────────────────────────────────────

  /**
   * Pulls the latest reading from every supported metric and returns a
   * frame containing ONLY measurements whose value changed since the
   * last transmission (delta mode — saves bandwidth and DB writes).
   * Uses Promise.allSettled so a missing sensor never aborts the batch.
   */
  private async collectAllMetrics(): Promise<TelemetryData | null> {
    const [
      hr, sbp, dbp, steps, spo2, temp,
      glucose, avgGlucose, rhr, hrv, hrMin, hrMax, rr, afib,
    ] = await Promise.allSettled([
      SamsungHealthModule.getLatestHeartRate(),
      SamsungHealthModule.getLatestBloodPressure(),
      SamsungHealthModule.getLatestDiastolicBloodPressure(),
      SamsungHealthModule.getLatestStepCount(),
      SamsungHealthModule.getLatestSpo2(),
      SamsungHealthModule.getLatestBodyTemperature(),
      SamsungHealthModule.getLatestGlucose(),
      SamsungHealthModule.getLatestAvgGlucose(),
      SamsungHealthModule.getLatestRestingHeartRate(),
      SamsungHealthModule.getLatestHrv(),
      SamsungHealthModule.getLatestHrMin(),
      SamsungHealthModule.getLatestHrMax(),
      SamsungHealthModule.getLatestRespirationRate(),
      SamsungHealthModule.getLatestAfib(),
    ]);

    // Map each settled result to its LOINC code
    const candidates: Array<[string, PromiseSettledResult<RawSamsungSample>]> = [
      ['8867-4',  hr],
      ['8480-6',  sbp],
      ['8462-4',  dbp],
      ['55411-3', steps],
      ['59408-5', spo2],
      ['8310-5',  temp],
      ['2339-0',  glucose],
      ['2345-7',  avgGlucose],
      ['8418-4',  rhr],
      ['80404-7', hrv],
      ['8638-5',  hrMin],
      ['8639-3',  hrMax],
      ['9279-1',  rr],
      ['80358-0', afib],
    ];

    // Delta: include only metrics where Samsung Health recorded a newer reading
    // (sample.timestamp > lastTimestamp[code]).  When real SDK data is identical
    // on two consecutive polls the timestamp does NOT advance, so we skip it.
    // Fallback: if timestamp is unavailable (stub edge-case) fall back to value diff.
    const measurements: TelemetryData['measurements'] = {};
    for (const [code, result] of candidates) {
      if (result.status !== 'fulfilled' || result.value?.value == null) continue;
      const { value, timestamp: sampleTs } = result.value;
      const prevTs = this.lastTimestamp[code] ?? 0;
      // If the sensor gave us a real timestamp, use it; otherwise fall back to value diff
      const isNewer = sampleTs > 0 ? sampleTs > prevTs : this.lastSent[code] !== value;
      if (isNewer) {
        measurements[code] = value;
        this.lastSent[code] = value;
        if (sampleTs > 0) this.lastTimestamp[code] = sampleTs;
      }
    }

    if (Object.keys(measurements).length === 0) return null;

    // Use most recent reading timestamp as frame timestamp
    const allResults = candidates.map(([, r]) => r);
    const latestTs = Math.max(
      ...allResults
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<RawSamsungSample>).value?.timestamp ?? 0),
    );

    return {
      timestamp:    new Date(latestTs || Date.now()).toISOString(),
      sourceDriver: 'SamsungHealth',
      entityId:     this.userId,
      measurements,
      metadata: { platform: 'android' },
    };
  }
}
