-- ============================================================================
-- MIGRATION: 0181_Fix_Foreign_Key_Constraints_Customer_Table
-- ============================================================================
-- Purpose: Fix incorrect foreign key references to non-existent dbo.Customer
--          table. Change all references to use dbo.Customers (plural) instead.
-- 
-- Background: Migration files 0179 and 0180 incorrectly referenced dbo.Customer
--             which doesn't exist. The correct table is dbo.Customers.
--             This causes INSERT operations to fail with "Invalid column name 'customerId'".
-- 
-- Tables Fixed:
--   - dbo.AppUser
--   - dbo.UserAuthorization  
--   - dbo.UserAppPushNotification
-- ============================================================================

SET NOCOUNT ON;
GO

PRINT '============================================================================';
PRINT 'Migration 0181: Fix Foreign Key Constraints - dbo.Customer -> dbo.Customers';
PRINT '============================================================================';
GO

-- ============================================================================
-- STEP 1: Fix AppUser Table
-- ============================================================================
PRINT '[1/3] Fixing AppUser table...';

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_AppUser_Customer' AND parent_object_id = OBJECT_ID('[dbo].[AppUser]'))
BEGIN
    ALTER TABLE [dbo].[AppUser] DROP CONSTRAINT [FK_AppUser_Customer];
    PRINT '  ✓ Dropped incorrect FK: FK_AppUser_Customer';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_AppUser_Customer' AND parent_object_id = OBJECT_ID('[dbo].[AppUser]'))
BEGIN
    ALTER TABLE [dbo].[AppUser]
    ADD CONSTRAINT [FK_AppUser_Customer] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customers]([customerId]);
    PRINT '  ✓ Added correct FK: FK_AppUser_Customer -> dbo.Customers';
END
GO

-- ============================================================================
-- STEP 2: Fix UserAuthorization Table
-- ============================================================================
PRINT '[2/3] Fixing UserAuthorization table...';

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAuthorization_Customer' AND parent_object_id = OBJECT_ID('[dbo].[UserAuthorization]'))
BEGIN
    ALTER TABLE [dbo].[UserAuthorization] DROP CONSTRAINT [FK_UserAuthorization_Customer];
    PRINT '  ✓ Dropped incorrect FK: FK_UserAuthorization_Customer';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAuthorization_Customer' AND parent_object_id = OBJECT_ID('[dbo].[UserAuthorization]'))
BEGIN
    ALTER TABLE [dbo].[UserAuthorization]
    ADD CONSTRAINT [FK_UserAuthorization_Customer] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customers]([customerId]);
    PRINT '  ✓ Added correct FK: FK_UserAuthorization_Customer -> dbo.Customers';
END
GO

-- ============================================================================
-- STEP 3: Fix UserAppPushNotification Table
-- ============================================================================
PRINT '[3/3] Fixing UserAppPushNotification table...';

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAppPushNotification_Customer' AND parent_object_id = OBJECT_ID('[dbo].[UserAppPushNotification]'))
BEGIN
    ALTER TABLE [dbo].[UserAppPushNotification] DROP CONSTRAINT [FK_UserAppPushNotification_Customer];
    PRINT '  ✓ Dropped incorrect FK: FK_UserAppPushNotification_Customer';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAppPushNotification_Customer' AND parent_object_id = OBJECT_ID('[dbo].[UserAppPushNotification]'))
BEGIN
    ALTER TABLE [dbo].[UserAppPushNotification]
    ADD CONSTRAINT [FK_UserAppPushNotification_Customer] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customers]([customerId]);
    PRINT '  ✓ Added correct FK: FK_UserAppPushNotification_Customer -> dbo.Customers';
END
GO

PRINT '';
PRINT '============================================================================';
PRINT 'Migration 0181: Complete ✓';
PRINT '============================================================================';
GO
