select * from dbo.CustomerProperties

rename the table dbo.CustomerProperties to dbo.entity, 
-- remove customerId column, 
-- rename column MMSI to entityId
-- rename column customerPropertyName to entityName
-- rename column customerPropertyTypeId to entityTypeCode

create new table CustomerSubscriptions
(
    customerSubscriptionId INT PRIMARY KEY IDENTITY(1,1),
    customerId INT NOT NULL,
    entityId INT NOT NULL,
    subscriptionStartDate DATETIME NOT NULL DEFAULT GETDATE(),
    subscriptionEndDate DATETIME NULL,
    FOREIGN KEY (customerId) REFERENCES Customers(customerId),
    FOREIGN KEY (entityId) REFERENCES


    Need to rename dbo.PropertyType to dbo.entityType
    entityType(entityTypeCode)