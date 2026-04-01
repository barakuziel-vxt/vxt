#!/usr/bin/env python3
"""
Test Azure Function App Trigger - Junction Events
Sends Junction health provider events to IoT Hub and monitors function execution

Usage:
    python test_junction_trigger.py

Prerequisites:
    - pip install azure-iot-device
    - IoT device registered in IoT Hub (vxt-iot-hub)
    - Device connection string available
"""

import asyncio
import json
import time
import logging
import random
from datetime import datetime, timedelta, timezone
from azure.iot.device.aio import IoTHubDeviceClient
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(name)s] %(message)s'
)
logger = logging.getLogger('JunctionSimulator')

# IoT Hub Device Configuration
DEVICE_CONNECTION_STRING = os.environ.get(
    'IOT_DEVICE_CONNECTION_STRING',
    ''  # User must set this
)


def validate_config():
    """Verify required configuration is set"""
    if not DEVICE_CONNECTION_STRING:
        logger.error('ERROR: IOT_DEVICE_CONNECTION_STRING environment variable not set')
        return False
    
    logger.info(f'Device Connection String: {DEVICE_CONNECTION_STRING[:50]}...')
    return True


def generate_heart_rate_event(user_id: str = '033114869') -> dict:
    """Generate a heart rate Junction health event - LOINC 8867-4"""
    base_time = datetime.now(timezone.utc)
    avg_hr = random.randint(60, 100)
    
    # Generate 12 samples over 1 hour (5-minute intervals)
    hr_samples = []
    for i in range(12):
        sample_time = base_time - timedelta(minutes=(12-i)*5)
        variation = random.randint(-5, 5)
        hr_samples.append({
            "timestamp": sample_time.isoformat(),
            "bpm": avg_hr + variation
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "heart_rate_data": {
                "summary": {"avg_hr_bpm": avg_hr},
                "detailed": {"hr_samples": hr_samples}
            }
        },
        "type": "vitals",
        "event_type": "8867-4",
        "loinc_code": "8867-4",
        "timestamp": base_time.isoformat()
    }


def generate_blood_pressure_event(user_id: str = '033114869') -> dict:
    """Generate a blood pressure Junction health event - LOINC 8480-6"""
    base_time = datetime.now(timezone.utc)
    avg_systolic = random.randint(110, 140)
    avg_diastolic = random.randint(70, 90)
    
    # Generate 6 samples over 1 day (4-hour intervals)
    bp_samples = []
    for i in range(6):
        sample_time = base_time - timedelta(hours=(6-i)*4)
        systolic_var = random.randint(-5, 5)
        diastolic_var = random.randint(-3, 3)
        bp_samples.append({
            "timestamp": sample_time.isoformat(),
            "systolic_mmhg": avg_systolic + systolic_var,
            "diastolic_mmhg": avg_diastolic + diastolic_var
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "blood_pressure_data": {
                "summary": {
                    "avg_systolic_mmhg": avg_systolic,
                    "avg_diastolic_mmhg": avg_diastolic
                },
                "detailed": {"bp_samples": bp_samples}
            }
        },
        "type": "vitals",
        "event_type": "8480-6",
        "loinc_code": "8480-6",
        "timestamp": base_time.isoformat()
    }


def generate_body_weight_event(user_id: str = '033114869') -> dict:
    """Generate a body weight Junction health event - LOINC 29463-7"""
    base_time = datetime.now(timezone.utc)
    avg_weight_kg = random.uniform(60, 100)
    
    # Generate 6 samples over 1 week (daily intervals)
    weight_samples = []
    for i in range(6):
        sample_time = base_time - timedelta(days=(6-i))
        weight_kg = round(avg_weight_kg + random.uniform(-1.0, 1.0), 2)
        weight_samples.append({
            "timestamp": sample_time.isoformat(),
            "weight_kg": weight_kg
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "body_weight_data": {
                "summary": {"weight_kg": round(avg_weight_kg, 2)},
                "detailed": {
                    "weight_samples": weight_samples
                }
            }
        },
        "type": "vitals",
        "event_type": "29463-7",
        "loinc_code": "29463-7",
        "timestamp": base_time.isoformat()
    }


def generate_oxygen_saturation_event(user_id: str = '033114869') -> dict:
    """Generate oxygen saturation Junction health event - LOINC 59408-5"""
    base_time = datetime.now(timezone.utc)
    avg_spo2 = random.randint(95, 100)
    
    # Generate 6 samples (every 30 minutes)
    spo2_samples = []
    for i in range(6):
        sample_time = base_time - timedelta(minutes=(6-i)*30)
        variation = random.randint(-2, 2)
        spo2_samples.append({
            "timestamp": sample_time.isoformat(),
            "percentage": avg_spo2 + variation
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "oxygen_data": {
                "summary": {"avg_saturation_percentage": avg_spo2},
                "detailed": {
                    "saturation_samples": spo2_samples
                }
            }
        },
        "type": "vitals",
        "event_type": "59408-5",
        "loinc_code": "59408-5",
        "timestamp": base_time.isoformat()
    }


def generate_respiration_rate_event(user_id: str = '033114869') -> dict:
    """Generate respiration rate Junction health event - LOINC 9279-1"""
    base_time = datetime.now(timezone.utc)
    avg_respiration = random.randint(12, 20)
    
    # Generate 8 samples (every 15 minutes)
    resp_samples = []
    for i in range(8):
        sample_time = base_time - timedelta(minutes=(8-i)*15)
        variation = random.randint(-2, 2)
        resp_samples.append({
            "timestamp": sample_time.isoformat(),
            "breaths_per_min": avg_respiration + variation
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "respiration_data": {
                "summary": {"avg_breaths_per_min": avg_respiration},
                "detailed": {
                    "breaths_samples": resp_samples
                }
            }
        },
        "type": "vitals",
        "event_type": "9279-1",
        "loinc_code": "9279-1",
        "timestamp": base_time.isoformat()
    }


def generate_body_temperature_event(user_id: str = '033114869') -> dict:
    """Generate body temperature Junction health event - LOINC 8310-5"""
    base_time = datetime.now(timezone.utc)
    avg_temp = round(random.uniform(36.5, 37.5), 1)
    
    # Generate 4 samples (every 6 hours)
    temp_samples = []
    for i in range(4):
        sample_time = base_time - timedelta(hours=(4-i)*6)
        variation = round(random.uniform(-0.3, 0.3), 1)
        temp_samples.append({
            "timestamp": sample_time.isoformat(),
            "celsius": round(avg_temp + variation, 1)
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "temperature_data": {
                "summary": {"avg_celsius": avg_temp},
                "detailed": {
                    "temperature_samples": temp_samples
                }
            }
        },
        "type": "vitals",
        "event_type": "8310-5",
        "loinc_code": "8310-5",
        "timestamp": base_time.isoformat()
    }


def generate_glucose_event(user_id: str = '033114869') -> dict:
    """Generate glucose Junction health event - LOINC 2339-0"""
    base_time = datetime.now(timezone.utc)
    avg_glucose = random.randint(70, 180)
    
    # Generate 5 samples (fasting, before/after meals pattern)
    glucose_samples = []
    meal_phases = ['fasting', 'before_breakfast', 'after_breakfast', 'before_lunch', 'after_lunch']
    
    for i, phase in enumerate(meal_phases):
        sample_time = base_time - timedelta(hours=(5-i)*3)
        variation = random.randint(-15, 15)
        glucose_value = min(300, max(70, avg_glucose + variation))
        glucose_samples.append({
            "timestamp": sample_time.isoformat(),
            "glucose_mg_dl": glucose_value,
            "phase": phase
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "glucose_data": {
                "summary": {"avg_glucose_mg_dl": avg_glucose},
                "detailed": {
                    "glucose_samples": glucose_samples
                }
            }
        },
        "type": "vitals",
        "event_type": "2339-0",
        "loinc_code": "2339-0",
        "timestamp": base_time.isoformat()
    }


def generate_heart_rate_variability_event(user_id: str = '033114869') -> dict:
    """Generate heart rate variability Junction health event - LOINC 80404-7"""
    base_time = datetime.now(timezone.utc)
    avg_hrv = random.randint(20, 100)
    
    # Generate 10 samples (every 10 minutes)
    hrv_samples = []
    for i in range(10):
        sample_time = base_time - timedelta(minutes=(10-i)*10)
        variation = random.randint(-10, 10)
        hrv_samples.append({
            "timestamp": sample_time.isoformat(),
            "rmssd_ms": max(0, avg_hrv + variation)
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "hrv_data": {
                "summary": {"avg_rmssd_ms": avg_hrv},
                "detailed": {
                    "hrv_samples": hrv_samples
                }
            }
        },
        "type": "vitals",
        "event_type": "80404-7",
        "loinc_code": "80404-7",
        "timestamp": base_time.isoformat()
    }


def generate_diastolic_blood_pressure_event(user_id: str = '033114869') -> dict:
    """Generate diastolic blood pressure Junction health event - LOINC 8462-4"""
    base_time = datetime.now(timezone.utc)
    avg_diastolic = random.randint(70, 90)
    
    # Generate 6 samples (4-hour intervals)
    diasystolic_samples = []
    for i in range(6):
        sample_time = base_time - timedelta(hours=(6-i)*4)
        variation = random.randint(-3, 3)
        diasystolic_samples.append({
            "timestamp": sample_time.isoformat(),
            "diastolic_mmhg": avg_diastolic + variation
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "diastolic_bp_data": {
                "summary": {"avg_diastolic_mmhg": avg_diastolic},
                "detailed": {
                    "diastolic_samples": diasystolic_samples
                }
            }
        },
        "type": "vitals",
        "event_type": "8462-4",
        "loinc_code": "8462-4",
        "timestamp": base_time.isoformat()
    }


def generate_resting_heart_rate_event(user_id: str = '033114869') -> dict:
    """Generate resting heart rate Junction health event - LOINC 8418-4"""
    base_time = datetime.now(timezone.utc)
    
    # Generate 7 daily samples (morning readings)
    rhr_samples = []
    baseline_rhr = random.randint(60, 65)
    
    # Days 7-2: Baseline period
    for i in range(6):
        sample_time = base_time - timedelta(days=(7-i))
        variation = random.randint(-2, 2)
        rhr_samples.append({
            "timestamp": sample_time.isoformat(),
            "bpm": baseline_rhr + variation
        })
    
    # Day 1: Most recent
    elevated_rhr = random.randint(85, 95)
    rhr_samples.append({
        "timestamp": base_time.isoformat(),
        "bpm": elevated_rhr
    })
    
    avg_rhr = sum(s['bpm'] for s in rhr_samples) / len(rhr_samples)
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "resting_hr_data": {
                "summary": {"avg_resting_hr_bpm": int(avg_rhr)},
                "detailed": {
                    "resting_hr_samples": rhr_samples
                }
            }
        },
        "type": "vitals",
        "event_type": "8418-4",
        "loinc_code": "8418-4",
        "timestamp": base_time.isoformat()
    }


def generate_min_heart_rate_event(user_id: str = '033114869') -> dict:
    """Generate minimum heart rate Junction health event - LOINC 8638-5"""
    base_time = datetime.now(timezone.utc)
    avg_min_hr = random.randint(45, 60)
    
    # Generate 7 daily samples
    min_hr_samples = []
    for i in range(7):
        sample_time = base_time - timedelta(days=(7-i))
        variation = random.randint(-3, 3)
        min_hr_samples.append({
            "timestamp": sample_time.isoformat(),
            "bpm": avg_min_hr + variation
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "min_hr_data": {
                "summary": {"avg_min_hr_bpm": avg_min_hr},
                "detailed": {
                    "min_hr_samples": min_hr_samples
                }
            }
        },
        "type": "vitals",
        "event_type": "8638-5",
        "loinc_code": "8638-5",
        "timestamp": base_time.isoformat()
    }


def generate_max_heart_rate_event(user_id: str = '033114869') -> dict:
    """Generate maximum heart rate Junction health event - LOINC 8639-3"""
    base_time = datetime.now(timezone.utc)
    avg_max_hr = random.randint(120, 160)
    
    # Generate 7 daily samples
    max_hr_samples = []
    for i in range(7):
        sample_time = base_time - timedelta(days=(7-i))
        variation = random.randint(-5, 5)
        max_hr_samples.append({
            "timestamp": sample_time.isoformat(),
            "bpm": avg_max_hr + variation
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "max_hr_data": {
                "summary": {"avg_max_hr_bpm": avg_max_hr},
                "detailed": {
                    "max_hr_samples": max_hr_samples
                }
            }
        },
        "type": "vitals",
        "event_type": "8639-3",
        "loinc_code": "8639-3",
        "timestamp": base_time.isoformat()
    }


def generate_afib_detection_event(user_id: str = '033114869') -> dict:
    """Generate atrial fibrillation detection Junction health event - LOINC 80358-0"""
    base_time = datetime.now(timezone.utc)
    
    # Generate 5 samples throughout the day
    afib_samples = []
    for i in range(5):
        sample_time = base_time - timedelta(hours=(5-i)*4)
        afib_samples.append({
            "timestamp": sample_time.isoformat(),
            "detected": random.choice([True, False]),
            "confidence": random.randint(70, 100)
        })
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "afib_data": {
                "summary": {"detection_count": sum(1 for s in afib_samples if s['detected'])},
                "detailed": {
                    "afib_samples": afib_samples
                }
            }
        },
        "type": "vitals",
        "event_type": "80358-0",
        "loinc_code": "80358-0",
        "timestamp": base_time.isoformat()
    }


async def send_junction_event(client, event_num: int, event_type: str, user_id: str = '033114869') -> bool:
    """Send a single Junction health event through IoT Hub"""
    
    # Generate the appropriate event
    event_map = {
        'heart_rate': generate_heart_rate_event,
        'blood_pressure': generate_blood_pressure_event,
        'body_weight': generate_body_weight_event,
        'oxygen_saturation': generate_oxygen_saturation_event,
        'respiration_rate': generate_respiration_rate_event,
        'body_temperature': generate_body_temperature_event,
        'glucose': generate_glucose_event,
        'heart_rate_variability': generate_heart_rate_variability_event,
        'diastolic_blood_pressure': generate_diastolic_blood_pressure_event,
        'resting_heart_rate': generate_resting_heart_rate_event,
        'min_heart_rate': generate_min_heart_rate_event,
        'max_heart_rate': generate_max_heart_rate_event,
        'afib_detection': generate_afib_detection_event,
    }
    
    event_generator = event_map.get(event_type, generate_heart_rate_event)
    event_data = event_generator(user_id)
    
    payload = json.dumps(event_data)
    
    logger.info(f'[USER {user_id} EVENT {event_num} ({event_type})] Sending Junction event...')
    logger.debug(f'  Payload: {payload[:100]}...')
    
    try:
        await client.send_message(payload)
        logger.info(f'[USER {user_id} EVENT {event_num} ({event_type})] ✅ Sent successfully')
        return True
    except Exception as e:
        logger.error(f'[USER {user_id} EVENT {event_num} ({event_type})] ❌ Failed to send: {str(e)[:100]}')
        return False


async def main():
    """Main simulation flow"""
    
    logger.info('=' * 70)
    logger.info('Azure Function App Trigger Test - Junction Events')
    logger.info('=' * 70)
    
    # Validate configuration
    if not validate_config():
        logger.error('Configuration incomplete. Exiting.')
        return False
    
    # Create device client
    logger.info('Connecting to IoT Hub as device...')
    client = IoTHubDeviceClient.create_from_connection_string(DEVICE_CONNECTION_STRING)

    try:
        await client.connect()
        logger.info('✅ Connected to IoT Hub')

        # Simulate events from 2 users (Barak and Shula)
        users = [
            {'user_id': '033114869', 'name': 'Barak'},
            {'user_id': '033114870', 'name': 'Shula'},
        ]
        
        event_types = [
            'heart_rate',               # V1: 8867-4
            'blood_pressure',           # V2: 8480-6
            'body_weight',              # V3: 29463-7
            'oxygen_saturation',        # V4: 59408-5
            'respiration_rate',         # V5: 9279-1
            'body_temperature',         # V6: 8310-5
            'glucose',                  # V7: 2339-0
            'heart_rate_variability',   # V8: 80404-7
            'diastolic_blood_pressure', # V9: 8462-4
            'resting_heart_rate',       # V10: 8418-4
            'min_heart_rate',           # V11: 8638-5
            'max_heart_rate',           # V12: 8639-3
            'afib_detection',           # V13: 80358-0
        ]
        total_events = 0
        results = []
        
        for user in users:
            logger.info(f'--- Simulating events for user {user["name"]} ({user["user_id"]}) ---')
            for event_type in event_types:
                success = await send_junction_event(client, 1, event_type, user['user_id'])
                results.append(success)
                total_events += 1
                if event_type != event_types[-1]:
                    logger.info('Waiting 1 second before next event...')
                    await asyncio.sleep(1)
        
        logger.info('-' * 70)
        
        # Summary: 18 event types × 2 users = 36 events
        successful = sum(results)
        logger.info(f'Results: {successful}/{total_events} events sent successfully')
        
        if successful == total_events:
            logger.info(f'✅ All 13 Junction LOINC Vitals attributes sent')
        else:
            logger.warning(f'⚠️  Only {successful}/{total_events} events sent')
        
        # Wait for function processing
        logger.info('')
        logger.info('Waiting 5 seconds for Azure Function to process events...')
        await asyncio.sleep(5)
        
        logger.info('')
        logger.info('✅ Junction event simulation complete')
        
        await client.disconnect()
        logger.info('')
        logger.info('Disconnected from IoT Hub')
        return successful == total_events

    except Exception as e:
        logger.error(f'❌ Fatal error during simulation: {str(e)}')
        return False


if __name__ == '__main__':
    success = asyncio.run(main())
    exit(0 if success else 1)
