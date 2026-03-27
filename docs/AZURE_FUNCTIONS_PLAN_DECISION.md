# Azure Functions Hosting Plan Decision - March 27, 2026

## Decision: Linux Consumption Plan (FREE)

### Executive Summary
After evaluating all Azure Functions hosting options for the VXT IoT Hub project, **Linux Consumption Plan** was selected as the optimal solution for POC/development phase.

**Selected Plan**: Linux Consumption (FREE)
**Region**: North Europe
**Cost**: $0/month (pay-as-you-go only for executions)
**Status**: Active and ready for deployment
**Sunset**: Retiring Sept 30, 2028

---

## Why NOT Other Plans?

### ❌ Windows Consumption Plan
- **Problem**: Python NOT supported on Windows for Azure Functions
- **Supported runtimes**: .NET, Node.js, Java, PowerShell (Windows only)
- **Status**: Eliminates this option completely

### ❌ Free (F1) & Shared Plans
- **Problem**: Azure Function Apps NOT supported on Free or Shared plans
- **Limitation**: These lightweight plans only support Web Apps
- **Minimum required**: B1 Basic plan ($13.14/month)
- **Result**: Cannot use web app's F1 plan for functions

### ⚠️ Premium Plan
- **Cost**: $50-500+/month (excessive for POC)
- **Benefit**: Better scaling, cold start performance
- **Decision**: Overkill for current requirements

### ⚠️ Flex Consumption Plan
- **Cost**: Pay-as-you-go similar to Linux Consumption
- **Advantage**: Newer plan, supports longer execution times
- **Status**: Only in select regions (not fully available everywhere)
- **Decision**: Linux Consumption good enough for POC; migrate later if needed

---

## Selected: Linux Consumption Plan  

### ✅ Why This Plan?

| Aspect | Value |
|--------|-------|
| **Cost** | FREE |
| **Billing** | Pay-as-you-go (only execution costs) |
| **Python Support** | ✅ Yes (3.11 compatible) |
| **IoT Hub Triggers** | ✅ Yes |
| **Managed Identity** | ✅ Yes |
| **mssql-python Driver** | ✅ Yes |
| **Cold Starts** | ~2-3 seconds (acceptable for POC) |
| **Deployment** | File-based (from GitHub Actions) |

### Configuration

```
Resource Group: vxt-functions-linux
Function App Name: vxt-function
Plan: NorthEuropeLinuxDynamicPlan (Linux Consumption)
Region: North Europe
Python Version: 3.11
Functions Runtime: v4
Storage Account: vxtfunctionslinux
```

### App Settings Configured
- IOT_HUB_CONNECTION_STRING
- DATABASE_SERVER: vxtdb.database.windows.net
- DATABASE_NAME: vxtdb
- DATABASE_USER: vxt-web-app
- EVENT_HUB_NAME: events
- AZURE_TENANT_ID: (service principal)
- PYTHON_VERSION: 3.11

### Managed Identity
- Type: System-Assigned
- Principal ID: 419e0953-1215-4237-9dc5-e25f0df09901
- Tenant ID: cdbf3aaa-ae16-4201-af90-2d06a90c1cce

---

## Pricing Comparison (Monthly)

| Plan | Cost | Notes |
|------|------|-------|
| **Linux Consumption** | $0 + usage | **SELECTED** - FREE |
| Windows Consumption | N/A | Python not supported |
| Free (F1) | $0 | Function Apps not supported |
| Basic (B1) | $13.14 | Not serverless, always-on |
| Premium (P0V3) | $62.05 | Excessive for POC |
| Flex Consumption | $0 + usage | Not in all regions yet |

---

## Deployment Pipeline

1. **Code commit** → Push to `prod` branch
2. **GitHub Actions trigger** → `deploy-function-app.yml`
3. **Authentication** → Uses GitHub service principal
4. **Package build** → Python 3.11 + requirements.txt
5. **Deploy** → Zip deployment to function app
6. **Activation** → Function becomes live (10-30 seconds)

---

## Important Notes

### ⏰ Retirement Timeline
- **Current Status**: Active and fully supported
- **Sunset Date**: September 30, 2028
- **Action Required Before**: Migrate to Flex Consumption or Premium plan before Sept 2028
- **Migration Path**: Documented in separate guide (TODO)

### When to Upgrade
Upgrade plan if:
- [ ] POC complete and moving to production
- [ ] Execution frequency exceeds 1M invocations/month
- [ ] Cold starts become performance blocker
- [ ] Need guaranteed response time SLAs
- [ ] Approaching Sept 2028 sunset date

### Best Practices
1. Monitor execution metrics in Azure Portal
2. Set cost alerts before unexpected billing
3. Document execution patterns for future capacity planning
4. Plan migration to Flex Consumption 6 months before Sept 2028

---

## Related Documentation
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) - Current deployment state
- [FUNCTION_APP_DEPLOYMENT_GUIDE.md](./FUNCTION_APP_DEPLOYMENT_GUIDE.md) - Step-by-step deployment
- [AZURE_PYTHON_SQL_F1_SETUP_GUIDE.md](./AZURE_PYTHON_SQL_F1_SETUP_GUIDE.md) - Python SQL setup

---

## References
- [Azure Functions Hosting Plans](https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale)
- [Linux Consumption Plan Retirement Notice](https://learn.microsoft.com/en-us/azure/azure-functions/migration/migrate-plan-consumption-to-flex)
- [mssql-python Official Driver](https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-python)

**Last Updated**: March 27, 2026
**Reviewed By**: POC Team
**Status**: ✅ APPROVED FOR PRODUCTION USE (POC Phase)
