# Local Development Setup: ODBC Driver 17 for Microsoft SQL Server

## Goal
Configure your laptop (Windows) to use `pyodbc` with **Microsoft ODBC Driver 17 for SQL Server** for local development and testing.

## Step 1: Install ODBC Driver 17 on Windows (Your Laptop)

### Option A: Download & Install (Recommended)
1. Go to: https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-sql-server
2. Download **ODBC Driver 17 for SQL Server** (msodbcsql_17.*.msi)
3. Run the installer and follow the prompts
4. Accept the license agreement
5. Installation location: `C:\Program Files\Microsoft ODBC Driver 17 for SQL Server` (default)

### Option B: Install via PowerShell (if Windows Package Manager is available)
```powershell
winget install Microsoft.ODBCDriver17forSQLServer
```

### Option C: Install via Chocolatey
```powershell
choco install msodbcsql17
```

## Step 2: Verify Installation

Run in PowerShell:
```powershell
# List installed ODBC drivers
Get-OdbcDriver -Platform 64-bit
```

You should see: **ODBC Driver 17 for SQL Server**

## Step 3: Create a Test Script

Create `test_connection.py` in `C:\VXT`:

```python
import pyodbc

# Test connection to Azure SQL Server
server = 'vxtdb.database.windows.net,1433'
database = 'free-sql-db-5949639'
username = 'vxtadmin'
password = 'Barak1976!'

connection_string = (
    f'Driver={{ODBC Driver 17 for SQL Server}};'
    f'Server={server};'
    f'Database={database};'
    f'UID={username};'
    f'PWD={password};'
    f'Encrypt=yes;'
    f'TrustServerCertificate=no;'
    f'Connection Timeout=30;'
)

try:
    conn = pyodbc.connect(connection_string)
    print("✓ Connection successful!")
    
    # Test a simple query
    cursor = conn.cursor()
    cursor.execute("SELECT @@version")
    version = cursor.fetchone()[0]
    print(f"✓ SQL Server version: {version}")
    
    conn.close()
except Exception as e:
    print(f"✗ Connection failed: {e}")
```

## Step 4: Run the Test Script

```powershell
cd C:\VXT
python test_connection.py
```

Expected output:
```
✓ Connection successful!
✓ SQL Server version: Microsoft SQL Server 2022 (RTM-CU1) (KB5027360) - 16.0.4003.1
```

## Step 5: Run the FastAPI App Locally

```powershell
# Make sure your virtual environment is active
.\.venv\Scripts\Activate.ps1

# Set environment to development (uses local config by default)
$env:ENVIRONMENT = "development"

# Start the API
python main.py
# OR use:
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Then test the endpoint:
```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health/db' -UseBasicParsing
```

## Troubleshooting

### Error: "Can't open lib 'ODBC Driver 17 for SQL Server': file not found"
- **Cause**: ODBC Driver 17 is not installed
- **Solution**: Install it using Step 1

### Error: "Login failed for user 'vxtadmin'"
- **Cause**: Invalid credentials or user doesn't have permissions
- **Solution**: Verify credentials are correct for Azure SQL Server

### Error: "TLS version not supported"
- **Cause**: Azure SQL Server requires modern TLS
- **Solution**: Ensure Windows has latest TLS updates (Windows Update)

### Error: "Connection timeout"
- **Cause**: Network connectivity to Azure SQL Server
- **Solution**: 
  - Check internet connection
  - Verify Azure SQL Server firewall allows your IP
  - Check Azure portal SQL Database: Settings > Firewall rules

## File Changes Made

- **Dockerfile**: Removed FreeTDS, using pure Python with pyodbc
- **requirements.txt**: Added `azure-identity` for enhanced Azure support
- **main.py**: Updated to use ODBC Driver 17 connection string
- **Environment**: Set default to 'production' (Azure connection)

## Running Locally vs Production

### Local Development (Windows laptop)
```python
ENVIRONMENT = 'development'
# Uses ODBC Driver 17 for SQL Server (must be installed locally)
# Connects to localhost (or your SQL Server)
```

### Production (Azure)
```python
ENVIRONMENT = 'production'
# Uses ODBC Driver 17 for SQL Server (installed in Docker)
# Connects to vxtdb.database.windows.net (Azure SQL)
```

## Docker Container Setup

The Docker image includes `pyodbc` which will attempt to use the ODBC driver installed in the container at runtime. Since containers are typically minimal, we're relying on the system to provide the ODBC driver.

For Azure production, the container deployment handles the ODBC driver installation at build time (though this hasn't been configured yet - current deployment uses ODBC Driver 17 which must be available).

---

**Status**: ✓ Local setup guide ready
**Next**: Install ODBC Driver 17, run test_connection.py, verify connection works
