#!/usr/bin/env python3
"""
Azure IoT Hub Device Simulator
Sends realistic SignalK maritime telemetry events to Azure IoT Hub
Triggers the Azure Function consumer for testing end-to-end data flow

Usage:
  python simulate_iot_hub_telemetry.py

Environment Setup:
  IoT_HUB_CONNECTION_STRING - Device connection string (from Azure IoT Hub)
  Example: HostName=vxt-hub.azure-devices.net;DeviceId=TomerRefael;SharedAccessKey=...
"""

import asyncio
import json
import logging
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict

from azure.iot.device.aio import IoTHubDeviceClient
from azure.iot.device import Message

# Configure detailed logging with timestamps and function names
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(funcName)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Reduce noise from Azure SDK internal logs
logging.getLogger('azure.iot.device.common.mqtt_transport').setLevel(logging.WARNING)
logging.getLogger('azure.iot.device.common.pipeline').setLevel(logging.WARNING)


class IoTHubTelemetrySimulator:
    """Simulates a maritime vessel sending SignalK telemetry to Azure IoT Hub"""
    
    def __init__(self):
        """Initialize IoT Hub device client"""
        self.connection_string = os.environ.get('IOT_DEVICE_CONNECTION_STRING')
        if not self.connection_string:
            raise ValueError(
                "IOT_DEVICE_CONNECTION_STRING environment variable not set.\n"
                "Get from Azure IoT Hub > Devices > Select device > Connection string"
            )
        
        self.client = None
        self.device_id = "TomerRefael"  # Maritime vessel identifier
        self.event_count = 0
        
        # Haifa Harbor coordinates
        self.haifa_center = {'lat': 32.8315366, 'lon': 35.0036234}
        self.current_position = {
            'lat': self.haifa_center['lat'],
            'lon': self.haifa_center['lon']
        }
    
    async def connect(self):
        """Connect to Azure IoT Hub with detailed logging"""
        try:
            logger.info("Attempting to connect to IoT Hub...")
            logger.debug(f"Creating client from connection string (first 50 chars): {self.connection_string[:50]}...")
            
            self.client = IoTHubDeviceClient.create_from_connection_string(
                self.connection_string
            )
            logger.debug(f"Client created: {type(self.client)}")
            
            logger.info("Calling client.connect()...")
            await self.client.connect()
            
            logger.info(f"✓ Successfully connected to IoT Hub as device: {self.device_id}")
            logger.debug(f"Client connected state: {self.client.connected}")
            
        except Exception as e:
            logger.error(f"✗ Failed to connect to IoT Hub: {type(e).__name__}: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    async def disconnect(self):
        """Disconnect from Azure IoT Hub"""
        if self.client:
            await self.client.disconnect()
            logger.info("Disconnected from IoT Hub")
    
    def generate_signalk_event(self) -> Dict:
        """Generate realistic SignalK maritime telemetry event
        
        SignalK format with navigation, engine, and environmental data.
        Matches the format expected by azure_function_signalk_telemetry.py
        """
        base_time = datetime.now(timezone.utc)
        
        # Simulate vessel movement
        self.current_position['lat'] += random.uniform(-0.001, 0.001)
        self.current_position['lon'] += random.uniform(-0.001, 0.001)
        
        # Generate realistic SignalK JSON structure
        event = {
            "context": f"vessels.{self.device_id}",
            "updates": [
                {
                    "source": {
                        "label": "N2K",
                        "id": "115"
                    },
                    "timestamp": base_time.isoformat(),
                    "values": [
                        # Navigation data
                        {
                            "path": "navigation.position",
                            "value": {
                                "latitude": self.current_position['lat'],
                                "longitude": self.current_position['lon']
                            }
                        },
                        # Course and speed
                        {
                            "path": "navigation.courseOverGround",
                            "value": random.uniform(0, 360)
                        },
                        {
                            "path": "navigation.speedOverGround",
                            "value": random.uniform(5, 15)  # knots
                        },
                        # Engine data
                        {
                            "path": "propulsion.0.revolutions",
                            "value": random.uniform(700, 2000)  # RPM
                        },
                        {
                            "path": "propulsion.0.temperature",
                            "value": random.uniform(60, 90) + 273.15  # Kelvin
                        },
                        # Environmental
                        {
                            "path": "environment.water.temperature",
                            "value": random.uniform(15, 25) + 273.15  # Kelvin
                        },
                        {
                            "path": "environment.wind.speedApparent",
                            "value": random.uniform(2, 12)  # m/s
                        }
                    ]
                }
            ]
        }
        
        return event
    
    async def send_event(self):
        """Send a single telemetry event to IoT Hub with detailed logging"""
        event_num = self.event_count + 1
        
        try:
            # Step 1: Generate event
            logger.debug(f"[{event_num}] Generating SignalK event...")
            event_data = self.generate_signalk_event()
            logger.debug(f"[{event_num}] Event data generated: {len(json.dumps(event_data))} bytes")
            
            # Step 2: Create message
            logger.debug(f"[{event_num}] Creating Message object...")
            message_json = json.dumps(event_data)
            message = Message(message_json)
            
            # Step 3: Set message properties
            logger.debug(f"[{event_num}] Setting message properties...")
            message.content_encoding = "utf-8"
            message.content_type = "application/json"
            message.custom_properties = {
                "provider": "N2KToSignalK",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source": "simulator",
                "event_num": str(event_num)
            }
            logger.debug(f"[{event_num}] Message properties set")
            logger.debug(f"[{event_num}] Message size: {len(message_json)} bytes")
            logger.debug(f"[{event_num}] Position: {self.current_position['lat']:.6f}°N, {self.current_position['lon']:.6f}°E")
            
            # Step 4: Send message
            logger.info(f"[{event_num}] Sending to IoT Hub...")
            start_send = datetime.now(timezone.utc)
            
            if not self.client:
                raise RuntimeError("IoT Hub client not connected")
            
            await self.client.send_message(message)
            
            # Step 5: Log success
            elapsed = (datetime.now(timezone.utc) - start_send).total_seconds()
            self.event_count += 1
            
            logger.info(
                f"[{self.event_count:4d}] ✓ Event sent successfully ({elapsed:.2f}s) → "
                f"Pos: {self.current_position['lat']:.6f}°N, {self.current_position['lon']:.6f}°E"
            )
            
        except AttributeError as e:
            logger.error(f"[{event_num}] ✗ Attribute Error (client issue): {e}")
            logger.error(f"[{event_num}]   Client type: {type(self.client)}")
            logger.error(f"[{event_num}]   Client connected: {self.client.connected if self.client else 'N/A'}")
            raise
        except asyncio.TimeoutError as e:
            logger.error(f"[{event_num}] ✗ Timeout Error: Send took too long: {e}")
            raise
        except Exception as e:
            logger.error(f"[{event_num}] ✗ Failed to send event: {type(e).__name__}: {e}")
            import traceback
            logger.error(f"[{event_num}] Traceback: {traceback.format_exc()}")
            raise
    
    async def run_simulation(self, duration_minutes: int = 5, interval_seconds: int = 10):
        """Run continuous simulation with detailed logging
        
        Args:
            duration_minutes: How long to run the simulation (default 5 minutes)
            interval_seconds: Event send interval in seconds (default 10 seconds)
        """
        logger.info(
            f"\n{'=' * 80}"
            f"\nStarting IoT Hub Telemetry Simulation"
            f"\nDevice: {self.device_id}"
            f"\nDuration: {duration_minutes} minutes"
            f"\nEvent interval: {interval_seconds} seconds"
            f"\nExpected events: {int((duration_minutes * 60) / interval_seconds)}"
            f"\nAzure Function trigger: vxt-function"
            f"\nDatabase destination: EntityTelemetry table"
            f"\n{'=' * 80}\n"
        )
        
        try:
            start_time = datetime.now(timezone.utc)
            end_time = start_time + timedelta(minutes=duration_minutes)
            loop_count = 0
            
            logger.info(f"Simulation start: {start_time.isoformat()}")
            logger.info(f"Simulation end:   {end_time.isoformat()}")
            
            while datetime.now(timezone.utc) < end_time:
                loop_count += 1
                current_time = datetime.now(timezone.utc)
                elapsed = (current_time - start_time).total_seconds()
                remaining = (end_time - current_time).total_seconds()
                
                logger.debug(f"\n--- Loop {loop_count} ---")
                logger.debug(f"Current time: {current_time.isoformat()}")
                logger.debug(f"Elapsed: {elapsed:.1f}s, Remaining: {remaining:.1f}s")
                
                # Send event
                await self.send_event()
                
                logger.debug(f"Waiting {interval_seconds}s before next event...")
                await asyncio.sleep(interval_seconds)
        
        except KeyboardInterrupt:
            logger.info(f"\n✓ Simulation stopped by user after {self.event_count} events")
        except Exception as e:
            logger.error(f"\n✗ Simulation error on loop {loop_count}: {type(e).__name__}: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
        finally:
            end_time_actual = datetime.now(timezone.utc)
            total_elapsed = (end_time_actual - start_time).total_seconds()
            
            logger.info(
                f"\n{'=' * 80}"
                f"\nSimulation Complete"
                f"\nTotal events sent: {self.event_count} / {int((duration_minutes * 60) / interval_seconds)} expected"
                f"\nTotal time: {total_elapsed:.1f} seconds"
                f"\nAverage rate: {(self.event_count / total_elapsed if total_elapsed > 0 else 0):.2f} events/sec"
                f"\nCheck Azure IoT Hub and EntityTelemetry table for new data"
                f"\n{'=' * 80}\n"
            )


async def main():
    """Main simulation entry point with detailed logging"""
    logger.info(f"\n{'=' * 80}")
    logger.info("Azure IoT Hub Telemetry Simulator - Starting")
    logger.info(f"{'=' * 80}")
    
    simulator = IoTHubTelemetrySimulator()
    logger.info(f"Simulator initialized for device: {simulator.device_id}")
    
    try:
        # Connect phase
        logger.info("\n[PHASE 1] Connecting to IoT Hub...")
        await simulator.connect()
        logger.info("✓ Connection phase complete")
        
        # Simulation phase - send exactly 2 messages
        logger.info("\n[PHASE 2] Sending telemetry events...")
        for i in range(2):
            logger.info(f"\nSending message {i+1}/2...")
            await simulator.send_event()
            if i < 1:  # Don't sleep after last message
                await asyncio.sleep(2)  # 2 second delay between messages
        logger.info("\n✓ Message sending complete")
        
    except ValueError as e:
        logger.error(f"\n✗ Configuration Error: {e}")
        logger.error("\nHow to fix:")
        logger.error("  1. Go to Azure IoT Hub > IoT Hub 'VXT-IoT-Hub' > Devices > Select your device")
        logger.error("  2. Copy 'Connection string (primary key)'")
        logger.error("  3. Set environment variable:")
        logger.error("     $env:IOT_DEVICE_CONNECTION_STRING = '<paste_connection_string_here>'")
        logger.error("  4. Run this script again")
        return 1
    except Exception as e:
        logger.error(f"\n✗ Simulation failed: {type(e).__name__}: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return 1
    finally:
        logger.info("\n[PHASE 3] Disconnecting...")
        await simulator.disconnect()
        logger.info("✓ Disconnection complete")
    
    logger.info(f"\n{'=' * 80}")
    logger.info("✓ All phases completed successfully")
    logger.info(f"{'=' * 80}\n")
    return 0


if __name__ == "__main__":
    # Enable debug logging
    logging.getLogger().setLevel(logging.DEBUG)
    # Also log from Azure SDK
    logging.getLogger('azure.iot').setLevel(logging.DEBUG)
    
    logger.info(f"Python asyncio event loop policy: {asyncio.get_event_loop_policy()}")
    
    exit_code = asyncio.run(main())
    logger.info(f"Exiting with code: {exit_code}")
    exit(exit_code)
