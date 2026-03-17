# Azure SQL Database Credentials & Configuration

## Database Details

**Server Name**: vxtdb (need to confirm full name like vxtdb.database.windows.net)  
**Database Name**: `free-sql-db-5949639`  
**Username**: `vxtadmin`  
**Password**: `Barak1976!`  
**Port**: 1433  

---

## Connection Strings

### For Web App & Function App (.NET Connection String)
```
Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;User Id=vxtadmin;Password=Barak1976!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

### For ODBC Driver (Python)
```
Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;Uid=vxtadmin;Pwd=Barak1976!;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;
```

---

## Web App Configuration (vxt-web-app)

**Location**: Azure Portal → `vxt-web-app` → Configuration → Application Settings

Add these settings:
1. **WEBSITES_PORT** = `8000`
2. **ENVIRONMENT** = `production`
3. **SQL_CONNECTION_STRING** = `Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;User Id=vxtadmin;Password=Barak1976!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;`
4. **DOCKER_REGISTRY_SERVER_URL** = `https://index.docker.io`
5. **DOCKER_REGISTRY_SERVER_USERNAME** = `barakdoc` (or your Docker Hub username)
6. **DOCKER_REGISTRY_SERVER_PASSWORD** = (your Docker Hub password)

---

## Function App Configuration (vxt-function)

**Location**: Azure Portal → `vxt-function` → Configuration → Application Settings

Add these settings:
1. **WEBSITES_PORT** = `8000`
2. **ENVIRONMENT** = `production`
3. **SQL_CONNECTION_STRING** = `Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;User Id=vxtadmin;Password=Barak1976!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;`
4. **IOTHUB_CONNECTION_STRING** = (Get from Azure Portal → vxt-iot-hub → Shared Access Policies → owner → Connection string)
5. **DOCKER_REGISTRY_SERVER_URL** = `https://index.docker.io`
6. **DOCKER_REGISTRY_SERVER_USERNAME** = `barakdoc` (or your Docker Hub username)
7. **DOCKER_REGISTRY_SERVER_PASSWORD** = (your Docker Hub password)

---

## Next Steps

1. ✅ Update Web App settings with SQL_CONNECTION_STRING above
2. ✅ Update Function App settings with SQL_CONNECTION_STRING above
3. ⏳ Get IoT Hub connection string and add to Function App settings
4. ⏳ Build & push Docker image: `docker build -t barakdoc/vxt-web-app:latest .`
5. ⏳ Deploy Docker image to Web App & Function App

---

## File Last Updated
March 17, 2026
