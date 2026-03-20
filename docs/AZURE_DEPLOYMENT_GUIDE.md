# Azure SQL Database Deployment - IoT Device ID Integration

## ✅ What Was Deployed

### Local Database ✅ COMPLETE
- **Location**: 127.0.0.1:1433 (local Docker SQL Edge)
- **Database**: BoatTelemetryDB
- **Status**: ✓ Schema updated + Device IDs populated

**Deployed Changes**:
```
✓ iotDeviceId column added to CustomerEntities
✓ 5 entities populated with device IDs:
  • ID 1: 033114869 → vessel-033114869
  • ID 2: 234567890 → TomerRefael
  • ID 3: 234567891 → vessel-234567891
  • ID 4: 033114869 → vessel-033114869
  • ID 5: 234567890 → TomerRefael
```

### Azure SQL Database ⏳ PENDING
- **Location**: vxtdb.database.windows.net
- **Database**: free-sql-db-5949639
- **Status**: ⏳ Requires manual deployment (firewall/network timeout)

---

## 🚀 How to Deploy to Azure SQL Database

### Option 1: Using Azure Portal Query Editor (Recommended)

**Steps**:
1. Go to **Azure Portal**: https://portal.azure.com
2. Search for **"SQL databases"** 
3. Select **free-sql-db-5949639**
4. Click **Query Editor** (left sidebar)
5. Log in with credentials:
   - **Username**: `vxt`
   - **Password**: `Barak1976!`
6. Open file: `AZURE_SQL_DEPLOYMENT.sql`
7. Copy entire contents
8. Paste into Query Editor
9. Click **Run**

### Option 2: Using SQL Server Management Studio (SSMS)

**Steps**:
1. Open **SQL Server Management Studio**
2. Click **Connect** → **Database Engine**
3. Server name: `vxtdb.database.windows.net`
4. Authentication: **SQL Server Authentication**
   - Login: `vxt`
   - Password: `Barak1976!`
5. Click **Connect**
6. Open **AZURE_SQL_DEPLOYMENT.sql** file
7. Execute (F5)

### Option 3: Using Azure Data Studio

**Steps**:
1. Open **Azure Data Studio**
2. Create new connection:
   - Server: `vxtdb.database.windows.net`
   - Database: `free-sql-db-5949639`
   - User: `vxt`
   - Password: `Barak1976!`
3. Open **AZURE_SQL_DEPLOYMENT.sql**
4. Execute entire script

---

## 📝 What the Script Does

The `AZURE_SQL_DEPLOYMENT.sql` script:

1. **Adds iotDeviceId column**
   ```sql
   ALTER TABLE CustomerEntities
   ADD iotDeviceId NVARCHAR(128) NULL
   ```

2. **Populates device IDs**
   ```sql
   UPDATE CustomerEntities
   SET iotDeviceId = CASE 
       WHEN entityId = '033114869' THEN 'vessel-033114869'
       WHEN entityId = '234567890' THEN 'TomerRefael'
       WHEN entityId = '234567891' THEN 'vessel-234567891'
   ```

3. **Verifies deployment**
   ```
   Displays all entities with their device IDs
   Shows summary counts
   ```

---

## ⚠️ Important Notes

### If Query Times Out

**Problem**: Connection timeout from local machine to Azure

**Solutions**:
1. **Check Firewall Rule**
   - Azure Portal → SQL Database → Networking
   - Ensure your IP is in firewall rules
   - Or set "Allow Azure IPs and resources" to ON

2. **Verify Database URL**
   - Should be: `vxtdb.database.windows.net`
   - Check credentials: `vxt` / `Barak1976!`

3. **Check Database Status**
   - Azure Portal → SQL Database overview
   - Status should be "Online"

### After Successful Deployment

Once executed in Azure Portal, the schema will be:

✓ Available in Azure SQL Database  
✓ Synchronized with local database  
✓ Ready for cloud functions to read device IDs  
✓ Matches local deployment exactly  

---

## 🔄 Deployment Summary

| Component | Status | Details |
|-----------|--------|---------|
| Local Database | ✅ Complete | Docker SQL Edge - iotDeviceId + 5 assignments |
| Azure SQL | ⏳ Pending | Manual deployment via Query Editor |
| Backend API | ✅ Complete | Updated 5 endpoints, added sync endpoint |
| Frontend | ✅ Complete | Form field, table column, sync button |

---

## 🎯 Next Steps

### Immediate (Do Now)
1. ✓ Local database deployed
2. ✓ Backend API ready
3. ✓ Frontend components ready
4. ⏳ **Deploy AZURE_SQL_DEPLOYMENT.sql** to Azure SQL

### Then
5. Test sync feature in dashboard
6. Verify Device Twin updates in Azure IoT Hub
7. Monitor Azure Functions for Device Twin mode

---

## 📞 Verification After Azure Deployment

Once you've run the SQL script in Azure Portal, verify:

```sql
-- Run this in Azure Query Editor to verify
SELECT COUNT(*) as [Total Entities],
       SUM(CASE WHEN iotDeviceId IS NOT NULL THEN 1 ELSE 0 END) as [With Device IDs]
FROM CustomerEntities;
```

**Expected Result**: 
```
Total Entities: 5
With Device IDs: 5
```

---

## 🔐 Connection Details Reference

**Local Database** (Docker):
```
Server: 127.0.0.1,1433
Database: BoatTelemetryDB
User: sa
Password: YourStrongPassword123!
```

**Azure Database**:
```
Server: vxtdb.database.windows.net
Database: free-sql-db-5949639
User: vxt
Password: Barak1976!
```

---

## 📄 Files Created

- `AZURE_SQL_DEPLOYMENT.sql` - SQL script for Azure deployment
- `deploy_azure_iot_device_ids.py` - Python script (network timeout)

---

## ✨ Summary

✅ **Local Database**: Fully deployed and seeded  
⏳ **Azure SQL**: Ready - execute `AZURE_SQL_DEPLOYMENT.sql` in Azure Portal Query Editor  
✅ **Backend**: All endpoints ready  
✅ **Frontend**: All UI components ready  

**ETA to full deployment**: 5 minutes (just need to paste SQL in Azure Portal)

---

Generated: 2026-03-13  
Status: ✅ Local Complete, ⏳ Azure Pending (manual)
