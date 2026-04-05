/**
 * DriverManager — unified singleton for all driver registration and active-selection.
 *
 * Replaces both the old DriverRegistry (gateway) and VitalsRegistry (vitals screen).
 * There is exactly ONE active driver at a time; all screens read from it via
 * the same generic TelemetryProvider interface.
 *
 * Lifecycle ownership:
 *   - DriverManager only tracks registration and the active pointer.
 *   - The actual driver start()/stop() lifecycle is owned by gatewayStore.
 *   - HealthVitalsScreen calls getLatest()/getHistory() directly — no start() needed.
 */
import type { TelemetryProvider } from './types/TelemetryProvider';
import type { DriverType } from './types/TelemetryData';

class DriverManager {
  private readonly drivers: Map<DriverType, TelemetryProvider> = new Map();
  private activeId: DriverType | null = null;

  /** Register a driver. First registered becomes the default active. */
  register(driver: TelemetryProvider): void {
    this.drivers.set(driver.id, driver);
    if (this.activeId === null) {
      this.activeId = driver.id;
    }
  }

  /** Retrieve a registered driver by id without activating it. */
  get(id: DriverType): TelemetryProvider | undefined {
    return this.drivers.get(id);
  }

  /**
   * Set which driver is active.
   * Does NOT call stop/start — call gatewayStore.setActiveDriver() for that.
   */
  setActive(id: DriverType): void {
    if (this.drivers.has(id)) {
      this.activeId = id;
    }
  }

  /** The currently active driver, or null if none registered. */
  getActive(): TelemetryProvider | null {
    if (!this.activeId) return null;
    return this.drivers.get(this.activeId) ?? null;
  }

  getActiveId(): DriverType | null {
    return this.activeId;
  }

  /** All registered drivers, in registration order. */
  getAll(): TelemetryProvider[] {
    return Array.from(this.drivers.values());
  }

  has(id: DriverType): boolean {
    return this.drivers.has(id);
  }
}

/** Singleton shared across the whole app */
export const driverManager = new DriverManager();
