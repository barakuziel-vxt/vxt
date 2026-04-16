-- Migration: 0179 - Redesign UserAuthorization from Subscription-based to Customer+Entity-based
-- Date: 2026-04-16
-- Purpose: Replace customerSubscriptionId with customerId + entityId (nullable)
--          Add effectiveDate (default GETDATE()) and expiryDate (default NULL)
--
-- Role logic:
--   Owner  → customerId set, entityId NULL → full access to all customer entities
--   Admin  → customerId set, entityId NULL → manage viewers, view all entities
--   Viewer → customerId set, entityId set  → read-only access to one entity

-- ============================================================================
-- STEP 1: Add new columns (customerId, entityId, effectiveDate, expiryDate)
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserAuthorization') AND name = 'customerId')
BEGIN
    ALTER TABLE dbo.UserAuthorization ADD [customerId] INT NULL;
    PRINT 'Added column: customerId'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserAuthorization') AND name = 'entityId')
BEGIN
    ALTER TABLE dbo.UserAuthorization ADD [entityId] NVARCHAR(50) NULL;
    PRINT 'Added column: entityId'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserAuthorization') AND name = 'effectiveDate')
BEGIN
    ALTER TABLE dbo.UserAuthorization ADD [effectiveDate] DATETIME NOT NULL DEFAULT GETDATE();
    PRINT 'Added column: effectiveDate (default GETDATE())'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserAuthorization') AND name = 'expiryDate')
BEGIN
    ALTER TABLE dbo.UserAuthorization ADD [expiryDate] DATETIME NULL;
    PRINT 'Added column: expiryDate (default NULL)'
END
GO

-- ============================================================================
-- STEP 2: Migrate data from customerSubscriptionId → customerId + entityId
-- ============================================================================
UPDATE ua
SET ua.customerId = cs.customerId,
    ua.entityId   = cs.entityId
FROM dbo.UserAuthorization ua
JOIN dbo.CustomerSubscriptions cs ON cs.customerSubscriptionId = ua.customerSubscriptionId
WHERE ua.customerId IS NULL;

PRINT 'Migrated existing data: customerSubscriptionId → customerId + entityId'
GO

-- ============================================================================
-- STEP 3: Make customerId NOT NULL now that data is populated
-- ============================================================================
ALTER TABLE dbo.UserAuthorization ALTER COLUMN [customerId] INT NOT NULL;
PRINT 'Made customerId NOT NULL'
GO

-- ============================================================================
-- STEP 4: Drop old FK, unique constraint, and indexes related to customerSubscriptionId
-- ============================================================================
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAuthorization_CustomerSubscription')
BEGIN
    ALTER TABLE dbo.UserAuthorization DROP CONSTRAINT FK_UserAuthorization_CustomerSubscription;
    PRINT 'Dropped FK: FK_UserAuthorization_CustomerSubscription'
END

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_UserAuthorization_CompositeKey')
BEGIN
    ALTER TABLE dbo.UserAuthorization DROP CONSTRAINT UQ_UserAuthorization_CompositeKey;
    PRINT 'Dropped UQ: UQ_UserAuthorization_CompositeKey'
END

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserAuthorization_SubscriptionId' AND object_id = OBJECT_ID('dbo.UserAuthorization'))
BEGIN
    DROP INDEX IX_UserAuthorization_SubscriptionId ON dbo.UserAuthorization;
    PRINT 'Dropped index: IX_UserAuthorization_SubscriptionId'
END
GO

-- ============================================================================
-- STEP 5: Drop the customerSubscriptionId column
-- ============================================================================
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UserAuthorization') AND name = 'customerSubscriptionId')
BEGIN
    ALTER TABLE dbo.UserAuthorization DROP COLUMN [customerSubscriptionId];
    PRINT 'Dropped column: customerSubscriptionId'
END
GO

-- ============================================================================
-- STEP 6: Add new FK constraints and indexes
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAuthorization_Customer')
BEGIN
    ALTER TABLE dbo.UserAuthorization
    ADD CONSTRAINT FK_UserAuthorization_Customer
        FOREIGN KEY ([customerId]) REFERENCES dbo.Customer([customerId]);
    PRINT 'Added FK: FK_UserAuthorization_Customer'
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAuthorization_Entity')
BEGIN
    ALTER TABLE dbo.UserAuthorization
    ADD CONSTRAINT FK_UserAuthorization_Entity
        FOREIGN KEY ([entityId]) REFERENCES dbo.Entity([entityId]);
    PRINT 'Added FK: FK_UserAuthorization_Entity'
END

-- New unique constraint: one role per user per customer per entity
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_UserAuthorization_User_Customer_Entity')
BEGIN
    ALTER TABLE dbo.UserAuthorization
    ADD CONSTRAINT UQ_UserAuthorization_User_Customer_Entity
        UNIQUE ([userId], [customerId], [entityId]);
    PRINT 'Added UQ: UQ_UserAuthorization_User_Customer_Entity'
END

-- Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserAuthorization_CustomerId' AND object_id = OBJECT_ID('dbo.UserAuthorization'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserAuthorization_CustomerId ON dbo.UserAuthorization([customerId]);
    PRINT 'Created index: IX_UserAuthorization_CustomerId'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserAuthorization_EntityId' AND object_id = OBJECT_ID('dbo.UserAuthorization'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserAuthorization_EntityId ON dbo.UserAuthorization([entityId]);
    PRINT 'Created index: IX_UserAuthorization_EntityId'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserAuthorization_EffectiveExpiry' AND object_id = OBJECT_ID('dbo.UserAuthorization'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserAuthorization_EffectiveExpiry ON dbo.UserAuthorization([effectiveDate], [expiryDate]);
    PRINT 'Created index: IX_UserAuthorization_EffectiveExpiry'
END

PRINT '✅ Migration 0179 complete: UserAuthorization redesigned to Customer+Entity model'
GO
