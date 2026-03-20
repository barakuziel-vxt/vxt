import subprocess
import json
import time
import pyodbc

# Send test messages
device_id = "TestDevice"
iot_hub = "vxt-iot-hub"

print("=" * 60)
print("SENDING TEST MESSAGES TO IOT HUB")
print("=" * 60)

for i in range(1, 3):
    msg = {
        "context": "vessels.urn:mrn:imo:imo-number:1234567",
        "updates": [
            {
                "source": {"src": "N2KToSignalK"},
                "timestamp": "2026-03-21T12:00:00Z",
                "values": [
                    {
                        "path": "navigation.position",
                        "value": {
                            "latitude": 51.5074 + i * 0.01,
                            "longitude": -0.1278 + i * 0.01
                        }
                    }
                ]
            }
        ]
    }
    
    cmd = [
        "az", "iot", "hub", "device-identity",
        "send-d2c-message",
        "--hub-name", iot_hub,
        "--device-id", device_id,
        "--data", json.dumps(msg)
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(f"Message {i}: Exit code {result.returncode}")
    if result.stderr and "error" in result.stderr.lower():
        print(f"  Error: {result.stderr[:100]}")
    time.sleep(2)

print("\nWaiting 5 seconds for processing...")
time.sleep(5)

print("\n" + "=" * 60)
print("CHECKING DATABASE FOR RECEIVED DATA")
print("=" * 60)

conn_str = (
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=tcp:vxtdb.database.windows.net,1433;'
    'DATABASE=free-sql-db-5949639;'
    'UID=vxt;'
    'PWD=Barak1976!;'
    'Encrypt=yes;'
    'TrustServerCertificate=no;'
    'Connection Timeout=30'
)

try:
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM EntityTelemetry WHERE InsertedAt > DATEADD(minute, -5, GETUTCDATE())")
    count = cursor.fetchone()[0]
    print(f"\nRecords in EntityTelemetry (last 5 minutes): {count}")
    
    if count > 0:
        print("\nLatest records:")
        cursor.execute("SELECT TOP 5 InsertedAt, EntityId FROM EntityTelemetry ORDER BY InsertedAt DESC")
        for row in cursor.fetchall():
            print(f"  {row[0]} | {row[1]}")
        print("\n✅ SUCCESS: Data pipeline is working!")
    else:
        print("\n⚠️  No data received yet - checking total records...")
        cursor.execute("SELECT COUNT(*) FROM EntityTelemetry")
        total = cursor.fetchone()[0]
        print(f"Total records in table: {total}")
    
    conn.close()
except Exception as e:
    print(f"\n❌ Database Error: {e}")
