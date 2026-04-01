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
    
    return {
        "user": {"user_id": f"user_{user_id}"},
        "data": {
            "body_weight_data": {
                "summary": {"weight_kg": round(avg_weight_kg, 2)},
                "detailed": {
                    "weight_samples": [
                        {
                            "timestamp": base_time.isoformat(),
                            "weight_kg": round(avg_weight_kg + random.uniform(-0.5, 0.5), 2)
                        }
                    ]
                }
            }
        },
        "type": "vitals",
        "event_type": "29463-7",
        "loinc_code": "29463-7",
        "timestamp": base_time.isoformat()
    }


async def send_junction_event(client, event_num: int, event_type: str, user_id: str = '033114869') -> bool:
    """Send a single Junction health event through IoT Hub"""
    
    # Generate the appropriate event
    event_map = {
        'heart_rate': generate_heart_rate_event,
        'blood_pressure': generate_blood_pressure_event,
        'body_weight': generate_body_weight_event,
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
        
        event_types = ['heart_rate', 'blood_pressure', 'body_weight']
        total_events = 0
        results = []
        
        for user in users:
            logger.info(f'--- Simulating events for user {user["name"]} ({user["user_id"]}) ---')
            for event_type in event_types:
                success = await send_junction_event(client, 1, event_type, user['user_id'])
                results.append(success)
                total_events += 1
                if event_type != event_types[-1]:
                    logger.info('Waiting 2 seconds before next event...')
                    await asyncio.sleep(2)
        
        logger.info('-' * 70)
        
        # Summary
        successful = sum(results)
        logger.info(f'Results: {successful}/{total_events} events sent successfully')
        
        if successful == total_events:
            logger.info('✅ All Junction telemetry events sent')
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
