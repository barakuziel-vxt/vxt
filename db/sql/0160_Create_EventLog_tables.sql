-- Create EventLog and EventLogDetails tables
-- Tracks all scored events and their details

DROP TABLE IF EXISTS dbo.EventLogDetails;
GO

DROP TABLE IF EXISTS dbo.EventLog;
GO

CREATE TABLE dbo.EventLog (
    eventLogId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    entityId NVARCHAR(50) NOT NULL,
    eventId INT NOT NULL,
    triggeredAt DATETIME NOT NULL,    -- Time of Analysis
    AnalysisWindowInMin INT NULL,     -- The range of data scanned (in minutes)
    cumulativeScore INT NOT NULL,
    probability DECIMAL(3, 2) NULL,   -- Confidence/probability score (0.00 to 1.00)
    processingTimeMs INT NULL,        -- Time taken to calculate score in milliseconds
    analysisMetadata NVARCHAR(MAX) NULL,  -- JSON metadata from Python/AI functions (null for TSQL)
    logDate DATETIME NOT NULL CONSTRAINT DF_EventLog_logDate DEFAULT (GETDATE()),
    
    -- Foreign Keys
    CONSTRAINT FK_EventLog_Entity FOREIGN KEY (entityId) REFERENCES dbo.Entity(entityId),
    CONSTRAINT FK_EventLog_Event FOREIGN KEY (eventId) REFERENCES dbo.Event(eventId)
);
GO

CREATE TABLE dbo.EventLogDetails (
    eventLogDetailsId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    eventLogId BIGINT NOT NULL,
    entityTypeAttributeId INT NULL,
    entityTelemetryId BIGINT NULL,    -- Optional - only for non-aggregated events
    scoreContribution INT NOT NULL,  -- Individual score contribution from this attribute
    withinRange CHAR(1) NOT NULL,   -- 'Y' or 'N' - was the value within the threshold?
    logDate DATETIME NOT NULL CONSTRAINT DF_EventLogDetails_logDate DEFAULT (GETDATE()),
    
    -- Foreign Keys
    CONSTRAINT FK_EventLogDetails_EventLog FOREIGN KEY (eventLogId) REFERENCES dbo.EventLog(eventLogId) ON DELETE CASCADE,
    CONSTRAINT FK_EventLogDetails_EntityTypeAttribute FOREIGN KEY (entityTypeAttributeId) REFERENCES dbo.EntityTypeAttribute(entityTypeAttributeId)
);
GO

-- Create indexes for faster queries
CREATE INDEX IX_EventLog_EntityId ON dbo.EventLog (entityId);
CREATE INDEX IX_EventLog_EventId ON dbo.EventLog (eventId);
CREATE INDEX IX_EventLog_LogDate ON dbo.EventLog (logDate);
CREATE INDEX IX_EventLog_Entity_Event_LogDate ON dbo.EventLog (entityId, eventId, logDate DESC);

CREATE INDEX IX_EventLogDetails_EventLogId ON dbo.EventLogDetails (eventLogId);
CREATE INDEX IX_EventLogDetails_EntityTypeAttributeId ON dbo.EventLogDetails (entityTypeAttributeId);
GO

