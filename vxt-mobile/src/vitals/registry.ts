/**
 * vitalsRegistry
 *
 * Singleton registry for VitalsProvider instances.
 * The screen always calls `vitalsRegistry.getActive()` — it never imports
 * any concrete provider directly.
 *
 * On Android the Samsung Health provider is auto-registered.
 * Additional providers (REST, Apple Health relay, …) can be added at runtime
 * via `registerRestProvider()` or `register()`.
 */

import { Platform } from 'react-native';

import type { VitalsProvider, RestApiProviderConfig } from './types';
import { SamsungHealthVitalsProvider } from './SamsungHealthVitalsProvider';
import { RestApiVitalsProvider }        from './RestApiVitalsProvider';

class VitalsRegistry {
  private _providers = new Map<string, VitalsProvider>();
  private _activeId  = '';

  /** Register a provider; first registered becomes the default active one. */
  register(p: VitalsProvider): void {
    this._providers.set(p.id, p);
    if (!this._activeId) {
      this._activeId = p.id;
    }
  }

  /** Switch the active provider by id. No-op if id is unknown. */
  setActive(id: string): void {
    if (this._providers.has(id)) {
      this._activeId = id;
    }
  }

  /** Returns the currently active provider, or null if none registered. */
  getActive(): VitalsProvider | null {
    return this._providers.get(this._activeId) ?? null;
  }

  /** All registered providers in insertion order. */
  getAll(): VitalsProvider[] {
    return Array.from(this._providers.values());
  }

  /** Convenience: create + register a REST provider from config. */
  registerRestProvider(cfg: RestApiProviderConfig): VitalsProvider {
    const p = new RestApiVitalsProvider(cfg);
    this.register(p);
    return p;
  }
}

export const vitalsRegistry = new VitalsRegistry();

// ── Auto-register platform default ──────────────────────────────────────────
if (Platform.OS === 'android') {
  vitalsRegistry.register(new SamsungHealthVitalsProvider());
}
