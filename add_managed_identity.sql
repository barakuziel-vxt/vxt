-- Add the App Service Managed Identity as a SQL user
-- Principal Name: vxt-web-app
-- This allows the App Service to authenticate with Azure SQL using Managed Identity

CREATE USER [vxt-web-app] FROM EXTERNAL PROVIDER;
ALTER ROLE db_owner ADD MEMBER [vxt-web-app];
GRANT CONNECT TO [vxt-web-app];

-- Verify the user was created
SELECT * FROM sys.database_principals WHERE name = 'vxt-web-app';
