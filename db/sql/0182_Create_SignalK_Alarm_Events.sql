-- Migration: 0182 - SignalK Real-time Alarm Events
-- Date: 2026-04-18
-- Purpose: Event definitions for real-time SignalK alarm threshold violations
--          forwarded by the orchestrator via IoT Hub ALERT messages.
--
-- These events are triggered when the orchestrator's WebSocket listener
-- receives a notification with state = 'alarm' or 'emergency' from SignalK
-- and forwards it as {"type":"ALERT"} to Azure IoT Hub → Azure Function.
--
-- Note: eventCode has a UNIQUE constraint, so each yacht type gets its own code.

SET IDENTITY_INSERT dbo.[Event] ON;

-- Event for entityTypeId=4 (Elan Impression 40) — already inserted as eventId=11
IF NOT EXISTS (SELECT 1 FROM dbo.[Event] WHERE eventCode = 'SIGNALK_ALARM' AND entityTypeId = 4)
BEGIN
    INSERT INTO dbo.[Event] (
        eventId, eventCode, eventDescription, entityTypeId,
        minCumulatedScore, maxCumulatedScore, risk,
        AnalyzeFunctionId, active
    )
    VALUES (
        11, 'SIGNALK_ALARM', 'SignalK real-time alarm threshold violation', 4,
        0, 100, 'HIGH',
        NULL, 'Y'
    );
    PRINT 'Inserted Event SIGNALK_ALARM for entityTypeId=4 (Elan Impression 40)';
END

-- Event for entityTypeId=5 (Lagoon 380)
IF NOT EXISTS (SELECT 1 FROM dbo.[Event] WHERE eventCode = 'SIGNALK_ALARM_L380' AND entityTypeId = 5)
BEGIN
    INSERT INTO dbo.[Event] (
        eventId, eventCode, eventDescription, entityTypeId,
        minCumulatedScore, maxCumulatedScore, risk,
        AnalyzeFunctionId, active
    )
    VALUES (
        12, 'SIGNALK_ALARM_L380', 'SignalK real-time alarm threshold violation', 5,
        0, 100, 'HIGH',
        NULL, 'Y'
    );
    PRINT 'Inserted Event SIGNALK_ALARM_L380 for entityTypeId=5 (Lagoon 380)';
END

-- Event for entityTypeId=7 (Bavaria Cruiser 46)
IF NOT EXISTS (SELECT 1 FROM dbo.[Event] WHERE eventCode = 'SIGNALK_ALARM_BC46' AND entityTypeId = 7)
BEGIN
    INSERT INTO dbo.[Event] (
        eventId, eventCode, eventDescription, entityTypeId,
        minCumulatedScore, maxCumulatedScore, risk,
        AnalyzeFunctionId, active
    )
    VALUES (
        13, 'SIGNALK_ALARM_BC46', 'SignalK real-time alarm threshold violation', 7,
        0, 100, 'HIGH',
        NULL, 'Y'
    );
    PRINT 'Inserted Event SIGNALK_ALARM_BC46 for entityTypeId=7 (Bavaria Cruiser 46)';
END

SET IDENTITY_INSERT dbo.[Event] OFF;
