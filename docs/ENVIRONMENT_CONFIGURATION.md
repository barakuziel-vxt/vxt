# Environment Configuration Guide

## Overview
This project uses environment-specific configuration for database connections:
- **Development** (Local): `.env.local` - for local testing and start_all.ps1
- **Production** (Azure): Environment variables set in Azure App Settings

## Local Setup (Development)

### Prerequisites
Before running `start_all.ps1`, you need:

1. **SQL Server ODBC Driver 17** (Required)
   ```powershell
   # Check if driver is installed:
   reg query "HKLM\Software\ODBC\ODBCINST.INI\ODBC Driver 17 for SQL Server"
   ```
   
   **If not installed:**
   - Download: https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
   - Run the installer
   - Restart your machine after installation

2. **Docker Desktop** (for SQL Server container)
   - Running `docker-compose up -d` starts the SQL Edge database on localhost:1433

3. **Python virtual environment**
   - `.\.venv\Scripts\Activate.ps1` should be available

### Running Local Services

```powershell
# 1. Load the Python venv
.\.venv\Scripts\Activate.ps1

# 2. Run the startup script
.\start_all.ps1

# This will:
# - Start Docker containers (SQL Edge, Redpanda)
# - Start Python backend services
# - Start React admin dashboard on http://localhost:3002
```

### Troubleshooting ODBC Driver Issues

**Error: "No compatible ODBC driver found"**

Option 1: Install ODBC Driver 17 (Recommended)
```powershell
# After installation, verify:
sqlcmd -S localhost -U sa -P "YourStrongPassword123!"
```

Option 2: Try Legacy Driver
Edit `.env.local` and change:
```
# FROM:
SQL_CONNECTION_STRING=DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost,1433;...

# TO:
SQL_CONNECTION_STRING=DRIVER={SQL Server};SERVER=localhost;...
```

Option 3: Use pyodbc with TDS instead of ODBC (Advanced)
```python
import pyodbc
conn = pyodbc.connect(
    f'DRIVER={{ODBC Driver 17 for SQL Server}};'
    f'SERVER=localhost,1433;'
    f'DATABASE=BoatTelemetryDB;'
    f'UID=sa;'
    f'PWD=YourStrongPassword123!'
)
```

## Azure Deployment (Production)

### Environment Variables Set in Azure

```
ENVIRONMENT=production
SQL_CONNECTION_STRING=Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net;Database=free-sql-db-5949639;UID=vxtadmin;PWD=Barak1976!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;
```

These are configured in:
- **Resource**: vxt-web-app (App Service)
- **Setting**: Configuration > Application Settings
- Automatically loaded by the Docker container at runtime

### Verifying Azure Deployment

```powershell
# Test backend
(Invoke-WebRequest -Uri "https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net/" -UseBasicParsing).StatusCode

# Test static web app
(Invoke-WebRequest -Uri "https://ambitious-sand-0b08c3f03.6.azurestaticapps.net/" -UseBasicParsing).StatusCode
```

## Port Mapping

| Service | Local | Azure |
|---------|-------|-------|
| SQL Server | localhost:1433 | vxtdb.database.windows.net:1433 |
| FastAPI | localhost:8000 | vxt-web-app.azurewebsites.net |
| Admin Dashboard | localhost:3002 | ambitious-sand-0b08c3f03.6.azurestaticapps.net |
| Redpanda | localhost:9092 | N/A (local only) |

## Connection String Format

### Local Development
```
DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost,1433;DATABASE=BoatTelemetryDB;UID=sa;PWD=YourStrongPassword123!
```

### Azure Production
```
Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net;Database=free-sql-db-5949639;UID=vxtadmin;PWD=Barak1976!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;
```

## File Location Reference

- `.env.local` - Local development (git-ignored)
- `.env.azure` - Azure reference config (git-ignored)
- `main.py` - Loads environment variables using `python-dotenv`
- `docker-compose.yml` - SQL Server on port 1433

## Authentication Credentials

| Service | User | Password | Scope |
|---------|------|----------|-------|
| Local SQL Server | sa | YourStrongPassword123! | localhost:1433 |
| Azure SQL Server | vxtadmin | Barak1976! | vxtdb.database.windows.net |
| Docker Hub | barakdoc | Barak1976! | Container registry |

