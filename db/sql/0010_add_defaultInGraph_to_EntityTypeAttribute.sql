-- Add defaultInGraph column to EntityTypeAttribute
-- Indicates whether attribute should be displayed by default in telemetry graph
-- Used for showing/hiding metrics: Health=Y, Environment/Navigation/Other=N

ALTER TABLE EntityTypeAttribute
ADD defaultInGraph CHAR(1) DEFAULT 'N';

-- Update health-related attributes to defaultInGraph = 'Y'
-- Engine attributes
UPDATE EntityTypeAttribute
SET defaultInGraph = 'Y'
WHERE entityTypeAttributeCode LIKE 'propulsion.mainEngine.%'
   OR entityTypeAttributeCode LIKE 'propulsion.engine.%';

-- Electrical/Battery attributes (health)
UPDATE EntityTypeAttribute
SET defaultInGraph = 'Y'
WHERE entityTypeAttributeCode LIKE 'electrical.batt%'
   OR entityTypeAttributeCode = 'electrical.batteries.1.voltage';

-- Navigation depth (health indicator)
UPDATE EntityTypeAttribute
SET defaultInGraph = 'Y'
WHERE entityTypeAttributeCode = 'navigation.depth';

-- Ensure location attributes are NOT in graph
UPDATE EntityTypeAttribute
SET defaultInGraph = 'N'
WHERE entityTypeAttributeCode IN ('navigation.latitude', 'navigation.longitude', 'navigation.position');

-- Environment attributes default to 'N'
UPDATE EntityTypeAttribute
SET defaultInGraph = 'N'
WHERE entityTypeAttributeCode LIKE 'environment.%';

-- Navigation non-health attributes default to 'N'
UPDATE EntityTypeAttribute
SET defaultInGraph = 'N'
WHERE entityTypeAttributeCode LIKE 'navigation.speed%'
   OR entityTypeAttributeCode LIKE 'navigation.course%'
   OR entityTypeAttributeCode LIKE 'navigation.heading%';

-- Tanks default to 'N'
UPDATE EntityTypeAttribute
SET defaultInGraph = 'N'
WHERE entityTypeAttributeCode LIKE 'tanks.%';

PRINT 'Added defaultInGraph column to EntityTypeAttribute';
PRINT 'Default values set: Health attributes = Y, Others = N';
