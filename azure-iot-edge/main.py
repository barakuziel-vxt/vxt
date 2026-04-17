"""
VXT Orchestrator – Azure IoT Edge Module (Raspberry Pi 5)
=========================================================
Responsibilities:
  1. Twin Sync         – listen for desired-property patches from Azure
  2. InfluxDB Filter   – POST allow_paths to local SignalK/InfluxDB plugin
  3. Alarm Translator  – convert generic AttributeScore → SignalK alarm zones
  4. Bulk Telemetry    – tiered interval GET from SignalK History API → Azure
  5. Real-Time Deadband – WebSocket subscription with configurable deadbands
"""

import asyncio
import copy
import json
import logging
import os
import signal
import sys
from datetime import datetime, timezone, timedelta

import requests
import websockets
from azure.iot.device.aio import IoTHubModuleClient, IoTHubDeviceClient

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("vxt-orchestrator")

# ---------------------------------------------------------------------------
# Global in-RAM twin state
# ---------------------------------------------------------------------------
vxt_config: dict = {}
last_sent_values: dict[str, float] = {}
_last_influx_filter_paths: set[str] = set()  # avoid plugin restart on unchanged config

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
SIGNALK_BASE = os.getenv("SIGNALK_BASE_URL", "http://localhost:3000")
SIGNALK_WS = os.getenv(
    "SIGNALK_WS_URL",
    SIGNALK_BASE.replace("http", "ws", 1) + "/signalk/v1/stream?subscribe=none",
)
SIGNALK_TOKEN = os.getenv("SIGNALK_TOKEN", "")
SK_HEADERS: dict[str, str] = (
    {"Authorization": f"Bearer {SIGNALK_TOKEN}"} if SIGNALK_TOKEN else {}
)
WS_RECONNECT_DELAY = 5  # seconds between WebSocket reconnect attempts


def deep_merge(base: dict, patch: dict) -> dict:
    """Recursively merge *patch* into *base* (mutates base)."""
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_merge(base[key], value)
        else:
            base[key] = copy.deepcopy(value)
    return base


# VXT score (0-3) → SignalK alarm state
_SCORE_TO_STATE = {
    0: "normal",
    1: "warn",
    2: "alarm",
    3: "emergency",
}


def _sk_path_to_url(sk_path: str) -> str:
    """Convert dot-notation SignalK path to URL segment.
    e.g. 'propulsion.main.temperature' → 'propulsion/main/temperature'
    """
    return sk_path.replace(".", "/")


# Known SignalK leaf-value segments that sit below the measurement level.
_VALUE_SEGMENTS = {"value", "latitude", "longitude", "altitude"}


def _to_measurement_path(path: str) -> str:
    """Truncate a deep value path to the SignalK measurement level.

    e.g. 'navigation.position.value.latitude' → 'navigation.position'
         'electrical.batteries.main.voltage'   → 'electrical.batteries.main.voltage'
    """
    parts = path.split(".")
    # Walk backward and strip known value-level segments
    while len(parts) > 1 and parts[-1] in _VALUE_SEGMENTS:
        parts.pop()
    return ".".join(parts)


# ---------------------------------------------------------------------------
# Local API functions – talk to SignalK / InfluxDB on localhost
# ---------------------------------------------------------------------------
def update_influx_filters(paths_array: list[str]) -> bool:
    """POST allow-list paths to the signalk-to-influxdb2 plugin config.

    Converts plain SignalK paths to regex filteringRules for the v2 plugin.
    Deep value paths (e.g. navigation.position.value.latitude) are truncated
    to their SignalK measurement level (e.g. navigation.position).
    """
    url = f"{SIGNALK_BASE}/plugins/signalk-to-influxdb2/config"
    # Convert paths to regex filteringRules, deduplicating measurement-level paths
    seen = set()
    filtering_rules = []
    for path in paths_array:
        # Strip deep value sub-paths that don't correspond to InfluxDB measurements
        # e.g. "navigation.position.value.latitude" -> "navigation.position"
        meas_path = _to_measurement_path(path)
        if meas_path in seen:
            continue
        seen.add(meas_path)
        regex_path = "^" + meas_path.replace(".", "[.]")
        filtering_rules.append({"allow": True, "path": regex_path})

    # Skip POST if the measurement-level paths haven't changed – avoids plugin restart
    global _last_influx_filter_paths
    if seen == _last_influx_filter_paths:
        log.info("  InfluxDB v2 filter unchanged (%d paths) – skipping POST", len(seen))
        return True
    _last_influx_filter_paths = seen

    payload = {
        "enabled": True,
        "configuration": {
            "outputDailyLog": False,
            "influxes": [{
                "url": os.getenv("INFLUXDB_URL", "http://localhost:8086"),
                "token": os.getenv("INFLUXDB_TOKEN", ""),
                "org": os.getenv("INFLUXDB_ORG", "vxt"),
                "bucket": os.getenv("INFLUXDB_BUCKET", "signalk_history"),
                "onlySelf": True,
                "resolution": 200,
                "useSKTimestamp": True,
                "filteringRules": filtering_rules,
            }]
        }
    }
    try:
        resp = requests.post(url, json=payload, headers=SK_HEADERS, timeout=5)
        resp.raise_for_status()
        log.info("  InfluxDB v2 filter config applied (%d paths)", len(paths_array))
        return True
    except requests.ConnectionError:
        log.error("  Cannot reach InfluxDB v2 plugin at %s", url)
    except requests.HTTPError as exc:
        log.error("  InfluxDB v2 plugin returned %s: %s", exc.response.status_code, exc.response.text[:200])
    return False


def update_signalk_alarms(alarms_dict: dict) -> int:
    """Translate VXT AttributeScore ranges → SignalK alarm zone metadata.

    For each path, builds a zones array and PUTs it to the SignalK meta
    endpoint so the server raises the correct alarm state.

    Returns the number of paths successfully updated.
    """
    ok_count = 0
    for sk_path, score_ranges in alarms_dict.items():
        if sk_path == "siren_gpio_enabled":
            continue
        if not isinstance(score_ranges, list):
            log.warning("  Skipping alarm key '%s' – not a list", sk_path)
            continue

        zones = []
        for entry in score_ranges:
            state = _SCORE_TO_STATE.get(entry.get("score", 0), "nominal")
            zones.append({
                "lower": entry["min"],
                "upper": entry["max"],
                "state": state,
                "message": f"{sk_path} {state} ({entry['min']}-{entry['max']})",
            })

        url_path = _sk_path_to_url(sk_path)
        url = f"{SIGNALK_BASE}/signalk/v1/api/vessels/self/{url_path}/meta/zones"
        payload = {"value": zones}

        try:
            resp = requests.put(url, json=payload, headers=SK_HEADERS, timeout=5)
            resp.raise_for_status()
            log.info("  ✓ Alarm zones set for %s (%d zones)", sk_path, len(zones))
            ok_count += 1
        except requests.ConnectionError:
            log.error("  Cannot reach SignalK at %s", url)
        except requests.HTTPError as exc:
            log.error("  SignalK returned %s for %s", exc.response.status_code, sk_path)
    return ok_count


def update_geofences(geofences_array: list[dict]) -> int:
    """POST geofence definitions to the signalk-geofence plugin.

    Handles both Polygon and Circle types from the device twin.
    Returns the number of geofences successfully posted.
    """
    url = f"{SIGNALK_BASE}/plugins/signalk-geofence/config"
    fences = []
    for gf in geofences_array:
        gf_type = gf.get("type", "")
        entry = {
            "id": gf.get("id"),
            "name": gf.get("name", "Unnamed"),
            "enabled": True,
        }
        if gf_type == "Polygon":
            entry["type"] = "polygon"
            entry["coordinates"] = gf["coordinates"]
        elif gf_type == "Circle":
            entry["type"] = "circle"
            entry["center"] = gf["coordinates"]   # [lon, lat]
            entry["radius"] = gf.get("radius", 0)  # metres
        else:
            log.warning("  Unknown geofence type '%s' for id=%s", gf_type, gf.get("id"))
            continue
        fences.append(entry)

    payload = {"enabled": True, "configuration": {"fences": fences}}
    try:
        resp = requests.post(url, json=payload, headers=SK_HEADERS, timeout=5)
        resp.raise_for_status()
        log.info("  Geofence config applied (%d fences)", len(fences))
        return len(fences)
    except requests.ConnectionError:
        log.error("  Cannot reach geofence plugin at %s", url)
    except requests.HTTPError as exc:
        log.error("  Geofence plugin returned %s", exc.response.status_code)
    return 0


# ---------------------------------------------------------------------------
# Bulk Telemetry Loop – tiered history fetch → Azure push
# ---------------------------------------------------------------------------
POSITION_PATH = "navigation.position"


def _fetch_history_tier(
    iso_from: str, iso_to: str, resolution_s: str, paths: list[str],
) -> list[dict]:
    """Fetch one tier from History API v2 (Option A: position + numerics).

    Uses ``resolution`` = entityTypeAttributeTimeAspect so InfluxDB
    returns one aggregated data point per bucket.
    Paths use ``path:method`` syntax (first for position, average for rest).

    Returns a flat list of {timestamp, path: value, …} dicts.
    """
    # Normalise deep-value paths to InfluxDB measurement level, deduplicate
    meas_paths = list(dict.fromkeys(_to_measurement_path(p) for p in paths))

    # Split: position must be queried separately (InfluxQL vs Flux internals)
    pos_paths = [p for p in meas_paths if p == POSITION_PATH]
    num_paths = [p for p in meas_paths if p != POSITION_PATH]

    results: list[dict] = []

    for group, method in [(pos_paths, "first"), (num_paths, "average")]:
        if not group:
            continue
        # Build path:method CSV  e.g. "navigation.position:first"
        paths_csv = ",".join(f"{p}:{method}" for p in group)
        url = (
            f"{SIGNALK_BASE}/signalk/v2/api/history/values"
            f"?from={iso_from}&to={iso_to}"
            f"&resolution={resolution_s}"
            f"&paths={paths_csv}"
        )
        log.info("    GET %s", url)
        try:
            resp = requests.get(url, headers=SK_HEADERS, timeout=15)
            resp.raise_for_status()
        except requests.ConnectionError:
            log.error("  History GET failed – SignalK unreachable")
            continue
        except requests.HTTPError as exc:
            log.warning("  History %s returned %s", paths_csv[:60], exc.response.status_code)
            continue

        body = resp.json()
        columns = body.get("values", [])
        data_rows = body.get("data", [])
        log.info("    %s → %d columns, %d rows", method, len(columns), len(data_rows))
        if not columns or not data_rows:
            continue

        # Parse columnar response into row dicts
        for row in data_rows:
            if not row or len(row) < 2:
                continue
            ts = row[0]
            if ts is None:
                continue
            entry = {"timestamp": ts}
            for i, col in enumerate(columns):
                val = row[i + 1] if (i + 1) < len(row) else None
                if val is not None:
                    entry[col.get("path", f"col_{i}")] = val
            if len(entry) > 1:  # has at least one value besides timestamp
                results.append(entry)

    return results


async def five_minute_telemetry_loop(client: IoTHubModuleClient) -> None:
    """Background task: wake every bulk_interval_seconds, pull tiered
    history from SignalK, pivot into timestamp-keyed rows, and push
    the batch to Azure IoT Hub as a single D2C message.

    Each tier in tiered_paths uses its key (entityTypeAttributeTimeAspect)
    as the ``resolution`` parameter so InfluxDB aggregates to the correct
    bucket size.  Option A: max 2 HTTP requests per tier (position +
    numerics) instead of one request per path.
    """
    log.info("Telemetry loop: waiting for initial twin config …")
    while "telemetry" not in vxt_config:
        await asyncio.sleep(1)

    while True:
        telemetry_cfg = vxt_config.get("telemetry", {})
        interval = telemetry_cfg.get("bulk_interval_seconds", 300)
        log.info("Telemetry loop: sleeping %ds until next bulk push", interval)
        await asyncio.sleep(interval)

        time_to = datetime.now(timezone.utc)
        time_from = time_to - timedelta(seconds=interval)
        iso_from = time_from.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        iso_to = time_to.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        tiered_paths = telemetry_cfg.get("tiered_paths", {})
        if not tiered_paths:
            log.warning("Telemetry loop: no tiered_paths configured – skipping")
            continue

        # ── Collect history per tier (resolution = entityTypeAttributeTimeAspect) ──
        timestamp_blocks: dict[str, dict] = {}

        for time_aspect, paths in tiered_paths.items():
            if not paths:
                continue
            log.info("  Tier %ss: querying %d paths", time_aspect, len(paths))
            tier_rows = _fetch_history_tier(iso_from, iso_to, time_aspect, paths)
            # Merge into timestamp-keyed blocks
            for entry in tier_rows:
                ts = entry["timestamp"]
                if ts not in timestamp_blocks:
                    timestamp_blocks[ts] = {"timestamp": ts}
                for k, v in entry.items():
                    if k != "timestamp":
                        timestamp_blocks[ts][k] = v

        if not timestamp_blocks:
            log.info("Telemetry loop: no data returned for window %s → %s", iso_from, iso_to)
            continue

        # ── Build SignalK standard envelope ──
        # The Azure Function consumer expects:
        #   {"context": "vessels.urn:mrn:imo:mmsi:<entityId>",
        #    "updates": [{"timestamp":"...","source":{...},"values":[...]}]}
        entity_id = vxt_config.get("entity_id", os.getenv("ENTITY_ID", "234567891"))
        sk_context = f"vessels.urn:mrn:imo:mmsi:{entity_id}"

        updates = []
        for ts in sorted(timestamp_blocks):
            block = timestamp_blocks[ts]
            values_list = []
            for key, val in block.items():
                if key == "timestamp":
                    continue
                if key == POSITION_PATH and isinstance(val, (list, tuple)) and len(val) >= 2:
                    # History API returns position as [lon, lat]
                    values_list.append({
                        "path": key,
                        "value": {"longitude": val[0], "latitude": val[1]},
                    })
                else:
                    values_list.append({"path": key, "value": val})
            if values_list:
                updates.append({
                    "timestamp": ts,
                    "source": {"label": "VxtOrchestrator"},
                    "values": values_list,
                })

        if not updates:
            log.info("Telemetry loop: no values to send")
            continue

        message_body = json.dumps({
            "context": sk_context,
            "updates": updates,
        })
        try:
            await client.send_message(message_body)
            log.info(
                "Telemetry loop: pushed %d updates (%d bytes) to Azure",
                len(updates), len(message_body),
            )
        except Exception:
            log.exception("Telemetry loop: failed to send message to Azure")


# ---------------------------------------------------------------------------
# Real-Time Deadband – WebSocket listener with percentage-change filter
# ---------------------------------------------------------------------------
def _trigger_siren_gpio(activate: bool) -> None:
    """PUT to the SignalK Raspberry Pi GPIO plugin to toggle the siren relay."""
    url = f"{SIGNALK_BASE}/plugins/signalk-raspberry-pi-gpio/config"
    payload = {"siren": {"state": activate}}
    try:
        resp = requests.put(url, json=payload, headers=SK_HEADERS, timeout=5)
        resp.raise_for_status()
        log.info("  Siren GPIO %s", "ACTIVATED" if activate else "deactivated")
    except requests.ConnectionError:
        log.error("  Cannot reach GPIO plugin at %s", url)
    except requests.HTTPError as exc:
        log.error("  GPIO plugin returned %s", exc.response.status_code)


async def websocket_listener(client: IoTHubModuleClient) -> None:
    """Background task: connect to SignalK WebSocket stream, subscribe to
    all notification deltas, apply deadband filtering for realtime paths,
    forward critical alerts to Azure immediately, and trigger the siren
    GPIO on emergency notifications."""
    log.info("WebSocket listener: waiting for initial twin config …")
    while "telemetry" not in vxt_config:
        await asyncio.sleep(1)

    while True:
        try:
            ws_url = SIGNALK_WS
            if SIGNALK_TOKEN:
                sep = "&" if "?" in ws_url else "?"
                ws_url += f"{sep}token={SIGNALK_TOKEN}"
            log.info("WebSocket listener: connecting to %s", SIGNALK_WS)
            async with websockets.connect(ws_url) as ws:
                # Build subscription list: notifications + deadband paths
                subscriptions = [
                    {"path": "notifications.*", "minPeriod": 1000},
                ]
                deadbands = vxt_config.get("telemetry", {}).get(
                    "realtime_deadbands", {}
                )
                for db_path in deadbands:
                    subscriptions.append({"path": db_path, "minPeriod": 500})

                subscribe_msg = json.dumps({
                    "context": "vessels.self",
                    "subscribe": subscriptions,
                })
                await ws.send(subscribe_msg)
                sub_paths = [s["path"] for s in subscriptions]
                log.info("WebSocket listener: subscribed to %s", sub_paths)

                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    for update in msg.get("updates", []):
                        ts = update.get("timestamp",
                                        datetime.now(timezone.utc).isoformat())
                        for val_entry in update.get("values", []):
                            path = val_entry.get("path", "")
                            value = val_entry.get("value")

                            # ── Alert forwarding for notifications ──
                            if path.startswith("notifications.") and isinstance(value, dict):
                                state = value.get("state", "")

                                # Forward alarm / emergency to Azure immediately
                                if state in ("alarm", "emergency"):
                                    # Strip 'notifications.' prefix for the alert path
                                    alert_path = path.removeprefix("notifications.")
                                    alert_msg = json.dumps({
                                        "type": "ALERT",
                                        "path": alert_path,
                                        "state": state,
                                        "message": value.get("message", ""),
                                        "timestamp": ts,
                                    })
                                    try:
                                        await client.send_message(alert_msg)
                                        log.warning(
                                            "⚡ ALERT forwarded: %s [%s] → Azure",
                                            alert_path, state,
                                        )
                                    except Exception:
                                        log.exception("Alert send failed for %s", path)

                                    # Trigger siren GPIO on emergency
                                    if state == "emergency":
                                        siren_on = vxt_config.get("alarms", {}).get(
                                            "siren_gpio_enabled", False
                                        )
                                        if siren_on:
                                            log.warning(
                                                "EMERGENCY on %s – triggering siren GPIO",
                                                path,
                                            )
                                            _trigger_siren_gpio(True)

                                elif state == "normal":
                                    # Clear siren when state returns to normal
                                    siren_on = vxt_config.get("alarms", {}).get(
                                        "siren_gpio_enabled", False
                                    )
                                    if siren_on:
                                        _trigger_siren_gpio(False)

                                continue  # notifications handled – skip deadband

                            # ── Deadband check for realtime telemetry paths ──
                            deadbands = vxt_config.get("telemetry", {}).get(
                                "realtime_deadbands", {}
                            )
                            if path in deadbands and isinstance(value, (int, float)):
                                threshold = deadbands[path]
                                prev = last_sent_values.get(path)
                                if prev is not None and prev != 0:
                                    pct_change = abs(value - prev) / abs(prev)
                                    if pct_change < threshold:
                                        continue  # within deadband – suppress

                                # Exceeds deadband (or first reading) – send
                                last_sent_values[path] = value
                                rt_msg = json.dumps({
                                    "realtime": {
                                        "path": path,
                                        "value": value,
                                        "timestamp": ts,
                                    }
                                })
                                try:
                                    await client.send_message(rt_msg)
                                    log.debug("RT sent %s = %s", path, value)
                                except Exception:
                                    log.exception("RT send failed for %s", path)

        except websockets.ConnectionClosedError as exc:
            log.warning("WebSocket closed: %s – reconnecting in %ds", exc, WS_RECONNECT_DELAY)
        except OSError as exc:
            log.error("WebSocket connection failed: %s – retrying in %ds", exc, WS_RECONNECT_DELAY)

        await asyncio.sleep(WS_RECONNECT_DELAY)


# ---------------------------------------------------------------------------
# Section routers – called when a top-level key in the twin changes
# ---------------------------------------------------------------------------
async def _on_telemetry_updated(telemetry: dict) -> None:
    """Handle changes to tiered_paths, bulk_interval, or realtime_deadbands."""
    log.info("── Telemetry config updated ──")
    if "tiered_paths" in telemetry:
        total = sum(len(v) for v in telemetry["tiered_paths"].values())
        log.info("  Tiered paths: %d paths across %d intervals",
                 total, len(telemetry["tiered_paths"]))
    if "bulk_interval_seconds" in telemetry:
        log.info("  Bulk interval: %ds", telemetry["bulk_interval_seconds"])
    if "realtime_deadbands" in telemetry:
        log.info("  Deadband paths: %s",
                 list(telemetry["realtime_deadbands"].keys()))


async def _on_storage_updated(storage: dict) -> None:
    """POST allow_paths to the local InfluxDB plugin."""
    log.info("── Updating InfluxDB filters ──")
    if "influx_allow_paths" in storage:
        update_influx_filters(storage["influx_allow_paths"])


async def _on_alarms_updated(alarms: dict) -> None:
    """Translate generic AttributeScores → SignalK alarm zones (PUT)."""
    log.info("── Updating SignalK Alarm Zones ──")
    log.info("  Siren GPIO enabled: %s", alarms.get("siren_gpio_enabled"))
    updated = update_signalk_alarms(alarms)
    log.info("  Alarm zones updated for %d paths", updated)


async def _on_geofences_updated(geofences: list) -> None:
    """POST geofence definitions to the local SignalK geofence plugin."""
    log.info("── Geofence config updated ──")
    for gf in geofences:
        log.info("  [%s] %s (id=%s)", gf.get("type"), gf.get("name"), gf.get("id"))
    update_geofences(geofences)


# Map of top-level twin keys → handler coroutines
_SECTION_ROUTERS = {
    "telemetry": _on_telemetry_updated,
    "storage":   _on_storage_updated,
    "alarms":    _on_alarms_updated,
    "geofences": _on_geofences_updated,
}


# ---------------------------------------------------------------------------
# Twin patch handler
# ---------------------------------------------------------------------------
async def twin_patch_handler(patch: dict) -> None:
    """
    Called by the Azure SDK whenever a desired-property patch arrives.
    Merges the patch into vxt_config, then dispatches to section routers.
    """
    log.info("⬇  Twin patch received  (%d top-level keys: %s)",
             len(patch), list(patch.keys()))

    # Filter out Azure metadata keys (start with '$')
    clean_patch = {k: v for k, v in patch.items() if not k.startswith("$")}

    # Merge into global state
    deep_merge(vxt_config, clean_patch)

    # Route each changed section to its handler
    for section, payload in clean_patch.items():
        handler = _SECTION_ROUTERS.get(section)
        if handler:
            await handler(payload)
        else:
            log.warning("  Unknown twin section '%s' – stored but no handler", section)

    log.info("✓  vxt_config now has keys: %s", list(vxt_config.keys()))


# ---------------------------------------------------------------------------
# Bootstrap – runs once on module start
# ---------------------------------------------------------------------------
async def main() -> None:
    log.info("=" * 60)
    log.info("VXT Orchestrator starting …")
    log.info("=" * 60)

    # ── Connect: standalone device client (connection string) or Edge module ──
    device_cs = os.getenv("DEVICE_CONNECTION_STRING", "")
    if device_cs:
        client = IoTHubDeviceClient.create_from_connection_string(device_cs)
        await client.connect()
        log.info("Connected to Azure IoT Hub as standalone device")
    else:
        client = IoTHubModuleClient.create_from_edge_environment()
        await client.connect()
        log.info("Connected to Azure IoT Edge runtime")

    # ── Register the twin patch listener ──
    client.on_twin_desired_properties_patch_received = twin_patch_handler

    # ── Fetch the full twin on first boot ──
    twin = await client.get_twin()
    # SDK returns {"desired": {…}, "reported": {…}} (no "properties" wrapper)
    desired = twin.get("desired", twin.get("properties", {}).get("desired", {}))
    log.info("Full twin fetched on boot (%d keys)", len(desired))
    await twin_patch_handler(desired)

    # ── Launch background tasks ──
    telemetry_task = asyncio.create_task(
        five_minute_telemetry_loop(client),
        name="telemetry-loop",
    )
    websocket_task = asyncio.create_task(
        websocket_listener(client),
        name="websocket-deadband",
    )

    # ── Keep the module alive until SIGTERM / SIGINT ──
    stop_event = asyncio.Event()

    def _signal_handler() -> None:
        log.info("Shutdown signal received")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            # Windows doesn't support add_signal_handler
            signal.signal(sig, lambda s, f: _signal_handler())

    log.info("VXT Orchestrator running – waiting for twin patches …")
    await stop_event.wait()

    # ── Graceful shutdown ──
    telemetry_task.cancel()
    websocket_task.cancel()
    log.info("Shutting down IoT Hub client …")
    await client.shutdown()
    log.info("VXT Orchestrator stopped.")


if __name__ == "__main__":
    asyncio.run(main())
