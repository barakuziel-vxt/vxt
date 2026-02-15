-- Setup Multivariate Correlation Shift Detection
-- This script adds the function, event, attributes, and subscriptions
-- Monitoring Heart Rate (8867-4) and SpO2 (59408-5) correlation shifts

PRINT '=== Multivariate Correlation Shift Setup ==='

-- Step 1: Add function to AnalyzeFunction table
PRINT '[Step 1] Adding MultivariateCorrectionShift to AnalyzeFunction...'
IF NOT EXISTS (SELECT 1 FROM dbo.AnalyzeFunction WHERE FunctionName = 'MultivariateCorrectionShift')
BEGIN
    INSERT INTO dbo.AnalyzeFunction (FunctionName, FunctionType, AnalyzePath)
    VALUES ('MultivariateCorrectionShift', 'Python', 'multivariate_correlation_shift.detect_correlation_shift');
    PRINT '✓ Function added to AnalyzeFunction table';
END
ELSE
BEGIN
    PRINT '✓ Function already exists in AnalyzeFunction table';
END

-- Get the function ID for use in Event creation
DECLARE @FunctionId INT;
SELECT @FunctionId = AnalyzeFunctionId 
FROM dbo.AnalyzeFunction 
WHERE FunctionName = 'MultivariateCorrectionShift';

IF @FunctionId IS NOT NULL
    PRINT '✓ Function ID: ' + CAST(@FunctionId AS NVARCHAR(10));
ELSE
BEGIN
    RAISERROR('Failed to retrieve function ID', 16, 1);
END

-- Step 2: Get Person entity type ID
DECLARE @PersonEntityTypeId INT;
SELECT @PersonEntityTypeId = entityTypeId 
FROM dbo.EntityType 
WHERE entityTypeName = 'Person';

IF @PersonEntityTypeId IS NULL
BEGIN
    RAISERROR('EntityType "Person" not found', 16, 1);
END

PRINT '✓ Person entity type ID: ' + CAST(@PersonEntityTypeId AS NVARCHAR(10));

-- Step 3: Create the event
PRINT '[Step 2] Creating HeartRateSpO2CorrelationShift event...'
DECLARE @EventId INT;
IF NOT EXISTS (SELECT 1 FROM dbo.Event WHERE eventCode = 'HeartRateSpO2CorrelationShift')
BEGIN
    INSERT INTO dbo.Event 
    (
        eventCode, 
        eventDescription, 
        entityTypeId, 
        minCumulatedScore, 
        risk, 
        AnalyzeFunctionId,
        LookbackMinutes,           -- 24 hours for recent correlation
        BaselineDays,               -- 7 days baseline
        SensitivityThreshold,       -- Correlation shift threshold
        MinSamplesRequired,         -- Minimum samples per window
        CustomParams
    )
    VALUES
    (
        'HeartRateSpO2CorrelationShift',
        'Multivariate: Heart Rate ↔ SpO2 correlation shift detected',
        @PersonEntityTypeId,
        3,
        'MEDIUM',
        @FunctionId,
        1440,                       -- 24 hours
        7,                          -- 7 days baseline
        0.25,                       -- Correlation shift threshold (Pearson correlation coefficient change)
        10,                         -- Minimum 10 samples per window
        '{"expected_correlation": "negative", "description": "HR and SpO2 should maintain stable inverse correlation"}'
    );
    
    SELECT @EventId = eventId FROM dbo.Event WHERE eventCode = 'HeartRateSpO2CorrelationShift';
    PRINT '✓ Event created with ID: ' + CAST(@EventId AS NVARCHAR(10));
END
ELSE
BEGIN
    SELECT @EventId = eventId FROM dbo.Event WHERE eventCode = 'HeartRateSpO2CorrelationShift';
    PRINT '✓ Event already exists with ID: ' + CAST(@EventId AS NVARCHAR(10));
END

-- Step 4: Link attributes to the event
PRINT '[Step 3] Linking Heart Rate (8867-4) and SpO2 (59408-5) to event...'

DECLARE @HeartRateAttributeId INT;
DECLARE @SpO2AttributeId INT;

SELECT @HeartRateAttributeId = entityTypeAttributeId 
FROM dbo.EntityTypeAttribute 
WHERE entityTypeAttributeCode = '8867-4';

SELECT @SpO2AttributeId = entityTypeAttributeId 
FROM dbo.EntityTypeAttribute 
WHERE entityTypeAttributeCode = '59408-5';

IF @HeartRateAttributeId IS NULL
    RAISERROR('Heart Rate attribute (8867-4) not found', 16, 1);

IF @SpO2AttributeId IS NULL
    RAISERROR('SpO2 attribute (59408-5) not found', 16, 1);

PRINT '✓ Heart Rate attribute ID: ' + CAST(@HeartRateAttributeId AS NVARCHAR(10));
PRINT '✓ SpO2 attribute ID: ' + CAST(@SpO2AttributeId AS NVARCHAR(10));

-- Add Heart Rate to event
IF NOT EXISTS (
    SELECT 1 FROM dbo.EventAttribute 
    WHERE eventId = @EventId AND entityTypeAttributeId = @HeartRateAttributeId
)
BEGIN
    INSERT INTO dbo.EventAttribute (eventId, entityTypeAttributeId) 
    VALUES (@EventId, @HeartRateAttributeId);
    PRINT '✓ Heart Rate linked to event';
END
ELSE
    PRINT '✓ Heart Rate already linked to event';

-- Add SpO2 to event
IF NOT EXISTS (
    SELECT 1 FROM dbo.EventAttribute 
    WHERE eventId = @EventId AND entityTypeAttributeId = @SpO2AttributeId
)
BEGIN
    INSERT INTO dbo.EventAttribute (eventId, entityTypeAttributeId) 
    VALUES (@EventId, @SpO2AttributeId);
    PRINT '✓ SpO2 linked to event';
END
ELSE
    PRINT '✓ SpO2 already linked to event';

-- Step 5: Display final setup
PRINT '';
PRINT '[Final Setup Summary]';
PRINT '✓ Function: MultivariateCorrectionShift (ID: ' + CAST(@FunctionId AS NVARCHAR(10)) + ')';
PRINT '✓ Event: HeartRateSpO2CorrelationShift (ID: ' + CAST(@EventId AS NVARCHAR(10)) + ')';
PRINT '✓ Attributes: Heart Rate (8867-4) + SpO2 (59408-5)';
PRINT '✓ Analysis Window: 24 hours (current) | 7 days (baseline)';
PRINT '✓ Sensitivity: Correlation shift threshold 0.25 (Pearson r)';
PRINT '';
PRINT 'Multivariate Correlation Shift setup complete!';
