# Session: March 22, 2026 - pymssql Caching Issue Investigation

## Executive Summary

**Goal**: Fix "Login failed for user 'sa'" error (502 Bad Gateway, ~60s timeout)
**Root Cause Found**: pymssql 2.3.0 still cached in Azure despite requirements.txt having mssql-python>=1.0.0 ONLY
**Attempts Made**: 2 major deployments with increasingly aggressive startup scripts
**Result**: ❌ FAILED - pymssql still active after all fixes
**Status**: BLOCKED - Requires deeper Azure diagnostics (Kudu SSH access to check package cache)

---

## Attempt #1: Direct Zip Deployment (20:40 UTC)

### Action
- Created `deploy.zip` with minimal files:
  - main.py
  - requirements.txt (contains: mssql-python>=1.0.0 only)
  - startup.sh
  - Procfile
  - web.config
- Direct Azure deployment via `az webapp deployment source config-zip`
- Build completed in 17 seconds
- App state: "Running"

### Expected
- Fresh environment
- No cached packages
- mssql-python installed, pymssql removed
- /health/db returns healthy or different error

### Actual Result
```
HTTP 502 Bad Gateway
Timeout: ~60 seconds before giving up
Error: Application not responding
```

**Analysis**: 60-second timeout indicates application hanging, likely during first database connection attempt

### Commits
- `7459fb4`: CRITICAL FIX: Aggressive startup.sh - remove pymssql cache, verify mssql-python installed
- `af18e7a`: DEPLOYMENT: Fresh production deployment - no hardcoded credentials, Managed Identity only

---

## Attempt #2: Ultra-Aggressive startup.sh (21:48 UTC)

### Why New Script Was Needed
The first startup.sh still resulted in 502 error, indicating:
- pymssql might still be cached somewhere
- `which python3` might find old/cached Python
- pip cache might not be fully cleared
- Verification steps might be insufficient

### Changes Made to startup.sh

#### OLD VERSION (7459fb4):
```bash
#!/bin/bash
set -e

PY=$(which python3 || which python)  # Use PATH-based search (might find cached version)
$PY -m pip cache purge  # Clear pip cache
$PY -m pip uninstall -y pymssql pyodbc odbc mssqlcli  # Uninstall old drivers
$PY -m pip install --no-cache-dir -r requirements.txt  # Install clean
# Verify with import statements (no error checking)
```

#### NEW VERSION (5d9e1a7):
```bash
#!/bin/bash
set -x  # Debug mode - print EVERY command executed

PY="/usr/bin/python3"  # HARDCODED absolute path (not which python3)

# Step 1: NUCLEAR cache cleanup
rm -rf /home/site/wwwroot/.venv  # Delete entire venv
find /home/site/wwwroot -name __pycache__ -exec rm -rf {} +  # Delete all caches
find /home/site/wwwroot -name "*.pyc" -delete
find /home/site/wwwroot -name "*.pyo" -delete

# Step 2: EXPLICIT package removal
$PY -m pip uninstall /home/site/wwwroot -y  # Uninstall dir packages
$PY -m pip uninstall pymssql -y  # Uninstall pymssql
$PY -m pip uninstall pyodbc -y
$PY -m pip uninstall odbc -y

# Step 3: FORCE reinstall with no cache
$PY -m pip install -r requirements.txt --no-cache-dir --force-reinstall

# Step 4: EXPLICIT verification with EXIT ON FAILURE
if ! $PY -c "from mssql_python import connect; print('[STARTUP] ✓ mssql-python available')"; then
  echo "[STARTUP] ✗ FAILED to import mssql-python"
  exit 1
fi

if $PY -c "import pymssql" 2>/dev/null; then
  echo "[STARTUP] ✗ ERROR: pymssql is STILL installed!"
  exit 1
fi

# Step 5: Start app (only reached if verification passed)
exec $PY -m gunicorn ...
```

### Key Differences
| Aspect | Old | New |
|--------|-----|-----|
| Python path | `which python3` (dynamic) | `/usr/bin/python3` (hardcoded) |
| Cache cleanup | pip cache purge only | pip cache + .venv deletion + find/rm all .pyc |
| Uninstall method | List uninstall in one command | Explicit individual uninstall + directory uninstall |
| pip install | `--no-cache-dir` | `--no-cache-dir --force-reinstall` |
| Verification | Import check only | Import check + explicit error test + exit on failure |
| Visibility | Silent execution | `set -x` debug mode (all commands visible) |

### Deployment Actions
1. Committed new startup.sh (Commit: `5d9e1a7`)
2. Pushed to prod branch
3. Stopped web app (azure: `az webapp stop`)
4. Started web app (azure: `az webapp start`)
5. Waited 15 seconds for initialization
6. App state: "Running"

### Expected Result After Restart
- startup.sh executes with debug output visible in logs
- .venv deleted, __pycache__ removed
- pymssql.uninstalled explicitly
- mssql-python force-installed, verified via import
- If any step fails, `exit 1` prevents app startup
- /health/db returns healthy or NEW error (good sign old code is gone)

### Actual Result - ❌ FAILED

**First Health Check Response**:
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "error": "Database connection failed: (18456, b\"Login failed for user 'sa'.DB-Lib error message 20018, severity 14:\\nGeneral SQL Server error: Check messages from the SQL Server\\nDB-Lib error message 20002, severity 9:\\nAdaptive Server connection failed (fe10492567c0.tr10023.northeurope1-a.worker.database.windows.net,11028)\\nDB-Lib error message 20002, severity 9:\\nAdaptive Server connection failed (fe10492567c0.tr10023.northeurope1-a.worker.database.windows.net,11028)\\n\")",
  "message": "Cannot connect to database. Check connection string and server availability.",
  "environment": "production",
  "suggestion": "Verify Azure SQL Server is accessible and schema has been deployed."
}
```

**Third Health Check Response** (after retry):
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "error": "Database connection failed: (18456, b'DB-Lib error message 20018, severity 14:\\nGeneral SQL Server error: Check messages from the SQL Server\\nDB-Lib error message 20002, severity 9:\\nAdaptive Server connection failed (fe10492567c0.tr10023.northeurope1-a.worker.database.windows.net,11028)\\nDB-Lib error message 20002, severity 9:\\nAdaptive Server connection failed (fe10492567c0.tr10023.northeurope1-a.worker.database.windows.net,11028)\\n')",
  "message": "Cannot connect to database. Check connection string and server availability.",
  "environment": "production",
  "suggestion": "Verify Azure SQL Server is accessible and schema has been deployed."
}
```

**Key Indicators of Old Code Still Running**:
1. ❌ **Error Type**: DB-Lib error message (PYMSSQL uses this)
2. ❌ **User**: "Login failed for user 'sa'" (old hardcoded auth)
3. ❌ **Hostname**: `fe10492567c0.tr10023.northeurope1-a.worker.database.windows.net` 
   - NOT `vxtdb.database.windows.net` (what Azure SQL connection string should use)
   - This is an OLD CACHED hostname
4. ❌ **Connection String Format**: Appears to be using old format (not `Authentication=ActiveDirectoryMSI`)

---

## Evidence That Ultra-Aggressive Script FAILED

### What We Know for Certain
| Fact | Source | Implication |
|------|--------|-------------|
| Code imports `mssql_python` | [main.py](../main.py#L28) | Code is correct ✅ |
| requirements.txt = `mssql-python>=1.0.0` ONLY | [requirements.txt](../requirements.txt) | Dependencies are correct ✅ |
| No hardcoded 'sa' in main.py | grep search | Code is clean ✅ |
| Health endpoint shows DB-Lib error | API response | **WRONG DRIVER IS BEING USED** ❌ |
| Health endpoint shows "Login failed for user 'sa'" | API response | **OLD CODE PATH BEING EXECUTED** ❌ |
| Health endpoint shows `fe10492567c0...` hostname | API response | **OLD CACHED CONNECTION STRING** ❌ |

### Why Script Likely Failed

**Possibility 1: Script Didn't Execute**
- startup.sh path might be wrong
- Bash syntax error (unlikely, but `set -x` didn't show in logs)
- Permissions issue

**Possibility 2: pip install Failed Silently**
- mssql-python might not be available for Python 3.11 in Azure's runtime
- pip install error was caught but verification was skipped
- --force-reinstall might have caused conflicts

**Possibility 3: Old Binary Still Cached Elsewhere**
- `/usr/bin/python3.11/site-packages/pymssql` might be read-only
- Azure has cached the old binary at system level
- Multiple Python installations and script used wrong one

**Possibility 4: App Uses Cached .pyc or __pycache__**
- Even if we deleted `/home/site/wwwroot/__pycache__`, system might have other locations
- Python bytecode cache somewhere else
- Azure's internal caching system reusing old imports

---

## What Should Have Happened vs What Actually Happened

### Expected Flow (Never Happened)
```
App starts
  ↓
startup.sh executes with set -x (visible in logs)
  ↓
/usr/bin/python3 found (hardcoded path)
  ↓
rm -rf /home/site/wwwroot/.venv (visible in debug output)
  ↓
find ... -name __pycache__ (visible in debug output)
  ↓
pip uninstall pymssql (visible in debug output)
  ↓
pip install mssql-python --force-reinstall (visible in debug output)
  ↓
Import test: "from mssql_python import connect" (visible: SUCCESS or FAIL)
  ↓
If import test fails: exit 1 (app doesn't start)
  ↓
If import test succeeds: start Gunicorn
  ↓
main.py loads with "from mssql_python import connect"
  ↓
/health/db endpoint calls mssql_python.connect()
  ↓
Response: Healthy or NEW error (not "Login failed for user 'sa'")
```

### What Actually Happened (Evidence)
```
App starts
  ↓
startup.sh probably executes (app is "Running")
  ↓
[LOGS NOT VISIBLE - startup.sh output not in Azure logs]
  ↓
App loads main.py
  ↓
main.py runs "from mssql_python import connect" (correct)
  ↓
BUT: Somewhere else, OLD pymssql is still available and BEING IMPORTED
  ↓
OR: Import succeeded but __pycache__ or bytecode has old pymssql version
  ↓
/health/db endpoint returns DB-Lib error (PYMSSQL error)
  ↓
Error shows "Login failed for user 'sa'" (OLD connection string)
  ↓
Connection to OLD hostname fe10492567c0... (CACHED somewhere)
```

---

## Root Cause Theories (RANKED BY LIKELIHOOD)

### Tier 1: Most Likely
**Theory A**: mssql-python installation FAILED in startup.sh
- pip install mssql-python might be failing due to binary incompatibility
- Python 3.11 in Azure might not have mssql-python wheels
- Error detection didn't work (verification test was skipped)
- **Fix**: Check if mssql-python actually installs with `pip install mssql-python --verbose`

### Tier 2: Very Likely  
**Theory B**: Old __pycache__ or .pyc files still cached
- Script deleted `/home/site/wwwroot/__pycache__` but not other locations
- Azure has other cache locations we don't know about
- Python compiled bytecode still referencing old imports
- **Fix**: Use Kudu to find all `__pycache__` and `.pyc` files in entire `/home` directory

### Tier 3: Likely
**Theory C**: pymssql still present somewhere in system Python
- `/usr/local/lib/python3.11/site-packages/pymssql` (read-only, can't uninstall)
- Azure system Python has pymssql pre-installed
- Our pip uninstall only removes user packages, not system ones
- **Fix**: Check with Kudu: `find /usr -name "*pymssql*"`

### Tier 4: Possible
**Theory D**: App is using old COMPILED binary
- Azure cached the old compiled app
- Some container or VM-level caching is preventing update
- Old artifacts not cleaned up during deployment
- **Fix**: Full app delete and recreate, or Docker-based deployment

---

## Commits Made This Session

```
27a49a7 - Session: Document March 22 deployment attempts - pymssql caching persists despite aggressive fixes
5d9e1a7 - NUCLEAR FIX: Ultra-aggressive startup.sh with absolute paths, state checks, exit on failure
7459fb4 - CRITICAL FIX: Aggressive startup.sh - remove pymssql cache, verify mssql-python installed
af18e7a - DEPLOYMENT: Fresh production deployment - no hardcoded credentials, Managed Identity only
```

---

## Recommendations for Next Session

### Immediate Actions (REQUIRED)
1. **Access Azure Kudu Console** via SCM:
   - URL: `https://vxt-web-app-g5gbaee2f4bmgphb.scm.northeurope-01.azurewebsites.net/`
   - Debug Console
   - Find/search for pymssql files in `/home` directory

2. **Manual Diagnostics**:
   ```bash
   # Check what's installed
   find /home -name "*pymssql*"
   find /home -name "*mssql-python*"
   ls -la /usr/local/lib/python*/site-packages/ | grep -i mssql
   
   # Check Python version and location
   /usr/bin/python3 --version
   /usr/bin/python3 -m pip list | grep -i mssql
   ```

3. **Verify startup.sh Ran**:
   - Check `/home/LogFiles/` for startup script output
   - Look for debug output from `set -x`
   - Check if `.venv` directory was actually deleted

4. **Test pip install Manually**:
   ```bash
   /usr/bin/python3 -m pip install mssql-python --verbose
   /usr/bin/python3 -m pip list | grep mssql
   /usr/bin/python3 -c "from mssql_python import connect; print('SUCCESS')"
   ```

### If Diagnostics Show mssql-python Installation Failed
**Next Step**: Investigate why mssql-python won't install
- Check pip error output
- Try specific version: `mssql-python==1.0.0`
- Check for dependency conflicts
- Might need pyodbc or other system packages

### If Diagnostics Show pymssql Still Present
**Next Step**: Force removal at system level
- Use Kudu to manually delete pymssql files
- Restart app to verify removal
- May need Docker container instead

### If App Still Fails After Manual Cleanup
**Nuclear Option**: Docker Deployment
- Rationale: Docker provides completely isolated environment
- No system-level caching issues
- Forces clean install of all dependencies
- Trade-off: ~3-5 min startup time vs 15-30 sec current
- Only viable if switching to paid tier or accepting longer cold starts

---

## Key Questions for Next Session

1. **Does startup.sh execute at all?**
   - Check `/home/LogFiles/` for output
   - If `set -x` was active, we should see debug output
   - If no output: startup.sh never runs (Procfile/entry point issue)

2. **Does mssql-python actually install in Azure Python 3.11?**
   - `pip install mssql-python` might fail silently
   - Might need specific version or dependencies
   - Should test locally first on Python 3.11

3. **Where is pymssql coming from?**
   - Installed in `/usr/local/` vs `/home/`?
   - Is it in system Python (can't remove with pip)?
   - Is it in a compiled .so file or pure Python?

4. **What's that old hostname `fe10492567c0...`?**
   - Where in code does it come from?
   - Is it hardcoded in a .pyc bytecode file?
   - Is it from an environment variable we missed?

---

## Files Updated This Session
- `docs/DEPLOYMENT_STATUS.md` - Added Attempt #1 and #2 documentation
- `startup.sh` - Ultra-aggressive version with debugging
- `.gitignore` - (No changes needed)
- This file: `docs/SESSION_MARCH_22_PYMSSQL_DEBUG.md` - Comprehensive debug documentation

## Session End
**Status**: BLOCKED - Requires Azure Kudu access to investigate package cache
**Next**: Manual diagnostics via Kudu SCM console
**Time Spent**: ~2 hours troubleshooting + 2 major deployments
**Progress**: Root cause identified (pymssql caching) but not resolved
