# ============================================================================
# Yacht Telemetry API - UNIFIED DEPLOYMENT FILE
# Works for: Local Development (Docker), Laptop (.env), and Azure (App Settings)
# ============================================================================
# 
# ENVIRONMENT CONFIGURATION:
# 
# LOCAL LAPTOP (.env file):
#   ENVIRONMENT=local
#   SQL_CONNECTION_STRING=Server=127.0.0.1;Database=BoatTelemetryDB;User=sa;Password=YourStrongPassword123!;
# 
# DOCKER/LOCAL DOCKER-COMPOSE (.env.local):
#   ENVIRONMENT=docker
#   SQL_CONNECTION_STRING=Server=localhost;Database=BoatTelemetryDB;User=sa;Password=YourStrongPassword123!;
# 
# AZURE PRODUCTION (Azure App Settings):
#   ENVIRONMENT=azure
#   SQL_CONNECTION_STRING=Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;
# 
# If SQL_CONNECTION_STRING is not set, the app uses sensible defaults for local dev.
# ============================================================================

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import os
import pyodbc
import json
import traceback
import sys
from dotenv import load_dotenv
import logging
from datetime import datetime as dt

# CRITICAL: Ensure stderr and stdout are unbuffered so errors are captured immediately
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None
sys.stderr.reconfigure(line_buffering=True) if hasattr(sys.stderr, 'reconfigure') else None

# ============================================================================
# LOGGING UTILITIES - MUST BE FIRST (before any log calls)
# ============================================================================

# Configure Python logging to write to stdout (captured by Azure)
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
app_logger = logging.getLogger("VXT-API")

def log_message(level: str, message: str, exc_info=None):
    """Log message to both print statements and Python logging (for Azure capture)"""
    timestamp = dt.now().strftime('%Y-%m-%d %H:%M:%S')
    formatted = f"[{timestamp}] [{level}] {message}"
    
    # Print to stdout (Azure Log Stream captures this)
    print(formatted, flush=True)
    
    # Also use Python logging (some Azure integrations use this)
    if level == "ERROR":
        if exc_info:
            app_logger.exception(message)
        else:
            app_logger.error(message)
    elif level == "WARNING":
        app_logger.warning(message)
    else:  # INFO, DEBUG
        app_logger.info(message)

def log_info(msg: str):
    """Log info message"""
    log_message("INFO", msg)

def log_warn(msg: str):
    """Log warning message"""
    log_message("WARNING", msg)

def log_error_detailed(msg: str, exc=None):
    """Log error with full traceback for debugging"""
    log_message("ERROR", msg, exc_info=exc)
    if exc:
        tb_lines = traceback.format_exc().split('\n')
        for line in tb_lines:
            if line.strip():
                print(f"[{dt.now().strftime('%Y-%m-%d %H:%M:%S')}] [TRACEBACK] {line}", flush=True)

def log_error(msg: str, exc=None):
    """Log error message"""
    log_error_detailed(msg, exc)

# NOW we can safely call logging functions

log_info("===== APP INITIALIZATION STARTED =====")
log_info(f"PID: {os.getpid()}")
log_info(f"Python version: {sys.version}")

try:
    # Load environment variables from .env file (for local/docker environments)
    load_dotenv()
    log_info("Environment variables loaded successfully")
except Exception as e:
    log_error_detailed("Failed to load environment variables", e)
    raise
    log_message("ERROR", msg, exc_info=exc)
    if exc:
        tb_lines = traceback.format_exc().split('\n')
        for line in tb_lines:
            if line.strip():
                print(f"[{dt.now().strftime('%Y-%m-%d %H:%M:%S')}] [TRACEBACK] {line}", flush=True)

# ============================================================================
# ENVIRONMENT DETECTION & CONFIGURATION
# ============================================================================

ENVIRONMENT = os.getenv('ENVIRONMENT', 'production').lower()

# Parse SQL_CONNECTION_STRING from environment (or use defaults for local dev)
SQL_CONNECTION_STRING = os.getenv('SQL_CONNECTION_STRING', '')

def get_db_config():
    """Parse connection string and return pyodbc connection string
    
    Uses SQL_CONNECTION_STRING environment variable in all deployment modes:
    - LOCAL: Set SQL_CONNECTION_STRING in .env file
    - DOCKER: Set SQL_CONNECTION_STRING in docker-compose.yml environment
    - AZURE: Set SQL_CONNECTION_STRING in Azure App Service Configuration
    
    Expected format: Server=hostname;Database=dbname;User=username;Password=password;
    or Azure format: Server=hostname,1433;Database=dbname;User Id=username;Password=password;
    """
    
    if not SQL_CONNECTION_STRING:
        log_warn("SQL_CONNECTION_STRING environment variable not set. Database features will be unavailable.")
        return None
    
    # Parse connection string from environment variable
    # Expected format: Server=...;Database=...;User=...;Password=...;
    config = {}
    for item in SQL_CONNECTION_STRING.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            config[key.strip()] = value.strip()
    
    # Verify required keys are present (handle both 'User' and 'User Id' formats)
    server_key = config.get('Server')
    database_key = config.get('Database')
    user_key = config.get('User') or config.get('User Id')
    password_key = config.get('Password')
    
    if not server_key or not database_key or not user_key or not password_key:
        missing = []
        if not server_key: missing.append('Server')
        if not database_key: missing.append('Database')
        if not user_key: missing.append('User or User Id')
        if not password_key: missing.append('Password')
        raise ValueError(f"SQL_CONNECTION_STRING missing required keys: {missing}. "
                        f"Required format: Server=...;Database=...;User(or User Id)=...;Password=...;")
    
    # Build pyodbc connection string
    # For Azure SQL, use ODBC Driver 17 for SQL Server
    # Format: "Driver={ODBC Driver 17 for SQL Server};Server=hostname,1433;Database=dbname;UID=username;PWD=password;"
    
    conn_str = f"Driver={{ODBC Driver 17 for SQL Server}};Server={server_key};Database={database_key};UID={user_key};PWD={password_key};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
    
    # Check if this is Azure SQL and log for diagnostics
    if '.database.windows.net' in server_key:
        log_info(f"Azure SQL Server detected: {server_key}")
        log_info("Using ODBC Driver 17 for SQL Server with TLS encryption")
    else:
        log_info(f"Local/network SQL Server detected: {server_key}")
    
    return conn_str

log_info("===== DATABASE CONFIGURATION =====")
log_info(f"Deployment Mode: {ENVIRONMENT.upper()}")
log_info("Database Driver: pyodbc 5.0.1 with ODBC Driver 17 for SQL Server (Azure-optimized)")
if SQL_CONNECTION_STRING:
    # Log connection string without exposing password
    conn_info = SQL_CONNECTION_STRING.split('Password')[0]
    log_info(f"Connection String Configured: {conn_info}PASSWORD=***;")
    # Parse and log individual components
    for item in SQL_CONNECTION_STRING.split(';'):
        if '=' in item and 'Password' not in item and 'PWD' not in item:
            key, value = item.split('=', 1)
            log_info(f"  {key.strip()}: {value.strip()}")
else:
    log_info("No SQL_CONNECTION_STRING set - using local development defaults")
log_info("===== END DATABASE CONFIGURATION =====")

# Setup management not included in minimal deployment
setup_router = None

try:
    log_info("Creating FastAPI app...")
    app = FastAPI(title="VXT API")
    log_info("FastAPI app created successfully")
except Exception as e:
    log_error(f"FATAL: Failed to create FastAPI app: {str(e)}", e)
    raise

# Startup event
@app.on_event("startup")
async def startup_event():
    try:
        log_info("===== FastAPI Startup Started =====")
        log_info(f"Environment: {ENVIRONMENT}")
        log_info(f"Connection Driver: ODBC Driver 17 for SQL Server (via pyodbc)")
        log_info(f"PID: {os.getpid()}")
        log_info("===== FastAPI Startup Complete =====")
    except Exception as e:
        log_error(f"Startup failed: {str(e)}", e)
        # Re-raise to prevent app from starting in broken state
        raise

# Define CORS origins based on environment
def get_cors_origins():
    """Get CORS origins from environment or use defaults for development"""
    try:
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
            "http://192.168.1.29:5173"
        ]
        
        if ENVIRONMENT.lower() == 'production':
            # Production: Also allow Azure Static Web Apps
            frontend_url = os.getenv('FRONTEND_URL', 'https://ambitious-sand-0b08c3f03.6.azurestaticapps.net')
            local_origins.append(frontend_url)
            log_info(f"Added production frontend: {frontend_url}")
        
        return local_origins
    except Exception as e:
        log_error(f"Error in get_cors_origins: {str(e)}", e)
        # Return minimal safe defaults if CORS config fails
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

# Enable CORS for React frontends
try:
    log_info("Setting up CORS middleware...")
    cors_origins = get_cors_origins()
    log_info(f"CORS origins configured: {len(cors_origins)} origins")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    log_info("CORS middleware added successfully")
except Exception as e:
    log_error(f"FATAL: Failed to add CORS middleware: {str(e)}", e)
    raise

# Add request logging middleware for better observability
try:
    log_info("Setting up request logging middleware...")
    import time
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request
    from starlette.responses import Response
    
    class RequestLoggingMiddleware(BaseHTTPMiddleware):
        """Log every HTTP request and response for Azure observability"""
        async def dispatch(self, request: Request, call_next):
            start_time = time.time()
            
            # Log request
            log_info(f"[REQUEST] {request.method} {request.url.path} | Query: {request.url.query}")
            
            try:
                # Call the next middleware/handler
                response = await call_next(request)
                
                # Log response
                duration = time.time() - start_time
                log_info(f"[RESPONSE] {request.method} {request.url.path} | Status: {response.status_code} | Duration: {duration:.3f}s")
                
                return response
            except Exception as e:
                # Log any unhandled exceptions
                duration = time.time() - start_time
                log_error(f"[ERROR] {request.method} {request.url.path} | Duration: {duration:.3f}s | {str(e)}", e)
                raise
    
    app.add_middleware(RequestLoggingMiddleware)
    log_info("Request logging middleware added successfully")
except Exception as e:
    log_error(f"FATAL: Failed to add request logging middleware: {str(e)}", e)
    raise

# Custom exception handlers to preserve CORS headers in error responses
try:
    log_info("Setting up exception handlers...")
    from fastapi.responses import JSONResponse
    from starlette.exceptions import HTTPException as StarletteHTTPException
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request, exc):
        """Handle HTTPException with proper CORS headers"""
        log_error(f"HTTPException: {exc.detail}")
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
        if "database" in error_msg.lower() or "pyodbc" in error_msg.lower() or "odbc" in error_msg.lower():
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
        
        log_error(f"{error_category}: {error_msg}", exc)
        
        return JSONResponse(
            status_code=500,
            content={
                "error": error_category,
                "message": error_msg,
                "suggestion": suggestion
            },
            headers=cors_headers
        )
    
    log_info("Exception handlers registered successfully")
except Exception as e:
    log_error(f"FATAL: Failed to register exception handlers: {str(e)}", e)
    raise

# Include setup management endpoints (Device Twin support) if available
if setup_router:
    try:
        log_info("Including setup_management router...")
        app.include_router(setup_router)
        log_info("Successfully included setup_management router")
    except Exception as e:
        log_error(f"WARNING: Failed to include setup_management router: {str(e)}", e)

log_info("===== APP INITIALIZATION COMPLETE =====")

# ============================================================================
# CONNECTION RETRY (Simple wrapper to handle first-connect timeout)
# ============================================================================
import time

def get_db_connection():
    """Get database connection with exponential backoff retry for cold start Azure SQL"""
    conn_str = get_db_config()
    if conn_str is None:
        error_msg = "Database is not configured. SQL_CONNECTION_STRING environment variable is missing."
        log_error(error_msg)
        raise Exception(error_msg)
    
    # Check available ODBC drivers for diagnostics
    try:
        available_drivers = pyodbc.drivers()
        log_info(f"Available ODBC drivers: {available_drivers}")
        if 'ODBC Driver 17 for SQL Server' in available_drivers:
            log_info("✓ ODBC Driver 17 for SQL Server is installed and available")
        else:
            log_warn("⚠ ODBC Driver 17 for SQL Server NOT found in available drivers")
            log_info(f"  Available drivers: {', '.join(available_drivers)}")
    except Exception as e:
        log_warn(f"Could not enumerate ODBC drivers: {str(e)}")
    
    # Retry up to 5 times with exponential backoff for Azure SQL cold start
    max_attempts = 5
    backoff_seconds = [2, 5, 10, 20, 30]  # Exponential backoff delays
    
    for attempt in range(max_attempts):
        try:
            attempt_num = attempt + 1
            log_info(f"Attempting database connection (attempt {attempt_num}/{max_attempts})")
            log_info(f"  Driver: ODBC Driver 17 for SQL Server")
            log_info(f"  Timeout: 30s (for cold start tolerance)")
            
            # Use pyodbc.connect with connection string
            conn = pyodbc.connect(conn_str, timeout=30)
            log_info(f"Database connection successful on attempt {attempt_num}")
            return conn
        except Exception as e:
            error_msg = str(e)[:200]
            attempt_num = attempt + 1
            
            # Provide diagnostic info for common Azure SQL errors
            if 'certificate' in error_msg.lower() or 'tls' in error_msg.lower():
                log_error(f"Connection attempt {attempt_num} - TLS/Certificate Error: {error_msg}", e)
                log_info("  Likely cause: Certificate validation issue (now fixed with ODBC Driver 17)")
            elif 'timeout' in error_msg.lower():
                log_error(f"Connection attempt {attempt_num} - Timeout: {error_msg}", e)
                log_info("  Likely cause: Server unresponsive or network issue")
            elif 'login' in error_msg.lower():
                log_error(f"Connection attempt {attempt_num} - Login/Auth Error: {error_msg}", e)
                log_info("  Likely cause: Invalid credentials - check UID/PWD in connection string")
            else:
                log_error(f"Connection attempt {attempt_num} failed: {error_msg}", e)
            
            if attempt < max_attempts - 1:
                wait_time = backoff_seconds[attempt]
                log_info(f"Waiting {wait_time} seconds before retry (exponential backoff)...")
                time.sleep(wait_time)
            else:
                # All attempts exhausted
                final_error = f"Database connection failed after {max_attempts} attempts: {str(e)[:200]}"
                log_error(final_error, e)
                # Additional diagnostic hint
                if '.database.windows.net' in conn_str:
                    log_error("DIAGNOSTIC HINT: Azure SQL Server connection failed. Verify: 1) Firewall rules allow Azure services, 2) Credentials are correct, 3) ODBC Driver 17 is available")
                raise Exception(final_error)
                    log_error("DIAGNOSTIC HINT: Azure SQL Server requires TLS/SSL. Check firewall rules and FreeTDS configuration.")
                raise Exception(final_error)

def return_db_connection(conn):
    """Close connection (no pooling - simple approach)"""
    if conn:
        try:
            conn.close()
        except Exception as e:
            log_error(f"Error closing database connection: {str(e)}", e)



@app.get("/")
@app.get("/telemetry")
def read_root(mmsi: str = None, limit: int = 50):
    """Health check endpoint or query by MMSI if provided"""
    if mmsi:
        print(f"GET /telemetry?mmsi={mmsi}&limit={limit}")
        return get_boat_telemetry(mmsi, limit)
    return {"status": "Online", "message": "Boat Telemetry API is running"}


@app.get("/health/db")
def health_check_db():
    """Database connectivity diagnostics endpoint with detailed logging"""
    conn = None
    cursor = None
    try:
        log_info("Health check initiated")
        log_info(f"Environment: {ENVIRONMENT}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Test basic query
        log_info("Executing: SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES")
        cursor.execute("SELECT COUNT(*) AS TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
        result = cursor.fetchone()
        table_count = result[0] if result else 0
        log_info(f"Table count: {table_count}")
        
        # Check if critical tables exist
        critical_tables = ['EntityCategory', 'Protocol', 'Provider', 'ProviderEvent', 'Entity', 'EntityType', 'EntityTypeAttribute', 'EntityTelemetry']
        log_info(f"Checking for critical tables: {critical_tables}")
        cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
        existing_tables = [row[0] for row in cursor.fetchall()]
        log_info(f"Found {len(existing_tables)} tables total")
        
        missing_tables = [t for t in critical_tables if t not in existing_tables]
        if missing_tables:
            log_warn(f"Missing tables: {missing_tables}")
        else:
            log_info("All critical tables present")
        
        log_info("Health check completed successfully")
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
        log_error(f"Health check failed: {error_msg}", e)
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": error_msg[:200],
            "message": "Cannot connect to database. Check connection string and server availability.",
            "environment": ENVIRONMENT,
            "suggestion": "Verify Azure SQL Server is accessible and schema has been deployed."
        }
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception as e:
                log_error(f"Error closing cursor in /health/db: {str(e)}", e)
        if conn:
            return_db_connection(conn)


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
    conn = None
    cur = None
    try:
        print(f"[INFO] GET /entitycategories called", flush=True)
        
        conn = get_db_connection()
        cur = conn.cursor()
        print(f"[DEBUG] Executing query for entity categories", flush=True)
        cur.execute("""
            SELECT entityCategoryId, entityCategoryName, active, createDate, lastUpdateTimestamp, lastUpdateUser
            FROM EntityCategory
            ORDER BY entityCategoryName
        """)
        rows = cur.fetchall()
        print(f"[DEBUG] Query returned {len(rows)} rows", flush=True)
        
        categories = []
        for row in rows:
            try:
                categories.append({
                    "entityCategoryId": row[0],
                    "entityCategoryName": row[1],
                    "active": row[2],
                    "createDate": row[3].isoformat() if row[3] else None,
                    "lastUpdateTimestamp": row[4].isoformat() if row[4] else None,
                    "lastUpdateUser": row[5]
                })
            except Exception as row_error:
                log_error(f"Error processing category row: {str(row_error)}", row_error)
                continue
        
        print(f"[INFO] Returning {len(categories)} entity categories", flush=True)
        return categories
    except Exception as e:
        log_error(f"Error in /entitycategories: {str(e)}", e)
        raise HTTPException(status_code=500, detail=f"Error fetching categories: {str(e)[:200]}")
    finally:
        if cur:
            try:
                cur.close()
            except Exception as e:
                log_error(f"Error closing cursor in /entitycategories: {str(e)}", e)
        if conn:
            return_db_connection(conn)


@app.get("/entitycategories/{id}")
def get_entity_category(id: int):
    """Get single entity category by ID"""
    conn = None
    cur = None
    try:
        print(f"[INFO] GET /entitycategories/{id} called", flush=True)
        conn = get_db_connection()
        cur = conn.cursor()
        print(f"[DEBUG] Executing query for category ID: {id}", flush=True)
        cur.execute("""
            SELECT entityCategoryId, entityCategoryName, active, createDate, lastUpdateTimestamp, lastUpdateUser
            FROM EntityCategory
            WHERE entityCategoryId = ?
        """, (id,))
        row = cur.fetchone()
        if not row:
            print(f"[DEBUG] Category not found for ID: {id}", flush=True)
            raise HTTPException(status_code=404, detail="Category not found")
        print(f"[DEBUG] Successfully retrieved category: {row[1]}", flush=True)
        return {
            "entityCategoryId": row[0],
            "entityCategoryName": row[1],
            "active": row[2],
            "createDate": row[3].isoformat() if row[3] else None,
            "lastUpdateTimestamp": row[4].isoformat() if row[4] else None,
            "lastUpdateUser": row[5]
        }
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in /entitycategories/{id}: {str(e)}", e)
        raise HTTPException(status_code=500, detail=f"Error fetching category: {str(e)[:200]}")
    finally:
        if cur:
            try:
                cur.close()
            except Exception as e:
                log_error(f"Error closing cursor in /entitycategories/{id}: {str(e)}", e)
        if conn:
            return_db_connection(conn)


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
        cur.execute("DELETE FROM EntityCategory WHERE entityCategoryId = %s", (id,))
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
    conn = None
    cur = None
    try:
        print(f"[INFO] GET /entitytypes called", flush=True)
        conn = get_db_connection()
        cur = conn.cursor()
        print(f"[DEBUG] Executing query for entity types", flush=True)
        cur.execute("""
            SELECT entityTypeId, entityTypeName, entityCategoryId, active, createDate, lastUpdateTimestamp, lastUpdateUser
            FROM EntityType
            ORDER BY entityTypeName
        """)
        rows = cur.fetchall()
        print(f"[DEBUG] Query returned {len(rows)} rows", flush=True)
        
        types = []
        for row in rows:
            try:
                types.append({
                    "entityTypeId": row[0],
                    "entityTypeName": row[1],
                    "entityCategoryId": row[2],
                    "active": row[3],
                    "createDate": row[4].isoformat() if row[4] else None,
                    "lastUpdateTimestamp": row[5].isoformat() if row[5] else None,
                    "lastUpdateUser": row[6]
                })
            except Exception as row_error:
                log_error(f"Error processing entity type row: {str(row_error)}", row_error)
                continue
        
        print(f"[INFO] Returning {len(types)} entity types", flush=True)
        return types
    except Exception as e:
        log_error(f"Error in /entitytypes: {str(e)}", e)
        raise HTTPException(status_code=500, detail=f"Error fetching entity types: {str(e)[:200]}")
    finally:
        if cur:
            try:
                cur.close()
            except Exception as e:
                log_error(f"Error closing cursor in /entitytypes: {str(e)}", e)
        if conn:
            return_db_connection(conn)


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
        cur.execute("DELETE FROM EntityType WHERE entityTypeId = %s", (id,))
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
                entityTypeAttributeUnit = ?, active = ?
            WHERE entityTypeAttributeId = ?
        """, (
            data.get("entityTypeId"),
            data.get("protocolId"),
            data.get("entityTypeAttributeCode"),
            data.get("entityTypeAttributeName"),
            data.get("entityTypeAttributeTimeAspect", "Pt"),
            data.get("entityTypeAttributeUnit"),
            data.get("active", "Y"),
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
        cur.execute("DELETE FROM EntityTypeAttribute WHERE entityTypeAttributeId = %s", (id,))
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
        cur.execute("DELETE FROM Provider WHERE providerId = %s", (provider_id,))
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
        cur.execute("DELETE FROM Protocol WHERE protocolId = %s", (protocol_id,))
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
        cur.execute("DELETE FROM ProtocolAttribute WHERE protocolAttributeId = %s", (attribute_id,))
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
        cur.execute("DELETE FROM ProviderEvent WHERE providerEventId = %s", (event_id,))
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
        cur.execute("DELETE FROM EntityTypeAttributeScore WHERE entityTypeAttributeScoreId = %s", (id,))
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
        cur.execute("UPDATE Event SET active = 'N' WHERE eventId = %s", (id,))
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
        cur.execute("UPDATE EventAttribute SET active = 'N' WHERE eventId = %s AND entityTypeAttributeId = %s", 
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
    conn = None
    cur = None
    try:
        print("[INFO] GET /entities endpoint called", flush=True)
        if entityTypeId:
            print(f"[DEBUG] Filter entityTypeId: {entityTypeId}", flush=True)
        
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
        
        print("[DEBUG] Executing SQL query for entities", flush=True)
        cur.execute(sql)
        rows = cur.fetchall()
        print(f"[DEBUG] Query returned {len(rows)} rows", flush=True)
        
        entities = []
        for row in rows:
            try:
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
            except Exception as row_error:
                log_error(f"Error processing entity row: {str(row_error)}", row_error)
                # Continue processing other rows instead of failing completely
                continue
        
        print(f"[INFO] Successfully processed {len(entities)} entities", flush=True)
        return entities
        
    except Exception as e:
        log_error(f"Error in /entities endpoint: {str(e)}", e)
        raise HTTPException(status_code=500, detail=f"Error fetching entities: {str(e)[:200]}")
    finally:
        if cur:
            try:
                cur.close()
            except Exception as e:
                log_error(f"Error closing cursor in /entities: {str(e)}", e)
        if conn:
            return_db_connection(conn)


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
        cur.execute("UPDATE Entity SET active = 'N' WHERE entityId = %s", (id,))
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return {"message": "Entity deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# TELEMETRY AND EVENTS ANALYTICS ENDPOINTS
# ============================================================================

@app.get("/api/telemetry/latest/{entity_id}")
async def get_latest_telemetry(entity_id: str):
    """Get the latest telemetry value for each attribute for an entity"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get latest telemetry for each attribute using ROW_NUMBER
        # This ensures we get the absolute latest timestamp for each attribute
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
          FROM dbo.EntityTelemetry et
          JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
          LEFT JOIN dbo.ProtocolAttribute pa ON eta.protocolId = pa.protocolId 
            AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
          WHERE et.entityId = %s
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
        
        cur.execute(query, (entity_id,))
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
async def get_telemetry_range(entity_id: str, startDate: str, endDate: str):
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
            
            # Convert back to SQL Server format that can be parsed
            start_sql = start_dt.strftime('%Y-%m-%d %H:%M:%S.%f')[:-4]  # Remove extra microseconds, keep 3-digit milliseconds
            end_sql = end_dt.strftime('%Y-%m-%d %H:%M:%S.%f')[:-4]
            
            print(f"   Parsed dates - Start: {start_sql}, End: {end_sql}")
        except Exception as parse_err:
            print(f"ERROR: Date parsing error: {parse_err}")
            raise HTTPException(status_code=400, detail=f"Invalid date format: {str(parse_err)}")
        
        # Get telemetry data in date range including location data
        query = """
        SELECT
            et.entityTypeAttributeId,
            eta.entityTypeAttributeCode,
            et.numericValue,
            et.endTimestampUTC,
            et.latitude,
            et.longitude
        FROM dbo.EntityTelemetry et
        JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
        WHERE et.entityId = %s
          AND et.endTimestampUTC >= CONVERT(DATETIME2, %s)
          AND et.endTimestampUTC <= CONVERT(DATETIME2, %s)
        ORDER BY et.endTimestampUTC ASC
        """
        
        cur.execute(query, (entity_id, start_sql, end_sql))
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
async def get_events_range(entity_id: str, startDate: str, endDate: str):
    """Get events for an entity within a date range, ordered by risk and date"""
    try:
        from datetime import datetime
        
        # Parse ISO 8601 UTC datetime strings from frontend
        # Frontend sends format: "2026-03-17T20:27:00.000Z"
        start_dt = datetime.fromisoformat(startDate.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(endDate.replace('Z', '+00:00'))
        
        # Convert to SQL Server datetime format (YYYY-MM-DD HH:MM:SS)
        start_sql = start_dt.strftime('%Y-%m-%d %H:%M:%S')
        end_sql = end_dt.strftime('%Y-%m-%d %H:%M:%S')
        
        print(f"Events query range - Start: {start_sql}, End: {end_sql}")
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get events with details and event information
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
        FROM dbo.EventLog el
        LEFT JOIN dbo.Event e ON el.eventId = e.eventId
        LEFT JOIN dbo.EventLogDetails eld ON el.eventLogId = eld.eventLogId
        WHERE el.entityId = %s
          AND el.triggeredAt >= CAST(%s AS DATETIME)
          AND el.triggeredAt <= CAST(%s AS DATETIME)
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
        
        cur.execute(query, (entity_id, start_sql, end_sql))
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
        FROM dbo.EventLog el
        LEFT JOIN dbo.Event e ON el.eventId = e.eventId
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
        FROM dbo.EventLogDetails eld
        LEFT JOIN dbo.EntityTypeAttribute eta ON eld.entityTypeAttributeId = eta.entityTypeAttributeId
        LEFT JOIN dbo.ProtocolAttribute pa ON eta.protocolId = pa.protocolId 
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
        
        where_clause = ""
        if status:
            where_clause = f"WHERE cs.active = '{status}'"
        
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
                cs.active
            FROM CustomerSubscriptions cs
            JOIN Customers c ON cs.customerId = c.customerId
            LEFT JOIN Event e ON cs.eventId = e.eventId
            {where_clause}
            ORDER BY c.customerName, cs.entityId
        """)
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
                "active": row[8]
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
        
        cur.execute("""
            INSERT INTO CustomerSubscriptions (customerId, entityId, eventId, subscriptionStartDate, subscriptionEndDate, active)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            customer_id,
            data.get("entityId"),
            event_id,
            data.get("subscriptionStartDate"),
            data.get("subscriptionEndDate") if data.get("subscriptionEndDate") else None,
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
        if "subscriptionStartDate" in data:
            update_fields.append("subscriptionStartDate = ?")
            update_values.append(data["subscriptionStartDate"])
        if "subscriptionEndDate" in data:
            update_fields.append("subscriptionEndDate = ?")
            update_values.append(data["subscriptionEndDate"] if data["subscriptionEndDate"] else None)
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


