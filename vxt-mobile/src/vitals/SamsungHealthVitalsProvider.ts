/**
 * SamsungHealthVitalsProvider
 *
 * Bridges the Samsung Health Data SDK (via SamsungHealthModule.kt native
 * module) to the generic VitalsProvider interface.
 *
 * Returns LOINC-coded VitalSnapshot[] from getLatest() and VitalHistory
 * from getHistory(), exactly matching the contract in types.ts.
 */

import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { VitalsProvider, VitalSnapshot, VitalHistory } from './types';

// ─── Native module shape ───────────────────────────────────────────────────

interface RawSample    { value: number; timestamp: number; }
interface RawHistMap   { [loincCode: string]: Array<{ v: number; ts: number }> }

const { SamsungHealthModule: _mod } = NativeModules as {
  SamsungHealthModule?: {
    isAvailable():                     Promise<boolean>;
    requestPermissions():              Promise<boolean>;
    checkPermissions():                Promise<boolean>;
    getConnectedDeviceName():          Promise<string | null>;
    // Heart Rate
    getLatestHeartRate():              Promise<RawSample>;
    getLatestHrMin():                  Promise<RawSample>;
    getLatestHrMax():                  Promise<RawSample>;
    // Blood
    getLatestSpo2():                   Promise<RawSample>;
    getLatestBloodPressure():          Promise<RawSample>;
    getLatestDiastolicBloodPressure(): Promise<RawSample>;
    getLatestGlucose():                Promise<RawSample>;
    // Body
    getLatestBodyTemperature():        Promise<RawSample>;
    getLatestSkinTemperature():        Promise<RawSample>;
    getLatestBodyWeight():             Promise<RawSample>;
    getLatestBmi():                    Promise<RawSample>;
    getLatestBodyFat():                Promise<RawSample>;
    // Activity
    getLatestStepCount():              Promise<RawSample>;
    getLatestFloorsClimbed():          Promise<RawSample>;
    // Cardiac events
    getLatestAfib():                   Promise<RawSample>;
    // Sleep
    getLatestSleepDuration():          Promise<RawSample>;
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
    if (r == null || r.value == null) {
      console.warn(`[VXT] trySnap ${loincKey}: null/empty result`);
      return null;
    }
    console.log(`[VXT] trySnap ${loincKey}: value=${r.value} ts=${r.timestamp}`);
    return { key: loincKey, value: r.value, timestamp: r.timestamp };
  } catch (e: any) {
    const code = e?.code ?? 'ERR';
    const msg  = e?.message ?? String(e);
    console.warn(`[VXT] trySnap ${loincKey}: ${code} – ${msg}`);
    return null;
  }
}

// ─── Provider implementation ───────────────────────────────────────────────

export class SamsungHealthVitalsProvider implements VitalsProvider {
  readonly id          = 'samsung-health';
  readonly name        = 'Samsung Health';
  readonly description = 'Reads health metrics from Samsung Health app via the official Health Data SDK (Android only, requires Galaxy Watch for continuous vitals).';
  readonly platform    = 'Android';

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!_mod) { console.warn('[VXT] SamsungHealthModule: native module not found in NativeModules'); return false; }
    try { return await _mod.isAvailable(); }
    catch { return false; }
  }

  async getLatest(): Promise<VitalSnapshot[]> {
    if (!_mod) { console.warn('[VXT] getLatest: _mod is null'); return []; }
    console.log('[VXT] getLatest: reading all supported Samsung Health metrics...');

    // HRV (80404-7) and Respiration Rate (9303-9) confirmed absent from SDK 1.1.0 — not called.
    const results = await Promise.all([
      // Heart Rate
      trySnap('8867-4',  () => _mod!.getLatestHeartRate()),
      trySnap('8638-5',  () => _mod!.getLatestHrMin()),
      trySnap('8639-3',  () => _mod!.getLatestHrMax()),
      // Blood
      trySnap('59408-5', () => _mod!.getLatestSpo2()),
      trySnap('8480-6',  () => _mod!.getLatestBloodPressure()),
      trySnap('8462-4',  () => _mod!.getLatestDiastolicBloodPressure()),
      trySnap('2339-0',  () => _mod!.getLatestGlucose()),
      // Body
      trySnap('8310-5',  () => _mod!.getLatestBodyTemperature()),
      trySnap('8327-9',  () => _mod!.getLatestSkinTemperature()),
      trySnap('29463-7', () => _mod!.getLatestBodyWeight()),
      trySnap('39156-5', () => _mod!.getLatestBmi()),
      trySnap('41982-0', () => _mod!.getLatestBodyFat()),
      // Activity
      trySnap('55423-8', () => _mod!.getLatestStepCount()),
      trySnap('55426-1', () => _mod!.getLatestFloorsClimbed()),
      // Cardiac / Sleep
      trySnap('73773-1', () => _mod!.getLatestAfib()),
      trySnap('93832-4', () => _mod!.getLatestSleepDuration()),
    ]);

    const snapshots = results.filter((s): s is VitalSnapshot => s !== null);
    console.log(`[VXT] getLatest: resolved ${snapshots.length}/16 metrics: [${snapshots.map(s => s.key).join(', ')}]`);
    return snapshots;
  }

  async checkHealthPermissions(): Promise<boolean> {
    if (!_mod?.checkPermissions) return false;
    try {
      return await _mod.checkPermissions();
    } catch {
      return false;
    }
  }

  async requestHealthPermissions(): Promise<boolean> {
    if (!_mod?.requestPermissions) { console.warn('[VXT] requestPermissions: method not available'); return false; }
    console.log('[VXT] requestHealthPermissions: showing Samsung Health consent dialog...');
    try {
      const granted = await _mod.requestPermissions();
      console.log(`[VXT] requestHealthPermissions: granted=${granted}`);
      return granted;
    } catch (e: any) {
      console.warn(`[VXT] requestHealthPermissions error: ${e?.message ?? e}`);
      return false;
    }
  }

  async getConnectedDeviceName(): Promise<string | null> {
    if (!_mod?.getConnectedDeviceName) return null;
    try {
      // Android 12+ requires BLUETOOTH_CONNECT at runtime
      if (Platform.OS === 'android' && Platform.Version >= 31) {
        const status = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          { title: 'Bluetooth', message: 'VXT needs Bluetooth to show your wearable name.', buttonPositive: 'Allow' },
        );
        if (status !== PermissionsAndroid.RESULTS.GRANTED) return null;
      }
      return await _mod.getConnectedDeviceName();
    } catch { return null; }
  }

  async getHistory(fromMs: number, toMs: number): Promise<VitalHistory> {
    if (!_mod?.fetchAllHistory) { console.warn('[VXT] getHistory: fetchAllHistory not available'); return {}; }
    console.log(`[VXT] getHistory: from=${new Date(fromMs).toISOString()} to=${new Date(toMs).toISOString()}`);
    try {
      const data = await _mod.fetchAllHistory(fromMs, toMs);
      const keys = Object.keys(data);
      const counts = keys.map(k => `${k}:${(data[k] as any[]).length}`).join(', ');
      console.log(`[VXT] getHistory: received ${keys.length} metrics – [${counts}]`);
      return data;
    } catch (e: any) {
      console.warn(`[VXT] getHistory error: ${e?.code} – ${e?.message ?? e}`);
      return {};
    }
  }
}
