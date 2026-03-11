-- Data for table: Protocol
-- Row count: 2

INSERT INTO [Protocol] ([protocolId], [protocolName], [protocolVersion], [description], [kafkaTopic], [entityTypeId], [active], [createDate], [lastUpdateTimestamp], [lastUpdateUser]) VALUES (1, 'LOINC', '2.73', 'Logical Observation Identifiers Names and Codes - Healthcare standard', 'health-vitals', NULL, 'Y', CAST('2026-02-13 16:57:19.810000' AS DATETIME2), CAST('2026-02-13 16:57:19.817000' AS DATETIME2), 'sa');
INSERT INTO [Protocol] ([protocolId], [protocolName], [protocolVersion], [description], [kafkaTopic], [entityTypeId], [active], [createDate], [lastUpdateTimestamp], [lastUpdateUser]) VALUES (3, 'SignalK', '1.7.0', 'SignalK maritime data protocol', 'boat-telemetry', NULL, 'Y', CAST('2026-02-13 16:57:19.810000' AS DATETIME2), CAST('2026-02-13 16:57:19.817000' AS DATETIME2), 'sa');
