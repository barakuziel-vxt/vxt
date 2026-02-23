-- Populate CustomerSubscriptions from CustomerEntities
-- This script creates subscriptions for all CustomerEntities
-- and assigns all relevant events based on the entity's entityTypeId

/*
SCRIPT LOGIC:
1. For each CustomerEntity (customer + entity pair)
2. Find the entity's entityTypeId from the Entity table
3. Find all active Events that apply to that entityTypeId
4. Create a CustomerSubscription for each (customer, entity, event) combination
5. Skip if subscription already exists
*/

SET NOCOUNT ON;

BEGIN TRANSACTION;

BEGIN TRY
    
    -- Count existing subscriptions before insert
    DECLARE @subscriptionsBefore INT;
    SELECT @subscriptionsBefore = COUNT(*) FROM CustomerSubscriptions;
    PRINT 'Subscriptions before insert: ' + CAST(@subscriptionsBefore AS VARCHAR(10));

    -- Insert new subscriptions from CustomerEntities and Events
    INSERT INTO CustomerSubscriptions (customerId, entityId, eventId, subscriptionStartDate, active)
    SELECT DISTINCT
        ce.customerId,
        ce.entityId,
        e.eventId,
        GETDATE() AS subscriptionStartDate,
        'Y' AS active
    FROM CustomerEntities ce
    INNER JOIN Entity ent ON ce.entityId = ent.entityId
    INNER JOIN Event e ON ent.entityTypeId = e.entityTypeId
    WHERE ce.active = 'Y'
        AND ent.active = 'Y'
        AND e.active = 'Y'
        -- Skip if this subscription already exists
        AND NOT EXISTS (
            SELECT 1 FROM CustomerSubscriptions cs
            WHERE cs.customerId = ce.customerId
                AND cs.entityId = ce.entityId
                AND cs.eventId = e.eventId
        );

    -- Count new subscriptions created
    DECLARE @subscriptionsAfter INT;
    SELECT @subscriptionsAfter = COUNT(*) FROM CustomerSubscriptions;
    DECLARE @newSubscriptions INT = @subscriptionsAfter - @subscriptionsBefore;
    
    PRINT 'Subscriptions after insert: ' + CAST(@subscriptionsAfter AS VARCHAR(10));
    PRINT 'New subscriptions created: ' + CAST(@newSubscriptions AS VARCHAR(10));

    -- Show summary of inserted subscriptions
    PRINT '';
    PRINT '=== Summary of New Subscriptions ===';
    SELECT
        COUNT(*) AS TotalCount,
        c.customerName,
        COUNT(DISTINCT cs.entityId) AS EntityCount,
        COUNT(DISTINCT cs.eventId) AS EventCount
    FROM CustomerSubscriptions cs
    INNER JOIN Customers c ON cs.customerId = c.customerId
    WHERE cs.createDate >= DATEADD(SECOND, -10, GETDATE())  -- Recently created
    GROUP BY c.customerId, c.customerName
    ORDER BY c.customerName;

    -- Show detailed list of new subscriptions
    PRINT '';
    PRINT '=== Detailed New Subscriptions ===';
    SELECT
        c.customerName AS Customer,
        cs.entityId AS Entity,
        e.eventCode AS Event,
        etype.entityTypeName AS EntityType,
        cs.subscriptionStartDate AS StartDate,
        cs.active AS Active
    FROM CustomerSubscriptions cs
    INNER JOIN Customers c ON cs.customerId = c.customerId
    INNER JOIN Entity ent ON cs.entityId = ent.entityId
    INNER JOIN EntityType etype ON ent.entityTypeId = etype.entityTypeId
    LEFT JOIN Event e ON cs.eventId = e.eventId
    WHERE cs.createDate >= DATEADD(SECOND, -10, GETDATE())  -- Recently created
    ORDER BY c.customerName, cs.entityId, e.eventCode;

    COMMIT TRANSACTION;
    PRINT '';
    PRINT 'SUCCESS: CustomerSubscriptions inserted successfully.';

END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT '';
    PRINT 'ERROR: Transaction rolled back.';
    PRINT 'Error Number: ' + CAST(ERROR_NUMBER() AS VARCHAR(10));
    PRINT 'Error Message: ' + ERROR_MESSAGE();
END CATCH;

SET NOCOUNT OFF;
