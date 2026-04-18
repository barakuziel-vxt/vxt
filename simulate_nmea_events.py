#!/usr/bin/env python3
# Run all scenarios (default)
#python simulate_nmea_events.py --target halos.local

# Run just oil pressure alarms
#python simulate_nmea_events.py --target halos.local --scenario oil_pressure

# Run just geofence violations
#python simulate_nmea_events.py --target halos.local --scenario geofence

# Run oscillation test for 30 seconds
#python simulate_nmea_events.py --target halos.local --scenario oscillation --duration 30

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

# Base coordinates: Haifa port
BASE_LAT = 32.8256
BASE_LON = 35.0204

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
        (32.860, 35.000, "Outside Haifa port"),
        (32.8440, 35.0215, "Entering Haifa port"),  # Inside polygon center
        (32.8450, 35.0300, "Deep inside Haifa port"),  # Still inside polygon
        (32.860, 35.000, "Exiting Haifa port"),
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
    send_nmea_sentences(config, create_position_nmea(32.860, 35.000))
    await asyncio.sleep(2)

    log.info("  [2/4] Vessel moving toward Haifa port…")
    send_nmea_sentences(config, create_position_nmea(32.8440, 35.0215))
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
        choices=["oil_pressure", "geofence", "combined", "oscillation", "all"],
        default="all",
        help="Which scenario to run (default: all)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=120,
        help="Duration for oscillation scenario in seconds (default: 120)",
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
