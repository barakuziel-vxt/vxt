/**
 * AppleHealthDriver — iOS HealthKit stub driver.
 *
 * Placeholder driver for iOS HealthKit integration. Will be implemented
 * when the app ships on iOS using react-native-health or similar.
 *
 * Registering it now allows:
 *  - Driver Selection screen to show the "Apple Health" card
 *  - isAvailable() gate prevents accidental activation on Android
 */

import { Platform } from 'react-native';
import { BaseDriver } from '../core/BaseDriver';
import { DriverError } from '../core/types/TelemetryProvider';
import type { TelemetryData, DriverCapabilities, SnapshotMap, HistoryMap } from '../core/types';

export class AppleHealthDriver extends BaseDriver {
  readonly id = 'AppleHealth' as const;
  readonly displayName = 'Apple Health';
  readonly platform = 'ios' as const;
  readonly capabilities: DriverCapabilities = {
    realtime: false,
    requiresHealthPermissions: true,
    requiresBackgroundExecution: false,
  };

  // ─── Availability & Permissions ──────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    return Platform.OS === 'ios';
  }

  async checkPermissions(): Promise<boolean> { return false; }
  async requestPermissions(): Promise<boolean> { return false; }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (Platform.OS !== 'ios') {
      throw new DriverError(this.displayName, 'SDK_UNAVAILABLE', 'Apple Health is iOS-only');
    }
    throw new DriverError(this.displayName, 'SDK_UNAVAILABLE', 'Apple Health integration coming soon');
  }

  protected async doStart(): Promise<void> {
    throw new DriverError(this.displayName, 'SDK_UNAVAILABLE', 'Apple Health integration coming soon');
  }

  protected async doStop(): Promise<void> { /* no-op */ }

  // ─── Vitals (stub) ────────────────────────────────────────────────────────

  async getLatest(): Promise<SnapshotMap | null> { return null; }
  async getHistory(_fromMs: number, _toMs: number): Promise<HistoryMap> { return {}; }
}
