-- Migration: 0180 - Redesign UserAppPushNotification from Subscription-based to Customer+Entity-based
-- Date: 2026-04-16
-- Purpose: Replace customerSubscriptionId with customerId + entityId (nullable)

-- ============================================================================
-- STEP 1: Add new columns (customerId, entityId)
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserAppPushNotification') AND name = 'customerId')
BEGIN
    ALTER TABLE dbo.UserAppPushNotification ADD [customerId] INT NULL;
    PRINT 'Added column: customerId'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserAppPushNotification') AND name = 'entityId')
BEGIN
    ALTER TABLE dbo.UserAppPushNotification ADD [entityId] NVARCHAR(50) NULL;
    PRINT 'Added column: entityId'
END
GO

-- ============================================================================
-- STEP 2: Migrate data from customerSubscriptionId → customerId + entityId
-- ============================================================================
UPDATE uapn
SET uapn.customerId = cs.customerId,
    uapn.entityId   = cs.entityId
FROM dbo.UserAppPushNotification uapn
JOIN dbo.CustomerSubscriptions cs ON cs.customerSubscriptionId = uapn.customerSubscriptionId
WHERE uapn.customerId IS NULL;

PRINT 'Migrated existing data: customerSubscriptionId → customerId + entityId'
GO

-- ============================================================================
-- STEP 3: Make customerId NOT NULL
-- ============================================================================
ALTER TABLE dbo.UserAppPushNotification ALTER COLUMN [customerId] INT NOT NULL;
PRINT 'Made customerId NOT NULL'
GO

-- ============================================================================
-- STEP 4: Drop old FK, unique constraint, and indexes
-- ============================================================================
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAppPushNotification_CustomerSubscription')
BEGIN
    ALTER TABLE dbo.UserAppPushNotification DROP CONSTRAINT FK_UserAppPushNotification_CustomerSubscription;
    PRINT 'Dropped FK: FK_UserAppPushNotification_CustomerSubscription'
END

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_UserAppPushNotification_CompositeKey')
BEGIN
    ALTER TABLE dbo.UserAppPushNotification DROP CONSTRAINT UQ_UserAppPushNotification_CompositeKey;
    PRINT 'Dropped UQ: UQ_UserAppPushNotification_CompositeKey'
END

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserAppPushNotification_Subscription' AND object_id = OBJECT_ID('dbo.UserAppPushNotification'))
BEGIN
    DROP INDEX IX_UserAppPushNotification_Subscription ON dbo.UserAppPushNotification;
    PRINT 'Dropped index: IX_UserAppPushNotification_Subscription'
END
GO

-- ============================================================================
-- STEP 5: Drop the customerSubscriptionId column
-- ============================================================================
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserAppPushNotification') AND name = 'customerSubscriptionId')
BEGIN
    ALTER TABLE dbo.UserAppPushNotification DROP COLUMN [customerSubscriptionId];
    PRINT 'Dropped column: customerSubscriptionId'
END
GO

-- ============================================================================
-- STEP 6: Add new FK constraints and indexes
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAppPushNotification_Customer')
BEGIN
    ALTER TABLE dbo.UserAppPushNotification
    ADD CONSTRAINT FK_UserAppPushNotification_Customer
        FOREIGN KEY ([customerId]) REFERENCES dbo.Customer([customerId]);
    PRINT 'Added FK: FK_UserAppPushNotification_Customer'
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAppPushNotification_Entity')
BEGIN
    ALTER TABLE dbo.UserAppPushNotification
    ADD CONSTRAINT FK_UserAppPushNotification_Entity
        FOREIGN KEY ([entityId]) REFERENCES dbo.Entity([entityId]);
    PRINT 'Added FK: FK_UserAppPushNotification_Entity'
END

-- New unique constraint
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_UserAppPushNotification_App_Customer_Entity')
BEGIN
    ALTER TABLE dbo.UserAppPushNotification
    ADD CONSTRAINT UQ_UserAppPushNotification_App_Customer_Entity
        UNIQUE ([userApplicationId], [customerId], [entityId]);
    PRINT 'Added UQ: UQ_UserAppPushNotification_App_Customer_Entity'
END

-- Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserAppPushNotification_CustomerId' AND object_id = OBJECT_ID('dbo.UserAppPushNotification'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserAppPushNotification_CustomerId ON dbo.UserAppPushNotification([customerId]);
    PRINT 'Created index: IX_UserAppPushNotification_CustomerId'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserAppPushNotification_EntityId' AND object_id = OBJECT_ID('dbo.UserAppPushNotification'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserAppPushNotification_EntityId ON dbo.UserAppPushNotification([entityId]);
    PRINT 'Created index: IX_UserAppPushNotification_EntityId'
END

PRINT '✅ Migration 0180 complete: UserAppPushNotification redesigned to Customer+Entity model'
GO
