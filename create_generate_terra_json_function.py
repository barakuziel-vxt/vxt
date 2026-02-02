import json
import time
import random
from datetime import datetime
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

def send_to_kafka(user_id, data):
    payload = json.dumps(data)
    if producer:
        try:
            # key should be a string/bytes
            # Send to the canonical topic name 'terra_health_vitals' (underscores)
            producer.produce('terra_health_vitals', key=str(user_id), value=payload, on_delivery=_delivery)
            # flush small amount by polling (non-blocking) to serve delivery callbacks
            producer.poll(0)
        except BufferError:
            # local queue full - drop or log
            print('Kafka buffer full, dropping message for', user_id)
        except Exception as e:
            print('Kafka produce error:', e)
    else:
        # Fallback: print to stdout so you can see the simulator activity even without Kafka
        print('SIM-KAFKA:', user_id, payload[:200])

def generate_terra_json(user_id, hr, sbp, dbp, temp, hrv, classification="sinus_rhythm", oxygen=None, glucose=None, breaths=None, device_name=None, reference=None, afib_result=0):
    # Use a single UTC ISO timestamp with trailing Z for all timestamps to avoid ambiguity
    now_dt = datetime.utcnow()
    now = now_dt.isoformat() + "Z"
    # sensible defaults when not provided
    if oxygen is None:
        oxygen = round(random.uniform(95, 100), 1)
    if glucose is None:
        glucose = round(random.uniform(80, 110), 1)
    if breaths is None:
        breaths = round(random.uniform(12, 18), 1)
    if device_name is None:
        device_name = "SimDevice"
    if reference is None:
        reference = f"ref-{random.randint(1000,9999)}"
    end_dt = now_dt
    # end time a few seconds after start (realistic small recording window)
    end = end_dt.isoformat() + "Z"

    return {
        "status": "success",
        "type": "vitals",
        "user_id": user_id,
        "reference": reference,
        "timestamp": now,
        "start_timestamp": now,
        "metadata": {"start_timestamp": now, "end_timestamp": end},
        "data": [{
            "heart_rate_data": {
                "summary": {
                    "avg_hr_bpm": hr,
                    "hr_variability_rmssd": hrv,
                    "max_hr_bpm": round(max(hr, hr + random.uniform(0,5)), 1),
                    "min_hr_bpm": round(min(hr, hr - random.uniform(0,5)), 1),
                    "resting_hr_bpm": round(hr - random.uniform(0,5), 1)
                },
                "detailed": {"hr_samples": [{"timestamp": now, "bpm": round(hr,1)}]}
            },
            "ecg_data": [{"classification": classification, "heart_rate_bpm": round(hr,1), "afib_result": afib_result}],
            "blood_pressure_data": {"blood_pressure_samples": [{"systolic_bp_mmHg": round(sbp,1), "diastolic_bp_mmHg": round(dbp,1)}]},
            "temperature_data": {"body_temperature_celsius": round(temp,2)},
            "oxygen_data": {"avg_saturation_percentage": oxygen},
            "glucose_data": {"day_avg_glucose_mg_per_dL": glucose},
            "respiration_data": {"avg_breaths_per_min": breaths},
            "device_data": {"name": device_name}
        }]
    }
