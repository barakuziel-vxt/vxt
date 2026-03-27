# Azure SQL Database User Setup for vxt-function

## Status
The function app is deployed and running, but **needs database user setup to connect**.

## Required SQL Commands

Execute these commands in **Azure SQL Database `vxtdb`** as an admin user:

```sql
CREATE USER [vxt-function] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [vxt-function];
ALTER ROLE db_datawriter ADD MEMBER [vxt-function];
```

## How to Execute

### Option 1: Azure Portal Query Editor (Easiest)
1. Go to [Azure Portal](https://portal.azure.com)
2. Search for **SQL databases**
3. Select **vxtdb**
4. Click **Query editor (preview)** in left sidebar
5. Login with your Azure admin credentials
6. Paste and execute the SQL commands above
7. Should see: "Command(s) completed successfully"

### Option 2: Azure Data Studio
1. Download [Azure Data Studio](https://learn.microsoft.com/en-us/azure-data-studio/download-azure-data-studio)
2. New Connection → Azure SQL Database
3. Server: `vxtdb.database.windows.net`
4. Use Azure AD authentication
5. Paste SQL commands and execute

### Option 3: SQL Server Management Studio
1. Open SSMS
2. Server: `vxtdb.database.windows.net,1433`
3. Database: `vxtdb`
4. Auth: Azure Active Directory - Universal (MFA support)
5. Connect and execute SQL

### Option 4: PowerShell (if SMO installed)
```powershell
$conn = New-Object System.Data.SqlClient.SqlConnection
$conn.ConnectionString = "Server=vxtdb.database.windows.net,1433;Database=vxtdb;Authentication=Active Directory Interactive;"
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = @"
CREATE USER [vxt-function] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [vxt-function];
ALTER ROLE db_datawriter ADD MEMBER [vxt-function];
"@

$cmd.ExecuteNonQuery()
$conn.Close()
Write-Host "✓ Database user created"
```

## Verification

After creating the user, verify with:

```sql
SELECT * FROM sys.database_principals WHERE name = 'vxt-function';
```

Should return one row with:
- name: `vxt-function`
- type: `E` (External provider)
- authentication_type: `2` (External)

## Why This Is Needed

- **Function App Identity**: vxt-function (Managed Identity assigned)
- **Database User**: Maps the function app to SQL permissions
- **Auth Method**: Azure AD (no passwords!) - ultra secure
- **Permissions**: Read/write to EntityTelemetry table

## After Setup

Once the database user is created:
1. Function app will automatically connect using Managed Identity
2. IoT Hub messages trigger the function
3. Function inserts telemetry into EntityTelemetry table
4. No database credentials needed anywhere

## Firewall Note

If you have firewall issues, ensure:
```powershell
# Add client firewall rule (if using local SQL tools)
az sql server firewall-rule create \
  --server vxtdb \
  --resource-group VXT-IoT-Hub \
  --name AllowClientIP \
  --start-ip-address YOUR_IP \
  --end-ip-address YOUR_IP
```

## Cost Impact
- ✅ Creating this user: FREE
- ✅ No additional charges
- ✅ Total cost remains ~$1/month (storage only)
