# Production Database Fix: Foreign Key Constraint Error

## Problem Summary

When attempting to invite a user from the Customer Entities page in production, the following error occurs:
```
Driver Error: Column not found; DDBC Error: [Microsoft][SQL Server]Invalid column name 'customerId'
POST /invite-bulk HTTP/1.1 500
```

## Root Cause

The migration files `0179_Alter_UserAuthorization_Customer_Entity_Model.sql` and `0180_Alter_UserAppPushNotification_Customer_Entity_Model.sql` contain incorrect foreign key references:

- **Wrong**: `REFERENCES dbo.Customer([customerId])`  
- **Correct**: `REFERENCES dbo.Customers([customerId])` (note the plural)

The production database has foreign key constraints pointing to a non-existent table `dbo.Customer`, which causes INSERT operations to fail.

Additionally, the `customerId` and `entityId` columns might be missing from some tables if migrations were not fully applied.

## Solution

A migration file has been created: **`db/sql/0181_Fix_Foreign_Key_Constraints_Customer_Table.sql`**

This migration will:
1. Add missing `customerId` and `entityId` columns to AppUser, UserAuthorization, and UserAppPushNotification tables
2. Drop incorrect foreign key constraints pointing to `dbo.Customer`
3. Create correct foreign key constraints pointing to `dbo.Customers`

## How to Apply the Fix

### Option 1: Manual SQL Execution (Recommended for immediate fix)

Connect to the production Azure SQL Server database `free-sql-db-5949639` on server `vxtdb.database.windows.net` and execute:

```sql
-- Copy and paste the contents of: db/sql/0181_Fix_Foreign_Key_Constraints_Customer_Table.sql
-- Run in SQL Server Management Studio or Azure Data Studio
```

The migration file is located at: `c:\VXT\db\sql\0181_Fix_Foreign_Key_Constraints_Customer_Table.sql`

### Option 2: Using Python Script

If you have Python and pyodbc/mssql-python installed:

```bash
cd c:\VXT
python apply_foreign_key_fix.py
```

This script will:
- Connect using the database connection from main.py
- Read and execute the migration SQL
- Report success/failure for each step

### Option 3: Azure DevOps/Deployment Pipeline

The migration file has been committed to the git repository and will be included in future deployments. However, it may not be automatically applied. Contact your DevOps team to ensure database migrations are executed as part of the deployment process.

## Verification

After applying the migration, verify the fixes were successful:

```sql
-- Check AppUser table
SELECT OBJECT_ID('dbo.AppUser') as table_id,
       (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.AppUser') AND name = 'customerId') as has_customerId;

-- Check foreign keys
SELECT name, type_desc FROM sys.foreign_keys WHERE name LIKE '%FK_AppUser_Customer%' OR name LIKE '%FK_UserAuthorization_Customer%' OR name LIKE '%FK_UserAppPushNotification_Customer%';

-- Try creating a test user (the invite should work)
```

## Files Involved

- **Migration**: `db/sql/0181_Fix_Foreign_Key_Constraints_Customer_Table.sql`
- **Backend Fix**: `main.py` (line 4652) - Fixed table name from `dbo.Customer` to `Customers`
- **Scripts**: 
  - `apply_foreign_key_fix.py` - Python script to apply migration
  - `fix_foreign_keys.sql` - Standalone SQL script
  - `fix_foreign_keys.py` - Alternative Python implementation

## Commits

- **Main code fix**: Changed `dbo.Customer` → `Customers` in `/invite-bulk` endpoint
- **Migration commit**: Added 0181 migration with column and FK fixes
- **Deployed**: Pushed to prod branch, Azure deployment triggered

## Next Steps

1. Execute the migration SQL against the production database
2. Test the invite functionality in the admin dashboard
3. Verify the POST /invite-bulk endpoint returns 200 and creates user successfully
4. Monitor logs for any remaining errors
