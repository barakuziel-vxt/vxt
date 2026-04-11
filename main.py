# ============================================================================
# Yacht Telemetry API - UNIFIED DEPLOYMENT FILE
# Works for: Local Development (Docker), Laptop (.env), and Azure (App Settings)
# Build: Fresh deployment from scratch (no cached drivers) - 2026-04-07 14:00
# ============================================================================
# 
# ENVIRONMENT CONFIGURATION:
# 
# LOCAL LAPTOP (.env file):
#   ENVIRONMENT=local
#   SQL_CONNECTION_STRING=<your-local-connection-string>
#
# DOCKER/LOCAL DOCKER-COMPOSE (.env.local):
#   ENVIRONMENT=docker
#   SQL_CONNECTION_STRING=<your-docker-connection-string>
#
# AZURE PRODUCTION (Azure App Settings - Using Managed Identity):
#   ENVIRONMENT=production
#   SQL_CONNECTION_STRING=Server=vxtdb.database.windows.net,1433;Database=free-sql-db-5949639;Authentication=ActiveDirectoryMSI;Encrypt=yes;TrustServerCertificate=no;
# 
# If SQL_CONNECTION_STRING is not set, the app uses sensible defaults for local dev.
# ============================================================================

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import datetime
from collections import defaultdict
import os
from mssql_python import connect
import json
import traceback
import sys
import time
from dotenv import load_dotenv

# ============================================================================
# ENVIRONMENT DETECTION & CONFIGURATION
# ============================================================================

# Detect if running in Azure (App Service sets specific environment variables)
# If ANY Azure-specific var is present, skip .env loading entirely
RUNNING_IN_AZURE = any([
    os.getenv('WEBSITE_INSTANCE_ID'),  # App Service set this
    os.getenv('WEBSITE_SITE_NAME'),     # App Service site name
    os.getenv('APPSVC_LOG_DIR'),        # App Service logging dir
])

# Only load .env if NOT in Azure and not in production mode
if not RUNNING_IN_AZURE:
    load_dotenv(override=False)  # Don't override existing env vars
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'local').lower()
else:
    # In Azure, all settings come from App Settings, not .env
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'production').lower()

# Parse SQL_CONNECTION_STRING from environment (or use defaults for local dev)
SQL_CONNECTION_STRING = os.getenv('SQL_CONNECTION_STRING', '')

def get_db_connection_string():
    """Build mssql-python connection string from environment
    
    Supports three deployment modes:
    - LOCAL: Direct connection to localhost SQL Server (via .env)
    - DOCKER: Connection via docker-compose (via .env)
    - AZURE: Cloud-based SQL Database with Managed Identity (SQL_CONNECTION_STRING from App Settings only)
    """
    
    if SQL_CONNECTION_STRING:
        # Use connection string from environment directly
        # mssql-python will parse it with proper support for all parameters
        # In Azure, this comes from App Settings and has Authentication=ActiveDirectoryMSI
        return SQL_CONNECTION_STRING
    elif ENVIRONMENT in ['local', 'dev', 'docker']:
        # Local development: get connection string from .env file
        # (set via load_dotenv() earlier only IF NOT in Azure)
        fallback_local = os.getenv('SQL_CONNECTION_STRING_LOCAL')
        if fallback_local:
            return fallback_local
        # If .env not available, inform user
        print(f"[WARNING] SQL_CONNECTION_STRING not set. For local dev, add SQL_CONNECTION_STRING to .env file")
        return None
    else:
        # Production without connection string - will fail gracefully
        print(f"[ERROR] SQL_CONNECTION_STRING not set in production. Check Azure App Settings.")
        return None

def get_db_config():
    """DEPRECATED: Kept for backward compatibility only. Use get_db_connection_string() instead."""
    conn_str = get_db_connection_string()
    if not conn_str:
        return None
    
    # Parse connection string for logging purposes
    config = {}
    for item in conn_str.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            config[key.strip().lower()] = value.strip()
    
    return config

print(f"[INFO] ===== DATABASE CONFIGURATION =====")
print(f"[INFO] Deployment Mode: {ENVIRONMENT.upper()}")
print(f"[INFO] Database Driver: mssql-python (official Microsoft Python driver)")
print(f"[INFO] Protocol: TDS (native, no ODBC driver installation required)")
if SQL_CONNECTION_STRING:
    # Log connection string without exposing password
    config_preview = get_db_config()
    if config_preview:
        server = config_preview.get('server', 'unknown')
        database = config_preview.get('database', 'unknown')
        auth_method = "Managed Identity" if "Authentication=ActiveDirectoryMSI" in SQL_CONNECTION_STRING else "SQL Authentication"
        print(f"[INFO] [OK] Connection string found:")
        print(f"[INFO]   Server: {server}")
        print(f"[INFO]   Database: {database}")
        print(f"[INFO]   Authentication: {auth_method}")
    else:
        print(f"[WARNING] Connection string found but parsing failed")
else:
    print(f"[WARNING] No SQL_CONNECTION_STRING set - using local development defaults")
print(f"[INFO] ===== END DATABASE CONFIGURATION =====")

# Setup management not included in minimal deployment
setup_router = None

app = FastAPI(title="VXT API")

# Startup event
@app.on_event("startup")
async def startup_event():
    try:
        print("[INFO] ===== FastAPI Startup Started =====")
        print(f"[INFO] Environment: {ENVIRONMENT}")
        print(f"[INFO] Connection Driver: mssql-python (TDS protocol, native)")
        print("[INFO] ===== FastAPI Startup Complete =====")
    except Exception as e:
        print(f"[ERROR] Startup failed: {str(e)}")
        print(f"[ERROR] {traceback.format_exc()}")

# Define CORS origins based on environment
def get_cors_origins():
    """Get CORS origins from environment or use defaults for development"""
    # Always allow localhost for local development
    local_origins = [
        "http://localhost:3000",      # boat-dashboard
        "http://localhost:3001",      # admin-dashboard
        "http://localhost:3002",      # health-dashboard
        "http://localhost:5173",      # Vite dev server
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:5173",
        "http://192.168.1.29:3000",
        "http://192.168.1.29:3001",
        "http://192.168.1.29:3002",
        "http://192.168.1.29:5173",
        "http://192.168.1.22:3000",
        "http://192.168.1.22:3001",
        "http://192.168.1.22:3002",
        "http://192.168.1.22:5173"
    ]
    
    if ENVIRONMENT.lower() == 'production':
        # Production: Also allow Azure Static Web Apps
        frontend_url = os.getenv('FRONTEND_URL', 'https://ambitious-sand-0b08c3f03.6.azurestaticapps.net')
        local_origins.append(frontend_url)
    
    return local_origins

# Enable CORS for React frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom exception handlers to preserve CORS headers in error responses
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTPException with proper CORS headers"""
    cors_headers = {
        "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error": str(exc.detail)},
        headers=cors_headers
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions with proper error message and CORS headers"""
    error_msg = str(exc)
    if "database" in error_msg.lower() or "pymssql" in error_msg.lower():
        error_category = "Database Connection Error"
        suggestion = "Check that Azure SQL database is accessible and schema is deployed."
    elif "timeout" in error_msg.lower():
        error_category = "Timeout Error"
        suggestion = "The request took too long. Try again or check server status."
    else:
        error_category = "Server Error"
        suggestion = "An unexpected error occurred. Check server logs for details."
    
    cors_headers = {
        "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }
    
    print(f"[ERROR] {error_category}: {error_msg}")
    
    return JSONResponse(
        status_code=500,
        content={
            "error": error_category,
            "message": error_msg,
            "suggestion": suggestion
        },
        headers=cors_headers
    )

# Include setup management endpoints (Device Twin support) if available
if setup_router:
    try:
        app.include_router(setup_router)
        print("[INFO] Successfully included setup_management router")
    except Exception as e:
        print(f"[WARNING] Failed to include setup_management router: {str(e)}")

# ============================================================================
# CONNECTION POOL
# ============================================================================
import queue
import threading

_conn_pool: queue.Queue = queue.Queue(maxsize=10)

def get_db_connection():
    """Get a connection from the pool (or create a new one if pool is empty)."""
    conn_string = get_db_connection_string()
    if conn_string is None:
        raise Exception("SQL_CONNECTION_STRING environment variable not set")

    # Try to reuse a pooled connection
    try:
        conn = _conn_pool.get_nowait()
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.close()
            return conn  # healthy — reuse it
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
    except queue.Empty:
        pass

    # Pool empty or connection was stale — create a new one (1 retry on transient error)
    for attempt in range(2):
        try:
            conn = connect(conn_string)
            return conn
        except Exception as e:
            print(f"[ERROR] DB connect attempt {attempt + 1} failed: {str(e)}")
            if attempt < 1:
                time.sleep(2)
            else:
                raise

def return_db_connection(conn):
    """Return connection to pool; discard silently if pool is already full."""
    if conn:
        try:
            _conn_pool.put_nowait(conn)
        except queue.Full:
            try:
                conn.close()
            except Exception:
                pass



@app.get("/")
@app.get("/telemetry")
def read_root(mmsi: str = None, limit: int = 50):
    """Health check endpoint or query by MMSI if provided"""
    if mmsi:
        print(f"GET /telemetry?mmsi={mmsi}&limit={limit}")
        return get_boat_telemetry(mmsi, limit)
    return {"status": "Online", "message": "Boat Telemetry API is running"}


@app.get("/api/debug/telemetry/{entity_id}")
def debug_telemetry(entity_id: str):
    """Diagnostic: isolate mssql-python query failures"""
    results = {}
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT TOP 1 entityId FROM dbo.EntityTelemetry")
        results["step1_no_params"] = "ok"
    except Exception as e:
        results["step1_no_params"] = f"FAIL: {e}"
    try:
        cur.execute("SELECT COUNT(*) FROM dbo.EntityTelemetry WHERE entityId = ?", entity_id)
        row = cur.fetchone()
        results["step2_one_param"] = f"ok count={row[0]}"
    except Exception as e:
        results["step2_one_param"] = f"FAIL: {e}"
    try:
        cur.execute("SELECT TOP 5 entityTypeAttributeId, numericValue, endTimestampUTC FROM dbo.EntityTelemetry WHERE entityId = ? ORDER BY endTimestampUTC DESC", entity_id)
        rows = cur.fetchall()
        results["step3_select_cols"] = f"ok rows={len(rows)}"
    except Exception as e:
        results["step3_select_cols"] = f"FAIL: {e}"
    try:
        cur.execute("SELECT TOP 5 et.entityTypeAttributeId, eta.entityTypeAttributeCode FROM dbo.EntityTelemetry et JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId WHERE et.entityId = ?", entity_id)
        rows = cur.fetchall()
        results["step4_join"] = f"ok rows={len(rows)}"
    except Exception as e:
        results["step4_join"] = f"FAIL: {e}"
    try:
        cur.execute("SELECT COUNT(*) FROM dbo.EntityTelemetry WHERE entityId = ? AND endTimestampUTC >= ? AND endTimestampUTC <= ?", entity_id, "2026-01-01 00:00:00", "2026-12-31 23:59:59")
        row = cur.fetchone()
        results["step5_three_params"] = f"ok count={row[0]}"
    except Exception as e:
        results["step5_three_params"] = f"FAIL: {e}"
    cur.close()
    return_db_connection(conn)
    return results


@app.get("/health/db")
def health_check_db():
    """Database connectivity diagnostics endpoint with detailed logging"""
    try:
        print(f"[DEBUG] Health check initiated")
        print(f"[DEBUG] Environment: {ENVIRONMENT}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Test basic query
        print(f"[DEBUG] Executing: SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES")
        cursor.execute("SELECT COUNT(*) AS TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
        result = cursor.fetchone()
        table_count = result[0] if result else 0
        print(f"[DEBUG] Table count: {table_count}")
        
        # Check if critical tables exist
        critical_tables = ['EntityCategory', 'Protocol', 'Provider', 'ProviderEvent', 'Entity', 'EntityType', 'EntityTypeAttribute', 'EntityTelemetry']
        print(f"[DEBUG] Checking for critical tables: {critical_tables}")
        cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
        existing_tables = [row[0] for row in cursor.fetchall()]
        print(f"[DEBUG] Found {len(existing_tables)} tables total")
        
        missing_tables = [t for t in critical_tables if t not in existing_tables]
        if missing_tables:
            print(f"[WARNING] Missing tables: {missing_tables}")
        else:
            print(f"[INFO] All critical tables present")
        
        cursor.close()
        return_db_connection(conn)
        
        return {
            "status": "healthy" if not missing_tables else "degraded",
            "database": "connected",
            "totalTables": table_count,
            "missingTables": missing_tables,
            "existingCriticalTables": [t for t in critical_tables if t in existing_tables],
            "message": "Database is ready" if not missing_tables else f"Missing tables: {', '.join(missing_tables)}"
        }
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] Health check failed:")
        print(f"[ERROR] {error_msg}")
        print(f"[ERROR] Full traceback:")
        print(traceback.format_exc())
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": error_msg,
            "environment": ENVIRONMENT
        }


@app.get("/telemetry/{MMSI}")
def get_boat_telemetry(MMSI: str, limit: int = 50):
    """Retrieve latest telemetry data for a specific boat"""
    try:
        print(f"[INFO] GET /telemetry endpoint called")
        print(f"[INFO]   MMSI: {MMSI}")
        print(f"[INFO]   Limit: {limit}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query that extracts values from the transformed JSON structure stored by consumer
        query = """
            SELECT
                c.customerName AS CustomerName,
                et.entityTypeName AS BoatModel,
                e.entityName AS BoatName,
                e.entityId AS MMSI,
                bt.Timestamp,
                bt.EngineRPM AS EngineRPM,
                bt.CoolantTempC AS CoolantTempC,
                bt.SOG as SOG,
                bt.BatteryVoltage as BatteryVoltage,
                bt.latitude AS latitude,
                bt.longitude AS longitude
            FROM dbo.BoatTelemetry bt
            JOIN dbo.CustomerSubscriptions cs ON bt.MMSI = 'vessels.urn:mrn:imo:mmsi:' + cs.entityId
            JOIN dbo.Entity e ON cs.entityId = e.entityId
            JOIN dbo.Customers c ON c.customerId = cs.customerId
            JOIN dbo.EntityType et ON e.entityTypeCode = et.entityTypeCode
            WHERE c.customerName = 'Sailor'
              AND e.entityId = ?
              AND cs.subscriptionStartDate <= GETDATE()
              AND (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            ORDER BY bt.Timestamp DESC
            OFFSET 0 ROWS
            FETCH NEXT ? ROWS ONLY
        """
                
        # Handle MMSI - add prefix if it doesn't already have it
        #if not MMSI.startswith("vessels."):
        #    MMSI = f"vessels.urn:mrn:imo:mmsi:{MMSI}"
        #else:
        #    MMSI = MMSI
        
        print(f"[DEBUG] Executing SQL query for MMSI: {MMSI}")
        cursor.execute(query, MMSI, limit)
        rows = cursor.fetchall()
        print(f"[DEBUG] Query returned {len(rows)} rows")
        
        # Convert results to objects for React
        result = []
        for row in rows:
            timestamp = row.Timestamp
            # Handle timestamp - it might be datetime or string
            if hasattr(timestamp, 'isoformat'):
                timestamp_str = timestamp.isoformat()
            else:
                timestamp_str = str(timestamp)

            # Extract values 
            try:
                customer_name = row.CustomerName if row.CustomerName else ""
                BoatModel = row.BoatModel if row.BoatModel else ""
                BoatName = row.BoatName if row.BoatName else ""
                rpm = float(row.EngineRPM) if row.EngineRPM else 0
                temp_c = float(row.CoolantTempC) if row.CoolantTempC else 0
                speed = float(row.SOG) if row.SOG else 0
                BatteryVoltage = float(row.BatteryVoltage) if row.BatteryVoltage else 0
                latitude = float(row.latitude) if row.latitude else 0
                longitude = float(row.longitude) if row.longitude else 0

            except (TypeError, ValueError):
                customer_name = ""
                BoatName = ""
                BoatModel = ""
                rpm = 0
                temp_c = 0
                speed = 0
                BatteryVoltage = 0
                latitude = 0
                longitude = 0
            
            result.append({
                "customerName": customer_name,
                "BoatModel": BoatModel,
                "BoatName": BoatName,
                "timestamp": timestamp_str,
                "rpm": rpm,
                "temp": temp_c,
                "speed": speed,
                "batteryVoltage": BatteryVoltage,
                "latitude": latitude,
                "longitude": longitude
            })
        
        cursor.close()
        return_db_connection(conn)
        
        print(f"[INFO] Returning {len(result)} telemetry records")
        # Return in chronological order (ascending)
        return result[::-1]
        
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] get_boat_telemetry failed for MMSI={MMSI}: {error_msg}")
        print(f"[ERROR] Full traceback:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)

# new API endpoint that retrieves from EntityTelemetry
@app.get("/health/new/{ID}")
def get_health_vitals_new(ID: str, limit: int = 50):
    """Retrieve latest individual health telemetry samples (time-series format for live dashboard)"""
    try:
        print(f"[INFO] GET /health/new endpoint called")
        print(f"[INFO]   Entity ID: {ID}")
        print(f"[INFO]   Limit: {limit}")
        
        conn = get_db_connection()
        cursor = conn.cursor()

        # First, get the raw telemetry data with attribute info, then aggregate/pivot in Python
        query = """
            SELECT
                c.customerName,
                et.entityTypeName,
                e.entityFirstName,
                e.entityLastName,
                e.entityId,
                DATEADD(MINUTE, DATEDIFF(MINUTE, 0, etel.ingestionTimestampUTC), 0) AS ingestionMinute,
                etel.entityTypeAttributeId,
                eta.entityTypeAttributeCode,
                eta.entityTypeAttributeName,
                AVG(CAST(etel.numericValue AS FLOAT)) AS NumericValue,
                AVG(etel.latitude) AS Latitude,
                AVG(etel.longitude) AS Longitude,
                MAX(etel.stringValue) AS StringValue,
                etel.providerEventInterpretation,
                etel.providerDevice,
                COUNT(*) AS recordCount
            FROM dbo.EntityTelemetry etel
            JOIN dbo.EntityTypeAttribute eta ON eta.entityTypeAttributeId = etel.entityTypeAttributeId
            JOIN dbo.Entity e ON etel.entityId = e.entityId
            JOIN dbo.CustomerSubscriptions cs ON e.entityId = cs.entityId
            JOIN dbo.Customers c ON cs.customerId = c.customerId
            JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
            WHERE etel.entityId = ?
                AND etel.startTimestampUTC >= DATEADD(MINUTE, -45, GETUTCDATE())
                AND cs.subscriptionStartDate <= GETDATE()
                AND (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            GROUP BY 
                c.customerName,
                et.entityTypeName,
                e.entityFirstName,
                e.entityLastName,
                e.entityId,
                DATEADD(MINUTE, DATEDIFF(MINUTE, 0, etel.ingestionTimestampUTC), 0),
                etel.entityTypeAttributeId,
                eta.entityTypeAttributeCode,
                eta.entityTypeAttributeName,
                etel.providerEventInterpretation,
                etel.providerDevice
            ORDER BY ingestionMinute DESC
            OFFSET 0 ROWS
            FETCH NEXT ? ROWS ONLY
        """

        print(f"[DEBUG] Executing EntityTelemetry query for entity: {ID}")
        cursor.execute(query, (ID, limit))
        rows = cursor.fetchall()
        print(f"[DEBUG] EntityTelemetry query returned {len(rows)} rows")

        result = []
        seen_timestamps = {}
        attr_mapping = {}  # Cache mapping of entityTypeAttributeId to field names
        
        # Helper function to dynamically generate field name from attribute name
        def get_field_name_from_attribute(attr_name):
            """Dynamically generate field name from EntityTypeAttributeName"""
            if not attr_name:
                return None
            
            # Convert attribute name to camelCase field name
            # Remove special characters and split on spaces/underscores
            import re
            # Replace special characters and multiple spaces with single space
            cleaned = re.sub(r'[^\w\s]', '', attr_name)
            # Split on whitespace and underscores
            words = re.split(r'[\s_]+', cleaned)
            # Filter empty strings
            words = [w for w in words if w]
            
            if not words:
                return None
            
            # Convert to camelCase: first word lowercase, rest title case
            field_name = words[0].lower()
            for word in words[1:]:
                field_name += word.capitalize()
            
            return field_name
        
        for row in rows:
            # Group by timestamp to flatten attributes into a single row
            ts_key = str(row.ingestionMinute)
            
            if ts_key not in seen_timestamps:
                seen_timestamps[ts_key] = {
                    "customerName": row.customerName or "",
                    "entityType": row.entityTypeName or "",
                    "entityName": (row.entityFirstName or "") + " " + (row.entityLastName or ""),
                    "id": row.entityId or "",
                    "timestamp": row.ingestionMinute.isoformat() if hasattr(row.ingestionMinute, 'isoformat') else str(row.ingestionMinute),
                    "ecgClassification": row.providerEventInterpretation or "",
                    "afibResult": "",
                    "deviceName": row.providerDevice or "",
                    "loadedAt": row.ingestionMinute.isoformat() if hasattr(row.ingestionMinute, 'isoformat') else str(row.ingestionMinute),
                    "recordCount": row.recordCount or 0,
                }
            
            # Dynamically select attribute field name based on entityTypeAttributeId
            attr_id = row.entityTypeAttributeId
            if attr_id not in attr_mapping:
                # Map based on EntityTypeAttributeName from the database
                field_name = get_field_name_from_attribute(row.entityTypeAttributeName)
                attr_mapping[attr_id] = field_name
            
            # Apply the mapped field name if it exists
            field_name = attr_mapping.get(attr_id)
            if field_name:
                num_val = float(row.NumericValue) if row.NumericValue is not None else None
                seen_timestamps[ts_key][field_name] = num_val
        
        # Convert to list with defaults for missing metrics
        for ts_key in sorted(seen_timestamps.keys(), reverse=True):
            row_data = seen_timestamps[ts_key]
            result.append(row_data)

        cursor.close()
        return_db_connection(conn)

        print(f"[INFO] Returning {len(result)} health telemetry records")
        return result

    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] get_health_vitals_new failed for ID={ID}: {error_msg}")
        print(f"[ERROR] Full traceback:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)


@app.get("/health/{ID}")
def get_health_vitals(ID: str, limit: int = 50):
    """Retrieve latest health vitals for a specific patient"""
    try:
        print(f"[INFO] GET /health endpoint called")
        print(f"[INFO]   ID: {ID}")
        print(f"[INFO]   Limit: {limit}")
        
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT
                c.customerName AS CustomerName,
                et.entityTypeName AS EntityType,
                e.entityName AS PatientName,
                e.entityId AS ID,
                hv.Timestamp AS Timestamp,
                hv.StartTime AS StartTime,
                hv.EndTime AS EndTime,
                hv.AvgHR AS AvgHR, 
                hv.MaxHR AS MaxHR,
                hv.MinHR AS MinHR,
                hv.RestingHR AS RestingHR,
                hv.HRV_RMSSD AS HRV_RMSSD,
                hv.Systolic AS Systolic,
                hv.Diastolic AS Diastolic,
                hv.OxygenSat AS OxygenSat,
                hv.AvgGlucose AS AvgGlucose,
                hv.BreathsPerMin AS BreathsPerMin,
                hv.BodyTemp AS BodyTemp,
                hv.ECGClassification AS ECGClassification,
                hv.AfibResult AS AfibResult,
                hv.DeviceName AS DeviceName,
                hv.LoadedAt AS LoadedAt
              FROM dbo.HealthVitals hv
              JOIN dbo.CustomerSubscriptions cs ON hv.userId = cs.entityId
              JOIN dbo.Entity e ON cs.entityId = e.entityId
              JOIN dbo.Customers c ON c.customerId = cs.customerId
              JOIN dbo.EntityType et ON e.entityTypeCode = et.entityTypeCode
            WHERE e.entityId = ?
                and cs.subscriptionStartDate <= GETDATE()
                and (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            ORDER BY hv.Timestamp DESC
            OFFSET 0 ROWS
            FETCH NEXT ? ROWS ONLY
        """

        cursor.execute(query, ID, limit)
        rows = cursor.fetchall()

        result = []
        for row in rows:
            timestamp = row.Timestamp
            if hasattr(timestamp, 'isoformat'):
                timestamp_str = timestamp.isoformat()
            else:
                timestamp_str = str(timestamp)

            def _safe_num(v):
                try:
                    return float(v) if v is not None else None
                except (TypeError, ValueError):
                    return None

            result.append({
                "customerName": row.CustomerName or "",
                "gender": row.Gender or "",
                "patientName": row.PatientName or "",
                "entityId": row.ID or "",
                "timestamp": timestamp_str,
                "startTime": (row.StartTime.isoformat() if hasattr(row.StartTime, 'isoformat') else str(row.StartTime)) if row.StartTime else None,
                "endTime": (row.EndTime.isoformat() if hasattr(row.EndTime, 'isoformat') else str(row.EndTime)) if row.EndTime else None,
                "avgHR": _safe_num(row.AvgHR),
                "maxHR": _safe_num(row.MaxHR),
                "minHR": _safe_num(row.MinHR),
                "restingHR": _safe_num(row.RestingHR),
                "hrv_rmssd": _safe_num(row.HRV_RMSSD),
                "systolic": _safe_num(row.Systolic),
                "diastolic": _safe_num(row.Diastolic),
                "oxygenSat": _safe_num(row.OxygenSat),
                "avgGlucose": _safe_num(row.AvgGlucose),
                "breathsPerMin": _safe_num(row.BreathsPerMin),
                "bodyTemp": _safe_num(row.BodyTemp),
                "ecgClassification": row.ECGClassification or "",
                "afibResult": row.AfibResult or "",
                "deviceName": row.DeviceName or "",
                "loadedAt": (row.LoadedAt.isoformat() if hasattr(row.LoadedAt, 'isoformat') else str(row.LoadedAt)) if row.LoadedAt else None,
            })

        cursor.close()
        return_db_connection(conn)

        print(f"[INFO] Returning {len(result)} health vitals records")
        return result[::-1]

    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] get_health_vitals failed for ID={ID}: {error_msg}")
        print(f"[ERROR] Full traceback:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)


@app.get("/customers/{customerName}/properties")
def get_properties_by_customer_name(customerName: str):
    """
    Returns customer's properties (customerName and Customer subscriptions entities).
    """
    try:
        print(f"[INFO] GET /customers/{{customerName}}/properties called")
        print(f"[INFO]   Customer Name: {customerName}")
        
        conn = get_db_connection()
        cur = conn.cursor()
        sql = """
            SELECT DISTINCT e.entityFirstName as customerPropertyName, 
            e.entityId as entityId, 
            e.entityTypeId as propertyTypeId, 
            e.birthdate as year
            FROM CustomerSubscriptions cs
            JOIN Customers c ON cs.customerId = c.customerId
            JOIN dbo.Entity e ON cs.entityId = e.entityId
            Join dbo.EntityType et ON e.entityTypeId = et.entityTypeId
            WHERE c.customerName = ?
            and et.entityTypeName = 'Person'
            AND c.active = 'Y' AND cs.active = 'Y'
            and cs.subscriptionStartDate <= GETDATE()
            and (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            ORDER BY e.birthdate;
        """
  
        print(f"[DEBUG] Executing query for customer: {customerName}")
        cur.execute(sql, customerName)
        rows = []
        fetched = cur.fetchall()
        print(f"[DEBUG] Query returned {len(fetched)} rows")
        for r in fetched:
            rows.append({
                "customerPropertyName": r[0],
                "entityId": r[1],
                "propertyTypeId": r[2],
                "year": r[3]
            })
        cur.close()
        return_db_connection(conn)
        print(f"[INFO] Returning {len(rows)} customer properties")
        return rows
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] get_properties_by_customer_name failed for {customerName}: {error_msg}")
        print(f"[ERROR] Full traceback:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)


# ============================================
# ADMIN DASHBOARD API ENDPOINTS
# ============================================

# Entity Category Endpoints
@app.get("/entitycategories")
def get_entity_categories():
    """Get all entity categories"""
    try:
        print(f"[INFO] GET /entitycategories called")
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT entityCategoryId, entityCategoryName, active, createDate, lastUpdateTimestamp, lastUpdateUser
            FROM EntityCategory
            ORDER BY entityCategoryName
        """)
        categories = []
        for row in cur.fetchall():
            categories.append({
                "entityCategoryId": row[0],
                "entityCategoryName": row[1],
                "active": row[2],
                "createDate": row[3].isoformat() if row[3] else None,
                "lastUpdateTimestamp": row[4].isoformat() if row[4] else None,
                "lastUpdateUser": row[5]
            })
        cur.close()
        return_db_connection(conn)
        print(f"[INFO] Returning {len(categories)} entity categories")
        return categories
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] get_entity_categories failed: {error_msg}")
        print(f"[ERROR] Full traceback:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)


@app.get("/entitycategories/{id}")
def get_entity_category(id: int):
    """Get single entity category by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT entityCategoryId, entityCategoryName, active, createDate, lastUpdateTimestamp, lastUpdateUser
            FROM EntityCategory
            WHERE entityCategoryId = ?
        """, (id,))
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)
        if not row:
            raise HTTPException(status_code=404, detail="Category not found")
        return {
            "entityCategoryId": row[0],
            "entityCategoryName": row[1],
            "active": row[2],
            "createDate": row[3].isoformat() if row[3] else None,
            "lastUpdateTimestamp": row[4].isoformat() if row[4] else None,
            "lastUpdateUser": row[5]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/entitycategories")
def create_entity_category(data: dict):
    """Create new entity category"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO EntityCategory (entityCategoryName, active)
            VALUES (?, ?)
        """, (data.get("entityCategoryName"), data.get("active", "Y")))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Category created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/entitycategories/{id}")
def update_entity_category(id: int, data: dict):
    """Update entity category"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE EntityCategory
            SET entityCategoryName = ?, active = ?
            WHERE entityCategoryId = ?
        """, (data.get("entityCategoryName"), data.get("active", "Y"), id))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Category updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/entitycategories/{id}")
def delete_entity_category(id: int):
    """Delete entity category"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM EntityCategory WHERE entityCategoryId = ?", (id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Category deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Entity Type Endpoints
@app.get("/entitytypes")
def get_entity_types():
    """Get all entity types"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT entityTypeId, entityTypeName, entityCategoryId, active, createDate, lastUpdateTimestamp, lastUpdateUser
            FROM EntityType
            ORDER BY entityTypeName
        """)
        types = []
        for row in cur.fetchall():
            types.append({
                "entityTypeId": row[0],
                "entityTypeName": row[1],
                "entityCategoryId": row[2],
                "active": row[3],
                "createDate": row[4].isoformat() if row[4] else None,
                "lastUpdateTimestamp": row[5].isoformat() if row[5] else None,
                "lastUpdateUser": row[6]
            })
        cur.close()
        return_db_connection(conn)
        return types
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/entitytypes/{id}")
def get_entity_type(id: int):
    """Get single entity type by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT entityTypeId, entityTypeName, entityCategoryId, active, createDate, lastUpdateTimestamp, lastUpdateUser
            FROM EntityType
            WHERE entityTypeId = ?
        """, (id,))
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)
        if not row:
            raise HTTPException(status_code=404, detail="Entity type not found")
        return {
            "entityTypeId": row[0],
            "entityTypeName": row[1],
            "entityCategoryId": row[2],
            "active": row[3],
            "createDate": row[4].isoformat() if row[4] else None,
            "lastUpdateTimestamp": row[5].isoformat() if row[5] else None,
            "lastUpdateUser": row[6]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/entitytypes")
def create_entity_type(data: dict):
    """Create new entity type"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO EntityType (entityTypeName, entityCategoryId, active)
            VALUES (?, ?, ?)
        """, (data.get("entityTypeName"), data.get("entityCategoryId"), data.get("active", "Y")))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Entity type created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/entitytypes/{id}")
def update_entity_type(id: int, data: dict):
    """Update entity type"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE EntityType
            SET entityTypeName = ?, entityCategoryId = ?, active = ?
            WHERE entityTypeId = ?
        """, (data.get("entityTypeName"), data.get("entityCategoryId"), data.get("active", "Y"), id))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Entity type updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/entitytypes/{id}")
def delete_entity_type(id: int):
    """Delete entity type"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM EntityType WHERE entityTypeId = ?", (id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Entity type deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Entity Type Attribute Endpoints
@app.get("/entitytypeattributes")
def get_entity_type_attributes():
    """Get all entity type attributes"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT eta.entityTypeAttributeId, eta.entityTypeId, eta.protocolId, eta.entityTypeAttributeCode, 
                   eta.entityTypeAttributeName, eta.entityTypeAttributeTimeAspect, eta.entityTypeAttributeUnit, 
                   eta.providerId, eta.providerEventType, eta.active, eta.createDate, eta.lastUpdateTimestamp, eta.lastUpdateUser,
                   pa.component, eta.defaultInGraph
            FROM EntityTypeAttribute eta
            LEFT JOIN ProtocolAttribute pa ON eta.protocolId = pa.protocolId 
                AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
            WHERE eta.active = 'Y'
            ORDER BY eta.entityTypeAttributeName
        """)
        attributes = []
        for row in cur.fetchall():
            attributes.append({
                "entityTypeAttributeId": row[0],
                "entityTypeId": row[1],
                "protocolId": row[2],
                "entityTypeAttributeCode": row[3],
                "entityTypeAttributeName": row[4],
                "entityTypeAttributeTimeAspect": row[5],
                "entityTypeAttributeUnit": row[6],
                "providerId": row[7],
                "providerEventType": row[8],
                "active": row[9],
                "createDate": row[10].isoformat() if row[10] else None,
                "lastUpdateTimestamp": row[11].isoformat() if row[11] else None,
                "lastUpdateUser": row[12],
                "component": row[13],
                "defaultInGraph": row[14]
            })
        cur.close()
        return_db_connection(conn)
        return attributes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/entitytypeattributes/{id}")
def get_entity_type_attribute(id: int):
    """Get single entity type attribute by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT eta.entityTypeAttributeId, eta.entityTypeId, eta.protocolId, eta.entityTypeAttributeCode, 
                   eta.entityTypeAttributeName, eta.entityTypeAttributeTimeAspect, eta.entityTypeAttributeUnit, 
                   eta.providerId, eta.providerEventType, eta.active, eta.createDate, eta.lastUpdateTimestamp, eta.lastUpdateUser,
                   pa.component, eta.defaultInGraph
            FROM EntityTypeAttribute eta
            LEFT JOIN ProtocolAttribute pa ON eta.protocolId = pa.protocolId 
                AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
            WHERE eta.entityTypeAttributeId = ?
        """, (id,))
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)
        if not row:
            raise HTTPException(status_code=404, detail="Attribute not found")
        return {
            "entityTypeAttributeId": row[0],
            "entityTypeId": row[1],
            "protocolId": row[2],
            "entityTypeAttributeCode": row[3],
            "entityTypeAttributeName": row[4],
            "entityTypeAttributeTimeAspect": row[5],
            "entityTypeAttributeUnit": row[6],
            "providerId": row[7],
            "providerEventType": row[8],
            "active": row[9],
            "createDate": row[10].isoformat() if row[10] else None,
            "lastUpdateTimestamp": row[11].isoformat() if row[11] else None,
            "lastUpdateUser": row[12],
            "component": row[13],
            "defaultInGraph": row[14]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/entitytypeattributes")
def create_entity_type_attribute(data: dict):
    """Create new entity type attribute"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO EntityTypeAttribute 
            (entityTypeId, protocolId, entityTypeAttributeCode, entityTypeAttributeName, 
             entityTypeAttributeTimeAspect, entityTypeAttributeUnit, active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("entityTypeId"),
            data.get("protocolId"),
            data.get("entityTypeAttributeCode"),
            data.get("entityTypeAttributeName"),
            data.get("entityTypeAttributeTimeAspect", "Pt"),
            data.get("entityTypeAttributeUnit"),
            data.get("active", "Y")
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Attribute created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/entitytypeattributes/{id}")
def update_entity_type_attribute(id: int, data: dict):
    """Update entity type attribute"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE EntityTypeAttribute
            SET entityTypeId = ?, protocolId = ?, entityTypeAttributeCode = ?, 
                entityTypeAttributeName = ?, entityTypeAttributeTimeAspect = ?, 
                entityTypeAttributeUnit = ?, active = ?, defaultInGraph = ?, 
                providerId = ?, providerEventType = ?
            WHERE entityTypeAttributeId = ?
        """, (
            data.get("entityTypeId"),
            data.get("protocolId"),
            data.get("entityTypeAttributeCode"),
            data.get("entityTypeAttributeName"),
            data.get("entityTypeAttributeTimeAspect", "Pt"),
            data.get("entityTypeAttributeUnit"),
            data.get("active", "Y"),
            data.get("defaultInGraph", "N"),
            data.get("providerId"),
            data.get("providerEventType"),
            id
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Attribute updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/entitytypeattributes/{id}")
def delete_entity_type_attribute(id: int):
    """Delete entity type attribute"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM EntityTypeAttribute WHERE entityTypeAttributeId = ?", (id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Attribute deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Protocol Endpoints
@app.get("/protocols")
def get_protocols():
    """Get all protocols"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT protocolId, protocolName, protocolVersion, ISNULL(description, '') AS protocolDescription, kafkaTopic, active
            FROM Protocol
            WHERE active = 'Y'
            ORDER BY protocolName
        """)
        protocols = []
        for row in cur.fetchall():
            protocols.append({
                "protocolId": row[0],
                "protocolName": row[1],
                "protocolVersion": row[2],
                "protocolDescription": row[3],
                "kafkaTopic": row[4],
                "active": row[5]
            })
        cur.close()
        return_db_connection(conn)
        return protocols
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Protocol Attribute Endpoints
@app.get("/protocolattributes")
def get_protocol_attributes(protocolId: int = None):
    """Get all protocol attributes, optionally filtered by protocolId"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        if protocolId:
            cur.execute("""
                SELECT protocolAttributeId, protocolId, protocolAttributeCode, protocolAttributeName, 
                       description, component, unit, dataType, rangeMin, rangeMax, active
                FROM ProtocolAttribute
                WHERE protocolId = ? AND active = 'Y'
                ORDER BY protocolAttributeCode
            """, (protocolId,))
        else:
            cur.execute("""
                SELECT protocolAttributeId, protocolId, protocolAttributeCode, protocolAttributeName, 
                       description, component, unit, dataType, rangeMin, rangeMax, active
                FROM ProtocolAttribute
                WHERE active = 'Y'
                ORDER BY protocolAttributeCode
            """)
        attributes = []
        for row in cur.fetchall():
            attributes.append({
                "protocolAttributeId": row[0],
                "protocolId": row[1],
                "protocolAttributeCode": row[2],
                "protocolAttributeName": row[3],
                "description": row[4],
                "component": row[5],
                "unit": row[6],
                "dataType": row[7],
                "rangeMin": row[8],
                "rangeMax": row[9],
                "active": row[10]
            })
        cur.close()
        return_db_connection(conn)
        return attributes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Provider Endpoints
@app.get("/providers")
def get_providers():
    """Get all providers"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT providerId, providerName, providerDescription, providerCategory, 
                   apiBaseUrl, apiVersion, documentationUrl, active
            FROM Provider
            ORDER BY providerName
        """)
        providers = []
        for row in cur.fetchall():
            providers.append({
                "providerId": row[0],
                "providerName": row[1],
                "providerDescription": row[2],
                "providerCategory": row[3],
                "apiBaseUrl": row[4],
                "apiVersion": row[5],
                "documentationUrl": row[6],
                "active": row[7]
            })
        cur.close()
        return_db_connection(conn)
        return providers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/providers")
def create_provider(data: dict):
    """Create a new provider"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO Provider (providerName, providerDescription, providerCategory, 
                                 apiBaseUrl, apiVersion, documentationUrl, active, 
                                 createDate, lastUpdateTimestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
        """, (
            data.get("providerName"),
            data.get("providerDescription", ""),
            data.get("providerCategory", ""),
            data.get("apiBaseUrl"),
            data.get("apiVersion"),
            data.get("documentationUrl"),
            data.get("active", "Y")
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Provider created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/providers/{provider_id}")
def update_provider(provider_id: int, data: dict):
    """Update an existing provider"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE Provider
            SET providerName = ?, providerDescription = ?, providerCategory = ?,
                apiBaseUrl = ?, apiVersion = ?, documentationUrl = ?, 
                active = ?, lastUpdateTimestamp = GETDATE()
            WHERE providerId = ?
        """, (
            data.get("providerName"),
            data.get("providerDescription", ""),
            data.get("providerCategory", ""),
            data.get("apiBaseUrl"),
            data.get("apiVersion"),
            data.get("documentationUrl"),
            data.get("active", "Y"),
            provider_id
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Provider updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/providers/{provider_id}")
def delete_provider(provider_id: int):
    """Delete a provider"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM Provider WHERE providerId = ?", (provider_id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Provider deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Protocol Endpoints (POST, PUT, DELETE)
@app.post("/protocols")
def create_protocol(data: dict):
    """Create a new protocol"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO Protocol (protocolName, protocolDescription, protocolVersion, kafkaTopic, active, 
                                 createDate, lastUpdateTimestamp)
            VALUES (?, ?, ?, ?, ?, GETDATE(), GETDATE())
        """, (
            data.get("protocolName"),
            data.get("protocolDescription", ""),
            data.get("protocolVersion", ""),
            data.get("kafkaTopic", ""),
            data.get("active", "Y")
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Protocol created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/protocols/{protocol_id}")
def update_protocol(protocol_id: int, data: dict):
    """Update an existing protocol"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE Protocol
            SET protocolName = ?, protocolDescription = ?, active = ?, lastUpdateTimestamp = GETDATE()
            WHERE protocolId = ?
        """, (
            data.get("protocolName"),
            data.get("protocolDescription", ""),
            data.get("active", "Y"),
            protocol_id
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Protocol updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/protocols/{protocol_id}")
def delete_protocol(protocol_id: int):
    """Delete a protocol"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM Protocol WHERE protocolId = ?", (protocol_id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Protocol deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ProtocolAttribute Endpoints (POST, PUT, DELETE)
@app.post("/protocolattributes")
def create_protocol_attribute(data: dict):
    """Create a new protocol attribute"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO ProtocolAttribute (protocolId, protocolAttributeCode, protocolAttributeName, 
                                          description, component, unit, dataType, rangeMin, rangeMax, 
                                          active, createDate, lastUpdateTimestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
        """, (
            data.get("protocolId"),
            data.get("protocolAttributeCode"),
            data.get("protocolAttributeName"),
            data.get("description", ""),
            data.get("component", ""),
            data.get("unit", ""),
            data.get("dataType", ""),
            data.get("rangeMin", None),
            data.get("rangeMax", None),
            data.get("active", "Y")
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Protocol attribute created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/protocolattributes/{attribute_id}")
def update_protocol_attribute(attribute_id: int, data: dict):
    """Update an existing protocol attribute"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE ProtocolAttribute
            SET protocolId = ?, protocolAttributeCode = ?, protocolAttributeName = ?, 
                description = ?, component = ?, unit = ?, dataType = ?, 
                rangeMin = ?, rangeMax = ?, active = ?, lastUpdateTimestamp = GETDATE()
            WHERE protocolAttributeId = ?
        """, (
            data.get("protocolId"),
            data.get("protocolAttributeCode"),
            data.get("protocolAttributeName"),
            data.get("description", ""),
            data.get("component", ""),
            data.get("unit", ""),
            data.get("dataType", ""),
            data.get("rangeMin", None),
            data.get("rangeMax", None),
            data.get("active", "Y"),
            attribute_id
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Protocol attribute updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/protocolattributes/{attribute_id}")
def delete_protocol_attribute(attribute_id: int):
    """Delete a protocol attribute"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM ProtocolAttribute WHERE protocolAttributeId = ?", (attribute_id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Protocol attribute deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ProviderEvent Endpoints
@app.get("/providerevents")
def get_provider_events():
    """Get all provider events"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT providerEventId, providerId, providerEventName, providerEventType, 
                   providerEventDescription, providerNamespace, protocolAttributeCode, ProtocolId, active
            FROM ProviderEvent
            ORDER BY providerEventName
        """)
        events = []
        for row in cur.fetchall():
            events.append({
                "providerEventId": row[0],
                "providerId": row[1],
                "providerEventName": row[2],
                "providerEventType": row[3],
                "providerEventDescription": row[4],
                "providerNamespace": row[5],
                "protocolAttributeCode": row[6],
                "protocolId": row[7],
                "active": row[8]
            })
        cur.close()
        return_db_connection(conn)
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/providerevents")
def create_provider_event(data: dict):
    """Create a new provider event"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO ProviderEvent (providerId, providerEventType, providerEventDescription, 
                                      providerNamespace, providerEventName, protocolAttributeCode, ProtocolId, active, createDate, lastUpdateTimestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
        """, (
            data.get("providerId"),
            data.get("providerEventType", ""),
            data.get("providerEventDescription", ""),
            data.get("providerNamespace", ""),
            data.get("providerEventName", ""),
            data.get("protocolAttributeCode", None),
            data.get("protocolId", None),
            data.get("active", "Y")
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Provider event created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/providerevents/{event_id}")
def update_provider_event(event_id: int, data: dict):
    """Update an existing provider event"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE ProviderEvent
            SET providerId = ?, providerEventType = ?, providerEventDescription = ?, 
                providerNamespace = ?, providerEventName = ?, protocolAttributeCode = ?, ProtocolId = ?, active = ?, lastUpdateTimestamp = GETDATE()
            WHERE providerEventId = ?
        """, (
            data.get("providerId"),
            data.get("providerEventType", ""),
            data.get("providerEventDescription", ""),
            data.get("providerNamespace", ""),
            data.get("providerEventName", ""),
            data.get("protocolAttributeCode", None),
            data.get("protocolId", None),
            data.get("active", "Y"),
            event_id
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Provider event updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/providerevents/{event_id}")
def delete_provider_event(event_id: int):
    """Delete a provider event"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM ProviderEvent WHERE providerEventId = ?", (event_id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"status": "success", "message": "Provider event deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Entity Type Criteria Endpoints
@app.get("/entitytypeattributescore")
def get_entity_type_attribute_score(attributeId: int = None):
    """Get all entity type attribute scores, optionally filtered by attributeId"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        if attributeId:
            cur.execute("""
                SELECT entityTypeAttributeScoreId, entityTypeAttributeId, strValue, 
                       minValue, maxValue, score, active, createDate, lastUpdateTimestamp
                FROM EntityTypeAttributeScore
                WHERE entityTypeAttributeId = ? AND active = 'Y'
                ORDER BY minValue
            """, (attributeId,))
        else:
            cur.execute("""
                SELECT entityTypeAttributeScoreId, entityTypeAttributeId, strValue, 
                       minValue, maxValue, score, active, createDate, lastUpdateTimestamp
                FROM EntityTypeAttributeScore
                WHERE active = 'Y'
                ORDER BY entityTypeAttributeId
            """)
        criteria = []
        for row in cur.fetchall():
            criteria.append({
                "entityTypeAttributeScoreId": row[0],
                "entityTypeAttributeId": row[1],
                "strValue": row[2],
                "minValue": row[3],
                "maxValue": row[4],
                "score": row[5],
                "active": row[6],
                "createDate": row[7].isoformat() if row[7] else None,
                "lastUpdateTimestamp": row[8].isoformat() if row[8] else None
            })
        cur.close()
        return_db_connection(conn)
        return criteria
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/entitytypeattributescore")
def create_entity_type_attribute_score(data: dict):
    """Create new entity type attribute score"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO EntityTypeAttributeScore 
            (entityTypeAttributeId, strValue, minValue, maxValue, score, active)
            VALUES (?, ?, ?, ?, ?, 'Y')
        """, (
            data.get("entityTypeAttributeId"),
            data.get("strValue"),
            data.get("minValue"),
            data.get("maxValue"),
            data.get("score")
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Attribute score created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/entitytypeattributescore/{id}")
def update_entity_type_attribute_score(id: int, data: dict):
    """Update entity type attribute score"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE EntityTypeAttributeScore
            SET strValue = ?, minValue = ?, maxValue = ?, score = ?
            WHERE entityTypeAttributeScoreId = ?
        """, (
            data.get("strValue"),
            data.get("minValue"),
            data.get("maxValue"),
            data.get("score"),
            id
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Attribute score updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/entitytypeattributescore/{id}")
def delete_entity_type_attribute_score(id: int):
    """Delete entity type attribute score"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM EntityTypeAttributeScore WHERE entityTypeAttributeScoreId = ?", (id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Criterion deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Event Management Endpoints
@app.get("/events")
def get_events(entityTypeId: int = None):
    """Get all events, optionally filtered by entityTypeId"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        if entityTypeId:
            cur.execute("""
                SELECT eventId, eventCode, eventDescription, entityTypeId, minCumulatedScore, maxCumulatedScore, 
                       risk, AnalyzeFunctionId, LookbackMinutes, BaselineDays, SensitivityThreshold, MinSamplesRequired,
                       CustomParams, active, createDate, lastUpdateTimestamp
                FROM Event
                WHERE entityTypeId = ? AND active = 'Y'
                ORDER BY eventCode
            """, (entityTypeId,))
        else:
            cur.execute("""
                SELECT eventId, eventCode, eventDescription, entityTypeId, minCumulatedScore, maxCumulatedScore, 
                       risk, AnalyzeFunctionId, LookbackMinutes, BaselineDays, SensitivityThreshold, MinSamplesRequired,
                       CustomParams, active, createDate, lastUpdateTimestamp
                FROM Event
                WHERE active = 'Y'
                ORDER BY eventCode
            """)
        events = []
        for row in cur.fetchall():
            events.append({
                "eventId": row[0],
                "eventCode": row[1],
                "eventDescription": row[2],
                "entityTypeId": row[3],
                "minCumulatedScore": row[4],
                "maxCumulatedScore": row[5],
                "risk": row[6],
                "AnalyzeFunctionId": row[7],
                "LookbackMinutes": row[8],
                "BaselineDays": row[9],
                "SensitivityThreshold": row[10],
                "MinSamplesRequired": row[11],
                "CustomParams": row[12],
                "active": row[13],
                "createDate": row[14].isoformat() if row[14] else None,
                "lastUpdateTimestamp": row[15].isoformat() if row[15] else None
            })
        cur.close()
        return_db_connection(conn)
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/events/{id}")
def get_event(id: int):
    """Get a specific event by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT eventId, eventCode, eventDescription, entityTypeId, minCumulatedScore, maxCumulatedScore, 
                   risk, AnalyzeFunctionId, LookbackMinutes, BaselineDays, SensitivityThreshold, MinSamplesRequired,
                   CustomParams, active, createDate, lastUpdateTimestamp
            FROM Event
            WHERE eventId = ? AND active = 'Y'
        """, (id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Event not found")
        
        event = {
            "eventId": row[0],
            "eventCode": row[1],
            "eventDescription": row[2],
            "entityTypeId": row[3],
            "minCumulatedScore": row[4],
            "maxCumulatedScore": row[5],
            "risk": row[6],
            "AnalyzeFunctionId": row[7],
            "LookbackMinutes": row[8],
            "BaselineDays": row[9],
            "SensitivityThreshold": row[10],
            "MinSamplesRequired": row[11],
            "CustomParams": row[12],
            "active": row[13],
            "createDate": row[14].isoformat() if row[14] else None,
            "lastUpdateTimestamp": row[15].isoformat() if row[15] else None
        }
        cur.close()
        return_db_connection(conn)
        return event
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/events")
def create_event(data: dict):
    """Create a new event"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO Event (eventCode, eventDescription, entityTypeId, minCumulatedScore, maxCumulatedScore, 
                              risk, AnalyzeFunctionId, LookbackMinutes, BaselineDays, SensitivityThreshold, 
                              MinSamplesRequired, CustomParams, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Y')
        """, (
            data.get("eventCode"),
            data.get("eventDescription"),
            data.get("entityTypeId"),
            data.get("minCumulatedScore"),
            data.get("maxCumulatedScore"),
            data.get("risk", "NONE"),
            data.get("AnalyzeFunctionId"),
            data.get("LookbackMinutes"),
            data.get("BaselineDays"),
            data.get("SensitivityThreshold"),
            data.get("MinSamplesRequired"),
            data.get("CustomParams")
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Event created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/events/{id}")
def update_event(id: int, data: dict):
    """Update an existing event"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE Event
            SET eventCode = ?, eventDescription = ?, entityTypeId = ?, minCumulatedScore = ?, maxCumulatedScore = ?,
                risk = ?, AnalyzeFunctionId = ?, LookbackMinutes = ?, BaselineDays = ?, SensitivityThreshold = ?,
                MinSamplesRequired = ?, CustomParams = ?
            WHERE eventId = ?
        """, (
            data.get("eventCode"),
            data.get("eventDescription"),
            data.get("entityTypeId"),
            data.get("minCumulatedScore"),
            data.get("maxCumulatedScore"),
            data.get("risk", "NONE"),
            data.get("AnalyzeFunctionId"),
            data.get("LookbackMinutes"),
            data.get("BaselineDays"),
            data.get("SensitivityThreshold"),
            data.get("MinSamplesRequired"),
            data.get("CustomParams"),
            id
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Event updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/events/{id}")
def delete_event(id: int):
    """Soft delete an event"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE Event SET active = 'N' WHERE eventId = ?", (id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Event deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# EventAttribute Management Endpoints
@app.get("/eventattributes")
def get_event_attributes(eventId: int = None):
    """Get all event attributes, optionally filtered by eventId"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        if eventId:
            cur.execute("""
                SELECT ea.eventId, ea.entityTypeAttributeId, eta.entityTypeAttributeCode, eta.entityTypeAttributeName
                FROM EventAttribute ea
                JOIN EntityTypeAttribute eta ON ea.entityTypeAttributeId = eta.entityTypeAttributeId
                WHERE ea.eventId = ? AND ea.active = 'Y'
                ORDER BY eta.entityTypeAttributeName
            """, (eventId,))
        else:
            cur.execute("""
                SELECT ea.eventId, ea.entityTypeAttributeId, eta.entityTypeAttributeCode, eta.entityTypeAttributeName
                FROM EventAttribute ea
                JOIN EntityTypeAttribute eta ON ea.entityTypeAttributeId = eta.entityTypeAttributeId
                WHERE ea.active = 'Y'
                ORDER BY ea.eventId
            """)
        attributes = []
        for row in cur.fetchall():
            attributes.append({
                "eventId": row[0],
                "entityTypeAttributeId": row[1],
                "entityTypeAttributeCode": row[2],
                "entityTypeAttributeName": row[3]
            })
        cur.close()
        return_db_connection(conn)
        return attributes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/eventattributes")
def create_event_attribute(data: dict):
    """Create a new event attribute mapping"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO EventAttribute (eventId, entityTypeAttributeId, active)
            VALUES (?, ?, 'Y')
        """, (
            data.get("eventId"),
            data.get("entityTypeAttributeId")
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Event attribute created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/eventattributes")
def delete_event_attribute(eventId: int, attributeId: int):
    """Soft delete an event attribute"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE EventAttribute SET active = 'N' WHERE eventId = ? AND entityTypeAttributeId = ?", 
                   (eventId, attributeId))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Event attribute deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# AnalyzeFunction Management Endpoints
@app.get("/analyzefunctions")
def get_analyze_functions():
    """Get all analyze functions"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT AnalyzeFunctionId, FunctionName, FunctionType, AnalyzePath, active, createDate, lastUpdateTimestamp
            FROM AnalyzeFunction
            WHERE active = 'Y'
            ORDER BY FunctionName
        """)
        functions = []
        for row in cur.fetchall():
            functions.append({
                "AnalyzeFunctionId": row[0],
                "FunctionName": row[1],
                "FunctionType": row[2],
                "AnalyzePath": row[3],
                "active": row[4],
                "createDate": row[5].isoformat() if row[5] else None,
                "lastUpdateTimestamp": row[6].isoformat() if row[6] else None
            })
        cur.close()
        return_db_connection(conn)
        return functions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Entity Management Endpoints
@app.get("/entities")
def get_entities(entityTypeId: int = None):
    """Get all entities, optionally filtered by entityTypeId"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        sql = """
            SELECT e.entityId, e.entityFirstName, e.entityLastName, e.entityTypeId, et.entityTypeName,
                   e.gender, e.birthDate, e.active
            FROM Entity e
            JOIN EntityType et ON e.entityTypeId = et.entityTypeId
        """
        
        if entityTypeId:
            sql += f" WHERE e.entityTypeId = {entityTypeId}"
        
        cur.execute(sql)
        rows = cur.fetchall()
        
        entities = []
        for row in rows:
            entity = {
                "entityId": str(row[0]) if row[0] else None,
                "entityFirstName": str(row[1]) if row[1] else None,
                "entityLastName": str(row[2]) if row[2] else None,
                "entityTypeId": int(row[3]) if row[3] else None,
                "entityTypeName": str(row[4]) if row[4] else None,
                "gender": str(row[5]) if row[5] else None,
                "birthDate": str(row[6]) if row[6] else None,
                "active": str(row[7]) if row[7] else None
            }
            entities.append(entity)
        
        cur.close()
        return_db_connection(conn)
        
        return entities
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/entities/{id}")
def get_entity(id: str):
    """Get a specific entity by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT e.entityId, e.entityFirstName, e.entityLastName, e.entityTypeId, et.entityTypeName,
                   e.gender, e.birthDate, e.active, e.createDate, e.lastUpdateTimestamp, e.lastUpdateUser
            FROM Entity e
            JOIN EntityType et ON e.entityTypeId = et.entityTypeId
            WHERE e.entityId = ? AND e.active = 'Y'
        """, (id,))
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)
        if not row:
            raise HTTPException(status_code=404, detail="Entity not found")
        
        entity = {
            "entityId": row[0],
            "entityFirstName": row[1],
            "entityLastName": row[2],
            "entityTypeId": row[3],
            "entityTypeName": row[4],
            "gender": row[5],
            "birthDate": row[6].isoformat() if row[6] else None,
            "active": row[7],
            "createDate": row[8].isoformat() if row[8] else None,
            "lastUpdateTimestamp": row[9].isoformat() if row[9] else None,
            "lastUpdateUser": row[10]
        }
        return entity
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/entities")
def create_entity(data: dict):
    """Create a new entity"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO Entity (entityId, entityFirstName, entityLastName, entityTypeId, gender, birthDate, active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("entityId"),
            data.get("entityFirstName"),
            data.get("entityLastName"),
            data.get("entityTypeId"),
            data.get("gender"),
            data.get("birthDate"),
            data.get("active", "Y")
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Entity created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/entities/{id}")
def update_entity(id: str, data: dict):
    """Update an entity"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE Entity
            SET entityFirstName = ?, entityLastName = ?, entityTypeId = ?, gender = ?, birthDate = ?, active = ?
            WHERE entityId = ?
        """, (
            data.get("entityFirstName"),
            data.get("entityLastName"),
            data.get("entityTypeId"),
            data.get("gender"),
            data.get("birthDate"),
            data.get("active", "Y"),
            id
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Entity updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/entities/{id}")
def delete_entity(id: str):
    """Soft delete an entity"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE Entity SET active = 'N' WHERE entityId = ?", (id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Entity deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MANUAL REPORT ENDPOINT
# Accepts a manual telemetry measurement and publishes it to the configured
# gateway: Kafka (local Redpanda) or Azure IoT Hub (Device REST API).
# ============================================================================

import hmac as _hmac
import hashlib as _hashlib
import base64 as _base64
import urllib.parse as _urlparse
import time as _time_module
import requests as _requests

def _build_iothub_sas(resource_uri: str, key: str, expiry_s: int = 3600) -> str:
    expiry = int(_time_module.time()) + expiry_s
    str_to_sign = f"{_urlparse.quote_plus(resource_uri)}\n{expiry}"
    key_bytes = _base64.b64decode(key)
    sig = _base64.b64encode(
        _hmac.new(key_bytes, str_to_sign.encode('utf-8'), _hashlib.sha256).digest()
    ).decode()
    return (
        f"SharedAccessSignature sr={_urlparse.quote_plus(resource_uri)}"
        f"&sig={_urlparse.quote_plus(sig)}&se={expiry}"
    )

@app.post("/api/manual-report")
def post_manual_report(data: dict):
    """
    Publish a manual telemetry measurement to the configured gateway.

    Body fields:
      entityId, entityTypeAttributeCode, value, timestamp, source,
      gatewayType ('kafka' | 'iothub'),
      kafkaBootstrap, kafkaTopic  (for kafka),
      iotHubConnectionString      (for iothub),
      _dryRun (bool, optional)    — test connection only, do not send data.
    """
    try:
        entity_id  = str(data.get('entityId', ''))
        attr_code  = str(data.get('entityTypeAttributeCode', ''))
        value      = data.get('value', 0)
        timestamp  = data.get('timestamp') or datetime.utcnow().isoformat() + 'Z'
        source     = data.get('source', 'Manual')
        gw_type    = data.get('gatewayType', 'kafka')
        dry_run    = bool(data.get('_dryRun', False))

        if dry_run:
            # Connection test — just validate config without sending
            if gw_type == 'kafka':
                bootstrap = data.get('kafkaBootstrap', '127.0.0.1:9092')
                try:
                    from confluent_kafka.admin import AdminClient
                    admin = AdminClient({'bootstrap.servers': bootstrap, 'socket.timeout.ms': 5000})
                    admin.list_topics(timeout=5)
                    return {"message": f"Kafka reachable at {bootstrap}"}
                except ImportError:
                    raise HTTPException(status_code=501, detail="confluent_kafka not available in this environment")
                except Exception as e:
                    raise HTTPException(status_code=503, detail=f"Kafka unreachable: {e}")
            else:
                conn_str = data.get('iotHubConnectionString', '')
                if not conn_str:
                    raise HTTPException(status_code=400, detail="iotHubConnectionString is required")
                parts = dict(p.split('=', 1) for p in conn_str.split(';') if '=' in p)
                hostname = parts.get('HostName', '')
                if not hostname:
                    raise HTTPException(status_code=400, detail="Invalid connection string — HostName missing")
                return {"message": f"IoT Hub hostname: {hostname} — config looks valid"}

        # ── Build message payload ──────────────────────────────────────────
        if gw_type == 'kafka':
            # Junction format — auto-detected by consumer via 'user' + 'event_type' keys.
            # event_type IS the entityTypeAttributeCode (LOINC code), value goes in data.manual.summary.
            message = {
                "user":       {"user_id": entity_id},
                "event_type": attr_code,
                "timestamp":  timestamp,
                "data": {
                    "manual": {
                        "summary": {"value": value}
                    }
                },
            }
            bootstrap = data.get('kafkaBootstrap', '127.0.0.1:9092')
            topic     = data.get('kafkaTopic', 'iot-telemetry')
            try:
                from confluent_kafka import Producer
            except ImportError:
                raise HTTPException(status_code=501, detail="confluent_kafka not available in this environment")
            producer = Producer({'bootstrap.servers': bootstrap, 'socket.timeout.ms': 10000})
            producer.produce(topic, value=json.dumps(message).encode('utf-8'), key=entity_id.encode('utf-8'))
            producer.flush(timeout=10)
            return {"message": f"Published to Kafka topic '{topic}' on {bootstrap}"}

        else:  # iothub
            conn_str = data.get('iotHubConnectionString', '')
            if not conn_str:
                raise HTTPException(status_code=400, detail="iotHubConnectionString is required")
            parts = dict(p.split('=', 1) for p in conn_str.split(';') if '=' in p)
            hostname  = parts.get('HostName', '')
            device_id = parts.get('DeviceId', '')
            sak       = parts.get('SharedAccessKey', '')
            if not hostname or not device_id or not sak:
                raise HTTPException(status_code=400, detail="Invalid IoT Hub connection string")

            # TelemetryData format (matches what MqttTransport sends from the mobile app)
            message = {
                "deviceId":  entity_id,
                "timestamp": timestamp,
                "values":    {attr_code: value},
                "source":    source,
            }
            resource_uri = f"{hostname}/devices/{device_id}"
            sas_token    = _build_iothub_sas(resource_uri, sak)
            url = f"https://{hostname}/devices/{device_id}/messages/events?api-version=2018-06-30"
            headers = {"Authorization": sas_token, "Content-Type": "application/json"}
            resp = _requests.post(url, headers=headers, data=json.dumps(message), timeout=15)
            if resp.status_code not in (200, 204):
                raise HTTPException(status_code=502, detail=f"IoT Hub returned {resp.status_code}: {resp.text}")
            return {"message": f"Published to Azure IoT Hub device '{device_id}'"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# TELEMETRY AND EVENTS ANALYTICS ENDPOINTS
# ============================================================================

@app.get("/api/telemetry/latest/{entity_id}")
def get_latest_telemetry(entity_id: str):
    """Get the latest telemetry value for each attribute for an entity"""
    try:
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', entity_id):
            raise HTTPException(status_code=400, detail="Invalid entity_id")
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Use ? placeholder with varargs execute (matches working endpoint pattern)
        query = """
        WITH LatestPerAttribute AS (
          SELECT
            eta.entityTypeAttributeId,
            eta.entityTypeAttributeCode,
            eta.entityTypeAttributeName,
            eta.entityTypeAttributeUnit,
            eta.defaultInGraph,
            et.numericValue,
            et.stringValue,
            et.endTimestampUTC,
            pa.protocolAttributeCode,
            pa.description,
            ROW_NUMBER() OVER (PARTITION BY eta.entityTypeAttributeId ORDER BY et.endTimestampUTC DESC) AS rn
          FROM dbo.EntityTelemetry et WITH (NOLOCK)
          JOIN dbo.EntityTypeAttribute eta WITH (NOLOCK) ON et.entityTypeAttributeId = eta.entityTypeAttributeId
          LEFT JOIN dbo.ProtocolAttribute pa WITH (NOLOCK) ON eta.protocolId = pa.protocolId 
            AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
          WHERE et.entityId = ?
            AND (et.numericValue IS NOT NULL OR et.stringValue IS NOT NULL)
        )
        SELECT 
          entityTypeAttributeId,
          entityTypeAttributeCode,
          entityTypeAttributeName,
          entityTypeAttributeUnit,
          defaultInGraph,
          numericValue,
          stringValue,
          endTimestampUTC,
          protocolAttributeCode,
          description
        FROM LatestPerAttribute 
        WHERE rn = 1
        ORDER BY entityTypeAttributeCode
        """
        
        print(f"[LATESTTEL] entity_id={entity_id!r}")
        cur.execute(query, entity_id)
        rows = cur.fetchall()
        cur.close()
        return_db_connection(conn)
        
        results = []
        for row in rows:
            results.append({
                "entityTypeAttributeId": row[0],
                "attributeCode": row[1],
                "attributeName": row[2],
                "attributeUnit": row[3],
                "defaultInGraph": row[4],
                "numericValue": row[5],
                "stringValue": row[6],
                "endTimestampUTC": row[7],
                "protocolAttributeCode": row[8],
                "description": row[9]
            })
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/telemetry/range/{entity_id}")
def get_telemetry_range(entity_id: str, startDate: str, endDate: str):
    """Get telemetry data for an entity within a date range, formatted for charting"""
    try:
        print(f"\n{'='*60}")
        print(f"GET /api/telemetry/range/{entity_id}")
        print(f"   startDate (received): '{startDate}'")
        print(f"   endDate (received): '{endDate}'")
        print(f"   startDate type: {type(startDate)}, len: {len(startDate) if startDate else 0}")
        print(f"   endDate type: {type(endDate)}, len: {len(endDate) if endDate else 0}")
        print(f"{'='*60}")
        
        # Validate dates
        if not startDate or not endDate:
            print(f"ERROR: Missing date parameters!")
            raise HTTPException(status_code=400, detail="startDate and endDate parameters are required and cannot be empty")
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Frontend now sends UTC ISO format strings (e.g., "2026-02-15T12:48:00.000Z")
        # Just use them directly for database query
        print(f"Executing telemetry query with:")
        print(f"   Entity ID: {entity_id}")
        print(f"   Start: {startDate}")
        print(f"   End: {endDate}")
        
        # Python datetime parsing - much more robust than SQL Server CONVERT()
        # JavaScript sends ISO format like "2026-02-21T11:45:51.597184Z"
        # We need to parse this properly
        from datetime import datetime as dt_class
        
        try:
            # Remove 'Z' suffix if present and parse ISO format
            start_str = startDate.replace('Z', '') if startDate.endswith('Z') else startDate
            end_str = endDate.replace('Z', '') if endDate.endswith('Z') else endDate
            
            # Parse ISO format datetime
            start_dt = dt_class.fromisoformat(start_str)
            end_dt = dt_class.fromisoformat(end_str)
            
            # Format as SQL Server datetime string (safe - comes from fromisoformat)
            start_sql = start_dt.strftime('%Y-%m-%d %H:%M:%S')
            end_sql = end_dt.strftime('%Y-%m-%d %H:%M:%S')
            
            print(f"   Parsed dates - Start: {start_sql}, End: {end_sql}")
        except Exception as parse_err:
            print(f"ERROR: Date parsing error: {parse_err}")
            raise HTTPException(status_code=400, detail=f"Invalid date format: {str(parse_err)}")
        
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', entity_id):
            raise HTTPException(status_code=400, detail="Invalid entity_id")
        
        # Use ? placeholder with varargs execute (matches working endpoint pattern)
        # TOP 20000 = safety cap so COLUMNSTORE scan doesn't block uvicorn for minutes
        query = """
        SELECT TOP 20000
            et.entityTypeAttributeId,
            eta.entityTypeAttributeCode,
            et.numericValue,
            et.endTimestampUTC,
            et.latitude,
            et.longitude
        FROM dbo.EntityTelemetry et WITH (NOLOCK)
        JOIN dbo.EntityTypeAttribute eta WITH (NOLOCK) ON et.entityTypeAttributeId = eta.entityTypeAttributeId
        WHERE et.entityId = ?
          AND et.endTimestampUTC >= ?
          AND et.endTimestampUTC <= ?
        ORDER BY et.endTimestampUTC ASC
        """
        
        cur.execute(query, entity_id, start_sql, end_sql)
        rows = cur.fetchall()
        print(f"OK: Query executed. Raw row count: {len(rows)}")
        cur.close()
        return_db_connection(conn)
        
        # Transform data for charting: pivot by timestamp
        data_dict = {}
        for row in rows:
            timestamp = row[3]
            code = row[1]
            value = row[2]
            lat = row[4]
            lon = row[5]
            
            if timestamp not in data_dict:
                data_dict[timestamp] = {
                    "endTimestampUTC": timestamp,
                    "latitude": lat,
                    "longitude": lon
                }
            
            if value is not None:
                data_dict[timestamp][code] = float(value)
        
        # Sort by timestamp
        result = sorted(data_dict.values(), key=lambda x: x['endTimestampUTC'])
        print(f"OK: Telemetry results: {len(result)} records returned")
        if len(result) == 0:
            print(f"WARNING: Empty result for entity={entity_id}, dateRange=[{startDate}, {endDate}]")
        else:
            print(f"   First record timestamp: {result[0]['endTimestampUTC']}")
            print(f"   Last record timestamp: {result[-1]['endTimestampUTC']}")
        return result
        
    except Exception as e:
        print(f"ERROR: Telemetry error: {str(e)}")
        print(f"   Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Telemetry error: {str(e)}")


@app.get("/api/events/range/{entity_id}")
def get_events_range(entity_id: str, startDate: str, endDate: str):
    """Get events for an entity within a date range, ordered by risk and date"""
    try:
        from datetime import datetime
        
        # Parse ISO 8601 UTC datetime strings from frontend
        # Frontend sends format: "2026-03-17T20:27:00.000Z"
        start_dt = datetime.fromisoformat(startDate.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(endDate.replace('Z', '+00:00'))
        
        # Format as SQL Server datetime string (safe - comes from fromisoformat)
        start_sql = start_dt.strftime('%Y-%m-%d %H:%M:%S')
        end_sql = end_dt.strftime('%Y-%m-%d %H:%M:%S')
        
        print(f"Events query range - Start: {start_sql}, End: {end_sql}")
        
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', entity_id):
            raise HTTPException(status_code=400, detail="Invalid entity_id")
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Use ? placeholder with varargs execute (matches working endpoint pattern)
        query = """
        SELECT
            el.eventLogId,
            el.eventId,
            e.eventCode,
            e.eventDescription,
            e.risk,
            el.cumulativeScore,
            el.probability,
            el.triggeredAt,
            COUNT(DISTINCT eld.eventLogDetailsId) as detailCount
        FROM dbo.EventLog el WITH (NOLOCK)
        LEFT JOIN dbo.Event e WITH (NOLOCK) ON el.eventId = e.eventId
        LEFT JOIN dbo.EventLogDetails eld WITH (NOLOCK) ON el.eventLogId = eld.eventLogId
        WHERE el.entityId = ?
          AND el.triggeredAt >= ?
          AND el.triggeredAt <= ?
        GROUP BY el.eventLogId, el.eventId, e.eventCode, e.eventDescription, 
                 e.risk, el.cumulativeScore, el.probability, el.triggeredAt
        ORDER BY CASE e.risk
                   WHEN 'HIGH' THEN 1
                   WHEN 'MEDIUM' THEN 2
                   WHEN 'LOW' THEN 3
                   ELSE 4
                 END ASC,
                 el.triggeredAt DESC
        """
        
        cur.execute(query, entity_id, start_sql, end_sql)
        rows = cur.fetchall()
        cur.close()
        return_db_connection(conn)
        
        results = []
        for row in rows:
            results.append({
                "eventLogId": row[0],
                "eventId": row[1],
                "eventName": row[2],
                "eventDescription": row[3],
                "risk": row[4],
                "cumulativeScore": row[5],
                "probability": row[6],
                "triggeredAt": row[7],
                "detailCount": row[8]
            })
        
        print(f"Events results: {len(results)} records returned")
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/eventlog/{eventlog_id}/details")
async def get_eventlog_details(eventlog_id: int):
    """Get detailed information for a specific event log"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get EventLog header info
        header_query = """
        SELECT
            el.eventLogId,
            el.entityId,
            el.eventId,
            e.eventCode,
            e.eventDescription,
            e.risk,
            el.cumulativeScore,
            el.probability,
            el.triggeredAt,
            el.AnalysisWindowInMin,
            el.processingTimeMs,
            el.analysisMetadata
        FROM dbo.EventLog el WITH (NOLOCK)
        LEFT JOIN dbo.Event e WITH (NOLOCK) ON el.eventId = e.eventId
        WHERE el.eventLogId = ?
        """
        
        cur.execute(header_query, (eventlog_id,))
        header_row = cur.fetchone()
        
        if not header_row:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Extract entity ID and triggered time for telemetry lookup
        entity_id = header_row[1]
        triggered_at = header_row[8]
        
        # Get EventLogDetails - simple query first, fetch all data before processing
        details_query = """
        SELECT
            eld.eventLogDetailsId,
            eld.entityTypeAttributeId,
            eta.entityTypeAttributeCode,
            eta.entityTypeAttributeName,
            eta.entityTypeAttributeUnit,
            eld.scoreContribution,
            eld.withinRange,
            eld.entityTelemetryId,
            pa.protocolAttributeCode,
            pa.description
        FROM dbo.EventLogDetails eld WITH (NOLOCK)
        LEFT JOIN dbo.EntityTypeAttribute eta WITH (NOLOCK) ON eld.entityTypeAttributeId = eta.entityTypeAttributeId
        LEFT JOIN dbo.ProtocolAttribute pa WITH (NOLOCK) ON eta.protocolId = pa.protocolId 
          AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
        WHERE eld.eventLogId = ?
        ORDER BY eta.entityTypeAttributeName
        """
        
        cur.execute(details_query, (eventlog_id,))
        detail_rows = cur.fetchall()  # Fetch all rows at once
        
        # Create a separate cursor for lookups to avoid cursor state issues
        lookup_cur = conn.cursor()
        
        # Format response
        details_list = []
        for row in detail_rows:
            entity_attr_id = row[1]
            entity_telemetry_id = row[7]
            numeric_value = None
            
            # Try to get value from direct link first
            if entity_telemetry_id:
                telemetry_query = "SELECT numericValue FROM dbo.EntityTelemetry WHERE entityTelemetryId = ?"
                lookup_cur.execute(telemetry_query, (entity_telemetry_id,))
                telemetry_row = lookup_cur.fetchone()
                if telemetry_row:
                    numeric_value = telemetry_row[0]
            
            # If no direct link value, get the latest telemetry for this attribute around event time
            if numeric_value is None:
                lookup_query = """
                SELECT TOP 1 numericValue 
                FROM dbo.EntityTelemetry 
                WHERE entityId = ? 
                  AND entityTypeAttributeId = ?
                  AND endTimestampUTC <= ?
                  AND numericValue IS NOT NULL
                ORDER BY endTimestampUTC DESC
                """
                lookup_cur.execute(lookup_query, (entity_id, entity_attr_id, triggered_at))
                lookup_row = lookup_cur.fetchone()
                if lookup_row:
                    numeric_value = lookup_row[0]
            
            details_list.append({
                "eventLogDetailsId": row[0],
                "entityTypeAttributeId": row[1],
                "attributeCode": row[2] if row[2] else 'N/A',
                "attributeName": row[3] if row[3] else 'Unknown',
                "attributeUnit": row[4],
                "scoreContribution": row[5],
                "withinRange": row[6],
                "entityTelemetryId": row[7],
                "numericValue": numeric_value,
                "protocolAttributeCode": row[8],
                "description": row[9]
            })
        
        print(f"EventLog {eventlog_id} details retrieved: {len(details_list)} rows")
        for detail in details_list:
            print(f"  {detail['attributeName']}: withinRange={detail['withinRange']}, value={detail['numericValue']}")
        
        lookup_cur.close()
        cur.close()
        return_db_connection(conn)
        
        return {
            "eventLogId": header_row[0],
            "entityId": header_row[1],
            "eventId": header_row[2],
            "eventCode": header_row[3],
            "eventDescription": header_row[4],
            "risk": header_row[5],
            "cumulativeScore": header_row[6],
            "probability": header_row[7],
            "triggeredAt": header_row[8],
            "analysisWindowInMin": header_row[9],
            "processingTimeMs": header_row[10],
            "analysisMetadata": header_row[11],
            "details": details_list
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_eventlog_details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/entity-attributes/{attribute_code}/scores")
async def get_entity_attribute_scores(attribute_code: str):
    """Get all scoring rules for an entity type attribute"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get the attribute ID from code
        attr_query = """
        SELECT entityTypeAttributeId 
        FROM dbo.EntityTypeAttribute 
        WHERE entityTypeAttributeCode = ?
        """
        cur.execute(attr_query, (attribute_code,))
        attr_row = cur.fetchone()
        
        if not attr_row:
            cur.close()
            return_db_connection(conn)
            return []
        
        attr_id = attr_row[0]
        
        # Get all scoring rules for this attribute
        score_query = """
        SELECT 
            Score,
            MinValue,
            MaxValue
        FROM dbo.EntityTypeAttributeScore
        WHERE entityTypeAttributeId = ? AND active = 'Y'
        ORDER BY Score DESC
        """
        
        cur.execute(score_query, (attr_id,))
        rows = cur.fetchall()
        cur.close()
        return_db_connection(conn)
        
        # Transform to list of dicts
        scores = []
        for row in rows:
            scores.append({
                "score": row[0],
                "minValue": float(row[1]) if row[1] is not None else 0,
                "maxValue": float(row[2]) if row[2] is not None else 999999
            })
        
        return scores
        
    except Exception as e:
        print(f"Error getting attribute scores: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# CUSTOMER ENDPOINTS
# ============================================

@app.get("/customers")
def get_customers():
    """Get all customers"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT customerId, customerName, active
            FROM Customers
            WHERE active = 'Y'
            ORDER BY customerName
        """)
        rows = cur.fetchall()
        
        customers = []
        for row in rows:
            customers.append({
                "customerId": row[0],
                "customerName": row[1],
                "active": row[2]
            })
        
        cur.close()
        return_db_connection(conn)
        return customers
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/customers/{id}")
def get_customer(id: int):
    """Get a specific customer by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT customerId, customerName, active, createDate, lastUpdateTimestamp
            FROM Customers
            WHERE customerId = ? AND active = 'Y'
        """, (id,))
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)
        
        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        customer = {
            "customerId": row[0],
            "customerName": row[1],
            "active": row[2],
            "createDate": row[3].isoformat() if row[3] else None,
            "lastUpdateTimestamp": row[4].isoformat() if row[4] else None
        }
        return customer
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# CUSTOMER SUBSCRIPTION ENDPOINTS
# ============================================

@app.get("/customersubscriptions")
def get_customer_subscriptions(status: str = None):
    """Get customer subscriptions with customer, entity, and event details
    
    Args:
        status: Filter by status ('Y' for active, 'N' for inactive, or None for all)
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        params = []
        where_clause = ""
        if status and status in ('Y', 'N'):
            where_clause = "WHERE cs.active = ?"
            params.append(status)
        
        cur.execute(f"""
            SELECT 
                cs.customerSubscriptionId,
                cs.customerId,
                c.customerName,
                cs.entityId,
                cs.eventId,
                e.eventCode,
                cs.subscriptionStartDate,
                cs.subscriptionEndDate,
                cs.active,
                CONCAT(ent.entityFirstName, ' ', ISNULL(ent.entityLastName, '')) AS entityName
            FROM CustomerSubscriptions cs
            JOIN Customers c ON cs.customerId = c.customerId
            LEFT JOIN Event e ON cs.eventId = e.eventId
            LEFT JOIN Entity ent ON ent.entityId = cs.entityId
            {where_clause}
            ORDER BY c.customerName, cs.entityId
        """, params)
        rows = cur.fetchall()
        
        subscriptions = []
        for row in rows:
            subscriptions.append({
                "customerSubscriptionId": row[0],
                "customerId": row[1],
                "customerName": row[2],
                "entityId": row[3],
                "eventId": row[4],
                "eventCode": row[5],
                "subscriptionStartDate": row[6].isoformat() if row[6] else None,
                "subscriptionEndDate": row[7].isoformat() if row[7] else None,
                "active": row[8],
                "entityName": row[9] if row[9] and row[9].strip() else row[3]
            })
        
        cur.close()
        return_db_connection(conn)
        return subscriptions
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/customersubscriptions/{id}")
def get_customer_subscription(id: int):
    """Get a specific customer subscription by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                cs.customerSubscriptionId,
                cs.customerId,
                c.customerName,
                cs.entityId,
                cs.eventId,
                COALESCE(e.eventCode, 'Unknown Event') as eventCode,
                cs.subscriptionStartDate,
                cs.subscriptionEndDate,
                cs.active
            FROM CustomerSubscriptions cs
            JOIN Customers c ON cs.customerId = c.customerId
            LEFT JOIN Event e ON cs.eventId = e.eventId
            WHERE cs.customerSubscriptionId = ?
        """, (id,))
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)
        
        if not row:
            raise HTTPException(status_code=404, detail="Subscription not found")
        
        subscription = {
            "customerSubscriptionId": row[0],
            "customerId": row[1],
            "customerName": row[2],
            "entityId": row[3],
            "eventId": row[4],
            "eventCode": row[5],
            "subscriptionStartDate": row[6].isoformat() if row[6] else None,
            "subscriptionEndDate": row[7].isoformat() if row[7] else None,
            "active": row[8]
        }
        return subscription
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/customersubscriptions")
def create_customer_subscription(data: dict):
    """Create a new customer subscription"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Convert customerId to int
        customer_id = int(data.get("customerId"))
        # Convert eventId to int if provided, otherwise None
        event_id = int(data.get("eventId")) if data.get("eventId") else None
        
        def parse_date(val):
            if not val:
                return None
            if isinstance(val, str):
                for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
                    try:
                        return datetime.strptime(val, fmt)
                    except ValueError:
                        continue
            return val

        cur.execute("""
            INSERT INTO CustomerSubscriptions (customerId, entityId, eventId, subscriptionStartDate, subscriptionEndDate, active)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            customer_id,
            data.get("entityId"),
            event_id,
            parse_date(data.get("subscriptionStartDate")),
            parse_date(data.get("subscriptionEndDate")),
            data.get("active", "Y")
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Subscription created successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/customersubscriptions/{id}")
def update_customer_subscription(id: int, data: dict):
    """Update a customer subscription
    
    Only updates fields that are explicitly provided in the request body.
    To clear subscriptionEndDate, pass null explicitly.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Build dynamic update statement - only include fields that were provided
        update_fields = []
        update_values = []
        
        if "customerId" in data:
            update_fields.append("customerId = ?")
            update_values.append(int(data["customerId"]))
        if "entityId" in data:
            update_fields.append("entityId = ?")
            update_values.append(data["entityId"])
        if "eventId" in data:
            update_fields.append("eventId = ?")
            # Convert eventId to int if provided and not empty, otherwise None
            event_id = int(data["eventId"]) if data["eventId"] else None
            update_values.append(event_id)
        def parse_date(val):
            if not val:
                return None
            if isinstance(val, str):
                for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
                    try:
                        return datetime.strptime(val, fmt)
                    except ValueError:
                        continue
            return val

        if "subscriptionStartDate" in data:
            update_fields.append("subscriptionStartDate = ?")
            update_values.append(parse_date(data["subscriptionStartDate"]))
        if "subscriptionEndDate" in data:
            update_fields.append("subscriptionEndDate = ?")
            update_values.append(parse_date(data["subscriptionEndDate"]))
        if "active" in data:
            update_fields.append("active = ?")
            update_values.append(data["active"])
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields provided to update")
        
        update_values.append(id)
        
        query = f"""
            UPDATE CustomerSubscriptions
            SET {', '.join(update_fields)}
            WHERE customerSubscriptionId = ?
        """
        
        cur.execute(query, update_values)
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Subscription updated successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/customersubscriptions/{id}")
def delete_customer_subscription(id: int):
    """Permanently delete a customer subscription"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Hard delete - permanently remove the record
        cur.execute("""
            DELETE FROM CustomerSubscriptions
            WHERE customerSubscriptionId = ?
        """, (id,))
        
        conn.commit()
        cur.close()
        return_db_connection(conn)
        
        return {"message": "Subscription permanently deleted"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# CUSTOMER ENTITIES ENDPOINTS
# ============================================

@app.get("/customerentities")
def get_customer_entities(status: str = None):
    """Get customer entities with customer and entity details
    
    Args:
        status: Filter by status ('Y' for active, 'N' for inactive, or None for all)
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        where_clause = ""
        if status:
            where_clause = f"WHERE ce.active = '{status}'"
        
        cur.execute(f"""
            SELECT 
                ce.customerEntityId,
                ce.customerId,
                c.customerName,
                ce.entityId,
                e.entityFirstName,
                et.entityTypeName,
                ce.active
            FROM CustomerEntities ce
            JOIN Customers c ON ce.customerId = c.customerId
            LEFT JOIN Entity e ON ce.entityId = e.entityId
            LEFT JOIN EntityType et ON e.entityTypeId = et.entityTypeId
            {where_clause}
            ORDER BY c.customerName, ce.entityId
        """)
        rows = cur.fetchall()
        
        entities = []
        for row in rows:
            entities.append({
                "customerEntityId": row[0],
                "customerId": row[1],
                "customerName": row[2],
                "entityId": row[3],
                "entityName": row[4],
                "entityTypeCode": row[5],
                "active": row[6]
            })
        
        cur.close()
        return_db_connection(conn)
        return entities
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/customerentities/{id}")
def get_customer_entity(id: int):
    """Get a specific customer entity by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                ce.customerEntityId,
                ce.customerId,
                c.customerName,
                ce.entityId,
                e.entityFirstName,
                et.entityTypeName,
                ce.active
            FROM CustomerEntities ce
            JOIN Customers c ON ce.customerId = c.customerId
            LEFT JOIN Entity e ON ce.entityId = e.entityId
            LEFT JOIN EntityType et ON e.entityTypeId = et.entityTypeId
            WHERE ce.customerEntityId = ?
        """, (id,))
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)
        
        if not row:
            raise HTTPException(status_code=404, detail="Customer entity not found")
        
        entity = {
            "customerEntityId": row[0],
            "customerId": row[1],
            "customerName": row[2],
            "entityId": row[3],
            "entityName": row[4],
            "entityTypeCode": row[5],
            "active": row[6]
        }
        return entity
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/customerentities")
def create_customer_entity(data: dict):
    """Create a new customer entity assignment"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO CustomerEntities (customerId, entityId, active)
            VALUES (?, ?, ?)
        """, (
            data.get("customerId"),
            data.get("entityId"),
            data.get("active", "Y")
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Customer entity created successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/customerentities/{id}")
def update_customer_entity(id: int, data: dict):
    """Update a customer entity assignment"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE CustomerEntities
            SET customerId = ?, entityId = ?, active = ?
            WHERE customerEntityId = ?
        """, (
            data.get("customerId"),
            data.get("entityId"),
            data.get("active", "Y"),
            id
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Customer entity updated successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/customerentities/{id}")
def delete_customer_entity(id: int):
    """Permanently delete a customer entity assignment"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Hard delete - permanently remove the record
        cur.execute("""
            DELETE FROM CustomerEntities
            WHERE customerEntityId = ?
        """, (id,))
        
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Customer entity deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/customerentities/{id}/sync-setup")
async def sync_entity_setup_to_device(id: int, request_data: dict = None):
    """Sync entity's provider setup to its IoT device
    
    Args:
        id: Customer entity ID
        request_data: Optional dict with 'provider_name' (required if entity has multiple providers)
    """
    try:
        # Get the entity
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT entityId
            FROM CustomerEntities
            WHERE customerEntityId = ?
        """, (id,))
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)
        
        if not row:
            raise HTTPException(status_code=404, detail="Customer entity not found")
        
        entity_id = row[0]
        
        # Get provider_name from request or use default
        provider_name = (request_data or {}).get("provider_name", "N2KToSignalK")
        
        # Call the setup_management sync endpoint via HTTP
        import aiohttp
        async with aiohttp.ClientSession() as session:
            # Note: This assumes device_id is part of the entity metadata or can be derived from entityId
            sync_url = f"http://localhost:8000/api/setup/sync/{provider_name}?entity_id={entity_id}"
            async with session.post(sync_url) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise HTTPException(status_code=resp.status, detail=f"Failed to sync: {error_text}")
                result = await resp.json()
        
        return {
            "status": "success",
            "message": f"Setup synced for entity {entity_id}",
            "entity_id": entity_id,
            "provider_name": provider_name,
            "sync_result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ======================== GEOFENCE CRITERIA ENDPOINTS ========================

@app.get("/customergeofencecriteria")
def get_customer_geofence_criteria(customer_id: int = None, status: str = None):
    """Get customer geofence criteria (polygons/circles)
    
    Args:
        customer_id: Optional filter by customer ID
        status: Filter by status ('Y' for active, 'N' for inactive, or None for all)
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        where_clauses = []
        params = []
        
        if customer_id:
            where_clauses.append("cgc.customerId = ?")
            params.append(customer_id)
        
        if status:
            where_clauses.append(f"cgc.active = ?")
            params.append(status)
        
        where_clause = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        cur.execute(f"""
            SELECT 
                cgc.customerGeofenceCriteriaId,
                cgc.customerId,
                c.customerName,
                cgc.entityTypeAttributeId,
                cgc.geofenceName,
                cgc.geoType,
                cgc.coordinates,
                cgc.description,
                cgc.active,
                cgc.createdAt,
                cgc.modifiedAt
            FROM CustomerGeofenceCriteria cgc
            JOIN Customers c ON cgc.customerId = c.customerId
            {where_clause}
            ORDER BY c.customerName, cgc.geofenceName
        """, params)
        
        rows = cur.fetchall()
        
        geofences = []
        for row in rows:
            geofences.append({
                "customerGeofenceCriteriaId": row[0],
                "customerId": row[1],
                "customerName": row[2],
                "entityTypeAttributeId": row[3],
                "geofenceName": row[4],
                "geoType": row[5],
                "coordinates": row[6],  # JSON string
                "description": row[7],
                "active": row[8],
                "createdAt": row[9].isoformat() if row[9] else None,
                "modifiedAt": row[10].isoformat() if row[10] else None
            })
        
        cur.close()
        return_db_connection(conn)
        return geofences
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/customergeofencecriteria/{id}")
def get_customer_geofence_criteria_by_id(id: int):
    """Get a specific customer geofence criteria by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                cgc.customerGeofenceCriteriaId,
                cgc.customerId,
                c.customerName,
                cgc.entityTypeAttributeId,
                cgc.geofenceName,
                cgc.geoType,
                cgc.coordinates,
                cgc.description,
                cgc.active,
                cgc.createdAt,
                cgc.modifiedAt
            FROM CustomerGeofenceCriteria cgc
            JOIN Customers c ON cgc.customerId = c.customerId
            WHERE cgc.customerGeofenceCriteriaId = ?
        """, (id,))
        
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)
        
        if not row:
            raise HTTPException(status_code=404, detail="Geofence criteria not found")
        
        geofence = {
            "customerGeofenceCriteriaId": row[0],
            "customerId": row[1],
            "customerName": row[2],
            "entityTypeAttributeId": row[3],
            "geofenceName": row[4],
            "geoType": row[5],
            "coordinates": row[6],
            "description": row[7],
            "active": row[8],
            "createdAt": row[9].isoformat() if row[9] else None,
            "modifiedAt": row[10].isoformat() if row[10] else None
        }
        return geofence
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/customergeofencecriteria")
def create_customer_geofence_criteria(data: dict):
    """Create a new customer geofence criteria
    
    Args:
        customerId: Customer ID
        entityTypeAttributeId: Entity type attribute ID
        geofenceName: Name of the geofence
        geoType: Type of geofence ('Polygon', 'Circle', etc.)
        coordinates: JSON string with coordinates
        description: Optional description
        active: 'Y' or 'N' (default 'Y')
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO CustomerGeofenceCriteria 
            (customerId, entityTypeAttributeId, geofenceName, geoType, coordinates, description, active, createdAt, modifiedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
        """, (
            data.get("customerId"),
            data.get("entityTypeAttributeId"),
            data.get("geofenceName"),
            data.get("geoType"),
            data.get("coordinates"),
            data.get("description"),
            data.get("active", "Y")
        ))
        
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Geofence criteria created successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/customergeofencecriteria/{id}")
def update_customer_geofence_criteria(id: int, data: dict):
    """Update a customer geofence criteria"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Build dynamic UPDATE query based on provided fields
        update_fields = []
        params = []
        
        if "entityTypeAttributeId" in data:
            update_fields.append("entityTypeAttributeId = ?")
            params.append(data["entityTypeAttributeId"])
        
        if "geofenceName" in data:
            update_fields.append("geofenceName = ?")
            params.append(data["geofenceName"])
        
        if "geoType" in data:
            update_fields.append("geoType = ?")
            params.append(data["geoType"])
        
        if "coordinates" in data:
            update_fields.append("coordinates = ?")
            params.append(data["coordinates"])
        
        if "description" in data:
            update_fields.append("description = ?")
            params.append(data["description"])
        
        if "active" in data:
            update_fields.append("active = ?")
            params.append(data["active"])
        
        if not update_fields:
            return {"message": "No fields to update"}
        
        # Always update modifiedAt
        update_fields.append("modifiedAt = GETDATE()")
        
        params.append(id)
        
        cur.execute(f"""
            UPDATE CustomerGeofenceCriteria
            SET {', '.join(update_fields)}
            WHERE customerGeofenceCriteriaId = ?
        """, params)
        
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Geofence criteria updated successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/customergeofencecriteria/{id}")
def delete_customer_geofence_criteria(id: int):
    """Permanently delete a customer geofence criteria"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Hard delete - permanently remove the record
        cur.execute("""
            DELETE FROM CustomerGeofenceCriteria
            WHERE customerGeofenceCriteriaId = ?
        """, (id,))
        
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Geofence criteria deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── EntityIoTDevice CRUD ────────────────────────────────────────────────────

@app.get("/entityiotdevices")
def get_entity_iot_devices(entityId: str = None):
    """Get IoT device registrations, optionally filtered by entityId"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        if entityId:
            cur.execute("""
                SELECT entityIoTDeviceId, entityId, deviceId, iotHubHostname,
                       connectionString, deviceTwinDesired, deviceTwinReported,
                       lastTwinSyncUTC, provisioningStatus, active,
                       createDate, lastUpdateTimestamp, lastUpdateUser
                FROM EntityIoTDevice
                WHERE entityId = ?
                ORDER BY createDate DESC
            """, (entityId,))
        else:
            cur.execute("""
                SELECT entityIoTDeviceId, entityId, deviceId, iotHubHostname,
                       connectionString, deviceTwinDesired, deviceTwinReported,
                       lastTwinSyncUTC, provisioningStatus, active,
                       createDate, lastUpdateTimestamp, lastUpdateUser
                FROM EntityIoTDevice
                ORDER BY createDate DESC
            """)

        rows = cur.fetchall()
        devices = []
        for row in rows:
            devices.append({
                "entityIoTDeviceId": row[0],
                "entityId": row[1],
                "deviceId": row[2],
                "iotHubHostname": row[3],
                "connectionString": row[4],
                "deviceTwinDesired": row[5],
                "deviceTwinReported": row[6],
                "lastTwinSyncUTC": str(row[7]) if row[7] else None,
                "provisioningStatus": row[8],
                "active": row[9],
                "createDate": str(row[10]) if row[10] else None,
                "lastUpdateTimestamp": str(row[11]) if row[11] else None,
                "lastUpdateUser": row[12],
            })

        cur.close()
        return_db_connection(conn)
        return devices

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/entityiotdevices/{id}")
def get_entity_iot_device(id: int):
    """Get a specific IoT device by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT entityIoTDeviceId, entityId, deviceId, iotHubHostname,
                   connectionString, deviceTwinDesired, deviceTwinReported,
                   lastTwinSyncUTC, provisioningStatus, active,
                   createDate, lastUpdateTimestamp, lastUpdateUser
            FROM EntityIoTDevice
            WHERE entityIoTDeviceId = ?
        """, (id,))
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)

        if not row:
            raise HTTPException(status_code=404, detail="IoT device not found")

        return {
            "entityIoTDeviceId": row[0],
            "entityId": row[1],
            "deviceId": row[2],
            "iotHubHostname": row[3],
            "connectionString": row[4],
            "deviceTwinDesired": row[5],
            "deviceTwinReported": row[6],
            "lastTwinSyncUTC": str(row[7]) if row[7] else None,
            "provisioningStatus": row[8],
            "active": row[9],
            "createDate": str(row[10]) if row[10] else None,
            "lastUpdateTimestamp": str(row[11]) if row[11] else None,
            "lastUpdateUser": row[12],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/entityiotdevices")
def create_entity_iot_device(device: dict):
    """Create a new IoT device registration"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO EntityIoTDevice (entityId, deviceId, iotHubHostname, provisioningStatus, active)
            VALUES (?, ?, ?, ?, ?)
        """, (
            device.get("entityId"),
            device.get("deviceId"),
            device.get("iotHubHostname", "VXT-IoT-Hub.azure-devices.net"),
            device.get("provisioningStatus", "Pending"),
            device.get("active", "Y"),
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "IoT device created successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/entityiotdevices/{id}")
def update_entity_iot_device(id: int, device: dict):
    """Update an IoT device registration"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE EntityIoTDevice
            SET entityId = ?, deviceId = ?, iotHubHostname = ?,
                provisioningStatus = ?, active = ?,
                lastUpdateTimestamp = GETDATE()
            WHERE entityIoTDeviceId = ?
        """, (
            device.get("entityId"),
            device.get("deviceId"),
            device.get("iotHubHostname"),
            device.get("provisioningStatus"),
            device.get("active", "Y"),
            id,
        ))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "IoT device updated successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/entityiotdevices/{id}")
def delete_entity_iot_device(id: int):
    """Delete an IoT device registration"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            DELETE FROM EntityIoTDevice
            WHERE entityIoTDeviceId = ?
        """, (id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "IoT device deleted successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Device Twin API (merged from vxt-cloud-api) ─────────────────────────────

class DeviceRegisterRequest(BaseModel):
    entityId: str
    deviceId: str


def _query_as_dicts(conn, sql: str, params: tuple = ()) -> list:
    """Execute SQL and return rows as list of dicts using an existing connection."""
    cur = conn.cursor()
    cur.execute(sql, params)
    columns = [desc[0] for desc in cur.description]
    rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    cur.close()
    return rows


def _get_device_config(entity_id: str) -> dict:
    """Fetch telemetry tiers, alarm scores, and geofences for a device."""
    conn = get_db_connection()
    try:
        # 1. Resolve entityTypeId and customerId
        device_rows = _query_as_dicts(conn, """
            SELECT e.entityTypeId, ce.customerId
            FROM Entity e
            JOIN CustomerEntities ce ON ce.entityId = e.entityId AND ce.active = 'Y'
            WHERE e.entityId = ? AND e.active = 'Y'
        """, (entity_id,))
        if not device_rows:
            return {"telemetry": {}, "alarms": {}, "geofences": []}

        entity_type_id = device_rows[0]["entityTypeId"]
        customer_id = device_rows[0]["customerId"]

        # 2. Telemetry – tiered SignalK paths
        attr_rows = _query_as_dicts(conn, """
            SELECT entityTypeAttributeCode, entityTypeAttributeTimeAspect
            FROM EntityTypeAttribute
            WHERE entityTypeId = ? AND active = 'Y'
        """, (entity_type_id,))

        tiered_paths = defaultdict(list)
        for row in attr_rows:
            tier = str(row["entityTypeAttributeTimeAspect"])
            path = row["entityTypeAttributeCode"]
            tiered_paths[tier].append(path)
        telemetry = dict(tiered_paths)

        # 3. Alarms – score ranges per path
        score_rows = _query_as_dicts(conn, """
            SELECT a.entityTypeAttributeCode,
                   s.MinValue, s.MaxValue, s.Score
            FROM EntityTypeAttributeScore s
            JOIN EntityTypeAttribute a
                 ON a.entityTypeAttributeId = s.EntityTypeAttributeId
            WHERE a.entityTypeId = ? AND a.active = 'Y' AND s.active = 'Y'
            ORDER BY a.entityTypeAttributeCode, s.MinValue
        """, (entity_type_id,))

        alarms = defaultdict(list)
        for row in score_rows:
            # Azure IoT Hub twin forbids dots in property names;
            # replace '.' with '/' so edge module can convert back.
            path = row["entityTypeAttributeCode"].replace(".", "/")
            alarms[path].append({
                "min": float(row["MinValue"]),
                "max": float(row["MaxValue"]),
                "score": int(row["Score"]),
            })
        alarms = dict(alarms)

        # 4. Geofences
        geo_rows = _query_as_dicts(conn, """
            SELECT g.customerGeofenceCriteriaId,
                   g.geofenceName, g.geoType, g.coordinates
            FROM CustomerGeofenceCriteria g
            WHERE g.customerId = ? AND g.active = 'Y'
        """, (customer_id,))

        geofences = []
        for row in geo_rows:
            coords_raw = row["coordinates"]
            coords = json.loads(coords_raw) if isinstance(coords_raw, str) else coords_raw
            # Unwrap any layers of double/triple-encoded JSON strings
            while isinstance(coords, str):
                coords = json.loads(coords)
            fence = {
                "id": row["customerGeofenceCriteriaId"],
                "name": row["geofenceName"],
                "type": row["geoType"],
                "coordinates": coords,
            }
            geofences.append(fence)

        return {"telemetry": telemetry, "alarms": alarms, "geofences": geofences}
    finally:
        return_db_connection(conn)


@app.get("/api/v1/twin/{entity_id}")
def get_device_twin(entity_id: str):
    """Generate the full Device Twin JSON for a given entity."""
    config = _get_device_config(entity_id)

    if not config["telemetry"] and not config["alarms"] and not config["geofences"]:
        raise HTTPException(status_code=404,
                            detail=f"No configuration found for entity_id '{entity_id}'")

    # Build flat deduplicated list of all SignalK paths across tiers
    all_paths = list(dict.fromkeys(
        path for paths in config["telemetry"].values() for path in paths
    ))

    # TEMP: remap 300s tier → 60s for testing
    test_tiered = {("60" if k == "300" else k): v for k, v in config["telemetry"].items()}

    twin = {
        "properties": {
            "desired": {
                "entity_id": entity_id,
                "telemetry": {
                    "bulk_interval_seconds": 60,
                    "tiered_paths": test_tiered,
                },
                "storage": {
                    "influx_allow_paths": all_paths,
                },
                "alarms": {
                    "siren_gpio_enabled": True,
                    **config["alarms"],
                },
                "geofences": config["geofences"],
            }
        }
    }
    return JSONResponse(content=twin)


@app.post("/api/v1/twin/{entity_id}/push")
def push_device_twin(entity_id: str):
    """Generate twin JSON, save to DB, and push desired properties to Azure IoT Hub."""
    config = _get_device_config(entity_id)

    if not config["telemetry"] and not config["alarms"] and not config["geofences"]:
        raise HTTPException(status_code=404,
                            detail=f"No configuration found for entity_id '{entity_id}'")

    # Build flat deduplicated list of all SignalK paths across tiers
    all_paths = list(dict.fromkeys(
        path for paths in config["telemetry"].values() for path in paths
    ))

    # TEMP: remap 300s tier → 60s for testing
    test_tiered = {("60" if k == "300" else k): v for k, v in config["telemetry"].items()}

    desired = {
        "entity_id": entity_id,
        "telemetry": {
            "bulk_interval_seconds": 60,
            "tiered_paths": test_tiered,
        },
        "storage": {
            "influx_allow_paths": all_paths,
        },
        "alarms": {
            "siren_gpio_enabled": True,
            **config["alarms"],
        },
        "geofences": config["geofences"],
    }

    twin = {"properties": {"desired": desired}}
    twin_json = json.dumps(twin)

    # 1) Save to local DB
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Look up deviceId for this entity
        cur.execute(
            "SELECT deviceId FROM EntityIoTDevice WHERE entityId = ?",
            (entity_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            return_db_connection(conn)
            raise HTTPException(status_code=404,
                                detail=f"No IoT device registered for entity {entity_id}")
        device_id = row[0]

        cur.execute("""
            UPDATE EntityIoTDevice
            SET deviceTwinDesired = ?,
                lastTwinSyncUTC = GETDATE(),
                lastUpdateTimestamp = GETDATE()
            WHERE entityId = ?
        """, (twin_json, entity_id))
        conn.commit()
        cur.close()
        return_db_connection(conn)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save twin: {str(e)}")

    # 2) Push to Azure IoT Hub
    iot_hub_cs = os.getenv("IOT_HUB_CONNECTION_STRING", "")
    azure_pushed = False
    if iot_hub_cs:
        try:
            from azure.iot.hub import IoTHubRegistryManager
            from azure.iot.hub.models import Twin, TwinProperties
            registry = IoTHubRegistryManager(iot_hub_cs)
            twin_patch = Twin(properties=TwinProperties(desired=desired))
            registry.update_twin(device_id, twin_patch, etag="*")
            azure_pushed = True
        except Exception as e:
            raise HTTPException(status_code=502,
                                detail=f"Saved to DB but Azure IoT Hub push failed: {e}")
    else:
        print("[WARNING] IOT_HUB_CONNECTION_STRING not set – twin saved to DB only")

    return {
        "message": f"Twin pushed for entity {entity_id}",
        "azure_pushed": azure_pushed,
        "device_id": device_id,
        "twin": twin,
    }


@app.post("/api/user/device-token")
def register_device_token(data: dict):
    """Register or update a user's mobile device (FCM token) in UserApplication.

    Body: { "userId": "2", "fcmToken": "...", "platform": "android", "deviceModel": "SM-N980F", "appVersion": "1.0" }
    """
    try:
        user_id = data.get("userId")
        fcm_token = data.get("fcmToken")
        platform = data.get("platform", "android")
        device_model = data.get("deviceModel", "")
        app_version = data.get("appVersion", "")

        if not user_id or not fcm_token:
            raise HTTPException(status_code=400, detail="userId and fcmToken are required")

        conn = get_db_connection()
        cur = conn.cursor()

        # Check if UserApplication already exists for this user + platform
        cur.execute("""
            SELECT userApplicationId FROM dbo.UserApplication
            WHERE userId = ? AND platform = ?
        """, (user_id, platform))
        existing = cur.fetchone()

        if existing:
            cur.execute("""
                UPDATE dbo.UserApplication
                SET fcmToken = ?, deviceModel = ?, appVersion = ?,
                    active = 'Y', lastActiveUTC = GETDATE()
                WHERE userApplicationId = ?
            """, (fcm_token, device_model, app_version, existing[0]))
            user_app_id = existing[0]
        else:
            cur.execute("""
                INSERT INTO dbo.UserApplication
                    (userId, platform, fcmToken, deviceModel, appVersion, active, lastActiveUTC)
                VALUES (?, ?, ?, ?, ?, 'Y', GETDATE())
            """, (user_id, platform, fcm_token, device_model, app_version))
            conn.commit()
            cur.execute("""
                SELECT userApplicationId FROM dbo.UserApplication
                WHERE userId = ? AND platform = ?
            """, (user_id, platform))
            user_app_id = cur.fetchone()[0]

        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Device token registered", "userApplicationId": user_app_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/device/register")
def register_device(req: DeviceRegisterRequest):
    """Register an IoT device – creates row in EntityIoTDevice.

    If IOT_HUB_CONNECTION_STRING is set, also registers in Azure IoT Hub.
    """
    iot_hub_cs = os.getenv("IOT_HUB_CONNECTION_STRING", "")
    hostname = "VXT-IoT-Hub.azure-devices.net"
    device_connection_string = None

    if iot_hub_cs:
        # Register in Azure IoT Hub
        try:
            from azure.iot.hub import IoTHubRegistryManager
            registry = IoTHubRegistryManager(iot_hub_cs)
            try:
                device = registry.get_device(req.deviceId)
            except Exception:
                device = registry.create_device_with_sas(
                    device_id=req.deviceId,
                    primary_key=None,
                    secondary_key=None,
                    status="enabled",
                    iot_edge=True,
                )
            # Extract hostname
            for part in iot_hub_cs.split(";"):
                if part.lower().startswith("hostname="):
                    hostname = part.split("=", 1)[1]
                    break
            primary_key = device.authentication.symmetric_key.primary_key
            device_connection_string = (
                f"HostName={hostname};DeviceId={req.deviceId};SharedAccessKey={primary_key}"
            )
        except ImportError:
            print("[WARNING] azure-iot-hub not installed, skipping IoT Hub registration")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Azure IoT Hub error: {e}")

    # Upsert EntityIoTDevice row
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT entityIoTDeviceId FROM EntityIoTDevice WHERE entityId = ?",
                     (req.entityId,))
        existing = cur.fetchone()

        if existing:
            cur.execute("""
                UPDATE EntityIoTDevice
                SET deviceId = ?, iotHubHostname = ?, connectionString = ?,
                    provisioningStatus = 'Provisioned', active = 'Y',
                    lastUpdateTimestamp = GETDATE()
                WHERE entityId = ?
            """, (req.deviceId, hostname, device_connection_string, req.entityId))
        else:
            cur.execute("""
                INSERT INTO EntityIoTDevice
                    (entityId, deviceId, iotHubHostname, connectionString,
                     provisioningStatus, active)
                VALUES (?, ?, ?, ?, 'Provisioned', 'Y')
            """, (req.entityId, req.deviceId, hostname, device_connection_string))

        conn.commit()
        cur.close()
        return_db_connection(conn)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    return JSONResponse(content={
        "entityId": req.entityId,
        "deviceId": req.deviceId,
        "hostname": hostname,
        "connectionString": device_connection_string,
        "provisioningStatus": "Provisioned",
    })


# ============================================================================
# USER AUTHORIZATION & NOTIFICATION SETTINGS ENDPOINTS
# ============================================================================

@app.get("/customersubscriptions/{sub_id}/authorizations")
def get_subscription_authorizations(sub_id: int):
    """Get all users authorized for a specific subscription"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                ua.userAuthorizationId,
                ua.userId,
                au.email,
                au.displayName,
                au.firebaseUid,
                ua.role,
                ua.active,
                ua.createDate,
                ua.lastUpdateTimestamp
            FROM dbo.UserAuthorization ua
            JOIN dbo.AppUser au ON au.userId = ua.userId
            WHERE ua.customerSubscriptionId = ?
            ORDER BY ua.createDate DESC
        """, (sub_id,))
        rows = cur.fetchall()
        result = []
        for r in rows:
            result.append({
                "userAuthorizationId": r[0],
                "userId": r[1],
                "email": r[2],
                "displayName": r[3],
                "firebaseUid": r[4],
                "role": r[5],
                "active": r[6],
                "createDate": r[7].isoformat() if r[7] else None,
                "lastUpdateTimestamp": r[8].isoformat() if r[8] else None,
            })
        cur.close()
        return_db_connection(conn)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/authorizations/{auth_id}")
def update_authorization(auth_id: int, data: dict):
    """Update a user authorization (role, active status)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        update_fields = []
        update_values = []
        if "role" in data:
            allowed_roles = ('owner', 'viewer', 'admin')
            if data["role"] not in allowed_roles:
                raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {allowed_roles}")
            update_fields.append("role = ?")
            update_values.append(data["role"])
        if "active" in data:
            if data["active"] not in ('Y', 'N'):
                raise HTTPException(status_code=400, detail="active must be 'Y' or 'N'")
            update_fields.append("active = ?")
            update_values.append(data["active"])
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        update_fields.append("lastUpdateTimestamp = GETDATE()")
        update_values.append(auth_id)
        cur.execute(f"""
            UPDATE dbo.UserAuthorization
            SET {', '.join(update_fields)}
            WHERE userAuthorizationId = ?
        """, update_values)
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Authorization updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/customersubscriptions/{sub_id}/invite")
def invite_user_to_subscription(sub_id: int, data: dict):
    """Invite a user by email to a subscription with a role.
    
    Creates AppUser (if needed), creates UserAuthorization,
    and sends Firebase Dynamic Link invitation email.
    """
    try:
        email = (data.get("email") or "").strip().lower()
        role = data.get("role", "viewer")
        if not email:
            raise HTTPException(status_code=400, detail="email is required")
        allowed_roles = ('owner', 'viewer', 'admin')
        if role not in allowed_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {allowed_roles}")

        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Verify subscription exists and get customerId
        cur.execute("""
            SELECT customerSubscriptionId, customerId
            FROM dbo.CustomerSubscriptions
            WHERE customerSubscriptionId = ? AND active = 'Y'
        """, (sub_id,))
        sub_row = cur.fetchone()
        if not sub_row:
            cur.close()
            return_db_connection(conn)
            raise HTTPException(status_code=404, detail="Subscription not found or inactive")
        customer_id = sub_row[1]

        # 2. Find or create AppUser by email
        cur.execute("SELECT userId, firebaseUid FROM dbo.AppUser WHERE email = ?", (email,))
        user_row = cur.fetchone()

        firebase_uid = None
        if user_row:
            user_id = user_row[0]
            firebase_uid = user_row[1]
        else:
            # Try to create the user in Firebase first
            try:
                import firebase_admin
                from firebase_admin import auth as fb_auth
                if not firebase_admin._apps:
                    _init_firebase_admin()
                try:
                    fb_user = fb_auth.get_user_by_email(email)
                    firebase_uid = fb_user.uid
                except fb_auth.UserNotFoundError:
                    fb_user = fb_auth.create_user(email=email)
                    firebase_uid = fb_user.uid
            except Exception as fb_err:
                print(f"[WARNING] Firebase user creation skipped: {fb_err}")
                firebase_uid = f"pending_{email}"

            cur.execute("""
                INSERT INTO dbo.AppUser (firebaseUid, email, displayName, customerId, active)
                VALUES (?, ?, ?, ?, 'Y')
            """, (firebase_uid, email, email.split('@')[0], customer_id))
            conn.commit()
            cur.execute("SELECT userId FROM dbo.AppUser WHERE email = ?", (email,))
            user_id = cur.fetchone()[0]

        # 3. Create or reactivate UserAuthorization
        cur.execute("""
            SELECT userAuthorizationId, active FROM dbo.UserAuthorization
            WHERE userId = ? AND customerSubscriptionId = ?
        """, (user_id, sub_id))
        auth_row = cur.fetchone()
        if auth_row:
            cur.execute("""
                UPDATE dbo.UserAuthorization
                SET role = ?, active = 'Y', lastUpdateTimestamp = GETDATE()
                WHERE userAuthorizationId = ?
            """, (role, auth_row[0]))
            auth_id = auth_row[0]
        else:
            cur.execute("""
                INSERT INTO dbo.UserAuthorization (userId, customerSubscriptionId, role, active)
                VALUES (?, ?, ?, 'Y')
            """, (user_id, sub_id, role))
            conn.commit()
            cur.execute("""
                SELECT userAuthorizationId FROM dbo.UserAuthorization
                WHERE userId = ? AND customerSubscriptionId = ?
            """, (user_id, sub_id))
            auth_id = cur.fetchone()[0]

        conn.commit()

        # 4. Send invitation email via Firebase REST API
        invite_sent = False
        try:
            firebase_api_key = os.getenv('FIREBASE_API_KEY', 'AIzaSyCe3MtbtM1OeYCVYCv2UELh9KQbJrwB6Fg')
            if firebase_uid and not firebase_uid.startswith("pending_"):
                import requests as http_requests
                resp = http_requests.post(
                    f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={firebase_api_key}",
                    json={"requestType": "PASSWORD_RESET", "email": email},
                    timeout=10,
                )
                if resp.status_code == 200:
                    invite_sent = True
                    print(f"[INFO] Firebase password reset email sent to {email}")
                else:
                    print(f"[WARNING] Firebase email send failed: {resp.status_code} - {resp.text}")
        except Exception as mail_err:
            print(f"[WARNING] Invitation email skipped: {mail_err}")

        cur.close()
        return_db_connection(conn)

        return {
            "message": f"User {email} invited as {role}",
            "userAuthorizationId": auth_id,
            "userId": user_id,
            "inviteSent": invite_sent,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/invite-bulk")
def invite_user_bulk(data: dict):
    """Invite a user by email to multiple subscriptions at once.

    Body: { "email": "...", "role": "viewer", "subscriptionIds": [1, 2, 3] }
    """
    try:
        email = (data.get("email") or "").strip().lower()
        role = data.get("role", "viewer")
        subscription_ids = data.get("subscriptionIds", [])
        if not email:
            raise HTTPException(status_code=400, detail="email is required")
        if not subscription_ids:
            raise HTTPException(status_code=400, detail="subscriptionIds is required")
        allowed_roles = ('owner', 'viewer', 'admin')
        if role not in allowed_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {allowed_roles}")

        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Verify all subscriptions exist
        placeholders = ','.join(['?' for _ in subscription_ids])
        cur.execute(f"""
            SELECT customerSubscriptionId, customerId
            FROM dbo.CustomerSubscriptions
            WHERE customerSubscriptionId IN ({placeholders}) AND active = 'Y'
        """, tuple(subscription_ids))
        valid_subs = {row[0]: row[1] for row in cur.fetchall()}
        if not valid_subs:
            cur.close()
            return_db_connection(conn)
            raise HTTPException(status_code=404, detail="No valid active subscriptions found")

        # Use first subscription's customerId for new user
        customer_id = list(valid_subs.values())[0]

        # 2. Find or create AppUser by email
        cur.execute("SELECT userId, firebaseUid FROM dbo.AppUser WHERE email = ?", (email,))
        user_row = cur.fetchone()

        firebase_uid = None
        if user_row:
            user_id = user_row[0]
            firebase_uid = user_row[1]
        else:
            try:
                import firebase_admin
                from firebase_admin import auth as fb_auth
                if not firebase_admin._apps:
                    _init_firebase_admin()
                try:
                    fb_user = fb_auth.get_user_by_email(email)
                    firebase_uid = fb_user.uid
                except fb_auth.UserNotFoundError:
                    fb_user = fb_auth.create_user(email=email)
                    firebase_uid = fb_user.uid
            except Exception as fb_err:
                print(f"[WARNING] Firebase user creation skipped: {fb_err}")
                firebase_uid = f"pending_{email}"

            cur.execute("""
                INSERT INTO dbo.AppUser (firebaseUid, email, displayName, customerId, active)
                VALUES (?, ?, ?, ?, 'Y')
            """, (firebase_uid, email, email.split('@')[0], customer_id))
            conn.commit()
            cur.execute("SELECT userId FROM dbo.AppUser WHERE email = ?", (email,))
            user_id = cur.fetchone()[0]

        # 3. Create or reactivate UserAuthorization for each subscription
        results = []
        for sub_id in subscription_ids:
            if sub_id not in valid_subs:
                results.append({"subscriptionId": sub_id, "status": "skipped", "reason": "not found or inactive"})
                continue
            cur.execute("""
                SELECT userAuthorizationId, active FROM dbo.UserAuthorization
                WHERE userId = ? AND customerSubscriptionId = ?
            """, (user_id, sub_id))
            auth_row = cur.fetchone()
            if auth_row:
                cur.execute("""
                    UPDATE dbo.UserAuthorization
                    SET role = ?, active = 'Y', lastUpdateTimestamp = GETDATE()
                    WHERE userAuthorizationId = ?
                """, (role, auth_row[0]))
                results.append({"subscriptionId": sub_id, "authId": auth_row[0], "status": "updated"})
            else:
                cur.execute("""
                    INSERT INTO dbo.UserAuthorization (userId, customerSubscriptionId, role, active)
                    VALUES (?, ?, ?, 'Y')
                """, (user_id, sub_id, role))
                conn.commit()
                cur.execute("""
                    SELECT userAuthorizationId FROM dbo.UserAuthorization
                    WHERE userId = ? AND customerSubscriptionId = ?
                """, (user_id, sub_id))
                auth_id = cur.fetchone()[0]
                results.append({"subscriptionId": sub_id, "authId": auth_id, "status": "created"})
        conn.commit()

        # 4. Send invitation email via Firebase REST API
        # generate_password_reset_link() only generates a link but does NOT send email.
        # Use Firebase Identity Toolkit REST API which actually triggers email delivery.
        invite_sent = False
        invite_link = None
        try:
            firebase_api_key = os.getenv('FIREBASE_API_KEY', 'AIzaSyCe3MtbtM1OeYCVYCv2UELh9KQbJrwB6Fg')
            if firebase_uid and not firebase_uid.startswith("pending_"):
                import requests as http_requests
                # Use Firebase Identity Toolkit to send password reset email
                resp = http_requests.post(
                    f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={firebase_api_key}",
                    json={"requestType": "PASSWORD_RESET", "email": email},
                    timeout=10,
                )
                if resp.status_code == 200:
                    invite_sent = True
                    invite_link = resp.json().get("email", email)
                    print(f"[INFO] Firebase password reset email sent to {email}")
                else:
                    print(f"[WARNING] Firebase REST API error: {resp.status_code} - {resp.text}")
                    # Fallback: try email verification
                    resp2 = http_requests.post(
                        f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={firebase_api_key}",
                        json={"requestType": "VERIFY_EMAIL", "idToken": ""},
                        timeout=10,
                    )
                    if resp2.status_code == 200:
                        invite_sent = True
                        print(f"[INFO] Firebase verification email sent to {email}")
                    else:
                        print(f"[WARNING] Firebase verification also failed: {resp2.text}")
        except Exception as mail_err:
            print(f"[WARNING] Invitation email skipped: {mail_err}")

        cur.close()
        return_db_connection(conn)

        return {
            "message": f"User {email} invited as {role} to {len(results)} subscription(s)",
            "userId": user_id,
            "inviteSent": invite_sent,
            "results": results,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _init_firebase_admin():
    """Initialize Firebase Admin SDK if not already initialized"""
    import firebase_admin
    from firebase_admin import credentials
    if firebase_admin._apps:
        return
    sa_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
    sa_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')
    if sa_path and os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
    elif sa_json:
        import json as _json
        cred = credentials.Certificate(_json.loads(sa_json))
    else:
        cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)


@app.get("/users/{user_id}/subscriptions")
def get_user_subscriptions(user_id: int):
    """Get all subscriptions a user has access to (for the invitee's view)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                ua.userAuthorizationId,
                ua.customerSubscriptionId,
                ua.role,
                ua.active AS authActive,
                cs.entityId,
                cs.eventId,
                e.eventCode,
                c.customerName,
                cs.active AS subActive,
                CONCAT(ent.entityFirstName, ' ', ISNULL(ent.entityLastName, '')) AS entityName
            FROM dbo.UserAuthorization ua
            JOIN dbo.CustomerSubscriptions cs ON cs.customerSubscriptionId = ua.customerSubscriptionId
            JOIN dbo.Customers c ON c.customerId = cs.customerId
            LEFT JOIN dbo.Event e ON e.eventId = cs.eventId
            LEFT JOIN dbo.Entity ent ON ent.entityId = cs.entityId
            WHERE ua.userId = ? AND ua.active = 'Y' AND cs.active = 'Y'
            ORDER BY c.customerName, cs.entityId
        """, (user_id,))
        rows = cur.fetchall()
        result = []
        for r in rows:
            result.append({
                "userAuthorizationId": r[0],
                "customerSubscriptionId": r[1],
                "role": r[2],
                "authActive": r[3],
                "entityId": r[4],
                "eventId": r[5],
                "eventCode": r[6],
                "customerName": r[7],
                "subActive": r[8],
                "entityName": r[9] if r[9] and str(r[9]).strip() else r[4],
            })
        cur.close()
        return_db_connection(conn)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/users/{user_id}/push-settings")
def get_user_push_settings(user_id: int):
    """Get all push notification settings for a user across all their devices & subscriptions"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                uapn.userAppPushNotificationId,
                uapn.userApplicationId,
                uapn.customerSubscriptionId,
                uapn.enabled,
                uapn.minSeverity,
                CAST(uapn.quietHoursStart AS VARCHAR(8)) AS quietHoursStart,
                CAST(uapn.quietHoursEnd AS VARCHAR(8)) AS quietHoursEnd,
                uapn.soundEnabled,
                uapn.vibrationEnabled,
                uapn.ledEnabled,
                uapn.deliveryChannel,
                cs.entityId,
                c.customerName,
                e.eventCode
            FROM dbo.UserAppPushNotification uapn
            JOIN dbo.UserApplication ua ON ua.userApplicationId = uapn.userApplicationId
            JOIN dbo.CustomerSubscriptions cs ON cs.customerSubscriptionId = uapn.customerSubscriptionId
            JOIN dbo.Customers c ON c.customerId = cs.customerId
            LEFT JOIN dbo.Event e ON e.eventId = cs.eventId
            WHERE ua.userId = ? AND uapn.active = 'Y'
            ORDER BY c.customerName, cs.entityId
        """, (user_id,))
        rows = cur.fetchall()
        result = []
        for r in rows:
            result.append({
                "userAppPushNotificationId": r[0],
                "userApplicationId": r[1],
                "customerSubscriptionId": r[2],
                "enabled": r[3],
                "minSeverity": r[4],
                "quietHoursStart": r[5],
                "quietHoursEnd": r[6],
                "soundEnabled": r[7],
                "vibrationEnabled": r[8],
                "ledEnabled": r[9],
                "deliveryChannel": r[10],
                "entityId": r[11],
                "customerName": r[12],
                "eventCode": r[13],
            })
        cur.close()
        return_db_connection(conn)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/push-settings/{setting_id}")
def update_push_setting(setting_id: int, data: dict):
    """Update push notification preferences for a specific subscription/device"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        update_fields = []
        update_values = []

        field_map = {
            "enabled": ("enabled", lambda v: v if v in ('Y', 'N') else None),
            "minSeverity": ("minSeverity", lambda v: v if v in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') else None),
            "quietHoursStart": ("quietHoursStart", lambda v: v),
            "quietHoursEnd": ("quietHoursEnd", lambda v: v),
            "soundEnabled": ("soundEnabled", lambda v: v if v in ('Y', 'N') else None),
            "vibrationEnabled": ("vibrationEnabled", lambda v: v if v in ('Y', 'N') else None),
            "ledEnabled": ("ledEnabled", lambda v: v if v in ('Y', 'N') else None),
            "deliveryChannel": ("deliveryChannel", lambda v: v if v in ('fcm', 'apns', 'email', 'sms') else None),
        }

        for key, (col, validate) in field_map.items():
            if key in data:
                validated = validate(data[key])
                if validated is None and data[key] is not None:
                    raise HTTPException(status_code=400, detail=f"Invalid value for {key}")
                update_fields.append(f"{col} = ?")
                update_values.append(validated)

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_fields.append("lastUpdateTimestamp = GETDATE()")
        update_values.append(setting_id)

        cur.execute(f"""
            UPDATE dbo.UserAppPushNotification
            SET {', '.join(update_fields)}
            WHERE userAppPushNotificationId = ?
        """, update_values)
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Push setting updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/users/{user_id}/push-settings")
def create_push_setting(user_id: int, data: dict):
    """Create a push notification setting for a user's device + subscription.
    
    Finds the user's active UserApplication (device) and creates a preference row.
    """
    try:
        customer_subscription_id = data.get("customerSubscriptionId")
        if not customer_subscription_id:
            raise HTTPException(status_code=400, detail="customerSubscriptionId is required")

        conn = get_db_connection()
        cur = conn.cursor()

        # Find user's active device (most recent)
        cur.execute("""
            SELECT TOP 1 userApplicationId
            FROM dbo.UserApplication
            WHERE userId = ? AND active = 'Y'
            ORDER BY lastActiveUTC DESC
        """, (user_id,))
        dev_row = cur.fetchone()
        if not dev_row:
            cur.close()
            return_db_connection(conn)
            raise HTTPException(status_code=404, detail="No active device found for this user")
        user_app_id = dev_row[0]

        # Check if already exists
        cur.execute("""
            SELECT userAppPushNotificationId FROM dbo.UserAppPushNotification
            WHERE userApplicationId = ? AND customerSubscriptionId = ?
        """, (user_app_id, customer_subscription_id))
        existing = cur.fetchone()
        if existing:
            cur.close()
            return_db_connection(conn)
            return {"message": "Setting already exists", "userAppPushNotificationId": existing[0]}

        cur.execute("""
            INSERT INTO dbo.UserAppPushNotification
                (userApplicationId, customerSubscriptionId, enabled, minSeverity, deliveryChannel, active)
            VALUES (?, ?, 'Y', ?, 'fcm', 'Y')
        """, (user_app_id, customer_subscription_id, data.get("minSeverity", "MEDIUM")))
        conn.commit()

        cur.execute("""
            SELECT userAppPushNotificationId FROM dbo.UserAppPushNotification
            WHERE userApplicationId = ? AND customerSubscriptionId = ?
        """, (user_app_id, customer_subscription_id))
        new_id = cur.fetchone()[0]

        cur.close()
        return_db_connection(conn)
        return {"message": "Push setting created", "userAppPushNotificationId": new_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/users/by-email/{email}")
def get_user_by_email(email: str):
    """Look up an AppUser by email address"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT userId, firebaseUid, email, displayName, customerId, active
            FROM dbo.AppUser WHERE email = ?
        """, (email.lower(),))
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "userId": row[0],
            "firebaseUid": row[1],
            "email": row[2],
            "displayName": row[3],
            "customerId": row[4],
            "active": row[5],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ADMIN: APP USERS
# ============================================================================

@app.get("/appusers")
def get_all_app_users():
    """List all AppUser records with customer info"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                au.userId, au.firebaseUid, au.email, au.displayName,
                au.customerId, c.customerName, au.active, au.createDate
            FROM dbo.AppUser au
            LEFT JOIN dbo.Customers c ON c.customerId = au.customerId
            ORDER BY au.email
        """)
        rows = cur.fetchall()
        result = []
        for r in rows:
            result.append({
                "userId": r[0],
                "firebaseUid": r[1],
                "email": r[2],
                "displayName": r[3],
                "customerId": r[4],
                "customerName": r[5],
                "active": r[6],
                "createDate": r[7].isoformat() if r[7] else None,
            })
        cur.close()
        return_db_connection(conn)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ADMIN: ALL PUSH NOTIFICATION SETTINGS
# ============================================================================

@app.get("/admin/push-settings")
def get_all_push_settings():
    """List all push notification settings across all users (admin view)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                uapn.userAppPushNotificationId,
                uapn.userApplicationId,
                uapn.customerSubscriptionId,
                uapn.enabled,
                uapn.minSeverity,
                CAST(uapn.quietHoursStart AS VARCHAR(8)) AS quietHoursStart,
                CAST(uapn.quietHoursEnd AS VARCHAR(8)) AS quietHoursEnd,
                uapn.soundEnabled,
                uapn.vibrationEnabled,
                uapn.ledEnabled,
                uapn.deliveryChannel,
                uapn.active,
                au.userId,
                au.email,
                au.displayName,
                ua.platform,
                ua.deviceModel,
                cs.entityId,
                c.customerName,
                e.eventCode
            FROM dbo.UserAppPushNotification uapn
            JOIN dbo.UserApplication ua ON ua.userApplicationId = uapn.userApplicationId
            JOIN dbo.AppUser au ON au.userId = ua.userId
            JOIN dbo.CustomerSubscriptions cs ON cs.customerSubscriptionId = uapn.customerSubscriptionId
            JOIN dbo.Customers c ON c.customerId = cs.customerId
            LEFT JOIN dbo.Event e ON e.eventId = cs.eventId
            ORDER BY au.email, cs.entityId
        """)
        rows = cur.fetchall()
        result = []
        for r in rows:
            result.append({
                "userAppPushNotificationId": r[0],
                "userApplicationId": r[1],
                "customerSubscriptionId": r[2],
                "enabled": r[3],
                "minSeverity": r[4],
                "quietHoursStart": r[5],
                "quietHoursEnd": r[6],
                "soundEnabled": r[7],
                "vibrationEnabled": r[8],
                "ledEnabled": r[9],
                "deliveryChannel": r[10],
                "active": r[11],
                "userId": r[12],
                "email": r[13],
                "displayName": r[14],
                "platform": r[15],
                "deviceModel": r[16],
                "entityId": r[17],
                "customerName": r[18],
                "eventCode": r[19],
            })
        cur.close()
        return_db_connection(conn)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ADMIN: ALL USER AUTHORIZATIONS
# ============================================================================

@app.get("/admin/authorizations")
def get_all_authorizations():
    """List all user authorizations across all subscriptions (admin view)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                ua.userAuthorizationId,
                ua.userId,
                au.email,
                au.displayName,
                ua.customerSubscriptionId,
                cs.entityId,
                c.customerName,
                e.eventCode,
                ua.role,
                ua.active,
                ua.createDate
            FROM dbo.UserAuthorization ua
            JOIN dbo.AppUser au ON au.userId = ua.userId
            JOIN dbo.CustomerSubscriptions cs ON cs.customerSubscriptionId = ua.customerSubscriptionId
            JOIN dbo.Customers c ON c.customerId = cs.customerId
            LEFT JOIN dbo.Event e ON e.eventId = cs.eventId
            ORDER BY au.email, c.customerName
        """)
        rows = cur.fetchall()
        result = []
        for r in rows:
            result.append({
                "userAuthorizationId": r[0],
                "userId": r[1],
                "email": r[2],
                "displayName": r[3],
                "customerSubscriptionId": r[4],
                "entityId": r[5],
                "customerName": r[6],
                "eventCode": r[7],
                "role": r[8],
                "active": r[9],
                "createDate": r[10].isoformat() if r[10] else None,
            })
        cur.close()
        return_db_connection(conn)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


