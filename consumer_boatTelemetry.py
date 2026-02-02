# boat_consumer.py
import json
import pyodbc
from confluent_kafka import Consumer, KafkaError

# Configuration for Kafka and SQL Server
KAFKA_CONFIG = {
    'bootstrap.servers': '127.0.0.1:9092',
    'group.id': 'boat-processor-group',
    'auto.offset.reset': 'earliest'
}

SQL_CONN_STR = (
    # Fallback to the older 'SQL Server' driver available on this machine
    'DRIVER={SQL Server};'
    'SERVER=localhost;'
    'DATABASE=BoatTelemetryDB;'
    'UID=sa;'
    'PWD=YourStrongPassword123!'
)


def process_message(msg_value, cursor, conn):
    """Parse Signal K message and save to SQL"""
    try:
        data = json.loads(msg_value.decode('utf-8'))
        
        # Extract boat ID and timestamp
        MMSI = data.get("context", "unknown-vessel")
        timestamp = data["updates"][0]["timestamp"]
        
        # Transform Signal K format to match database computed columns paths
        # Extract values from Signal K format
        raw_json = {
            "engine": {},
            "electrical": {},
            "navigation": {}
        }
        
        for value_obj in data["updates"][0].get("values", []):
            path = value_obj.get("path", "")
            value = value_obj.get("value", 0)
            
            # Map Signal K paths to database computed columns paths
            if "rpm" in path:
                raw_json["engine"]["rpm"] = value
            elif "coolantTemperature" in path:
                raw_json["engine"]["coolantTemp"] = value
            elif "oilPressure" in path:
                raw_json["engine"]["oilPressure"] = value
            elif "voltage" in path:
                raw_json["electrical"]["batteryVoltage"] = value
            elif "depth" in path:
                raw_json["navigation"]["depth"] = value
            elif "sog" in path:
                raw_json["navigation"]["sog"] = value
            elif "latitude" in path:
                raw_json["navigation"]["latitude"] = value
            elif "longitude" in path:
                raw_json["navigation"]["longitude"] = value
                
        
        # Save transformed JSON (SQL Edge computed columns will parse automatically)
        query = "INSERT INTO BoatTelemetry (MMSI, Timestamp, RawJson) VALUES (?, ?, ?)"
        cursor.execute(query, MMSI, timestamp, json.dumps(raw_json))
        conn.commit()
        
        print(f"[✓] Saved data for boat: {MMSI} at {timestamp}")
        
    except Exception as e:
        print(f"[!] Error parsing/saving message: {e}")


def run_consumer():
    """Main consumer loop"""
    # Connect to SQL Server
    try:
        conn = pyodbc.connect(SQL_CONN_STR)
        cursor = conn.cursor()
        print("✓ Connected to SQL Edge successfully.")
    except Exception as e:
        print(f"✗ Could not connect to SQL: {e}")
        return
    
    # Connect to Redpanda (Kafka)
    consumer = Consumer(KAFKA_CONFIG)
    consumer.subscribe(['boat-telemetry'])
    print("✓ Consumer listening on topic 'boat-telemetry'...")
    
    try:
        while True:
            msg = consumer.poll(1.0)  # Wait 1 second for new messages
            
            if msg is None:
                continue
            
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    print(f"✗ Kafka Error: {msg.error()}")
                    break
            
            # Process the message
            process_message(msg.value(), cursor, conn)
            
    except KeyboardInterrupt:
        print("\n✓ Stopping consumer...")
    finally:
        # Close connections gracefully
        consumer.close()
        conn.close()


if __name__ == "__main__":
    run_consumer()