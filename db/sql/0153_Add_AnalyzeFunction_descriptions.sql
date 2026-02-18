-- Update existing functions with descriptions
-- Generic descriptions based on function names and types
-- ALTER TABLE AnalyzeFunction ADD functionDescription NVARCHAR(MAX) NULL;

-- AnalyzeScore: T-SQL function for calculating cumulative scores
UPDATE AnalyzeFunction 
SET functionDescription = 'T-SQL function that calculates cumulative scores based on configured threshold values and criteria. Returns numerical score representing severity and match confidence. Used for event triggering and priority ranking.'
WHERE FunctionName = 'AnalyzeScore' AND functionDescription IS NULL;

-- DriftDetector: AI-powered Python function for detecting data drift
UPDATE AnalyzeFunction 
SET functionDescription = 'AI-powered Python function that detects statistical drift in telemetry data patterns. Identifies significant changes from historical baseline behavior using machine learning anomaly detection algorithms.'
WHERE FunctionName = 'DriftDetector' AND functionDescription IS NULL;

-- MultivariateCorrectionShift: AI-powered Python function for multivariate analysis
UPDATE AnalyzeFunction 
SET functionDescription = 'AI-powered Python function that performs multivariate correlation analysis on telemetry data. Detects relationships between multiple data streams and identifies correlation shifts indicating systemic changes.'
WHERE FunctionName = 'MultivariateCorrectionShift' AND functionDescription IS NULL;
GO
