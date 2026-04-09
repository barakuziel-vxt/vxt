-- Migration: 0177_E - UserAppPushNotification Table
-- Date: 2026-04-09
-- Purpose: Device-Specific Push Notification Preferences

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserAppPushNotification]') AND type in (N'U'))
BEGIN

CREATE TABLE [dbo].[UserAppPushNotification] (
    [userAppPushNotificationId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [userApplicationId] INT NOT NULL,
    [customerSubscriptionId] INT NOT NULL,
    [enabled] CHAR(1) NOT NULL DEFAULT 'Y',
    [minSeverity] NVARCHAR(50) NULL DEFAULT 'MEDIUM',
    [quietHoursStart] TIME NULL,
    [quietHoursEnd] TIME NULL,
    [deliveryChannel] NVARCHAR(20) NOT NULL DEFAULT 'fcm',
    [soundEnabled] CHAR(1) NOT NULL DEFAULT 'Y',
    [vibrationEnabled] CHAR(1) NOT NULL DEFAULT 'Y',
    [ledEnabled] CHAR(1) NOT NULL DEFAULT 'Y',
    [active] CHAR(1) NOT NULL DEFAULT 'Y',
    [createDate] DATETIME NOT NULL DEFAULT GETDATE(),
    [lastUpdateTimestamp] DATETIME NOT NULL DEFAULT GETDATE(),
    [lastUpdateUser] VARCHAR(128) NOT NULL DEFAULT SUSER_SNAME(),
    CONSTRAINT [FK_UserAppPushNotification_UserApplication] FOREIGN KEY ([userApplicationId]) REFERENCES [dbo].[UserApplication]([userApplicationId]) ON DELETE CASCADE,
    CONSTRAINT [FK_UserAppPushNotification_CustomerSubscription] FOREIGN KEY ([customerSubscriptionId]) REFERENCES [dbo].[CustomerSubscriptions]([customerSubscriptionId]),
    CONSTRAINT [UQ_UserAppPushNotification_CompositeKey] UNIQUE([userApplicationId], [customerSubscriptionId])
)

CREATE NONCLUSTERED INDEX [IX_UserAppPushNotification_UserApp] ON [dbo].[UserAppPushNotification]([userApplicationId])
CREATE NONCLUSTERED INDEX [IX_UserAppPushNotification_Subscription] ON [dbo].[UserAppPushNotification]([customerSubscriptionId])
CREATE NONCLUSTERED INDEX [IX_UserAppPushNotification_Enabled] ON [dbo].[UserAppPushNotification]([enabled], [minSeverity], [active])

PRINT 'Created table: UserAppPushNotification'
END
ELSE
BEGIN
    PRINT 'Table UserAppPushNotification already exists'
END
