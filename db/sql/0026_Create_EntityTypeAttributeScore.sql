-- EntityTypeAttributeScore: scoring definitions for entity attribute scoring
-- Adds control fields and idempotent seed inserts

DROP TABLE IF EXISTS dbo.EntityTypeAttributeScore;
GO

CREATE TABLE dbo.EntityTypeAttributeScore
(
    EntityTypeAttributeScoreId INT IDENTITY(1,1) PRIMARY KEY,
    EntityTypeAttributeId INT NOT NULL,
    STRValue NVARCHAR(200) NULL,
    MinValue FLOAT NULL, 
    MaxValue FLOAT NULL,
    Score INT NOT NULL,

    -- control columns
    active CHAR(1) NOT NULL CONSTRAINT DF_EntityTypeAttributeScore_active DEFAULT ('Y'),
    createDate DATETIME NOT NULL CONSTRAINT DF_EntityTypeAttributeScore_createDate DEFAULT (GETDATE()),
    lastUpdateTimestamp DATETIME NOT NULL CONSTRAINT DF_EntityTypeAttributeScore_lastUpdateTimestamp DEFAULT (GETDATE()),
    lastUpdateUser VARCHAR(128) NOT NULL CONSTRAINT DF_EntityTypeAttributeScore_lastUpdateUser DEFAULT (SUSER_SNAME()),

    CONSTRAINT FK_EntityTypeAttributeScore_EntityTypeAttribute FOREIGN KEY (EntityTypeAttributeId) REFERENCES dbo.EntityTypeAttribute(EntityTypeAttributeId)
);
GO

-- Trigger to update timestamp and user
IF OBJECT_ID('TRG_EntityTypeAttributeScore_UpdateTimestamp','TR') IS NOT NULL
    DROP TRIGGER TRG_EntityTypeAttributeScore_UpdateTimestamp;
GO

CREATE TRIGGER TRG_EntityTypeAttributeScore_UpdateTimestamp
ON dbo.EntityTypeAttributeScore
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE eas
    SET 
        lastUpdateTimestamp = GETDATE(),
        lastUpdateUser = SUSER_SNAME()
    FROM dbo.EntityTypeAttributeScore eas
    INNER JOIN inserted i ON eas.EntityTypeAttributeScoreId = i.EntityTypeAttributeScoreId;
END;
GO

-- Idempotent seed inserts (checks existence before insert)
-- BodyTemp ranges
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5') AND MinValue = -50 AND MaxValue = 35.0)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5'),-50, 35.0, 3);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5') AND MinValue = 35.1 AND MaxValue = 36.0)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5'),35.1, 36.0, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5') AND MinValue = 36.1 AND MaxValue = 38.0)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5'),36.1, 38.0, 0);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5') AND MinValue = 38.1 AND MaxValue = 39.0)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5'),38.1, 39.0, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5') AND MinValue = 39.1 AND MaxValue = 50.0)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8310-5'),39.1, 50.0, 2);

-- Systolic ranges
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6') AND MinValue = 0 AND MaxValue = 90)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6'),0, 90, 3);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6') AND MinValue = 91 AND MaxValue = 100)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6'),91, 100, 2);
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6') AND MinValue = 101 AND MaxValue = 110)
    INSERT INTO dbo.EntityTypeAttributeScore ( EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6'),101, 110, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6') AND MinValue = 111 AND MaxValue = 219)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6'),111, 219, 0);
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6') AND MinValue = 220 AND MaxValue = 1000)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8480-6'),220, 1000, 3);

-- BreathsPerMin
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1') AND MinValue = 0 AND MaxValue = 8)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1'),0, 8, 3);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1') AND MinValue = 9 AND MaxValue = 11)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1'),9, 11, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1') AND MinValue = 12 AND MaxValue = 20)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1'),12, 20, 0);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1') AND MinValue = 21 AND MaxValue = 24)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1'),21, 24, 2);
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1') AND MinValue = 25 AND MaxValue = 100)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '9279-1'),25, 100, 3);

-- OxygenSat
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '59408-5') AND MinValue = 0 AND MaxValue = 91)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '59408-5'),0, 91, 3);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '59408-5') AND MinValue = 92 AND MaxValue = 93)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '59408-5'),92, 93, 2);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '59408-5') AND MinValue = 94 AND MaxValue = 95)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '59408-5'),94, 95, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '59408-5') AND MinValue = 96 AND MaxValue = 100)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '59408-5'),96, 100, 0);

-- AvgHR ranges
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4') AND MinValue = 0 AND MaxValue = 40)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4'),0, 40, 3);
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4') AND MinValue = 41 AND MaxValue = 50)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4'),41, 50, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4') AND MinValue = 51 AND MaxValue = 90)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4'),51, 90, 0);
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4') AND MinValue = 91 AND MaxValue = 110)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4'),91, 110, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4') AND MinValue = 111 AND MaxValue = 130)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4'),111, 130, 2);
IF NOT EXISTS (SELECT 1 FROM dbo.EntityTypeAttributeScore WHERE EntityTypeAttributeId = (SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4') AND MinValue = 131 AND MaxValue = 500)
    INSERT INTO dbo.EntityTypeAttributeScore (EntityTypeAttributeId, MinValue, MaxValue, Score)
    VALUES ((SELECT EntityTypeAttributeId FROM dbo.EntityTypeAttribute WHERE entityTypeAttributeCode = '8867-4'),131, 500, 3);

GO



