/**
 * HealthConnectVitalsProvider
 *
 * Bridges Android Health Connect (HealthConnectModule.kt) to the generic
 * VitalsProvider interface used by HealthVitalsScreen.
 *
 * Advantages over SamsungHealthVitalsProvider:
 *   - Works with ANY wearable that writes to Health Connect (Amazfit, Garmin,
 *     Xiaomi, Fitbit, Polar, Galaxy Watch, etc.)
 *   - Per-measurement timestamps (no daily-aggregate workaround needed)
 *   - Unlocks HRV, Resting HR, Respiration Rate (absent from Samsung SDK 1.1.0)
 *   - Source picker chip automatically appears in HealthVitalsScreen when
 *     both providers are registered.
 */

import { NativeModules, Platform } from 'react-native';
import type { VitalsProvider, VitalSnapshot, VitalHistory } from './types';

// ─── Native module bridge ──────────────────────────────────────────────────

interface RawSample  { value: number; timestamp: number; }
interface RawHistMap { [loincCode: string]: Array<{ v: number; ts: number }> }

const { HealthConnectModule: _mod } = NativeModules as {
  HealthConnectModule?: {
    isAvailable():                            Promise<boolean>;
    checkPermissions():                       Promise<boolean>;
    requestPermissions():                     Promise<boolean>;
    // Heart Rate
    getLatestHeartRate():                     Promise<RawSample>;
    getLatestHrMin():                         Promise<RawSample>;
    getLatestHrMax():                         Promise<RawSample>;
    // Blood
    getLatestSpo2():                          Promise<RawSample>;
    getLatestBloodPressure():                 Promise<RawSample>;
    getLatestDiastolicBloodPressure():        Promise<RawSample>;
    getLatestGlucose():                       Promise<RawSample>;
    // Body
    getLatestBodyTemperature():               Promise<RawSample>;
    // Activity
    getLatestStepCount():                     Promise<RawSample>;
    getLatestFloorsClimbed():                 Promise<RawSample>;
    // HC-exclusive metrics
    getLatestRestingHeartRate():              Promise<RawSample>;
    getLatestHrv():                           Promise<RawSample>;
    getLatestRespirationRate():               Promise<RawSample>;
    // Sleep
    getLatestSleepDuration():                 Promise<RawSample>;
    // History
    fetchAllHistory(fromMs: number, toMs: number): Promise<RawHistMap>;
  };
};

// ─── Helper ────────────────────────────────────────────────────────────────

async function trySnap(
  loincKey: string,
  fn: () => Promise<RawSample>,
): Promise<VitalSnapshot | null> {
  try {
    const r = await fn();
    if (r == null || r.value == null) return null;
    return { key: loincKey, value: r.value, timestamp: r.timestamp };
  } catch (e: any) {
    // NO_DATA is expected for metrics not yet recorded — suppress
    if (e?.code !== 'NO_DATA') {
      console.warn(`[HC] trySnap ${loincKey}: ${e?.code ?? 'ERR'} – ${e?.message ?? String(e)}`);
    }
    return null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────

export class HealthConnectVitalsProvider implements VitalsProvider {
  readonly id          = 'health-connect';
  readonly name        = 'Health Connect';
  readonly description = 'Reads health metrics from Android Health Connect. Works with any compatible wearable: Galaxy Watch, Amazfit, Garmin, Fitbit, Polar, Xiaomi, and more.';
  readonly platform    = 'Android';

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!_mod) return false;
    try { return await _mod.isAvailable(); }
    catch { return false; }
  }

  async checkHealthPermissions(): Promise<boolean> {
    if (!_mod?.checkPermissions) return false;
    try { return await _mod.checkPermissions(); }
    catch { return false; }
  }

  async requestHealthPermissions(): Promise<boolean> {
    if (!_mod?.requestPermissions) return false;
    try { return await _mod.requestPermissions(); }
    catch { return false; }
  }

  async getLatest(): Promise<VitalSnapshot[]> {
    if (!_mod) return [];

    const results = await Promise.all([
      // Heart Rate (all three — per-HR-record min/max/avg)
      trySnap('8867-4',  () => _mod!.getLatestHeartRate()),
      trySnap('8638-5',  () => _mod!.getLatestHrMin()),
      trySnap('8639-3',  () => _mod!.getLatestHrMax()),
      // Blood — now available in HC (were broken in Samsung SDK 1.1.0)
      trySnap('59408-5', () => _mod!.getLatestSpo2()),
      trySnap('8480-6',  () => _mod!.getLatestBloodPressure()),
      trySnap('8462-4',  () => _mod!.getLatestDiastolicBloodPressure()),
      trySnap('2339-0',  () => _mod!.getLatestGlucose()),
      // Body
      trySnap('8310-5',  () => _mod!.getLatestBodyTemperature()),
      // Activity
      trySnap('55423-8', () => _mod!.getLatestStepCount()),
      trySnap('55426-1', () => _mod!.getLatestFloorsClimbed()),
      // HC-exclusive metrics (not available in Samsung Health SDK 1.1.0)
      trySnap('8418-4',  () => _mod!.getLatestRestingHeartRate()),
      trySnap('80404-7', () => _mod!.getLatestHrv()),
      trySnap('9303-9',  () => _mod!.getLatestRespirationRate()),
      // Sleep
      trySnap('93832-4', () => _mod!.getLatestSleepDuration()),
    ]);

    const snapshots = results.filter((s): s is VitalSnapshot => s !== null);
    console.log(`[HC] getLatest: ${snapshots.length}/14 metrics: [${snapshots.map(s => s.key).join(', ')}]`);
    return snapshots;
  }

  async getHistory(fromMs: number, toMs: number): Promise<VitalHistory> {
    if (!_mod?.fetchAllHistory) return {};
    try {
      const data = await _mod.fetchAllHistory(fromMs, toMs);
      const keys = Object.keys(data);
      console.log(`[HC] getHistory: ${keys.length} metrics – [${keys.map(k => `${k}:${(data[k] as any[]).length}`).join(', ')}]`);
      return data;
    } catch (e: any) {
      console.warn(`[HC] getHistory error: ${e?.code} – ${e?.message ?? e}`);
      return {};
    }
  }
}
