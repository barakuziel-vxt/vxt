-- Create AnalysisLog table to track analysis lifecycle per entity
-- Logs: analysis started, events found, analysis completed

DROP TABLE IF EXISTS dbo.AnalysisLog;
GO

CREATE TABLE dbo.AnalysisLog (
    analysisLogId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    entityId NVARCHAR(50) NOT NULL,
    messageType NVARCHAR(50) NOT NULL,  -- 'ANALYSIS_STARTED', 'EVENT_FOUND', 'ANALYSIS_COMPLETED'
    eventLogId BIGINT NULL,             -- Reference to EventLog (only for EVENT_FOUND)
    details NVARCHAR(500) NULL,         -- Description/notes
    analysisStartTime DATETIME NOT NULL,-- When analysis cycle started
    analysisEndTime DATETIME NULL,      -- When analysis cycle ended (only for ANALYSIS_COMPLETED)
    logDate DATETIME NOT NULL CONSTRAINT DF_AnalysisLog_logDate DEFAULT (GETDATE()),
    
    -- Foreign Keys
    CONSTRAINT FK_AnalysisLog_Entity FOREIGN KEY (entityId) REFERENCES dbo.Entity(entityId),
    CONSTRAINT FK_AnalysisLog_EventLog FOREIGN KEY (eventLogId) REFERENCES dbo.EventLog(eventLogId)
);
GO

-- Create indexes for efficient querying
CREATE INDEX IX_AnalysisLog_EntityId ON dbo.AnalysisLog (entityId);
CREATE INDEX IX_AnalysisLog_MessageType ON dbo.AnalysisLog (messageType);
CREATE INDEX IX_AnalysisLog_AnalysisStartTime ON dbo.AnalysisLog (analysisStartTime DESC);
CREATE INDEX IX_AnalysisLog_EventLogId ON dbo.AnalysisLog (eventLogId);
GO

-- API 5: Log analysis started
DROP PROCEDURE IF EXISTS dbo.sp_LogAnalysisStarted;
GO

CREATE PROCEDURE dbo.sp_LogAnalysisStarted
    @entityId NVARCHAR(50),
    @analysisStartTime DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO dbo.AnalysisLog (
        entityId,
        messageType,
        details,
        analysisStartTime
    )
    VALUES (
        @entityId,
        'ANALYSIS_STARTED',
        'Entity analysis started',
        COALESCE(@analysisStartTime, GETDATE())
    );
    
    PRINT 'Analysis started for entity: ' + @entityId;
END;
GO

-- API 6: Log event found
DROP PROCEDURE IF EXISTS dbo.sp_LogEventFound;
GO

CREATE PROCEDURE dbo.sp_LogEventFound
    @entityId NVARCHAR(50),
    @eventLogId BIGINT,
    @eventCode NVARCHAR(50),
    @score INT,
    @analysisStartTime DATETIME
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO dbo.AnalysisLog (
        entityId,
        messageType,
        eventLogId,
        details,
        analysisStartTime
    )
    VALUES (
        @entityId,
        'EVENT_FOUND',
        @eventLogId,
        'Event detected: ' + @eventCode + ' (score: ' + CAST(@score AS NVARCHAR(10)) + ')',
        @analysisStartTime
    );
    
    PRINT 'Event found for entity ' + @entityId + ': ' + @eventCode + ' (eventLogId: ' + CAST(@eventLogId AS NVARCHAR(20)) + ')';
END;
GO

-- API 7: Log analysis completed
DROP PROCEDURE IF EXISTS dbo.sp_LogAnalysisCompleted;
GO

CREATE PROCEDURE dbo.sp_LogAnalysisCompleted
    @entityId NVARCHAR(50),
    @analysisStartTime DATETIME,
    @analysisEndTime DATETIME = NULL,
    @processingTimeMs INT = NULL,
    @eventsFound INT = 0
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @EndTime DATETIME = COALESCE(@analysisEndTime, GETDATE());
    
    INSERT INTO dbo.AnalysisLog (
        entityId,
        messageType,
        details,
        analysisStartTime,
        analysisEndTime
    )
    VALUES (
        @entityId,
        'ANALYSIS_COMPLETED',
        'Analysis completed. Events found: ' + CAST(@eventsFound AS NVARCHAR(10)) + 
        ', Processing time: ' + CAST(@processingTimeMs AS NVARCHAR(10)) + 'ms',
        @analysisStartTime,
        @EndTime
    );
    
    PRINT 'Analysis completed for entity: ' + @entityId + 
          ' (duration: ' + CAST(DATEDIFF(MILLISECOND, @analysisStartTime, @EndTime) AS NVARCHAR(10)) + 'ms, events: ' + CAST(@eventsFound AS NVARCHAR(10)) + ')';
END;
GO
