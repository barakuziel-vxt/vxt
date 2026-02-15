DROP TABLE IF EXISTS BoatTelemetry;
-- יצירת הטבלה ללא Partitioning לצורך ה-PoC המקומי
CREATE TABLE BoatTelemetry (
    EventId BIGINT IDENTITY(1,1) PRIMARY KEY,
    MMSI NVARCHAR(50) NOT NULL,
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
-- אינדקס נוסף לחיפוש לפי MMSI
CREATE INDEX IX_MMSI ON BoatTelemetry (MMSI);

