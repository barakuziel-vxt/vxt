-- Migration: 0177_C - UserApplication Table
-- Date: 2026-04-09
-- Purpose: Device App Registrations with FCM Tokens

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserApplication]') AND type in (N'U'))
BEGIN

CREATE TABLE [dbo].[UserApplication] (
    [userApplicationId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [userId] INT NOT NULL,
    [platform] NVARCHAR(20) NOT NULL,
    [fcmToken] NVARCHAR(500) NOT NULL,
    [deviceModel] NVARCHAR(100) NULL,
    [appVersion] NVARCHAR(20) NULL,
    [lastActiveUTC] DATETIME2(7) NULL,
    [active] CHAR(1) NOT NULL DEFAULT 'Y',
    [createDate] DATETIME NOT NULL DEFAULT GETDATE(),
    [lastUpdateTimestamp] DATETIME NOT NULL DEFAULT GETDATE(),
    [lastUpdateUser] VARCHAR(128) NOT NULL DEFAULT SUSER_SNAME(),
    CONSTRAINT [FK_UserApplication_AppUser] FOREIGN KEY ([userId]) REFERENCES [dbo].[AppUser]([userId])
)

CREATE NONCLUSTERED INDEX [IX_UserApplication_UserId] ON [dbo].[UserApplication]([userId])
CREATE NONCLUSTERED INDEX [IX_UserApplication_FcmToken] ON [dbo].[UserApplication]([fcmToken])
CREATE NONCLUSTERED INDEX [IX_UserApplication_Platform] ON [dbo].[UserApplication]([platform], [active])

PRINT 'Created table: UserApplication'
END
ELSE
BEGIN
    PRINT 'Table UserApplication already exists'
END
