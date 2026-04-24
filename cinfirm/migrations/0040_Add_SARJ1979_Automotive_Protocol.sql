-- =============================================================================
-- Migration 0040: SAE J1979 (ELM327 OBD-II) Automotive Protocol Support
-- =============================================================================
-- Adds:
--   1. EntityType          : Car (under Vehicle category)
--   2. Protocol            : SARJ1979
--   3. ProtocolAttribute   : 131 standard OBD-II Mode 01 PIDs
--   4. Entity              : HundayTuson 2016 (VIN: KM8J33A41GU000001)
--   5. EntityTypeAttribute : Maps Car to all SARJ1979 PIDs
--
-- Idempotent — safe to run multiple times.
-- Prerequisites: migrations 0001-0025 must already be applied.
-- =============================================================================

IF OBJECT_ID('dbo.Protocol', 'U') IS NULL
BEGIN
    RAISERROR('Migration 0040 prerequisites not met. Run migrations 0001-0025 first.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

-- ---------------------------------------------------------------------------
-- 1. EntityType: Car  (inserted first — Protocol FK references entityTypeId)
-- ---------------------------------------------------------------------------
DECLARE @VehicleEntityCategoryId INT;
SELECT @VehicleEntityCategoryId = entityCategoryId
FROM dbo.EntityCategory
WHERE entityCategoryName = 'Vehicle';

IF @VehicleEntityCategoryId IS NULL
BEGIN
    INSERT INTO dbo.EntityCategory (entityCategoryName, active)
    VALUES ('Vehicle', 'Y');
    SET @VehicleEntityCategoryId = SCOPE_IDENTITY();
    PRINT 'Inserted EntityCategory: Vehicle';
END
ELSE
    PRINT 'EntityCategory Vehicle already exists';

IF NOT EXISTS (SELECT 1 FROM dbo.EntityType WHERE entityTypeName = 'Car')
BEGIN
    INSERT INTO dbo.EntityType (entityTypeName, entityCategoryId, active)
    VALUES ('Car', @VehicleEntityCategoryId, 'Y');
    PRINT 'Inserted EntityType: Car';
END
ELSE
    PRINT 'EntityType Car already exists';

DECLARE @CarEntityTypeId INT;
SELECT @CarEntityTypeId = entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car';

-- ---------------------------------------------------------------------------
-- 2. Protocol: SARJ1979
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.Protocol WHERE protocolName = 'SARJ1979')
BEGIN
    INSERT INTO dbo.Protocol
        (protocolName, protocolVersion, description, kafkaTopic, entityTypeId, active)
    VALUES
        ('SARJ1979', '1.0',
         'SAE J1979 OBD-II automotive diagnostic protocol via ELM327 Bluetooth adapter',
         'iot-telemetry', @CarEntityTypeId, 'Y');
    PRINT 'Inserted Protocol: SARJ1979';
END
ELSE
    PRINT 'Protocol SARJ1979 already exists';

DECLARE @ProtocolId INT;
SELECT @ProtocolId = protocolId FROM dbo.Protocol WHERE protocolName = 'SARJ1979';

IF @ProtocolId IS NULL
BEGIN
    PRINT 'ERROR: Could not retrieve SARJ1979 protocolId';
    ROLLBACK;
    RETURN;
END

-- ---------------------------------------------------------------------------
-- 3. ProtocolAttribute — 131 SAE J1979 Mode 01 PIDs
-- ---------------------------------------------------------------------------
DECLARE @existingCount INT;
SELECT @existingCount = COUNT(*) FROM dbo.ProtocolAttribute WHERE protocolId = @ProtocolId;

IF @existingCount = 0
BEGIN
    INSERT INTO dbo.ProtocolAttribute
        (protocolId, protocolAttributeCode, protocolAttributeName, description, dataType, jsonPath, active)
    VALUES
    (@ProtocolId,'0100','PIDs Supported 01-20','Bit-encoded list of supported PIDs 01-20','numeric','$.measurements.0100','Y'),
    (@ProtocolId,'0101','Monitor Status Since DTCs Cleared','Bit-encoded MIL status and DTC count','numeric','$.measurements.0101','Y'),
    (@ProtocolId,'0102','Freeze DTC','DTC that caused freeze frame','string','$.measurements.0102','Y'),
    (@ProtocolId,'0103','Fuel System Status','Closed/open loop fuel status','string','$.measurements.0103','Y'),
    (@ProtocolId,'0104','Calculated Engine Load','Engine load as percentage of max torque','numeric','$.measurements.0104','Y'),
    (@ProtocolId,'0105','Engine Coolant Temperature','Engine coolant temperature Celsius','numeric','$.measurements.0105','Y'),
    (@ProtocolId,'0106','Short Term Fuel Trim Bank 1','Short term fuel trim bank 1 percent','numeric','$.measurements.0106','Y'),
    (@ProtocolId,'0107','Long Term Fuel Trim Bank 1','Long term fuel trim bank 1 percent','numeric','$.measurements.0107','Y'),
    (@ProtocolId,'0108','Short Term Fuel Trim Bank 2','Short term fuel trim bank 2 percent','numeric','$.measurements.0108','Y'),
    (@ProtocolId,'0109','Long Term Fuel Trim Bank 2','Long term fuel trim bank 2 percent','numeric','$.measurements.0109','Y'),
    (@ProtocolId,'010A','Fuel Pressure','Fuel gauge pressure relative to vacuum kPa','numeric','$.measurements.010A','Y'),
    (@ProtocolId,'010B','Intake Manifold Absolute Pressure','Intake manifold absolute pressure kPa','numeric','$.measurements.010B','Y'),
    (@ProtocolId,'010C','Engine RPM','Engine speed in revolutions per minute','numeric','$.measurements.010C','Y'),
    (@ProtocolId,'010D','Vehicle Speed','Vehicle speed km/h','numeric','$.measurements.010D','Y'),
    (@ProtocolId,'010E','Timing Advance','Ignition timing advance degrees before TDC','numeric','$.measurements.010E','Y'),
    (@ProtocolId,'010F','Intake Air Temperature','Intake air temperature Celsius','numeric','$.measurements.010F','Y'),
    (@ProtocolId,'0110','Mass Air Flow Rate','Mass air flow sensor rate g/s','numeric','$.measurements.0110','Y'),
    (@ProtocolId,'0111','Throttle Position','Throttle position percentage','numeric','$.measurements.0111','Y'),
    (@ProtocolId,'0112','Secondary Air Status','Secondary air injection system status','string','$.measurements.0112','Y'),
    (@ProtocolId,'0113','O2 Sensors Present 2 Banks','Oxygen sensors present bitmask 2-bank','numeric','$.measurements.0113','Y'),
    (@ProtocolId,'0114','O2 Sensor 1 Voltage ST Trim','O2 sensor bank1 s1 voltage and short-term trim V','numeric','$.measurements.0114','Y'),
    (@ProtocolId,'0115','O2 Sensor 2 Voltage ST Trim','O2 sensor bank1 s2 voltage and short-term trim V','numeric','$.measurements.0115','Y'),
    (@ProtocolId,'0116','O2 Sensor 3 Voltage ST Trim','O2 sensor bank1 s3 voltage and short-term trim V','numeric','$.measurements.0116','Y'),
    (@ProtocolId,'0117','O2 Sensor 4 Voltage ST Trim','O2 sensor bank1 s4 voltage and short-term trim V','numeric','$.measurements.0117','Y'),
    (@ProtocolId,'0118','O2 Sensor 5 Voltage ST Trim','O2 sensor bank2 s1 voltage and short-term trim V','numeric','$.measurements.0118','Y'),
    (@ProtocolId,'0119','O2 Sensor 6 Voltage ST Trim','O2 sensor bank2 s2 voltage and short-term trim V','numeric','$.measurements.0119','Y'),
    (@ProtocolId,'011A','O2 Sensor 7 Voltage ST Trim','O2 sensor bank2 s3 voltage and short-term trim V','numeric','$.measurements.011A','Y'),
    (@ProtocolId,'011B','O2 Sensor 8 Voltage ST Trim','O2 sensor bank2 s4 voltage and short-term trim V','numeric','$.measurements.011B','Y'),
    (@ProtocolId,'011C','OBD Standards Compliance','OBD standards this vehicle conforms to','numeric','$.measurements.011C','Y'),
    (@ProtocolId,'011D','O2 Sensors Present 4 Banks','Oxygen sensors present bitmask 4-bank','numeric','$.measurements.011D','Y'),
    (@ProtocolId,'011E','Auxiliary Input Status','Power Take Off PTO status','numeric','$.measurements.011E','Y'),
    (@ProtocolId,'011F','Run Time Since Engine Start','Engine run time since start seconds','numeric','$.measurements.011F','Y'),
    (@ProtocolId,'0120','PIDs Supported 21-40','Bit-encoded list of supported PIDs 21-40','numeric','$.measurements.0120','Y'),
    (@ProtocolId,'0121','Distance Traveled with MIL On','Distance with MIL lamp on km','numeric','$.measurements.0121','Y'),
    (@ProtocolId,'0122','Fuel Rail Pressure Vacuum','Fuel rail pressure relative to manifold vacuum kPa','numeric','$.measurements.0122','Y'),
    (@ProtocolId,'0123','Fuel Rail Gauge Pressure','Fuel rail gauge pressure kPa','numeric','$.measurements.0123','Y'),
    (@ProtocolId,'0124','O2 Sensor 1 Lambda Voltage','Wide-range O2 sensor 1 lambda and voltage','numeric','$.measurements.0124','Y'),
    (@ProtocolId,'0125','O2 Sensor 2 Lambda Voltage','Wide-range O2 sensor 2 lambda and voltage','numeric','$.measurements.0125','Y'),
    (@ProtocolId,'0126','O2 Sensor 3 Lambda Voltage','Wide-range O2 sensor 3 lambda and voltage','numeric','$.measurements.0126','Y'),
    (@ProtocolId,'0127','O2 Sensor 4 Lambda Voltage','Wide-range O2 sensor 4 lambda and voltage','numeric','$.measurements.0127','Y'),
    (@ProtocolId,'0128','O2 Sensor 5 Lambda Voltage','Wide-range O2 sensor 5 lambda and voltage','numeric','$.measurements.0128','Y'),
    (@ProtocolId,'0129','O2 Sensor 6 Lambda Voltage','Wide-range O2 sensor 6 lambda and voltage','numeric','$.measurements.0129','Y'),
    (@ProtocolId,'012A','O2 Sensor 7 Lambda Voltage','Wide-range O2 sensor 7 lambda and voltage','numeric','$.measurements.012A','Y'),
    (@ProtocolId,'012B','O2 Sensor 8 Lambda Voltage','Wide-range O2 sensor 8 lambda and voltage','numeric','$.measurements.012B','Y'),
    (@ProtocolId,'012C','Commanded EGR','Commanded exhaust gas recirculation percent','numeric','$.measurements.012C','Y'),
    (@ProtocolId,'012D','EGR Error','EGR error percentage','numeric','$.measurements.012D','Y'),
    (@ProtocolId,'012E','Commanded Evaporative Purge','Commanded evaporative purge percent','numeric','$.measurements.012E','Y'),
    (@ProtocolId,'012F','Fuel Tank Level Input','Fuel tank level as percentage of full','numeric','$.measurements.012F','Y'),
    (@ProtocolId,'0130','Warmups Since Codes Cleared','Warmups since codes last cleared count','numeric','$.measurements.0130','Y'),
    (@ProtocolId,'0131','Distance Since Codes Cleared','Distance traveled since codes cleared km','numeric','$.measurements.0131','Y'),
    (@ProtocolId,'0132','Evap System Vapor Pressure','Evaporative system vapor pressure Pa','numeric','$.measurements.0132','Y'),
    (@ProtocolId,'0133','Absolute Barometric Pressure','Absolute barometric pressure kPa','numeric','$.measurements.0133','Y'),
    (@ProtocolId,'0134','O2 Sensor 1 Lambda Current','Wide-range O2 sensor 1 lambda and current','numeric','$.measurements.0134','Y'),
    (@ProtocolId,'0135','O2 Sensor 2 Lambda Current','Wide-range O2 sensor 2 lambda and current','numeric','$.measurements.0135','Y'),
    (@ProtocolId,'0136','O2 Sensor 3 Lambda Current','Wide-range O2 sensor 3 lambda and current','numeric','$.measurements.0136','Y'),
    (@ProtocolId,'0137','O2 Sensor 4 Lambda Current','Wide-range O2 sensor 4 lambda and current','numeric','$.measurements.0137','Y'),
    (@ProtocolId,'0138','O2 Sensor 5 Lambda Current','Wide-range O2 sensor 5 lambda and current','numeric','$.measurements.0138','Y'),
    (@ProtocolId,'0139','O2 Sensor 6 Lambda Current','Wide-range O2 sensor 6 lambda and current','numeric','$.measurements.0139','Y'),
    (@ProtocolId,'013A','O2 Sensor 7 Lambda Current','Wide-range O2 sensor 7 lambda and current','numeric','$.measurements.013A','Y'),
    (@ProtocolId,'013B','O2 Sensor 8 Lambda Current','Wide-range O2 sensor 8 lambda and current','numeric','$.measurements.013B','Y'),
    (@ProtocolId,'013C','Catalyst Temperature B1S1','Catalyst temperature bank 1 sensor 1 Celsius','numeric','$.measurements.013C','Y'),
    (@ProtocolId,'013D','Catalyst Temperature B2S1','Catalyst temperature bank 2 sensor 1 Celsius','numeric','$.measurements.013D','Y'),
    (@ProtocolId,'013E','Catalyst Temperature B1S2','Catalyst temperature bank 1 sensor 2 Celsius','numeric','$.measurements.013E','Y'),
    (@ProtocolId,'013F','Catalyst Temperature B2S2','Catalyst temperature bank 2 sensor 2 Celsius','numeric','$.measurements.013F','Y'),
    (@ProtocolId,'0140','PIDs Supported 41-60','Bit-encoded list of supported PIDs 41-60','numeric','$.measurements.0140','Y'),
    (@ProtocolId,'0141','Monitor Status This Drive Cycle','Monitor status this drive cycle','numeric','$.measurements.0141','Y'),
    (@ProtocolId,'0142','Control Module Voltage','Control module supply voltage V','numeric','$.measurements.0142','Y'),
    (@ProtocolId,'0143','Absolute Load Value','Absolute load value percent','numeric','$.measurements.0143','Y'),
    (@ProtocolId,'0144','Commanded AFR','Commanded air-fuel equivalence ratio lambda','numeric','$.measurements.0144','Y'),
    (@ProtocolId,'0145','Relative Throttle Position','Relative throttle position percent','numeric','$.measurements.0145','Y'),
    (@ProtocolId,'0146','Ambient Air Temperature','Ambient air temperature Celsius','numeric','$.measurements.0146','Y'),
    (@ProtocolId,'0147','Absolute Throttle Position B','Absolute throttle position B percent','numeric','$.measurements.0147','Y'),
    (@ProtocolId,'0148','Absolute Throttle Position C','Absolute throttle position C percent','numeric','$.measurements.0148','Y'),
    (@ProtocolId,'0149','Accelerator Pedal Position D','Accelerator pedal position D percent','numeric','$.measurements.0149','Y'),
    (@ProtocolId,'014A','Accelerator Pedal Position E','Accelerator pedal position E percent','numeric','$.measurements.014A','Y'),
    (@ProtocolId,'014B','Accelerator Pedal Position F','Accelerator pedal position F percent','numeric','$.measurements.014B','Y'),
    (@ProtocolId,'014C','Commanded Throttle Actuator','Commanded throttle actuator control percent','numeric','$.measurements.014C','Y'),
    (@ProtocolId,'014D','Time Run with MIL On','Time run with MIL on minutes','numeric','$.measurements.014D','Y'),
    (@ProtocolId,'014E','Time Since Codes Cleared','Time since trouble codes last cleared minutes','numeric','$.measurements.014E','Y'),
    (@ProtocolId,'014F','Maximum Sensor Values','Maximum values for equivalence ratio O2 voltage current boost','numeric','$.measurements.014F','Y'),
    (@ProtocolId,'0150','Maximum Mass Air Flow Rate','Maximum value for mass air flow sensor g/s','numeric','$.measurements.0150','Y'),
    (@ProtocolId,'0151','Fuel Type','Fuel type currently in use','string','$.measurements.0151','Y'),
    (@ProtocolId,'0152','Ethanol Fuel Percentage','Ethanol fuel percentage','numeric','$.measurements.0152','Y'),
    (@ProtocolId,'0153','Absolute Evap Vapor Pressure','Absolute evap system vapor pressure kPa','numeric','$.measurements.0153','Y'),
    (@ProtocolId,'0154','Evap Vapor Pressure 2','Evap system vapor pressure alternate Pa','numeric','$.measurements.0154','Y'),
    (@ProtocolId,'0155','Short Term O2 Trim B1 B3','Short-term secondary O2 sensor trim bank 1 and 3 percent','numeric','$.measurements.0155','Y'),
    (@ProtocolId,'0156','Long Term O2 Trim B1 B3','Long-term secondary O2 sensor trim bank 1 and 3 percent','numeric','$.measurements.0156','Y'),
    (@ProtocolId,'0157','Short Term O2 Trim B2 B4','Short-term secondary O2 sensor trim bank 2 and 4 percent','numeric','$.measurements.0157','Y'),
    (@ProtocolId,'0158','Long Term O2 Trim B2 B4','Long-term secondary O2 sensor trim bank 2 and 4 percent','numeric','$.measurements.0158','Y'),
    (@ProtocolId,'0159','Fuel Rail Absolute Pressure','Fuel rail absolute pressure kPa','numeric','$.measurements.0159','Y'),
    (@ProtocolId,'015A','Relative Accel Pedal Position','Relative accelerator pedal position percent','numeric','$.measurements.015A','Y'),
    (@ProtocolId,'015B','Hybrid Battery Remaining Life','Hybrid battery pack remaining life percent','numeric','$.measurements.015B','Y'),
    (@ProtocolId,'015C','Engine Oil Temperature','Engine oil temperature Celsius','numeric','$.measurements.015C','Y'),
    (@ProtocolId,'015D','Fuel Injection Timing','Fuel injection timing degrees','numeric','$.measurements.015D','Y'),
    (@ProtocolId,'015E','Engine Fuel Rate','Engine fuel rate L/h','numeric','$.measurements.015E','Y'),
    (@ProtocolId,'015F','Emission Requirements','Emission requirements vehicle is designed to meet','string','$.measurements.015F','Y'),
    (@ProtocolId,'0160','PIDs Supported 61-80','Bit-encoded list of supported PIDs 61-80','numeric','$.measurements.0160','Y'),
    (@ProtocolId,'0161','Driver Demand Engine Torque','Driver demanded engine torque percent','numeric','$.measurements.0161','Y'),
    (@ProtocolId,'0162','Actual Engine Torque','Actual engine torque percent of reference','numeric','$.measurements.0162','Y'),
    (@ProtocolId,'0163','Engine Reference Torque','Engine reference torque Nm','numeric','$.measurements.0163','Y'),
    (@ProtocolId,'0164','Engine Percent Torque Data','Engine percent torque data array','numeric','$.measurements.0164','Y'),
    (@ProtocolId,'0165','Aux Input Output Supported','Auxiliary input/output supported','numeric','$.measurements.0165','Y'),
    (@ProtocolId,'0166','Mass Air Flow Sensor B','Mass air flow sensor B reading g/s','numeric','$.measurements.0166','Y'),
    (@ProtocolId,'0167','Coolant Temp Sensor 2','Engine coolant temperature sensor 2 Celsius','numeric','$.measurements.0167','Y'),
    (@ProtocolId,'0168','Charged Air Cooler Temp','Charged air cooler temperature Celsius','numeric','$.measurements.0168','Y'),
    (@ProtocolId,'0169','EGR Temperature','Exhaust gas recirculation temperature Celsius','numeric','$.measurements.0169','Y'),
    (@ProtocolId,'016A','Throttle Actuator Relative Pos','Commanded throttle actuator and relative throttle position','numeric','$.measurements.016A','Y'),
    (@ProtocolId,'016B','Exhaust Pressure','Exhaust pressure kPa','numeric','$.measurements.016B','Y'),
    (@ProtocolId,'016C','Turbocharger RPM','Turbocharger compressor inlet speed rpm','numeric','$.measurements.016C','Y'),
    (@ProtocolId,'016D','Turbocharger Temperature','Turbocharger temperature bank 1 Celsius','numeric','$.measurements.016D','Y'),
    (@ProtocolId,'016E','Turbocharger Temperature B2','Turbocharger temperature bank 2 Celsius','numeric','$.measurements.016E','Y'),
    (@ProtocolId,'016F','Intercooler Temperature','Intercooler temperature Celsius','numeric','$.measurements.016F','Y'),
    (@ProtocolId,'0180','PIDs Supported 81-A0','Bit-encoded list of supported PIDs 81-A0','numeric','$.measurements.0180','Y'),
    (@ProtocolId,'0181','NOx Sensor Concentration','NOx sensor concentration bank 1 sensor 1 ppm','numeric','$.measurements.0181','Y'),
    (@ProtocolId,'0182','PM Sensor Mass Concentration','Particulate matter sensor mass concentration','numeric','$.measurements.0182','Y'),
    (@ProtocolId,'0183','Intake Manifold Pressure B','Intake manifold absolute pressure sensor B kPa','numeric','$.measurements.0183','Y'),
    (@ProtocolId,'0184','SCR Induce System Status','SCR inducement system status','numeric','$.measurements.0184','Y'),
    (@ProtocolId,'0185','AECD Run Time 11-15','Run time for AECD 11-15 seconds','numeric','$.measurements.0185','Y'),
    (@ProtocolId,'0186','AECD Run Time 16-20','Run time for AECD 16-20 seconds','numeric','$.measurements.0186','Y'),
    (@ProtocolId,'0187','Diesel Aftertreatment','Diesel aftertreatment status','numeric','$.measurements.0187','Y'),
    (@ProtocolId,'0188','O2 Sensor Wide Range B1S1','O2 sensor wide range lambda voltage bank 1 sensor 1 V','numeric','$.measurements.0188','Y'),
    (@ProtocolId,'0189','O2 Sensor Wide Range B1S2','O2 sensor wide range lambda voltage bank 1 sensor 2 V','numeric','$.measurements.0189','Y'),
    (@ProtocolId,'018A','Fuel System Control','Fuel system control status','numeric','$.measurements.018A','Y'),
    (@ProtocolId,'018B','Diesel Particulate Filter Temp','Diesel particulate filter temperature Celsius','numeric','$.measurements.018B','Y'),
    (@ProtocolId,'018C','NOx NTE Control Area Status','NOx NTE control area status','numeric','$.measurements.018C','Y'),
    (@ProtocolId,'018D','PM NTE Control Area Status','PM NTE control area status','numeric','$.measurements.018D','Y'),
    (@ProtocolId,'018E','Engine Run Time AECD','Engine run time for AECD seconds','numeric','$.measurements.018E','Y'),
    (@ProtocolId,'018F','Engine Run Time Total','Total engine run time seconds','numeric','$.measurements.018F','Y');

    PRINT 'Inserted 131 ProtocolAttribute entries for SARJ1979';
END
ELSE
    PRINT 'ProtocolAttribute rows already exist for SARJ1979 — skipping';

-- ---------------------------------------------------------------------------
-- 4. Entity: HundayTuson 2016
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.Entity WHERE entityId = 'KM8J33A41GU000001')
BEGIN
    INSERT INTO dbo.Entity (entityId, entityFirstName, entityLastName, entityTypeId, active)
    VALUES ('KM8J33A41GU000001', 'HundayTuson', '2016', @CarEntityTypeId, 'Y');
    PRINT 'Inserted Entity: HundayTuson 2016 (KM8J33A41GU000001)';
END
ELSE
    PRINT 'Entity KM8J33A41GU000001 already exists';

-- ---------------------------------------------------------------------------
-- 5. EntityTypeAttribute: Map Car to all SARJ1979 PIDs
-- ---------------------------------------------------------------------------
INSERT INTO dbo.EntityTypeAttribute
    (entityTypeId, protocolId, entityTypeAttributeCode, entityTypeAttributeName,
     entityTypeAttributeTimeAspect, entityTypeAttributeUnit, active)
SELECT
    @CarEntityTypeId, @ProtocolId,
    pa.protocolAttributeCode,
    pa.protocolAttributeName,
    'Pt',
    CASE pa.protocolAttributeCode
        WHEN '010C' THEN 'rpm'   WHEN '010D' THEN 'km/h'  WHEN '0105' THEN 'C'
        WHEN '0111' THEN '%'     WHEN '012F' THEN '%'      WHEN '0110' THEN 'g/s'
        WHEN '010B' THEN 'kPa'   WHEN '010E' THEN 'deg'    WHEN '010F' THEN 'C'
        WHEN '0104' THEN '%'     WHEN '010A' THEN 'kPa'    WHEN '0106' THEN '%'
        WHEN '0107' THEN '%'     WHEN '0108' THEN '%'      WHEN '0109' THEN '%'
        WHEN '011F' THEN 's'     WHEN '0121' THEN 'km'     WHEN '0131' THEN 'km'
        WHEN '012C' THEN '%'     WHEN '012D' THEN '%'      WHEN '012E' THEN '%'
        WHEN '0130' THEN 'count' WHEN '0133' THEN 'kPa'    WHEN '013C' THEN 'C'
        WHEN '013D' THEN 'C'     WHEN '013E' THEN 'C'      WHEN '013F' THEN 'C'
        WHEN '0142' THEN 'V'     WHEN '0143' THEN '%'      WHEN '0145' THEN '%'
        WHEN '0146' THEN 'C'     WHEN '0147' THEN '%'      WHEN '0148' THEN '%'
        WHEN '0149' THEN '%'     WHEN '014A' THEN '%'      WHEN '014B' THEN '%'
        WHEN '014C' THEN '%'     WHEN '014D' THEN 'min'    WHEN '014E' THEN 'min'
        WHEN '0152' THEN '%'     WHEN '0159' THEN 'kPa'    WHEN '015A' THEN '%'
        WHEN '015B' THEN '%'     WHEN '015C' THEN 'C'      WHEN '015D' THEN 'deg'
        WHEN '015E' THEN 'L/h'   WHEN '0161' THEN '%'      WHEN '0162' THEN '%'
        WHEN '016C' THEN 'rpm'   WHEN '016D' THEN 'C'      WHEN '016E' THEN 'C'
        WHEN '016F' THEN 'C'     WHEN '0169' THEN 'C'      WHEN '016B' THEN 'kPa'
        WHEN '0181' THEN 'ppm'   WHEN '018B' THEN 'C'      WHEN '0122' THEN 'kPa'
        WHEN '0123' THEN 'kPa'   WHEN '0132' THEN 'Pa'     WHEN '0163' THEN 'Nm'
        WHEN '0166' THEN 'g/s'   WHEN '0167' THEN 'C'      WHEN '0168' THEN 'C'
        WHEN '0182' THEN 'mg/m3' WHEN '0183' THEN 'kPa'    WHEN '0185' THEN 's'
        WHEN '0186' THEN 's'     WHEN '018E' THEN 's'      WHEN '018F' THEN 's'
        ELSE ''
    END,
    'Y'
FROM dbo.ProtocolAttribute pa
WHERE pa.protocolId = @ProtocolId
  AND NOT EXISTS (
      SELECT 1 FROM dbo.EntityTypeAttribute eta
      WHERE eta.entityTypeId = @CarEntityTypeId
        AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
  );

PRINT 'Inserted EntityTypeAttribute rows for Car / SARJ1979: ' + CAST(@@ROWCOUNT AS VARCHAR);

COMMIT;
PRINT 'Migration 0040 complete: SARJ1979 automotive protocol ready.';

