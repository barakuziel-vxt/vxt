# VXT Web App - Fresh Deployment from Scratch

## Architecture
- **Framework**: FastAPI (Python web framework)
- **App Server**: Uvicorn (ASGI server)
- **Database**: Azure SQL Database
- **Hosting**: Azure App Service (Linux)
- **Deployment**: File-based (Python source code + dependencies)

## Deployment Components

### 1. **requirements.txt**
Complete dependency list for the FastAPI API:
```
fastapi==0.109.0
uvicorn[standard]==0.27.0
pymssql==2.3.0
python-dotenv==1.0.0
pydantic==2.5.3
azure-identity==1.14.0
```

### 2. **web.config**
IIS configuration for Azure App Service to forward HTTP requests to Uvicorn:
```xml
<httpPlatform processPath="python.exe" arguments="-m uvicorn main:app --host 0.0.0.0 --port %HTTP_PLATFORM_PORT%" />
```

### 3. **startup.sh**
Bash startup script that:
- Prints diagnostic information
- Installs/verifies dependencies with `pip install -r requirements.txt`
- Checks that all imports work
- Starts Uvicorn: `uvicorn main:app --host 0.0.0.0 --port 8000`

### 4. **main.py**
FastAPI application with:
- Comprehensive startup logging (every initialization step)
- Exception handling with stderr/stdout flushing
- Database connection with auto-retry
- All API endpoints with error handling
- CORS middleware configured

### 5. **.github/workflows/deploy-to-azure.yml**
GitHub Actions workflow that:
- Triggers on push to `prod` branch
- Checks out code
- Sets up Python 3.11
- Installs dependencies and verifies imports
- Deploys to Azure Web App using publish profile

## Critical Azure App Service Configuration

After deploying, you MUST configure the startup command in Azure Portal:

### Option A: Using web.config (Recommended)
The `web.config` file in the root directory contains the startup configuration and should be automatically read by Azure App Service.

### Option B: Manual Configuration
If web.config doesn't work, manually set in Azure Portal:

1. Go to **Azure Portal** → **App Services** → **vxt-web-app**
2. Navigate to **Settings** → **Configuration**
3. Under **General settings**:
   - **Runtime stack**: Python 3.11
   - **Startup Command**: 
     ```
     sh startup.sh
     ```
   - OR directly:
     ```
     python -m uvicorn main:app --host 0.0.0.0 --port 8000
     ```

4. Under **Application settings**:
   - Add `ENVIRONMENT`: `azure`
   - Ensure `SQL_CONNECTION_STRING` is set with Azure SQL credentials

5. Click **Save** and the app will restart

## Deployment Flow

1. **Developer commits** to `prod` branch
2. **GitHub Actions** triggers automatically
3. **Workflow steps**:
   - Checkout code
   - Install Python 3.11
   - Install dependencies from requirements.txt
   - Run verification (all imports work)
   - Deploy files to Azure App Service
4. **Azure App Service**:
   - Receives all files
   - Reads web.config or uses startup command
   - Starts Uvicorn server
   - Routes HTTP requests to FastAPI app

## Environment Variables Required

In Azure App Service → Configuration → Application settings:

```
ENVIRONMENT=azure
SQL_CONNECTION_STRING=Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<database>;User ID=<username>;Password=<password>;TrustServerCertificate=no;Connection Timeout=30;
```

## Troubleshooting

### App fails to start (403 error)
1. Check Azure Portal → **Log Stream**
2. Look for [ERROR] messages with full traceback
3. Common issues:
   - Missing `ENVIRONMENT` variable
   - Missing `SQL_CONNECTION_STRING`
   - Database server not accessible
   - Port 8000 already in use

### Dependencies not installing
1. Verify `requirements.txt` is present in root
2. Check Python 3.11 is selected in App Service settings
3. Review **Log Stream** for pip errors

### CORS errors from admin-dashboard
Ensure `FRONTEND_URL` is set in Application Settings:
```
FRONTEND_URL=https://ambitious-sand-0b08c3f03.6.azurestaticapps.net
```

## Testing Deployment

After deployment, test endpoints:

```powershell
# Health check
curl https://vxt-web-app.azurewebsites.net/health/db

# Get entities
curl -X GET "https://vxt-web-app.azurewebsites.net/entities" \
  -H "Content-Type: application/json"
```

## File Structure
```
c:\VXT\
├── main.py              # FastAPI application
├── requirements.txt     # Python dependencies
├── web.config          # IIS/Azure App Service config
├── startup.sh          # Startup script
├── .github/
│   └── workflows/
│       └── deploy-to-azure.yml    # Deployment automation
└── ... other files
```

## Key Differences from Docker Approach

| Aspect | Docker | File-Based |
|--------|--------|-----------|
| Image Build | Required | Not needed |
| Registry | ACR | N/A |
| Startup | Dockerfile CMD | web.config + startup.sh |
| File Deploy | Manual copy | Automatic |
| Build Time | 5-10 minutes | 30 seconds |

