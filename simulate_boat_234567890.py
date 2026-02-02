import json
import time
import random
from datetime import datetime
from confluent_kafka import Producer
lat = 32.8315366
lon = 35.0036234

# Configuration
KAFKA_CONF = {
    'bootstrap.servers': '127.0.0.1:9092',  # Redpanda address in Docker
    'client.id': 'yacht-sensor-simulator'
}

TOPIC = 'boat-telemetry'
BOAT_ID = "234567890"

def get_telemetry():
    global lat, lon
    # Simulate movement
    lat += random.uniform(-0.1115, 0.1115)
    lon += random.uniform(-0.1115, 0.1115)

def delivery_report(err, msg):
    """Callback triggered after message send or failure"""
    if err is not None:
        print(f"[!] Message delivery failed: {err}")
    else:
        print(f"[✓] Sent to {msg.topic()} [partition {msg.partition()}]")


def generate_boat_data():
    """Generate realistic sensor data with slight variations"""
    
    # Basic telemetry data (SI Units as required by Signal K)
    rpm = random.randint(1000, 1400)
    temp_k = 358.15 + random.uniform(-0.5, 1.5)  # ~85°C
    oil_press_pa = 350000 + random.uniform(-5000, 5000)  # ~3.5 bar
    voltage = 13.6 + random.uniform(-0.2, 0.2)
    sog =  random.uniform(5, 10)  # Ensure this isn't hardcoded to 0!
    batteryVoltage = 12.8 + random.uniform(-0.3, 0.3)
    depth = 20 + random.uniform(-2, 2)



    # Build generic Signal K Delta structure
    return {
        "context": f"vessels.urn:mrn:imo:mmsi:{BOAT_ID}",
        "updates": [
            {
                "source": {
                    "label": "engine-gateway",
                    "type": "NMEA2000",
                    "src": "0"
                },
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "values": [
                    {"path": "propulsion.mainEngine.drive.rpm", "value": rpm},
                    {"path": "propulsion.mainEngine.coolantTemperature", "value": temp_k},
                    {"path": "propulsion.mainEngine.oilPressure", "value": oil_press_pa},
                    {"path": "electrical.batteries.1.voltage", "value": voltage},
                    {"path": "electrical.batteryVoltage", "value": batteryVoltage},
                    {"path": "navigation.depth", "value": depth},
                    {"path": "navigation.sog", "value": sog},
                    {"path": "navigation.latitude", "value": lat},
                    {"path": "navigation.longitude", "value": lon}
                ]
            }
        ]
    }


def start_simulation():
    """Start the data simulation"""
    producer = Producer(KAFKA_CONF)
    print(f"✓ Starting simulation for boat {BOAT_ID}. Press Ctrl+C to stop.")
    
    try:
        while True:
            # 1. Generate telemetry data
            telemetry = generate_boat_data()
            
            # 2. Send to Kafka
            producer.produce(
                TOPIC,
                key=BOAT_ID,
                value=json.dumps(telemetry),
                callback=delivery_report
            )
            
            # 3. Flush messages from buffer
            producer.flush()
            
            time.sleep(2)  # Send every 2 seconds
            
    except KeyboardInterrupt:
        print("\n✓ Stopping simulation...")


if __name__ == "__main__":
    start_simulation()
