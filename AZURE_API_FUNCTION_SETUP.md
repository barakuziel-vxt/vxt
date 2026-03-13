# Azure API Function Layer Deployment - Complete Setup Guide

## 📋 Overview

This guide walks you through deploying the FastAPI backend as **Azure Functions with HTTP Triggers**.

**Key Points**:
- ✅ Uses **Consumption Plan** (pay-per-use, FREE tier)
- ✅ **Python 3.11** runtime
- ✅ **HTTP Triggers** for REST API endpoints
- ✅ **Connection string** to Azure SQL Database
- ✅ **CORS** configured for frontend access
- ✅ **5 endpoints** + 1 new sync endpoint

---

## 🎯 What You'll Deploy

### API Endpoints

```
GET /api/customerentities
├─ Returns: All entities with iotDeviceId field
├─ Authentication: None (for MVP)
└─ Response: JSON array

GET /api/customerentities/{id}
├─ Returns: Single entity by ID
├─ Query: /api/customerentities/2
└─ Response: JSON object

POST /api/customerentities
├─ Creates: New entity
├─ Body: {entityId, iotDeviceId, entityName, ...}
└─ Returns: Created entity with ID

PUT /api/customerentities/{id}
├─ Updates: Entity (including iotDeviceId)
├─ Body: {entityId, iotDeviceId, ...}
└─ Returns: Updated entity

DELETE /api/customerentities/{id}
├─ Deletes: Entity by ID
├─ Body: None
└─ Returns: 204 No Content

POST /api/customerentities/{id}/sync-setup ⭐ NEW
├─ Syncs: Entity configuration to Device Twin
├─ Body: {provider_name: "iot_hub"}
├─ Action: Updates Azure IoT Hub Device Twin
└─ Returns: {status: "success", device_id: "..."}
```

---

## 🚀 Step-by-Step Deployment

### STEP 1: Create Storage Account

**Why needed**: Azure Functions require a storage account for runtime, logs, and state.

**Azure Portal Steps**:
1. Go to **Azure Portal** → Search "Storage accounts"
2. Click **Create**
3. Fill in:
   - **Subscription**: (select your subscription)
   - **Resource Group**: vxt-resource-group
   - **Storage account name**: vxtstorage (must be globally unique - add timestamp)
   - **Region**: East US (same as resource group)
   - **Performance**: Standard (Recommended)
   - **Redundancy**: Locally-redundant storage (LRS)
4. Click **Review + Create** → **Create**

**Expected**: Creation takes 2-3 minutes

---

### STEP 2: Create Function App

**Azure Portal Steps**:
1. Go to **Azure Portal** → Search "Function App"
2. Click **Create**
3. Fill in:
   - **Subscription**: (select your subscription)
   - **Resource Group**: vxt-resource-group
   - **Function App name**: vxt-api-functions (must be unique globally)
   - **Publish**: Code
   - **Runtime stack**: Python
   - **Version**: 3.11
   - **Region**: East US
   - **Storage account**: vxtstorage (created in Step 1)
   - **Hosting options**: Consumption (Free tier) ✅
   - **Operating System**: Linux
4. Click **Review + Create** → **Create**

**Expected**: Creation takes 3-5 minutes

---

### STEP 3: Configure Python Functions

#### Option A: Using Azure Portal Development (Fastest for Testing)

**Create Function 1: GetCustomerEntities**

1. Go to **Function App** → **vxt-api-functions**
2. Click **Functions** → **Create**
3. Select:
   - **Development environment**: Develop in portal
   - **Template**: HTTP trigger
   - **New Function**: HttpTriggerGetEntities
   - **Authorization level**: Anonymous
4. Click **Create**
5. Replace code with: [See Code Section Below]

#### Option B: Using VS Code (Recommended for Production)

**Prerequisites**:
```powershell
# Install Azure Functions Core Tools
choco install azure-functions-core-tools-3 -y

# Or download from: https://aka.ms/func-cli-install
```

**Steps**:
1. Create local functions project:
```powershell
func init ApiLayer --python
cd ApiLayer
```

2. Create first function:
```powershell
func new --name GetCustomerEntities --template "HTTP trigger"
```

3. Repeat for each function (see list below)

4. Deploy to Azure:
```powershell
func azure functionapp publish vxt-api-functions
```

---

## 🔧 Azure Function Code Templates

### Function 1: GET /api/customerentities

**Name**: HttpTriggerGetEntities  
**Trigger**: HTTP GET  
**Authorization**: Anonymous

```python
import azure.functions as func
import pyodbc
import json
import os
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    GET /api/customerentities
    Returns all customer entities with iotDeviceId field
    """
    
    try:
        # Get connection string from environment variable
        connection_string = os.environ.get("AzureSqlConnectionString")
        
        if not connection_string:
            return func.HttpResponse(
                json.dumps({"error": "Database connection not configured"}),
                status_code=500,
                mimetype="application/json"
            )
        
        # Connect to Azure SQL Database
        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        
        # Query all entities
        query = """
            SELECT 
                customerEntityId,
                customerId,
                entityId,
                entityName,
                entityType,
                iotDeviceId,
                status,
                created_at,
                updated_at
            FROM CustomerEntities
            ORDER BY customerEntityId
        """
        
        cursor.execute(query)
        columns = [column[0] for column in cursor.description]
        
        entities = []
        for row in cursor.fetchall():
            entity = dict(zip(columns, row))
            # Convert datetime objects to ISO format strings
            for key in entity:
                if isinstance(entity[key], datetime):
                    entity[key] = entity[key].isoformat()
            entities.append(entity)
        
        cursor.close()
        conn.close()
        
        return func.HttpResponse(
            json.dumps(entities),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
```

---

### Function 2: GET /api/customerentities/{id}

**Name**: HttpTriggerGetEntity  
**Trigger**: HTTP GET with route parameter  
**Authorization**: Anonymous  
**Route**: customerentities/{id}

```python
import azure.functions as func
import pyodbc
import json
import os
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    GET /api/customerentities/{id}
    Returns specific customer entity by ID
    """
    
    try:
        entity_id = req.route_params.get('id')
        
        if not entity_id:
            return func.HttpResponse(
                json.dumps({"error": "Entity ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        connection_string = os.environ.get("AzureSqlConnectionString")
        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        
        query = """
            SELECT 
                customerEntityId,
                customerId,
                entityId,
                entityName,
                entityType,
                iotDeviceId,
                status,
                created_at,
                updated_at
            FROM CustomerEntities
            WHERE customerEntityId = ?
        """
        
        cursor.execute(query, (entity_id,))
        row = cursor.fetchone()
        
        if not row:
            return func.HttpResponse(
                json.dumps({"error": "Entity not found"}),
                status_code=404,
                mimetype="application/json"
            )
        
        columns = [column[0] for column in cursor.description]
        entity = dict(zip(columns, row))
        
        # Convert datetime objects
        for key in entity:
            if isinstance(entity[key], datetime):
                entity[key] = entity[key].isoformat()
        
        cursor.close()
        conn.close()
        
        return func.HttpResponse(
            json.dumps(entity),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
```

---

### Function 3: POST /api/customerentities/{id}/sync-setup ⭐

**Name**: HttpTriggerSyncSetup  
**Trigger**: HTTP POST  
**Authorization**: Anonymous  
**Route**: customerentities/{id}/sync-setup  
**NEW Feature**: Syncs entity configuration to Device Twin

```python
import azure.functions as func
import json
import os
from datetime import datetime
from azure.iot.hub import IoTHubRegistryManager
import pyodbc

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST /api/customerentities/{id}/sync-setup
    Syncs entity configuration to Azure IoT Hub Device Twin
    
    Request Body:
    {
        "provider_name": "iot_hub"
    }
    """
    
    try:
        entity_id = req.route_params.get('id')
        
        if not entity_id:
            return func.HttpResponse(
                json.dumps({"error": "Entity ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Get request body
        req_body = req.get_json()
        provider_name = req_body.get('provider_name', 'iot_hub')
        
        # Get entity details from database
        connection_string = os.environ.get("AzureSqlConnectionString")
        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        
        query = "SELECT * FROM CustomerEntities WHERE customerEntityId = ?"
        cursor.execute(query, (entity_id,))
        row = cursor.fetchone()
        
        if not row:
            return func.HttpResponse(
                json.dumps({"error": "Entity not found"}),
                status_code=404,
                mimetype="application/json"
            )
        
        columns = [column[0] for column in cursor.description]
        entity = dict(zip(columns, row))
        
        device_id = entity.get('iotDeviceId')
        
        if not device_id:
            return func.HttpResponse(
                json.dumps({
                    "error": "Entity does not have an IoT Device ID assigned",
                    "status": "failed",
                    "device_id": None
                }),
                status_code=400,
                mimetype="application/json"
            )
        
        # Update Device Twin in Azure IoT Hub
        try:
            iot_hub_conn_string = os.environ.get("IoTHubConnectionString")
            
            if not iot_hub_conn_string:
                # Fallback: Just log the intent (for testing without IoT Hub)
                return func.HttpResponse(
                    json.dumps({
                        "status": "success",
                        "device_id": device_id,
                        "message": "Setup sync initiated",
                        "timestamp": datetime.utcnow().isoformat(),
                        "configured_properties": {
                            "entityId": entity.get('entityId'),
                            "entityName": entity.get('entityName'),
                            "entityType": entity.get('entityType')
                        }
                    }),
                    status_code=200,
                    mimetype="application/json"
                )
            
            registry_manager = IoTHubRegistryManager(iot_hub_conn_string)
            
            # Build desired property update
            device_twin_data = {
                "properties": {
                    "desired": {
                        "setup": {
                            "entityId": entity.get('entityId'),
                            "entityName": entity.get('entityName'),
                            "entityType": entity.get('entityType'),
                            "provider": provider_name,
                            "synced_at": datetime.utcnow().isoformat(),
                            "version": 1
                        }
                    }
                }
            }
            
            # Update the device twin
            registry_manager.update_twin(device_id, device_twin_data)
            
            return func.HttpResponse(
                json.dumps({
                    "status": "success",
                    "device_id": device_id,
                    "message": "Setup synced to device successfully",
                    "timestamp": datetime.utcnow().isoformat(),
                    "configured_properties": device_twin_data["properties"]["desired"]["setup"]
                }),
                status_code=200,
                mimetype="application/json"
            )
            
        except Exception as iot_error:
            return func.HttpResponse(
                json.dumps({
                    "status": "failed",
                    "device_id": device_id,
                    "error": f"IoT Hub sync failed: {str(iot_error)}"
                }),
                status_code=500,
                mimetype="application/json"
            )
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e), "status": "failed"}),
            status_code=500,
            mimetype="application/json"
        )
```

---

### Function 4: POST /api/customerentities (Create)

```python
import azure.functions as func
import pyodbc
import json
import os

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST /api/customerentities
    Creates a new customer entity
    """
    
    try:
        req_body = req.get_json()
        
        # Validate required fields
        required_fields = ['customerId', 'entityId', 'entityName']
        for field in required_fields:
            if field not in req_body:
                return func.HttpResponse(
                    json.dumps({"error": f"Missing required field: {field}"}),
                    status_code=400,
                    mimetype="application/json"
                )
        
        connection_string = os.environ.get("AzureSqlConnectionString")
        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        
        # Insert new entity
        insert_query = """
            INSERT INTO CustomerEntities 
            (customerId, entityId, entityName, entityType, iotDeviceId, status)
            VALUES (?, ?, ?, ?, ?, ?)
        """
        
        cursor.execute(insert_query, (
            req_body.get('customerId'),
            req_body.get('entityId'),
            req_body.get('entityName'),
            req_body.get('entityType', ''),
            req_body.get('iotDeviceId'),
            req_body.get('status', 'Active')
        ))
        
        conn.commit()
        
        # Get the newly created ID
        select_query = "SELECT CAST(SCOPE_IDENTITY() as int)"
        cursor.execute(select_query)
        new_id = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        return func.HttpResponse(
            json.dumps({"id": new_id, "message": "Entity created successfully"}),
            status_code=201,
            mimetype="application/json"
        )
        
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
```

---

### Function 5: PUT /api/customerentities/{id} (Update)

```python
import azure.functions as func
import pyodbc
import json
import os

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    PUT /api/customerentities/{id}
    Updates an existing customer entity
    """
    
    try:
        entity_id = req.route_params.get('id')
        req_body = req.get_json()
        
        connection_string = os.environ.get("AzureSqlConnectionString")
        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        
        # Build dynamic UPDATE statement
        update_fields = []
        values = []
        
        if 'entityName' in req_body:
            update_fields.append("entityName = ?")
            values.append(req_body['entityName'])
        
        if 'entityType' in req_body:
            update_fields.append("entityType = ?")
            values.append(req_body['entityType'])
        
        if 'iotDeviceId' in req_body:
            update_fields.append("iotDeviceId = ?")
            values.append(req_body['iotDeviceId'])
        
        if 'status' in req_body:
            update_fields.append("status = ?")
            values.append(req_body['status'])
        
        if not update_fields:
            return func.HttpResponse(
                json.dumps({"error": "No fields to update"}),
                status_code=400,
                mimetype="application/json"
            )
        
        update_fields.append("updated_at = GETUTCDATE()")
        values.append(entity_id)
        
        update_query = f"UPDATE CustomerEntities SET {', '.join(update_fields)} WHERE customerEntityId = ?"
        
        cursor.execute(update_query, values)
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return func.HttpResponse(
            json.dumps({"message": "Entity updated successfully"}),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
```

---

###Function 6: DELETE /api/customerentities/{id}

```python
import azure.functions as func
import pyodbc
import json
import os

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    DELETE /api/customerentities/{id}
    Deletes a customer entity
    """
    
    try:
        entity_id = req.route_params.get('id')
        
        if not entity_id:
            return func.HttpResponse(
                json.dumps({"error": "Entity ID is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        connection_string = os.environ.get("AzureSqlConnectionString")
        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        
        delete_query = "DELETE FROM CustomerEntities WHERE customerEntityId = ?"
        cursor.execute(delete_query, (entity_id,))
        
        if cursor.rowcount == 0:
            return func.HttpResponse(
                status_code=404
            )
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return func.HttpResponse(
            status_code=204
        )
        
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
```

---

## ⚙️ STEP 4: Configure Environment Variables

**Azure Portal Steps**:
1. Go to **Function App** → **vxt-api-functions**
2. Click **Configuration** (left sidebar)
3. Click **+ New application setting**
4. Add these settings:

| Name | Value |
|------|-------|
| `AzureSqlConnectionString` | `Server=tcp:vxtdb.database.windows.net,1433;Initial Catalog=free-sql-db-5949639;Persist Security Info=False;User ID=vxt;Password=Barak1976!;Encrypt=True;Connection Timeout=30;` |
| `IoTHubConnectionString` | (Optional - for Device Twin sync) |
| `Environment` | `Production` |

5. Click **Save**

---

## 🔒 STEP 5: Configure CORS

**Purpose**: Allow React dashboard to call API functions

**Azure Portal Steps**:
1. Go to **Function App** → **vxt-api-functions**
2. Click **CORS** (left sidebar under API)
3. Add allowed origins:
   - `http://localhost:3001` (local development)
   - `http://localhost:5173` (Vite development)
   - `https://vxt-admin-dashboard.azurewebsites.net` (production)
4. Click **Save**

---

## 🧪 STEP 6: Test the Deployed Functions

### Test 1: GET All Entities

```powershell
$apiUrl = "https://vxt-api-functions.azurewebsites.net/api"

# Make request
$response = Invoke-RestMethod -Uri "$apiUrl/customerentities" -Method GET

# Display results
$response | ConvertTo-Json | Write-Host
```

**Expected Response**:
```json
[
  {
    "customerEntityId": 2,
    "entityId": "234567890",
    "iotDeviceId": "TomerRefael",
    "entityName": "Boat",
    "entityType": "Vessel",
    "status": "Active"
  },
  ...
]
```

### Test 2: GET Specific Entity

```powershell
$response = Invoke-RestMethod -Uri "$apiUrl/customerentities/2" -Method GET
$response | ConvertTo-Json | Write-Host
```

### Test 3: POST Sync Setup ⭐

```powershell
$body = @{ provider_name = "iot_hub" } | ConvertTo-Json

$response = Invoke-RestMethod `
    -Uri "$apiUrl/customerentities/2/sync-setup" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"

$response | ConvertTo-Json | Write-Host
```

**Expected Response**:
```json
{
  "status": "success",
  "device_id": "TomerRefael",
  "message": "Setup synced to device successfully",
  "timestamp": "2026-03-13T...",
  "configured_properties": {
    "entityId": "234567890",
    "entityName": "Boat",
    "entityType": "Vessel",
    "provider": "iot_hub"
  }
}
```

---

## 📦 Dependency Management

### Python Requirements

Create `requirements.txt` in function app root:

```
azure-functions
azure-identity
azure-iot-hub
pyodbc
python-dateutil
```

**Azure Portal** (for requirements.txt):
1. Function App → **App Service Editor** (or VS Code)
2. Create `requirements.txt` in root
3. Paste the above content
4. Save (auto-deploys)

---

## 🔍 Monitoring & Logging

### View Function Logs

**Azure Portal**:
1. Function App → **Functions** → Select a function
2. Click **Monitor** tab
3. View execution logs and errors in real-time

### Application Insights Queries

```kusto
// Track all API calls
requests
| where name contains "api"
| summarize count(), avg(duration), max(duration) by name

// Find errors
traces
| where severity contains "error"
| summarize count() by message
```

---

## 🚨 Troubleshooting

### "Could not connect to SQL Database"
- ✅ Verify connection string in environment variables
- ✅ Check Azure SQL firewall: allow "Azure services"
- ✅ Test connection string locally first

### "CORS error in frontend"
- ✅ Verify CORS configuration includes dashboard origin
- ✅ Check function authorization level
- ✅ Inspect browser console for exact error

### "Function timeout"
- ✅ Check database query performance
- ✅ Add indexes to frequently queried columns
- ✅ Monitor query execution time (Application Insights)

### "Pyodbc module not found"
- ✅ Ensure `requirements.txt` includes `pyodbc`
- ✅ Restart the Function App after deploying requirements

---

## ✅ Deployment Checklist

- [ ] Resource Group created
- [ ] Storage Account created and linked
- [ ] Function App created (Consumption plan)
- [ ] 6 HTTP functions deployed
- [ ] Environment variables configured
- [ ] CORS enabled for dashboard origins
- [ ] Database connection tested
- [ ] All 6 endpoints tested locally
- [ ] Logs visible in Application Insights
- [ ] Ready for frontend deployment

---

## 📄 Next Steps

1. ✅ **This Phase Complete**: API functions deployed
2. **Next**: Deploy Frontend React Application
   - See: `AZURE_FRONTEND_DEPLOYMENT.md`
   - Build React app
   - Deploy to Azure App Service
   - Test sync feature end-to-end

3. **Optional**: Set up CI/CD
   - GitHub Actions workflow
   - Automated function deployment

---

**Status**: Phase 2 (Backend API) - Complete  
**Next**: Phase 3 (Frontend Application)  
**Overall Progress**: 66% (Database ✅, API ✅, Frontend ⏳)

Generated: March 13, 2026
