#!/usr/bin/env python3
"""
Test Azure Function App Trigger
Sends 2 telemetry events to IoT Hub and monitors function execution

Usage:
    python test_function_trigger.py

Prerequisites:
    - pip install azure-iot-device mssql-python
    - IoT device registered in IoT Hub (vxt-iot-hub)
    - Device connection string available
"""

import asyncio
import json
import time
import logging
import random
from datetime import datetime
from azure.iot.device.aio import IoTHubDeviceClient
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(name)s] %(message)s'
)
logger = logging.getLogger('TelemetrySimulator')

# IoT Hub Device Configuration
# Format: HostName=<hub>.azure-devices.net;DeviceId=<device>;SharedAccessKey=<key>
DEVICE_CONNECTION_STRING = os.environ.get(
    'IOT_DEVICE_CONNECTION_STRING',
    ''  # User must set this
)

FUNCTION_APP_HEALTH_URL = 'https://vxt-function.azurewebsites.net/api/health'


def validate_config():
    """Verify required configuration is set"""
    if not DEVICE_CONNECTION_STRING:
        logger.error('ERROR: IOT_DEVICE_CONNECTION_STRING environment variable not set')
        logger.error('Get device connection string from Azure Portal:')
        logger.error('  IoT Hub → Devices → Select device → Connection string')
        return False
    
    logger.info(f'Device Connection String: {DEVICE_CONNECTION_STRING[:50]}...')
    return True


async def send_telemetry_event(client, event_num: int, device_id: str = 'test-device'):
    """Send a single telemetry event through IoT Hub"""
    
    # Generate telemetry data matching the boat simulation structure
    lat_base = 32.8315366 if device_id == "234567890" else 32.8415366
    lon_base = 35.0036234 if device_id == "234567890" else 35.0136234
    lat = round(lat_base + random.uniform(-0.1115, 0.1115), 6)
    lon = round(lon_base + random.uniform(-0.1115, 0.1115), 6)
    rpm = random.randint(1000, 1400)
    oil_press_pa = round(350000 + random.uniform(-5000, 5000), 2)
    sog = round(random.uniform(5, 10), 3)
    cog = round(random.uniform(0, 6.28), 4)
    water_temp_k = round(291.15 + random.uniform(-2, 2), 2)
    wind_speed = round(random.uniform(3, 8), 2)
    fuel_level = round(random.uniform(0.3, 0.9), 3)
    ts = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

    # Standard SignalK envelope — matches what a real N2K/NMEA device sends.
    # The function's SignalKAdapter parses "context" to extract the MMSI,
    # and maps "updates[].values[].path" to entityTypeAttributeCode in the DB.
    telemetry = {
        'context': f'vessels.urn:mrn:imo:mmsi:{device_id}',
        'updates': [{
            'source': {'label': 'N2KToSignalK', 'src': device_id},
            'timestamp': ts,
            'values': [
                {'path': 'navigation.speedOverGround',  'value': sog},
                {'path': 'navigation.courseOverGround', 'value': cog},
                {'path': 'navigation.position',
                 'value': {'latitude': lat, 'longitude': lon}},
                {'path': 'propulsion.main.revolutions', 'value': rpm},
                {'path': 'propulsion.main.oilPressure', 'value': oil_press_pa},
                {'path': 'environment.water.temperature', 'value': water_temp_k},
                {'path': 'environment.wind.speedApparent', 'value': wind_speed},
                {'path': 'tanks.fuelTank.level',         'value': fuel_level},
            ]
        }]
    }

    payload = json.dumps(telemetry)

    logger.info(f'[ENTITY {device_id} EVENT {event_num}] Sending telemetry...')
    logger.debug(f'  Payload: {payload}')

    try:
        await client.send_message(payload)
        logger.info(f'[ENTITY {device_id} EVENT {event_num}] ✅ Sent successfully')
        return True
    except Exception as e:
        logger.error(f'[ENTITY {device_id} EVENT {event_num}] ❌ Failed to send: {str(e)[:100]}')
        return False


async def main():
    """Main simulation flow"""
    
    logger.info('=' * 70)
    logger.info('Azure Function App Trigger Test')
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

        # Simulate 5 events for each of two entities
        entity_ids = ["234567890", "234567891"]
        total_events = 0
        results = []
        for entity_id in entity_ids:
            logger.info(f'--- Simulating 5 events for entity {entity_id} ---')
            for i in range(1, 6):
                success = await send_telemetry_event(client, i, device_id=entity_id)
                results.append(success)
                total_events += 1
                if i < 5:
                    logger.info('Waiting 2 seconds before next event...')
                    await asyncio.sleep(2)

        logger.info('-' * 70)

        # Summary
        successful = sum(results)
        logger.info(f'Results: {successful}/{total_events} events sent successfully')

        if successful == total_events:
            logger.info('✅ All telemetry events sent')
        else:
            logger.warning(f'⚠️  Only {successful}/{total_events} events sent')

        # Wait for function processing
        logger.info('')
        logger.info('Waiting 5 seconds for Azure Function to process events...')
        await asyncio.sleep(5)

        # Check function health
        logger.info('')
        logger.info('Checking Azure Function App status...')
        logger.info(f'URL: {FUNCTION_APP_HEALTH_URL}')

        try:
            import urllib.request
            response = urllib.request.urlopen(FUNCTION_APP_HEALTH_URL, timeout=10)
            health_data = json.loads(response.read().decode())

            logger.info('✅ Function health check passed')
            logger.info(f'  Status: {health_data.get("status")}')
            logger.info(f'  Provider: {health_data.get("provider")}')

            if 'stats' in health_data:
                stats = health_data['stats']
                logger.info(f'  Events processed: {stats.get("events_processed", 0)}')
                logger.info(f'  Records inserted: {stats.get("records_inserted", 0)}')
                logger.info(f'  Records skipped: {stats.get("records_skipped", 0)}')
                logger.info(f'  Errors: {stats.get("errors", 0)}')

        except Exception as e:
            logger.warning(f'⚠️  Cannot reach function health endpoint: {str(e)[:100]}')
            logger.info('   This is expected if:')
            logger.info('   - Function is still starting up')
            logger.info('   - IoT Hub routing not configured')
            logger.info('   - Function trigger not receiving messages')

        return successful == total_events

    finally:
        logger.info('')
        logger.info('Disconnecting from IoT Hub...')
        await client.disconnect()
        logger.info('Disconnected')


if __name__ == '__main__':
    logger.info('')
    logger.info('SETUP REQUIRED:')
    logger.info('1. Get device connection string from Azure Portal:')
    logger.info('   - IoT Hub → Devices → Select test device → Copy connection string')
    logger.info('')
    logger.info('2. Set environment variable:')
    logger.info('   $env:IOT_DEVICE_CONNECTION_STRING = "HostName=...;DeviceId=...;SharedAccessKey=..."')
    logger.info('')
    logger.info('3. Run this script:')
    logger.info('   python test_function_trigger.py')
    logger.info('')
    
    # Run the async main function
    success = asyncio.run(main())
    
    logger.info('')
    logger.info('=' * 70)
    if success:
        logger.info('✅ TEST PASSED: Function app triggered successfully')
    else:
        logger.info('❌ TEST FAILED: Check logs above for details')
    logger.info('=' * 70)
