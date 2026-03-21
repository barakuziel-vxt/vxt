# VXT Documentation Index

## 🚀 Start Here

### For Developers
1. **[FUNCTION_APP_QUICK_START.md](./FUNCTION_APP_QUICK_START.md)** - 5-minute deployment guide
   - TL;DR instructions
   - Step-by-step commands
   - Quick troubleshooting

2. **[DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)** - Current system status
   - What's deployed
   - What's pending
   - Infrastructure checklist

### For System Updates
3. **[FUNCTION_APP_UPDATE_SUMMARY.md](./FUNCTION_APP_UPDATE_SUMMARY.md)** - Today's changes
   - Modifications made
   - Driver migration details
   - Next steps

---

## 📚 Complete Documentation

### Deployment Guides
- **[FUNCTION_APP_QUICK_START.md](./FUNCTION_APP_QUICK_START.md)** (5 min read)
  - Quick reference
  - Architecture diagram
  - Step-by-step deployment
  - Verification checklist

- **[FUNCTION_APP_DEPLOYMENT_GUIDE.md](./FUNCTION_APP_DEPLOYMENT_GUIDE.md)** (15 min read)
  - Detailed workflow explanation
  - Configuration details
  - Troubleshooting guide
  - Performance optimization

- **[FUNCTION_APP_SETUP_CHECKLIST.md](./FUNCTION_APP_SETUP_CHECKLIST.md)** (10 min read)
  - Pre-deployment checklist
  - GitHub secrets setup
  - Azure resource verification
  - Post-deployment configuration
  - Database schema reference

### Status & Overview
- **[DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)** (10 min read)
  - Current deployment state
  - Component status
  - Infrastructure details
  - Known issues

- **[FUNCTION_APP_UPDATE_SUMMARY.md](./FUNCTION_APP_UPDATE_SUMMARY.md)** (5 min read)
  - Summary of changes made
  - Driver migration details
  - Timeline & next steps
  - Success criteria

---

## 🔄 Update Summary (March 21, 2026)

### What Changed
✅ **Function App Code Updated**
- Database driver: `pymssql` → `mssql-python` (official Microsoft)
- Connection parameters updated to match new driver
- All code in `/azure-functions/` folder

✅ **Documentation Created**
- 5 comprehensive guides created in `/docs/`
- All guides linked and cross-referenced
- Step-by-step deployment instructions included

✅ **Status Documentation Updated**
- DEPLOYMENT_STATUS.md reflects all changes
- Function App section added
- Database migration section expanded

### What's Ready
✅ Code is ready for deployment  
✅ GitHub Actions workflow is configured  
✅ Azure infrastructure is provisioned  
✅ Documentation is complete  

### What's Pending
⏳ GitHub secrets must be added (3 secrets)  
⏳ Deployment workflow must be triggered  
⏳ Health endpoint verification  

---

## 📋 Quick Navigation

### "How do I deploy the Function App?"
→ Read: **[FUNCTION_APP_QUICK_START.md](./FUNCTION_APP_QUICK_START.md)**

### "What are the GitHub secrets I need?"
→ Read: **[FUNCTION_APP_SETUP_CHECKLIST.md](./FUNCTION_APP_SETUP_CHECKLIST.md)** → "GitHub Secrets Configuration"

### "What changed with the database driver?"
→ Read: **[FUNCTION_APP_UPDATE_SUMMARY.md](./FUNCTION_APP_UPDATE_SUMMARY.md)** → "Database Driver Migration"

### "Why did we switch to mssql-python?"
→ Read: **[DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)** → "DATABASE DRIVER MIGRATION"

### "What's the architecture?"
→ Read: **[FUNCTION_APP_QUICK_START.md](./FUNCTION_APP_QUICK_START.md)** → "Architecture Overview"

### "I'm getting an error, how do I fix it?"
→ Read: **[FUNCTION_APP_DEPLOYMENT_GUIDE.md](./FUNCTION_APP_DEPLOYMENT_GUIDE.md)** → "Troubleshooting"

### "What needs to be done before deployment?"
→ Read: **[FUNCTION_APP_SETUP_CHECKLIST.md](./FUNCTION_APP_SETUP_CHECKLIST.md)** → "Pre-Deployment Checklist"

### "What's the current status of everything?"
→ Read: **[DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)**

---

## 🎯 Immediate Next Steps

1. **Add GitHub Secrets** (5 minutes)
   - Get Service Principal from Azure CLI
   - Get database password
   - Get IoT Hub connection string
   - Add 3 secrets to GitHub repository

2. **Trigger Deployment** (3 minutes)
   - Manual trigger in GitHub Actions, OR
   - Push changes to `prod` branch

3. **Verify Success** (2 minutes)
   - Check health endpoint
   - Check Azure Portal
   - View deployment logs

**Total Time**: ~10 minutes

---

## 📁 File Structure

```
/docs/
├─ FUNCTION_APP_QUICK_START.md          ← Start here for deployment
├─ FUNCTION_APP_DEPLOYMENT_GUIDE.md     ← Detailed reference
├─ FUNCTION_APP_SETUP_CHECKLIST.md      ← Pre-flight checklist
├─ FUNCTION_APP_UPDATE_SUMMARY.md       ← Summary of changes
├─ DEPLOYMENT_STATUS.md                 ← Current status
└─ INDEX.md                             ← This file

/azure-functions/
├─ function_app.py                      ← Function code (UPDATED)
├─ requirements.txt                     ← Dependencies (UPDATED)
├─ host.json                            ← Configuration
└─ .gitignore

/.github/workflows/
└─ deploy-function-app.yml              ← Deployment workflow
```

---

## 🔑 Key Files Updated

### Function App Code
- **`/azure-functions/function_app.py`**
  - Updated: `pymssql` → `from mssql_python import connect`
  - Updated: SQL parameter syntax (? → @paramName)
  - Everything else: unchanged

- **`/azure-functions/requirements.txt`**
  - Removed: `pymssql==2.3.0`
  - Added: `mssql-python>=1.0.0`
  - Everything else: unchanged

### Documentation
- **`/docs/DEPLOYMENT_STATUS.md`**
  - Added: Function App section
  - Updated: Driver migration section
  - Added: New infrastructure details

- **New Files** (in `/docs/`):
  - `FUNCTION_APP_QUICK_START.md`
  - `FUNCTION_APP_DEPLOYMENT_GUIDE.md`
  - `FUNCTION_APP_SETUP_CHECKLIST.md`
  - `FUNCTION_APP_UPDATE_SUMMARY.md`
  - `INDEX.md` (this file)

---

## 💡 Important Notes

1. **Branch**: Workflow only triggers on `prod` branch, not `main`
2. **Secrets**: All 3 secrets MUST be added before deployment can succeed
3. **Time**: First deployment takes 2-3 minutes, subsequent updates take 1-2 minutes
4. **Cost**: Y1 consumption plan = ~$0/month for light usage
5. **Cold Start**: First request after deployment takes 15-30 seconds (normal)

---

## 🆘 Support

- **Quick fixes**: See [FUNCTION_APP_QUICK_START.md](./FUNCTION_APP_QUICK_START.md) → "Troubleshooting Quick Fixes"
- **Detailed help**: See [FUNCTION_APP_DEPLOYMENT_GUIDE.md](./FUNCTION_APP_DEPLOYMENT_GUIDE.md) → "Troubleshooting"
- **Setup help**: See [FUNCTION_APP_SETUP_CHECKLIST.md](./FUNCTION_APP_SETUP_CHECKLIST.md)
- **Current status**: See [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)

---

## ✅ Completion Checklist

Use this to track your deployment progress:

- [ ] Read [FUNCTION_APP_QUICK_START.md](./FUNCTION_APP_QUICK_START.md)
- [ ] Create Service Principal (Step 1)
- [ ] Gather database password (Step 2)  
- [ ] Get IoT Hub connection string (Step 3)
- [ ] Add 3 GitHub secrets (Step 4)
- [ ] Trigger deployment (Step 5)
- [ ] Verify health endpoint (Step 6)
- [ ] Check Azure Portal
- [ ] Configure IoT Hub routing (optional)
- [ ] Send test telemetry
- [ ] Verify data in EntityTelemetry table

---

## 🔗 External Links

- **GitHub Repository**: https://github.com/barakuziel-vxt/vxt
- **Azure Portal**: https://portal.azure.com
- **Microsoft mssql-python Docs**: https://learn.microsoft.com/en-us/sql/connect/python/
- **Azure Functions Docs**: https://learn.microsoft.com/en-us/azure/azure-functions/

---

**Last Updated**: March 21, 2026  
**Status**: Ready for deployment (pending GitHub secrets)  
**Documentation Status**: Complete and comprehensive

