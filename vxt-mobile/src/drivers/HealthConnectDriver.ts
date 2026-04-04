import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';
import { BaseDriver } from '../core/BaseDriver';
import { DriverError } from '../core/types/TelemetryProvider';
import type { TelemetryData, DriverCapabilities, SnapshotMap, HistoryMap } from '../core/types';

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
    // New metrics
    getLatestActiveCalories():                Promise<RawHCSample>;
    getLatestDistance():                      Promise<RawHCSample>;
    getLatestVo2Max():                        Promise<RawHCSample>;
    getLatestWeight():                        Promise<RawHCSample>;
    getLatestBodyFat():                       Promise<RawHCSample>;
    fetchAllHistory(fromMs: number, toMs: number): Promise<import('../core/types').HistoryMap>;
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
  readonly id = 'HealthConnect' as const;
  readonly displayName = 'Health Connect';
  readonly platform = 'android' as const;
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

  // ─── Availability & Permissions ──────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!HealthConnectModule) return false;
    try { return await HealthConnectModule.isAvailable(); }
    catch { return false; }
  }

  async checkPermissions(): Promise<boolean> {
    if (!HealthConnectModule?.checkPermissions) return false;
    try { return await HealthConnectModule.checkPermissions(); }
    catch { return false; }
  }

  async requestPermissions(): Promise<boolean> {
    if (!HealthConnectModule?.requestPermissions) return false;
    try { return await HealthConnectModule.requestPermissions(); }
    catch { return false; }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new DriverError(this.displayName, 'SDK_UNAVAILABLE', 'HealthConnectDriver is Android-only');
    }
    if (!HealthConnectModule) {
      throw new DriverError(this.displayName, 'SDK_UNAVAILABLE', 'HealthConnectModule native module not found. Rebuild the app.');
    }
    // Availability check moved to doStart() — just registering the driver
    // should not throw so the user can select it and see a proper error.
  }

  protected async doStart(): Promise<void> {
    // Check availability now (not during initialize so switching doesn't fail silently)
    const available = await HealthConnectModule.isAvailable().catch(() => false);
    if (!available) {
      throw new DriverError(
        this.displayName, 'SDK_UNAVAILABLE',
        'Health Connect is not installed. Install the Health Connect app from the Play Store, then try again.',
      );
    }
    // Do NOT request permissions here — MainActivity uses singleTask launchMode which
    // makes startActivityForResult unreliable. Permissions are handled entirely by
    // HealthVitalsScreen via checkPermissions() + requestPermissions() + AppState listener.
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

  // ─── Data collection ──────────────────────────────────────────────────

  private async collectAllMetrics(): Promise<TelemetryData | null> {
    const [
      hr, sbp, dbp, steps, spo2, temp,
      glucose, hrMin, hrMax,
      rhr, hrv, rr,
      sleep, floors,
      activeCal, distance, vo2max, weight, bodyFat,
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
      // New metrics
      HealthConnectModule.getLatestActiveCalories(),
      HealthConnectModule.getLatestDistance(),
      HealthConnectModule.getLatestVo2Max(),
      HealthConnectModule.getLatestWeight(),
      HealthConnectModule.getLatestBodyFat(),
    ]);

    const candidates: Array<[string, PromiseSettledResult<RawHCSample>]> = [
      ['8867-4',  hr],
      ['8480-6',  sbp],
      ['8462-4',  dbp],
      ['55423-8', steps],   // fixed: was 55411-3
      ['59408-5', spo2],
      ['8310-5',  temp],
      ['2339-0',  glucose],
      ['8638-5',  hrMin],
      ['8639-3',  hrMax],
      ['8418-4',  rhr],     // HC-exclusive
      ['80404-7', hrv],     // HC-exclusive
      ['9303-9',  rr],      // HC-exclusive  fixed: was 9279-1
      ['93832-4', sleep],
      ['55426-1', floors],
      ['41981-2', activeCal],
      ['55430-3', distance],
      ['60842-2', vo2max],
      ['29463-7', weight],
      ['41982-0', bodyFat],
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

  // ─── One-shot Vitals (HealthVitalsScreen) ────────────────────────────────

  async getLatest(): Promise<SnapshotMap | null> {
    if (!HealthConnectModule) return null;

    async function trySnap(fn: () => Promise<RawHCSample>): Promise<{ value: number; ts: number } | null> {
      try {
        const r = await fn();
        if (r == null || r.value == null) return null;
        return { value: r.value, ts: r.timestamp };
      } catch (e: any) {
        if (e?.code !== 'NO_DATA') {
          console.warn(`[HC] trySnap: ${e?.code ?? 'ERR'} – ${e?.message ?? String(e)}`);
        }
        return null;
      }
    }

    const [hr, hrMin, hrMax, spo2, sbp, dbp, glucose, temp,
           steps, floors, rhr, hrv, rr, sleep,
           activeCal, distance, vo2max, weight, bodyFat] = await Promise.all([
      trySnap(() => HealthConnectModule.getLatestHeartRate()),
      trySnap(() => HealthConnectModule.getLatestHrMin()),
      trySnap(() => HealthConnectModule.getLatestHrMax()),
      trySnap(() => HealthConnectModule.getLatestSpo2()),
      trySnap(() => HealthConnectModule.getLatestBloodPressure()),
      trySnap(() => HealthConnectModule.getLatestDiastolicBloodPressure()),
      trySnap(() => HealthConnectModule.getLatestGlucose()),
      trySnap(() => HealthConnectModule.getLatestBodyTemperature()),
      trySnap(() => HealthConnectModule.getLatestStepCount()),
      trySnap(() => HealthConnectModule.getLatestFloorsClimbed()),
      trySnap(() => HealthConnectModule.getLatestRestingHeartRate()),
      trySnap(() => HealthConnectModule.getLatestHrv()),
      trySnap(() => HealthConnectModule.getLatestRespirationRate()),
      trySnap(() => HealthConnectModule.getLatestSleepDuration()),
      trySnap(() => HealthConnectModule.getLatestActiveCalories()),
      trySnap(() => HealthConnectModule.getLatestDistance()),
      trySnap(() => HealthConnectModule.getLatestVo2Max()),
      trySnap(() => HealthConnectModule.getLatestWeight()),
      trySnap(() => HealthConnectModule.getLatestBodyFat()),
    ]);

    const pairs: Array<[string, { value: number; ts: number } | null]> = [
      ['8867-4', hr],  ['8638-5', hrMin], ['8639-3', hrMax],
      ['59408-5', spo2], ['8480-6', sbp], ['8462-4', dbp],
      ['2339-0', glucose], ['8310-5', temp],
      ['55423-8', steps], ['55426-1', floors],
      ['8418-4', rhr], ['80404-7', hrv], ['9303-9', rr], ['93832-4', sleep],
      ['41981-2', activeCal], ['55430-3', distance], ['60842-2', vo2max],
      ['29463-7', weight], ['41982-0', bodyFat],
    ];

    const snapshot: SnapshotMap = {};
    for (const [key, v] of pairs) {
      if (v !== null) snapshot[key] = v;
    }
    return Object.keys(snapshot).length > 0 ? snapshot : null;
  }

  async getHistory(fromMs: number, toMs: number): Promise<HistoryMap> {
    if (!HealthConnectModule?.fetchAllHistory) return {};
    try {
      return await HealthConnectModule.fetchAllHistory(fromMs, toMs);
    } catch (e: any) {
      console.warn(`[HC] getHistory error: ${e?.code} – ${e?.message ?? e}`);
      return {};
    }
  }
}
