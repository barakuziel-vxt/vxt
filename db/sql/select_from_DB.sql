
select distinct signalKPath from SignalK
SELECT * FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8418-4'
select * from dbo.Entity
select * from dbo.Provider
select distinct loincCode from dbo.ProviderEvent  
select * from dbo.Protocol
SELECT 
    p.protocolName,
    pa.protocolAttributeCode,
    pa.protocolAttributeName,
    pa.description,
    pa.jsonPath
FROM ProtocolAttribute pa
JOIN Protocol p ON pa.protocolId = p.protocolId
ORDER BY p.protocolName, pa.protocolAttributeCode;

select * from AnalysisLog order by 1 desc
select * from EventLog where eventLogId = 20580
select * from EventLogDetails where eventLogId = 10379
select * from dbo.EntityTelemetry order by 4 desc
select *  from EventLogDetails where eventLogId = 10525
delete from AnalysisLog
delete from EventLog

select * from ProtocolAttribute
select * from dbo.EntityType
select * from dbo.EntityTypeAttribute
select * from dbo.EntityType where entityCategoryId = 'Person'
select * from dbo.ProviderEvent where loincCode = '8418-4'
update Entity set entityTypeId = 5 where entityFirstName = 'TinyK'

SELECT entityTypeId FROM EntityType WHERE entityTypeName = 'Person';
    SELECT * FROM EntityType WHERE entityTypeName = 'Elan Impression 40';
    SELECT entityTypeId FROM EntityType WHERE entityTypeName = 'Lagoon 380';
    
select * from dbo.Event
select * from dbo.EventAttribute
select * from dbo.EntityTypeAttributeScore

update dbo.Entity set entityTypeCode = 'Person' where entityTypeCode = 'Male'
update dbo.Entity set entityTypeCode = 'Person' where entityTypeCode = 'Female'


select * from dbo.Customers
SELECT e.entityName, e.entityId as mmsi, e.entityTypeCode, e.year

select * from CustomerSubscriptions where entityId = '033114869';

delete from CustomerSubscriptions where entityId = '234567891';
select * from dbo.Customers;

 SELECT 
        cs.customerSubscriptionId,
        c.customerName,
        cs.entityId,
        e.eventCode,
        e.eventDescription,
        af.FunctionName,
        af.FunctionType,
        af.AnalyzePath,
        e.AnalyzeFunctionId
    FROM CustomerSubscriptions cs
    JOIN Customer c ON cs.customerId = c.customerId
    JOIN Event e ON cs.eventId = e.eventId
    LEFT JOIN AnalyzeFunction af ON e.AnalyzeFunctionId = af.AnalyzeFunctionId
    WHERE cs.active = 'Y'
    ORDER BY af.FunctionName, cs.customerSubscriptionId


select * from dbo.EntityTelemetry order by 4 desc

SELECT customerId FROM Customers WHERE customerName = 'Sailor' AND MMSI = '234567890';

SELECT customerId FROM Customers WHERE customerName = 'Sailor';

-- new query working
     SELECT
                c.customerName AS CustomerName,
                et.entityTypeName AS BoatModel,
                e.entityName AS BoatName,
                e.entityId AS MMSI,
                bt.Timestamp,
                bt.EngineRPM AS EngineRPM,
                bt.CoolantTempC AS CoolantTempC,
                bt.SOG as SOG,
                bt.BatteryVoltage as BatteryVoltage,
                bt.latitude AS latitude,
                bt.longitude AS longitude   
              FROM dbo.BoatTelemetry bt
              JOIN dbo.CustomerSubscriptions cs ON bt.MMSI = 'vessels.urn:mrn:imo:mmsi:' + cs.entityId
              JOIN dbo.Entity e ON cs.entityId = e.entityId
              JOIN dbo.Customers c ON c.customerId = cs.customerId
              JOIN dbo.EntityType et ON e.entityTypeCode = et.entityTypeCode
            WHERE  c.customerName = 'Sailor'
                AND e.entityId = '234567890'
                and cs.subscriptionStartDate <= GETDATE()
                and (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            ORDER BY Timestamp DESC

-- new query from HealthVitals
     SELECT
                c.customerName AS CustomerName,
                et.entityTypeName AS BoatModel,
                e.entityName AS BoatName,
                e.entityId AS MMSI,
                bt.Timestamp,
                bt.EngineRPM AS EngineRPM,
                bt.CoolantTempC AS CoolantTempC,
                bt.SOG as SOG,
                bt.BatteryVoltage as BatteryVoltage,
                bt.latitude AS latitude,
                bt.longitude AS longitude   
              FROM dbo.HealthVitals hv
              JOIN dbo.CustomerSubscriptions cs ON hv.UserId = cs.entityId
              JOIN dbo.Entity e ON cs.entityId = e.entityId
              JOIN dbo.Customers c ON c.customerId = cs.customerId
              JOIN dbo.EntityType et ON e.entityTypeCode = et.entityTypeCode
            WHERE  c.customerName = 'Sailor'
                and cs.subscriptionStartDate <= GETDATE()
                and (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            ORDER BY Timestamp DESC

 SELECT DISTINCT e.entityFirstName, e.entityId as mmsi, e.entityTypeId, e.birthdate
            FROM CustomerSubscriptions cs
            JOIN Customers c ON cs.customerId = c.customerId
            JOIN dbo.Entity e ON cs.entityId = e.entityId
            Join dbo.EntityType et ON e.entityTypeId = et.entityTypeId
            WHERE c.customerName = 'SLMEDICAL' 
            and et.entityTypeName = 'Person'
            AND c.active = 'Y' AND cs.active = 'Y'
            and cs.subscriptionStartDate <= GETDATE()
            and (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            ORDER BY e.birthdate;

SELECT
                c.customerName AS CustomerName,
                et.entityTypeName AS EntityType,
                e.entityFirstName AS PatientName,
                e.entityId AS ID,
                hv.Timestamp AS Timestamp,
                hv.StartTime AS StartTime,
                hv.EndTime AS EndTime,
                hv.AvgHR AS AvgHR, 
                hv.MaxHR AS MaxHR,
                hv.MinHR AS MinHR,
                hv.RestingHR AS RestingHR,
                hv.HRV_RMSSD AS HRV_RMSSD,
                hv.Systolic AS Systolic,
                hv.Diastolic AS Diastolic,
                hv.OxygenSat AS OxygenSat,
                hv.AvgGlucose AS AvgGlucose,
                hv.BreathsPerMin AS BreathsPerMin,
                hv.BodyTemp AS BodyTemp,
                hv.ECGClassification AS ECGClassification,
                hv.AfibResult AS AfibResult,
                hv.DeviceName AS DeviceName,
                hv.LoadedAt AS LoadedAt
              FROM dbo.HealthVitals hv
              JOIN dbo.CustomerSubscriptions cs ON hv.userId = cs.entityId
              JOIN dbo.Entity e ON cs.entityId = e.entityId
              JOIN dbo.Customers c ON c.customerId = cs.customerId
              JOIN dbo.EntityType et ON e.entityTypeCode = et.entityTypeCode
            WHERE e.entityId = '033114869'
                and cs.subscriptionStartDate <= GETDATE()
                and (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            ORDER BY hv.Timestamp DESC
            OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY;
--  = '234567890'

-- vessels.urn:mrn:imo:mmsi:234567890




select * from CustomerSubscriptions


select * from EntityTypeAttribute

select * from HealthVitalsId

SELECT        SUM(Score) as Score,
                HealthVitalsId,
                c.customerName AS CustomerName,
                et.entityTypeName AS EntityType,
                e.entityFirstName AS PatientName,
                e.entityId AS ID,
                hv.Timestamp AS Timestamp,
                hv.StartTime AS StartTime,
                hv.EndTime AS EndTime,
                hv.AvgHR AS AvgHR, 
                hv.MaxHR AS MaxHR,
                hv.MinHR AS MinHR,
                hv.RestingHR AS RestingHR,
                hv.HRV_RMSSD AS HRV_RMSSD,
                hv.Systolic AS Systolic,
                hv.Diastolic AS Diastolic,
                hv.OxygenSat AS OxygenSat,
                hv.AvgGlucose AS AvgGlucose,
                hv.BreathsPerMin AS BreathsPerMin,
                hv.BodyTemp AS BodyTemp,
                hv.ECGClassification AS ECGClassification,
                hv.AfibResult AS AfibResult,
                hv.DeviceName AS DeviceName,
                hv.LoadedAt AS LoadedAt
              FROM dbo.HealthVitals hv
              JOIN dbo.CustomerSubscriptions cs ON hv.userId = cs.entityId
              JOIN dbo.Events ev ON ev.eventCode = cs.eventCode
              JOIN dbo.EventCriteria ec ON ev.eventCode = ec.eventCode
              JOIN dbo.EntityTypeCriteria etc ON etc.entityTypeAttributeCode = ec.entityTypeAttributeCode
              JOIN dbo.Entity e ON cs.entityId = e.entityId
              JOIN dbo.Customers c ON c.customerId = cs.customerId
              JOIN dbo.EntityType et ON e.entityTypeCode = et.entityTypeCode
            WHERE e.entityId = '033114869'
            and hv.HealthVitalsId = 11487
            and cs.subscriptionStartDate <= GETDATE()
                and (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            AND 150 BETWEEN MinValue AND MaxValue
            ORDER BY hv.HealthVitalsId DESC

    select SUM(Score) 
    from dbo.entityTypeCriteria
    WHERE  entityTypeAttributeCode = 'AvgHR'
    AND 150 BETWEEN MinValue AND MaxValue


    select  *  from dbo.entityTypeCriteria
    select  *  from EventCriteria

    EventCriteria



    -- filepath: c:\VXT\db\sql\select_from_DB.sql
SELECT
    hv.HealthVitalsId,
    ev.eventId AS EventCode,
    eta.entityTypeAttributeCode AS EntityTypeAttributeCode,
    SUM(etas.Score) AS CumulativeScore,
    c.customerName AS CustomerName,
    et.entityTypeName AS EntityType,
    e.entityFirstName AS PatientName,
    e.entityId AS ID,
    hv.Timestamp AS Timestamp,
    hv.StartTime AS StartTime,
    hv.EndTime AS EndTime,
    hv.AvgHR,
    hv.MaxHR,
    hv.MinHR,
    hv.RestingHR,
    hv.HRV_RMSSD,
    hv.Systolic,
    hv.Diastolic,
    hv.OxygenSat,
    hv.AvgGlucose,
    hv.BreathsPerMin,
    hv.BodyTemp,
    hv.ECGClassification,
    hv.AfibResult,
    hv.DeviceName,
    hv.LoadedAt
FROM dbo.HealthVitals hv
JOIN dbo.CustomerSubscriptions cs ON hv.userId = cs.entityId
JOIN dbo.Event ev ON ev.eventId = cs.eventId
JOIN dbo.EventCriteria ec ON ev.eventId = ec.eventId
JOIN dbo.EntityTypeAttribute eta ON eta.entityTypeAttributeId = ec.entityTypeAttributeId
JOIN dbo.EntityTypeAttributeScore etas ON etas.entityTypeAttributeId = eta.entityTypeAttributeId
JOIN dbo.Entity e ON cs.entityId = e.entityId
JOIN dbo.Customers c ON c.customerId = cs.customerId
JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
WHERE e.entityId = '033114869'
    AND hv.HealthVitalsId = 11487
    AND cs.subscriptionStartDate <= GETDATE()
    AND (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
    AND CAST(CASE 
        WHEN eta.entityTypeAttributeCode = 'AvgHR' THEN CAST(hv.AvgHR AS VARCHAR(10))
        WHEN eta.entityTypeAttributeCode = 'MaxHR' THEN CAST(hv.MaxHR AS VARCHAR(10))
        WHEN eta.entityTypeAttributeCode = 'MinHR' THEN CAST(hv.MinHR AS VARCHAR(10))
        WHEN eta.entityTypeAttributeCode = 'Systolic' THEN CAST(hv.Systolic AS VARCHAR(10))
        WHEN eta.entityTypeAttributeCode = 'Diastolic' THEN CAST(hv.Diastolic AS VARCHAR(10))
        WHEN eta.entityTypeAttributeCode = 'BodyTemp' THEN CAST(hv.BodyTemp AS VARCHAR(10))
        WHEN eta.entityTypeAttributeCode = 'OxygenSat' THEN CAST(hv.OxygenSat AS VARCHAR(10))
        WHEN eta.entityTypeAttributeCode = 'AvgGlucose' THEN CAST(hv.AvgGlucose AS VARCHAR(10))
        WHEN eta.entityTypeAttributeCode = 'BreathsPerMin' THEN CAST(hv.BreathsPerMin AS VARCHAR(10))
        ELSE '0'
    END AS DECIMAL(10,2)) BETWEEN etas.MinValue AND etas.MaxValue
GROUP BY ev.eventId,hv.HealthVitalsId, c.customerName, et.entityTypeName, e.entityFirstName, e.entityId,
         eta.entityTypeAttributeCode, hv.Timestamp, hv.StartTime, hv.EndTime,
         hv.AvgHR, hv.MaxHR, hv.MinHR, hv.RestingHR, hv.HRV_RMSSD, hv.Systolic, hv.Diastolic,
         hv.OxygenSat, hv.AvgGlucose, hv.BreathsPerMin, hv.BodyTemp, hv.ECGClassification,
         hv.AfibResult, hv.DeviceName, hv.LoadedAt
ORDER BY hv.HealthVitalsId DESC;





        --etc.entityTypeAttributeCode,
-- filepath: c:\VXT\db\sql\select_from_DB.sql
-- filepath: c:\VXT\db\sql\select_from_DB.sql


