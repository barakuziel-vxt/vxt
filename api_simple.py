# Minimal FastAPI for debugging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pyodbc

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health():
    return {"status": "ok"}

@app.get("/telemetry/{boat_id}")
def get_telemetry(boat_id: str, limit: int = 50):
    try:
        # Test database connection
        conn_str = (
            'DRIVER={SQL Server};'
            'SERVER=localhost;'
            'DATABASE=BoatTelemetryDB;'
            'UID=sa;'
            'PWD=YourStrongPassword123!'
        )
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        # Handle boat_id format
        if not boat_id.startswith("vessels."):
            boat_id = f"vessels.urn:mrn:imo:mmsi:{boat_id}"
        
        query = """
            SELECT TOP (?)
                Timestamp,
                JSON_VALUE(RawJson, '$.engine.rpm') AS rpm_value,
                JSON_VALUE(RawJson, '$.engine.coolantTemp') AS temp_value_kelvin
            FROM BoatTelemetry
            WHERE BoatId = ?
            ORDER BY Timestamp DESC
        """
        
        cursor.execute(query, limit, boat_id)
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            timestamp = row.Timestamp
            if hasattr(timestamp, 'isoformat'):
                timestamp_str = timestamp.isoformat()
            else:
                timestamp_str = str(timestamp)
            
            rpm = float(row.rpm_value) if row.rpm_value else 0
            temp_k = float(row.temp_value_kelvin) if row.temp_value_kelvin else 0
            temp_c = temp_k - 273.15
                
            result.append({
                "timestamp": timestamp_str,
                "rpm": rpm,
                "temp": temp_c
            })
        
        cursor.close()
        conn.close()
        
        return result[::-1]  # reverse to chronological order
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}


@app.get("/health/{patient_id}")
def get_health(patient_id: str, limit: int = 50):
    try:
        conn_str = (
            'DRIVER={SQL Server};'
            'SERVER=localhost;'
            'DATABASE=BoatTelemetryDB;'
            'UID=sa;'
            'PWD=YourStrongPassword123!'
        )
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        query = """
            SELECT TOP (?)
                c.customerName AS CustomerName,
                et.entityTypeName AS Gender,
                e.entityName AS PatientName,
                e.entityId AS ID,
                hv.Timestamp AS Timestamp,
                hv.AvgHR AS AvgHR,
                hv.MaxHR AS MaxHR,
                hv.MinHR AS MinHR,
                hv.Systolic AS Systolic,
                hv.Diastolic AS Diastolic,
                hv.DeviceName AS DeviceName,
                hv.LoadedAt AS LoadedAt
              FROM dbo.HealthVitals hv
              JOIN dbo.CustomerSubscriptions cs ON hv.userId = cs.entityId
              JOIN dbo.Entity e ON cs.entityId = e.entityId
              JOIN dbo.Customers c ON c.customerId = cs.customerId
              JOIN dbo.EntityType et ON e.entityTypeId = et.entityTypeId
            WHERE e.entityId = ?
            ORDER BY hv.Timestamp DESC
        """

        cursor.execute(query, limit, patient_id)
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
                "avgHR": _safe_num(row.AvgHR),
                "maxHR": _safe_num(row.MaxHR),
                "minHR": _safe_num(row.MinHR),
                "systolic": _safe_num(row.Systolic),
                "diastolic": _safe_num(row.Diastolic),
                "deviceName": row.DeviceName or "",
                "loadedAt": (row.LoadedAt.isoformat() if hasattr(row.LoadedAt, 'isoformat') else str(row.LoadedAt)) if row.LoadedAt else None,
            })

        cursor.close()
        conn.close()

        return result[::-1]

    except Exception as e:
        print(f"ERROR in get_health: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "status": 500}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 
