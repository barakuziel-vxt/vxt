# Yacht Telemetry API - Unified for Local & Azure Deployment
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
import os
import pymssql
import json
import traceback
from datetime import datetime
from dotenv import load_dotenv

# Load .env file for local development
load_dotenv()

# ============================================================================
# CONFIGURATION - All from Environment Variables
# ============================================================================
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")
SQL_CONNECTION_STRING = os.getenv("SQL_CONNECTION_STRING", "")

# Fallback for local development if no env var provided
if not SQL_CONNECTION_STRING:
    if ENVIRONMENT.lower() in ["local", "dev"]:
        # Local dev defaults
        SQL_CONNECTION_STRING = (
            "Server=localhost;"
            "Database=BoatTelemetryDB;"
            "User=sa;"
            "Password=YourStrongPassword123!;"
        )
    else:
        raise ValueError("Error: SQL_CONNECTION_STRING environment variable not set. "
                        "Set it in Azure App Settings or local .env file.")

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://ambitious-sand-0b08c3f03.6.azurestaticapps.net")
ENABLE_SETUP_ROUTER = os.getenv("ENABLE_SETUP_ROUTER", "true").lower() == "true"

# ============================================================================
# APPLICATION INITIALIZATION
# ============================================================================
app = FastAPI(
    title="VXT Yacht Telemetry API",
    version="2.0",
    description="Unified API for local and Azure deployment"
)

print(f"[INFO] Environment: {ENVIRONMENT}")
print(f"[INFO] CORS Frontend: {FRONTEND_URL}")

# ============================================================================
# CORS CONFIGURATION
# ============================================================================
CORS_ORIGINS = [
    # Local development
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:5173",
    # Local network
    "http://192.168.1.29:3000",
    "http://192.168.1.29:3001",
    "http://192.168.1.29:3002",
    "http://192.168.1.29:5173",
    # Production
    FRONTEND_URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# SETUP ROUTER (Optional)
# ============================================================================
if ENABLE_SETUP_ROUTER:
    try:
        from setup_management import router as setup_router
        app.include_router(setup_router)
        print("[INFO] Setup Management Router loaded")
    except ImportError:
        print("[WARN] Setup Management Router not available")

# ============================================================================
# DATABASE FUNCTIONS
# ============================================================================
def get_db_connection():
    """Get database connection using pymssql"""
    try:
        # Parse connection string
        conn_params = {}
        for item in SQL_CONNECTION_STRING.split(";"):
            if "=" in item:
                key, value = item.split("=", 1)
                conn_params[key.strip()] = value.strip()
        
        connection = pymssql.connect(
            server=conn_params.get("Server", "localhost"),
            database=conn_params.get("Database"),
            user=conn_params.get("User"),
            password=conn_params.get("Password"),
            timeout=30,
            as_dict=False
        )
        return connection
    except Exception as e:
        print(f"[ERROR] DB connection failed: {str(e)}")
        raise

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Return JSON error with CORS headers"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail)},
        headers={"Access-Control-Allow-Origin": FRONTEND_URL},
    )

# ============================================================================
# HEALTH CHECKS
# ============================================================================
@app.get("/")
@app.get("/health")
def health_check():
    """API health check"""
    return {
        "status": "Online",
        "environment": ENVIRONMENT,
        "message": "VXT Yacht Telemetry API is running"
    }

@app.get("/health/db")
def db_health_check():
    """Database connectivity check"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT GETDATE()")
        timestamp = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return {
            "status": "Connected",
            "database": "Azure SQL Server",
            "timestamp": str(timestamp)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB connection failed: {str(e)}")

# ============================================================================
# ENDPOINTS - PROVIDERS
# ============================================================================
@app.get("/providers")
def get_providers():
    """Get all providers"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT providerId, providerName, providerDescription, providerCategory, 
                   apiBaseUrl, apiVersion, documentationUrl, active
            FROM Provider
            ORDER BY providerName
        """)
        providers = [
            {
                "providerId": row[0],
                "providerName": row[1],
                "providerDescription": row[2],
                "providerCategory": row[3],
                "apiBaseUrl": row[4],
                "apiVersion": row[5],
                "documentationUrl": row[6],
                "active": row[7]
            }
            for row in cursor.fetchall()
        ]
        cursor.close()
        conn.close()
        return providers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/providers")
def create_provider(data: dict):
    """Create a new provider"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO Provider (providerName, providerDescription, providerCategory, 
                                  apiBaseUrl, apiVersion, documentationUrl, active)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            data.get("providerName"),
            data.get("providerDescription"),
            data.get("providerCategory"),
            data.get("apiBaseUrl"),
            data.get("apiVersion"),
            data.get("documentationUrl"),
            data.get("active", "N")
        ))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "Created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/providers/{provider_id}")
def update_provider(provider_id: int, data: dict):
    """Update a provider"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE Provider
            SET providerName = %s, providerDescription = %s, providerCategory = %s,
                apiBaseUrl = %s, apiVersion = %s, documentationUrl = %s, active = %s
            WHERE providerId = %s
        """, (
            data.get("providerName"),
            data.get("providerDescription"),
            data.get("providerCategory"),
            data.get("apiBaseUrl"),
            data.get("apiVersion"),
            data.get("documentationUrl"),
            data.get("active", "N"),
            provider_id
        ))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "Updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/providers/{provider_id}")
def delete_provider(provider_id: int):
    """Delete a provider"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Provider WHERE providerId = %s", (provider_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "Deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ENDPOINTS - CUSTOMERS
# ============================================================================
@app.get("/customers")
def get_customers():
    """Get all customers"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT customerId, customerName, active FROM Customers ORDER BY customerName")
        customers = [
            {
                "customerId": row[0],
                "customerName": row[1],
                "active": row[2]
            }
            for row in cursor.fetchall()
        ]
        cursor.close()
        conn.close()
        return customers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/customers/{id}")
def get_customer(id: int):
    """Get a single customer"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT customerId, customerName, active FROM Customers WHERE customerId = %s", (id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        return {
            "customerId": row[0],
            "customerName": row[1],
            "active": row[2]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/customers")
def create_customer(data: dict):
    """Create a new customer"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO Customers (customerName, active) VALUES (%s, %s)",
            (data.get("customerName"), data.get("active", "Y"))
        )
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "Created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ENDPOINTS - ENTITIES
# ============================================================================
@app.get("/entities")
def get_entities():
    """Get all entities"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT e.entityId, e.entityFirstName, et.entityTypeName, e.active
            FROM Entity e
            LEFT JOIN EntityType et ON e.entityTypeId = et.entityTypeId
            ORDER BY e.entityFirstName
        """)
        entities = [
            {
                "entityId": row[0],
                "entityName": row[1],
                "entityType": row[2],
                "active": row[3]
            }
            for row in cursor.fetchall()
        ]
        cursor.close()
        conn.close()
        return entities
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ENDPOINTS - CUSTOMER ENTITIES
# ============================================================================
@app.get("/customerentities")
def get_customer_entities(customer_id: int = None):
    """Get customer entities"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        where_clause = f"WHERE ce.customerId = {customer_id}" if customer_id else ""
        cursor.execute(f"""
            SELECT ce.customerEntityId, ce.customerId, c.customerName,
                   ce.entityId, e.entityFirstName, et.entityTypeName, ce.active
            FROM CustomerEntities ce
            JOIN Customers c ON ce.customerId = c.customerId
            LEFT JOIN Entity e ON ce.entityId = e.entityId
            LEFT JOIN EntityType et ON e.entityTypeId = et.entityTypeId
            {where_clause}
            ORDER BY c.customerName, ce.entityId
        """)
        entities = [
            {
                "customerEntityId": row[0],
                "customerId": row[1],
                "customerName": row[2],
                "entityId": row[3],
                "entityName": row[4],
                "entityTypeCode": row[5],
                "active": row[6]
            }
            for row in cursor.fetchall()
        ]
        cursor.close()
        conn.close()
        return entities
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/customerentities/{id}")
def get_customer_entity(id: int):
    """Get single customer entity"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ce.customerEntityId, ce.customerId, c.customerName,
                   ce.entityId, e.entityFirstName, et.entityTypeName, ce.active
            FROM CustomerEntities ce
            JOIN Customers c ON ce.customerId = c.customerId
            LEFT JOIN Entity e ON ce.entityId = e.entityId
            LEFT JOIN EntityType et ON e.entityTypeId = et.entityTypeId
            WHERE ce.customerEntityId = %s
        """, (id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        return {
            "customerEntityId": row[0],
            "customerId": row[1],
            "customerName": row[2],
            "entityId": row[3],
            "entityName": row[4],
            "entityTypeCode": row[5],
            "active": row[6]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/customerentities")
def create_customer_entity(data: dict):
    """Create new customer entity"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO CustomerEntities (customerId, entityId, active) VALUES (%s, %s, %s)",
            (data.get("customerId"), data.get("entityId"), data.get("active", "Y"))
        )
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "Created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/customerentities/{id}")
def update_customer_entity(id: int, data: dict):
    """Update customer entity"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE CustomerEntities SET customerId = %s, entityId = %s, active = %s WHERE customerEntityId = %s",
            (data.get("customerId"), data.get("entityId"), data.get("active", "Y"), id)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "Updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/customerentities/{id}")
def delete_customer_entity(id: int):
    """Delete customer entity"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM CustomerEntities WHERE customerEntityId = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "Deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ENDPOINTS - CUSTOMER SUBSCRIPTIONS
# ============================================================================
@app.get("/customersubscriptions")
def get_customer_subscriptions(customer_id: int = None):
    """Get customer subscriptions"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        where_clause = f"WHERE cs.customerId = {customer_id}" if customer_id else ""
        cursor.execute(f"""
            SELECT cs.customerSubscriptionId, cs.customerId, c.customerName,
                   cs.entityId, e.entityFirstName, sf.functionName, cs.active
            FROM CustomerSubscriptions cs
            JOIN Customers c ON cs.customerId = c.customerId
            LEFT JOIN Entity e ON cs.entityId = e.entityId
            LEFT JOIN SubscriptionFunction sf ON cs.subscriptionFunctionId = sf.subscriptionFunctionId
            {where_clause}
            ORDER BY c.customerName, sf.functionName
        """)
        subs = [
            {
                "customerSubscriptionId": row[0],
                "customerId": row[1],
                "customerName": row[2],
                "entityId": row[3],
                "entityName": row[4],
                "functionName": row[5],
                "active": row[6]
            }
            for row in cursor.fetchall()
        ]
        cursor.close()
        conn.close()
        return subs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
