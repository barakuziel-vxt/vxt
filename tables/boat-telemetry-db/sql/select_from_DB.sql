select count(1) from dbo.BoatTelemetry

select * from dbo.CustomerProperties

select * from dbo.EntityType
select * from dbo.EntityType where entityCategoryId = 'Person'

select * from dbo.PropertyCategories
select * from dbo.EntityCategories

select * from dbo.Events

select * from HealthVitals

select * from dbo.Customers


-- old work queriy
            SELECT
                 c.customerName AS CustomerName,
                pt.propertyTypeName AS BoatModel,
                cp.customerPropertyName AS BoatName,
                cp.MMSI AS MMSI,
                bt.Timestamp,
                bt.EngineRPM AS EngineRPM,
                bt.CoolantTempC AS CoolantTempC,
                bt.SOG as SOG,
                bt.BatteryVoltage as BatteryVoltage,
                bt.latitude AS latitude,
                bt.longitude AS longitude   
              FROM dbo.BoatTelemetry bt
              JOIN dbo.CustomerProperties cp ON bt.MMSI = 'vessels.urn:mrn:imo:mmsi:' + cp.MMSI
              JOIN dbo.Customers c ON c.customerId = cp.customerId
              JOIN dbo.PropertyType pt ON cp.propertyTypeId = pt.propertyTypeId
            WHERE  c.customerName = 'Sailor'
                AND cp.MMSI = '234567890'
            ORDER BY Timestamp DESC

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
              JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
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
              FROM dbo.BoatTelemetry bt
              JOIN dbo.CustomerSubscriptions cs ON bt.MMSI = cs.entityId
              JOIN dbo.Entity e ON cs.entityId = e.entityId
              JOIN dbo.Customers c ON c.customerId = cs.customerId
              JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
            WHERE  c.customerName = 'Sailor'
                AND e.entityId = '234567890'
                and cs.subscriptionStartDate <= GETDATE()
                and (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            ORDER BY Timestamp DESC

 SELECT e.entityName, e.entityId as mmsi, e.entityTypeId, e.year
            FROM CustomerSubscriptions cs
            JOIN Customers c ON cs.customerId = c.customerId
            JOIN dbo.Entity e ON cs.entityId = e.entityId
            WHERE c.customerName = 'sl-medical' 
            AND c.active = 'Y' AND cs.active = 'Y'
            and cs.subscriptionStartDate <= GETDATE()
            and (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            ORDER BY e.entityName;

SELECT e.entityName, e.entityId as mmsi, e.entityTypeId, e.year

select * from CustomerSubscriptions;

select * from PropertyType;
select * from dbo.Customers;
select * from dbo.CustomerProperties;

select * FROM dbo.BoatTelemetry order by 1 desc

select * from dbo.BoatTelemetry order by timestamp desc

SELECT customerId FROM Customers WHERE customerName = 'Sailor' AND MMSI = '234567890';

SELECT customerId FROM Customers WHERE customerName = 'Sailor';
--  = '234567890'

-- vessels.urn:mrn:imo:mmsi:234567890







IF NOT EXISTS (SELECT 1 FROM Customers WHERE customerName = 'sl-medical' AND primaryContactName = 'Eyal')
    INSERT INTO Customers (customerName, primaryContactName) VALUES ('sl-medical', 'Eyal');
GO



select * from CustomerSubscriptions

DROP TABLE dbo.PropertyCategories;

DROP TABLE dbo.PropertyType
DROP TABLE dbo.CustomerProperties;