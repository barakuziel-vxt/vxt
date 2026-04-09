/**
 * SignalK plugin to parse NMEA0183 XDR (Transducer Measurement) sentences
 * and map them to SignalK paths for engine/tank/electrical monitoring.
 *
 * XDR format: $--XDR,type,value,unit,name[,type,value,unit,name,...]*hh
 *   type: C=temp, P=pressure, U=voltage, R=ratio/generic, T=tachometer, etc.
 *   value: numeric measurement
 *   unit: varies (C, B, V, %, etc.)
 *   name: transducer name (our custom names)
 */

module.exports = function (app) {
  const plugin = {}
  plugin.id = 'signalk-xdr-parser'
  plugin.name = 'XDR Transducer Parser'
  plugin.description = 'Parses NMEA0183 XDR sentences and maps transducer names to SignalK paths'

  // Mapping: transducer name -> { path, convert(value) }
  // SignalK uses SI units: Kelvin for temp, Pa for pressure, Hz for RPM, m3/s for flow, etc.
  const TRANSDUCER_MAP = {
    'EngineRPM': {
      path: 'propulsion.main.revolutions',
      convert: (v) => v / 60  // RPM -> Hz (revolutions per second)
    },
    'EngineHours': {
      path: 'propulsion.main.runTime',
      convert: (v) => v * 3600  // hours -> seconds
    },
    'OilPressure': {
      path: 'propulsion.main.oilPressure',
      convert: (v) => v * 6894.757  // PSI -> Pa
    },
    'OilTemperature': {
      path: 'propulsion.main.oilTemperature',
      convert: (v) => v + 273.15  // Celsius -> Kelvin
    },
    'WaterTemperature': {
      path: 'propulsion.main.coolantTemperature',
      convert: (v) => v + 273.15  // Celsius -> Kelvin
    },
    'FuelRate': {
      path: 'propulsion.main.fuel.rate',
      convert: (v) => v / 3600000  // L/h -> m3/s (1L = 0.001m3, /3600 for seconds)
    },
    'FuelPressure': {
      path: 'propulsion.main.fuel.pressure',
      convert: (v) => v * 1000  // kPa -> Pa
    },
    'AlternatorOutput': {
      path: 'electrical.alternators.main.voltage',
      convert: (v) => v  // already Volts
    },
    'GearboxOilTemp': {
      path: 'propulsion.main.transmission.oilTemperature',
      convert: (v) => v + 273.15  // Celsius -> Kelvin
    },
    'EngineLoad': {
      path: 'propulsion.main.load',
      convert: (v) => v  // ratio 0-1, already correct
    },
    'ExhaustTemp': {
      path: 'propulsion.main.exhaustTemperature',
      convert: (v) => v + 273.15  // Celsius -> Kelvin
    },
    'FuelLevel': {
      path: 'tanks.fuel.0.currentLevel',
      convert: (v) => v / 100  // percentage -> ratio (0-1)
    },
    'WaterLevel': {
      path: 'tanks.freshWater.0.currentLevel',
      convert: (v) => v / 100  // percentage -> ratio (0-1)
    },
    'BatteryMain': {
      path: 'electrical.batteries.main.voltage',
      convert: (v) => v  // already Volts
    }
  }

  plugin.start = function (options) {
    app.debug('Starting XDR parser plugin')

    app.emitPropertyValue('nmea0183sentenceParser', {
      sentence: 'XDR',
      parser: ({ id, sentence, parts, tags }, session) => {
        const values = []

        // XDR has groups of 4 fields: type, value, unit, name
        for (let i = 0; i + 3 < parts.length; i += 4) {
          const xdrType = parts[i]
          const xdrValue = parseFloat(parts[i + 1])
          const xdrUnit = parts[i + 2]
          const xdrName = parts[i + 3]

          if (isNaN(xdrValue) || !xdrName) {
            continue
          }

          const mapping = TRANSDUCER_MAP[xdrName]
          if (mapping) {
            values.push({
              path: mapping.path,
              value: mapping.convert(xdrValue)
            })
          } else {
            app.debug(`Unknown XDR transducer: ${xdrName} (type=${xdrType}, value=${xdrValue}, unit=${xdrUnit})`)
          }
        }

        if (values.length === 0) {
          return null
        }

        return {
          updates: [
            {
              values: values
            }
          ]
        }
      }
    })

    app.debug('XDR parser registered with mappings for: ' + Object.keys(TRANSDUCER_MAP).join(', '))
  }

  plugin.stop = function () {
    app.debug('XDR parser plugin stopped')
  }

  plugin.schema = {
    type: 'object',
    properties: {}
  }

  return plugin
}
