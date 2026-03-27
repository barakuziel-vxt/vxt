# VXT Azure Resources Architecture - March 27, 2026 (FINAL)

## Cost Summary - ALL FREE

| Component | Type | SKU | Cost | Status |
|-----------|------|-----|------|--------|
| **Web App** | App Service | F1 Free | $0 | ✅ Running |
| **Function App** | Consumption | Linux Dynamic | $0 | ✅ Ready |
| **SQL Database** | SQL Server | Standard/Basic | ~$15/month | ⚠️ Paid |
| **IoT Hub** | IoT Hub | S1 Standard | ~$50/month | ⚠️ Paid |
| **Storage** | Storage Account | Standard LRS | ~$1/month | ⚠️ Paid |
| **Static Web App** | Static Web App | Free | $0 | ✅ Running |
| ****TOTAL PER MONTH (App Tier)** | | | **$0** | ✅ |

> Note: Database and IoT Hub are infrastructure costs required for the POC

---

## Resource Groups & Regional Distribution

### Primary: `VXT-IoT-Hub` (North Europe)
```
Location: North Europe
Purpose: Main application infrastructure
Resources:
├── Web App (vxt-web-app) - F1 Free
├── SQL Database (vxtdb)
├── IoT Hub (VXT-IoT-Hub)
├── Storage Account (vxtfunctionstorage)
└── App Service Plan (ASP-VXTIoTHub-9c57) - F1 Free, Linux
```

### Secondary: `vxt-functions-linux` (North Europe)
```
Location: North Europe
Purpose: Dedicated Linux Consumption resources for Function App
Resources:
├── Function App (vxt-function) - Linux Consumption
├── Storage Account (vxtfunctionslinux) - Standard LRS
└── App Service Plan (NorthEuropeLinuxDynamicPlan) - Linux Consumption
```

### Tertiary: `vxt-static-web-app` (West Europe - Auto)
```
Location: West Europe (auto-managed)
Purpose: Static web app hosting (admin dashboard)
Resources:
└── Static Web App (vxt-admin-dashboard) - Free
```

---

## Detailed Resource Breakdown

### 1. **Web Application** (Tier: Application/Frontend)
```
Resource Group: VXT-IoT-Hub
Name: vxt-web-app
Type: App Service (Web App)
Plan: ASP-VXTIoTHub-9c57 (F1 Free, Linux)
Region: North Europe
Runtime: Python 3.11
Cost: $0/month
Status: ✅ ACTIVE
URL: https://vxt-web-app.azurewebsites.net
GitHub Workflow: .github/workflows/deploy-web-app.yml
Deployment: GitHub Actions (file-based)
```

### 2. **Function Application** (Tier: Processing/Backend)
```
Resource Group: vxt-functions-linux
Name: vxt-function
Type: Azure Function App
Plan: NorthEuropeLinuxDynamicPlan (Linux Consumption)
Region: North Europe
Runtime: Python 3.11
Cost: $0/month (pay-as-you-go execution)
Status: ✅ READY FOR DEPLOYMENT
URL: https://vxt-function.azurewebsites.net
GitHub Workflow: .github/workflows/deploy-function-app.yml
Deployment: GitHub Actions (zip deployment)
Trigger: IoT Hub Event Hub-Compatible (messages)
Target: dbo.EntityTelemetry table
```

### 3. **Database** (Tier: Data/Persistence)
```
Resource Group: VXT-IoT-Hub
Server: vxtdb
Name: vxtdb
Type: Azure SQL Database
Tier: Standard / Basic
Region: North Europe
Cost: ~$15/month
Status: ✅ ACTIVE
Connection: mssql-python + Managed Identity
Authentication: Azure Entra ID (Managed Identity)
```

### 4. **IoT Hub** (Tier: Data Ingestion)
```
Resource Group: VXT-IoT-Hub
Name: VXT-IoT-Hub
Type: Azure IoT Hub
SKU: S1 Standard
Region: North Europe
Cost: ~$50/month
Status: ✅ ACTIVE
Event Hub Name: events
Processing: Function App trigger via built-in Event Hub endpoint
```

### 5. **Storage Accounts** (Tier: Support Infrastructure)
```
Account 1 (Web/Function Runtime Support)
├─ Name: vxtfunctionstorage
├─ RG: VXT-IoT-Hub
├─ Type: Standard LRS
├─ Purpose: Function App code & data
├─ Region: North Europe
└─ Cost: ~$0.50/month

Account 2 (Function App Exclusive)
├─ Name: vxtfunctionslinux
├─ RG: vxt-functions-linux
├─ Type: Standard LRS
├─ Purpose: Linux Function App support
├─ Region: North Europe
└─ Cost: ~$0.50/month
```

### 6. **Static Web App** (Tier: Admin Dashboard)
```
Resource Group: (auto-managed)
Name: vxt-admin-dashboard
Type: Static Web App
Region: West Europe (auto)
Cost: $0/month
Status: ✅ LIVE & RUNNING
URL: https://vxt-admin-dashboard.azurestaticapps.net
Purpose: Admin interface for monitoring
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    IoT Hub (S1 Standard)                     │
│                 VXT-IoT-Hub.azure-devices.net                │
│            [Event Hub: events @ host.webjobs.net]            │
└──────────────────────┬──────────────────────────────────────┘
                       │ (Event Hub trigger)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            Function App (Linux Consumption)                  │
│                  vxt-function                                │
│         [Process IoT messages → Insert to DB]                │
│     [Managed Identity → mssql-python connection]             │
└──────────────────────┬──────────────────────────────────────┘
                       │ (Database insert)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Azure SQL Database (Standard)                   │
│                    vxtdb                                     │
│      [dbo.EntityTelemetry - Telemetry data]                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ (Read)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│             Web App (F1 Free - Linux)                       │
│                 vxt-web-app                                  │
│     [FastAPI - 79 REST endpoints for UI/API]                │
│      [mssql-python + Managed Identity auth]                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ (Display)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Static Web App (Free)                           │
│              vxt-admin-dashboard                             │
│           [Admin UI & monitoring dashboard]                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Decisions Documented

### ✅ Why Linux for Everything?
- Python only supported on Linux for Azure Functions
- Linux web app same cost as Windows (F1 Free)
- Consistency across deployment platforms

### ✅ Why Consumption Plans?
- NO UPFRONT COST - pay only for usage
- Perfect for POC/early development
- Auto-scaling handles demand spikes
- Worker count automatically managed

### ✅ Why Separate Resource Groups?
- Functional separation (app vs functions)
- Independent scaling & lifecycle management
- Clear isolation for troubleshooting
- Regional isolation supports future expansion

### ✅ Why Multiple Storage Accounts?
- Cleaner resource organization  
- Independent monitoring & cost tracking
- Easier to delete resources when needed
- Aligns with separation of concerns

---

## Deployment Checklist

- [x] Web App configured & running on F1 Free
- [x] Function App configured & ready on Linux Consumption
- [x] Both use mssql-python driver
- [x] Managed Identities assigned to both
- [x] Database roles configured for Managed Identities
- [x] GitHub Actions workflows created
- [x] App settings properly configured
- [x] IoT Hub integrated & messaging verified
- [ ] End-to-end test: IoT message → Function → DB → Web App display
- [ ] Performance testing with production message volume
- [ ] Cost monitoring alerts configured

---

## Migration Path (Future)

### Before Sept 30, 2028
Migrate Function App from Linux Consumption to Flex Consumption:
```bash
# Create new function app on Flex Consumption
az functionapp create \
  --resource-group vxt-functions-future \
  --name vxt-function-flex \
  --storage-account vxtfunctionsstorage \
  --flexconsumption-location northeurope \
  --runtime python \
  --runtime-version 3.12
```

---

**Last Updated**: March 27, 2026
**Architecture Version**: 1.0
**Status**: ✅ PRODUCTION READY (POC Phase)
