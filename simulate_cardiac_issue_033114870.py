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

def simulate_cardiac_issue(user_id):
    print(f"Starting simulation for Cardiac Issue User: {user_id}")
    base_hr = 80
    base_sbp = 135
    base_hrv = 30
    
    for i in range(20): # נדמה התדרדרות לאורך 20 הודעות
        hr = base_hr + (i * 2) + random.uniform(-2, 2)  # דופק עולה
        sbp = base_sbp + (i * 1.5)                      # לחץ דם עולה
        dbp = max(60, sbp * 0.6 + random.uniform(-2, 2))
        hrv = max(5, base_hrv - (i * 1.2))              # HRV צונח (סימן רע מאוד)
        temp = 37.2 + (i * 0.05)                        # עליית חום קלה
        oxygen = round(max(85, 96 - i * 0.2 + random.uniform(-0.5, 0.5)), 1)
        glucose = round(90 + random.uniform(-10, 10), 1)
        breaths = round(max(8, 16 - i * 0.2 + random.uniform(-0.5,0.5)), 1)
        device_name = "Samsung Galaxy Watch 4"
        reference = f"cardiac-{int(time.time())}-{i}"
        # בהודעות האחרונות נדמה זיהוי הפרעת קצב בשעון
        status = "atrial_fibrillation" if i > 15 else "sinus_rhythm"
        afib_result = 1 if status == "atrial_fibrillation" else 0

        data = generate_terra_json(user_id, hr, sbp, dbp, temp, hrv, status, oxygen=oxygen, glucose=glucose, breaths=breaths, device_name=device_name, reference=reference, afib_result=afib_result)
        send_to_kafka(user_id, data)
        print(f"⚠️ Sent Cardiac Issue Data: HR={hr:.1f}, HRV={hrv:.1f}, Status={status}, SpO2={oxygen}%, DBP={dbp:.0f}")
        time.sleep(2)

 

if __name__ == "__main__":
    simulate_cardiac_issue("033114870")