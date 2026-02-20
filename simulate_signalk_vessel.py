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
    
    # Sailing route around Haifa Port, Israel
    # Haifa Harbor (Israel): 32.8315366°N, 35.0036234°E
    # Route: North 5 miles, West 2.5 miles, return to start
    # Creates a rectangular sailing pattern around the port
    HAIFA_CENTER = {'lat': 32.8315366, 'lon': 35.0036234}
    
    # Calculate polygon bounds (in degrees)
    # 5 nautical miles north ≈ 0.0725° latitude
    # 2.5 nautical miles west ≈ 0.0432° longitude (at this latitude)
    POLYGON_BOUNDS = {
        'south': 32.8315366,
        'north': 32.9040366,  # +0.0725°
        'west': 34.9604234,   # -0.0432°
        'east': 35.0036234
    }
    
    def __init__(self, bootstrap_servers='localhost:9092', topic='signalk-events'):
        """Initialize Kafka producer for SignalK events"""
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        # Track position for both vessels with sailing route around Haifa
        self.vessel_positions = {
            '234567890': {'lat': 32.8315366, 'lon': 35.0036234, 'waypoint_idx': 0},  # Haifa Port
            '234567891': {'lat': 32.8315366, 'lon': 35.0036234, 'waypoint_idx': 0}   # Haifa Port
        }
        # Create sailing route with multiple waypoints
        self.route_waypoints = self._generate_sailing_route()
        self.route_segment = 0  # Current segment of route
        
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
    
    def _generate_sailing_route(self):
        """Generate waypoints for sailing around Haifa Port
        
        Creates a rectangular pattern:
        - North 5 miles from port
        - West 2.5 miles from port
        - Returns to start
        - Cycles continuously with random variations
        """
        waypoints = []
        
        # Generate waypoints in a rectangular pattern around Haifa
        # Segment 1: Southeast corner to Northwest corner (diagonal approximately north+west)
        for i in range(50):
            progress = i / 49.0
            lat = self.POLYGON_BOUNDS['south'] + (self.POLYGON_BOUNDS['north'] - self.POLYGON_BOUNDS['south']) * progress
            lon = self.POLYGON_BOUNDS['east'] + (self.POLYGON_BOUNDS['west'] - self.POLYGON_BOUNDS['east']) * progress
            waypoints.append({'lat': lat, 'lon': lon})
        
        # Segment 2: Return from Northwest to Southeast
        for i in range(50):
            progress = i / 49.0
            lat = self.POLYGON_BOUNDS['north'] + (self.POLYGON_BOUNDS['south'] - self.POLYGON_BOUNDS['north']) * progress
            lon = self.POLYGON_BOUNDS['west'] + (self.POLYGON_BOUNDS['east'] - self.POLYGON_BOUNDS['west']) * progress
            waypoints.append({'lat': lat, 'lon': lon})
        
        logger.info(f"Generated sailing route with {len(waypoints)} waypoints")
        logger.info(f"  Port Center: Haifa {self.HAIFA_CENTER}")
        logger.info(f"  Polygon bounds: South={self.POLYGON_BOUNDS['south']:.4f}, North={self.POLYGON_BOUNDS['north']:.4f}")
        logger.info(f"                  West={self.POLYGON_BOUNDS['west']:.4f}, East={self.POLYGON_BOUNDS['east']:.4f}")
        logger.info(f"  Route: North 5nm, West 2.5nm, Return cycle")
        return waypoints
    
    def generate_navigation_event(self, vessel_mmsi='234567890') -> Dict:
        """Generate a navigation event (position, heading, speed) along the sailing route"""
        # Move vessel along the predefined sailing route
        waypoint_idx = self.route_segment % len(self.route_waypoints)
        waypoint = self.route_waypoints[waypoint_idx]
        
        # Add slight random drift around waypoint (±0.001 degrees)
        lat = waypoint['lat'] + random.uniform(-0.001, 0.001)
        lon = waypoint['lon'] + random.uniform(-0.001, 0.001)
        
        # Update position for this vessel
        self.vessel_positions[vessel_mmsi]['lat'] = lat
        self.vessel_positions[vessel_mmsi]['lon'] = lon
        
        return {
            'context': f'vessels.urn:mrn:imo:mmsi:{vessel_mmsi}',
            'updates': [{
                'source': 'gps1',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'values': [
                    {
                        'path': 'navigation.position',
                        'value': {
                            'latitude': self.vessel_positions[vessel_mmsi]['lat'],
                            'longitude': self.vessel_positions[vessel_mmsi]['lon']
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
    
    def generate_environmental_event(self, vessel_mmsi='234567890') -> Dict:
        """Generate an environmental event (wind, water temp, air pressure)"""
        return {
            'context': f'vessels.urn:mrn:imo:mmsi:{vessel_mmsi}',
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
    
    def generate_engine_event(self, vessel_mmsi='234567890') -> Dict:
        """Generate an engine event (RPM, temperature, pressure)"""
        return {
            'context': f'vessels.urn:mrn:imo:mmsi:{vessel_mmsi}',
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
    
    def generate_electrical_event(self, vessel_mmsi='234567890') -> Dict:
        """Generate an electrical event (battery voltage, current)"""
        return {
            'context': f'vessels.urn:mrn:imo:mmsi:{vessel_mmsi}',
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
    
    def generate_tank_event(self, vessel_mmsi='234567890') -> Dict:
        """Generate a tank event (fuel, water levels)"""
        return {
            'context': f'vessels.urn:mrn:imo:mmsi:{vessel_mmsi}',
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
    
    def advance_route(self):
        """Advance to next waypoint on the sailing route (cycles through full route)"""
        self.route_segment = (self.route_segment + 1) % (len(self.route_waypoints) * 10)  # Cycle through route multiple times
        if self.route_segment == 0:
            logger.info("======= Completed full sailing cycle around Haifa Port =======")
    
    def run(self, interval=5):
        """
        Run the simulator indefinitely, generating events at regular intervals for both vessels
        
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
        
        logger.info(f"Starting SignalK simulator for vessels: {list(self.vessel_positions.keys())}")
        logger.info(f"Event interval: {interval} seconds")
        logger.info(f"Sailing route: Haifa Port polygon (North 5nm, West 2.5nm)")
        logger.info("Press Ctrl+C to stop\n")
        
        event_count = 0
        try:
            while True:
                # Generate events for each vessel
                for vessel_mmsi in self.vessel_positions.keys():
                    for event_type, generator in event_generators:
                        event = generator(vessel_mmsi)
                        self.send_event(event)
                        event_count += 1
                
                # Advance to next waypoint on sailing route
                self.advance_route()
                
                # Log current position periodically
                current_pos = self.vessel_positions[list(self.vessel_positions.keys())[0]]
                logger.info(f"  Waypoint: {self.route_segment} | Position: {current_pos['lat']:.4f}°N, {current_pos['lon']:.4f}°E | Total events: {event_count}")
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
