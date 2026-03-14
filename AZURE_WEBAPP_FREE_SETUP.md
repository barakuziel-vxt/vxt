# Azure Web App Free Tier - Setup Guide (POC)

## Quick Start: Create Web App Free Tier in Azure Portal

### Step 1: Open Azure Portal
Go to: https://portal.azure.com

---

## Step 2: Create New Web App

### Navigate to App Services
1. **Click** "+ Create a resource" (top-left)
2. **Search** for "App Service"
3. **Click** "App Service" (by Microsoft)
4. **Click** "Create"

---

## Step 3: Fill in Basics Tab

| Field | Value |
|-------|-------|
| **Subscription** | Select your subscription |
| **Resource Group** | Select `vxt-resources` (or create new) |
| **Name** | `vxt-api-dev` or `vxt-api-poc` |
| **Publish** | Code |
| **Runtime stack** | Python 3.11 |
| **Operating System** | Linux |
| **Region** | North Europe (same as SQL Database) |

---

## Step 4: Select App Service Plan

### Pricing Tier
1. **Click** "App Service plan" dropdown
2. **Click** "Create new"
3. **Fill in:**
   - **Name:** `vxt-plan-free`
   - **Sku and size:** Click "Change size"
     - **Tier:** Free (F1)
     - **Size:** Free (1 GB memory, shared CPU)
   - **Click** "Apply"

✅ **Cost: $0/month** (Free tier)

---

## Step 5: Configure Monitoring (Optional)

You can skip this for POC, or enable:
- **Application Insights:** No (skip for free tier)

---

## Step 6: Click "Review + Create"

1. Review the summary
2. **Click** "Create"
3. Wait 2-3 minutes for deployment

---

## Step 7: Go to Deployed Resource

Once deployment completes:
1. **Click** "Go to resource"
2. You should see your App Service dashboard

---

## Step 8: Get Your Web App URL

On the App Service dashboard:
- **Look for** "Default domain" 
- **Example:** `https://vxt-api-poc.azurewebsites.net`
- **Copy this URL** (you'll need it later)

---

## Step 9: Configure Environment Variables

### Go to Configuration
1. Left sidebar → **Settings** → **Configuration**
2. **Click** "+ New application setting"

### Add These Environment Variables:

| Name | Value | Description |
|------|-------|---|
| `ENVIRONMENT` | `development` | Dev/test mode |
| `SQL_CONNECTION_STRING` | `DRIVER={ODBC Driver 17 for SQL Server};SERVER=vxtdb.database.windows.net;DATABASE=free-sql-db-5949639;UID=vxt;PWD=Barak1976!` | Azure SQL Database |
| `FRONTEND_URL` | `https://vxt-admin-dashboard.azurestaticapps.net` | Your Static Web Apps URL (or localhost:3000 for testing) |

**Important:** 
- Replace `PWD=Barak1976!` with your actual Azure SQL password
- Use your actual Static Web Apps URL (check Azure Portal)

### Add Each One:
1. **Name:** (from table above)
2. **Value:** (from table above)
3. **Click** "OK"
4. **Click** "Save" (top)

---

## Step 10: Deploy Your Code from GitHub

### Connect GitHub
1. Left sidebar → **Deployment** → **Deployment Center**
2. **Source:** GitHub
3. **Click** "Authorize" (authenticate with GitHub)
4. **Fill in:**
   - **Organization:** Your GitHub org (e.g., barakuziel-vxt)
   - **Repository:** vxt
   - **Branch:** `prod`
5. **Click** "Save"

✅ **GitHub Actions will auto-deploy on every push to `prod` branch!**

---

## Step 11: Verify Deployment

### Monitor Deployment
1. **Deployment Center** → Look for deployment status
2. Should see green checkmark ✅

### Test Your API
1. **Open browser:** `https://vxt-api-poc.azurewebsites.net/`
2. Should see: `{"status":"Online","message":"Boat Telemetry API is running"}`
3. **Test an endpoint:** `https://vxt-api-poc.azurewebsites.net/entitycategories`

---

## Step 12: Before Pushing Code - Update main.py

⚠️ **IMPORTANT:** Your code must use environment variables!

Create `c:\VXT\main.py` changes:

```python
# ADD AT TOP (after imports):
import os
from dotenv import load_dotenv

# Load environment variables from .env file (laptop only)
load_dotenv()

# REPLACE the hardcoded SQL_CONN_STR:
SQL_CONN_STR = os.getenv(
    'SQL_CONNECTION_STRING',
    'DRIVER={SQL Server};SERVER=127.0.0.1;DATABASE=BoatTelemetryDB;UID=sa;PWD=YourStrongPassword123!'
)

ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
```

CORS configuration - REPLACE the entire CORSMiddleware section:

```python
def get_cors_origins():
    """Get CORS origins based on environment"""
    if os.getenv('ENVIRONMENT') == 'production':
        # Production: Only allow Static Web Apps
        return [os.getenv('FRONTEND_URL', 'https://vxt-admin-dashboard.azurestaticapps.net')]
    else:
        # Development: Allow all local testing
        return [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:3002",
            "http://127.0.0.1:5173",
            "http://192.168.1.29:3000",
            "http://192.168.1.29:3001",
            "http://192.168.1.29:3002",
            "http://192.168.1.29:5173",
        ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Step 13: Create .env File for Laptop

Create `c:\VXT\.env`:

```env
# Local Development Environment
ENVIRONMENT=development
SQL_CONNECTION_STRING=DRIVER={SQL Server};SERVER=127.0.0.1;DATABASE=BoatTelemetryDB;UID=sa;PWD=YourStrongPassword123!
FRONTEND_URL=http://localhost:3000
```

**Add to `.gitignore`** (don't commit this!):
```
.env
.env.local
.env.*.local
*.pyc
__pycache__/
```

---

## Step 14: Install python-dotenv

Run in terminal:
```powershell
pip install python-dotenv
```

---

## Step 15: Test Locally First

```powershell
# Activate venv
.\.venv\Scripts\Activate.ps1

# Run locally
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Test: `http://localhost:8000/entitycategories`

---

## Step 16: Push to GitHub (Triggers Deployment)

```powershell
git add main.py .env.example requirements.txt
git commit -m "Update main.py for environment variables (POC)"
git push origin main:prod
```

✅ **GitHub Actions will automatically:**
1. Build your code
2. Install dependencies
3. Deploy to your Web App
4. Create a new deployment in Azure

---

## Step 17: Monitor the Deployment

In Azure Portal:
1. **App Service** → **Deployment Center**
2. Watch for green ✅ checkmark
3. Should see: "Active" deployment

---

## Step 18: Test Your Deployed API

Once deployment completes:

```
https://vxt-api-poc.azurewebsites.net/entitycategories
https://vxt-api-poc.azurewebsites.net/customers
https://vxt-api-poc.azurewebsites.net/entities
```

All 79 endpoints should work! 🎉

---

## Troubleshooting

### If API returns 500 error:
1. **App Service** → **Log stream** (left sidebar under Monitoring)
2. Look for error messages
3. Common issues:
   - SQL connection string wrong
   - `python-dotenv` not installed
   - Environment variables not set in Azure

### If GitHub deployment fails:
1. Check **Deployment Center** for error log
2. Usually: missing requirements.txt or syntax error in main.py
3. Fix locally, push again

---

## Next Steps After POC Works

### Then You Can:
1. ✅ Test all 79 endpoints work
2. ✅ Connect React dashboard (add to CORS)
3. ✅ Upgrade to Web App Basic B1 ($12/month) for production
4. ✅ Enable auto-scaling
5. ✅ Add monitoring & alerts

### Cost Now:
- **Free Web App:** $0/month (shared resources)
- **Azure SQL:** ~$5/month (free tier exhausted)
- **Static Web Apps:** $0 (free tier)
- **GitHub Actions:** Free tier includes deployments

**Total POC Cost: ~$5/month** 🎉

---

## Summary: What to Open in Azure Portal

```
1. Azure Portal → https://portal.azure.com
2. Create → App Service
3. Resource Group: vxt-resources
4. Name: vxt-api-poc
5. Runtime: Python 3.11
6. Region: North Europe
7. Plan: Free (F1)
8. Create & Configure → Set environment variables
9. Deployment Center → Connect GitHub (prod branch)
10. Push code main→prod
11. Visit: https://vxt-api-poc.azurewebsites.net/
```

Ready? Start here: **https://portal.azure.com**

Need help with any step? Let me know!
