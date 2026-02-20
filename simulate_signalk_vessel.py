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
        
        Uses actual GPS traces from Haifa harbor with realistic port docking pattern
        61 waypoints tracing actual vessel path around the harbor
        """
        # Actual traced waypoints from Haifa harbor (lon, lat format from map tool)
        waypoints_raw = [
            (35.0315595, 32.8059605),
            (35.0304437, 32.8062310),
            (35.0293064, 32.8064474),
            (35.0285125, 32.8068620),
            (35.0282979, 32.8081422),
            (35.0285983, 32.8089896),
            (35.0286241, 32.8099920),
            (35.0286026, 32.8109476),
            (35.0283666, 32.8117949),
            (35.0280018, 32.8124800),
            (35.0270791, 32.8132192),
            (35.0253754, 32.8148129),
            (35.0237875, 32.8157324),
            (35.0226631, 32.8162985),
            (35.0209465, 32.8170737),
            (35.0190582, 32.8179210),
            (35.0175991, 32.8195975),
            (35.0168052, 32.8210578),
            (35.0160456, 32.8266640),
            (35.0169253, 32.8272606),
            (35.0179768, 32.8281980),
            (35.0188136, 32.8297121),
            (35.0193071, 32.8312443),
            (35.0194144, 32.8321816),
            (35.0195217, 32.8333171),
            (35.0203028, 32.8335522),
            (35.0210752, 32.8337324),
            (35.0226631, 32.8338766),
            (35.0250235, 32.8339487),
            (35.0294867, 32.8334080),
            (35.0336065, 32.8323986),
            (35.0381985, 32.8308484),
            (35.0413227, 32.8315365),
            (35.0447559, 32.8339158),
            (35.0473566, 32.8399213),
            (35.0489445, 32.8434538),
            (35.0502491, 32.8553910),
            (35.0500774, 32.8629592),
            (35.0524978, 32.8816849),
            (35.0554676, 32.8922633),
            (35.0610294, 32.9014277),
            (35.0663509, 32.9054621),
            (35.0705566, 32.9092081),
            (35.0723848, 32.9119321),
            (35.0736294, 32.9143452),
            (35.0725393, 32.9161717),
            (35.0717669, 32.9171621),
            (35.0715737, 32.9176843),
            (35.0715308, 32.9183146),
            (35.0715051, 32.9186410),
            (35.0715373, 32.9191002),
            (35.0712905, 32.9194154),
            (35.0711226, 32.9195032),
            (35.0708544, 32.9195509),
            (35.0705084, 32.9196049),
            (35.0702444, 32.9196301),
            (35.0700572, 32.9195613),
            (35.0698748, 32.9194825)
        ]
        
        # Convert to waypoint format (lon, lat) -> {'lat': lat, 'lon': lon}
        waypoints = [{'lat': lat, 'lon': lon} for lon, lat in waypoints_raw]
        
        logger.info(f"Generated sailing route with {len(waypoints)} actual harbor waypoints")
        logger.info(f"  Haifa Harbor trace: Real GPS coordinates from Leaflet map trace")
        logger.info(f"  Route: Complex docking pattern around Haifa port")
        logger.info(f"  Latitude range: {min(w['lat'] for w in waypoints):.4f} to {max(w['lat'] for w in waypoints):.4f}")
        logger.info(f"  Longitude range: {min(w['lon'] for w in waypoints):.4f} to {max(w['lon'] for w in waypoints):.4f}")
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
