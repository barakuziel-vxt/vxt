"""
Shared Telemetry Processing Engine
====================================
Contains all protocol-neutral telemetry logic, shared between:
  - azure-functions/function_app.py  (production: Azure IoT Hub trigger)
  - generic_telemetry_consumer.py    (local dev:  Kafka wrapper)

This module has NO dependency on azure.functions so it can be imported in
any Python context (Kafka consumer, unit tests, CLI tools, etc.).

Processing flow:
  raw payload
    → auto_detect_provider()       detect protocol from payload shape
    → get_adapter(protocol).parse()  normalise to NormalizedEvent list
    → SimpleEventProcessor            EntityTypeAttribute lookup + INSERT
"""

import json
import os
import logging
import urllib.request
import urllib.error
from datetime import datetime
from typing import Optional, Dict, List

from protocol_adapters import get_adapter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# API base URL — FastAPI backend that owns the register-event endpoint.
# Default is the production URL; override via API_BASE_URL env var for local.
# ---------------------------------------------------------------------------
API_BASE_URL = os.environ.get(
    'API_BASE_URL',
    'https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net',
)


# ============================================================================
# PROTOCOL AUTO-DETECTION
# ============================================================================

def auto_detect_provider(event: Dict) -> str:
    """
    Detect protocol from event payload structure so a single consumer handles
    all event types — no PROVIDER_NAME env needed per message.

    Junction events:       { "user": {...}, "event_type": "8867-4", ... }
    SignalK events:        { "context": "vessels.urn:...", "updates": [...] }
    SamsungHealth events:  { "sourceDriver": "SamsungHealth", "measurements": {...}, "entityId": "..." }
    Event (orchestrator):  { "eventCode": "...", "path": "...", "entityId": "...", ... }
    """
    # SamsungHealth (VXT Mobile gateway, device SW5) — check FIRST, most specific
    if 'sourceDriver' in event and 'measurements' in event:
        return 'SamsungHealth'
    # Junction health vitals
    if 'user' in event and 'event_type' in event:
        return 'Junction'
    # SignalK maritime
    if 'context' in event and 'updates' in event:
        return 'N2KToSignalK'
    # Orchestrator event (alarm, geofence, etc.) — identified by eventCode field
    if 'eventCode' in event and 'entityId' in event:
        return 'EVENT'
    logger.warning(f"[AutoDetect] Unrecognised payload keys: {list(event.keys())} — defaulting to SignalK")
    return 'N2KToSignalK'  # default fallback


# ============================================================================
# EVENT → register-event API forwarder
# ============================================================================

def process_event_message(event: Dict) -> bool:
    """
    Forward an orchestrator event (alarm, geofence breach, etc.) to the
    FastAPI register-event endpoint which writes to the EventLog table.

    Expected payload (produced by the IoT Edge orchestrator):
        {"eventCode": "<from_twin>", "path": "...", "state": "...",
         "message": "...", "timestamp": "...", "entityId": "...", ...}

    This function is a generic pass-through — it does NOT branch on event
    type names.
    """
    entity_id = event.get('entityId')
    event_code = event.get('eventCode', '')

    if not entity_id or not event_code:
        logger.warning("[EVENT] Missing entityId or eventCode — skipping: %s", event)
        return False

    # Strip internal transport fields the broker may have injected
    payload_dict = {k: v for k, v in event.items() if k != 'deviceId'}

    # /api/register-event requires 'path' — fall back to eventCode if not present
    if not payload_dict.get('path'):
        payload_dict['path'] = event_code

    payload = json.dumps(payload_dict)

    url = f"{API_BASE_URL}/api/register-event"
    try:
        req = urllib.request.Request(
            url,
            data=payload.encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode('utf-8'))
            logger.info(
                "[EVENT] ✅ EventLog created: id=%s entity=%s eventCode=%s",
                body.get("eventLogId"), entity_id, event_code,
            )
            return True
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', errors='replace')[:300] if e.fp else str(e)
        logger.error("[EVENT] API %s returned %s: %s", url, e.code, detail)
        return False
    except Exception as e:
        logger.error("[EVENT] Failed to call register-event API: %s", str(e)[:300])
        return False


# ============================================================================
# TELEMETRY PROCESSOR
# ============================================================================

class SimpleEventProcessor:
    """
    Process telemetry events and insert to EntityTelemetry.

    Connection strategy (controlled by ENVIRONMENT env var):
      ENVIRONMENT=local  → SQL auth (SA or via SQL_CONNECTION_STRING)
      ENVIRONMENT=<else> → Azure Managed Identity (production default)

    Lazy-initialises the mssql-python module to minimise cold-start latency.
    """

    def __init__(self, db_server: str, db_name: str, provider_name: str):
        self.db_server = db_server
        self.db_name = db_name
        self.provider_name = provider_name
        self.stats = {
            'events_processed': 0,
            'records_inserted': 0,
            'records_skipped': 0,
            'records_failed': 0,
            'errors': 0,
        }
        self._mssql_module = None  # Lazy load on first use

    def _get_mssql_module(self):
        """Lazy load mssql-python only when needed (avoids cold start penalty)."""
        if self._mssql_module is None:
            try:
                from mssql_python import connect
                self._mssql_module = {'connect': connect}
            except ImportError as e:
                logger.error(f"Failed to import mssql-python: {e}")
                raise
        return self._mssql_module

    def get_db_connection(self):
        """
        Return a live DB connection.

        LOCAL  (ENVIRONMENT=local): SQL auth via SQL_CONNECTION_STRING or defaults.
          e.g. Server=localhost,1433;Database=BoatTelemetryDB;User=sa;Password=...;Encrypt=no;
        PROD   (ENVIRONMENT=production or unset): Managed Identity (no password).
        """
        mssql = self._get_mssql_module()
        connect = mssql['connect']

        # Full override wins (works for both local and prod)
        sql_conn_str = os.environ.get('SQL_CONNECTION_STRING', '')
        if sql_conn_str:
            conn_str = sql_conn_str
        elif os.environ.get('ENVIRONMENT', '').lower() == 'local':
            db_user = os.environ.get('DB_USER', 'sa')
            db_pass = os.environ.get('DB_PASSWORD', 'YourStrongPassword123!')
            conn_str = (
                f"Server={self.db_server},1433;"
                f"Database={self.db_name};"
                f"UID={db_user};"
                f"PWD={db_pass};"
                "Encrypt=no;"
                "TrustServerCertificate=yes;"
            )
        else:
            # Production: Managed Identity (no secrets)
            conn_str = (
                f"Server={self.db_server},1433;"
                f"Database={self.db_name};"
                "Authentication=ActiveDirectoryMSI;"
                "Encrypt=yes;"
                "TrustServerCertificate=no;"
            )

        for attempt in range(2):
            try:
                conn = connect(conn_str)
                return conn
            except Exception as e:
                if attempt < 1:
                    import time
                    time.sleep(1)
                else:
                    raise Exception(f"DB connection failed: {str(e)[:200]}")

    def process_event(self, event: Dict) -> int:
        """
        Process a single telemetry message.

        1. Auto-detects protocol from payload shape.
        2. Normalises via the matching protocol adapter.
        3. For each NormalizedEvent, looks up EntityTypeAttribute in DB.
        4. Inserts matching rows into EntityTelemetry.

        Returns number of rows inserted.
        """
        self.stats['events_processed'] += 1
        inserted_count = 0
        inserted_codes: List[str] = []

        try:
            if not isinstance(event, dict):
                logger.warning(f"Invalid event type: {type(event)}")
                self.stats['records_skipped'] += 1
                return 0

            detected_provider = auto_detect_provider(event)
            adapter = get_adapter(detected_provider)
            normalized_events = adapter.parse(event)
            logger.info(f"[PROC] Detected: {detected_provider} | keys: {list(event.keys())[:6]}")

            if not normalized_events:
                logger.info("[PROC] No events extracted from message")
                self.stats['records_skipped'] += 1
                return 0

            conn = self.get_db_connection()
            write_cursor = conn.cursor()
            lookup_cursor = conn.cursor()

            try:
                # mssql-python 1.4 type binding notes:
                # - Pass ALL params as str; use SQL CAST/CONVERT for type coercion.
                # - Passing datetime/int/float natively can silently bind as NULL
                #   when the driver's type-inference mismatches the target column.
                # - Never pass None — omit the column entirely instead.
                ingestion_ts_str: str = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%f')

                for evt in normalized_events:
                    try:
                        # Filter: EntityTypeAttribute must exist for this entity + code.
                        # Both columns are NVARCHAR — pass str params directly.
                        lookup_cursor.execute("""
                            SELECT eta.entityTypeAttributeId
                            FROM EntityTypeAttribute eta
                            JOIN Entity e ON e.entityTypeId = eta.entityTypeId
                            WHERE e.entityId = ?
                              AND eta.entityTypeAttributeCode = ?
                              AND eta.active = 'Y'
                        """, (str(evt.entity_id), str(evt.attr_code)))

                        row = lookup_cursor.fetchone()
                        if not row:
                            logger.warning(
                                f"[SKIP] No EntityTypeAttribute for "
                                f"entity={evt.entity_id} code={evt.attr_code}"
                            )
                            self.stats['records_skipped'] += 1
                            continue

                        attr_id_str: str = str(int(row[0]))
                        ts_str: str = evt.timestamp.strftime('%Y-%m-%dT%H:%M:%S.%f')

                        # Required (non-nullable) columns — always present.
                        ins_cols   = ['entityId', 'entityTypeAttributeId',
                                      'startTimestampUTC', 'endTimestampUTC',
                                      'ingestionTimestampUTC', 'providerDevice']
                        ins_vals   = ['?',
                                      'CAST(? AS INT)',
                                      'CONVERT(DATETIME2,?,126)',
                                      'CONVERT(DATETIME2,?,126)',
                                      'CONVERT(DATETIME2,?,126)',
                                      '?']
                        ins_params = [str(evt.entity_id),
                                      attr_id_str,
                                      ts_str,
                                      ts_str,
                                      ingestion_ts_str,
                                      str(evt.provider_device)]

                        # Optional (nullable) columns — only add when not None.
                        if evt.numeric_value is not None:
                            ins_cols.append('numericValue')
                            ins_vals.append('CAST(? AS FLOAT)')
                            ins_params.append(str(evt.numeric_value))
                        if evt.string_value is not None:
                            ins_cols.append('stringValue')
                            ins_vals.append('?')
                            ins_params.append(str(evt.string_value))
                        if evt.latitude is not None:
                            ins_cols.append('latitude')
                            ins_vals.append('CAST(? AS FLOAT)')
                            ins_params.append(str(evt.latitude))
                        if evt.longitude is not None:
                            ins_cols.append('longitude')
                            ins_vals.append('CAST(? AS FLOAT)')
                            ins_params.append(str(evt.longitude))

                        ins_sql = (
                            f"INSERT INTO dbo.EntityTelemetry "
                            f"({','.join(ins_cols)}) "
                            f"VALUES ({','.join(ins_vals)})"
                        )
                        write_cursor.execute(ins_sql, tuple(ins_params))

                        inserted_count += 1
                        inserted_codes.append(evt.attr_code)
                        self.stats['records_inserted'] += 1

                    except Exception as e:
                        logger.warning(
                            f"[FAIL] Insert [{evt.attr_code}] entity={evt.entity_id}: "
                            f"{str(e)[:500]}"
                        )
                        self.stats['records_failed'] += 1

                conn.commit()

            finally:
                lookup_cursor.close()
                write_cursor.close()
                conn.close()

            entity_ids = {e.entity_id for e in normalized_events}
            codes_str = ', '.join(inserted_codes) if inserted_codes else 'none'
            logger.info(
                f"[PROC] Entities={entity_ids} | "
                f"parsed={len(normalized_events)} events={self.stats['events_processed']} "
                f"inserted={inserted_count} codes=[{codes_str}]"
            )

        except Exception as e:
            logger.error(f"Error processing event: {str(e)}")
            self.stats['errors'] += 1

        return inserted_count

    def get_stats(self) -> Dict:
        return self.stats

    def print_stats(self) -> None:
        s = self.stats
        logger.info(
            f"[FINAL STATS] events={s['events_processed']} "
            f"inserted={s['records_inserted']} "
            f"skipped={s['records_skipped']} "
            f"failed={s['records_failed']} "
            f"errors={s['errors']}"
        )
