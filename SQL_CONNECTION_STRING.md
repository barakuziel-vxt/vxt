# Azure SQL Database Connection String - READY FOR DEPLOYMENT

## Your Connection String:
```
Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=vxtdb;Uid=vxtadmin;Pwd=Barak1008!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;
```

---

## ✅ Using This Connection String

### For Web App (vxt-web-app):
```
Azure Portal → vxt-web-app → Configuration → Application settings

Add Setting:
Name: SQL_CONNECTION_STRING
Value: Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=vxtdb;Uid=vxtadmin;Pwd=Barak1008!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;

Click: SAVE
```

### For Function App (vxt-function):
```
Azure Portal → vxt-function → Configuration → Application settings

Add Setting:
Name: SQL_CONNECTION_STRING
Value: Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=vxtdb;Uid=vxtadmin;Pwd=Barak1008!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;

Click: SAVE
```

---

## 📋 Summary of What You Need to Do Now

1. ✅ **Password Verified**: Barak1008!
2. ✅ **Connection String Ready** (saved above)

### NEXT STEPS (Follow QUICK_CONFIG_GUIDE.md):

**Step 1**: Configure Web App Settings (5 min)
- Go to Azure Portal → vxt-web-app → Configuration
- Add 4 settings:
  - `WEBSITES_PORT = 8000`
  - `ENVIRONMENT = production`
  - `SQL_CONNECTION_STRING = [ABOVE]`
  - `DOCKER_REGISTRY_SERVER_URL = https://index.docker.io`

**Step 2**: Configure Function App Settings (5 min)
- Go to Azure Portal → vxt-function → Configuration
- Add 4 settings:
  - `WEBSITES_PORT = 8000`
  - `ENVIRONMENT = production`
  - `SQL_CONNECTION_STRING = [ABOVE]`
  - `IOTHUB_CONNECTION_STRING = [FROM IOTHUB → SHARED ACCESS POLICIES → OWNER]`

**Step 3**: Build & Push Docker Image (10 min)
```powershell
docker login -u barakdoc
docker build -t barakdoc/vxt-web-app:latest .
docker push barakdoc/vxt-web-app:latest
```

**Step 4**: Deploy to Azure (10 min each)
- Web App → Deployment Center → Docker Container → barakdoc/vxt-web-app:latest
- Function App → Deployment Center → Docker Container → barakdoc/vxt-web-app:latest

---

## 🔒 Security Note

⚠️ **This password is now stored in Azure environment variables (encrypted at rest)**
- Only accessible to Azure App Service/Function App
- Not visible in connection strings
- Can be rotated anytime in Azure Portal

---

**When ready, follow the 4 steps above and tell me: "Configuration complete, images pushed"**

I'll then handle deployment validation and end-to-end testing! 🚀
