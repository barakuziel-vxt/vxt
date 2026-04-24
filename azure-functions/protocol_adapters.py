"""
Protocol Adapters for Generic Telemetry Ingestion
Mirrors the local provider_adapters.py pattern, adapted for Azure Functions.

Supports:
  - SignalK  (maritime: NMEA 2000/0183 over SignalK)
  - Junction (health vitals, LOINC-based)
  - Any future protocol via new adapter class

Each adapter normalizes incoming messages into NormalizedEvent objects.
The Azure Function then uses EntityTypeAttribute for DB-side filtering —
no ProviderEvent table required, keeping it lightweight.

SignalK spec: https://signalk.org/specification/
"""

from datetime import datetime
from typing import Dict, List, Optional
import logging

from dateutil import parser as dateutil_parser

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_dt(ts) -> datetime:
    """
    Convert any timestamp representation to a tz-naive UTC datetime object.
    mssql-python requires Python datetime for DATETIME2 columns — never pass ISO strings.
    """
    if isinstance(ts, datetime):
        return ts.replace(tzinfo=None)
    if not ts:
        return datetime.utcnow()
    try:
        return dateutil_parser.parse(str(ts)).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()


def _safe_float(value) -> Optional[float]:
    """Convert a value to float, returning None if not convertible."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# NormalizedEvent
# ---------------------------------------------------------------------------

class NormalizedEvent:
    """
    A single telemetry data point, ready for EntityTelemetry insertion.
    One NormalizedEvent = one row in EntityTelemetry.
    """
    __slots__ = (
        'entity_id', 'timestamp', 'attr_code',
        'numeric_value', 'string_value',
        'latitude', 'longitude', 'provider_device'
    )

    def __init__(
        self,
        entity_id: str,
        timestamp: datetime,
        attr_code: str,
        numeric_value: Optional[float] = None,
        string_value: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        provider_device: str = 'unknown',
    ):
        self.entity_id = entity_id
        self.timestamp = timestamp
        self.attr_code = attr_code
        self.numeric_value = numeric_value
        self.string_value = string_value
        self.latitude = latitude
        self.longitude = longitude
        self.provider_device = provider_device

    def __repr__(self):
        return (f"NormalizedEvent(entity={self.entity_id}, "
                f"attr={self.attr_code}, num={self.numeric_value}, "
                f"lat={self.latitude}, lon={self.longitude})")


# ---------------------------------------------------------------------------
# SignalK Adapter
# ---------------------------------------------------------------------------

class SignalKAdapter:
    """
    Parses SignalK maritime telemetry messages.

    Accepts two input formats so both real devices and the test simulator work:

    1. Standard SignalK envelope (from real N2K/NMEA devices):
       {
         "context": "vessels.urn:mrn:imo:mmsi:234567890",
         "updates": [{
           "source": {"label": "ActisenseSerial"},
           "timestamp": "2026-03-28T12:34:56.000Z",
           "values": [
             {"path": "navigation.speedOverGround", "value": 7.25},
             {"path": "navigation.position",        "value": {"latitude": 32.83, "longitude": 35.00}},
             {"path": "propulsion.0.revolutions",   "value": 22.5}
           ]
         }]
       }

    2. Simplified flat format (for test simulator / backward compat):
       {
         "entityId":  "234567890",
         "timestamp": "2026-03-28T12:34:56.000",
         "provider":  "test-simulator",
         "values": {
           "navigation.speedOverGround": 7.25,
           "navigation.position":        {"lat": 32.83, "lon": 35.00}
         }
       }

    The entityTypeAttributeCode in the DB must match the SignalK path string exactly.
    """

    def parse(self, message: Dict) -> List[NormalizedEvent]:
        if 'context' in message and 'updates' in message:
            return self._parse_envelope(message)
        if 'values' in message and isinstance(message.get('values'), dict):
            return self._parse_flat(message)
        logger.warning(f"[SignalK] Unknown message format — keys: {list(message.keys())}")
        return []

    # ------------------------------------------------------------------
    # Standard SignalK envelope
    # ------------------------------------------------------------------

    def _parse_envelope(self, message: Dict) -> List[NormalizedEvent]:
        events: List[NormalizedEvent] = []

        context = message.get('context', '')
        # "vessels.urn:mrn:imo:mmsi:234567890" → "234567890"
        entity_id = context.split(':')[-1] if ':' in context else context.split('.')[-1]
        if not entity_id:
            logger.warning("[SignalK] Cannot extract entity_id from context")
            return events

        for update in message.get('updates', []):
            ts = _parse_dt(update.get('timestamp'))
            source = update.get('source', {})
            # source can be a string (e.g. 'gps1') or a dict (e.g. {"label": "ActisenseSerial"})
            if isinstance(source, dict):
                device = source.get('label', source.get('src', 'SignalK'))
            else:
                device = str(source) if source else 'SignalK'

            values_list = update.get('values', [])

            # First pass: extract lat/lon from navigation.position for context
            lat = lon = None
            for v in values_list:
                if v.get('path') == 'navigation.position' and isinstance(v.get('value'), dict):
                    pos = v['value']
                    lat = _safe_float(pos.get('latitude') or pos.get('lat'))
                    lon = _safe_float(pos.get('longitude') or pos.get('lon'))

            # Second pass: emit one NormalizedEvent per path
            for v in values_list:
                path = v.get('path')
                value = v.get('value')
                if not path or value is None:
                    continue

                if path == 'navigation.position' and isinstance(value, dict):
                    # Emit as position-only event; lat/lon go to their dedicated columns
                    p_lat = _safe_float(value.get('latitude') or value.get('lat'))
                    p_lon = _safe_float(value.get('longitude') or value.get('lon'))
                    events.append(NormalizedEvent(
                        entity_id=entity_id, timestamp=ts, attr_code=path,
                        latitude=p_lat, longitude=p_lon,
                        provider_device=device,
                    ))
                elif isinstance(value, (int, float)):
                    events.append(NormalizedEvent(
                        entity_id=entity_id, timestamp=ts, attr_code=path,
                        numeric_value=float(value),
                        latitude=lat, longitude=lon,
                        provider_device=device,
                    ))
                else:
                    events.append(NormalizedEvent(
                        entity_id=entity_id, timestamp=ts, attr_code=path,
                        string_value=str(value),
                        latitude=lat, longitude=lon,
                        provider_device=device,
                    ))

        return events

    # ------------------------------------------------------------------
    # Simplified flat format
    # ------------------------------------------------------------------

    def _parse_flat(self, message: Dict) -> List[NormalizedEvent]:
        events: List[NormalizedEvent] = []

        entity_id = str(message.get('entityId') or message.get('mmsi') or '')
        if not entity_id:
            logger.warning("[SignalK] Flat format missing entityId/mmsi")
            return events

        ts = _parse_dt(message.get('timestamp'))
        device = str(message.get('provider') or message.get('deviceId') or 'SimDevice')
        values = message.get('values', {})

        # Extract position for lat/lon context on subsequent scalar events
        pos = values.get('navigation.position', {})
        ctx_lat = ctx_lon = None
        if isinstance(pos, dict):
            ctx_lat = _safe_float(pos.get('lat') or pos.get('latitude'))
            ctx_lon = _safe_float(pos.get('lon') or pos.get('longitude'))

        for path, value in values.items():
            if value is None:
                continue

            if path == 'navigation.position' and isinstance(value, dict):
                p_lat = _safe_float(value.get('lat') or value.get('latitude'))
                p_lon = _safe_float(value.get('lon') or value.get('longitude'))
                events.append(NormalizedEvent(
                    entity_id=entity_id, timestamp=ts, attr_code=path,
                    latitude=p_lat, longitude=p_lon,
                    provider_device=device,
                ))
            elif isinstance(value, (int, float)):
                events.append(NormalizedEvent(
                    entity_id=entity_id, timestamp=ts, attr_code=path,
                    numeric_value=float(value),
                    latitude=ctx_lat, longitude=ctx_lon,
                    provider_device=device,
                ))
            else:
                events.append(NormalizedEvent(
                    entity_id=entity_id, timestamp=ts, attr_code=path,
                    string_value=str(value),
                    latitude=ctx_lat, longitude=ctx_lon,
                    provider_device=device,
                ))

        return events


# ---------------------------------------------------------------------------
# Junction Adapter  (health vitals — stub, mirrors local provider_adapters.py)
# ---------------------------------------------------------------------------

class JunctionAdapter:
    """
    Parses Junction Health Provider events.

    Expected format:
    {
      "user":       {"user_id": "033114869"},
      "event_type": "8867-4",              ← LOINC code used directly as attribute code
      "timestamp":  "2026-03-28T12:34:56.000Z",
      "data": {
        "heart_rate_data": {
          "summary": {"avg_hr_bpm": 72},
          "detailed": {"hr_samples": [{"timestamp": "...", "bpm": 72}]}
        }
      }
    }

    event_type is passed through as entityTypeAttributeCode — EntityTypeAttribute
    is the only filter. Events whose event_type is not registered in the DB are
    silently skipped by the consumer.
    """

    def parse(self, message: Dict) -> List[NormalizedEvent]:
        events: List[NormalizedEvent] = []
        try:
            user = message.get('user', {})
            user_id = str(user.get('user_id', ''))
            if not user_id:
                logger.warning("[Junction] Missing user.user_id")
                return events

            # Strip 'user_' prefix if present
            entity_id = user_id.removeprefix('user_')

            # Use loinc_code as the attribute code when present (matches EntityTypeAttributeCode in DB).
            # Fall back to event_type for formats that carry the LOINC code there directly.
            attr_code = str(message.get('loinc_code') or message.get('event_type', '')).strip()
            if not attr_code:
                logger.warning(f"[Junction] Missing loinc_code/event_type for entity {entity_id}")
                return events

            ts = _parse_dt(message.get('timestamp'))

            # Extract the first numeric scalar from any summary section
            data = message.get('data', {})
            for _section_key, section in data.items():
                if not isinstance(section, dict):
                    continue
                summary = section.get('summary', {})
                for _metric_key, metric_val in summary.items():
                    if isinstance(metric_val, (int, float)):
                        events.append(NormalizedEvent(
                            entity_id=entity_id, timestamp=ts, attr_code=attr_code,
                            numeric_value=float(metric_val),
                            provider_device='Junction',
                        ))
                        return events  # One NormalizedEvent per Junction message
        except Exception as e:
            logger.error(f"[Junction] Parse error: {e}")
        return events


# ---------------------------------------------------------------------------
# SamsungHealth Adapter  (Samsung Health phone gateway — device SW5)
# ---------------------------------------------------------------------------

class SamsungHealthAdapter:
    """
    Parses the lightweight MQTT JSON emitted by the VXT Mobile React-Native
    gateway (device ID: SW5).  This is the canonical format produced by
    SamsungHealthDriver and forwarded through MqttTransport.

    Wire format:
    {
      "timestamp":    "2026-04-02T10:30:00.000Z",
      "sourceDriver": "SamsungHealth",
      "entityId":     "<userId>",
      "measurements": {
        "8867-4":  72,    -- heart rate bpm      (LOINC)
        "8480-6":  120,   -- blood pressure sys  (LOINC)
        "55411-3": 3210,  -- step count          (LOINC)
        "59408-5": 98.0,  -- SpO2 %              (LOINC)
        "8310-5":  36.7,  -- body temperature C  (LOINC)
        "2339-0":  95.0   -- blood glucose mg/dL (LOINC)
      },
      "metadata": { "platform": "android" }
    }

    Each key in `measurements` maps 1-to-1 to an entityTypeAttributeCode
    in the database — exactly as Junction LOINC codes do, so no DB
    changes are needed as long as the EntityTypeAttribute rows exist.
    """

    def parse(self, message: Dict) -> List[NormalizedEvent]:
        events: List[NormalizedEvent] = []
        try:
            entity_id = str(message.get('entityId', '')).strip()
            if not entity_id or entity_id == 'user_unknown':
                logger.warning("[SamsungHealth] Missing or unset entityId — frame dropped")
                return events

            ts = _parse_dt(message.get('timestamp'))
            device = str(message.get('sourceDriver', 'SamsungHealth'))
            measurements = message.get('measurements', {})

            if not isinstance(measurements, dict) or not measurements:
                logger.warning(f"[SamsungHealth] Empty measurements for entity {entity_id}")
                return events

            for attr_code, raw_value in measurements.items():
                numeric = _safe_float(raw_value)
                if numeric is None:
                    continue
                events.append(NormalizedEvent(
                    entity_id=entity_id,
                    timestamp=ts,
                    attr_code=str(attr_code),
                    numeric_value=numeric,
                    provider_device=device,
                ))

        except Exception as e:
            logger.error(f"[SamsungHealth] Parse error: {e}")
        return events


# ---------------------------------------------------------------------------
# SARJ1979 Adapter  (SAE J1979 / ELM327 OBD-II automotive)
# ---------------------------------------------------------------------------

class SARJ1979Adapter:
    """
    Parses SAE J1979 (ELM327 OBD-II) automotive telemetry messages emitted
    by simulate_elm327_vehicle.py and the React Native ELM327Driver.

    Wire format (same measurement-map shape as SamsungHealthAdapter):
    {
      "sourceDriver": "SARJ1979",
      "entityId":     "KM8J33A41GU000001",   ← VIN or device-assigned ID
      "timestamp":    "2026-04-21T10:00:00.000Z",
      "measurements": {
        "010C": 1250.5,    ← Engine RPM
        "010D": 65.0,      ← Vehicle Speed km/h
        "0105": 91.3,      ← Engine Coolant Temperature °C
        "0111": 22.4,      ← Throttle Position %
        ...
      },
      "metadata": {
        "protocol": "SARJ1979",
        "deviceId": "ELM327-BT-001",
        "vin":      "KM8J33A41GU000001"
      }
    }

    Each key in `measurements` maps 1-to-1 to an entityTypeAttributeCode in the
    database (inserted by migration 0040) — exactly as LOINC codes do for health.
    """

    def parse(self, message: Dict) -> List[NormalizedEvent]:
        events: List[NormalizedEvent] = []
        try:
            entity_id = str(message.get('entityId', '')).strip()
            if not entity_id:
                logger.warning("[SARJ1979] Missing entityId — frame dropped")
                return events

            ts = _parse_dt(message.get('timestamp'))
            device = str(message.get('metadata', {}).get('deviceId', 'ELM327'))
            measurements = message.get('measurements', {})

            if not isinstance(measurements, dict) or not measurements:
                logger.warning(f"[SARJ1979] Empty measurements for entity {entity_id}")
                return events

            for attr_code, raw_value in measurements.items():
                numeric = _safe_float(raw_value)
                if numeric is None:
                    continue
                # Preserve case for dotted keys like 'obd.engineRpm';
                # only normalise to uppercase for legacy 4-char hex PIDs (e.g. '010c' → '010C').
                code_str = str(attr_code)
                normalised_code = code_str.upper() if (len(code_str) == 4 and '.' not in code_str) else code_str
                events.append(NormalizedEvent(
                    entity_id=entity_id,
                    timestamp=ts,
                    attr_code=normalised_code,
                    numeric_value=numeric,
                    provider_device=device,
                ))

        except Exception as e:
            logger.error(f"[SARJ1979] Parse error: {e}")
        return events


# ---------------------------------------------------------------------------
# Adapter registry — add new protocols here
# ---------------------------------------------------------------------------

ADAPTERS = {
    'signalk':       SignalKAdapter(),
    'n2ktosignalk':  SignalKAdapter(),       # alias
    'junction':      JunctionAdapter(),
    'samsunghealth': SamsungHealthAdapter(), # Samsung Health phone gateway (device SW5)
    'vxtmobile':     SamsungHealthAdapter(), # legacy alias
    'sarj1979':      SARJ1979Adapter(),      # SAE J1979 OBD-II automotive (ELM327)
    'elm327':        SARJ1979Adapter(),      # alias used by React Native ELM327Driver
}


def get_adapter(protocol: str):
    """
    Return the adapter for the given protocol name (case-insensitive).
    Falls back to SignalKAdapter if unknown.
    """
    adapter = ADAPTERS.get(protocol.lower())
    if adapter is None:
        logger.warning(f"[Adapters] Unknown protocol '{protocol}', defaulting to SignalK")
        adapter = ADAPTERS['signalk']
    return adapter
