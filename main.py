# Yacht Telemetry API (main.py)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import os
import pyodbc
import json
import traceback

app = FastAPI(title="VXT API")

# Enable CORS for React frontends (multiple dashboards)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SQL Server connection configuration
SQL_CONN_STR = (
    # Fallback to the older 'SQL Server' driver available on this machine
    'DRIVER={SQL Server};'
    'SERVER=127.0.0.1;'
    'DATABASE=BoatTelemetryDB;'
    'UID=sa;'
    'PWD=YourStrongPassword123!'
)


def get_db_connection():
    """Get database connection"""
    return pyodbc.connect(SQL_CONN_STR)


@app.get("/")
@app.get("/telemetry")
def read_root(mmsi: str = None, limit: int = 50):
    """Health check endpoint or query by MMSI if provided"""
    if mmsi:
        print(f"GET /telemetry?mmsi={mmsi}&limit={limit}")
        return get_boat_telemetry(mmsi, limit)
    return {"status": "Online", "message": "Boat Telemetry API is running"}


@app.get("/telemetry/{MMSI}")
def get_boat_telemetry(MMSI: str, limit: int = 50):
    """Retrieve latest telemetry data for a specific boat"""
    try:
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
        
        cursor.execute(query, MMSI, limit)
        rows = cursor.fetchall()
        
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
        conn.close()
        
        # Return in chronological order (ascending)
        return result[::-1]
        
    except Exception as e:
        print(f"ERROR in get_boat_telemetry: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# new API endpoint that retrieves from EntityTelemetry
@app.get("/health/new/{ID}")
def get_health_vitals_new(ID: str, limit: int = 50):
    """Retrieve latest individual health telemetry samples (time-series format for live dashboard)"""
    try:
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

        cursor.execute(query, (ID, limit))
        rows = cursor.fetchall()

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
        conn.close()

        return result

    except Exception as e:
        print(f"ERROR in get_health_vitals_new: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health/{ID}")
def get_health_vitals(ID: str, limit: int = 50):
    """Retrieve latest health vitals for a specific patient"""
    try:
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
        conn.close()

        return result[::-1]

    except Exception as e:
        print(f"ERROR in get_health_vitals: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/customers/{customerName}/properties")
def get_properties_by_customer_name(customerName: str):
    """
    Returns customer's properties (customerName and Customer subscriptions entities).
    """
    try:
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
  
        cur.execute(sql, customerName)
        rows = []
        for r in cur.fetchall():
            rows.append({
                "customerPropertyName": r[0],
                "entityId": r[1],
                "propertyTypeId": r[2],
                "year": r[3]
            })
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ADMIN DASHBOARD API ENDPOINTS
# ============================================

# Entity Category Endpoints
@app.get("/entitycategories")
def get_entity_categories():
    """Get all entity categories"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT entityCategoryId, entityCategoryName, active, createDate, lastUpdateTimestamp, lastUpdateUser
            FROM EntityCategory
            WHERE active = 'Y'
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
        conn.close()
        return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
            WHERE active = 'Y'
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
                   pa.component
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
                "component": row[13]
            })
        cur.close()
        conn.close()
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
                   pa.component
            FROM EntityTypeAttribute eta
            LEFT JOIN ProtocolAttribute pa ON eta.protocolId = pa.protocolId 
                AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
            WHERE eta.entityTypeAttributeId = ?
        """, (id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
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
            "component": row[13]
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
        
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
        conn.close()
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
            et.numericValue,
            et.stringValue,
            et.endTimestampUTC,
            ROW_NUMBER() OVER (PARTITION BY eta.entityTypeAttributeId ORDER BY et.endTimestampUTC DESC) AS rn
          FROM dbo.EntityTelemetry et
          JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
          WHERE et.entityId = ?
            AND (et.numericValue IS NOT NULL OR et.stringValue IS NOT NULL)
        )
        SELECT 
          entityTypeAttributeId,
          entityTypeAttributeCode,
          entityTypeAttributeName,
          entityTypeAttributeUnit,
          numericValue,
          stringValue,
          endTimestampUTC
        FROM LatestPerAttribute 
        WHERE rn = 1
        ORDER BY entityTypeAttributeCode
        """
        
        cur.execute(query, (entity_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        results = []
        for row in rows:
            results.append({
                "entityTypeAttributeId": row[0],
                "attributeCode": row[1],
                "attributeName": row[2],
                "attributeUnit": row[3],
                "numericValue": row[4],
                "stringValue": row[5],
                "endTimestampUTC": row[6]
            })
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/telemetry/range/{entity_id}")
async def get_telemetry_range(entity_id: str, startDate: str, endDate: str):
    """Get telemetry data for an entity within a date range, formatted for charting"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Frontend now sends UTC ISO format strings (e.g., "2026-02-15T12:48:00.000Z")
        # Just use them directly for database query
        print(f"Telemetry query range - Start (UTC): {startDate}, End (UTC): {endDate}")
        
        # Get telemetry data in date range
        query = """
        SELECT
            et.entityTypeAttributeId,
            eta.entityTypeAttributeCode,
            et.numericValue,
            et.endTimestampUTC
        FROM dbo.EntityTelemetry et
        JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
        WHERE et.entityId = ?
          AND et.endTimestampUTC >= CONVERT(DATETIME, ?)
          AND et.endTimestampUTC <= CONVERT(DATETIME, ?)
        ORDER BY et.endTimestampUTC ASC
        """
        
        cur.execute(query, (entity_id, startDate, endDate))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        # Transform data for charting: pivot by timestamp
        data_dict = {}
        for row in rows:
            timestamp = row[3]
            code = row[1]
            value = row[2]
            
            if timestamp not in data_dict:
                data_dict[timestamp] = {
                    "endTimestampUTC": timestamp
                }
            
            if value is not None:
                data_dict[timestamp][code] = float(value)
        
        # Sort by timestamp
        result = sorted(data_dict.values(), key=lambda x: x['endTimestampUTC'])
        print(f"Telemetry results: {len(result)} records returned")
        return result
        
    except Exception as e:
        print(f"Telemetry error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/events/range/{entity_id}")
async def get_events_range(entity_id: str, startDate: str, endDate: str):
    """Get events for an entity within a date range, ordered by risk and date"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Parse datetime strings from frontend
        # Frontend now sends UTC ISO format strings (e.g., "2026-02-15T12:48:00.000Z")
        # Just use them directly for database query
        print(f"Events query range - Start (UTC): {startDate}, End (UTC): {endDate}")
        
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
        WHERE el.entityId = ?
          AND el.triggeredAt >= CONVERT(DATETIME, ?)
          AND el.triggeredAt <= CONVERT(DATETIME, ?)
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
        
        cur.execute(query, (entity_id, startDate, endDate))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
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
            eld.entityTelemetryId
        FROM dbo.EventLogDetails eld
        LEFT JOIN dbo.EntityTypeAttribute eta ON eld.entityTypeAttributeId = eta.entityTypeAttributeId
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
                "numericValue": numeric_value
            })
        
        print(f"EventLog {eventlog_id} details retrieved: {len(details_list)} rows")
        for detail in details_list:
            print(f"  {detail['attributeName']}: withinRange={detail['withinRange']}, value={detail['numericValue']}")
        
        lookup_cur.close()
        cur.close()
        conn.close()
        
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
            conn.close()
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
        conn.close()
        
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
        conn.close()
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
        conn.close()
        
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
def get_customer_subscriptions():
    """Get all customer subscriptions with customer, entity, and event details"""
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
                e.eventCode,
                cs.subscriptionStartDate,
                cs.subscriptionEndDate,
                cs.active
            FROM CustomerSubscriptions cs
            JOIN Customers c ON cs.customerId = c.customerId
            LEFT JOIN Event e ON cs.eventId = e.eventId
            WHERE cs.active = 'Y'
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
        conn.close()
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
                e.eventCode,
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
        conn.close()
        
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
        cur.execute("""
            INSERT INTO CustomerSubscriptions (customerId, entityId, eventId, subscriptionStartDate, subscriptionEndDate, active)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            data.get("customerId"),
            data.get("entityId"),
            data.get("eventId"),
            data.get("subscriptionStartDate"),
            data.get("subscriptionEndDate"),
            data.get("active", "Y")
        ))
        conn.commit()
        cur.close()
        conn.close()
        return {"message": "Subscription created successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/customersubscriptions/{id}")
def update_customer_subscription(id: int, data: dict):
    """Update a customer subscription"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE CustomerSubscriptions
            SET customerId = ?, entityId = ?, eventId = ?, subscriptionStartDate = ?, subscriptionEndDate = ?, active = ?
            WHERE customerSubscriptionId = ?
        """, (
            data.get("customerId"),
            data.get("entityId"),
            data.get("eventId"),
            data.get("subscriptionStartDate"),
            data.get("subscriptionEndDate"),
            data.get("active", "Y"),
            id
        ))
        conn.commit()
        cur.close()
        conn.close()
        return {"message": "Subscription updated successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/customersubscriptions/{id}")
def delete_customer_subscription(id: int):
    """Soft delete a customer subscription"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE CustomerSubscriptions
            SET active = 'N'
            WHERE customerSubscriptionId = ?
        """, (id,))
        conn.commit()
        cur.close()
        conn.close()
        return {"message": "Subscription deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
