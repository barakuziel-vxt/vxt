-- Migration: 0177_B - AppUser Table
-- Date: 2026-04-09
-- Purpose: Application Users with Firebase Authentication

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppUser]') AND type in (N'U'))
BEGIN

CREATE TABLE [dbo].[AppUser] (
    [userId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [firebaseUid] NVARCHAR(128) NOT NULL UNIQUE,
    [email] NVARCHAR(320) NOT NULL,
    [displayName] NVARCHAR(200) NULL,
    [customerId] INT NOT NULL,
    [active] CHAR(1) NOT NULL DEFAULT 'Y',
    [createDate] DATETIME NOT NULL DEFAULT GETDATE(),
    [lastUpdateTimestamp] DATETIME NOT NULL DEFAULT GETDATE(),
    [lastUpdateUser] VARCHAR(128) NOT NULL DEFAULT SUSER_SNAME(),
    CONSTRAINT [FK_AppUser_Customer] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customer]([customerId])
)

CREATE NONCLUSTERED INDEX [IX_AppUser_Email] ON [dbo].[AppUser]([email])
CREATE NONCLUSTERED INDEX [IX_AppUser_CustomerId] ON [dbo].[AppUser]([customerId])
CREATE NONCLUSTERED INDEX [IX_AppUser_Active] ON [dbo].[AppUser]([active])

PRINT 'Created table: AppUser'
END
ELSE
BEGIN
    PRINT 'Table AppUser already exists'
END
