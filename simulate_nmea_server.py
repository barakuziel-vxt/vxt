# python simulate_nmea_server.py --mode udp --target halos.local
"""
NMEA 0183 Simulator — TCP Server + UDP Sender
================================================
Acts as a virtual yacht instrument set, sending NMEA 0183 sentences
to the SignalK server for auto-translation into SignalK data paths.

Two modes:
  udp  — (default, recommended) Sends UDP datagrams TO the Pi.
         No firewall issues since traffic is outbound from PC.
  tcp  — Classic TCP server mode. SignalK connects as TCP client.
         Requires Windows Firewall rule for inbound connections.

Architecture (real yacht):
    Instruments → NMEA 0183 bus → SignalK server → REST API → VXT mobile

Architecture (simulator):
    This script → SignalK → REST API → VXT mobile

Usage:
    # UDP mode (recommended — works out of the box):
    python simulate_nmea_server.py --mode udp --target halos.local

    # TCP server mode (classic):
    python simulate_nmea_server.py --mode tcp --port 10113

SignalK Setup for UDP mode:
    1. Open https://halos.local:4430/admin/#/serverConfiguration/connections/-
    2. Add new connection:
         Data Type : NMEA 0183
         Method    : UDP
         Port      : 10113
    3. Apply → Restart

Simulated NMEA sentences (Navigation & Environment):
    $GPRMC  - GPS Position + SOG/COG (sailing along Haifa coast)
    $GPGGA  - GPS Fix — latitude, longitude, altitude
    $SDDBT  - Depth below transducer — 18.7m

Simulated NMEA Engine Monitoring Attributes:
    $YXXDR  - Engine RPM (1500-1900 RPM cruise range)
    $YXXDR  - Engine Oil Temperature (75±8°C)
    $YXXDR  - Engine Water Temperature (82±6°C)
    $YXXDR  - Engine Oil Pressure (45±10 PSI)
    $YXXDR  - Fuel Rate/Flow (10±6 L/h)
    $YXXDR  - Fuel Pressure (40±5 kPa)
    $YXXDR  - Alternator Output (13.8±0.4 V)
    $YXXDR  - Gearbox Oil Temperature (65±5°C)
    $YXXDR  - Engine Load (0-1.0 ratio)
    $YXXDR  - Exhaust Temperature (480±40°C)
    $YXXDR  - Engine Run Time (cumulative hours)
    $YXXDR  - Fuel Tank Level (60-70%)
    $YXXDR  - Fresh Water Tank Level (40-50%)
    $YXXDR  - Battery Voltage (12.8±0.5 V)
"""

import argparse
import math
import random
import socket
import sys
import threading
import time
from datetime import datetime, timezone

# ── Config ──────────────────────────────────────────────────────────────────

DEFAULT_PORT = 10113
DEFAULT_INTERVAL = 2  # seconds between sentence bursts

# Seconds to spend at each waypoint before advancing
WAYPOINT_STEP_SECONDS = 5

# Actual GPS trace of Haifa harbor (same route as simulate_signalk_vessel.py)
# Format: (lon, lat) — converted to {'lat', 'lon'} dicts below
_HAIFA_WAYPOINTS_RAW = [
    (35.0315595, 32.8059605), (35.0304437, 32.8062310), (35.0293064, 32.8064474),
    (35.0285125, 32.8068620), (35.0282979, 32.8081422), (35.0285983, 32.8089896),
    (35.0286241, 32.8099920), (35.0286026, 32.8109476), (35.0283666, 32.8117949),
    (35.0280018, 32.8124800), (35.0270791, 32.8132192), (35.0253754, 32.8148129),
    (35.0237875, 32.8157324), (35.0226631, 32.8162985), (35.0209465, 32.8170737),
    (35.0190582, 32.8179210), (35.0175991, 32.8195975), (35.0168052, 32.8210578),
    (35.0160456, 32.8266640), (35.0169253, 32.8272606), (35.0179768, 32.8281980),
    (35.0188136, 32.8297121), (35.0193071, 32.8312443), (35.0194144, 32.8321816),
    (35.0195217, 32.8333171), (35.0203028, 32.8335522), (35.0210752, 32.8337324),
    (35.0226631, 32.8338766), (35.0250235, 32.8339487), (35.0294867, 32.8334080),
    (35.0336065, 32.8323986), (35.0381985, 32.8308484), (35.0413227, 32.8315365),
    (35.0447559, 32.8339158), (35.0473566, 32.8399213), (35.0489445, 32.8434538),
    (35.0502491, 32.8553910), (35.0500774, 32.8629592), (35.0524978, 32.8816849),
    (35.0554676, 32.8922633), (35.0610294, 32.9014277), (35.0663509, 32.9054621),
    (35.0705566, 32.9092081), (35.0723848, 32.9119321), (35.0736294, 32.9143452),
    (35.0725393, 32.9161717), (35.0717669, 32.9171621), (35.0715737, 32.9176843),
    (35.0715308, 32.9183146), (35.0715051, 32.9186410), (35.0715373, 32.9191002),
    (35.0712905, 32.9194154), (35.0711226, 32.9195032), (35.0708544, 32.9195509),
    (35.0705084, 32.9196049), (35.0702444, 32.9196301), (35.0700572, 32.9195613),
    (35.0698748, 32.9194825),
]
HAIFA_ROUTE_WAYPOINTS = [{'lat': lat, 'lon': lon} for lon, lat in _HAIFA_WAYPOINTS_RAW]


# ── NMEA helpers ────────────────────────────────────────────────────────────

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


# ── Sentence generators ────────────────────────────────────────────────────

def generate_sentences(t: float) -> list:
    """Generate a realistic set of NMEA 0183 sentences for time offset t.

    All numeric values oscillate smoothly using sine waves to simulate
    a vessel underway along the coast with comprehensive engine monitoring.
    """
    now = datetime.now(timezone.utc)
    utc_time = now.strftime("%H%M%S.00")
    utc_date = now.strftime("%d%m%y")

    # Computed values
    # Position: follow actual Haifa harbor GPS trace, advancing one waypoint every WAYPOINT_STEP_SECONDS
    waypoint_idx = int(t / WAYPOINT_STEP_SECONDS) % len(HAIFA_ROUTE_WAYPOINTS)
    waypoint = HAIFA_ROUTE_WAYPOINTS[waypoint_idx]
    lat = waypoint['lat'] + random.uniform(-0.0002, 0.0002)
    lon = waypoint['lon'] + random.uniform(-0.0002, 0.0002)

    # Speed over ground (knots) and course over ground (degrees true)
    sog_knots = 5.5 + math.sin(t / 90) * 2.0 + math.sin(t / 30) * 0.5
    cog_deg = 45.0 + math.sin(t / 200) * 30.0 + math.cos(t / 80) * 10.0
    if cog_deg < 0:
        cog_deg += 360.0
    
    # Depth: 18.7m
    depth_m = 18.7 + math.sin(t / 180) * 0.3
    depth_ft = depth_m * 3.28084
    depth_fathom = depth_m * 0.546807
    
    # ─── ENGINE MONITORING ATTRIBUTES ───────────────────────────────────────
    # Base RPM around 1500 (idle) to 2500 (cruise)
    engine_rpm = 1500 + math.sin(t / 60) * 400
    
    # Total engine hours (cumulative, slow drift)
    engine_hours = 2450 + (t / 3600)  # increases by 1 hour every hour
    
    # Oil pressure: 45 PSI nominal, varies with RPM and load
    engine_oil_pressure_psi = 45 + math.sin(t / 60) * 10 + math.sin(t / 20) * 5
    
    # Oil temperature: 75°C nominal cruise, oscillates with load (K)
    engine_oil_temp_c = 75 + math.sin(t / 150) * 8
    engine_oil_temp_k = engine_oil_temp_c + 273.15
    
    # Water/coolant temperature: 82°C nominal, tight range (K)
    engine_water_temp_c = 82 + math.sin(t / 200) * 6
    engine_water_temp_k = engine_water_temp_c + 273.15
    
    # Fuel flow rate: 8-15 L/h depending on throttle/RPM
    fuel_rate_lh = 10.0 + math.sin(t / 80) * 4.0 + math.sin(t / 30) * 2.0
    
    # Fuel pressure: 35-45 kPa nominal
    fuel_pressure_kpa = 40 + math.sin(t / 120) * 5
    fuel_pressure_pa = fuel_pressure_kpa * 1000
    
    # Alternator output: 13.5-14.5 V nominal, dips when high load
    alternator_output_v = 13.8 + math.sin(t / 90) * 0.4
    
    # Gearbox oil temperature: 60-70°C (K)
    gearbox_oil_temp_c = 65 + math.sin(t / 180) * 5
    gearbox_oil_temp_k = gearbox_oil_temp_c + 273.15
    
    # Engine load: 0-1.0 (ratio), related to RPM and throttle
    engine_load = (engine_rpm - 1000) / 2000  # normalize to ~0-0.75
    engine_load = max(0, min(1.0, engine_load))
    
    # Exhaust temperature: 450-550°C at cruise (K)
    exhaust_temp_c = 480 + math.sin(t / 100) * 40
    exhaust_temp_k = exhaust_temp_c + 273.15
    
    # Fuel and water tank levels
    fuel_tank_pct = 65 + math.sin(t / 600) * 5  # 65% full
    water_tank_pct = 45 + math.sin(t / 800) * 3  # 45% full
    battery_voltage = 12.8 + math.sin(t / 180) * 0.5

    lat_nmea, ns = dd_to_nmea_lat(lat)
    lon_nmea, ew = dd_to_nmea_lon(lon)

    sentences = []

    # ── RMC - Recommended Minimum Navigation Information ─────────────────────
    # $GPRMC,hhmmss.ss,A,llll.llll,N,yyyyy.yyyy,E,sog,cog,ddmmyy,magvar,dir,mode
    rmc = "GPRMC,%s,A,%s,%s,%s,%s,%.1f,%.1f,%s,,,A" % (
        utc_time, lat_nmea, ns, lon_nmea, ew,
        sog_knots, cog_deg, utc_date
    )
    sentences.append(nmea(rmc))

    # ── GGA - GPS Fix Data ──────────────────────────────────────────────────
    # $GPGGA,hhmmss.ss,llll.llll,N,yyyyy.yyyy,E,fix,sats,hdop,alt,M,geoid,M,,
    altitude_m = 2.5 + math.sin(t / 300) * 0.5
    gga = "GPGGA,%s,%s,%s,%s,%s,1,09,0.9,%.1f,M,17.0,M,," % (
        utc_time, lat_nmea, ns, lon_nmea, ew, altitude_m
    )
    sentences.append(nmea(gga))

    # ── DBT - Depth Below Transducer ────────────────────────────────────────
    # $SDDBT,depth_ft,f,depth_m,M,depth_fathom,F
    # Depth: 18.7m
    dbt = "SDDBT,%.1f,f,%.1f,M,%.1f,F" % (depth_ft, depth_m, depth_fathom)
    sentences.append(nmea(dbt))

    # ── XDR - Engine RPM ────────────────────────────────────────────────────
    # $YXXDR,T,rpm,,EngineRPM → propulsion.main.revolutions
    xdr_rpm = "YXXDR,T,%.0f,,EngineRPM" % engine_rpm
    sentences.append(nmea(xdr_rpm))

    # ── XDR - Engine Hours (Run Time) ───────────────────────────────────────
    # $YXXDR,T,hours,,EngineHours → propulsion.main.runTime (as seconds)
    xdr_hours = "YXXDR,T,%.1f,,EngineHours" % engine_hours
    sentences.append(nmea(xdr_hours))

    # ── XDR - Engine Oil Pressure ──────────────────────────────────────────
    # $YXXDR,P,psi,B,OilPressure → propulsion.main.oilPressure
    xdr_oil = "YXXDR,P,%.1f,B,OilPressure" % engine_oil_pressure_psi
    sentences.append(nmea(xdr_oil))

    # ── XDR - Engine Oil Temperature ────────────────────────────────────────
    # $YXXDR,C,celsius,C,OilTemperature → propulsion.main.oilTemperature
    xdr_oil_temp = "YXXDR,C,%.1f,C,OilTemperature" % engine_oil_temp_c
    sentences.append(nmea(xdr_oil_temp))

    # ── XDR - Fuel Rate (Flow) ──────────────────────────────────────────────
    # $YXXDR,R,liter_per_hour,,FuelRate → propulsion.main.fuelRate
    xdr_fuel_rate = "YXXDR,R,%.2f,,FuelRate" % fuel_rate_lh
    sentences.append(nmea(xdr_fuel_rate))

    # ── XDR - Fuel Pressure ────────────────────────────────────────────────
    # $YXXDR,P,kPa,B,FuelPressure → propulsion.main.fuelPressure
    xdr_fuel_press = "YXXDR,P,%.1f,B,FuelPressure" % fuel_pressure_kpa
    sentences.append(nmea(xdr_fuel_press))

    # ── XDR - Alternator Output (Voltage) ───────────────────────────────────
    # $YXXDR,U,volts,V,AlternatorOutput → propulsion.main.alternatorOutput
    xdr_alt = "YXXDR,U,%.2f,V,AlternatorOutput" % alternator_output_v
    sentences.append(nmea(xdr_alt))

    # ── XDR - Gearbox Oil Temperature ───────────────────────────────────────
    # $YXXDR,C,celsius,C,GearboxOilTemp → propulsion.main.gearboxOilTemperature
    xdr_gearbox_temp = "YXXDR,C,%.1f,C,GearboxOilTemp" % gearbox_oil_temp_c
    sentences.append(nmea(xdr_gearbox_temp))

    # ── XDR - Engine Load (as ratio 0-1) ────────────────────────────────────
    # $YXXDR,R,ratio,,EngineLoad → propulsion.main.load
    xdr_load = "YXXDR,R,%.2f,,EngineLoad" % engine_load
    sentences.append(nmea(xdr_load))

    # ── XDR - Exhaust Temperature ───────────────────────────────────────────
    # $YXXDR,C,celsius,C,ExhaustTemp → propulsion.main.exhaustTemperature
    xdr_exhaust = "YXXDR,C,%.1f,C,ExhaustTemp" % exhaust_temp_c
    sentences.append(nmea(xdr_exhaust))

    # ── XDR - Fuel Tank Level ──────────────────────────────────────────────
    # $YXXDR,R,percent,,FuelLevel
    xdr_fuel_level = "YXXDR,R,%.1f,,FuelLevel" % fuel_tank_pct
    sentences.append(nmea(xdr_fuel_level))

    # ── XDR - Water Tank Level ─────────────────────────────────────────────
    # $YXXDR,R,percent,,WaterLevel
    xdr_water_level = "YXXDR,R,%.1f,,WaterLevel" % water_tank_pct
    sentences.append(nmea(xdr_water_level))

    # ── XDR - Battery Voltage ──────────────────────────────────────────────
    # $YXXDR,U,voltage,V,BatteryMain
    xdr_batt = "YXXDR,U,%.1f,V,BatteryMain" % battery_voltage
    sentences.append(nmea(xdr_batt))

    return sentences


# ── TCP Server ──────────────────────────────────────────────────────────────

clients: list = []
clients_lock = threading.Lock()


def handle_client(conn: socket.socket, addr: tuple):
    """Handle a connected client (SignalK server)."""
    print(f"  + Client connected: {addr[0]}:{addr[1]}")
    with clients_lock:
        clients.append(conn)

    try:
        # Keep connection alive, reading any data the client sends (usually none)
        conn.settimeout(1)
        while True:
            try:
                data = conn.recv(1024)
                if not data:
                    break
            except socket.timeout:
                continue
            except OSError:
                break
    except Exception:
        pass
    finally:
        with clients_lock:
            if conn in clients:
                clients.remove(conn)
        try:
            conn.close()
        except Exception:
            pass
        print(f"  - Client disconnected: {addr[0]}:{addr[1]}")


def broadcast(data: bytes):
    """Send data to all connected clients."""
    with clients_lock:
        dead = []
        for c in clients:
            try:
                c.sendall(data)
            except Exception:
                dead.append(c)
        for c in dead:
            clients.remove(c)
            try:
                c.close()
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(
        description="NMEA 0183 simulator — UDP sender or TCP server"
    )
    parser.add_argument(
        "--mode", choices=["udp", "tcp"], default="udp",
        help="udp = send to Pi (recommended), tcp = wait for Pi to connect (default: udp)",
    )
    parser.add_argument(
        "--target", default="halos.local",
        help="UDP target hostname/IP (default: halos.local)",
    )
    parser.add_argument(
        "--port", type=int, default=DEFAULT_PORT,
        help="Port number (default: %d)" % DEFAULT_PORT,
    )
    parser.add_argument(
        "--interval", type=float, default=DEFAULT_INTERVAL,
        help="Seconds between NMEA bursts (default: %s)" % DEFAULT_INTERVAL,
    )
    parser.add_argument(
        "--bind", default="0.0.0.0",
        help="IP to bind to in TCP mode (default: 0.0.0.0)",
    )
    args = parser.parse_args()

    if args.mode == "udp":
        run_udp_sender(args)
    else:
        run_tcp_server(args)


def run_udp_sender(args):
    """Send NMEA sentences via UDP to the SignalK server."""
    # Resolve target
    try:
        target_ip = socket.gethostbyname(args.target)
    except socket.gaierror:
        print(f"ERROR: Cannot resolve '{args.target}'. Check hostname/IP.")
        sys.exit(1)

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    print("=" * 64)
    print("  VXT / YachtSense AI — NMEA 0183 UDP Sender")
    print("=" * 64)
    print(f"  Target : {args.target} ({target_ip}:{args.port})")
    print(f"  Interval: {args.interval}s (22 NMEA sentences per burst)")
    print()
    print("  Transmitted Attributes:")
    print("  ──────────────────────")
    print("  Navigation: Position + SOG/COG (RMC), GPS Fix (GGA), Depth (DBT)")
    print("  Propulsion: RPM, Fuel Rate, Oil/Water/Exhaust Temps,")
    print("              Oil/Fuel Pressure, Alternator, Gearbox Temp, Load, Runtime")
    print("  Tanks: Fuel Level, Fresh Water Level")
    print("  Electrical: Battery Voltage")
    print()
    print("  SignalK Setup (one-time):")
    print("  ─────────────────────────")
    print(f"  1. Open https://halos.local:4430 → Data Connections")
    print(f"  2. Add: NMEA 0183 / UDP / Port {args.port}")
    print(f"  3. Apply → Restart")
    print("=" * 64)
    print()

    t0 = time.time()
    burst_count = 0

    try:
        while True:
            t = time.time() - t0
            sentences = generate_sentences(t)
            # Send each sentence as a separate UDP datagram
            for sentence in sentences:
                sock.sendto(sentence.encode("ascii"), (target_ip, args.port))
            burst_count += 1

            # Extract computed values for display
            waypoint_idx = int(t / WAYPOINT_STEP_SECONDS) % len(HAIFA_ROUTE_WAYPOINTS)
            wp = HAIFA_ROUTE_WAYPOINTS[waypoint_idx]
            lat_disp = wp['lat']
            lon_disp = wp['lon']
            sog = 5.5 + math.sin(t / 90) * 2.0
            depth = 18.7 + math.sin(t / 180) * 0.3
            rpm = 1500 + math.sin(t / 60) * 400
            fuel_rate = 10.0 + math.sin(t / 80) * 4.0 + math.sin(t / 30) * 2.0
            oil_temp = 75 + math.sin(t / 150) * 8
            water_temp = 82 + math.sin(t / 200) * 6
            ts = datetime.now().strftime("%H:%M:%S")

            print(
                f"  [{ts}] #{burst_count:>4d}  "
                f"Pos={lat_disp:.4f},{lon_disp:.4f}  SOG={sog:.1f}kn  "
                f"RPM={rpm:.0f}  FuelRate={fuel_rate:.1f}L/h  "
                f"OilTemp={oil_temp:.0f}°C  WaterTemp={water_temp:.0f}°C  "
                f"→ {args.target}:{args.port} ({len(sentences)} sentences)"
            )

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print(f"\nStopped. Sent {burst_count} UDP bursts total.")
    finally:
        sock.close()


def run_tcp_server(args):
    """Classic TCP server mode — SignalK connects as TCP client."""
    # Get local IP for display
    local_ip = "?"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    print("=" * 64)
    print("  VXT / YachtSense AI — NMEA 0183 TCP Server Simulator")
    print("=" * 64)
    print(f"  Listen : {args.bind}:{args.port}")
    print(f"  LAN IP : {local_ip}")
    print(f"  Interval: {args.interval}s (22 NMEA sentences per burst)")
    print()
    print("  Transmitted Attributes:")
    print("  ──────────────────────")
    print("  Navigation: Position + SOG/COG (RMC), GPS Fix (GGA), Depth (DBT)")
    print("  Propulsion: RPM, Fuel Rate, Oil/Water/Exhaust Temps,")
    print("              Oil/Fuel Pressure, Alternator, Gearbox Temp, Load, Runtime")
    print("  Tanks: Fuel Level, Fresh Water Level")
    print("  Electrical: Battery Voltage")
    print()
    print("  SignalK Setup (one-time):")
    print("  ─────────────────────────")
    print(f"  1. Open http://halos.local:3000 in a browser")
    print(f"  2. Login or create admin account")
    print(f"  3. Go to: Server → Data Connections → Add")
    print(f"  4. Settings:")
    print(f"       Data Type : NMEA 0183")
    print(f"       Method    : TCP (client)")
    print(f"       Host      : {local_ip}")
    print(f"       Port      : {args.port}")
    print(f"  5. Click Apply → Restart")
    print("=" * 64)
    print()

    # Start TCP server
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((args.bind, args.port))
    srv.listen(5)
    print(f"Listening on {args.bind}:{args.port}...")
    print("Waiting for SignalK server to connect...")
    print()

    # Accept clients in background threads
    def accept_loop():
        while True:
            try:
                conn, addr = srv.accept()
                t = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
                t.start()
            except OSError:
                break

    accept_thread = threading.Thread(target=accept_loop, daemon=True)
    accept_thread.start()

    # Main loop: generate and broadcast NMEA sentences
    t0 = time.time()
    burst_count = 0

    try:
        while True:
            t = time.time() - t0
            sentences = generate_sentences(t)
            payload = "".join(sentences)

            n_clients = len(clients)
            if n_clients > 0:
                broadcast(payload.encode("ascii"))
                burst_count += 1

                # Show summary of engine monitoring values
                rpm = 1500 + math.sin(t / 60) * 400
                fuel_rate = 10.0 + math.sin(t / 80) * 4.0 + math.sin(t / 30) * 2.0
                oil_temp = 75 + math.sin(t / 150) * 8
                water_temp = 82 + math.sin(t / 200) * 6
                oil_pressure_psi = 45 + math.sin(t / 60) * 10 + math.sin(t / 20) * 5
                ts = datetime.now().strftime("%H:%M:%S")

                print(
                    f"  [{ts}] #{burst_count:>4d}  "
                    f"RPM={rpm:.0f}  FuelRate={fuel_rate:.1f}L/h  "
                    f"OilTemp={oil_temp:.0f}°C  WaterTemp={water_temp:.0f}°C  "
                    f"OilPres={oil_pressure_psi:.0f}psi  "
                    f"({len(sentences)} sentences → {n_clients} client{'s' if n_clients != 1 else ''})"
                )
            else:
                if burst_count == 0 and int(t) % 5 == 0:
                    sys.stdout.write("\r  Waiting for SignalK to connect...  (%ds)" % int(t))
                    sys.stdout.flush()

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print()
        print(f"\nStopped. Sent {burst_count} NMEA bursts total.")
    finally:
        srv.close()


if __name__ == "__main__":
    main()
