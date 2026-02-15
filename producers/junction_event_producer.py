"""
Junction Event Producer Simulator
Simulates Junction health data provider events with bulk telemetry data
Sends aggregated metrics with detailed sample arrays
"""

import json
import random
from datetime import datetime, timedelta
from kafka import KafkaProducer
import logging
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class JunctionEventProducer:
    def __init__(self, bootstrap_servers='localhost:9092', topic='junction-events'):
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        self.producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            acks='all',
            retries=3
        )
        logger.info(f"Junction Event Producer initialized. Topic: {topic}")
    
    # ============ VITALS EVENTS WITH BULK DATA ============
    
    def generate_heart_rate_bulk_event(self, user_id=None):
        """Generate heart rate event with detailed samples - 8867-4"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        samples = []
        
        # Generate 12 samples over 1 hour (5-minute intervals)
        avg_hr = random.randint(60, 100)
        for i in range(12):
            sample_time = base_time - timedelta(minutes=(12-i)*5)
            variation = random.randint(-5, 5)
            samples.append({
                'timestamp': sample_time.isoformat(),
                'bpm': avg_hr + variation
            })
        
        return {
            'event_type': 'vitals.heart_rate.update',
            'loinc_code': '8867-4',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'heart_rate_data': {
                    'summary': {'avg_hr_bpm': avg_hr},
                    'detailed': {'hr_samples': samples}
                }
            },
            'type': 'vitals'
        }
    
    def generate_blood_pressure_bulk_event(self, user_id=None):
        """Generate blood pressure event with detailed samples - 8480-6"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        samples = []
        
        # Generate 6 samples over 1 day (4-hour intervals)
        avg_systolic = random.randint(110, 140)
        avg_diastolic = random.randint(70, 90)
        
        for i in range(6):
            sample_time = base_time - timedelta(hours=(6-i)*4)
            systolic_var = random.randint(-5, 5)
            diastolic_var = random.randint(-3, 3)
            samples.append({
                'timestamp': sample_time.isoformat(),
                'systolic_mmhg': avg_systolic + systolic_var,
                'diastolic_mmhg': avg_diastolic + diastolic_var
            })
        
        return {
            'event_type': 'vitals.blood_pressure.update',
            'loinc_code': '8480-6',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'blood_pressure_data': {
                    'summary': {
                        'avg_systolic_mmhg': avg_systolic,
                        'avg_diastolic_mmhg': avg_diastolic
                    },
                    'detailed': {'bp_samples': samples}
                }
            },
            'type': 'vitals'
        }
    
    def generate_body_temperature_bulk_event(self, user_id=None):
        """Generate body temperature event with samples - 8310-5"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        samples = []
        
        # Generate 4 samples over 1 day (6-hour intervals)
        avg_temp = round(random.uniform(36.5, 37.5), 1)
        
        for i in range(4):
            sample_time = base_time - timedelta(hours=(4-i)*6)
            variation = round(random.uniform(-0.3, 0.3), 1)
            samples.append({
                'timestamp': sample_time.isoformat(),
                'celsius': round(avg_temp + variation, 1)
            })
        
        return {
            'event_type': 'vitals.body_temperature.update',
            'loinc_code': '8310-5',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'temperature_data': {
                    'summary': {'avg_celsius': avg_temp},
                    'detailed': {'temperature_samples': samples}
                }
            },
            'type': 'vitals'
        }
    
    def generate_oxygen_saturation_bulk_event(self, user_id=None):
        """Generate oxygen saturation event with sparse samples - 59408-5"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        samples = []
        
        # Generate sparse samples (every 30 minutes)
        avg_spo2 = random.randint(95, 100)
        
        for i in range(6):
            sample_time = base_time - timedelta(minutes=(6-i)*30)
            variation = random.randint(-2, 2)
            samples.append({
                'timestamp': sample_time.isoformat(),
                'percentage': avg_spo2 + variation
            })
        
        return {
            'event_type': 'vitals.oxygen_saturation.update',
            'loinc_code': '59408-5',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'oxygen_data': {
                    'summary': {'avg_saturation_percentage': avg_spo2},
                    'detailed': {'saturation_samples': samples}
                }
            },
            'type': 'vitals'
        }
    
    def generate_respiration_rate_bulk_event(self, user_id=None):
        """Generate respiration rate event with samples - 9279-1"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        samples = []
        
        # Generate 8 samples (every 15 minutes)
        avg_respiration = random.randint(12, 20)
        
        for i in range(8):
            sample_time = base_time - timedelta(minutes=(8-i)*15)
            variation = random.randint(-2, 2)
            samples.append({
                'timestamp': sample_time.isoformat(),
                'breaths_per_min': avg_respiration + variation
            })
        
        return {
            'event_type': 'vitals.respiration_rate.update',
            'loinc_code': '9279-1',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'respiration_data': {
                    'summary': {'avg_breaths_per_min': avg_respiration},
                    'detailed': {'breaths_samples': samples}
                }
            },
            'type': 'vitals'
        }
    
    def generate_heart_rate_variability_bulk_event(self, user_id=None):
        """Generate heart rate variability event - 80404-7"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        samples = []
        
        # Generate 10 samples (every 10 minutes)
        avg_hrv = random.randint(20, 100)
        
        for i in range(10):
            sample_time = base_time - timedelta(minutes=(10-i)*10)
            variation = random.randint(-10, 10)
            samples.append({
                'timestamp': sample_time.isoformat(),
                'rmssd_ms': max(10, avg_hrv + variation)
            })
        
        return {
            'event_type': 'vitals.heart_rate_variability.update',
            'loinc_code': '80404-7',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'hrv_data': {
                    'summary': {'avg_rmssd_ms': avg_hrv},
                    'detailed': {'hrv_samples': samples}
                }
            },
            'type': 'vitals'
        }
    
    def generate_glucose_bulk_event(self, user_id=None):
        """Generate glucose event with samples - 2339-0"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        samples = []
        
        # Generate 5 samples (fasting, before meals, after meals pattern)
        avg_glucose = random.randint(80, 150)
        
        sample_times = [
            'fasting', 'before_breakfast', 'after_breakfast',
            'before_lunch', 'after_lunch'
        ]
        
        for i, meal_phase in enumerate(sample_times):
            sample_time = base_time - timedelta(hours=(5-i)*3)
            variation = random.randint(-20, 20)
            samples.append({
                'timestamp': sample_time.isoformat(),
                'glucose_mg_dl': max(70, avg_glucose + variation),
                'phase': meal_phase
            })
        
        return {
            'event_type': 'vitals.glucose.update',
            'loinc_code': '2339-0',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'glucose_data': {
                    'summary': {'avg_glucose_mg_dl': avg_glucose},
                    'detailed': {'glucose_samples': samples}
                }
            },
            'type': 'vitals'
        }
    
    # ============ ACTIVITY EVENTS WITH BULK DATA ============
    
    def generate_steps_bulk_event(self, user_id=None):
        """Generate steps event with hourly breakdown - 55411-3"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        hourly_data = []
        total_steps = 0
        
        # Generate 24 hourly samples
        for i in range(24):
            hour_time = base_time - timedelta(hours=(24-i))
            hourly_steps = random.randint(500, 3000)
            total_steps += hourly_steps
            hourly_data.append({
                'timestamp': hour_time.isoformat(),
                'hourly_steps': hourly_steps
            })
        
        return {
            'event_type': 'activity.steps.update',
            'loinc_code': '55411-3',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'steps_data': {
                    'summary': {
                        'total_steps': total_steps,
                        'daily_goal': 10000,
                        'goal_achieved': total_steps >= 10000
                    },
                    'detailed': {'hourly_steps': hourly_data}
                }
            },
            'type': 'activity'
        }
    
    def generate_calories_bulk_event(self, user_id=None):
        """Generate calories event with activity breakdown - 41981-2"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        activity_samples = []
        
        # Generate activity samples
        activities = ['walking', 'running', 'cycling', 'gym', 'rest']
        total_calories = 0
        
        for i in range(8):
            activity_time = base_time - timedelta(hours=(8-i)*3)
            activity = random.choice(activities)
            calories = random.randint(50, 300) if activity != 'rest' else random.randint(10, 30)
            total_calories += calories
            activity_samples.append({
                'timestamp': activity_time.isoformat(),
                'activity': activity,
                'calories_burned': calories
            })
        
        return {
            'event_type': 'activity.calories.update',
            'loinc_code': '41981-2',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'calories_data': {
                    'summary': {
                        'total_calories_burned': total_calories,
                        'avg_daily_calories': total_calories,
                        'daily_goal': 2000
                    },
                    'detailed': {'activity_samples': activity_samples}
                }
            },
            'type': 'activity'
        }
    
    def generate_distance_bulk_event(self, user_id=None):
        """Generate distance event with route data - 8466-5"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        route_samples = []
        total_distance = 0
        
        # Generate route waypoints
        start_lat = random.uniform(-90, 90)
        start_lon = random.uniform(-180, 180)
        
        for i in range(15):
            sample_time = base_time - timedelta(minutes=(15-i)*4)
            distance_segment = round(random.uniform(0.1, 0.5), 2)
            total_distance += distance_segment
            
            route_samples.append({
                'timestamp': sample_time.isoformat(),
                'latitude': round(start_lat + random.uniform(-0.01, 0.01), 4),
                'longitude': round(start_lon + random.uniform(-0.01, 0.01), 4),
                'segment_distance_km': distance_segment
            })
        
        return {
            'event_type': 'activity.distance.update',
            'loinc_code': '8466-5',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'distance_data': {
                    'summary': {'total_distance_km': round(total_distance, 2)},
                    'detailed': {'route_samples': route_samples}
                }
            },
            'type': 'activity'
        }
    
    # ============ SLEEP EVENTS WITH BULK DATA ============
    
    def generate_sleep_bulk_event(self, user_id=None):
        """Generate sleep event with sleep stages - 93831-0"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        sleep_start = base_time - timedelta(hours=8)
        sleep_end = base_time
        
        # Generate sleep stage samples (30-minute intervals)
        stages = []
        sleep_stages_enum = ['light', 'deep', 'rem', 'awake']
        
        for i in range(16):
            stage_time = sleep_start + timedelta(minutes=i*30)
            stage = random.choice(sleep_stages_enum)
            stages.append({
                'timestamp': stage_time.isoformat(),
                'stage': stage
            })
        
        return {
            'event_type': 'sleep.session.updated',
            'loinc_code': '93831-0',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'sleep_data': {
                    'summary': {
                        'total_sleep_minutes': 480,
                        'deep_sleep_minutes': random.randint(60, 120),
                        'rem_sleep_minutes': random.randint(60, 120),
                        'light_sleep_minutes': random.randint(200, 250),
                        'awake_minutes': random.randint(20, 50),
                        'sleep_quality_score': round(random.uniform(60, 95), 1)
                    },
                    'detailed': {'sleep_stages': stages}
                }
            },
            'type': 'sleep'
        }
    
    # ============ LOCATION EVENTS WITH BULK DATA ============
    
    def generate_location_bulk_event(self, user_id=None):
        """Generate location event with GPS track - 33018-7"""
        if user_id is None:
            user_id = f"user_{random.randint(1000, 9999)}"
        
        base_time = datetime.utcnow()
        gps_track = []
        
        # Generate GPS track (1-minute intervals)
        start_lat = random.uniform(-90, 90)
        start_lon = random.uniform(-180, 180)
        
        for i in range(30):
            point_time = base_time - timedelta(minutes=(30-i))
            gps_track.append({
                'timestamp': point_time.isoformat(),
                'latitude': round(start_lat + random.uniform(-0.005, 0.005), 6),
                'longitude': round(start_lon + random.uniform(-0.005, 0.005), 6),
                'accuracy_meters': round(random.uniform(5, 20), 1),
                'altitude_meters': round(random.uniform(0, 500), 1)
            })
        
        return {
            'event_type': 'location.update',
            'loinc_code': '33018-7',
            'user': {'user_id': user_id},
            'timestamp': base_time.isoformat(),
            'data': {
                'location_data': {
                    'summary': {
                        'start_latitude': start_lat,
                        'start_longitude': start_lon,
                        'current_latitude': gps_track[-1]['latitude'],
                        'current_longitude': gps_track[-1]['longitude']
                    },
                    'detailed': {'gps_track': gps_track}
                }
            },
            'type': 'location'
        }
    
    def produce_event(self, event):
        """Publish event to Kafka topic"""
        try:
            self.producer.send(self.topic, value=event)
            user_id = event.get('user', {}).get('user_id', 'N/A')
            num_samples = self._count_samples(event)
            logger.info(f"✓ {event['event_type']} | User: {user_id} | Samples: {num_samples}")
        except Exception as e:
            logger.error(f"Error producing event: {e}")
    
    def _count_samples(self, event):
        """Count total samples in event"""
        data = event.get('data', {})
        count = 0
        for key, val in data.items():
            if isinstance(val, dict) and 'detailed' in val:
                for detail_key, detail_val in val['detailed'].items():
                    if isinstance(detail_val, list):
                        count += len(detail_val)
        return count
    
    def simulate_continuous_events(self, duration_seconds=300, interval_seconds=5):
        """Simulate continuous event stream with bulk data"""
        event_generators = [
            self.generate_heart_rate_bulk_event,
            self.generate_blood_pressure_bulk_event,
            self.generate_body_temperature_bulk_event,
            self.generate_oxygen_saturation_bulk_event,
            self.generate_respiration_rate_bulk_event,
            self.generate_heart_rate_variability_bulk_event,
            self.generate_glucose_bulk_event,
            self.generate_steps_bulk_event,
            self.generate_calories_bulk_event,
            self.generate_distance_bulk_event,
            self.generate_sleep_bulk_event,
            self.generate_location_bulk_event,
        ]
        
        start_time = datetime.utcnow()
        event_count = 0
        user_ids = [f"user_{i}" for i in range(1, 11)]  # 10 users
        
        logger.info(f"Starting simulation for {duration_seconds} seconds with {interval_seconds}s interval...")
        logger.info(f"Generating events for {len(user_ids)} users")
        logger.info("=" * 70)
        
        while (datetime.utcnow() - start_time).total_seconds() < duration_seconds:
            event_generator = random.choice(event_generators)
            user_id = random.choice(user_ids)
            event = event_generator(user_id=user_id)
            self.produce_event(event)
            event_count += 1
            
            time.sleep(interval_seconds)
        
        self.producer.flush()
        logger.info("=" * 70)
        logger.info(f"✓ Simulation complete. Total bulk events produced: {event_count}")
        self.producer.close()


if __name__ == '__main__':
    producer = JunctionEventProducer(
        bootstrap_servers='localhost:9092',
        topic='junction-events'
    )
    logger.info("=" * 70)
    logger.info("Starting Junction Event Producer with Bulk Telemetry Data")
    logger.info("=" * 70)
    producer.simulate_continuous_events(duration_seconds=600, interval_seconds=3)