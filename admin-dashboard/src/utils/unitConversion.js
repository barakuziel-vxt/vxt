/**
 * Unit conversion utility for maritime and health telemetry data
 * Uses universal, reusable conversion rules based on unit pairs (source → target)
 * This approach is protocol/attribute agnostic and works for any data type
 */

/**
 * Universal conversion rules - map from sourceUnit→targetUnit to conversion function
 * These rules are physics-based and work universally across all domains
 */
const UNIVERSAL_CONVERSIONS = {
  // ===== PRESSURE CONVERSIONS =====
  'Pa→Bar': (value) => value / 100000,
  'Pa→hPa': (value) => value / 100,
  'Pa→mmHg': (value) => value * 0.00750062,
  'Pa→psi': (value) => value * 0.000145038,
  'Bar→Pa': (value) => value * 100000,
  'Bar→psi': (value) => value * 14.5038,
  'hPa→Pa': (value) => value * 100,
  
  // ===== TEMPERATURE CONVERSIONS =====
  'K→°C': (value) => value - 273.15,
  'K→°F': (value) => (value - 273.15) * 9/5 + 32,
  '°C→K': (value) => value + 273.15,
  '°C→°F': (value) => value * 9/5 + 32,
  '°F→°C': (value) => (value - 32) * 5/9,
  '°F→K': (value) => (value - 32) * 5/9 + 273.15,
  
  // ===== SPEED CONVERSIONS =====
  'm/s→kn': (value) => value / 0.514444,
  'm/s→km/h': (value) => value * 3.6,
  'm/s→mph': (value) => value * 2.23694,
  'kn→m/s': (value) => value * 0.514444,
  'kn→km/h': (value) => value * 1.852,
  'kn→mph': (value) => value * 1.15078,
  'km/h→m/s': (value) => value / 3.6,
  'km/h→kn': (value) => value / 1.852,
  'mph→m/s': (value) => value / 2.23694,
  'mph→kn': (value) => value / 1.15078,
  
  // ===== ANGLE CONVERSIONS =====
  'rad→°': (value) => value * 180 / Math.PI,
  'rad→turns': (value) => value / (2 * Math.PI),
  '°→rad': (value) => value * Math.PI / 180,
  
  // ===== TIME CONVERSIONS =====
  'ms→s': (value) => value / 1000,
  's→ms': (value) => value * 1000,
  'h→s': (value) => value * 3600,
  's→h': (value) => value / 3600,
  
  // ===== SMALL DISTANCE CONVERSIONS =====
  'mm/s→cm/s': (value) => value / 10,
  'mm/s→m/s': (value) => value / 1000,
  'cm/s→m/s': (value) => value / 100,
  'm→km': (value) => value / 1000,
  'km→m': (value) => value * 1000,
  'mm→m': (value) => value / 1000,
  
  // ===== WEIGHT CONVERSIONS =====
  'kg→lb': (value) => value * 2.20462,
  'lb→kg': (value) => value / 2.20462,
  'g→kg': (value) => value / 1000,
  'kg→g': (value) => value * 1000,
  
  // ===== GLUCOSE CONVERSIONS =====
  'mg/dL→mmol/L': (value) => value * 0.0555,
  'mmol/L→mg/dL': (value) => value / 0.0555,
  
  // ===== IDENTITY CONVERSIONS (no actual conversion, same unit) =====
  'bpm→bpm': (value) => value,
  '%→%': (value) => value,
  'mmHg→mmHg': (value) => value,
  'mg/dL→mg/dL': (value) => value,
  'mmol/L→mmol/L': (value) => value,
  'V→V': (value) => value,
  'A→A': (value) => value,
  'rpm→rpm': (value) => value,
  'W→W': (value) => value,
  'Wh→Wh': (value) => value,
  'text→text': (value) => value,
  'bool→bool': (value) => value,
  'lux→lux': (value) => value,
  'pH→pH': (value) => value,
  '°→°': (value) => value,
  'rad→rad': (value) => value,
  'nm→nm': (value) => value,
  'ft→ft': (value) => value,
  'mi→mi': (value) => value,
  'L→L': (value) => value,
  'gal→gal': (value) => value,
};

/**
 * Source unit assumptions for attributes that may not have explicit sourceUnit from protocol
 * Used when API doesn't provide sourceUnit, allows frontend to infer the conversion
 * Especially useful for custom yacht attributes and non-protocol-mapped data
 */
const SOURCE_UNIT_ASSUMPTIONS = {
  // Yacht propulsion - always in Pa from SignalK
  'propulsion.main.oilPressure': 'Pa',
  'propulsion.main.temperature': 'K',
  'propulsion.main.revolutions': 'rpm',
  
  // Yacht tanks - assuming liters (level in L)
  'tanks.freshWaterTank.level': 'L',
  'tanks.wasteWaterTank.level': 'L',
  'tanks.fuelTank.level': 'L',
  
  // Yacht environment - from SignalK
  'environment.outside.pressure': 'Pa',
  'environment.outside.temperature': 'K',
  'environment.water.temperature': 'K',
  'environment.wind.speedApparent': 'm/s',
  'environment.wind.speedTrue': 'm/s',
  'environment.wind.directionApparent': 'rad',
  'environment.wind.directionTrue': 'rad',
  
  // Yacht navigation
  'navigation.speedOverGround': 'm/s',
  'navigation.speedThroughWater': 'm/s',
  'navigation.courseOverGround': 'rad',
  'navigation.courseOverGroundMagnetic': 'rad',
  'navigation.headingTrue': 'rad',
  'navigation.headingMagnetic': 'rad',
  
  // Yacht electrical - no conversion needed
  'electrical.dc.houseBattery.voltage': 'V',
  'electrical.dc.houseBattery.current': 'A',
};

/**
 * Health vital attributes that should display as integers (no decimal places)
 * All health measurements are typically whole numbers in clinical display
 */
const INTEGER_DISPLAY_ATTRIBUTES = new Set([
  // Heart rate metrics - LOINC codes
  '8867-4', '8639-3', '8638-5', '59408-5',
  // Heart rate metrics - attribute names
  'AvgHR', 'MaxHR', 'MinHR', 'RestingHR', 'RHR', 'HeartRate',
  
  // Blood Pressure - LOINC codes
  '8480-6', '8462-4',
  // Blood Pressure - attribute names
  'Systolic', 'Diastolic', 'SystolicBP', 'DiastolicBP',
  
  // Temperature - LOINC code
  '8418-4',
  // Temperature - attribute names
  'BodyTemp', 'Temperature',
  
  // Oxygen Saturation - LOINC code
  '2708-6',
  // Oxygen Saturation - attribute names
  'OxygenSat', 'SpO2',
  
  // Respiratory Rate - LOINC codes
  '9279-1', '3150-0',
  // Respiratory Rate - attribute names
  'BreathsPerMin', 'RespiratoryRate', 'RR',
  
  // Blood Glucose - LOINC codes
  '2345-7', '2339-0',
  // Blood Glucose - attribute names
  'AvgGlucose', 'Glucose', 'BloodGlucose',
  
  // Heart Rate Variability - LOINC code
  '80404-7',
  // Heart Rate Variability - attribute names
  'HRV_RMSSD', 'HRV',
  
  // ECG & Cardiac - LOINC code
  '80358-0',
  // ECG & Cardiac - attribute names
  'ECGClassification', 'AfibResult', 'AFib',
  
  // Other health metrics
  'BMI', 'BloodPressure', 'HeartRateVariability',
]);

/**
 * Display unit preferences for common attributes
 * Maps attribute code to their preferred display unit
 * This provides the target unit for all conversions
 * Comprehensive mapping for health vitals, maritime, and health provider data
 */
const DISPLAY_UNIT_PREFERENCES = {
  // ============ MARITIME / YACHT ATTRIBUTES ============
  
  // Propulsion
  'propulsion.main.temperature': '°C',
  'propulsion.main.oilPressure': 'Bar',
  'propulsion.main.revolutions': 'rpm',
  
  // Tanks - Water and Fuel (displayed as percentage)
  'tanks.freshWaterTank.level': '%',
  'tanks.wasteWaterTank.level': '%',
  'tanks.fuelTank.level': '%',
  
  // Environment: Pressure (unified to Bar)
  'environment.outside.pressure': 'Bar',
  'environment.water.pressure': 'Bar',
  'environment.water.seawater.pressure': 'Bar',
  
  // Environment: Temperature (unified to °C)
  'environment.outside.temperature': '°C',
  'environment.water.temperature': '°C',
  'environment.water.seawater.temperature': '°C',
  
  // Environment: Wind (speed in knots, direction in degrees)
  'environment.wind.speedApparent': 'kn',
  'environment.wind.speedTrue': 'kn',
  'environment.wind.directionApparent': '°',
  'environment.wind.directionTrue': '°',
  'environment.wind.speedOverGround': 'kn',
  
  // Navigation: Speed (knots), Course/Heading (degrees)
  'navigation.speedOverGround': 'kn',
  'navigation.speedThroughWater': 'kn',
  'navigation.courseOverGround': '°',
  'navigation.courseOverGroundMagnetic': '°',
  'navigation.headingTrue': '°',
  'navigation.headingMagnetic': '°',
  'navigation.position': 'position',
  
  // Electrical: Already in correct units
  'electrical.dc.houseBattery.voltage': 'V',
  'electrical.dc.houseBattery.current': 'A',
  'electrical.batteries.house.current': 'A',
  
  // ============ HEALTH VITALS (LOINC CODES & NAMES) ============
  
  // Heart Rate metrics - BY LOINC CODE
  '8867-4': 'bpm',              // Heart rate (LOINC)
  '8639-3': 'bpm',              // Heart rate maximum (LOINC)
  '8638-5': 'bpm',              // Heart rate minimum (LOINC)
  '59408-5': 'bpm',             // Heart rate (general LOINC)
  
  // Heart Rate metrics - BY NAME (fallback)
  'AvgHR': 'bpm',                // Average heart rate
  'MaxHR': 'bpm',                // Maximum heart rate
  'MinHR': 'bpm',                // Minimum heart rate
  'RestingHR': 'bpm',            // Resting heart rate
  'RHR': 'bpm',                  // Resting heart rate
  'HeartRate': 'bpm',            // Generic heart rate
  
  // Blood Pressure - BY LOINC CODE
  '8480-6': 'mmHg',              // Systolic blood pressure (LOINC)
  '8462-4': 'mmHg',              // Diastolic blood pressure (LOINC)
  
  // Blood Pressure - BY NAME
  'Systolic': 'mmHg',            // Systolic
  'Diastolic': 'mmHg',           // Diastolic
  'SystolicBP': 'mmHg',          // Systolic blood pressure
  'DiastolicBP': 'mmHg',         // Diastolic blood pressure
  
  // Temperature - BY LOINC CODE
  '8418-4': '°C',                // Body temperature (LOINC)
  
  // Temperature - BY NAME
  'BodyTemp': '°C',              // Body temperature
  'Temperature': '°C',           // Generic temperature
  
  // Oxygen Saturation - BY LOINC CODE
  '2708-6': '%',                 // Oxygen saturation (LOINC)
  
  // Oxygen Saturation - BY NAME
  'OxygenSat': '%',              // Oxygen saturation
  'SpO2': '%',                   // Peripheral capillary oxygen saturation
  
  // Respiratory Rate - BY LOINC CODE
  '9279-1': 'bpm',               // Respiratory rate (LOINC)
  '3150-0': 'bpm',               // Respiratory rate alternative (LOINC)
  
  // Respiratory Rate - BY NAME
  'BreathsPerMin': 'bpm',        // Breaths per minute
  'RespiratoryRate': 'bpm',      // Respiratory rate
  'RR': 'bpm',                   // Respiratory rate shorthand
  
  // Blood Glucose - BY LOINC CODE
  '2345-7': 'mg/dL',             // Glucose (LOINC)
  '2339-0': 'mg/dL',             // Glucose alternative (LOINC)
  
  // Blood Glucose - BY NAME
  'AvgGlucose': 'mg/dL',         // Average glucose
  'Glucose': 'mg/dL',            // Blood glucose generic
  'BloodGlucose': 'mg/dL',       // Blood glucose
  
  // Heart Rate Variability - BY LOINC CODE
  '80404-7': 'ms',               // HRV - Standard deviation of NN intervals (LOINC)
  
  // Heart Rate Variability - BY NAME
  'HRV_RMSSD': 'ms',             // HRV - Root Mean Square of Successive Differences
  'HRV': 'ms',                   // Heart rate variability
  
  // ECG & Cardiac - BY LOINC CODE
  '80358-0': 'text',             // Atrial fibrillation (LOINC)
  
  // ECG & Cardiac - BY NAME
  'ECGClassification': 'text',   // ECG classification (no conversion)
  'AfibResult': 'text',          // Atrial fibrillation result (no conversion)
  'AFib': 'text',                // Atrial fibrillation (shorthand)
  
  // Other common health metrics
  'BMI': 'kg/m²',                // Body Mass Index
  'BloodPressure': 'mmHg',       // Generic blood pressure
  'HeartRateVariability': 'ms',  // Heart rate variability
};

/**
 * Pattern-based display unit fallbacks for attributes not explicitly listed
 * Provides sensible defaults when exact attribute code not found
 * Patterns are matched case-insensitively against attribute codes
 */
const DISPLAY_UNIT_PATTERNS = [
  // ===== HEALTH/MEDICAL PATTERNS =====
  { pattern: 'temperature', unit: '°C' },
  { pattern: 'temp', unit: '°C' },
  { pattern: 'body.temp', unit: '°C' },
  
  { pattern: 'heart.rate', unit: 'bpm' },
  { pattern: 'heart rate', unit: 'bpm' },
  { pattern: 'heartrate', unit: 'bpm' },
  { pattern: 'pulse', unit: 'bpm' },
  
  { pattern: 'systolic', unit: 'mmHg' },
  { pattern: 'diastolic', unit: 'mmHg' },
  { pattern: 'blood.pressure', unit: 'mmHg' },
  { pattern: 'bloodpressure', unit: 'mmHg' },
  
  { pattern: 'oxygen', unit: '%' },
  { pattern: 'spo2', unit: '%' },
  { pattern: 'saturation', unit: '%' },
  
  { pattern: 'glucose', unit: 'mg/dL' },
  { pattern: 'blood.glucose', unit: 'mg/dL' },
  
  { pattern: 'breathing', unit: 'bpm' },
  { pattern: 'respiration', unit: 'bpm' },
  { pattern: 'breath', unit: 'bpm' },
  
  { pattern: 'hrv', unit: 'ms' },
  { pattern: 'variability', unit: 'ms' },
  
  // ===== MARITIME PATTERNS =====
  { pattern: 'pressure', unit: 'Bar' },
  { pattern: 'oil', unit: 'Bar' },  // Oil pressure defaults to Bar
  
  { pattern: 'voltage', unit: 'V' },
  { pattern: 'volt', unit: 'V' },
  
  { pattern: 'current', unit: 'A' },
  { pattern: 'ampere', unit: 'A' },
  
  { pattern: 'speed', unit: 'kn' },
  { pattern: 'speedover', unit: 'kn' },
  
  { pattern: 'direction', unit: '°' },
  { pattern: 'heading', unit: '°' },
  { pattern: 'course', unit: '°' },
  { pattern: 'bearing', unit: '°' },
  
  { pattern: 'wind', unit: 'kn' },
  { pattern: 'breeze', unit: 'kn' },
  
  { pattern: 'rpm', unit: 'rpm' },
  { pattern: 'revolution', unit: 'rpm' },
  { pattern: 'revolutions', unit: 'rpm' },
  { pattern: 'rotation', unit: 'rpm' },
  
  // ===== SENSOR PATTERNS =====
  { pattern: 'light', unit: 'lux' },
  { pattern: 'humidity', unit: '%' },
];

/**
 * Common unit equivalences - map alternate unit names to canonical form
 */
const UNIT_EQUIVALENCES = {
  // Pressure
  'Pa': 'Pa',
  'Pascal': 'Pa',
  'Pascals': 'Pa',
  'hectopascals': 'hPa',
  'hPa': 'hPa',
  'Bar': 'Bar',
  'bar': 'Bar',
  'BAR': 'Bar',
  'bars': 'Bar',
  'mmHg': 'mmHg',
  'mm Hg': 'mmHg',
  'millimeters of mercury': 'mmHg',
  'psi': 'psi',
  'PSI': 'psi',
  'pounds per square inch': 'psi',
  
  // Temperature
  'K': 'K',
  'Kelvin': 'K',
  'kelvin': 'K',
  '°C': '°C',
  'C': '°C',
  'Celsius': '°C',
  'celsius': '°C',
  'centigrade': '°C',
  '°F': '°F',
  'F': '°F',
  'Fahrenheit': '°F',
  'fahrenheit': '°F',
  
  // Speed
  'm/s': 'm/s',
  'mps': 'm/s',
  'meters per second': 'm/s',
  'kn': 'kn',
  'knots': 'kn',
  'Knots': 'kn',
  'KNOTS': 'kn',
  'kt': 'kn',
  'km/h': 'km/h',
  'kph': 'km/h',
  'kilometers per hour': 'km/h',
  'mph': 'mph',
  'miles per hour': 'mph',
  
  // Angle
  'rad': 'rad',
  'radians': 'rad',
  'Radians': 'rad',
  '°': '°',
  'deg': '°',
  'degrees': '°',
  'Degrees': '°',
  'DEGREES': '°',
  
  // Health vitals - beats per minute (LOINC format uses {beats}/min)
  'bpm': 'bpm',
  'BPM': 'bpm',
  'beats per minute': 'bpm',
  'beat/min': 'bpm',
  'beat per minute': 'bpm',
  '/min': 'bpm',
  'beats/min': 'bpm',
  '{beats}/min': 'bpm',              // LOINC standard format
  'beats': 'bpm',
  
  // Health vitals - breaths per minute (LOINC format uses {breaths}/min)
  '{breaths}/min': 'bpm',            // LOINC standard format for respiratory rate
  'breaths/min': 'bpm',
  'breaths per minute': 'bpm',
  'breath/min': 'bpm',
  'breath per minute': 'bpm',
  
  '%': '%',
  'percent': '%',
  'Percent': '%',
  '%RH': '%',
  'percent RH': '%',
  
  'mg/dL': 'mg/dL',
  'milligrams per deciliter': 'mg/dL',
  'mg/dl': 'mg/dL',
  
  'mmol/L': 'mmol/L',
  'mmol/l': 'mmol/L',
  'millimoles per liter': 'mmol/L',
  
  'ms': 'ms',
  'milliseconds': 'ms',
  'millisecond': 'ms',
  
  // Electrical
  'V': 'V',
  'Volts': 'V',
  'volts': 'V',
  'Volt': 'V',
  'volt': 'V',
  'VDC': 'V',
  'VAC': 'V',
  
  'A': 'A',
  'Amps': 'A',
  'amps': 'A',
  'Amperes': 'A',
  'amperes': 'A',
  'Ampere': 'A',
  'ampere': 'A',
  'ADC': 'A',
  'AAC': 'A',
  
  'W': 'W',
  'Watts': 'W',
  'watts': 'W',
  'watt': 'W',
  
  'Wh': 'Wh',
  'Watt-hours': 'Wh',
  'watt-hours': 'Wh',
  
  // Rotation
  'rpm': 'rpm',
  'RPM': 'rpm',
  'revolutions per minute': 'rpm',
  'rev/min': 'rpm',
  'r/min': 'rpm',
  
  // Distance & Volume
  'm': 'm',
  'meter': 'm',
  'meters': 'm',
  'km': 'km',
  'kilometer': 'km',
  'kilometers': 'km',
  'nm': 'nm',
  'nautical mile': 'nm',
  'nautical miles': 'nm',
  'ft': 'ft',
  'feet': 'ft',
  'mi': 'mi',
  'miles': 'mi',
  'mm': 'mm',
  'millimeter': 'mm',
  'millimeters': 'mm',
  'cm': 'cm',
  'centimeter': 'cm',
  'centimeters': 'cm',
  'L': 'L',
  'liter': 'L',
  'liters': 'L',
  'litre': 'L',
  'litres': 'L',
  'gal': 'gal',
  'gallons': 'gal',
  'gallon': 'gal',
  
  // Weight/Mass
  'kg': 'kg',
  'kilograms': 'kg',
  'kilogram': 'kg',
  'g': 'g',
  'grams': 'g',
  'gram': 'g',
  'lb': 'lb',
  'lbs': 'lb',
  'pounds': 'lb',
  'pound': 'lb',
  
  // Other common units
  'text': 'text',
  'string': 'text',
  'bool': 'bool',
  'boolean': 'bool',
  'lux': 'lux',
  'lx': 'lux',
  'pH': 'pH',
  'degrees salinity': '‰',
  '‰': '‰',
  'ppt': '‰',
  '1': 'text',                   // DB sometimes uses '1' for text/classification types
};

/**
 * Normalize unit string to canonical form
 */
const normalizeUnit = (unit) => {
  if (!unit) return '';
  return UNIT_EQUIVALENCES[unit] || unit;
};

/**
 * Convert a value from source unit to target unit using universal rules
 * @param {number} value - The raw sensor value
 * @param {string} sourceUnit - The unit the value is currently in (e.g., 'Pa', 'K', 'm/s')
 * @param {string} targetUnit - The unit to convert to (e.g., 'Bar', '°C', 'kn')
 * @returns {number} - The converted value
 */
const convertBetweenUnits = (value, sourceUnit, targetUnit) => {
  if (value === null || value === undefined) {
    return value;
  }

  // Normalize units
  const source = normalizeUnit(sourceUnit);
  const target = normalizeUnit(targetUnit);

  // If same unit, no conversion needed
  if (source === target) {
    return value;
  }

  // Build conversion key
  const conversionKey = `${source}→${target}`;

  // Look for exact conversion rule
  if (UNIVERSAL_CONVERSIONS[conversionKey]) {
    const converted = UNIVERSAL_CONVERSIONS[conversionKey](value);
    return parseFloat(converted.toFixed(2));
  }

  // No conversion found, return value as-is
  console.warn(`No conversion rule found for ${conversionKey}`);
  return parseFloat(value.toFixed(2));
};


/**
 * Get the preferred display unit for an attribute
 * Checks exact match first, then pattern match
 * @param {string} attributeCode - The attribute identifier
 * @returns {string} - The preferred display unit (e.g., 'Bar', '°C', 'V')
 */
const getDisplayUnit = (attributeCode) => {
  if (!attributeCode) return '';
  
  // 1. Check for exact match
  if (DISPLAY_UNIT_PREFERENCES[attributeCode]) {
    return DISPLAY_UNIT_PREFERENCES[attributeCode];
  }
  
  // 2. Check pattern matches (case-insensitive)
  const lowerCode = attributeCode.toLowerCase();
  for (const { pattern, unit } of DISPLAY_UNIT_PATTERNS) {
    if (lowerCode.includes(pattern)) {
      return unit;
    }
  }
  
  // 3. No match found
  return '';
};

/**
 * Converts a numeric value from source unit to appropriate display unit
 * Uses universal conversion rules based on unit pairs
 * Falls back to SOURCE_UNIT_ASSUMPTIONS when sourceUnit not provided
 * Health vital attributes are displayed as integers; others as decimals
 * @param {number} value - The raw sensor value
 * @param {string} attributeCode - The attribute identifier (e.g., 'propulsion.main.oilPressure')
 * @param {string} sourceUnit - The unit the value is in from the API (optional)
 * @returns {number} - The converted value
 */
export const convertValue = (value, attributeCode, sourceUnit) => {
  if (value === null || value === undefined) {
    return value;
  }

  // Get target display unit for this attribute
  const targetUnit = getDisplayUnit(attributeCode);

  // If no target unit defined, return value as-is
  if (!targetUnit) {
    // Check if should be integer display
    if (INTEGER_DISPLAY_ATTRIBUTES.has(attributeCode)) {
      return Math.round(value);
    }
    return parseFloat(value.toFixed(2));
  }

  // Special handling for tank level attributes - multiply by 100 to convert decimal to percentage
  if (attributeCode && attributeCode.includes('tanks') && attributeCode.includes('level') && targetUnit === '%') {
    let converted = value * 100;
    return Math.round(converted);
  }

  // Use sourceUnit from API, or fall back to assumed source unit for attribute
  let actualSourceUnit = sourceUnit;
  if (!actualSourceUnit || actualSourceUnit.trim() === '') {
    actualSourceUnit = SOURCE_UNIT_ASSUMPTIONS[attributeCode] || '';
  }

  // Apply universal conversion from source to target unit
  const converted = convertBetweenUnits(value, actualSourceUnit, targetUnit);

  // Health vital attributes display as integers; maritime/other as decimals
  if (INTEGER_DISPLAY_ATTRIBUTES.has(attributeCode)) {
    return Math.round(converted);
  }
  return parseFloat(converted.toFixed(2));
};

/**
 * Gets the display unit for an attribute
 * @param {string} attributeCode - The attribute identifier
 * @returns {string} - The unit symbol (e.g., 'Bar', '°C', 'V')
 */
export const getUnit = (attributeCode) => {
  return getDisplayUnit(attributeCode);
};

/**
 * Formats a value for display with appropriate unit
 * @param {number} value - The raw sensor value
 * @param {string} attributeCode - The attribute identifier
 * @param {string} sourceUnit - The unit the value is in from the API
 * @returns {string} - Formatted string like "3.1 Bar" or "12.45 V"
 */
export const formatValueWithUnit = (value, attributeCode, sourceUnit) => {
  const converted = convertValue(value, attributeCode, sourceUnit);
  const unit = getUnit(attributeCode);
  return unit ? `${converted} ${unit}` : `${converted}`;
};

/**
 * Batch convert multiple telemetry entries
 * @param {Array} entries - Array of telemetry entries with numericValue, attributeCode, and attributeUnit
 * @returns {Array} - Array with converted values
 */
export const convertTelemetryData = (entries) => {
  if (!Array.isArray(entries)) {
    return entries;
  }

  return entries.map((entry) => ({
    ...entry,
    numericValue: convertValue(entry.numericValue, entry.attributeCode, entry.attributeUnit),
  }));
};

// ===== COLOR MANAGEMENT FOR UNIQUE ATTRIBUTE VISUALIZATION =====
/**
 * Comprehensive color palette for attributes
 * Provides 50+ distinct colors to uniquely color-code telemetry metrics
 * Sorted by visual clarity and clinical appropriateness
 */
const ATTRIBUTE_COLOR_PALETTE = [
  // Primary vivid colors (high contrast)
  '#ff7300',  // Orange
  '#38a3b8',  // Teal
  '#41b922',  // Green
  '#bb4c99',  // Purple
  '#ff4d4d',  // Red
  '#8884d8',  // Blue
  
  // Secondary colors (distinct from primary)
  '#ffa500',  // Bright Orange
  '#00bfa5',  // Turquoise
  '#66bb6a',  // Light Green
  '#ab47bc',  // Violet
  '#ff6e40',  // Deep Orange
  '#5c6bc0',  // Indigo
  
  // Tertiary colors (warm/cool balance)
  '#ffb74d',  // Amber
  '#26c6da',  // Cyan
  '#81c784',  // Emerald
  '#ce93d8',  // Light Purple
  '#ff7043',  // Red Orange
  '#42a5f5',  // Light Blue
  
  // Additional accent colors
  '#ffa726',  // Light Orange
  '#4dd0e1',  // Light Cyan
  '#aed581',  // Lime Green
  '#ba68c8',  // Medium Purple
  '#ef5350',  // Light Red
  '#29b6f6',  // Sky Blue
  
  // Extended palette for 20+ attributes
  '#ffb300',  // Gold
  '#009688',  // Teal Dark
  '#7cb342',  // Olive Green
  '#9c27b0',  // Deep Purple
  '#ff5252',  // Red Accent
  '#00a8e8',  // Deep Sky
  
  // More distinct colors
  '#ff9800',  // Deep Orange
  '#00897b',  // Dark Teal
  '#558b2f',  // Dark Olive
  '#6a1b9a',  // Dark Purple
  '#d32f2f',  // Dark Red
  '#0277bd',  // Dark Blue
  
  // Final set for extended coverage
  '#ffb81c',  // School Bus Yellow
  '#0095a0',  // Blue-Teal
  '#558b2f',  // Olive
  '#512da8',  // Deep Purple
  '#c62828',  // Crimson
  '#01579b',  // Navy Blue
  
  '#ffc400',  // Amber Dark
  '#008a80',  // Teal Dark
  '#9ccc65',  // Light Lime
  '#7e57c2',  // Medium Purple
  '#ff5983',  // Pink Red
  '#1e88e5',  // Medium Blue
];

/**
 * Generate a consistent hash for an attribute code
 * Returns a number that will always be the same for the same input
 * @param {string} code - The attribute code
 * @returns {number} - Consistent hash
 */
const generateConsistentHash = (code) => {
  let hash = 0;
  if (!code || code.length === 0) return 0;
  
  for (let i = 0; i < code.length; i++) {
    const char = code.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash);
};

/**
 * Get a unique, deterministic color for an attribute code
 * Same code always returns same color, different codes get different colors
 * @param {string} attributeCode - The attribute identifier
 * @returns {string} - Hex color code
 */
export const getAttributeColor = (attributeCode) => {
  if (!attributeCode) {
    return ATTRIBUTE_COLOR_PALETTE[0];
  }
  
  const hash = generateConsistentHash(attributeCode);
  const index = hash % ATTRIBUTE_COLOR_PALETTE.length;
  return ATTRIBUTE_COLOR_PALETTE[index];
};

/**
 * Get multiple colors for an array of attribute codes
 * Useful for batch operations
 * @param {Array<string>} codes - Array of attribute codes
 * @returns {Object} - Map of code → color
 */
export const getAttributeColors = (codes) => {
  const colorMap = {};
  codes.forEach((code) => {
    colorMap[code] = getAttributeColor(code);
  });
  return colorMap;
};
