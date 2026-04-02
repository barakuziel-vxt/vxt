import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { BaseDriver } from '../core/BaseDriver';
import { DriverError } from '../core/types/TelemetryProvider';
import type { TelemetryData, DriverCapabilities } from '../core/types';

// ─── Native Module bridge declaration ────────────────────────────────────────
// This matches the Java module we expose in SamsungHealthModule.kt
const { SamsungHealthModule } = NativeModules as {
  SamsungHealthModule: {
    requestPermissions(): Promise<boolean>;
    isAvailable(): Promise<boolean>;
    startDataCollection(): Promise<void>;
    stopDataCollection(): Promise<void>;
    getLatestHeartRate(): Promise<RawSamsungSample>;
    getLatestBloodPressure(): Promise<RawSamsungSample>;
    getLatestStepCount(): Promise<RawSamsungSample>;
    getLatestSpo2(): Promise<RawSamsungSample>;
    getLatestBodyTemperature(): Promise<RawSamsungSample>;
    getLatestGlucose(): Promise<RawSamsungSample>;
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
 *   8867-4  → HeartRate
 *   8480-6  → BloodPressureSystolic
 *   55411-3 → StepCount (daily)
 *   59408-5 → SpO2 (oxygen saturation)
 *   8310-5  → BodyTemperature
 *   2339-0  → BloodGlucose
 */
export class SamsungHealthDriver extends BaseDriver {
  readonly displayName = 'Samsung Health';
  readonly capabilities: DriverCapabilities = {
    realtime: true,
    requiresHealthPermissions: true,
    requiresBackgroundExecution: true,
  };

  private emitter: NativeEventEmitter | null = null;
  private samplingTimer: ReturnType<typeof setInterval> | null = null;

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
    await SamsungHealthModule.startDataCollection();

    // Set up polling loop – Samsung Health SDK is pull-based, not push
    this.samplingTimer = setInterval(async () => {
      try {
        const sample = await this.collectAllMetrics();
        console.log('[SamsungHealthDriver] sample:', sample ? JSON.stringify(Object.keys(sample.measurements)) : 'null');
        if (sample) this.emit(sample);
      } catch (err) {
        this.emitError(
          new DriverError(this.displayName, 'SENSOR_ERROR', String(err), err),
        );
      }
    }, this.sampleIntervalMs);
  }

  protected async doStop(): Promise<void> {
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
   * Pulls the latest available reading from every metric type and
   * merges them into a single TelemetryData frame.
   * Uses Promise.allSettled so a missing sensor doesn't abort the batch.
   */
  private async collectAllMetrics(): Promise<TelemetryData | null> {
    const [hr, bp, steps, spo2, temp, glucose] = await Promise.allSettled([
      SamsungHealthModule.getLatestHeartRate(),
      SamsungHealthModule.getLatestBloodPressure(),
      SamsungHealthModule.getLatestStepCount(),
      SamsungHealthModule.getLatestSpo2(),
      SamsungHealthModule.getLatestBodyTemperature(),
      SamsungHealthModule.getLatestGlucose(),
    ]);

    const measurements: TelemetryData['measurements'] = {};

    if (hr.status === 'fulfilled' && hr.value?.value != null) {
      measurements['8867-4'] = hr.value.value;   // heart rate bpm
    }
    if (bp.status === 'fulfilled' && bp.value?.value != null) {
      measurements['8480-6'] = bp.value.value;   // systolic mmHg
    }
    if (steps.status === 'fulfilled' && steps.value?.value != null) {
      measurements['55411-3'] = steps.value.value; // step count
    }
    if (spo2.status === 'fulfilled' && spo2.value?.value != null) {
      measurements['59408-5'] = spo2.value.value;  // SpO2 %
    }
    if (temp.status === 'fulfilled' && temp.value?.value != null) {
      measurements['8310-5'] = temp.value.value;   // body temp °C
    }
    if (glucose.status === 'fulfilled' && glucose.value?.value != null) {
      measurements['2339-0'] = glucose.value.value; // glucose mg/dL
    }

    if (Object.keys(measurements).length === 0) return null;

    // Use most recent reading timestamp as frame timestamp
    const latestTs = Math.max(
      ...[hr, bp, steps, spo2, temp, glucose]
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
