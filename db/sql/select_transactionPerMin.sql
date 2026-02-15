SELECT
                c.customerName,
                et.entityTypeName,
                e.entityFirstName,
                e.entityLastName,
                e.entityId,
                DATEADD(MINUTE, DATEDIFF(MINUTE, 0, etel.ingestionTimestampUTC), 0) AS ingestionMinute,
                etel.entityTypeAttributeId,
                eta.entityTypeAttributeCode,
                eta.entityTypeAttributeName,
                avg(etel.numericValue) AS avgNumericValue,
                avg(etel.latitude) AS avgLatitude,
                avg(etel.longitude) AS avgLongitude,
                max(etel.stringValue) AS maxStringValue,
                etel.providerEventInterpretation,
                etel.providerDevice,
                COUNT(*) AS Sample
            FROM dbo.EntityTelemetry etel
            JOIN dbo.EntityTypeAttribute eta ON eta.entityTypeAttributeId = etel.entityTypeAttributeId
            JOIN dbo.Entity e ON etel.entityId = e.entityId
            JOIN dbo.CustomerSubscriptions cs ON e.entityId = cs.entityId
            JOIN dbo.Customers c ON cs.customerId = c.customerId
            JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
            WHERE etel.entityId = '033114869'
                AND etel.startTimestampUTC >= DATEADD(MINUTE, -45, GETUTCDATE())
                AND cs.subscriptionStartDate <= GETDATE()
                AND (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            GROUP BY 
                c.customerName,
                et.entityTypeName,
                e.entityFirstName,
                e.entityLastName,
                e.entityId,
                DATEADD(MINUTE, DATEDIFF(MINUTE, 0, etel.ingestionTimestampUTC), 0),
                etel.entityTypeAttributeId,
                eta.entityTypeAttributeCode,
                eta.entityTypeAttributeName,
                etel.providerEventInterpretation,
                etel.providerDevice
            ORDER BY ingestionMinute DESC
            OFFSET 0 ROWS
            FETCH NEXT 1000 ROWS ONLY