#!/usr/bin/env python3
# Run all scenarios (default)
#python simulate_nmea_events.py --target halos.local

# Run just oil pressure alarms
#python simulate_nmea_events.py --target halos.local --scenario oil_pressure

# Run just geofence violations
#python simulate_nmea_events.py --target halos.local --scenario geofence

# Run oscillation test for 60 seconds
#python simulate_nmea_events.py --target halos.local --scenario oscillation --duration 60

"""
Simulate NMEA Events – Alarm Threshold & Geofence Violations
=============================================================
Sends NMEA 0183 sentences via UDP to trigger:
  1. Oil pressure threshold crossings (score 0-3)
  2. Geofence entry/exit violations
  3. Alarm notifications

Usage:
    python simulate_nmea_events.py --target halos.local --scenario oil_pressure
    python simulate_nmea_events.py --target halos.local --scenario geofence
    python simulate_nmea_events.py --target halos.local --scenario all

SignalK must have UDP connection configured on port 10113:
    1. https://halos.local:4430/admin/#/serverConfiguration/connections/-
    2. Add: Data Type=NMEA 0183, Method=UDP, Port=10113
    3. Apply → Restart
"""

import argparse
import asyncio
import logging
import socket
import sys
from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("simulate_nmea_events")

# UDP port for NMEA sentences (must match SignalK UDP connection)
NMEA_UDP_PORT = 10113

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────
class Config:
    def __init__(self, target: str = "localhost"):
        self.target = target
        self.port = NMEA_UDP_PORT

# Thresholds for oil pressure alarm (Pa)
OIL_PRESSURE_THRESHOLDS = [
    {"min": 0, "max": 2499, "score": 0, "label": "Normal"},
    {"min": 2500, "max": 2799, "score": 1, "label": "Caution"},
    {"min": 2800, "max": 3199, "score": 2, "label": "Warning"},
    {"min": 3200, "max": 4099, "score": 3, "label": "Emergency"},
]

# Base coordinates: Haifa port (south end of harbor trace, in water)
BASE_LAT = 32.8060
BASE_LON = 35.0316

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions – NMEA 0183
# ─────────────────────────────────────────────────────────────────────────────


def nmea_checksum(sentence: str) -> str:
    """XOR checksum of all characters between $ and * (exclusive)."""
    ck = 0
    for ch in sentence:
        ck ^= ord(ch)
    return "%02X" % ck


def nmea(body: str) -> str:
    """Wrap an NMEA body into a full sentence with $ prefix and *checksum."""
    return "$" + body + "*" + nmea_checksum(body) + "\r\n"


def dd_to_nmea_lat(dd: float) -> tuple:
    """Convert decimal degrees latitude to NMEA format (DDMM.MMMM, N/S)."""
    ns = "N" if dd >= 0 else "S"
    dd = abs(dd)
    deg = int(dd)
    minutes = (dd - deg) * 60
    return "%02d%07.4f" % (deg, minutes), ns


def dd_to_nmea_lon(dd: float) -> tuple:
    """Convert decimal degrees longitude to NMEA format (DDDMM.MMMM, E/W)."""
    ew = "E" if dd >= 0 else "W"
    dd = abs(dd)
    deg = int(dd)
    minutes = (dd - deg) * 60
    return "%03d%07.4f" % (deg, minutes), ew


def create_engine_temperature_nmea(temp_celsius: float) -> list[str]:
    """Create NMEA XDR sentence for engine coolant temperature (Celsius).

    SignalK XDR plugin maps transducer name 'EngineTemp' →
    propulsion.main.temperature (converted to Kelvin by SignalK).
    """
    sentence = "YXXDR,C,%.1f,C,EngineTemp" % temp_celsius
    return [nmea(sentence)]


def send_nmea_sentences(config: Config, sentences: list[str]) -> bool:
    """Send NMEA sentences via UDP to SignalK."""
    try:
        # Try to resolve hostname first
        resolved_ip = socket.gethostbyname(config.target)
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        for sentence in sentences:
            sock.sendto(sentence.encode("utf-8"), (resolved_ip, config.port))
        sock.close()
        return True
    except OSError as e:
        # Try IPv6 fallback
        try:
            sock = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
            for sentence in sentences:
                sock.sendto(sentence.encode("utf-8"), (config.target, config.port))
            sock.close()
            return True
        except Exception as e2:
            log.error("✗ Failed to send NMEA sentences: %s (fallback: %s)", e, e2)
            return False


def create_oil_pressure_nmea(pressure_pa: float) -> list[str]:
    """Create NMEA XDR sentence for oil pressure (in Pa)."""
    # Convert Pa to PSI for NMEA (1 PSI ≈ 6894.76 Pa)
    pressure_psi = pressure_pa / 6894.76
    sentence = "YXXDR,P,%.1f,B,OilPressure" % pressure_psi
    return [nmea(sentence)]


def create_oil_pressure_nmea(pressure_pa: float) -> list[str]:
    """Create NMEA XDR sentence for oil pressure (in Pa)."""
    # Convert Pa to PSI for NMEA (1 PSI ≈ 6894.76 Pa)
    pressure_psi = pressure_pa / 6894.76
    sentence = "YXXDR,P,%.1f,B,OilPressure" % pressure_psi
    return [nmea(sentence)]


def create_position_nmea(latitude: float, longitude: float) -> list[str]:
    """Create NMEA RMC sentence for position."""
    lat_str, lat_dir = dd_to_nmea_lat(latitude)
    lon_str, lon_dir = dd_to_nmea_lon(longitude)
    
    # $GPRMC,time,status,lat,lat_dir,lon,lon_dir,sog,cog,date,mag_var,mag_var_dir
    # Using dummy values for time, SOG, COG, date
    timestamp = datetime.now(timezone.utc)
    time_str = timestamp.strftime("%H%M%S")
    date_str = timestamp.strftime("%d%m%y")
    
    rmc = "GPRMC,%s,A,%s,%s,%s,%s,0.0,0.0,%s,,,A" % (
        time_str, lat_str, lat_dir, lon_str, lon_dir, date_str
    )
    return [nmea(rmc)]


# ─────────────────────────────────────────────────────────────────────────────
# Event Simulation Scenarios
# ─────────────────────────────────────────────────────────────────────────────


async def scenario_oil_pressure_threshold(config: Config) -> None:
    """Simulate oil pressure rising through all thresholds."""
    log.info("\n🔧 SCENARIO: Oil Pressure Threshold Crossings")
    log.info("=" * 60)

    values = [
        (1500, "Normal (score 0)"),
        (2600, "Caution (score 1)"),
        (2900, "Warning (score 2)"),
        (3500, "Emergency (score 3)"),
        (2000, "Back to Normal"),
    ]

    for val, label in values:
        sentences = create_oil_pressure_nmea(val)
        send_nmea_sentences(config, sentences)
        log.info(f"  → Oil Pressure: {val} Pa – {label}")
        await asyncio.sleep(3)


async def scenario_geofence_haifa_entry_exit(config: Config) -> None:
    """Simulate entering and exiting the Haifa port restricted zone."""
    log.info("\n🗺️ SCENARIO: Geofence Entry/Exit – Haifa Port")
    log.info("=" * 60)

    positions = [
        (32.8629, 35.0501, "Open bay — outside Haifa port"),
        (32.8297, 35.0188, "Approaching Haifa harbor entrance"),
        (32.8339, 35.0251, "Inside Haifa harbor"),
        (32.8629, 35.0501, "Departing — back to open bay"),
    ]

    for lat, lon, label in positions:
        sentences = create_position_nmea(lat, lon)
        send_nmea_sentences(config, sentences)
        log.info(f"  → Position: {lat:.4f}°N, {lon:.4f}°E – {label}")
        await asyncio.sleep(3)


async def scenario_combined_emergency(config: Config) -> None:
    """Simulate combined emergency: oil pressure spike + geofence entry."""
    log.info("\n🚨 SCENARIO: Combined Emergency – High Oil Pressure in Restricted Zone")
    log.info("=" * 60)

    log.info("  [1/4] Normal operations…")
    send_nmea_sentences(config, create_oil_pressure_nmea(2000))
    send_nmea_sentences(config, create_position_nmea(32.8629, 35.0501))
    await asyncio.sleep(2)

    log.info("  [2/4] Vessel moving toward Haifa port…")
    send_nmea_sentences(config, create_position_nmea(32.8297, 35.0188))
    await asyncio.sleep(2)

    log.info("  [3/4] Oil pressure rising (Warning level)…")
    send_nmea_sentences(config, create_oil_pressure_nmea(2900))
    await asyncio.sleep(2)

    log.info("  [4/4] Oil pressure CRITICAL in restricted zone!")
    send_nmea_sentences(config, create_oil_pressure_nmea(3600))
    await asyncio.sleep(2)

    log.info("  ⚠️  ALARM: High oil pressure + Geofence violation!")


async def scenario_continuous_oscillation(config: Config, duration_seconds: int = 120) -> None:
    """Simulate continuous pressure oscillation to trigger repeated alarms."""
    log.info(f"\n📈 SCENARIO: Continuous Pressure Oscillation ({duration_seconds}s)")
    log.info("=" * 60)

    start = datetime.now(timezone.utc)
    cycle = 0

    while (datetime.now(timezone.utc) - start).total_seconds() < duration_seconds:
        cycle += 1
        # Oscillate between normal and warning
        values = [
            (2200, "Normal (score 0)"),
            (2700, "Caution (score 1)"),
            (2950, "Warning (score 2)"),
            (2400, "Back to Caution"),
            (2100, "Back to Normal"),
        ]

        for val, label in values:
            send_nmea_sentences(config, create_oil_pressure_nmea(val))
            log.info(f"  Cycle {cycle}: {val} Pa – {label}")
            await asyncio.sleep(2)

            remaining = duration_seconds - (datetime.now(timezone.utc) - start).total_seconds()
            if remaining <= 0:
                break


async def scenario_multi_alert_oscillation(config: Config, duration_seconds: int = 60) -> None:
    """Simulate continuous oscillation of MULTIPLE alert types (oil pressure, engine temp, geofence)
    to verify TTS triggers for all alert states. Each cycle alternates through different alert types."""
    log.info(f"\n🚨 SCENARIO: Multi-Alert Oscillation – All Alert Types ({duration_seconds}s)")
    log.info("=" * 60)

    # Geofence coordinates
    OUTSIDE_LAT, OUTSIDE_LON = 32.8629, 35.0501  # Outside restricted zone
    INSIDE_LAT, INSIDE_LON = 32.844, 35.022      # Inside Haifa port geofence

    start = datetime.now(timezone.utc)
    cycle = 0

    while (datetime.now(timezone.utc) - start).total_seconds() < duration_seconds:
        cycle += 1
        
        # === OIL PRESSURE WARN/NORMAL ===
        log.info(f"  Cycle {cycle} [Oil Pressure]: Warn → Normal")
        send_nmea_sentences(config, create_oil_pressure_nmea(2950))  # Warning (should trigger TTS)
        log.info(f"    → {2950} Pa (Warn) — TTS should announce alert")
        await asyncio.sleep(2)
        
        send_nmea_sentences(config, create_oil_pressure_nmea(2100))  # Normal (should clear alert)
        log.info(f"    → {2100} Pa (Normal) — TTS alert cleared")
        await asyncio.sleep(2)

        remaining = duration_seconds - (datetime.now(timezone.utc) - start).total_seconds()
        if remaining <= 0:
            break

        # === ENGINE TEMPERATURE WARN/NORMAL ===
        log.info(f"  Cycle {cycle} [Engine Temp]: Warn → Normal")
        send_nmea_sentences(config, create_engine_temperature_nmea(90.0))  # Emergency (should trigger TTS)
        log.info(f"    → 90°C (Emergency) — TTS should announce alert")
        await asyncio.sleep(2)

        send_nmea_sentences(config, create_engine_temperature_nmea(72.0))  # Normal (should clear alert)
        log.info(f"    → 72°C (Normal) — TTS alert cleared")
        await asyncio.sleep(2)

        remaining = duration_seconds - (datetime.now(timezone.utc) - start).total_seconds()
        if remaining <= 0:
            break

        # === GEOFENCE ENTRY/EXIT ===
        log.info(f"  Cycle {cycle} [Geofence]: Entry → Exit")
        send_nmea_sentences(config, create_position_nmea(INSIDE_LAT, INSIDE_LON))  # Inside (alarm)
        log.info(f"    → Inside Haifa port (alarm) — TTS should announce alert")
        await asyncio.sleep(2)

        send_nmea_sentences(config, create_position_nmea(OUTSIDE_LAT, OUTSIDE_LON))  # Outside (normal)
        log.info(f"    → Outside restricted zone (normal) — TTS alert cleared")
        await asyncio.sleep(2)

    log.info(f"  ✓ Multi-alert oscillation complete — you should have heard TTS for all 3 alert types")


async def scenario_timed_restricted_zone(config: Config, hold_seconds: int = 60) -> None:
    """Simulate entering a restricted polygon, staying for *hold_seconds*,
    then exiting.  Designed to verify:
      1. vxt-nodered forwards one EMERGENCY/ALARM event to vxt-orchestrator
         as soon as the vessel enters the zone.
      2. After exit, one NORMAL event is forwarded.
    """
    log.info("\n🚫 SCENARIO: Timed Restricted Zone — Haifa Port")
    log.info("=" * 60)

    # Coordinates clearly outside the fence (open bay north of harbor)
    OUTSIDE_LAT, OUTSIDE_LON = 32.8629, 35.0501
    # Centroid of the Haifa port restricted polygon
    # Polygon vertices (lat): 32.8385, 32.8377, 32.8516, 32.8532, 32.8388
    # → centroid ≈ lat 32.844, lon 35.022 — clearly inside
    INSIDE_LAT, INSIDE_LON = 32.844, 35.022

    log.info("  [1/3] Vessel in open water (outside restricted zone)…")
    send_nmea_sentences(config, create_position_nmea(OUTSIDE_LAT, OUTSIDE_LON))
    await asyncio.sleep(3)

    log.info("  [2/3] Vessel entering restricted zone — Haifa Port! Holding %ds…", hold_seconds)
    start = datetime.now(timezone.utc)
    first = True
    while (datetime.now(timezone.utc) - start).total_seconds() < hold_seconds:
        send_nmea_sentences(config, create_position_nmea(INSIDE_LAT, INSIDE_LON))
        elapsed = int((datetime.now(timezone.utc) - start).total_seconds())
        if first:
            log.info(
                "  ⚠️  ALARM expected → vxt-nodered should announce 'Restricted Area Haifa Port' in TTS loop"
            )
            first = False
        else:
            log.info("  → Still inside restricted zone (%ds / %ds)…", elapsed, hold_seconds)
        await asyncio.sleep(2)

    log.info("  [3/3] Vessel exiting restricted zone — returning to open water…")
    send_nmea_sentences(config, create_position_nmea(OUTSIDE_LAT, OUTSIDE_LON))
    log.info("  ✓ NORMAL event expected → TTS loop should stop, one 'normal' alert forwarded")
    await asyncio.sleep(4)


async def scenario_engine_temperature_threshold(config: Config, alert_hold_seconds: int = 60) -> None:
    """Simulate engine coolant temperature crossing an alarm threshold and
    returning to normal.  Designed to verify:
      1. vxt-nodered forwards one ALARM/EMERGENCY event when temp rises.
      2. vxt-nodered forwards one NORMAL event when temp returns to safe range.
    """
    log.info("\n🌡️ SCENARIO: Engine Temperature Threshold Crossing")
    log.info("=" * 60)

    # Twin thresholds: 0-80°C → score 0 (normal), 81-500°C → score 3 (emergency)
    # SignalK stores temperature in Kelvin; main.py converts zones to Kelvin on write.
    steps = [
        (75.0,  "Normal: 75°C — below threshold (score 0, state normal)", 3),
        (90.0,  "EMERGENCY: 90°C — above 81°C threshold (score 3)", 3),
        (105.0, "EMERGENCY: 105°C — dangerously overheating (score 3, hold for loop playback)", alert_hold_seconds),
        (72.0,  "NORMAL: 72°C — cooled below 80°C threshold → alarm clears", 3),
    ]

    for temp, label, wait_seconds in steps:
        sentences = create_engine_temperature_nmea(temp)
        ok = send_nmea_sentences(config, sentences)
        if ok:
            log.info("  → Engine temp: %.1f °C – %s", temp, label)
        await asyncio.sleep(wait_seconds)

    log.info("  ✓ Threshold crossing complete — NORMAL event expected from vxt-orchestrator")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────


async def main():
    parser = argparse.ArgumentParser(
        description="Simulate NMEA Events (Alarms & Geofences) on Raspberry Pi"
    )
    parser.add_argument(
        "--target",
        default="halos.local",
        help="Target hostname or IP (default: halos.local)",
    )
    parser.add_argument(
        "--scenario",
        choices=[
            "oil_pressure", "geofence", "combined", "oscillation", "multi_alert_oscillation",
            "restricted_zone", "engine_temp", "all",
        ],
        default="all",
        help="Which scenario to run (default: all)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=60,
        help="Duration for oscillation scenario in seconds (default: 120)",
    )
    parser.add_argument(
        "--hold",
        type=int,
        default=60,
        help="Seconds to hold inside restricted zone (default: 60)",
    )
    parser.add_argument(
        "--alert-hold",
        type=int,
        default=60,
        help="Seconds to keep alert state active for looping TTS tests (default: 60)",
    )

    args = parser.parse_args()
    config = Config(target=args.target)

    log.info("=" * 80)
    log.info("NMEA EVENT SIMULATOR – Alarm Thresholds & Geofence Violations")
    log.info("=" * 80)
    log.info(f"Target: {config.target}:{config.port} (UDP NMEA)")
    log.info(f"Scenario: {args.scenario}")
    log.info("")

    try:
        if args.scenario in ["oil_pressure", "all"]:
            await scenario_oil_pressure_threshold(config)

        if args.scenario in ["geofence", "all"]:
            await scenario_geofence_haifa_entry_exit(config)

        if args.scenario in ["combined", "all"]:
            await scenario_combined_emergency(config)

        if args.scenario in ["oscillation", "all"]:
            await scenario_continuous_oscillation(config, args.duration)

        if args.scenario in ["multi_alert_oscillation", "all"]:
            await scenario_multi_alert_oscillation(config, args.duration)

        if args.scenario in ["restricted_zone", "all"]:
            await scenario_timed_restricted_zone(config, hold_seconds=args.hold)

        if args.scenario in ["engine_temp", "all"]:
            await scenario_engine_temperature_threshold(config, alert_hold_seconds=args.alert_hold)

        log.info("\n" + "=" * 80)
        log.info("✓ All scenarios completed!")
        log.info("=" * 80)

    except KeyboardInterrupt:
        log.info("\n⚠️  Interrupted by user")
        sys.exit(0)
    except Exception as e:
        log.error(f"\n❌ Error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
