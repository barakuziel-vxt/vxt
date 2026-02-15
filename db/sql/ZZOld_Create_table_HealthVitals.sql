drop table HealthVitals
-- יצירת הטבלה עם עמודות מחושבות דטרמיניסטיות
CREATE TABLE HealthVitals (
    HealthVitalsId INT IDENTITY(1,1) PRIMARY KEY,
    RawJson NVARCHAR(MAX) NOT NULL,
    
    -- Identity & Reference
    UserId AS CAST(JSON_VALUE(RawJson, '$.user_id') AS NVARCHAR(100)) PERSISTED,
    ReferenceId AS CAST(JSON_VALUE(RawJson, '$.reference') AS NVARCHAR(100)) PERSISTED,
    Timestamp AS CONVERT(DATETIMEOFFSET, JSON_VALUE(RawJson, '$.metadata.timestamp'), 127) PERSISTED,
    -- Time (תיקון דטרמיניסטי עם Style 127)
    StartTime AS CONVERT(DATETIMEOFFSET, JSON_VALUE(RawJson, '$.start_timestamp'), 127) PERSISTED,
    EndTime AS CONVERT(DATETIMEOFFSET, JSON_VALUE(RawJson, '$.metadata.end_timestamp'), 127) PERSISTED,

    -- Heart Rate & Variability
    AvgHR AS CAST(JSON_VALUE(RawJson, '$.data[0].heart_rate_data.summary.avg_hr_bpm') AS FLOAT) PERSISTED,
    MaxHR AS CAST(JSON_VALUE(RawJson, '$.data[0].heart_rate_data.summary.max_hr_bpm') AS FLOAT) PERSISTED,
    MinHR AS CAST(JSON_VALUE(RawJson, '$.data[0].heart_rate_data.summary.min_hr_bpm') AS FLOAT) PERSISTED,
    RestingHR AS CAST(JSON_VALUE(RawJson, '$.data[0].heart_rate_data.summary.resting_hr_bpm') AS FLOAT) PERSISTED,
    HRV_RMSSD AS CAST(JSON_VALUE(RawJson, '$.data[0].heart_rate_data.summary.hr_variability_rmssd') AS FLOAT) PERSISTED,

    -- Blood Pressure
    -- Use FLOAT for blood pressure to support fractional measurements; TRY_CAST avoids errors when value is non-numeric
    Systolic AS TRY_CAST(JSON_VALUE(RawJson, '$.data[0].blood_pressure_data.blood_pressure_samples[0].systolic_bp_mmHg') AS FLOAT) PERSISTED,
    Diastolic AS TRY_CAST(JSON_VALUE(RawJson, '$.data[0].blood_pressure_data.blood_pressure_samples[0].diastolic_bp_mmHg') AS FLOAT) PERSISTED,

    -- Blood Oxygen & Glucose
    OxygenSat AS CAST(JSON_VALUE(RawJson, '$.data[0].oxygen_data.avg_saturation_percentage') AS FLOAT) PERSISTED,
    AvgGlucose AS CAST(JSON_VALUE(RawJson, '$.data[0].glucose_data.day_avg_glucose_mg_per_dL') AS FLOAT) PERSISTED,

    -- Respiration & Temperature
    BreathsPerMin AS CAST(JSON_VALUE(RawJson, '$.data[0].respiration_data.avg_breaths_per_min') AS FLOAT) PERSISTED,
    BodyTemp AS CAST(JSON_VALUE(RawJson, '$.data[0].temperature_data.body_temperature_celsius') AS FLOAT) PERSISTED,

    -- ECG & Diagnosis
    ECGClassification AS CAST(JSON_VALUE(RawJson, '$.data[0].ecg_data[0].classification') AS NVARCHAR(100)) PERSISTED,
    AfibResult AS CAST(JSON_VALUE(RawJson, '$.data[0].ecg_data[0].afib_result') AS INT) PERSISTED,

    -- Device Info
    DeviceName AS CAST(JSON_VALUE(RawJson, '$.data[0].device_data.name') AS NVARCHAR(100)) PERSISTED,

    -- System Info
    LoadedAt DATETIME DEFAULT GETDATE()
);

---
-- יצירת אינדקסים רגילים (Non-Filtered) לביצועים מקסימליים
---

-- אינדקס משולב למשתמש וזמן (קריטי לשליפת היסטוריה רפואית)
CREATE INDEX IX_HealthVitals_UserId_StartTime ON HealthVitals (UserId, StartTime DESC);

-- אינדקס לחיפוש מהיר של הפרעות קצב (ECG)
CREATE INDEX IX_HealthVitals_ECGStatus ON HealthVitals (ECGClassification);

-- אינדקס למדידות דופק (לזיהוי מהיר של טכיקרדיה/ברדיקרדיה)
CREATE INDEX IX_HealthVitals_AvgHR ON HealthVitals (AvgHR);

-- אינדקס למדידות סוכר (רלוונטי לחולי סוכרת)
CREATE INDEX IX_HealthVitals_Glucose ON HealthVitals (AvgGlucose);

-- אינדקס למדידות לחץ דם
CREATE INDEX IX_HealthVitals_BloodPressure ON HealthVitals (Systolic, Diastolic);