-- Migration: Create CustomerGeofenceCriteria table for customer-specific geofence definitions
-- Purpose: Store polygon/circle geofences that trigger geofence events when entity position enters/exits
-- Related: GeofenceAnalyzer function, Geofence event types, CustomerSubscriptions

CREATE TABLE dbo.CustomerGeofenceCriteria (
    customerGeofenceCriteriaId INT PRIMARY KEY IDENTITY(1,1),
    customerId INT NOT NULL,
    entityTypeAttributeId INT NOT NULL DEFAULT 1073, -- Reference to position attribute (navigation.position = ID 1073)
    geofenceName NVARCHAR(255) NOT NULL,
    geoType NVARCHAR(50) NOT NULL, -- 'Polygon', 'Circle', 'Corridor', etc.
    coordinates NVARCHAR(MAX) NOT NULL, -- JSON: {"type":"Polygon","coordinates":[[[lon,lat]...]]} or {"type":"Point","coordinates":[lon,lat],"radius":meters}
    description NVARCHAR(MAX),
    active CHAR(1) NOT NULL DEFAULT 'Y', -- 'Y' or 'N'
    createdAt DATETIME NOT NULL DEFAULT GETDATE(),
    modifiedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_CustomerGeofenceCriteria_Customer FOREIGN KEY (customerId) REFERENCES dbo.Customers(customerId),
    CONSTRAINT FK_CustomerGeofenceCriteria_Attribute FOREIGN KEY (entityTypeAttributeId) REFERENCES dbo.EntityTypeAttribute(entityTypeAttributeId)
);

-- Index for faster lookups by customer
CREATE INDEX IX_CustomerGeofenceCriteria_CustomerId ON dbo.CustomerGeofenceCriteria(customerId, active);

-- Index for geofence name search within customer
CREATE INDEX IX_CustomerGeofenceCriteria_Name ON dbo.CustomerGeofenceCriteria(customerId, geofenceName);

-- Index for attribute lookups
CREATE INDEX IX_CustomerGeofenceCriteria_Attribute ON dbo.CustomerGeofenceCriteria(entityTypeAttributeId);

-- Insert sample geofences for testing
-- Note: entityTypeAttributeId = 1073 is the Position attribute (navigation.position)
INSERT INTO dbo.CustomerGeofenceCriteria (customerId, entityTypeAttributeId, geofenceName, geoType, coordinates, description, active)
VALUES
    (
        1,
        1073,  -- Position attribute (navigation.position)
        'Harbor Restricted Zone', 
        'Polygon', 
        '{"type":"Polygon","coordinates":[[[-73.9857,40.7484],[-73.9847,40.7484],[-73.9847,40.7474],[-73.9857,40.7474],[-73.9857,40.7484]]]}', 
        'Restricted area in New York Harbor - vessels should not enter', 
        'Y'
    ),
    (
        1,
        1073,  -- Position attribute (navigation.position)
        'Storm Advisory Zone', 
        'Circle', 
        '{"type":"Point","coordinates":[-73.85,40.75],"radius":5000}', 
        '5km radius circle around potential storm area', 
        'Y'
    );

-- Verify creation
SELECT 'CustomerGeofenceCriteria table created successfully' AS Message;
SELECT COUNT(*) AS [Sample Geofences Inserted] FROM dbo.CustomerGeofenceCriteria;
