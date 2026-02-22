/**
 * Unit conversion utility for maritime and health telemetry data
 * Converts raw sensor values to user-friendly display units
 */

/**
 * Conversion rules for different attribute codes
 * Maps attributeCode patterns to conversion functions
 */
const conversionRules = {
  // Pressure: Pascals to Bar (1 Bar = 100000 Pa)
  'propulsion.main.oilPressure': (value) => (value / 100000).toFixed(1),
  
  // Temperature: Kelvin to Celsius (K - 273.15)
  'propulsion.main.temperature': (value) => (value - 273.15).toFixed(1),
  
  // Electrical: No conversion needed (already in correct units)
  'electrical.dc.houseBattery.voltage': (value) => value.toFixed(2),
  'electrical.dc.houseBattery.current': (value) => value.toFixed(2),
  
  // Environment: No conversion  
  'environment': (value) => value.toFixed(2),
  
  // Navigation: No conversion
  'navigation': (value) => value.toFixed(2),
  
  // Tanks: No conversion
  'tanks': (value) => value.toFixed(2),
};

/**
 * Unit display mapping for different attribute codes
 */
const unitDisplay = {
  'propulsion.main.oilPressure': 'Bar',
  'propulsion.main.temperature': '°C',
  'electrical.dc.houseBattery.voltage': 'V',
  'electrical.dc.houseBattery.current': 'A',
};

/**
 * Converts a numeric value based on the attribute code
 * @param {number} value - The raw sensor value
 * @param {string} attributeCode - The attribute identifier (e.g., 'propulsion.main.oilPressure')
 * @returns {number|string} - The converted value as number or formatted string
 */
export const convertValue = (value, attributeCode) => {
  if (value === null || value === undefined) {
    return value;
  }

  // Look for exact match first
  if (conversionRules[attributeCode]) {
    const converted = conversionRules[attributeCode](value);
    return parseFloat(converted);
  }

  // Look for pattern matches (e.g., 'environment*' matches 'environment.outside.temperature')
  for (const [pattern, converter] of Object.entries(conversionRules)) {
    if (pattern.includes('*') || attributeCode.startsWith(pattern)) {
      const converted = converter(value);
      return parseFloat(converted);
    }
  }

  // Default: return value as-is with 2 decimal places
  return parseFloat(value.toFixed(2));
};

/**
 * Gets the display unit for an attribute
 * @param {string} attributeCode - The attribute identifier
 * @returns {string} - The unit symbol (e.g., 'Bar', '°C', 'V')
 */
export const getUnit = (attributeCode) => {
  return unitDisplay[attributeCode] || '';
};

/**
 * Formats a value for display with appropriate unit
 * @param {number} value - The raw sensor value
 * @param {string} attributeCode - The attribute identifier
 * @returns {string} - Formatted string like "3.1 Bar" or "12.45 V"
 */
export const formatValueWithUnit = (value, attributeCode) => {
  const converted = convertValue(value, attributeCode);
  const unit = getUnit(attributeCode);
  return unit ? `${converted} ${unit}` : `${converted}`;
};

/**
 * Batch convert multiple telemetry entries
 * @param {Array} entries - Array of telemetry entries with numericValue and attributeCode
 * @returns {Array} - Array with converted values
 */
export const convertTelemetryData = (entries) => {
  if (!Array.isArray(entries)) {
    return entries;
  }

  return entries.map((entry) => ({
    ...entry,
    numericValue: convertValue(entry.numericValue, entry.attributeCode),
  }));
};
