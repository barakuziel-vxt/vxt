import json
import time
import random
from datetime import datetime

from create_generate_terra_json_function import generate_terra_json, send_to_kafka
# Kafka client (optional)
try:
    from confluent_kafka import Producer, KafkaError
    KAFKA_AVAILABLE = True
except Exception:
    Producer = None
    KafkaError = Exception
    KAFKA_AVAILABLE = False
    print('Warning: confluent_kafka not available - simulator will print messages instead of sending to Kafka')

# Configuration
KAFKA_CONF = {
    'bootstrap.servers': '127.0.0.1:9092',  # Redpanda address in Docker
    'client.id': 'yacht-sensor-simulator'
}

producer = None
if KAFKA_AVAILABLE:
    try:
        producer = Producer(KAFKA_CONF)
    except Exception as e:
        print('Warning: failed to create Kafka producer:', e)
        producer = None

# Delivery callback
def _delivery(err, msg):
    if err is not None:
        print('Delivery failed:', err)

def simulate_healthy_person(user_id):
    print(f"Starting simulation for Healthy User: {user_id}")
    while True:
        # ערכים תקינים עם סטייה קלה
        hr = random.uniform(60, 75)
        sbp = random.uniform(115, 125)
        dbp = random.uniform(75, 85)
        temp = random.uniform(36.4, 36.8)
        hrv = random.uniform(40, 60)
        oxygen = round(random.uniform(95, 100), 1)
        glucose = round(random.uniform(85, 105), 1)
        breaths = round(random.uniform(12, 18), 1)
        device_name = "Garmin Venue 2 pro"
        reference = f"sim-{int(time.time())}-{random.randint(100,999)}"

        data = generate_terra_json(user_id, hr, sbp, dbp, temp, hrv, classification="sinus_rhythm", oxygen=oxygen, glucose=glucose, breaths=breaths, device_name=device_name, reference=reference)
        send_to_kafka(user_id, data)
        print(f"Sent Healthy Data: HR={hr:.1f}, BP={sbp:.0f}/{dbp:.0f}, SpO2={oxygen}%, Glu={glucose} mg/dL")
        time.sleep(2) # שליחה כל 5 שניות


 

if __name__ == "__main__":
    simulate_healthy_person("033114869")