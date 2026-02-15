SELECT
    eta.entityTypeAttributeName AS AttributeName,
    eta.entityTypeAttributeCode AS AttributeCode,
    COUNT(*) AS SampleCount,
    MIN(CAST(ISNULL(numericValue, 0) AS FLOAT)) AS MinValue,
    AVG(CAST(ISNULL(numericValue, 0) AS FLOAT)) AS AvgValue,
    MAX(CAST(ISNULL(numericValue, 0) AS FLOAT)) AS MaxValue,
    MIN(CAST(startTimestampUTC AS DATETIME)) AS EarliestSampleTime,
    MAX(CAST(startTimestampUTC AS DATETIME)) AS LatestSampleTime,
    COUNT(DISTINCT providerDevice) AS UniqueDevices
    --STRING_AGG(DISTINCT providerDevice, ', ') AS DeviceList
FROM dbo.EntityTelemetry et
JOIN dbo.EntityTypeAttribute eta ON eta.entityTypeAttributeId = et.entityTypeAttributeId
WHERE et.entityId = '033114869'
AND et.startTimestampUTC >= DATEADD(MINUTE, -100, GETUTCDATE())
GROUP BY eta.entityTypeAttributeName, eta.entityTypeAttributeCode, et.entityTypeAttributeId
ORDER BY MAX(startTimestampUTC) DESC;

select * from EntityTypeAttribute

select * from dbo.EntityTelemetry order by startTimestampUTC desc
select * from entity

SELECT *
FROM dbo.EntityTelemetry et
JOIN dbo.EntityTypeAttribute eta ON eta.entityTypeAttributeId = et.entityTypeAttributeId
JOIN dbo.Entity e ON e.entityId = et.entityId
JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
WHERE et.entityId = '033114869'
ORDER BY MAX(startTimestampUTC) DESC;


SELECT *
FROM dbo.EntityTelemetry etel
JOIN dbo.EntityTypeAttribute eta ON eta.entityTypeAttributeId = etel.entityTypeAttributeId
WHERE etel.entityId = '033114869'
AND etel.startTimestampUTC >= DATEADD(MINUTE, -1000, GETUTCDATE())


select count(1) from EntityTelemetry order by 2 desc
WHERE entityId = '033114869'

SELECT
                c.customerName,
                et.entityTypeName,
                e.entityFirstName,
                e.entityLastName,
                e.entityId,
                etel.ingestionTimestampUTC,
                etel.startTimestampUTC,
                etel.endTimestampUTC,
                etel.entityTypeAttributeId,
                eta.entityTypeAttributeCode,
                eta.entityTypeAttributeName,
                etel.numericValue,
                etel.latitude,
                etel.longitude,
                etel.stringValue,
                etel.providerEventInterpretation,
                etel.providerDevice
            FROM dbo.EntityTelemetry etel
            JOIN dbo.EntityTypeAttribute eta ON eta.entityTypeAttributeId = etel.entityTypeAttributeId
            JOIN dbo.Entity e ON etel.entityId = e.entityId
            JOIN dbo.CustomerSubscriptions cs ON e.entityId = cs.entityId
            JOIN dbo.Customers c ON cs.customerId = c.customerId
            JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
            WHERE etel.entityId = '033114869'
                AND etel.startTimestampUTC >= DATEADD(MINUTE, -20, GETUTCDATE())
                AND cs.subscriptionStartDate <= GETDATE()
                AND (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            ORDER BY etel.ingestionTimestampUTC DESC
            OFFSET 0 ROWS
            FETCH NEXT 50 ROWS ONLY