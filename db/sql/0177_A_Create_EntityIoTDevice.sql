-- Migration: 0177_A - EntityIoTDevice Table
-- Date: 2026-04-09
-- Purpose: IoT Hub Device Registration & Twin Management

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EntityIoTDevice]') AND type in (N'U'))
BEGIN

CREATE TABLE [dbo].[EntityIoTDevice] (
    [entityIoTDeviceId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [entityId] NVARCHAR(50) NOT NULL,
    [deviceId] NVARCHAR(200) NOT NULL UNIQUE,
    [iotHubHostname] NVARCHAR(255) NOT NULL DEFAULT 'VXT-IoT-Hub.azure-devices.net',
    [connectionString] NVARCHAR(500) NULL,
    [deviceTwinDesired] NVARCHAR(MAX) NULL,
    [deviceTwinReported] NVARCHAR(MAX) NULL,
    [lastTwinSyncUTC] DATETIME2(7) NULL,
    [provisioningStatus] NVARCHAR(50) NOT NULL DEFAULT 'Pending',
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
