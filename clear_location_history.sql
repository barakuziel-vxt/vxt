-- Clear all location history (set lat/lon to NULL)
-- This removes the incorrect Helsinki/Taiwan location data

UPDATE EntityTelemetry
SET latitude = NULL, longitude = NULL
WHERE latitude IS NOT NULL OR longitude IS NOT NULL;

PRINT 'Successfully cleared location history - set all latitude/longitude to NULL';
PRINT 'Next simulator run will generate correct Haifa port location data';
