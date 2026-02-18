#!/usr/bin/env python3
"""
SignalK Event Simulator
Generates synthetic SignalK maritime telemetry events for testing the consumer
Produces events in Signal K format with navigation, environmental, and engine data
"""

import json
import logging
import time
from datetime import datetime
from kafka import KafkaProducer
from typing import Dict
import random

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SignalKSimulator:
    """Generates realistic SignalK maritime telemetry events"""
    
    def __init__(self, bootstrap_servers='localhost:9092', topic='signalk-events'):
        """Initialize Kafka producer for SignalK events"""
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        self.vessel_mmsi = '244670426'  # Example MMSI (unique identifier for vessel)
        
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                client_id='signalk-simulator-1'
            )
            logger.info(f"Connected to Kafka: {bootstrap_servers}")
        except Exception as e:
            logger.error(f"Failed to connect to Kafka: {e}")
            raise
    
    def generate_navigation_event(self) -> Dict:
        """Generate a navigation event (position, heading, speed)"""
        return {
            'context': f'vessels.urn:mrn:imo:mmsi:{self.vessel_mmsi}',
            'updates': [{
                'source': 'gps1',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'values': [
                    {
                        'path': 'navigation.position',
                        'value': {
                            'latitude': 60.0 + random.uniform(-0.1, 0.1),
                            'longitude': 25.0 + random.uniform(-0.1, 0.1)
                        }
                    },
                    {
                        'path': 'navigation.headingMagnetic',
                        'value': random.uniform(0, 6.283185307179586)  # 0-2π radians
                    },
                    {
                        'path': 'navigation.headingTrue',
                        'value': random.uniform(0, 6.283185307179586)
                    },
                    {
                        'path': 'navigation.courseOverGround',
                        'value': random.uniform(0, 6.283185307179586)
                    },
                    {
                        'path': 'navigation.speedOverGround',
                        'value': random.uniform(0, 15)  # 0-15 m/s
                    },
                    {
                        'path': 'navigation.speedThroughWater',
                        'value': random.uniform(0, 12)  # 0-12 m/s
                    }
                ]
            }]
        }
    
    def generate_environmental_event(self) -> Dict:
        """Generate an environmental event (wind, water temp, air pressure)"""
        return {
            'context': f'vessels.urn:mrn:imo:mmsi:{self.vessel_mmsi}',
            'updates': [{
                'source': 'weather1',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'values': [
                    {
                        'path': 'environment.wind.speedApparent',
                        'value': random.uniform(0, 25)  # 0-25 m/s
                    },
                    {
                        'path': 'environment.wind.directionApparent',
                        'value': random.uniform(0, 6.283185307179586)
                    },
                    {
                        'path': 'environment.water.temperature',
                        'value': 273.15 + random.uniform(5, 20)  # 5-20°C in Kelvin
                    },
                    {
                        'path': 'environment.outside.temperature',
                        'value': 273.15 + random.uniform(0, 25)  # 0-25°C in Kelvin
                    },
                    {
                        'path': 'environment.outside.pressure',
                        'value': 98000 + random.uniform(-2000, 2000)  # ~98kPa
                    }
                ]
            }]
        }
    
    def generate_engine_event(self) -> Dict:
        """Generate an engine event (RPM, temperature, pressure)"""
        return {
            'context': f'vessels.urn:mrn:imo:mmsi:{self.vessel_mmsi}',
            'updates': [{
                'source': 'engine1',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'values': [
                    {
                        'path': 'propulsion.main.revolutions',
                        'value': random.uniform(0, 50)  # 0-50 revolutions per second (0-3000 RPM)
                    },
                    {
                        'path': 'propulsion.main.temperature',
                        'value': 273.15 + random.uniform(80, 95)  # 80-95°C in Kelvin
                    },
                    {
                        'path': 'propulsion.main.oilPressure',
                        'value': 300000 + random.uniform(-50000, 50000)  # ~300kPa
                    }
                ]
            }]
        }
    
    def generate_electrical_event(self) -> Dict:
        """Generate an electrical event (battery voltage, current)"""
        return {
            'context': f'vessels.urn:mrn:imo:mmsi:{self.vessel_mmsi}',
            'updates': [{
                'source': 'electrical1',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'values': [
                    {
                        'path': 'electrical.dc.houseBattery.voltage',
                        'value': random.uniform(11.5, 14.5)  # 11.5-14.5 volts
                    },
                    {
                        'path': 'electrical.dc.houseBattery.current',
                        'value': random.uniform(-200, 200)  # -200 to +200 amps (positive = charging)
                    }
                ]
            }]
        }
    
    def generate_tank_event(self) -> Dict:
        """Generate a tank event (fuel, water levels)"""
        return {
            'context': f'vessels.urn:mrn:imo:mmsi:{self.vessel_mmsi}',
            'updates': [{
                'source': 'tanks1',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'values': [
                    {
                        'path': 'tanks.fuelTank.level',
                        'value': random.uniform(0.3, 0.9)  # 30-90% full (0-1 ratio)
                    },
                    {
                        'path': 'tanks.freshWaterTank.level',
                        'value': random.uniform(0.4, 0.95)  # 40-95% full
                    },
                    {
                        'path': 'tanks.wasteWaterTank.level',
                        'value': random.uniform(0.1, 0.7)  # 10-70% full
                    }
                ]
            }]
        }
    
    def send_event(self, event: Dict):
        """Send an event to Kafka"""
        try:
            self.producer.send(self.topic, event).get(timeout=5)
            logger.info(f"✓ Sent: {event['updates'][0]['source']} event ({len(event['updates'][0]['values'])} values)")
        except Exception as e:
            logger.error(f"Failed to send event: {e}")
    
    def run(self, interval=5):
        """
        Run the simulator indefinitely, generating events at regular intervals
        
        Args:
            interval: Seconds between event rounds
        """
        event_generators = [
            ('navigation', self.generate_navigation_event),
            ('environmental', self.generate_environmental_event),
            ('engine', self.generate_engine_event),
            ('electrical', self.generate_electrical_event),
            ('tanks', self.generate_tank_event),
        ]
        
        logger.info(f"Starting SignalK simulator for vessel {self.vessel_mmsi}")
        logger.info(f"Event interval: {interval} seconds")
        logger.info("Press Ctrl+C to stop\n")
        
        event_count = 0
        try:
            while True:
                for event_type, generator in event_generators:
                    event = generator()
                    self.send_event(event)
                    event_count += 1
                
                logger.info(f"  Total events sent: {event_count}\n")
                time.sleep(interval)
        
        except KeyboardInterrupt:
            logger.info(f"\nSimulator stopped. Total events sent: {event_count}")
            self.producer.flush()
            self.producer.close()

if __name__ == '__main__':
    simulator = SignalKSimulator(
        bootstrap_servers='localhost:9092',
        topic='signalk-events'
    )
    simulator.run(interval=5)  # Send new rounds of events every 5 seconds
