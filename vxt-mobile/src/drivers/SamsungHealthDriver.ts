import { NativeModules, DeviceEventEmitter, Platform, PermissionsAndroid } from 'react-native';
import { BaseDriver } from '../core/BaseDriver';
import { DriverError } from '../core/types/TelemetryProvider';
import type { TelemetryData, DriverCapabilities, SnapshotMap, HistoryMap } from '../core/types';

// ─── Native Module bridge declaration ────────────────────────────────────────
// This matches the Java module we expose in SamsungHealthModule.kt
const { SamsungHealthModule } = NativeModules as {
  SamsungHealthModule: {
    requestPermissions(): Promise<boolean>;
    checkPermissions(): Promise<boolean>;
    isAvailable(): Promise<boolean>;
    getConnectedDeviceName(): Promise<string | null>;
    startDataCollection(intervalMs: number): Promise<void>;
    stopDataCollection(): Promise<void>;
    // Core vitals
    getLatestHeartRate(): Promise<RawSamsungSample>;
    getLatestBloodPressure(): Promise<RawSamsungSample>;        // SBP
    getLatestDiastolicBloodPressure(): Promise<RawSamsungSample>; // DBP
    getLatestStepCount(): Promise<RawSamsungSample>;
    getLatestSpo2(): Promise<RawSamsungSample>;
    getLatestBodyTemperature(): Promise<RawSamsungSample>;
    getLatestSkinTemperature(): Promise<RawSamsungSample>;
    getLatestBodyWeight(): Promise<RawSamsungSample>;
    getLatestBmi(): Promise<RawSamsungSample>;
    getLatestBodyFat(): Promise<RawSamsungSample>;
    getLatestGlucose(): Promise<RawSamsungSample>;
    getLatestFloorsClimbed(): Promise<RawSamsungSample>;
    getLatestAfib(): Promise<RawSamsungSample>;
    getLatestSleepDuration(): Promise<RawSamsungSample>;
    // Derived heart metrics
    getLatestHrv(): Promise<RawSamsungSample>;
    getLatestHrMin(): Promise<RawSamsungSample>;
    getLatestHrMax(): Promise<RawSamsungSample>;
    // Respiratory / cardiac
    getLatestRespirationRate(): Promise<RawSamsungSample>;
    // History
    fetchAllHistory(fromMs: number, toMs: number): Promise<Record<string, Array<{ v: number; ts: number }>>>;
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
  readonly id = 'SamsungHealth' as const;
  readonly displayName = 'Samsung Health';
  readonly platform = 'android' as const;
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

  // ─── Availability & Permissions ────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!SamsungHealthModule) return false;
    try { return await SamsungHealthModule.isAvailable(); }
    catch { return false; }
  }

  async checkPermissions(): Promise<boolean> {
    if (!SamsungHealthModule?.checkPermissions) return false;
    try { return await SamsungHealthModule.checkPermissions(); }
    catch { return false; }
  }

  async requestPermissions(): Promise<boolean> {
    if (!SamsungHealthModule?.requestPermissions) return false;
    try { return await SamsungHealthModule.requestPermissions(); }
    catch (e: any) {
      // POLICY_ERROR (error 2003) must be surfaced — re-throw so initialize() can show actionable message
      if (e?.code === 'POLICY_ERROR') throw e;
      return false;
    }
  }

  /** Returns the paired Galaxy Watch name, or null if unavailable. */
  async getConnectedDeviceName(): Promise<string | null> {
    if (!SamsungHealthModule?.getConnectedDeviceName) return null;
    try {
      if (Platform.OS === 'android' && Platform.Version >= 31) {
        const status = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          { title: 'Bluetooth', message: 'VXT needs Bluetooth to show your wearable name.', buttonPositive: 'Allow' },
        );
        if (status !== PermissionsAndroid.RESULTS.GRANTED) return null;
      }
      return await SamsungHealthModule.getConnectedDeviceName();
    } catch { return null; }
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

    // Check permissions first — only show dialog if not already granted.
    // This prevents the Samsung Health permission dialog from appearing twice
    // when both GatewayStatusScreen (driver start) and HealthVitalsScreen both
    // call into Samsung Health on app launch.
    const alreadyGranted = await SamsungHealthModule.checkPermissions();
    if (!alreadyGranted) {
      let granted = false;
      try {
        granted = await SamsungHealthModule.requestPermissions();
      } catch (e: any) {
        throw new DriverError(
          this.displayName,
          'PERMISSION_DENIED',
          e?.message ?? String(e),
        );
      }
      if (!granted) {
        throw new DriverError(
          this.displayName,
          'PERMISSION_DENIED',
          'User denied Samsung Health permissions',
        );
      }
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
      glucose, hrv, hrMin, hrMax, rr, afib,
      sleep, floors,
    ] = await Promise.allSettled([
      SamsungHealthModule.getLatestHeartRate(),
      SamsungHealthModule.getLatestBloodPressure(),
      SamsungHealthModule.getLatestDiastolicBloodPressure(),
      SamsungHealthModule.getLatestStepCount(),
      SamsungHealthModule.getLatestSpo2(),
      SamsungHealthModule.getLatestBodyTemperature(),
      SamsungHealthModule.getLatestGlucose(),
      SamsungHealthModule.getLatestHrv(),
      SamsungHealthModule.getLatestHrMin(),
      SamsungHealthModule.getLatestHrMax(),
      SamsungHealthModule.getLatestRespirationRate(),
      SamsungHealthModule.getLatestAfib(),
      SamsungHealthModule.getLatestSleepDuration(),
      SamsungHealthModule.getLatestFloorsClimbed(),
    ]);

    // Map each settled result to its LOINC code
    const candidates: Array<[string, PromiseSettledResult<RawSamsungSample>]> = [
      ['8867-4',  hr],
      ['8480-6',  sbp],
      ['8462-4',  dbp],
      ['55423-8', steps],   // fixed: was 55411-3
      ['59408-5', spo2],
      ['8310-5',  temp],
      ['2339-0',  glucose],
      ['80404-7', hrv],
      ['8638-5',  hrMin],
      ['8639-3',  hrMax],
      ['9303-9',  rr],      // fixed: was 9279-1
      ['73773-1', afib],    // fixed: was 80358-0 — matches getLatest()
      ['93832-4', sleep],
      ['55426-1', floors],
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

  // ─── One-shot Vitals (HealthVitalsScreen) ──────────────────────────────────

  /** Returns the latest snapshot for all supported metrics as a SnapshotMap. */
  async getLatest(): Promise<SnapshotMap | null> {
    if (!SamsungHealthModule) return null;

    async function trySnap(fn: () => Promise<RawSamsungSample>): Promise<{ value: number; ts: number } | null> {
      try {
        const r = await fn();
        if (r == null || r.value == null) return null;
        return { value: r.value, ts: r.timestamp };
      } catch { return null; }
    }

    const [hr, hrMin, hrMax, spo2, sbp, dbp, glucose, temp, skinTemp,
           weight, bmi, bodyFat, steps, floors, afib, sleep] = await Promise.all([
      trySnap(() => SamsungHealthModule.getLatestHeartRate()),
      trySnap(() => SamsungHealthModule.getLatestHrMin()),
      trySnap(() => SamsungHealthModule.getLatestHrMax()),
      trySnap(() => SamsungHealthModule.getLatestSpo2()),
      trySnap(() => SamsungHealthModule.getLatestBloodPressure()),
      trySnap(() => SamsungHealthModule.getLatestDiastolicBloodPressure()),
      trySnap(() => SamsungHealthModule.getLatestGlucose()),
      trySnap(() => SamsungHealthModule.getLatestBodyTemperature()),
      trySnap(() => SamsungHealthModule.getLatestSkinTemperature()),
      trySnap(() => SamsungHealthModule.getLatestBodyWeight()),
      trySnap(() => SamsungHealthModule.getLatestBmi()),
      trySnap(() => SamsungHealthModule.getLatestBodyFat()),
      trySnap(() => SamsungHealthModule.getLatestStepCount()),
      trySnap(() => SamsungHealthModule.getLatestFloorsClimbed()),
      trySnap(() => SamsungHealthModule.getLatestAfib()),
      trySnap(() => SamsungHealthModule.getLatestSleepDuration()),
    ]);

    const pairs: Array<[string, { value: number; ts: number } | null]> = [
      ['8867-4',  hr],    ['8638-5', hrMin],  ['8639-3', hrMax],
      ['59408-5', spo2],  ['8480-6', sbp],    ['8462-4', dbp],
      ['2339-0',  glucose], ['8310-5', temp],  ['8327-9', skinTemp],
      ['29463-7', weight], ['39156-5', bmi],   ['41982-0', bodyFat],
      ['55423-8', steps], ['55426-1', floors], ['73773-1', afib], ['93832-4', sleep],
    ];

    const snapshot: SnapshotMap = {};
    for (const [key, v] of pairs) {
      if (v !== null) snapshot[key] = v;
    }
    return Object.keys(snapshot).length > 0 ? snapshot : null;
  }

  async getHistory(fromMs: number, toMs: number): Promise<HistoryMap> {
    if (!SamsungHealthModule?.fetchAllHistory) return {};
    try {
      return await SamsungHealthModule.fetchAllHistory(fromMs, toMs);
    } catch (e: any) {
      console.warn(`[Samsung] getHistory error: ${e?.code} – ${e?.message ?? e}`);
      return {};
    }
  }
}
