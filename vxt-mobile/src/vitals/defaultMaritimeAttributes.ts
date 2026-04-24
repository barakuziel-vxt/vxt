/**
 * defaultMaritimeAttributes — offline-safe default attribute selection
 *
 * This file is the local source of truth for which attributes should be
 * pre-selected in the HealthVitals graph when no saved state exists, or
 * when new attributes are added that the user hasn't seen yet.
 *
 * Used by HealthVitalsScreen to merge with AsyncStorage state so that:
 *  - New default attributes appear automatically in the graph after an update
 *  - When offline / fresh install, sensible marine engine defaults are selected
 */

export const MARITIME_DEFAULT_KEYS: string[] = [
  'propulsion.main.load',
  'propulsion.main.coolantTemperature',
  'navigation.speedThroughWater',
  'navigation.speedOverGround',
  'propulsion.main.revolutions',
  'propulsion.main.oilTemperature',
  'propulsion.main.oilPressure',
  'propulsion.main.transmission.oilTemperature',
  'propulsion.main.exhaustTemperature',
  'propulsion.main.temperature',
  'tanks.fuel.0.currentLevel',
  'tanks.freshWater.0.currentLevel',
];

/**
 * Returns a Record<string, boolean> of the maritime defaults.
 * All keys default to true (selected in graph).
 */
export function getMaritimeDefaults(): Record<string, boolean> {
  return Object.fromEntries(MARITIME_DEFAULT_KEYS.map(k => [k, true]));
}
