import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';
import { BaseDriver } from '../core/BaseDriver';
import { DriverError } from '../core/types/TelemetryProvider';
import type { TelemetryData, DriverCapabilities } from '../core/types';

// ─── Native Module bridge ─────────────────────────────────────────────────
const { HealthConnectModule } = NativeModules as {
  HealthConnectModule: {
    isAvailable():                            Promise<boolean>;
    checkPermissions():                       Promise<boolean>;
    requestPermissions():                     Promise<boolean>;
    startDataCollection(intervalMs: number):  Promise<void>;
    stopDataCollection():                     Promise<void>;
    // Heart Rate
    getLatestHeartRate():                     Promise<RawHCSample>;
    getLatestHrMin():                         Promise<RawHCSample>;
    getLatestHrMax():                         Promise<RawHCSample>;
    // Blood
    getLatestBloodPressure():                 Promise<RawHCSample>;
    getLatestDiastolicBloodPressure():        Promise<RawHCSample>;
    getLatestStepCount():                     Promise<RawHCSample>;
    getLatestSpo2():                          Promise<RawHCSample>;
    getLatestBodyTemperature():               Promise<RawHCSample>;
    getLatestGlucose():                       Promise<RawHCSample>;
    // HC-exclusive
    getLatestRestingHeartRate():              Promise<RawHCSample>;
    getLatestHrv():                           Promise<RawHCSample>;
    getLatestRespirationRate():               Promise<RawHCSample>;
    // Sleep / activity
    getLatestSleepDuration():                 Promise<RawHCSample>;
    getLatestFloorsClimbed():                 Promise<RawHCSample>;
  };
};

interface RawHCSample {
  /** Unix epoch ms — real recording timestamp from Health Connect */
  timestamp: number;
  value:     number;
  unit:      string;
  deviceId?: string;
}

let configuredUserId = 'user_unknown';

// ─── Health Connect Driver ────────────────────────────────────────────────

/**
 * HealthConnectDriver
 *
 * Gateway telemetry driver reading from Android Health Connect.
 * Compatible with ANY watch/wearable that writes to HC (Samsung, Amazfit,
 * Garmin, Fitbit, Polar, Xiaomi, etc.) — no vendor-specific SDK required.
 *
 * Unlocks 3 metrics not available in SamsungHealthDriver (SDK 1.1.0 limitation):
 *   8418-4  Resting Heart Rate
 *   80404-7 HRV (rMSSD)
 *   9279-1  Respiration Rate
 */
export class HealthConnectDriver extends BaseDriver {
  readonly displayName = 'Health Connect';
  readonly capabilities: DriverCapabilities = {
    realtime:                   true,
    requiresHealthPermissions:  true,
    requiresBackgroundExecution: true,
  };

  private emitter: ReturnType<typeof DeviceEventEmitter.addListener> | null = null;
  private lastSent:      Record<string, number> = {};
  private lastTimestamp: Record<string, number> = {};

  constructor(
    private readonly userId:          string,
    private readonly sampleIntervalMs: number = 60_000,
  ) {
    super();
    configuredUserId = userId;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new DriverError(this.displayName, 'SDK_UNAVAILABLE', 'HealthConnectDriver is Android-only');
    }
    if (!HealthConnectModule) {
      throw new DriverError(this.displayName, 'SDK_UNAVAILABLE', 'HealthConnectModule native module not found');
    }

    const available = await HealthConnectModule.isAvailable();
    if (!available) {
      throw new DriverError(
        this.displayName, 'SDK_UNAVAILABLE',
        'Health Connect is not installed on this device. Install it from Play Store.',
      );
    }

    // Only request permissions if not already granted
    const alreadyGranted = await HealthConnectModule.checkPermissions();
    if (!alreadyGranted) {
      const granted = await HealthConnectModule.requestPermissions();
      if (!granted) {
        throw new DriverError(this.displayName, 'PERMISSION_DENIED', 'User denied Health Connect permissions');
      }
    }
  }

  protected async doStart(): Promise<void> {
    await HealthConnectModule.startDataCollection(this.sampleIntervalMs);

    this.emitter = DeviceEventEmitter.addListener('GatewaySampleTick', async () => {
      try {
        const sample = await this.collectAllMetrics();
        if (sample) this.emit(sample);
      } catch (err) {
        this.emitError(new DriverError(this.displayName, 'SENSOR_ERROR', String(err), err));
      }
    });
  }

  protected async doStop(): Promise<void> {
    if (this.emitter) { this.emitter.remove(); this.emitter = null; }
    await HealthConnectModule.stopDataCollection();
  }

  protected async fetchOnce(): Promise<TelemetryData | null> {
    try { return await this.collectAllMetrics(); }
    catch { return null; }
  }

  // ─── Data collection ──────────────────────────────────────────────────

  private async collectAllMetrics(): Promise<TelemetryData | null> {
    const [
      hr, sbp, dbp, steps, spo2, temp,
      glucose, hrMin, hrMax,
      rhr, hrv, rr,
      sleep, floors,
    ] = await Promise.allSettled([
      HealthConnectModule.getLatestHeartRate(),
      HealthConnectModule.getLatestBloodPressure(),
      HealthConnectModule.getLatestDiastolicBloodPressure(),
      HealthConnectModule.getLatestStepCount(),
      HealthConnectModule.getLatestSpo2(),
      HealthConnectModule.getLatestBodyTemperature(),
      HealthConnectModule.getLatestGlucose(),
      HealthConnectModule.getLatestHrMin(),
      HealthConnectModule.getLatestHrMax(),
      // HC-exclusive metrics
      HealthConnectModule.getLatestRestingHeartRate(),
      HealthConnectModule.getLatestHrv(),
      HealthConnectModule.getLatestRespirationRate(),
      HealthConnectModule.getLatestSleepDuration(),
      HealthConnectModule.getLatestFloorsClimbed(),
    ]);

    const candidates: Array<[string, PromiseSettledResult<RawHCSample>]> = [
      ['8867-4',  hr],
      ['8480-6',  sbp],
      ['8462-4',  dbp],
      ['55411-3', steps],
      ['59408-5', spo2],
      ['8310-5',  temp],
      ['2339-0',  glucose],
      ['8638-5',  hrMin],
      ['8639-3',  hrMax],
      ['8418-4',  rhr],    // HC-exclusive
      ['80404-7', hrv],    // HC-exclusive
      ['9279-1',  rr],     // HC-exclusive
      ['93832-4', sleep],
      ['55426-1', floors],
    ];

    const measurements: TelemetryData['measurements'] = {};
    for (const [code, result] of candidates) {
      if (result.status !== 'fulfilled' || result.value?.value == null) continue;
      const { value, timestamp: sampleTs } = result.value;
      const prevTs  = this.lastTimestamp[code] ?? 0;
      const isNewer = sampleTs > 0 ? sampleTs > prevTs : this.lastSent[code] !== value;
      if (isNewer) {
        measurements[code] = value;
        this.lastSent[code] = value;
        if (sampleTs > 0) this.lastTimestamp[code] = sampleTs;
      }
    }

    if (Object.keys(measurements).length === 0) return null;

    const latestTs = Math.max(
      ...candidates
        .map(([, r]) => r)
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<RawHCSample>).value?.timestamp ?? 0),
    );

    return {
      timestamp:    new Date(latestTs || Date.now()).toISOString(),
      sourceDriver: 'HealthConnect',
      entityId:     this.userId,
      measurements,
      metadata:     { platform: 'android', source: 'HealthConnect' },
    };
  }
}
