# Yacht Telemetry API (main.py)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import pyodbc
import json
import traceback

app = FastAPI(title="VXT API")

# Enable CORS for React frontend (typically runs on port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://192.168.1.32:3000",
        "http://192.168.1.32:5173"
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
            JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
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


@app.get("/health/{ID}")
def get_health_vitals(ID: str, limit: int = 50):
    """Retrieve latest health vitals for a specific patient"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT
                c.customerName AS CustomerName,
                et.entityTypeName AS Gender,
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
              JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
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
                "id": row.ID or "",
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
            SELECT e.entityName as customerPropertyName, 
            e.entityId as mmsi, 
            e.entityTypeId as propertyTypeId, 
            e.year as year
            FROM CustomerSubscriptions cs
            JOIN Customers c ON cs.customerId = c.customerId
            JOIN dbo.Entity e ON cs.entityId = e.entityId
            WHERE c.customerName = ? 
            AND c.active = 'Y' 
            AND cs.active = 'Y'
            and cs.subscriptionStartDate <= GETDATE()
            and (cs.subscriptionEndDate IS NULL OR cs.subscriptionEndDate > GETDATE())
            ORDER BY e.entityName;
        """
        cur.execute(sql, customerName)
        rows = []
        for r in cur.fetchall():
            rows.append({
                "customerPropertyName": r[0],
                "mmsi": r[1],
                "propertyTypeId": r[2],
                "year": r[3]
            })
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
