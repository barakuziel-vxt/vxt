-- Migration: Add Protocol information to N2KToSignalK Provider Events
-- Date: 2026-02-18
-- Purpose: Link N2KToSignalK provider events to SignalK protocol with appropriate attribute codes

DECLARE @providerId INT;
DECLARE @protocolId INT;

-- Get the providerId for N2KToSignalK
SELECT @providerId = providerId FROM dbo.Provider WHERE providerName = 'N2KToSignalK';
-- Get the protocolId for SignalK
SELECT @protocolId = protocolId FROM dbo.Protocol WHERE protocolName = 'SignalK';

IF @providerId IS NOT NULL AND @protocolId IS NOT NULL
BEGIN
    PRINT 'Updating N2KToSignalK provider events with SignalK protocol...';
    PRINT 'providerId: ' + CAST(@providerId AS VARCHAR(10));
    PRINT 'protocolId: ' + CAST(@protocolId AS VARCHAR(10));

    -- Update all N2KToSignalK provider events to link to SignalK protocol
    -- Use providerEventType as protocolAttributeCode (they match the SignalK standard naming)
    UPDATE dbo.ProviderEvent
    SET 
        ProtocolId = @protocolId,
        protocolAttributeCode = providerEventType
    WHERE providerId = @providerId AND ProtocolId IS NULL;

    PRINT 'Updated ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' provider events successfully';

    -- Verify the updates
    SELECT 
        providerEventId,
        providerEventType,
        protocolAttributeCode,
        ProtocolId,
        (SELECT protocolName FROM dbo.Protocol WHERE protocolId = pe.ProtocolId) AS protocol
    FROM dbo.ProviderEvent pe
    WHERE providerId = @providerId
    ORDER BY providerEventType;
END
ELSE
BEGIN
    IF @providerId IS NULL
        PRINT 'ERROR: Provider N2KToSignalK not found';
    IF @protocolId IS NULL
        PRINT 'ERROR: Protocol SignalK not found';
END;
