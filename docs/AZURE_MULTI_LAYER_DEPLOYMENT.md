# Azure Multi-Layer Deployment Architecture - Complete Guide

## 📋 Overview

This guide walks you through deploying the YachtSense AI system to Azure with three layers:
1. **Database Layer** (Azure SQL Database) ✅ Ready
2. **Backend API Layer** (Azure Functions with HTTP Triggers)
3. **Frontend Application Layer** (Azure App Service or Static Web App)

---

## 🏗️ Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    INTERNET / USERS                           │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ↓ HTTP/HTTPS
┌──────────────────────────────────────────────────────────────┐
│         FRONTEND LAYER - Azure App Service                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ React Admin Dashboard (admin-dashboard)                │  │
│  │ • CustomerEntitiesPage.jsx                             │  │
│  │ • IoT Device ID form field & table column              │  │
│  │ • 🚀 SYNC to Device button                             │  │
│  │                                                        │  │
│  │ Served from:                                           │  │
│  │ • Custom Domain: dashboard.yachtsense.ai              │  │
│  │ • HTTPS enabled (Free SSL)                             │  │
│  │ • Responsive & optimized                               │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────────────────┘
                   │ CORS Enabled
                   ↓ REST API Calls
┌──────────────────────────────────────────────────────────────┐
│         API LAYER - Azure Functions (HTTP Trigger)           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Endpoints:                                             │  │
│  │ • GET /api/customerentities                            │  │
│  │ • GET /api/customerentities/{id}                       │  │
│  │ • POST /api/customerentities/{id}/sync-setup ⭐        │  │
│  │ • PUT /api/customerentities/{id}                       │  │
│  │ • DELETE /api/customerentities/{id}                    │  │
│  │                                                        │  │
│  │ Azure Function Runtime: Python 3.11                    │  │
│  │ Consumption Plan (Pay-per-use, FREE tier)              │  │
│  │                                                        │  │
│  │ Triggers:                                              │  │
│  │ • HTTP Requests from Frontend                          │  │
│  │ • Timer-based workers (future)                         │  │
│  │ • Event-based (Azure Storage, Service Bus)             │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────────────────┘
                   │ Parameterized Queries
                   ↓ Connection String
┌──────────────────────────────────────────────────────────────┐
│         DATA LAYER - Azure SQL Database                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Database: free-sql-db-5949639                          │  │
│  │ Server: vxtdb.database.windows.net                     │  │
│  │                                                        │  │
│  │ Tables:                                                │  │
│  │ • CustomerEntities (with iotDeviceId column) ✅        │  │
│  │ • EntityTelemetry                                      │  │
│  │ • DeviceSettings                                       │  │
│  │ • ...other tables                                      │  │
│  │                                                        │  │
│  │ Authentication: SQL Auth (vxt user)                    │  │
│  │ Encryption: TLS 1.2+                                   │  │
│  │ Firewall: Azure Services allowed                       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 Deployment Phases

### Phase 1: Database ✅ COMPLETE
- ✅ Azure SQL Database created (vxtdb.database.windows.net)
- ✅ CustomerEntities table schema updated
- ✅ Device ID field populated with 5 mappings
- **Status**: Ready for queries

**Connection String**:
```
Server=tcp:vxtdb.database.windows.net,1433;Initial Catalog=free-sql-db-5949639;Persist Security Info=False;User ID=vxt;Password=Barak1976!;Encrypt=True;Connection Timeout=30;
```

---

### Phase 2: Backend API Layer ⏳ PENDING

**What to Deploy**:
- Azure Function App (Consumption Plan - FREE tier)
- HTTP-triggered functions (Python)
- Connection string to Azure SQL
- CORS configuration for frontend access
- Environment variables for production

**Key Functions**:
```
1. HttpTriggerGetEntities
   - GET /api/customerentities
   - Returns: All entities with iotDeviceId

2. HttpTriggerGetEntity
   - GET /api/customerentities/{id}
   - Returns: Single entity details

3. HttpTriggerSyncSetup ⭐ (NEW)
   - POST /api/customerentities/{id}/sync-setup
   - Action: Push setup to Device Twin
   - Returns: Sync status

4. HttpTriggerCreateEntity
   - POST /api/customerentities
   - Creates: New entity with optional device ID

5. HttpTriggerUpdateEntity
   - PUT /api/customerentities/{id}
   - Updates: Entity and device ID
```

**Azure Resources Needed**:
- ✅ Resource Group (vxt-resource-group)
- ⏳ Storage Account (for function runtime and logs)
- ⏳ Function App (Consumption plan)
- ⏳ Application Insights (for monitoring)
- ⏳ Key Vault (optional - for sensitive credentials)

---

### Phase 3: Frontend Application Layer ⏳ PENDING

**What to Deploy**:
- React Admin Dashboard (built version)
- Azure App Service (Free tier)
- Custom domain (optional)
- HTTPS/SSL (free with App Service)
- Environment variables for API endpoint

**Build & Deploy Steps**:
1. Build React app: `npm run build` → produces `/dist` folder
2. Create App Service Plan (Free tier - B1)
3. Create App Service instance
4. Deploy built files to App Service
5. Configure API endpoint environment variable
6. Configure CORS headers

**Azure Resources Needed**:
- ✅ Resource Group (shared with API)
- ⏳ App Service Plan (Free tier)
- ⏳ App Service (for React app)
- ⏳ Application Insights (optional - for monitoring)

---

## 📦 Complete Resource List

### Azure Resources to Create

| Resource | Name | Tier | Purpose | Est. Cost |
|----------|------|------|---------|-----------|
| Resource Group | vxt-resource-group | N/A | Container for resources | Free |
| Storage Account | vxtstorage | Standard LRS | Function runtime & logs | ~$1-2/month |
| Function App | vxt-api-functions | Consumption | API endpoints | FREE (1M free calls/month) |
| App Service Plan | vxt-app-plan | Free (B1 optional) | Host React dashboard | FREE |
| App Service | vxt-admin-dashboard | Free/B1 | Serve React app | FREE or ~$7/month |
| Application Insights | vxt-insights | Standard | Monitoring (optional) | FREE for basic |
| SQL Database | (already exists) | (already exists) | Data storage | FREE tier |
| **TOTAL MONTHLY** | | | | **~$10-12** |

---

## 🚀 Deployment Sequence

### Step 1: Create Resource Group (Azure Portal)
```
Name: vxt-resource-group
Region: East US
```

### Step 2: Deploy Backend API Layer
See: `AZURE_API_FUNCTION_SETUP.md`

Steps:
1. Create Storage Account
2. Create Function App
3. Configure Python runtime
4. Deploy API Functions
5. Set Environment Variables
6. Configure CORS
7. Test endpoints

### Step 3: Deploy Frontend Layer
See: `AZURE_FRONTEND_DEPLOYMENT.md`

Steps:
1. Build React app locally
2. Create App Service Plan
3. Create App Service
4. Deploy built files
5. Configure API endpoint
6. Test dashboard

---

## 🔐 Security Considerations

### Database Security ✅
- ✅ TLS encryption for connection
- ✅ SQL Server authentication (username/password)
- ✅ Firewall rule: "Allow Azure services"
- ⏳ Optional: Add IP whitelist for known locations
- ⏳ Optional: Move to Azure AD authentication

### API Security ⏳
- ⏳ CORS: Only allow dashboard origin
- ⏳ Rate limiting on sync endpoints
- ⏳ API Key authentication (optional)
- ⏳ Environment variables for credentials
- ⏳ Application Insights monitoring

### Frontend Security ⏳
- ⏳ HTTPS only (automatic with App Service)
- ⏳ Security headers
- ⏳ CORS validation
- ⏳ XSS protection
- ⏳ CSRF tokens if needed

### Secrets Management
```
Recommended: Use Azure Key Vault for:
- SQL Connection String
- API Keys
- Service credentials
- Device Twin connection strings
```

---

## 🔄 CI/CD Pipeline (Future Enhancement)

Once deployed, set up automated deployments:

```
GitHub → Azure DevOps → Automated Tests → Deploy to Production

1. Frontend Pipeline:
   - Build React app
   - Run tests
   - Deploy to App Service
   
2. Backend Pipeline:
   - Run Python tests
   - Package functions
   - Deploy to Function App
```

---

## 📊 Monitoring & Logging

### Application Insights Dashboard
After deployment, you can monitor:
- API request rates
- Response times
- Error rates
- Sync operation success/failure
- User activity

### Logs Locations
- **Function App Logs**: Azure Portal → Function App → Logs
- **App Service Logs**: Azure Portal → App Service → Logs
- **Database Logs**: SQL Database → Query Editor history

---

## 🧪 Testing Strategy

### Phase 1: API Testing
```powershell
# After Function App deployment
$apiUrl = "https://vxt-api-functions.azurewebsites.net/api"

# Test 1: Get all entities
Invoke-WebRequest -Uri "$apiUrl/customerentities"

# Test 2: Get specific entity
Invoke-WebRequest -Uri "$apiUrl/customerentities/2"

# Test 3: Sync setup (the new feature!)
Invoke-WebRequest -Uri "$apiUrl/customerentities/2/sync-setup" `
    -Method POST `
    -Body '{"provider_name":"iot_hub"}'
```

### Phase 2: Frontend Testing
1. Open dashboard in browser
2. Navigate to Customer Entities
3. Edit entity with device ID
4. Verify IoT Device ID field shows
5. Verify table column shows device IDs
6. Click 🚀 SYNC to Device button
7. Verify success message appears
8. Check Device Twin in Azure IoT Hub

### Phase 3: End-to-End Testing
1. Make entity update in dashboard
2. Click sync button
3. Device Twin should update in Azure
4. Real device should receive configuration
5. Monitor logs in Application Insights

---

## 💰 Cost Estimation

### Free Plans (What we're using)
```
Monthly Cost Breakdown:
- Azure SQL Database       : FREE (free tier trial) → $5/month after
- Function App (Consumption): FREE (1M invocations/month included)
- App Service (Free)       : FREE
- Storage Account          : ~$1/month (minimal)
- Application Insights     : FREE (basic tier)
───────────────────────────
TOTAL (Free Tier)          : FREE
TOTAL (After Trial)        : ~$10-15/month
```

### Optional Premium Features
```
If you want to upgrade later:
- App Service Plan B1      : $7/month (vs Free)
- SQL Database S0          : $15/month (vs Free tier)
- Premium Application Insights: ~$100+/month
```

---

## 📋 Resource Checklist

Before starting deployments:

- [ ] Azure Subscription created
- [ ] Azure CLI installed and logged in
- [ ] Contributor access to subscription
- [ ] Resource Group created (vxt-resource-group)
- [ ] SQL Database schema deployed ✅
- [ ] React app build ready
- [ ] FastAPI functions ready
- [ ] Local testing completed ✅

---

## 🔗 Next Steps

1. **Now**: Read Phase 2 guide
   - File: `AZURE_API_FUNCTION_SETUP.md`
   
2. **Then**: Deploy Backend API Layer
   - Create Function App
   - Deploy HTTP trigger functions
   - Configure CORS
   - Test endpoints

3. **Finally**: Deploy Frontend Layer
   - File: `AZURE_FRONTEND_DEPLOYMENT.md`
   - Build React app
   - Create App Service
   - Deploy built files
   - Configure API endpoint

4. **Optional**: Set up CI/CD
   - GitHub Actions workflow
   - Automated deployments

---

## 📞 Troubleshooting

### Can't connect to Azure SQL from Function?
- ✅ Ensure "Allow Azure services and resources" is enabled
- ✅ Check connection string in environment variables
- ✅ Review Application Insights logs

### API returns 401/403 errors?
- ✅ Check CORS configuration
- ✅ Verify authorization headers
- ✅ Check function authentication settings

### Frontend can't reach API?
- ✅ Verify API endpoint URL in React config
- ✅ Check CORS headers in Function App
- ✅ Test API directly with curl/Postman

### Function App times out?
- ✅ Check database connection timeout
- ✅ Monitor Application Insights duration metrics
- ✅ Increase function timeout (max 10 min on Consumption)

---

## 📄 Reference Files

All these files are in your workspace:
- `AZURE_SQL_DEPLOYMENT.sql` - Database schema script
- `AZURE_DEPLOYMENT_GUIDE.md` - Portal deployment steps
- `AZURE_API_FUNCTION_SETUP.md` - Function App guide 📄 creating next
- `AZURE_FRONTEND_DEPLOYMENT.md` - React deployment guide 📄 creating next  
- `ARM_TEMPLATE_INFRASTRUCTURE.json` - Infrastructure-as-Code 📄 creating next
- `deploy_to_azure.ps1` - PowerShell deployment script
- `deploy_azure_frontend.ps1` - Frontend deployment script 📄 creating next
- `deploy_azure_api_function.ps1` - Function deployment script 📄 creating next

---

**Status**: ✅ Architecture & Planning Complete  
**Next**: Execute Phase 2 (Backend API Layer)  
**Timeline**: ~30-45 minutes per phase  

Generated: March 13, 2026
