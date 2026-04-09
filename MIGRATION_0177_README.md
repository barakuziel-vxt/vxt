# Migration 0177 - User & Device Management Tables

**Created: 2026-04-09**

## Scripts Created

All scripts have been split into individual files for flexibility:

| # | Script | Table | Purpose |
|---|--------|-------|---------|
| A | `0177_A_Create_EntityIoTDevice.sql` | EntityIoTDevice | IoT Hub device registration & twin management |
| B | `0177_B_Create_AppUser.sql` | AppUser | Firebase Auth users |
| C | `0177_C_Create_UserApplication.sql` | UserApplication | Device app registrations (FCM tokens) |
| D | `0177_D_Create_UserAuthorization.sql` | UserAuthorization | Role-based access control |
| E | `0177_E_Create_UserAppPushNotification.sql` | UserAppPushNotification | Device-specific push preferences |

**Location:** `c:\VXT\db\sql\`

## Execution Methods

### Method 1: PowerShell (Recommended)
```powershell
cd c:\VXT

# Execute all at once
powershell -NoProfile -Command {
    $scripts = @(
        'db/sql/0177_A_Create_EntityIoTDevice.sql',
        'db/sql/0177_B_Create_AppUser.sql',
        'db/sql/0177_C_Create_UserApplication.sql',
        'db/sql/0177_D_Create_UserAuthorization.sql',
        'db/sql/0177_E_Create_UserAppPushNotification.sql'
    )
    
    foreach ($script in $scripts) {
        Write-Host "Executing $script..."
        sqlcmd -S . -d vxtdb -i $script
    }
}
```

### Method 2: SQL Server Management Studio (SSMS)
1. Open SSMS
2. Connect to local SQL Server (default: `.` or `(local)`)
3. Select database `vxtdb`
4. Open each script file and execute in order (A → B → C → D → E)

### Method 3: SQLcmd (Command Line)
```cmd
cd c:\VXT

sqlcmd -S . -d vxtdb -i db/sql/0177_A_Create_EntityIoTDevice.sql
sqlcmd -S . -d vxtdb -i db/sql/0177_B_Create_AppUser.sql
sqlcmd -S . -d vxtdb -i db/sql/0177_C_Create_UserApplication.sql
sqlcmd -S . -d vxtdb -i db/sql/0177_D_Create_UserAuthorization.sql
sqlcmd -S . -d vxtdb -i db/sql/0177_E_Create_UserAppPushNotification.sql
```

### Method 4: Automated Python Execution
```powershell
cd c:\VXT
python execute_all_migrations_0177.py
```

## Verification

After executing all scripts, verify the tables were created:

```powershell
cd c:\VXT
python verify_migration_0177.py
```

Or manually verify in SSMS:
```sql
SELECT 
    TABLE_NAME,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = t.TABLE_NAME) AS ColumnCount
FROM INFORMATION_SCHEMA.TABLES t
WHERE TABLE_SCHEMA = 'dbo' 
  AND TABLE_NAME IN (
    'EntityIoTDevice',
    'AppUser',
    'UserApplication',
    'UserAuthorization',
    'UserAppPushNotification'
)
ORDER BY TABLE_NAME
```

## Table Dependencies (Execution Order)

The scripts must be executed in order A → E because of foreign key relationships:

```
A. EntityIoTDevice → Entity (FK)
B. AppUser → Customer (FK)
C. UserApplication → AppUser (FK) [requires B]
D. UserAuthorization → AppUser + CustomerSubscriptions (FK) [requires B]
E. UserAppPushNotification → UserApplication + CustomerSubscriptions (FK) [requires C & D]
```

## Troubleshooting

### Connection refused
```
Error: Cannot open database "vxtdb" requested by the login.
```
- Ensure database `vxtdb` exists
- Check SQL Server is running: `Get-Service -Name MSSQLSERVER`

### Table already exists
```
Table [dbo].[AppUser] already exists
```
- Scripts are idempotent (safe to re-run)
- Use `IF NOT EXISTS` to skip existing tables

### Foreign key constraint error
```
The INSERT, UPDATE, or DELETE statement conflicted with a FOREIGN KEY constraint.
```
- Ensure parent tables exist: Customer, Entity, CustomerSubscriptions
- Run scripts in order: A → B → C → D → E

## Rollback (Optional)

To remove all new tables:
```sql
DROP TABLE IF EXISTS [dbo].[UserAppPushNotification]
DROP TABLE IF EXISTS [dbo].[UserAuthorization]
DROP TABLE IF EXISTS [dbo].[UserApplication]
DROP TABLE IF EXISTS [dbo].[AppUser]
DROP TABLE IF EXISTS [dbo].[EntityIoTDevice]
```

## Next Steps

1. ✓ Execute all 5 scripts on local database
2. Verify all tables created
3. Create sample data INSERT scripts
4. Create stored procedures for common operations
