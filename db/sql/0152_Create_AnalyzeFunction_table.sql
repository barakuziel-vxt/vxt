-- Create AnalyzeFunction table
-- Stores configuration for analysis functions used in event processing

DROP TABLE IF EXISTS AnalyzeFunction;
GO

CREATE TABLE AnalyzeFunction (
    AnalyzeFunctionId INT NOT NULL IDENTITY(1,1),
    FunctionName NVARCHAR(256) NOT NULL,
    FunctionType NVARCHAR(128) NOT NULL,
    AnalyzePath NVARCHAR(512) NOT NULL,
    -- control columns
    active CHAR(1) NOT NULL CONSTRAINT DF_AnalyzeFunction_active DEFAULT ('Y'),
    createDate DATETIME NOT NULL CONSTRAINT DF_AnalyzeFunction_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_AnalyzeFunction_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_AnalyzeFunction_lastUpdateUser DEFAULT (SUSER_SNAME()),

    CONSTRAINT PK_AnalyzeFunction PRIMARY KEY (AnalyzeFunctionId),
    CONSTRAINT UQ_AnalyzeFunction_FunctionName UNIQUE (FunctionName)
);
GO

-- Trigger to update timestamp and user on INSERT/UPDATE
IF OBJECT_ID('TRG_AnalyzeFunction_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_AnalyzeFunction_UpdateTimestamp;
GO

CREATE TRIGGER TRG_AnalyzeFunction_UpdateTimestamp
ON AnalyzeFunction
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE af
    SET
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM AnalyzeFunction af
    INNER JOIN inserted i ON af.AnalyzeFunctionId = i.AnalyzeFunctionId;
END;
GO
