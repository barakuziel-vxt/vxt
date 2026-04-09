-- Migration: 0177 - Create User, Device, and Push Notification Management Tables
-- Date: 2026-04-09
-- Purpose: Add support for IoT device management, user authentication, and push notifications
-- Tables: EntityIoTDevice, AppUser, UserApplication, UserAuthorization, UserAppPushNotification

-- =====================================================
-- 1. EntityIoTDevice - IoT Hub Device Registration
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EntityIoTDevice]') AND type in (N'U'))
BEGIN

CREATE TABLE [dbo].[EntityIoTDevice] (
    [entityIoTDeviceId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [entityId] NVARCHAR(50) NOT NULL,
    [deviceId] NVARCHAR(200) NOT NULL UNIQUE,
    [iotHubHostname] NVARCHAR(255) NOT NULL DEFAULT 'VXT-IoT-Hub.azure-devices.net',
    [connectionString] NVARCHAR(500) NULL, -- Encrypted in application layer
    [deviceTwinDesired] NVARCHAR(MAX) NULL, -- JSON: Desired properties pushed from cloud
    [deviceTwinReported] NVARCHAR(MAX) NULL, -- JSON: Reported properties from device
    [lastTwinSyncUTC] DATETIME2(7) NULL,
    [provisioningStatus] NVARCHAR(50) NOT NULL DEFAULT 'Pending', -- Pending, Provisioned, Active, Disabled
    [active] CHAR(1) NOT NULL DEFAULT 'Y',
    [createDate] DATETIME NOT NULL DEFAULT GETDATE(),
    [lastUpdateTimestamp] DATETIME NOT NULL DEFAULT GETDATE(),
    [lastUpdateUser] VARCHAR(128) NOT NULL DEFAULT SUSER_SNAME(),
    CONSTRAINT [FK_EntityIoTDevice_Entity] FOREIGN KEY ([entityId]) REFERENCES [dbo].[Entity]([entityId])
)

CREATE NONCLUSTERED INDEX [IX_EntityIoTDevice_EntityId] ON [dbo].[EntityIoTDevice]([entityId])
CREATE NONCLUSTERED INDEX [IX_EntityIoTDevice_DeviceId] ON [dbo].[EntityIoTDevice]([deviceId])
CREATE NONCLUSTERED INDEX [IX_EntityIoTDevice_Status] ON [dbo].[EntityIoTDevice]([provisioningStatus], [active])

PRINT 'Created table: EntityIoTDevice'
END
ELSE
BEGIN
    PRINT 'Table EntityIoTDevice already exists'
END

-- =====================================================
-- 2. AppUser - Application Users (Firebase Auth)
-- =====================================================
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

-- =====================================================
-- 3. UserApplication - Device App Registrations
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserApplication]') AND type in (N'U'))
BEGIN

CREATE TABLE [dbo].[UserApplication] (
    [userApplicationId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [userId] INT NOT NULL,
    [platform] NVARCHAR(20) NOT NULL, -- 'android', 'ios', 'web'
    [fcmToken] NVARCHAR(500) NOT NULL,
    [deviceModel] NVARCHAR(100) NULL, -- e.g. 'SM-N986B', 'iPhone12Pro'
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

-- =====================================================
-- 4. UserAuthorization - Role-Based Access Control
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserAuthorization]') AND type in (N'U'))
BEGIN

CREATE TABLE [dbo].[UserAuthorization] (
    [userAuthorizationId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [userId] INT NOT NULL,
    [customerSubscriptionId] INT NOT NULL,
    [role] NVARCHAR(50) NOT NULL DEFAULT 'viewer', -- 'owner', 'viewer', 'admin'
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

-- =====================================================
-- 5. UserAppPushNotification - Device-Specific Push Rules
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserAppPushNotification]') AND type in (N'U'))
BEGIN

CREATE TABLE [dbo].[UserAppPushNotification] (
    [userAppPushNotificationId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [userApplicationId] INT NOT NULL, -- Device-specific
    [customerSubscriptionId] INT NOT NULL,
    [enabled] CHAR(1) NOT NULL DEFAULT 'Y',
    [minSeverity] NVARCHAR(50) NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    [quietHoursStart] TIME NULL,
    [quietHoursEnd] TIME NULL,
    [deliveryChannel] NVARCHAR(20) NOT NULL DEFAULT 'fcm', -- 'fcm', 'apns', 'email', 'sms'
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

-- =====================================================
-- Summary
-- =====================================================
PRINT '
=======================================================
Migration 0177: User & Device Tables Complete
=======================================================
Created Tables:
   1. EntityIoTDevice (device registration)
   2. AppUser (Firebase Auth users)
   3. UserApplication (FCM device tokens)
   4. UserAuthorization (access control)
   5. UserAppPushNotification (push preferences)
=======================================================
Key Relationships:
   AppUser -> Customer (customerId)
   UserApplication -> AppUser (userId)
   UserAuthorization -> AppUser + CustomerSubscription
   UserAppPushNotification -> UserApplication +
                              CustomerSubscription
   EntityIoTDevice -> Entity (entityId)
=======================================================
'
