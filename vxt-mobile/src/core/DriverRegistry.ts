import type { TelemetryProvider, DriverType } from '../core/types';
import { DriverError } from '../core/types/TelemetryProvider';
import type { SamsungHealthDriver } from '../drivers/SamsungHealthDriver';

/**
 * DriverRegistry – Runtime Driver Injection (Strategy Selector).
 *
 * Maintains the pool of available drivers and exposes a single
 * `setActiveDriver()` method that the GatewayService calls.
 * The UI never touches a concrete driver directly – it operates
 * only through this registry.
 */
class DriverRegistry {
  private registry = new Map<DriverType, TelemetryProvider>();
  private active: TelemetryProvider | null = null;

  /** Register a driver. Called once during app bootstrap. */
  register(type: DriverType, driver: TelemetryProvider): void {
    this.registry.set(type, driver);
  }

  /** Retrieve a registered driver without activating it. */
  get(type: DriverType): TelemetryProvider {
    const d = this.registry.get(type);
    if (!d) throw new DriverError('DriverRegistry', 'SDK_UNAVAILABLE', `Driver "${type}" is not registered`);
    return d;
  }

  /**
   * Switch the active driver at runtime.
   * Stops the current driver (if any) before starting the new one.
   */
  async setActive(type: DriverType): Promise<TelemetryProvider> {
    if (this.active) {
      await this.active.stop();
    }
    const next = this.get(type);
    await next.initialize();
    this.active = next;
    return next;
  }

  getActive(): TelemetryProvider | null {
    return this.active;
  }

  listAvailable(): DriverType[] {
    return Array.from(this.registry.keys());
  }
}

/** Singleton instance shared across the app */
export const driverRegistry = new DriverRegistry();
