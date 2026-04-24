#!/usr/bin/env python3
"""
ELM327 / SAE J1979 OBD-II Vehicle Telemetry Simulator
======================================================
Generates realistic ELM327-style OBD-II PID data for a simulated car
(HundayTuson 2016, VIN: KM8J33A41GU000001) and publishes it to the
iot-telemetry Kafka topic every 30 seconds as a single batch event.

Mirrors simulate_signalk_vessel.py in structure so the generic_telemetry_consumer
and azure-functions telemetry_engine can process it without modification
(SARJ1979Adapter handles parsing).

Payload format:
{
    "sourceDriver": "SARJ1979",
    "entityId": "<VIN>",
    "timestamp": "<ISO-8601 UTC>",
    "measurements": {
        "010C": 1250.5,   # Engine RPM
        "010D": 65.0,     # Vehicle Speed km/h
        ...
    },
    "metadata": {
        "protocol": "SARJ1979",
        "deviceId": "ELM327-BT-001",
        "vin": "<VIN>"
    }
}
"""

import json
import logging
import math
import random
import time
from datetime import datetime, timezone

from kafka import KafkaProducer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Vehicle identity — must match the Entity row seeded by migration 0040
# ---------------------------------------------------------------------------
VIN           = 'KM8J33A41GU000001'
DEVICE_ID     = 'ELM327-BT-001'
KAFKA_TOPIC   = 'iot-telemetry'
PUBLISH_INTERVAL_SEC = 30   # same cadence as simulate_signalk_vessel.py


# ---------------------------------------------------------------------------
# Simulated drive-cycle state machine
# ---------------------------------------------------------------------------
class DriveState:
    """Tracks a simple drive-cycle: idle → accelerate → cruise → decelerate → idle"""

    PHASES = ['idle', 'accelerating', 'cruising', 'decelerating']

    def __init__(self):
        self.phase         = 'idle'
        self.phase_ticks   = 0
        self.speed_kmh     = 0.0      # current speed
        self.rpm           = 800.0    # current RPM
        self.coolant_temp  = 20.0     # engine coolant °C (warms up over time)
        self.oil_temp      = 20.0     # engine oil °C
        self.fuel_level    = 75.0     # % (decreasing slowly)
        self.odometer_km   = 145_230  # km (increasing)
        self.run_time_sec  = 0
        self.tick          = 0

    def step(self):
        """Advance one 30-second step through the drive-cycle."""
        self.tick          += 1
        self.run_time_sec  += PUBLISH_INTERVAL_SEC
        self.phase_ticks   += 1

        # Transition phase roughly every 3-6 ticks (~90–180 s)
        phase_duration = random.randint(3, 6)
        if self.phase_ticks >= phase_duration:
            idx = self.PHASES.index(self.phase)
            self.phase       = self.PHASES[(idx + 1) % len(self.PHASES)]
            self.phase_ticks = 0

        # ── Speed ───────────────────────────────────────────────
        if self.phase == 'idle':
            self.speed_kmh = max(0.0, self.speed_kmh - random.uniform(5, 15))
        elif self.phase == 'accelerating':
            self.speed_kmh = min(130.0, self.speed_kmh + random.uniform(8, 20))
        elif self.phase == 'cruising':
            self.speed_kmh += random.uniform(-3.0, 3.0)
            self.speed_kmh  = max(40.0, min(130.0, self.speed_kmh))
        elif self.phase == 'decelerating':
            self.speed_kmh = max(0.0, self.speed_kmh - random.uniform(10, 25))

        # ── RPM ─────────────────────────────────────────────────
        if self.speed_kmh < 5:
            self.rpm = random.gauss(800, 30)
        else:
            # Simple proportional model + noise
            self.rpm = self.speed_kmh * 50 + random.gauss(0, 80)
            self.rpm = max(600, min(6500, self.rpm))

        # ── Temperatures ────────────────────────────────────────
        target_coolant = 92.0 if self.speed_kmh > 0 else 75.0
        self.coolant_temp += (target_coolant - self.coolant_temp) * 0.05 + random.uniform(-0.5, 0.5)
        self.coolant_temp  = max(15.0, min(115.0, self.coolant_temp))

        target_oil = self.coolant_temp + 10
        self.oil_temp += (target_oil - self.oil_temp) * 0.03 + random.uniform(-0.5, 0.5)
        self.oil_temp  = max(15.0, min(135.0, self.oil_temp))

        # ── Fuel ────────────────────────────────────────────────
        fuel_burn = (self.rpm / 6500) * 0.02    # very simplified
        self.fuel_level = max(0.0, self.fuel_level - fuel_burn)

        # ── Odometer ────────────────────────────────────────────
        self.odometer_km += self.speed_kmh * (PUBLISH_INTERVAL_SEC / 3600.0)


# ---------------------------------------------------------------------------
# PID generator
# ---------------------------------------------------------------------------
def generate_pids(state: DriveState) -> dict:
    """
    Return a dict of PID → value for the PIDs registered in EntityTypeAttribute.
    Only includes PIDs where the value is meaningful at this instant.
    Additional PIDs with sensor noise are included for realism.
    """
    speed      = round(state.speed_kmh, 1)
    rpm        = round(state.rpm, 0)
    engine_on  = rpm > 0

    # Throttle: derived from RPM and speed delta
    throttle = min(100.0, max(0.0, (rpm - 800) / 60.0 + random.uniform(-2, 2)))

    # MAF: rough model — g/s
    maf = round((rpm * 0.005 + speed * 0.02) * random.uniform(0.95, 1.05), 2)

    # Load: %
    engine_load = round(min(100.0, max(0.0, (rpm / 6500) * 100 + random.uniform(-3, 3))), 1)

    # Intake manifold pressure kPa
    map_kpa = round(40.0 + engine_load * 0.6 + random.gauss(0, 1), 1)

    # Intake air temperature (ambient-ish)
    iat = round(35.0 + random.gauss(0, 2), 1)

    # Timing advance degrees
    timing = round(15.0 + (engine_load / 10.0) * random.uniform(0.8, 1.2), 1)

    # Fuel rail pressure kPa
    fuel_rail_pressure = round(350.0 + random.gauss(0, 5), 1)

    # O2 sensor voltage (simple sine wave around stoich)
    o2_voltage = round(0.45 + 0.40 * math.sin(state.tick * 0.8), 3)

    # Fuel trim bank 1
    st_fuel_trim = round(random.gauss(1.0, 2.0), 1)
    lt_fuel_trim = round(random.gauss(0.0, 1.5), 1)

    # Commanded EGR
    egr = round(max(0.0, min(100.0, engine_load * 0.3 + random.gauss(0, 2))), 1)

    # Barometric pressure
    baro_kpa = round(101.3 + random.gauss(0, 0.2), 1)

    # Absolute throttle positions
    abs_throttle_b = round(throttle + random.uniform(-1, 1), 1)
    accel_pedal_d  = round(max(0.0, throttle - 5 + random.uniform(-2, 2)), 1)

    # Control module voltage
    module_voltage = round(14.2 + random.gauss(0, 0.1), 2)

    # Catalyst temperature
    cat_temp = round(state.coolant_temp * 5.5 + random.gauss(0, 10), 1)

    # Engine torque %
    engine_torque = round(engine_load * 0.9 + random.gauss(0, 2), 1)

    # Engine fuel rate L/h
    fuel_rate = round((rpm / 1000) * 0.6 + random.gauss(0, 0.1), 2)

    return {
        # -- Named OBD keys matching ELM327Driver.ts (obd.* format) --------
        'obd.engineRpm':         rpm,
        'obd.vehicleSpeed':      speed,
        'obd.coolantTemp':       round(state.coolant_temp, 1),
        'obd.throttlePos':       round(throttle, 1),
        'obd.fuelLevel':         round(state.fuel_level, 1),
        'obd.engineLoad':        engine_load,
        'obd.intakeAirTemp':     iat,
        'obd.mafRate':           maf,
        'obd.manifoldPressure':  map_kpa,
        'obd.timingAdvance':     timing,
        'obd.oilTemp':           round(state.oil_temp, 1),
        'obd.moduleVoltage':     module_voltage,
        'obd.fuelRate':          fuel_rate,
        'obd.accelPedalPos':     accel_pedal_d,
        # -- Extra PIDs (legacy hex format -- still stored via old 010x codes)
        '0106': st_fuel_trim,
        '0107': lt_fuel_trim,
        '010A': fuel_rail_pressure,
        '011F': state.run_time_sec,
        '012C': egr,
        '0133': baro_kpa,
        '0162': engine_torque,
        '0114': round(o2_voltage, 3),
        '0115': round(o2_voltage + random.uniform(-0.05, 0.05), 3),
    }


# ---------------------------------------------------------------------------
# Simulator class
# ---------------------------------------------------------------------------
class ELM327Simulator:
    def __init__(self, bootstrap_servers: str = 'localhost:9092', topic: str = KAFKA_TOPIC):
        self.topic  = topic
        self.state  = DriveState()
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                client_id='elm327-simulator-1',
            )
            logger.info(f"[ELM327] Connected to Kafka: {bootstrap_servers}")
        except Exception as e:
            logger.error(f"[ELM327] Failed to connect to Kafka: {e}")
            raise

    def build_event(self) -> dict:
        self.state.step()
        measurements = generate_pids(self.state)
        return {
            'sourceDriver': 'SARJ1979',
            'entityId':     VIN,
            'timestamp':    datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
            'measurements': measurements,
            'metadata': {
                'protocol': 'SARJ1979',
                'deviceId': DEVICE_ID,
                'vin':      VIN,
                'phase':    self.state.phase,
            },
        }

    def publish(self, event: dict) -> None:
        future = self.producer.send(self.topic, value=event)
        future.get(timeout=10)
        pid_count = len(event['measurements'])
        logger.info(
            f"[ELM327] Published | entity={event['entityId']} "
            f"phase={event['metadata']['phase']} "
            f"rpm={event['measurements'].get('obd.engineRpm')} "
            f"speed={event['measurements'].get('obd.vehicleSpeed')} km/h "
            f"pids={pid_count} | topic={self.topic}"
        )

    def run(self) -> None:
        logger.info(f"[ELM327] Starting simulation for VIN={VIN} → topic={self.topic}")
        logger.info(f"[ELM327] Publishing every {PUBLISH_INTERVAL_SEC}s. Press Ctrl+C to stop.")
        try:
            while True:
                event = self.build_event()
                self.publish(event)
                time.sleep(PUBLISH_INTERVAL_SEC)
        except KeyboardInterrupt:
            logger.info("[ELM327] Simulation stopped by user")
        finally:
            self.producer.flush()
            self.producer.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='ELM327 OBD-II Telemetry Simulator')
    parser.add_argument('--bootstrap-servers', default='localhost:9092',
                        help='Kafka bootstrap servers (default: localhost:9092)')
    parser.add_argument('--topic', default=KAFKA_TOPIC,
                        help=f'Kafka topic (default: {KAFKA_TOPIC})')
    parser.add_argument('--interval', type=int, default=PUBLISH_INTERVAL_SEC,
                        help=f'Publish interval in seconds (default: {PUBLISH_INTERVAL_SEC})')
    args = parser.parse_args()

    PUBLISH_INTERVAL_SEC = args.interval
    ELM327Simulator(bootstrap_servers=args.bootstrap_servers, topic=args.topic).run()
