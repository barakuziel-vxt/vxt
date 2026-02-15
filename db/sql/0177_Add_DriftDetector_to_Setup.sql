-- Add DriftDetector function to AnalyzeFunction table

-- Step 1: Check if DriftDetector already exists in AnalyzeFunction table
IF NOT EXISTS (SELECT 1 FROM dbo.AnalyzeFunction WHERE FunctionName = 'DriftDetector')
BEGIN
    INSERT INTO dbo.AnalyzeFunction (FunctionName, FunctionType, AnalyzePath)
    VALUES ('DriftDetector', 'Python', 'drift_detector.detect_metric_drift');
    PRINT 'DriftDetector function added to AnalyzeFunction table';
END
ELSE
BEGIN
    PRINT 'DriftDetector function already exists in AnalyzeFunction table';
END

-- Step 2: Display the registered functions
PRINT 'Registered Analysis Functions:';
SELECT AnalyzeFunctionId, FunctionName, FunctionType, AnalyzePath, active, createDate
FROM dbo.AnalyzeFunction
ORDER BY AnalyzeFunctionId;

PRINT 'DriftDetector setup complete!';
