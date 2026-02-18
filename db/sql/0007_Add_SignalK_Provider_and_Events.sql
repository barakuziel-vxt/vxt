-- Migration: Add N2KToSignalK Provider and SignalK Standard Events
-- Purpose: Support GenericTelemetryConsumer with SignalK marine data protocol
-- Date: 2026-02-18
-- Reference: https://signalk.org/specification/

-- ============================================================================
-- 1. Insert N2KToSignalK Provider
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Provider WHERE providerName = 'N2KToSignalK')
BEGIN
    INSERT INTO dbo.Provider (
        providerName,
        providerDescription,
        providerCategory,
        apiBaseUrl,
        apiVersion,
        documentationUrl,
        TopicName,
        BatchSize
    ) VALUES (
        'N2KToSignalK',
        'Signal K is an open-source data format for storing and sharing marine data. Converts NMEA 0183 and NMEA 2000 to standardized JSON format.',
        'MaritimeData',
        'https://signalk.org',
        'v1.0',
        'https://signalk.org/specification/latest/index.html',
        'signalk-events',
        100
    );
    PRINT 'N2KToSignalK provider inserted successfully';
END
ELSE
BEGIN
    PRINT 'N2KToSignalK provider already exists';
END;

GO

-- ============================================================================
-- 2. Get the providerId for N2KToSignalK
-- ============================================================================
DECLARE @providerId INT;
SELECT @providerId = providerId FROM dbo.Provider WHERE providerName = 'N2KToSignalK';

IF @providerId IS NOT NULL
BEGIN
    PRINT 'Adding SignalK events for providerId: ' + CAST(@providerId AS VARCHAR(10));

    -- ============================================================================
    -- Navigation Events (SK Namespace: navigation)
    -- ============================================================================
    
    -- Position
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'navigation.position')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'navigation.position', 'Current vessel position (latitude/longitude)',
            'navigation', 'position', '1.0', '{"type":"object","properties":{"latitude":{"type":"number"},"longitude":{"type":"number"}}}',
            '["latitude","longitude"]', 'Y'
        );
    END;

    -- Heading (Magnetic)
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'navigation.headingMagnetic')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'navigation.headingMagnetic', 'Heading relative to magnetic north (radians)',
            'navigation', 'headingMagnetic', '1.0', '{"type":"object","properties":{"value":{"type":"number","minimum":0,"maximum":6.283185307179586}}}',
            '["value"]', 'Y'
        );
    END;

    -- Heading (True)
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'navigation.headingTrue')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'navigation.headingTrue', 'Heading relative to true north (radians)',
            'navigation', 'headingTrue', '1.0', '{"type":"object","properties":{"value":{"type":"number","minimum":0,"maximum":6.283185307179586}}}',
            '["value"]', 'Y'
        );
    END;

    -- Course Over Ground
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'navigation.courseOverGround')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'navigation.courseOverGround', 'Course over ground (actual direction traveled relative to true north)',
            'navigation', 'courseOverGround', '1.0', '{"type":"object","properties":{"value":{"type":"number","minimum":0,"maximum":6.283185307179586}}}',
            '["value"]', 'Y'
        );
    END;

    -- Speed Over Ground
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'navigation.speedOverGround')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'navigation.speedOverGround', 'Speed over ground (m/s)',
            'navigation', 'speedOverGround', '1.0', '{"type":"object","properties":{"value":{"type":"number","minimum":0}}}',
            '["value"]', 'Y'
        );
    END;

    -- Speed Through Water
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'navigation.speedThroughWater')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'navigation.speedThroughWater', 'Speed relative to water medium (m/s)',
            'navigation', 'speedThroughWater', '1.0', '{"type":"object","properties":{"value":{"type":"number","minimum":0}}}',
            '["value"]', 'Y'
        );
    END;

    -- ============================================================================
    -- Environmental Events (SK Namespace: environment)
    -- ============================================================================

    -- Wind Speed (apparent)
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'environment.wind.speedApparent')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'environment.wind.speedApparent', 'Wind speed relative to vessel (m/s)',
            'environment', 'windSpeedApparent', '1.0', '{"type":"object","properties":{"value":{"type":"number","minimum":0}}}',
            '["value"]', 'Y'
        );
    END;

    -- Wind Direction (apparent)
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'environment.wind.directionApparent')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'environment.wind.directionApparent', 'Wind direction relative to vessel (radians)',
            'environment', 'windDirectionApparent', '1.0', '{"type":"object","properties":{"value":{"type":"number","minimum":0,"maximum":6.283185307179586}}}',
            '["value"]', 'Y'
        );
    END;

    -- Water Temperature
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'environment.water.temperature')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'environment.water.temperature', 'Sea water temperature (Kelvin)',
            'environment', 'waterTemperature', '1.0', '{"type":"object","properties":{"value":{"type":"number"}}}',
            '["value"]', 'Y'
        );
    END;

    -- Air Temperature
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'environment.outside.temperature')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'environment.outside.temperature', 'Air temperature (Kelvin)',
            'environment', 'airTemperature', '1.0', '{"type":"object","properties":{"value":{"type":"number"}}}',
            '["value"]', 'Y'
        );
    END;

    -- Barometric Pressure
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'environment.outside.pressure')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'environment.outside.pressure', 'Atmospheric pressure (Pa)',
            'environment', 'pressure', '1.0', '{"type":"object","properties":{"value":{"type":"number"}}}',
            '["value"]', 'Y'
        );
    END;

    -- ============================================================================
    -- Engine Events (SK Namespace: propulsion)
    -- ============================================================================

    -- Engine RPM
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'propulsion.main.revolutions')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'propulsion.main.revolutions', 'Engine revolutions (revolutions per second)',
            'propulsion', 'engineRPM', '1.0', '{"type":"object","properties":{"value":{"type":"number","minimum":0}}}',
            '["value"]', 'Y'
        );
    END;

    -- Engine Temperature
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'propulsion.main.temperature')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'propulsion.main.temperature', 'Engine temperature (Kelvin)',
            'propulsion', 'engineTemperature', '1.0', '{"type":"object","properties":{"value":{"type":"number"}}}',
            '["value"]', 'Y'
        );
    END;

    -- Engine Oil Pressure
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'propulsion.main.oilPressure')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'propulsion.main.oilPressure', 'Engine oil pressure (Pa)',
            'propulsion', 'engineOilPressure', '1.0', '{"type":"object","properties":{"value":{"type":"number"}}}',
            '["value"]', 'Y'
        );
    END;

    -- ============================================================================
    -- Electrical Events (SK Namespace: electrical)
    -- ============================================================================

    -- House Bank Voltage
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'electrical.dc.houseBattery.voltage')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'electrical.dc.houseBattery.voltage', 'House bank voltage (Volts)',
            'electrical', 'houseBatteryVoltage', '1.0', '{"type":"object","properties":{"value":{"type":"number"}}}',
            '["value"]', 'Y'
        );
    END;

    -- House Bank Current
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'electrical.dc.houseBattery.current')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'electrical.dc.houseBattery.current', 'House bank current (Amps)',
            'electrical', 'houseBatteryCurrent', '1.0', '{"type":"object","properties":{"value":{"type":"number"}}}',
            '["value"]', 'Y'
        );
    END;

    -- ============================================================================
    -- Tank Events (SK Namespace: tanks)
    -- ============================================================================

    -- Fuel Tank Level
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'tanks.fuelTank.level')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'tanks.fuelTank.level', 'Fuel tank level (0 to 1 ratio)',
            'tanks', 'fuelTankLevel', '1.0', '{"type":"object","properties":{"value":{"type":"number","minimum":0,"maximum":1}}}',
            '["value"]', 'Y'
        );
    END;

    -- Fresh Water Tank Level
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'tanks.freshWaterTank.level')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'tanks.freshWaterTank.level', 'Fresh water tank level (0 to 1 ratio)',
            'tanks', 'freshWaterTankLevel', '1.0', '{"type":"object","properties":{"value":{"type":"number","minimum":0,"maximum":1}}}',
            '["value"]', 'Y'
        );
    END;

    -- Waste Water Tank Level
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'tanks.wasteWaterTank.level')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'tanks.wasteWaterTank.level', 'Waste water tank level (0 to 1 ratio)',
            'tanks', 'wasteWaterTankLevel', '1.0', '{"type":"object","properties":{"value":{"type":"number","minimum":0,"maximum":1}}}',
            '["value"]', 'Y'
        );
    END;

    -- ============================================================================
    -- Seawater Intake Events (SK Namespace: environment.water.seawater)
    -- ============================================================================

    -- Seawater Pressure
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'environment.water.seawater.pressure')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'environment.water.seawater.pressure', 'Seawater intake pressure (Pa)',
            'environment', 'seawaterPressure', '1.0', '{"type":"object","properties":{"value":{"type":"number"}}}',
            '["value"]', 'Y'
        );
    END;

    -- Seawater Temperature
    IF NOT EXISTS (SELECT 1 FROM dbo.ProviderEvent WHERE providerId = @providerId AND providerEventType = 'environment.water.seawater.temperature')
    BEGIN
        INSERT INTO dbo.ProviderEvent (
            providerId, providerEventType, providerEventDescription, providerNamespace, providerEventName,
            providerVersion, payloadSchema, requiredFields, active
        ) VALUES (
            @providerId, 'environment.water.seawater.temperature', 'Seawater intake temperature (Kelvin)',
            'environment', 'seawaterTemperature', '1.0', '{"type":"object","properties":{"value":{"type":"number"}}}',
            '["value"]', 'Y'
        );
    END;

    PRINT 'SignalK ProviderEvent records inserted successfully';
END
ELSE
BEGIN
    PRINT 'ERROR: Could not find providerId for N2KToSignalK provider';
END;

GO

-- ============================================================================
-- Summary
-- ============================================================================
PRINT '';
PRINT '=== SignalK Provider Setup Complete ===';
PRINT 'Provider: N2KToSignalK';
PRINT 'Kafka Topic: signalk-events';
PRINT 'Batch Size: 100';
PRINT 'Standard Events Added: 20+ major maritime data points';
PRINT '=====================================';

SELECT 
    p.providerName,
    COUNT(pe.providerEventId) AS EventCount,
    p.TopicName,
    p.BatchSize
FROM dbo.Provider p
LEFT JOIN dbo.ProviderEvent pe ON p.providerId = pe.providerId
WHERE p.providerName = 'N2KToSignalK'
GROUP BY p.providerId, p.providerName, p.TopicName, p.BatchSize;

GO
