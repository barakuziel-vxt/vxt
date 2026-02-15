# SQL Deployment Options

## Issue
ODBC Driver 17/18 for SQL Server is not installed on your system.

## Solution Options

### Option 1: Install ODBC Driver (Recommended)

**For Windows:**

```powershell
# Using Chocolatey (if installed)
choco install msodbcsql17

# Or download and install from Microsoft
# https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

# After installation, test the connection:
.\.venv\Scripts\python.exe deploy_sql_migrations.py
```

### Option 2: Use Docker to Execute SQL

Since your SQL Server is in a Docker container, you can deploy directly:

```powershell
# Deploy using docker exec
.\deploy_with_docker.ps1
```

### Option 3: Use Python with Docker SDK

```powershell
# Install docker Python package
pip install docker

# Then run:
.\.venv\Scripts\python.exe deploy_sql_with_docker.py
```

### Option 4: Manual SQL Server Management Studio (SSMS)

1. Download SQL Server Management Studio: https://ssms.blob.core.windows.net/ssms/18.7/SSMS-18.7.exe
2. Connect to `localhost,1433` with username `sa` and password `YourStrongPassword123!`
3. Open and execute these files in order:
   - `db/sql/0160_Create_eventLog_tables.sql`
   - `db/sql/0165_Create_AnalyzeScore_function.sql`
   - `db/sql/0170_Create_ExecuteSubscriptionAnalysis_procedure.sql`

---

## How to Find Your SQL Databases

To verify your SQL Server is running and accessible:

```powershell
# Check Docker containers
docker ps

# Should show: yacht-sql (mssql-server running on port 1433)
```

## Quick Verification Query

Once connected (using any method), run this to verify the execution:

```sql
-- Check if tables were created
SELECT * FROM sys.objects WHERE name LIKE '%eventLog%'

-- Should return:
-- eventLog table
-- eventLogDetails table
```

## Need Help?

If you continue having issues:

1. **Check if SQL Server is running:**
   ```powershell
   docker ps | findstr mqtt-sql
   # or
   docker logs yacht-sql
   ```

2. **Test network connectivity:**
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 1433
   ```

3. **Check ODBC installation:**
   ```powershell
   Get-OdbcDriver | Select Name
   ```

4. **Install ODBC Driver 17 via Command Line:**
   ```powershell
   # PowerShell as Administrator
   msiexec /i msodbcsql.msi IACCEPTMSODBCSQLLICENSETERMS=YES
   ```

---

See `DEPLOYMENT_GUIDE.md` for complete setup instructions.
