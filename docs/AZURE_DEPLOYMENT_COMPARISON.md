# Azure Deployment Options Comparison for FastAPI

## Executive Summary

| Metric | Azure Functions | Azure Container Instances | Web App (Free) | Web App (Basic B1) |
|--------|---|---|---|---|
| **Minimum Cost/Month** | ~$0.20 (free tier + pay-per-use) | ~$10-20 | **$0** ✅ | ~$12-15 |
| **Cold Start Time** | 5-30 seconds | 1-2 seconds | **2-5 seconds** | 2-5 seconds |
| **Warm Response** | <100ms | <100ms | <100ms | <100ms |
| **Effort to Migrate** | ⭐⭐⭐⭐ (4/5 - High) | ⭐⭐ (2/5 - Low) | ⭐ (1/5 - Very Low) | ⭐ (1/5 - Very Low) |
| **Best For** | Sporadic traffic | Containers | Dev/learning (shared) | Production APIs |
| **Scaling** | Auto (0→many) | Manual | None (shared) | Auto (within plan) |
| **Local Dev Match** | ❌ Difficult | ✅ Easy (Docker) | ✅ Easy | ✅ Easy |
| **Suitable for 79 Endpoints** | ⚠️ Not ideal | ✅ Yes | ⚠️ Limited (shared) | ✅✅ Yes |

---

## Detailed Comparison

### 1. **Azure Functions** (Current candidate)

#### Costs
```
Consumption Plan (FREE TIER):
- Free tier: 1,000,000 requests/month + 400,000 GB-seconds/month
- After free tier: ~$0.20 per 1M executions + $0.000016 per GB-second
- Typical cost: $0-2/month for light usage

Premium Plan:
- $0.04/hour per vCPU (~$29/month minimum)
```

#### Cold Start Time
- **5-30 seconds** (Python runtime slowest)
- Reason: Runtime initialization, module loading
- Can be reduced to ~2-3 seconds with Premium plan

#### Migration Effort
**⭐⭐⭐⭐ (4/5 - High)**

What needs changing:
1. ❌ Restructure project layout (functions/ directory)
2. ❌ Wrap FastAPI with Azure ASGI handler
3. ❌ Import connection strings from environment
4. ❌ Update CORS for Azure URLs
5. ❌ Create host.json, local.settings.json
6. ⚠️ Limited debugging locally

**Estimated effort: 8-12 hours**

#### Pros
- ✅ Lowest cost for sporadic traffic
- ✅ Truly serverless (no servers to manage)
- ✅ Auto-scales to zero
- ✅ Pay only for usage

#### Cons
- ❌ Cold start problems (5-30s lag on first request)
- ❌ Not ideal for real-time APIs (79 endpoints!)
- ❌ Complex restructuring needed
- ❌ Hard to debug locally
- ❌ Premium plan removes cost advantage

---

### 2. **Azure Container Instances (ACI)**

#### Costs
```
Standard Container (1 vCPU, 1.5GB RAM):
- $0.0000231 per second
- Monthly: ~$20-25 (continuous)

With Azure Container Registry:
- Add ~$5-10/month

Total: ~$25-35/month
```

#### Cold Start Time
- **1-2 seconds** for existing container
- **30-60 seconds** cold start (pulling image from registry)

#### Migration Effort
**⭐⭐ (2/5 - Low)**

What needs changing:
1. ✅ Create Dockerfile (minimal changes to code)
2. ✅ Minor config changes (connection strings as env vars)
3. ✅ Push to Azure Container Registry
4. ✅ Deploy ACI with image

**Estimated effort: 2-4 hours**

#### Pros
- ✅ Minimal code changes (just add Dockerfile)
- ✅ Fast cold starts
- ✅ Run FastAPI as-is (no restructuring)
- ✅ Good for real-time APIs
- ✅ Easy to debug locally (docker run)

#### Cons
- ❌ Can't scale to zero (always running = always paying)
- ❌ Manual scaling needed
- ❌ No auto-scaling built-in
- ❌ Cost increases with uptime

---

### 3. **Azure App Service (Web App) - Free Tier**

#### Costs
```
Free Tier:
- $0/month (1GB RAM, shared resources, limited)
- ✅ Good for development & testing
- ⚠️ Shared: "Noisy neighbor" risk
- ⚠️ No auto-scaling
- ⚠️ Limited database connections
```

#### Cold Start Time
- **2-5 seconds** (already warm)
- Always-on when debugging

#### Migration Effort
**⭐ (1/5 - Very Low)**

#### Pros
- ✅ **Completely free** for experimentation
- ✅ Same code as Basic plan (no changes needed)
- ✅ Perfect for local→Cloud testing
- ✅ Good for learning Azure

#### Cons
- ❌ Shared resources (noisy neighbors)
- ❌ No auto-scaling
- ❌ Limited concurrent connections to DB
- ❌ SLA not guaranteed

---

### 4. **Azure App Service (Web App) - Basic B1 (RECOMMENDED)**

#### Costs
```
Basic Plan (B1: 1 vCPU, 1.75GB):
- $12-15/month
- Best for lightweight APIs

Standard Plan (S1: 1 vCPU, 1.75GB):
- ~$80-100/month
- Auto-scaling, SSL, backups
```

#### Cold Start Time
- **2-5 seconds** (already warm in Basic+)
- **15-30 seconds** if scaled to zero (not typical)

#### Migration Effort
**⭐ (1/5 - Very Low)**

What needs changing:
1. ✅ Create requirements.txt (already have it)
2. ✅ Set two environment variables (SQL_CONN_STR, FRONTEND_URL)
3. ✅ Deploy via GitHub/FTP/ZIP

**Estimated effort: 1-2 hours**

#### Pros - Basic B1 Plan
- ✅ **Easiest migration** (just deploy)
- ✅ Always-on (no cold starts)
- ✅ Great for real-time APIs
- ✅ Built-in monitoring, CI/CD
- ✅ **Dedicated resources** (not shared)
- ✅ **Auto-scaling available**
- ✅ Full database connection pool

#### Cons - Basic B1 Plan
- ❌ Costs $12-15/month minimum
- ❌ No free production option

#### Pros - Free Tier
- ✅ **Zero cost** for testing
- ✅ Same code as production
- ✅ Perfect for local→Azure testing

#### Cons - Free Tier
- ❌ Shared resources (noisy neighbors)
- ❌ No auto-scaling
- ❌ Limited concurrent DB connections
- ❌ Not suitable for production (SLA not guaranteed)

---

## Local Development Setup (Mirrors Production)

### Goal
Write code once on your laptop that works unchanged in production (Azure Web App).

### Prerequisites
```powershell
# Install these on your laptop:
- Python 3.11+
- Git
- Docker (for testing in container)
- Visual Studio Code
```

### Setup Steps

#### 1. Create `.env` file (Local configuration)

Create `c:\VXT\.env` file:
```env
# Local Development Environment
ENVIRONMENT=development
SQL_CONNECTION_STRING=DRIVER={SQL Server};SERVER=127.0.0.1;DATABASE=BoatTelemetryDB;UID=sa;PWD=YourStrongPassword123!
FRONTEND_URL=http://localhost:3000
FRONTEND_URL_ALT1=http://localhost:3001
FRONTEND_URL_ALT2=http://localhost:3002
FRONTEND_URL_ALT3=http://localhost:5173
FRONTEND_URL_LOCAL=http://127.0.0.1:3000
```

#### 2. Update `main.py` to use environment variables

**Replace hardcoded connection string:**

```python
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get configuration from environment
SQL_CONN_STR = os.getenv(
    'SQL_CONNECTION_STRING',
    'DRIVER={SQL Server};SERVER=127.0.0.1;DATABASE=BoatTelemetryDB;UID=sa;PWD=YourStrongPassword123!'
)

ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
```

#### 3. Update CORS to be dynamic

**Replace hardcoded origins:**

```python
import os

# Get CORS origins from environment or use defaults
def get_cors_origins():
    if os.getenv('ENVIRONMENT') == 'production':
        # Production: Only allow Azure Static Web Apps
        return [os.getenv('FRONTEND_URL')]
    else:
        # Development: Allow local testing
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

#### 4. Install python-dotenv

```powershell
pip install python-dotenv
```

#### 5. Run locally (mirrors production)

```powershell
# Activate venv
.\.venv\Scripts\Activate.ps1

# Run FastAPI locally
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Your laptop → `http://localhost:8000`

#### 6. Test with Docker (mirrors Azure Container)

```powershell
# Build Docker image locally
docker build -t vxt-api:latest .

# Run container locally
docker run -p 8000:8000 `
  -e SQL_CONNECTION_STRING="DRIVER={SQL Server};SERVER=host.docker.internal;..." `
  -e ENVIRONMENT=production `
  vxt-api:latest
```

---

## Environment Variable Mapping

### Local Development (Laptop)
```
ENVIRONMENT = development
SQL_CONNECTION_STRING = local SQL Server
FRONTEND_URL = http://localhost:3000
```

### Production (Azure Web App)
```
ENVIRONMENT = production
SQL_CONNECTION_STRING = vxtdb.database.windows.net (from Azure SQL)
FRONTEND_URL = https://vxt-admin-dashboard.<random>.azurestaticapps.net
```

### Web App Free Tier (Testing in Azure)
```
ENVIRONMENT = development
SQL_CONNECTION_STRING = vxtdb.database.windows.net
FRONTEND_URL = http://localhost:3000 (or your Free Web App URL)
```

---

### Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DEVELOP ON LAPTOP                                        │
│   - Create .env (local SQL, localhost:3000)                 │
│   - Code uses os.getenv() for all config                    │
│   - Run: python -m uvicorn main:app --reload               │
│   - Test: http://localhost:8000/entitycategories           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. TEST IN CONTAINER (Optional)                             │
│   - Build: docker build -t vxt-api:latest .                │
│   - Run: docker run -p 8000:8000 -e ... vxt-api            │
│   - Verifies production Docker setup                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. DEPLOY TO AZURE (Free Web App for testing)               │
│   - Push code to GitHub                                     │
│   - Set Azure environment variables (via Portal)            │
│   - GitHub Actions auto-deploys                            │
│   - Test: https://vxt-api-free.azurewebsites.net/...       │
│   - Same code, different env variables!                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. MOVE TO PRODUCTION (Basic B1)                            │
│   - No code changes needed!                                 │
│   - Create Web App Basic B1 plan                            │
│   - Update Azure environment variables                      │
│   - GitHub Actions points to prod app                       │
│   - Same code, same Azure SQL, same frontend               │
└─────────────────────────────────────────────────────────────┘
```

---

## Required Changes to `main.py` Summary

```python
# ADD AT TOP:
import os
from dotenv import load_dotenv

load_dotenv()

# REPLACE:
SQL_CONN_STR = os.getenv('SQL_CONNECTION_STRING', 'DRIVER=...')

# REPLACE CORS:
def get_cors_origins():
    if os.getenv('ENVIRONMENT') == 'production':
        return [os.getenv('FRONTEND_URL')]
    else:
        return [... existing local origins ...]

# KEEP EVERYTHING ELSE THE SAME!
```

✅ **Result:** Code works identically on laptop and Azure!

---

---

## Recommendation Matrix

### Choose **Azure Functions** IF:
- ✅ API has **sporadic, unpredictable traffic** (hours of no use)
- ✅ Cost is absolute priority
- ✅ Can tolerate 5-30 second cold starts
- ✅ **Not** a real-time API (you have 79 endpoints!)

### Choose **Azure Container Instances** IF:
- ✅ Want **minimal code changes**
- ✅ Need **fast cold starts** (1-2 seconds)
- ✅ Have **moderate, predictable traffic**
- ✅ Want to **run FastAPI exactly as-is**
- ✅ Good balance of cost & effort

### Choose **Web App Free Tier** IF:
- ✅ Want **zero cost** for testing/learning
- ✅ **Same code as production** (no code changes)
- ✅ Testing locally→Azure workflow
- ✅ Acceptable for non-production testing

### Choose **Web App Basic B1** IF:
- ✅ Want **absolute easiest deployment**
- ✅ **Always-on production API** (yours is 79 endpoints) ← **YOU**
- ✅ Need **best performance & reliability**
- ✅ Want **zero cold starts**
- ✅ Can justify $12-15/month minimum
- ✅ **BEST FOR YOUR USE CASE** ← **RECOMMENDED ✅**

---

## Cost Comparison Chart (6-month estimate)

```
Scenario: Average 10,000 requests/day (light traffic)

Azure Functions (Consumption):
- 6 months: $0-5 (mostly free tier)
- TOTAL: ~$5-10

Azure Container Instances:
- $25/month × 6 = $150
- TOTAL: ~$150

Azure Web App (Free Tier):
- $0/month × 6 = $0
- TOTAL: ~$0 ✅ (but shared resources)

Azure Web App (Basic B1):
- $12/month × 6 = $72
- TOTAL: ~$72 ✅ (BEST VALUE)

Scenario: Average 100,000 requests/day (moderate traffic)

Azure Functions (Consumption):
- 6 months: ~$15-25 (starts hitting usage)
- TOTAL: ~$90-150

Azure Container Instances:
- $25/month × 6 = $150
- TOTAL: ~$150

Azure Web App (Free Tier):
- $0/month × 6 = $0
- TOTAL: ~$0 ⚠️ (will hit resource limits)

Azure Web App (Basic B1):
- $12/month × 6 = $72
- TOTAL: ~$72 ✅ (RECOMMENDED)
```

---

## Performance Comparison (Real-time API)

| Metric | Azure Functions | ACI | Web App |
|--------|---|---|---|
| Cold Start | 5-30s ❌ | 1-2s ✅ | 2-5s ✅ |
| Warm Response | <100ms ✅ | <100ms ✅ | <100ms ✅ |
| Max Throughput | 4,000 req/s | Limited (1 container) | 50,000+ req/s |
| 99th Percentile Latency | 500ms-2s | <200ms | <200ms |
| Database Connection Pool | Limited | Full control | Full control |
| Real-time Suitability | ⭐⭐ Poor | ⭐⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent |

---

## Effort Breakdown by Deployment Type

### Azure Functions
```
1. Understand Azure Functions model         1 hour
2. Restructure project (→ functions/)       2 hours
3. Create ASGI wrapper                      2 hours
4. Update environment vars                  1 hour
5. Create host.json, local.settings.json    1 hour
6. Test locally                             2 hours
7. Deploy & troubleshoot                    3 hours
────────────────────────────────────────────────────
TOTAL: ~12 hours ⏱️
```

### Azure Container Instances
```
1. Create Dockerfile                        1 hour
2. Update requirements.txt                  30 min
3. Set environment variables                30 min
4. Test Docker build locally                1 hour
5. Push to Azure Container Registry         30 min
6. Deploy ACI                               30 min
7. Test deployed endpoint                   1 hour
────────────────────────────────────────────────────
TOTAL: ~5 hours ⏱️
```

### Azure App Service (Web App)
```
1. Create requirements.txt (if missing)     15 min
2. Set environment variables in Azure       30 min
3. Connect GitHub repo (existing)           15 min
4. Deploy (automatic)                       5 min
5. Test deployed endpoint                   30 min
────────────────────────────────────────────────────
TOTAL: ~2 hours ⏱️ (Easiest!)
```

---

## Your Specific Situation

**You have:**
- ✅ 79 HTTP endpoints (real-time API needing responsiveness)
- ✅ React admin dashboard (real-time stats needed)
- ✅ Database queries on every request
- ✅ Already have GitHub set up
- ✅ Want same code on laptop & Azure

**Assessment:**

```
🔴 Azure Functions: NOT RECOMMENDED
  - Cold starts will break real-time dashboards
  - 79 endpoints = complex restructuring
  - Too much effort (12 hours)

🟡 Azure Container Instances: POSSIBLE
  - Could work but needs manual scaling
  - If you add auto-scaling → use Web App instead

🟡 Web App (Free Tier): TEST BEFORE PRODUCTION
  - ✅ $0 cost for testing
  - ✅ Same code as production (no changes!)
  - ⚠️ Shared resources (good for dev/test)
  - ⚠️ Not production-ready

🟢 Web App (Basic B1): RECOMMENDED ✅
  - Easiest migration (1-2 hours)
  - Best for always-on APIs (yours)
  - No cold starts
  - Dedicated resources (not shared)
  - Auto-scaling available
  - Cost-effective ($12-15/month)
  - Perfect for 79 endpoints
  - Same code as Free tier (just change env vars!)
```

---

## Recommended Deployment Path

**Phase 1: Develop & Test Locally** (Your Laptop - FREE)
```
1. Create .env file with local SQL Server connection
2. Update main.py to use os.getenv() for config
3. Run: python -m uvicorn main:app --reload
4. Test all 79 endpoints locally
5. Deploy to GitHub (prod branch)
```
⏱️ Effort: 2-3 hours
💰 Cost: $0

**Phase 2: Test in Azure** (Web App Free - FREE)
```
1. Deploy to Free Web App from GitHub
2. Set Azure environment variables (Azure SQL)
3. Test endpoints in Azure
4. Same code, different config!
```
⏱️ Effort: 1 hour
💰 Cost: $0 (during testing)

**Phase 3: Production** (Web App Basic B1 - $12-15/month)
```
1. Create Web App Basic B1
2. Update GitHub Actions to deploy to prod
3. Same code, same env var setup!
4. Zero downtime migration
```
⏱️ Effort: 30 minutes
💰 Cost: $12-15/month (minimal)

---

## Migration Path Recommendation

**If you want to minimize effort immediately:**
1. Deploy to **Azure Web App** (Basic B1) → 2 hours
2. Move to Functions later if traffic proves sporadic

**If you must minimize cost now:**
1. Start with **Container Instances** → 5 hours setup
2. Add auto-scaling rules manually
3. Monitor costs

**If you want to "play around":**
1. Try **Azure Functions** on free tier
2. Accept 5-30s cold starts for now
3. Plan migration to Web App when it becomes problem

---

## Next Steps

### Immediate Action: Update Code for Environment Variables

This is required for laptop→Azure→Production workflow to work!

**Required changes in `main.py`:**
1. Import `os` and `python-dotenv`
2. Change hardcoded `SQL_CONN_STR` to use `os.getenv()`
3. Change hardcoded CORS origins to use `os.getenv('ENVIRONMENT')`

**Required files:**
1. Create `.env` file for laptop (local SQL, localhost origins)
2. Add to `.gitignore` (don't commit secrets!)

**Then choose:**

1. **Start Local Development** (Recommended)
   - I'll update main.py to use environment variables
   - Create .env file for your laptop
   - Test locally with all 79 endpoints
   - Cost: $0

2. **Jump to Web App Free** (Test in Azure)
   - Deploy to Free Web App
   - Test with Azure SQL
   - Keep same code
   - Cost: $0

3. **Go to Web App Basic** (Production Ready)
   - Create Basic B1 Web App
   - Deploy production version
   - Auto-scaling enabled
   - Cost: $12-15/month

Which would you like me to do first?
