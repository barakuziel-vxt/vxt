DROP TABLE IF EXISTS BoatTelemetry;
-- יצירת הטבלה ללא Partitioning לצורך ה-PoC המקומי
CREATE TABLE BoatTelemetry (
    EventId BIGINT IDENTITY(1,1) PRIMARY KEY,
    BoatId NVARCHAR(50) NOT NULL,
    Timestamp DATETIME2 NOT NULL,
    RawJson NVARCHAR(MAX) NOT NULL,
    -- עמודות מחושבות PERSISTED (כדי שה-AI יוכל לקרוא מהר)
    -- הערה: יש לעדכן את ה-JSON paths בהתאם לפורמט בפועל של הנתונים
    EngineRPM AS CAST(JSON_VALUE(RawJson, '$.engine.rpm') AS FLOAT) PERSISTED,
    -- המרה מקלווין לצלזיוס
    CoolantTempC AS CAST(JSON_VALUE(RawJson, '$.engine.coolantTemp') AS FLOAT) - 273.15 PERSISTED,
    -- לחץ שמן
    OilPressurePascal AS CAST(JSON_VALUE(RawJson, '$.engine.oilPressure') AS FLOAT) PERSISTED,
    -- מתח סוללות (זיהוי בעיות טעינה/אלטרנטור)
    BatteryVoltage AS CAST(JSON_VALUE(RawJson, '$.electrical.batteryVoltage') AS FLOAT) PERSISTED,
    -- נתוני סביבה ל-Context (עומק, מהירות מעל הקרקע)
    Depth AS CAST(JSON_VALUE(RawJson, '$.navigation.depth') AS FLOAT) PERSISTED,
    SOG AS CAST(JSON_VALUE(RawJson, '$.navigation.sog') AS FLOAT) PERSISTED,
    latitude AS CAST(JSON_VALUE(RawJson, '$.navigation.latitude') AS FLOAT) PERSISTED,
    longitude AS CAST(JSON_VALUE(RawJson, '$.navigation.longitude') AS FLOAT) PERSISTED
);

-- אינדקס לחיפוש מהיר לפי זמן (במקום Partitioning כרגע)
CREATE INDEX IX_Boat_Timestamp ON BoatTelemetry (Timestamp);
-- אינדקס נוסף לחיפוש לפי BoatId
CREATE INDEX IX_BoatId ON BoatTelemetry (BoatId);

-- Add/ensure FK from BoatTelemetry.BoatId -> Properties.propertyId
IF OBJECT_ID('FK_BoatTelemetry_Properties','F') IS NOT NULL
    ALTER TABLE BoatTelemetry DROP CONSTRAINT FK_BoatTelemetry_Properties;
IF OBJECT_ID('Properties','U') IS NOT NULL
    ALTER TABLE BoatTelemetry
    ADD CONSTRAINT FK_BoatTelemetry_Properties FOREIGN KEY (BoatId) REFERENCES Properties(propertyId);
GO