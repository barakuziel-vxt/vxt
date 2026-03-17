-- ============================================================
-- Azure SQL Database Schema Export
-- Database: BoatTelemetryDB
-- ============================================================


-- Table: AnalysisLog
DROP TABLE IF EXISTS [AnalysisLog];
GO

CREATE TABLE [AnalysisLog] (
    [analysisLogId] bigint NOT NULL,
    [entityId] nvarchar(50) NOT NULL,
    [messageType] nvarchar(50) NOT NULL,
    [eventLogId] bigint NULL,
    [details] nvarchar(500) NULL,
    [analysisStartTime] datetime NOT NULL,
    [analysisEndTime] datetime NULL,
    [logDate] datetime NOT NULL DEFAULT (getdate())
);
GO

-- Table: AnalyzeFunction
DROP TABLE IF EXISTS [AnalyzeFunction];
GO

CREATE TABLE [AnalyzeFunction] (
    [AnalyzeFunctionId] int NOT NULL,
    [FunctionName] nvarchar(256) NOT NULL,
    [FunctionType] nvarchar(128) NOT NULL,
    [AnalyzePath] nvarchar(512) NOT NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname()),
    [functionDescription] nvarchar NULL
);
GO

-- Table: Customer
DROP TABLE IF EXISTS [Customer];
GO

CREATE TABLE [Customer] (
    [customerId] int NOT NULL,
    [customerName] varchar(200) NOT NULL,
    [primaryContactName] varchar(100) NULL,
    [primaryContactEmail] varchar(320) NULL,
    [primaryContactPhone] varchar(50) NULL,
    [billingAddress1] varchar(200) NULL,
    [billingAddress2] varchar(200) NULL,
    [billingCity] varchar(100) NULL,
    [billingState] varchar(100) NULL,
    [billingPostalCode] varchar(30) NULL,
    [billingCountry] varchar(100) NULL,
    [propertyId] int NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: CustomerEntities
DROP TABLE IF EXISTS [CustomerEntities];
GO

CREATE TABLE [CustomerEntities] (
    [customerEntityId] int NOT NULL,
    [customerId] int NOT NULL,
    [entityId] nvarchar(50) NOT NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: CustomerGeofenceCriteria
DROP TABLE IF EXISTS [CustomerGeofenceCriteria];
GO

CREATE TABLE [CustomerGeofenceCriteria] (
    [customerGeofenceCriteriaId] int NOT NULL,
    [customerId] int NOT NULL,
    [entityTypeAttributeId] int NOT NULL,
    [geofenceName] nvarchar(255) NOT NULL,
    [geoType] nvarchar(50) NOT NULL,
    [coordinates] nvarchar NOT NULL,
    [description] nvarchar NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createdAt] datetime NOT NULL DEFAULT (getdate()),
    [modifiedAt] datetime NOT NULL DEFAULT (getdate())
);
GO

-- Table: Customers
DROP TABLE IF EXISTS [Customers];
GO

CREATE TABLE [Customers] (
    [customerId] int NOT NULL,
    [customerName] varchar(200) NOT NULL,
    [primaryContactName] varchar(100) NULL,
    [primaryContactEmail] varchar(320) NULL,
    [primaryContactPhone] varchar(50) NULL,
    [billingAddress1] varchar(200) NULL,
    [billingAddress2] varchar(200) NULL,
    [billingCity] varchar(100) NULL,
    [billingState] varchar(100) NULL,
    [billingPostalCode] varchar(30) NULL,
    [billingCountry] varchar(100) NULL,
    [propertyId] int NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: CustomerSubscriptions
DROP TABLE IF EXISTS [CustomerSubscriptions];
GO

CREATE TABLE [CustomerSubscriptions] (
    [customerSubscriptionId] int NOT NULL,
    [customerId] int NOT NULL,
    [entityId] nvarchar(50) NOT NULL,
    [eventId] nvarchar(50) NULL,
    [subscriptionStartDate] datetime NOT NULL DEFAULT (getdate()),
    [subscriptionEndDate] datetime NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: Entity
DROP TABLE IF EXISTS [Entity];
GO

CREATE TABLE [Entity] (
    [entityId] nvarchar(50) NOT NULL,
    [entityFirstName] varchar(50) NOT NULL,
    [entityLastName] varchar(50) NULL,
    [entityTypeId] int NOT NULL,
    [gender] char(1) NULL,
    [birthDate] date NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: EntityCategory
DROP TABLE IF EXISTS [EntityCategory];
GO

CREATE TABLE [EntityCategory] (
    [entityCategoryId] int NOT NULL,
    [entityCategoryName] varchar(50) NOT NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: EntityTelemetry
DROP TABLE IF EXISTS [EntityTelemetry];
GO

CREATE TABLE [EntityTelemetry] (
    [entityTelemetryId] bigint NOT NULL,
    [entityId] nvarchar(50) NOT NULL,
    [entityTypeAttributeId] int NOT NULL,
    [startTimestampUTC] datetime2 NOT NULL,
    [endTimestampUTC] datetime2 NOT NULL,
    [ingestionTimestampUTC] datetime2 NULL DEFAULT (sysutcdatetime()),
    [providerEventInterpretation] nvarchar(50) NULL,
    [providerDevice] nvarchar(50) NOT NULL,
    [numericValue] float NULL,
    [latitude] float NULL,
    [longitude] float NULL,
    [stringValue] nvarchar(500) NULL
);
GO

-- Table: EntityType
DROP TABLE IF EXISTS [EntityType];
GO

CREATE TABLE [EntityType] (
    [entityTypeId] int NOT NULL,
    [entityTypeName] varchar(50) NOT NULL,
    [entityCategoryId] int NOT NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: EntityTypeAttribute
DROP TABLE IF EXISTS [EntityTypeAttribute];
GO

CREATE TABLE [EntityTypeAttribute] (
    [entityTypeAttributeId] int NOT NULL,
    [entityTypeId] int NOT NULL,
    [entityTypeAttributeCode] nvarchar(100) NOT NULL,
    [entityTypeAttributeName] varchar(200) NOT NULL,
    [entityTypeAttributeTimeAspect] nvarchar(50) NOT NULL,
    [entityTypeAttributeUnit] nvarchar(50) NOT NULL,
    [providerId] int NULL,
    [providerEventType] nvarchar(100) NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname()),
    [protocolId] int NULL,
    [defaultInGraph] char(1) NULL DEFAULT ('N')
);
GO

-- Table: EntityTypeAttributeScore
DROP TABLE IF EXISTS [EntityTypeAttributeScore];
GO

CREATE TABLE [EntityTypeAttributeScore] (
    [EntityTypeAttributeScoreId] int NOT NULL,
    [EntityTypeAttributeId] int NOT NULL,
    [STRValue] nvarchar(200) NULL,
    [MinValue] float NULL,
    [MaxValue] float NULL,
    [Score] int NOT NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: EntityTypeCriteria
DROP TABLE IF EXISTS [EntityTypeCriteria];
GO

CREATE TABLE [EntityTypeCriteria] (
    [EntityTypeCriteriaId] int NOT NULL,
    [EntityTypeId] int NOT NULL,
    [EntityTypeAttributeId] int NOT NULL,
    [STRValue] nvarchar(200) NULL,
    [MinValue] float NULL,
    [MaxValue] float NULL,
    [Score] int NOT NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: Event
DROP TABLE IF EXISTS [Event];
GO

CREATE TABLE [Event] (
    [eventId] int NOT NULL,
    [eventCode] nvarchar(50) NOT NULL,
    [eventDescription] nvarchar(200) NOT NULL,
    [entityTypeId] int NOT NULL,
    [minCumulatedScore] int NULL DEFAULT ((0)),
    [maxCumulatedScore] int NULL DEFAULT ((100)),
    [risk] nvarchar(50) NOT NULL DEFAULT ('NONE'),
    [AnalyzeFunctionId] int NULL,
    [LookbackMinutes] int NULL,
    [BaselineDays] int NULL,
    [SensitivityThreshold] float NULL,
    [MinSamplesRequired] int NULL,
    [CustomParams] nvarchar NULL,
    [AggregationType] nvarchar(50) NULL,
    [AnomalyDirection] nvarchar(20) NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] nvarchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: EventAttribute
DROP TABLE IF EXISTS [EventAttribute];
GO

CREATE TABLE [EventAttribute] (
    [eventId] int NOT NULL,
    [entityTypeAttributeId] int NOT NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] nvarchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: EventLog
DROP TABLE IF EXISTS [EventLog];
GO

CREATE TABLE [EventLog] (
    [eventLogId] bigint NOT NULL,
    [entityId] nvarchar(50) NOT NULL,
    [eventId] int NOT NULL,
    [triggeredAt] datetime NOT NULL,
    [AnalysisWindowInMin] int NULL,
    [cumulativeScore] int NOT NULL,
    [probability] decimal NULL,
    [processingTimeMs] int NULL,
    [logDate] datetime NOT NULL DEFAULT (getdate()),
    [analysisMetadata] nvarchar NULL
);
GO

-- Table: EventLogDetails
DROP TABLE IF EXISTS [EventLogDetails];
GO

CREATE TABLE [EventLogDetails] (
    [eventLogDetailsId] bigint NOT NULL,
    [eventLogId] bigint NOT NULL,
    [entityTypeAttributeId] int NULL,
    [entityTelemetryId] bigint NULL,
    [scoreContribution] int NOT NULL,
    [withinRange] char(1) NOT NULL,
    [logDate] datetime NOT NULL DEFAULT (getdate())
);
GO

-- Table: Protocol
DROP TABLE IF EXISTS [Protocol];
GO

CREATE TABLE [Protocol] (
    [protocolId] int NOT NULL,
    [protocolName] nvarchar(50) NOT NULL,
    [protocolVersion] nvarchar(20) NULL,
    [description] nvarchar(500) NULL,
    [kafkaTopic] nvarchar(100) NOT NULL,
    [entityTypeId] int NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname())
);
GO

-- Table: ProtocolAttribute
DROP TABLE IF EXISTS [ProtocolAttribute];
GO

CREATE TABLE [ProtocolAttribute] (
    [protocolAttributeId] int NOT NULL,
    [protocolId] int NOT NULL,
    [protocolAttributeCode] nvarchar(100) NOT NULL,
    [protocolAttributeName] nvarchar(255) NOT NULL,
    [description] nvarchar(500) NULL,
    [unit] nvarchar(50) NULL,
    [dataType] nvarchar(50) NOT NULL,
    [jsonPath] nvarchar(255) NULL,
    [rangeMin] decimal NULL,
    [rangeMax] decimal NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname()),
    [component] nvarchar(100) NULL
);
GO

-- Table: Provider
DROP TABLE IF EXISTS [Provider];
GO

CREATE TABLE [Provider] (
    [providerId] int NOT NULL,
    [providerName] nvarchar(100) NOT NULL,
    [providerDescription] nvarchar(500) NOT NULL,
    [providerCategory] nvarchar(50) NOT NULL,
    [apiBaseUrl] nvarchar(500) NULL,
    [apiVersion] nvarchar(20) NULL,
    [documentationUrl] nvarchar(500) NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname()),
    [TopicName] nvarchar(100) NULL,
    [BatchSize] int NOT NULL DEFAULT ((50))
);
GO

-- Table: ProviderEvent
DROP TABLE IF EXISTS [ProviderEvent];
GO

CREATE TABLE [ProviderEvent] (
    [providerEventId] int NOT NULL,
    [providerId] int NOT NULL,
    [providerEventType] nvarchar(100) NOT NULL,
    [providerEventDescription] nvarchar(500) NOT NULL,
    [providerNamespace] nvarchar(50) NOT NULL,
    [providerEventName] nvarchar(100) NOT NULL,
    [providerVersion] nvarchar(20) NOT NULL DEFAULT ('1.0'),
    [payloadSchema] nvarchar NULL,
    [requiredFields] nvarchar NULL,
    [protocolAttributeCode] nvarchar(100) NULL,
    [active] char(1) NOT NULL DEFAULT ('Y'),
    [createDate] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateTimestamp] datetime NOT NULL DEFAULT (getdate()),
    [lastUpdateUser] varchar(128) NOT NULL DEFAULT (suser_sname()),
    [ProtocolId] int NULL,
    [ProtocolAttributeId] int NULL,
    [ValueJsonPath] nvarchar NULL,
    [SampleArrayPath] nvarchar NULL,
    [CompositeValueTemplate] nvarchar NULL,
    [FieldMappingJSON] nvarchar NULL
);
GO
