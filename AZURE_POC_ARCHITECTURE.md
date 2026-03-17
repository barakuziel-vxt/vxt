# VXT Platform - Azure POC Architecture & Deployment Strategy

**Document Purpose:** Architecture overview for Azure support quota request (Function App + Web App)  
**Date:** March 2026  
**Phase:** Proof of Concept (POC)  
**Status:** Testing both deployment options to determine production path

---

## Executive Summary

VXT is a **real-time maritime telemetry and analytics platform** currently in POC phase. We are evaluating multiple Azure deployment options to find the optimal balance between cost, performance, and scalability for production deployment.

**Quota Request:** We need approval for BOTH:
1. **Function App - Consumption Plan (Y1)** - North Europe
2. **Web App - Free Tier (F1)** - North Europe

This dual approach allows us to validate containerized deployment and compare performance characteristics before committing to production.

---

## Current System Architecture

### Frontend (Production Ready ✅)
```
West Europe
├─ Azure Static Web Apps (vxt-admin-dashboard)
│  ├─ React admin dashboard
│  ├─ Real-time status monitoring
│  └─ Plan: Free tier (no cost)
└─ Status: Deployed and running
```

### Backend Infrastructure (Existing ✅)
```
North Europe
├─ Azure SQL Database (vxtdb.database.windows.net)
│  └─ BoatTelemetryDB - Contains telemetry data
│
├─ Storage Account (vxtstorage)
│  └─ Kafka event logs & analytics storage
│
├─ Azure IoT Hub (vxt-iot-hub)
│  └─ Device telemetry ingestion
│
└─ Status: All deployed and operational
```

### API Layer (Current Dev Status: Docker Container Ready)
```
Current: Running locally on laptop
├─ FastAPI application (Python 3.11)
├─ 79 HTTP endpoints (CRUD operations)
├─ pyodbc connection to Azure SQL
└─ Docker containerized (multi-stage, optimized)

To Deploy: Need quota approval for Azure service
```

---

## API Endpoints Summary

| Category | Endpoint Count | Examples |
|----------|---|---|
| Telemetry | 8 | GET /telemetry, POST /telemetry/{MMSI} |
| Entity Management | 20+ | GET/POST /entities, /entity-categories |
| Subscriptions | 5 | GET /subscriptions, POST /subscription |
| Geofence | 5 | GET /geofence, POST /geofence-event |
| Health Checks | 2 | GET /, GET /health |
| **TOTAL** | **~79** | **Real-time queries on SQL data** |

**Key Characteristic:** Real-time, query-heavy workload - not ideal for cold starts

---

## Proposed Deployment Options (POC Testing)

### Option A: Azure Functions - Consumption Plan (Y1)

**Configuration:**
- SKU: **Consumption Plan (Y1)**
- Region: **North Europe**
- Deployment Type: **Non-zone-redundant**
- Instances: **1**
- Cost: **$0/month** (free tier)

**Rationale:**
- Truly serverless, auto-scales to zero
- Free tier: 1M requests/month + 400K GB-seconds
- Good for understanding Azure Functions behavior
- Lowest cost option

**Characteristics:**
- Cold start: 5-30 seconds (Python runtime)
- Warm response: <100ms
- Suitable for sporadic traffic patterns
- Complex migration needed (restructure code)

**Status:** ⏳ Requesting quota approval

---

### Option B: Azure Web App - Free Tier (F1)

**Configuration:**
- SKU: **Free Tier (F1)**
- Region: **North Europe**
- Deployment Type: **Non-zone-redundant**
- Plan: **Shared resources**
- Cost: **$0/month**

**Rationale:**
- No cold starts (always warm)
- Better suited for 79 real-time endpoints
- Same code as production (just different env vars)
- Minimal migration effort (already containerized)

**Characteristics:**
- Cold start: 0 seconds (container always ready)
- Warm response: <100ms
- Suitable for continuous API traffic
- Docker container deployment (tested locally)

**Status:** ⏳ Web App created, requesting quota for container deployment

---

## Deployment Architecture (Target)

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND TIER                        │
├─────────────────────────────────────────────────────────┤
│  West Europe: Azure Static Web Apps                    │
│  ├─ vxt-admin-dashboard (React SPA)                    │
│  └─ Free tier (no cost) ✅ DEPLOYED                    │
└──────────────┬──────────────────────────────────────────┘
               │ HTTPS API Calls
               ↓
┌──────────────────────────────────────────────────────────┐
│                    API TIER (POC)                        │
├──────────────────────────────────────────────────────────┤
│  North Europe: [Choose ONE for POC]                     │
│                                                          │
│  Option A: Function App (Y1 Consumption)                │
│  ├─ Docker container (Python 3.11)                      │
│  ├─ 79 FastAPI endpoints                                │
│  ├─ Cold start: 5-30s                                   │
│  └─ Cost: Free tier (1M req/month)                      │
│                                                          │
│  Option B: Web App (F1 Free)                            │
│  ├─ Docker container (Python 3.11)                      │
│  ├─ 79 FastAPI endpoints                                │
│  ├─ Cold start: 0s (always warm)                        │
│  └─ Cost: Free tier ($0/month)                          │
│                                                          │
│  Status: Quota approval pending                         │
└──────────────┬──────────────────────────────────────────┘
               │ SQL Queries
               ↓
┌──────────────────────────────────────────────────────────┐
│                 DATA TIER (EXISTING)                     │
├──────────────────────────────────────────────────────────┤
│  North Europe: Backend Infrastructure                   │
│  ├─ Azure SQL Database ✅                               │
│  ├─ Storage Account ✅                                  │
│  └─ Azure IoT Hub ✅                                    │
└──────────────────────────────────────────────────────────┘
```

---

## Deployment Process

### Phase 1: Docker Container Build (LOCAL - COMPLETE ✅)
```
Laptop (Docker Desktop)
├─ Refactor main.py ✅ (environment variables)
├─ Create Dockerfile ✅ (multi-stage, optimized)
├─ Create .env ✅ (local SQL Server connection)
├─ docker build -t vxt-api:latest . ✅
├─ docker run (local testing) ✅
└─ Verified: Container works perfectly with local SQL
```

### Phase 2: Push to Azure Container Registry (TOMORROW)
```
Azure Portal
├─ Create Container Registry (if not exists)
├─ docker tag vxt-api:latest <registry>.azurecr.io/vxt-api:latest
├─ docker push (authenticate & upload)
└─ Status: Ready after quota approval
```

### Phase 3: Deploy to Azure Service (AFTER QUOTA)
```
Option A: Function App
├─ Link Container Registry to Functions
├─ Configure environment variables
├─ Monitor cold start behavior
└─ Test all 79 endpoints

Option B: Web App
├─ Link Container Registry to App Service
├─ Configure environment variables
├─ Monitor response times
└─ Test all 79 endpoints
```

---

## Environment Configuration

### Local Development (.env - Laptop)
```
ENVIRONMENT=development
SQL_CONNECTION_STRING=DRIVER={SQL Server};SERVER=127.0.0.1;DATABASE=BoatTelemetryDB;...
FRONTEND_URL=http://localhost:3000
```

### Azure Deployment (Portal Configuration)
```
ENVIRONMENT=production
SQL_CONNECTION_STRING=DRIVER={ODBC Driver 17 for SQL Server};SERVER=vxtdb.database.windows.net;DATABASE=BoatTelemetryDB;UID=vxt;PWD=Barak1976!;...
FRONTEND_URL=https://vxt-admin-dashboard.XXXXX.azurestaticapps.net
```

**Key Point:** Same Docker image, different environment variables = works everywhere

---

## Why Dual Quota Request?

| Criterion | Function App (Y1) | Web App (F1) | Decision |
|---|---|---|---|
| **Cost** | $0 (free tier) | $0 (free tier) | Tie ✅ |
| **Setup Effort** | 8-12 hours | 1-2 hours | Web App wins |
| **Cold Starts** | 5-30s ❌ | 0s ✅ | Web App wins |
| **Real-time Suitability** | Poor (cold starts) | Excellent | Web App wins |
| **79 Endpoints** | Difficult to manage | Natural fit | Web App wins |
| **Production Ready** | Requires rework | Ready now | Web App wins |

**Recommendation:** Web App F1 is better for production, but we're testing Function App to understand Azure serverless options and potentially optimize for future sporadic workloads.

---

## Quota Request Details

### Subscription Details
- **Subscription ID:** 0d48ff3b-92f5-4d0e-b5d0-73a5e9ffebbb
- **Region:** North Europe (co-located with existing SQL Database)
- **Phase:** Proof of Concept (POC)
- **Timeline:** Deploy this week, validate next week, production plan by month-end

### For Function App (Y1)
```
Service: Azure Functions
Plan: Consumption (Y1)
Region: North Europe
Deployment Type: Non-zone-redundant
Instances Needed: 1
Current Limit: 0
Requested Increase: 1
Use Case: POC testing for serverless option evaluation
```

### For Web App (F1)
```
Service: App Service Plans
SKU: Free (F1)
Region: North Europe
Deployment Type: Non-zone-redundant
Instances Needed: 1
Current Limit: 0 (assumed)
Requested Increase: 1
Use Case: POC testing for containerized API deployment
```

---

## Technical Requirements

### Docker Container Specifications
- **Base Image:** Python 3.11-slim (Linux)
- **Size:** ~300MB (optimized multi-stage build)
- **SQL Driver:** ODBC Driver 17 for SQL Server
- **Port:** 8000 (standard FastAPI)
- **Health Check:** HTTP GET / (should return 200)

### Runtime Requirements
- **Memory:** 512MB minimum (F1/Y1 allocated: 1GB)
- **Storage:** 1GB (container image + logs)
- **Outbound:** HTTPS (port 443) to SQL Database
- **Inbound:** HTTPS (port 443) from React dashboard

### Connectivity
- All services in **North Europe** (same data center)
- Internal Azure networking (no egress charges)
- Direct SQL connection via ODBC driver

---

## Success Criteria for POC

| Criterion | Target | Status |
|---|---|---|
| Local Docker test | ✅ All endpoints work | **COMPLETE** |
| Azure SQL connectivity | ✅ Queries execute | **COMPLETE** |
| Container image builds | ✅ Multi-stage optimized | **COMPLETE** |
| Environment variable handling | ✅ Dev & production | **COMPLETE** |
| Quota approval | ⏳ Pending | **IN PROGRESS** |
| Function App deployment | ⏳ After quota | **PLANNED** |
| Web App deployment | ⏳ After quota | **PLANNED** |
| Performance comparison | ⏳ After deployment | **PLANNED** |
| Production recommendation | ⏳ End of POC | **PLANNED** |

---

## Cost Analysis (POC Phase)

### Current State (No Deployment)
```
Frontend: $0 (Static Web Apps Free)
Backend: $0 (SQL/Storage/IoT already exist)
API: $0 (running on laptop)
─────────────────────
TOTAL: $0/month ✅
```

### After POC Deployment (Functions Y1)
```
Frontend: $0 (Static Web Apps Free)
Backend: $0 (existing services)
API: $0 (Functions Y1 free tier = 1M requests/month)
─────────────────────
TOTAL: $0/month ✅
```

### After POC Deployment (Web App F1)
```
Frontend: $0 (Static Web Apps Free)
Backend: $0 (existing services)
API: $0 (Web App F1 free tier)
─────────────────────
TOTAL: $0/month ✅
```

### Future Production (Web App B1 - estimated)
```
Frontend: $0 (Static Web Apps Free)
Backend: ~$50 (SQL Standard + Storage)
API: $12-15 (Web App B1 - dedicated resources)
─────────────────────
TOTAL: ~$62-65/month (when ready for production)
```

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| **Cold starts break dashboard** | Web App F1 removes this risk (0s startup) |
| **Quota approval delays** | Both options free tier - low impact |
| **SQL connectivity issues** | Already tested locally with same connection string |
| **Container image too large** | Multi-stage build optimizes to ~300MB |
| **Environment variable misconfig** | Documented in code, tested locally |

---

## Timeline

```
Today (Mar 15):
├─ ✅ Code refactoring complete (environment variables)
├─ ✅ Docker container tested locally
├─ ✅ Quota request submitted for both services
└─ 📋 Architecture document ready

Tomorrow (Mar 16):
├─ Push to Azure Container Registry
├─ Configure environment variables in Portal
└─ Deploy to both Function App + Web App (after quota approval)

Week of Mar 18:
├─ Performance benchmark (Function App vs Web App)
├─ Real-world load testing
└─ Production recommendation

By Mar 30:
├─ POC validation complete
├─ Migration plan to production
└─ Cost-benefit analysis
```

---

## Questions for Azure Support

**When responding to the quota request, please confirm:**

1. ✅ Consumption Plan (Y1) quota for Functions - correct
2. ✅ Free Tier (F1) quota for Web App - need confirmation
3. ✅ Non-zone-redundant deployment sufficient for POC - correct
4. ✅ Both in North Europe - correct
5. Need: Estimated approval timeline
6. Need: Any alternative if North Europe unavailable

---

## Contact & Project Details

**Project:** VXT Platform (maritime telemetry & analytics)  
**Organization:** VXT (POC stage)  
**Tech Stack:** Python FastAPI, React, Azure SQL, Docker  
**Endpoints:** 79 REST API endpoints  
**Current Users:** Internal testing only  

---

## Additional Resources

- **Code Repository:** GitHub barakuziel-vxt/vxt (private)
- **Dashboard:** vxt-admin-dashboard (Azure Static Web Apps)
- **API Docs:** {api-url}/docs (FastAPI Swagger)
- **Container:** vxt-api:latest (locally verified, ready to push)

---

**Document Version:** 1.0  
**Last Updated:** March 15, 2026  
**Status:** Ready for Azure Support Submission
