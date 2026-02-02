import json
import pyodbc
from confluent_kafka import Consumer

# Database Connection
CONN_STR = (
    # Fallback to the older 'SQL Server' driver available on this machine
    'DRIVER={SQL Server};'
    'SERVER=localhost;'
    'DATABASE=BoatTelemetryDB;'
    'UID=sa;'
    'PWD=YourStrongPassword123!'
)

def save_to_mssql(json_payload):
    try:
        with pyodbc.connect(CONN_STR) as conn:
            with conn.cursor() as cursor:
                # We only need to insert into 'RawJson'
                # The 'HealthVitals' table computed columns handle the rest automatically
                cursor.execute("INSERT INTO HealthVitals (RawJson) VALUES (?)", (json_payload,))
                conn.commit()
    except Exception as e:
        print(f"Database Error: {e}")
        # include truncated payload to help debugging (avoid logging huge messages)
        try:
            print('Payload (truncated):', (json_payload[:1000] + '...') if len(json_payload) > 1000 else json_payload)
        except Exception:
            pass


def run_consumer():
    c = Consumer({
        'bootstrap.servers': '127.0.0.1:9092',
        'group.id': 'health-vitals-loader',
        'auto.offset.reset': 'earliest'
    })
    c.subscribe(['terra_health_vitals'])

    print("🚀 Listener Active: Streaming Health Data to MSSQL [HealthVitals]...")
    try:
        while True:
            msg = c.poll(1.0)
            if msg is None: continue
            try:
                val = msg.value().decode('utf-8')
            except Exception as e:
                print('Failed to decode message:', e)
                continue
            print('Received message:', (msg.key(), val[:200]))
            save_to_mssql(val)
    finally:
        c.close()

if __name__ == "__main__":
    run_consumer()