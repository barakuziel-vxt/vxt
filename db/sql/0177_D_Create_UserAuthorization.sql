-- Migration: 0177_D - UserAuthorization Table
-- Date: 2026-04-09
-- Purpose: Role-Based Access Control

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserAuthorization]') AND type in (N'U'))
BEGIN

CREATE TABLE [dbo].[UserAuthorization] (
    [userAuthorizationId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [userId] INT NOT NULL,
    [customerSubscriptionId] INT NOT NULL,
    [role] NVARCHAR(50) NOT NULL DEFAULT 'viewer',
    [active] CHAR(1) NOT NULL DEFAULT 'Y',
    [createDate] DATETIME NOT NULL DEFAULT GETDATE(),
    [lastUpdateTimestamp] DATETIME NOT NULL DEFAULT GETDATE(),
    [lastUpdateUser] VARCHAR(128) NOT NULL DEFAULT SUSER_SNAME(),
    CONSTRAINT [FK_UserAuthorization_AppUser] FOREIGN KEY ([userId]) REFERENCES [dbo].[AppUser]([userId]),
    CONSTRAINT [FK_UserAuthorization_CustomerSubscription] FOREIGN KEY ([customerSubscriptionId]) REFERENCES [dbo].[CustomerSubscriptions]([customerSubscriptionId]),
    CONSTRAINT [UQ_UserAuthorization_CompositeKey] UNIQUE([userId], [customerSubscriptionId])
)

CREATE NONCLUSTERED INDEX [IX_UserAuthorization_UserId] ON [dbo].[UserAuthorization]([userId])
CREATE NONCLUSTERED INDEX [IX_UserAuthorization_SubscriptionId] ON [dbo].[UserAuthorization]([customerSubscriptionId])
CREATE NONCLUSTERED INDEX [IX_UserAuthorization_Role] ON [dbo].[UserAuthorization]([role], [active])

PRINT 'Created table: UserAuthorization'
END
ELSE
BEGIN
    PRINT 'Table UserAuthorization already exists'
END
