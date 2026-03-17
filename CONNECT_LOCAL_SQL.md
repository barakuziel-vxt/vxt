# Connect to Azure SQL Database from Local VS Code

## Step 1: Install SQL Server Extension

1. **Open VS Code**
2. **Click Extensions** (Left sidebar, or `Ctrl+Shift+X`)
3. **Search**: `mssql`
4. **Install**: "mssql" by Microsoft (official extension)
5. **Reload** VS Code when complete

---

## Step 2: Get Your SQL Database Connection Info

Go to **Azure Portal**:
```
1. Search: "SQL databases"
2. Click: vxtdb
3. Copy these values from the Overview page:
   - Server name: vxtdb.database.windows.net
   - Login: vxtadmin
   
4. For password: Try your original password (you set during creation)
   Or check: Azure Portal → vxtdb → Overview → Connection strings
   - ODBC tab shows: "Pwd={your_password}"
```

**Your connection details**:
```
Server: vxtdb.database.windows.net
Port: 1433
Database: vxtdb
Username: vxtadmin
Password: [TRY YOUR PASSWORD]
```

---

## Step 3: Create Connection Profile in VS Code

1. **Press**: `Ctrl+Shift+P` (Command Palette)
2. **Type**: `MSSQL: Create Connection Profile`
3. **Press Enter**

4. **Answer questions in order**:
   ```
   Server: vxtdb.database.windows.net
   Database: vxtdb (or leave empty, press Enter)
   Authentication Type: SQL Login
   Username: vxtadmin
   Password: [ENTER YOUR PASSWORD]
   Encrypt: Yes
   Trust certificate: Yes
   Connection Name: azure-vxtdb (or any name)
   ```

5. **Test Connection** - let it connect for 5-10 seconds

---

## Step 4: What to Expect

### ✅ If Connection Succeeds
- You'll see a green checkmark
- Connection profile saved
- Database browser will show tables/schemas
- **Your password is correct!** Use it for Web App & Function App config

### ❌ If Connection Fails
You'll see error like:
```
Login failed for user 'vxtadmin@vxtdb'
```

Common reasons:
1. **Wrong password** → Try password reset instead
2. **Firewall blocking** → Need to allow your IP
3. **Account/DB not ready** → Wait 2-3 minutes and retry

---

## Step 5: Test Query (If Connected)

Once connected:

1. **Create new SQL file**: `Ctrl+N` → Save as `.sql`
2. **Type simple query**:
   ```sql
   SELECT GETDATE() as CurrentTime;
   SELECT @@VERSION as SQLVersion;
   ```

3. **Run query**: `Ctrl+Shift+E` (Execute Query)
4. **See results** in Results pane

✅ If queries run = Database is working!

---

## Step 6: Configure Firewall (If Blocked)

If you get **"Cannot connect - timeout"** error:

Go to **Azure Portal**:
```
1. SQL databases → vxtdb
2. Left Menu: Firewalls and virtual networks
3. Click: Add your client IPv4 address
4. OR: Add rule "Allow Azure services" (for Web App/Function)
5. Save
6. Wait 2 minutes
7. Retry connection in VS Code
```

---

## Step 7: Using Connection for Deployment

Once you verify connection works:

Your **Connection String** for Web App/Function App:
```
Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=vxtdb;Uid=vxtadmin;Pwd=[YOUR_PASSWORD_FROM_VSCODE];
```

---

## 📋 Troubleshooting Checklist

| Error | Solution |
|-------|----------|
| "Login failed" | Wrong password, try reset |
| "Timeout/Cannot connect" | Firewall blocking - add your IP |
| "Server not found" | Wrong server name - check spelling |
| "Database not found" | Database not created yet |
| "18456 - Authentication failed" | User doesn't exist or locked |

---

## 🎯 Next Steps

**Tell me**:
- ✅ "Connection successful" - password is correct, move to deployment
- ❌ "Connection failed" - error message, I'll help troubleshoot
- ⏸️ "Firewall issue" - I'll guide firewall config

Then proceed to [QUICK_CONFIG_GUIDE.md](QUICK_CONFIG_GUIDE.md) Steps 1-5
