-- Fix Foreign Key Constraints - Change dbo.Customer to Customers
-- This script fixes the incorrect foreign key references in migration files 0179 and 0180

SET NOCOUNT ON;
GO

-- ============================================================================
-- Fix AppUser Table
-- ============================================================================
-- Drop the incorrect FK if it exists
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_AppUser_Customer')
BEGIN
    ALTER TABLE [dbo].[AppUser] DROP CONSTRAINT [FK_AppUser_Customer];
    PRINT 'Dropped incorrect FK: FK_AppUser_Customer (pointing to dbo.Customer)';
END
GO

-- Add the correct FK
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_AppUser_Customer')
BEGIN
    ALTER TABLE [dbo].[AppUser]
    ADD CONSTRAINT [FK_AppUser_Customer] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customers]([customerId]);
    PRINT 'Added correct FK: FK_AppUser_Customer (pointing to dbo.Customers)';
END
GO

-- ============================================================================
-- Fix UserAuthorization Table
-- ============================================================================
-- Drop the incorrect FK if it exists
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAuthorization_Customer')
BEGIN
    ALTER TABLE [dbo].[UserAuthorization] DROP CONSTRAINT [FK_UserAuthorization_Customer];
    PRINT 'Dropped incorrect FK: FK_UserAuthorization_Customer (pointing to dbo.Customer)';
END
GO

-- Add the correct FK
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAuthorization_Customer')
BEGIN
    ALTER TABLE [dbo].[UserAuthorization]
    ADD CONSTRAINT [FK_UserAuthorization_Customer] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customers]([customerId]);
    PRINT 'Added correct FK: FK_UserAuthorization_Customer (pointing to dbo.Customers)';
END
GO

-- ============================================================================
-- Fix UserAppPushNotification Table
-- ============================================================================
-- Drop the incorrect FK if it exists
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAppPushNotification_Customer')
BEGIN
    ALTER TABLE [dbo].[UserAppPushNotification] DROP CONSTRAINT [FK_UserAppPushNotification_Customer];
    PRINT 'Dropped incorrect FK: FK_UserAppPushNotification_Customer (pointing to dbo.Customer)';
END
GO

-- Add the correct FK
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserAppPushNotification_Customer')
BEGIN
    ALTER TABLE [dbo].[UserAppPushNotification]
    ADD CONSTRAINT [FK_UserAppPushNotification_Customer] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customers]([customerId]);
    PRINT 'Added correct FK: FK_UserAppPushNotification_Customer (pointing to dbo.Customers)';
END
GO

PRINT '=== Foreign Key Fix Complete ===';
GO
