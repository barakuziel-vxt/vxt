"""
Junction Event Producer Simulator
Simulates Junction health data provider events with BULK telemetry data
Each event contains multiple measurement samples matching Junction's actual JSON structure
"""

import json
import random
from datetime import datetime, timedelta, timezone
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
    
    # ============ VITALS EVENTS WITH BULK SAMPLES ============
    
    def generate_heart_rate_bulk_event(self):
        """Heart rate event with multiple dense samples - 8867-4
        Sends values that trigger NEWS: <40 or >130 (Score=3), or 111-130 (Score=2)
        """
        user_id = '033114870' 
        base_time = datetime.now(timezone.utc)
        # Send critical values: 35 bpm (triggers Score=3)
        avg_hr = 35
        
        # Generate 12 samples over 1 hour (5-minute intervals)
        hr_samples = []
        for i in range(12):
            sample_time = base_time - timedelta(minutes=(12-i)*5)
            variation = random.randint(-2, 2)
            hr_samples.append({
                "timestamp": sample_time.isoformat(),
                "bpm": avg_hr + variation
            })
        
        return {
            "user": {"user_id": f"user_{user_id}"},
            "data": {
                "heart_rate_data": {
                    "summary": {"avg_hr_bpm": avg_hr},
                    "detailed": {
                        "hr_samples": hr_samples
                    }
                }
            },
            "type": "vitals",
            "event_type": "vitals.heart_rate.update",
            "loinc_code": "8867-4",
            "timestamp": base_time.isoformat()
        }
    
    def generate_blood_pressure_bulk_event(self):
        """Blood pressure event with multiple samples - 8480-6 (Systolic BP)
        Sends systolic values that trigger Event 2: <90 (Score=3, hypotension)
        """
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        # Send critical hypotension values: 75 mmHg systolic (triggers Score=3 for Event 2)
        avg_systolic = 75
        avg_diastolic = 50
        
        # Generate 6 samples over 1 day (4-hour intervals)
        bp_samples = []
        for i in range(6):
            sample_time = base_time - timedelta(hours=(6-i)*4)
            systolic_var = random.randint(-2, 2)
            diastolic_var = random.randint(-1, 1)
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
                    "detailed": {
                        "bp_samples": bp_samples
                    }
                }
            },
            "type": "vitals",
            "event_type": "vitals.blood_pressure.update",
            "loinc_code": "8480-6",
            "timestamp": base_time.isoformat()
        }
    
    def generate_oxygen_saturation_bulk_event(self):
        """Oxygen saturation event with sparse samples - 59408-5
        Sends values that trigger NEWS: <92% (Score=3 at <91, Score=2 at 92-93)
        """
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        # Send critical values: 88% SpO2 (triggers Score=3)
        avg_spo2 = 88
        
        # Generate sparse samples (every 30 minutes)
        spo2_samples = []
        for i in range(6):
            sample_time = base_time - timedelta(minutes=(6-i)*30)
            variation = random.randint(-1, 1)
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
            "event_type": "vitals.oxygen_saturation.update",
            "loinc_code": "59408-5",
            "timestamp": base_time.isoformat()
        }
    
    def generate_respiration_rate_bulk_event(self):
        """Respiration rate event with multiple samples - 9279-1
        Sends values that trigger NEWS: <9 or >25 (Score=3), or 21-24 (Score=2)
        """
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        # Send critical values: 6 breaths/min (triggers Score=3)
        avg_respiration = 6
        
        # Generate 8 samples (every 15 minutes)
        resp_samples = []
        for i in range(8):
            sample_time = base_time - timedelta(minutes=(8-i)*15)
            variation = random.randint(-1, 1)
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
            "event_type": "vitals.respiration_rate.update",
            "loinc_code": "9279-1",
            "timestamp": base_time.isoformat()
        }
    
    def generate_body_temperature_bulk_event(self):
        """Body temperature event with multiple samples - 8310-5
        Sends values that trigger NEWS: <35°C or >39°C (Score=2 or 3)
        """
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        # Send critical values: 34.5°C (triggers Score=3)
        avg_temp = 34.5
        
        # Generate 4 samples (every 6 hours)
        temp_samples = []
        for i in range(4):
            sample_time = base_time - timedelta(hours=(4-i)*6)
            variation = round(random.uniform(-0.2, 0.2), 1)
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
            "event_type": "vitals.body_temperature.update",
            "loinc_code": "8310-5",
            "timestamp": base_time.isoformat()
        }
    
    def generate_glucose_bulk_event(self):
        """Glucose event with meal-phase samples - 2339-0"""
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        avg_glucose = random.randint(70, 180)  # Normal to elevated glucose
        
        # Generate 5 samples (fasting, before/after meals pattern)
        glucose_samples = []
        meal_phases = ['fasting', 'before_breakfast', 'after_breakfast', 'before_lunch', 'after_lunch']
        
        for i, phase in enumerate(meal_phases):
            sample_time = base_time - timedelta(hours=(5-i)*3)
            variation = random.randint(-15, 15)
            # Cap glucose values at 300 (max postprandial range)
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
            "event_type": "vitals.glucose.update",
            "loinc_code": "2339-0",
            "timestamp": base_time.isoformat()
        }
    
    def generate_heart_rate_variability_bulk_event(self):
        """Heart rate variability event - 80404-7"""
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        avg_hrv = random.randint(20, 100)
        
        # Generate 10 samples (every 10 minutes)
        hrv_samples = []
        for i in range(10):
            sample_time = base_time - timedelta(minutes=(10-i)*10)
            variation = random.randint(-10, 10)
            hrv_samples.append({
                "timestamp": sample_time.isoformat(),
                "rmssd_ms": max(10, avg_hrv + variation)
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
            "event_type": "vitals.heart_rate_variability.update",
            "loinc_code": "80404-7",
            "timestamp": base_time.isoformat()
        }
    
    def generate_diastolic_blood_pressure_bulk_event(self):
        """Diastolic blood pressure event - 8462-4"""
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        avg_diastolic = random.randint(70, 90)
        
        # Generate 6 samples
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
            "event_type": "vitals.diastolic_blood_pressure.update",
            "loinc_code": "8462-4",
            "timestamp": base_time.isoformat()
        }
    
    def generate_resting_heart_rate_bulk_event(self):
        """Resting heart rate event - 8418-4
        DRIFT DETECTOR TEST: Generates upward drift to trigger RestHeartRateDrift alert
        - Days 7-2: Normal baseline (60-65 bpm) 
        - Day 1 (most recent): Elevated (85-95 bpm) showing upward drift
        This creates a Z-score > 1.8σ to trigger the alert
        """
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        
        # Generate 7 daily samples (morning readings)
        rhr_samples = []
        
        # Days 7-2: Baseline period with normal resting heart rate
        baseline_rhr = random.randint(60, 65)
        for i in range(6):
            sample_time = base_time - timedelta(days=(7-i))  # Days 7, 6, 5, 4, 3, 2
            variation = random.randint(-2, 2)
            rhr_samples.append({
                "timestamp": sample_time.isoformat(),
                "bpm": baseline_rhr + variation
            })
        
        # Day 1 (most recent): Elevated resting heart rate showing UPWARD DRIFT
        # This will trigger RestHeartRateDrift alert (Z-score > 1.8σ)
        recent_time = base_time  # Today's morning (most recent)
        elevated_rhr = random.randint(85, 95)  # Significantly higher than baseline
        rhr_samples.append({
            "timestamp": recent_time.isoformat(),
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
            "event_type": "vitals.heart_rate.resting.update",
            "loinc_code": "8418-4",
            "timestamp": base_time.isoformat()
        }
    
    def generate_min_heart_rate_bulk_event(self):
        """Minimum heart rate event - 8638-5"""
        user_id = '033114870'
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
            "event_type": "vitals.heart_rate.minimum.update",
            "loinc_code": "8638-5",
            "timestamp": base_time.isoformat()
        }
    
    def generate_max_heart_rate_bulk_event(self):
        """Maximum heart rate event - 8639-3"""
        user_id = '033114870'
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
            "event_type": "vitals.heart_rate.maximum.update",
            "loinc_code": "8639-3",
            "timestamp": base_time.isoformat()
        }
    
    def generate_afib_detection_bulk_event(self):
        """Atrial fibrillation detection event - 80358-0"""
        user_id = '033114870'
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
            "event_type": "vitals.atrial_fibrillation_detection.update",
            "loinc_code": "80358-0",
            "timestamp": base_time.isoformat()
        }
    
    # ============ ACTIVITY EVENTS WITH BULK DATA ============
    
    def generate_steps_bulk_event(self):
        """Steps event with hourly breakdown - 55411-3"""
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        total_steps = 0
        
        # Generate 24 hourly samples
        hourly_steps = []
        for i in range(24):
            hour_time = base_time - timedelta(hours=(24-i))
            hour_steps = random.randint(500, 3000)
            total_steps += hour_steps
            hourly_steps.append({
                "timestamp": hour_time.isoformat(),
                "hourly_steps": hour_steps
            })
        
        return {
            "user": {"user_id": f"user_{user_id}"},
            "data": {
                "steps_data": {
                    "summary": {
                        "total_steps": total_steps,
                        "daily_goal": 10000,
                        "goal_achieved": total_steps >= 10000
                    },
                    "detailed": {
                        "hourly_steps": hourly_steps
                    }
                }
            },
            "type": "activity",
            "event_type": "activity.steps.update",
            "loinc_code": "55411-3",
            "timestamp": base_time.isoformat()
        }
    
    def generate_calories_bulk_event(self):
        """Calories event with activity breakdown - 41981-2"""
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        total_calories = 0
        
        # Generate activity samples
        activities = ['walking', 'running', 'cycling', 'gym', 'rest']
        activity_samples = []
        
        for i in range(8):
            activity_time = base_time - timedelta(hours=(8-i)*3)
            activity = random.choice(activities)
            calories = random.randint(50, 300) if activity != 'rest' else random.randint(10, 30)
            total_calories += calories
            activity_samples.append({
                "timestamp": activity_time.isoformat(),
                "activity": activity,
                "calories_burned": calories
            })
        
        return {
            "user": {"user_id": f"user_{user_id}"},
            "data": {
                "calories_data": {
                    "summary": {
                        "total_calories_burned": total_calories,
                        "daily_goal": 2000
                    },
                    "detailed": {
                        "activity_samples": activity_samples
                    }
                }
            },
            "type": "activity",
            "event_type": "activity.calories.update",
            "loinc_code": "41981-2",
            "timestamp": base_time.isoformat()
        }
    
    def generate_distance_bulk_event(self):
        """Distance event with route data - 8466-5"""
        user_id = '033114869'
        base_time = datetime.now(timezone.utc)
        total_distance = 0
        
        # Generate route waypoints
        start_lat = random.uniform(-90, 90)
        start_lon = random.uniform(-180, 180)
        
        route_samples = []
        for i in range(15):
            sample_time = base_time - timedelta(minutes=(15-i)*4)
            distance_segment = round(random.uniform(0.1, 0.5), 2)
            total_distance += distance_segment
            
            route_samples.append({
                "timestamp": sample_time.isoformat(),
                "latitude": round(start_lat + random.uniform(-0.01, 0.01), 4),
                "longitude": round(start_lon + random.uniform(-0.01, 0.01), 4),
                "segment_distance_km": distance_segment
            })
        
        return {
            "user": {"user_id": f"user_{user_id}"},
            "data": {
                "distance_data": {
                    "summary": {"total_distance_km": round(total_distance, 2)},
                    "detailed": {
                        "route_samples": route_samples
                    }
                }
            },
            "type": "activity",
            "event_type": "activity.distance.update",
            "loinc_code": "8466-5",
            "timestamp": base_time.isoformat()
        }
    
    # ============ SLEEP EVENTS WITH BULK DATA ============
    
    def generate_sleep_bulk_event(self):
        """Sleep event with sleep stages - 93831-0"""
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        sleep_start = base_time - timedelta(hours=8)
        
        # Generate sleep stage samples (30-minute intervals)
        sleep_stages_enum = ['light', 'deep', 'rem', 'awake']
        sleep_stages = []
        
        for i in range(16):
            stage_time = sleep_start + timedelta(minutes=i*30)
            stage = random.choice(sleep_stages_enum)
            sleep_stages.append({
                "timestamp": stage_time.isoformat(),
                "stage": stage
            })
        
        return {
            "user": {"user_id": f"user_{user_id}"},
            "data": {
                "sleep_data": {
                    "summary": {
                        "total_sleep_minutes": 480,
                        "deep_sleep_minutes": random.randint(60, 120),
                        "rem_sleep_minutes": random.randint(60, 120),
                        "light_sleep_minutes": random.randint(200, 250),
                        "awake_minutes": random.randint(20, 50),
                        "sleep_quality_score": round(random.uniform(60, 95), 1)
                    },
                    "detailed": {
                        "sleep_stages": sleep_stages
                    }
                }
            },
            "type": "sleep",
            "event_type": "sleep.session.updated",
            "loinc_code": "93831-0",
            "timestamp": base_time.isoformat()
        }
    
    # ============ LOCATION EVENTS WITH BULK DATA ============
    
    def generate_location_bulk_event(self):
        """Location event with GPS track - 33018-7"""
        user_id = '033114870'
        base_time = datetime.now(timezone.utc)
        
        # Generate GPS track (1-minute intervals)
        start_lat = random.uniform(-90, 90)
        start_lon = random.uniform(-180, 180)
        
        gps_track = []
        for i in range(30):
            point_time = base_time - timedelta(minutes=(30-i))
            gps_track.append({
                "timestamp": point_time.isoformat(),
                "latitude": round(start_lat + random.uniform(-0.005, 0.005), 6),
                "longitude": round(start_lon + random.uniform(-0.005, 0.005), 6),
                "accuracy_meters": round(random.uniform(5, 20), 1),
                "altitude_meters": round(random.uniform(0, 500), 1)
            })
        
        return {
            "user": {"user_id": f"user_{user_id}"},
            "data": {
                "location_data": {
                    "summary": {
                        "start_latitude": start_lat,
                        "start_longitude": start_lon,
                        "current_latitude": gps_track[-1]['latitude'],
                        "current_longitude": gps_track[-1]['longitude']
                    },
                    "detailed": {
                        "gps_track": gps_track
                    }
                }
            },
            "type": "location",
            "event_type": "location.update",
            "loinc_code": "33018-7",
            "timestamp": base_time.isoformat()
        }
    
    def produce_event(self, event):
        """Publish event to Kafka topic"""
        try:
            self.producer.send(self.topic, value=event)
            user_id = event.get('user', {}).get('user_id', 'N/A')
            num_samples = self._count_samples(event)
            logger.info(f"[OK] {event['event_type']:45} | User: {user_id:10} | Samples: {num_samples:3} | LOINC: {event.get('loinc_code', 'N/A')}")
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
            # Vitals (13 types)
            self.generate_heart_rate_bulk_event,
            self.generate_blood_pressure_bulk_event,
            self.generate_oxygen_saturation_bulk_event,
            self.generate_respiration_rate_bulk_event,
            self.generate_body_temperature_bulk_event,
            self.generate_glucose_bulk_event,
            self.generate_heart_rate_variability_bulk_event,
            self.generate_diastolic_blood_pressure_bulk_event,
            self.generate_resting_heart_rate_bulk_event,
            self.generate_min_heart_rate_bulk_event,
            self.generate_max_heart_rate_bulk_event,
            self.generate_afib_detection_bulk_event,
            # Activity (3 types)
            self.generate_steps_bulk_event,
            self.generate_calories_bulk_event,
            self.generate_distance_bulk_event,
            # Sleep (1 type)
            self.generate_sleep_bulk_event,
            # Location (1 type)
            self.generate_location_bulk_event,
        ]
        
        start_time = datetime.now(timezone.utc)
        event_count = 0
        
        logger.info("=" * 120)
        logger.info(f"Starting Junction Event Producer Simulator")
        logger.info(f"Duration: {duration_seconds} seconds | Interval: {interval_seconds}s")
        logger.info(f"Total event types: 18 (13 Vitals + 3 Activity + 1 Sleep + 1 Location)")
        logger.info("=" * 120)
        
        while (datetime.now(timezone.utc) - start_time).total_seconds() < duration_seconds:
            event_generator = random.choice(event_generators)
            event = event_generator()
            self.produce_event(event)
            event_count += 1
            
            time.sleep(interval_seconds)
        
        self.producer.flush()
        logger.info("=" * 120)
        logger.info(f"[OK] Simulation complete. Total bulk events produced: {event_count}")
        logger.info("=" * 120)
        self.producer.close()


if __name__ == '__main__':
    producer = JunctionEventProducer(
        bootstrap_servers='localhost:9092',
        topic='junction-events'
    )
    producer.simulate_continuous_events(duration_seconds=600, interval_seconds=2)