#!/usr/bin/env python3
"""
Azure Function: Generic Telemetry Consumer Trigger
Listens to IoT Hub events and inserts telemetry into EntityTelemetry (Azure SQL).

Trigger:  IoT Hub (Event Hub-compatible endpoint)
Protocols: SignalK (maritime), Junction (health), extensible via protocol_adapters.py
Filtering: EntityTypeAttribute table — only attributes with matching codes are stored
Auth:      Managed Identity (no passwords)

Processing flow:
  IoT Hub message → protocol_adapters (normalise) → EntityTypeAttribute lookup → INSERT

Adding a new protocol (e.g. MQTT, Junction):
  1. Add an adapter class to azure-functions/protocol_adapters.py
  2. Register it in the ADAPTERS dict at the bottom of that file
  3. Set PROVIDER_NAME app-setting to the new protocol name
"""

import azure.functions as func
from azure.functions import AuthLevel
import json
import os
import logging
from datetime import datetime
from typing import Optional, Dict, List

from protocol_adapters import get_adapter, _parse_dt

# Configure logging
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION (from environment variables) - Lazy loading for cold start
# ============================================================================
PROVIDER_NAME = os.environ.get('PROVIDER_NAME', 'N2KToSignalK')
DB_SERVER = os.environ.get('DB_SERVER', 'vxtdb.database.windows.net')
DB_NAME = os.environ.get('DB_NAME', 'free-sql-db-5949639')
IOT_HUB_CONNECTION_STRING = os.environ.get('IoTHubConnectionString', os.environ.get('IOT_HUB_CONNECTION_STRING', ''))

logger.info("[STARTUP] Azure Function initialized (lazy loading mode for fast cold start)")

# ============================================================================
# TELEMETRY PROCESSOR (Lazy initialization for fast cold start)
# ============================================================================
class SimpleEventProcessor:
    """Process telemetry events and insert to database using Managed Identity"""
    
    def __init__(self, db_server: str, db_name: str, provider_name: str):
        self.db_server = db_server
        self.db_name = db_name
        self.provider_name = provider_name
        self.stats = {
            'events_processed': 0,
            'records_inserted': 0,
            'records_skipped': 0,
            'records_failed': 0,
            'errors': 0
        }
        self._mssql_module = None  # Lazy load on first use
    
    def _get_mssql_module(self):
        """Lazy load mssql-python only when needed (avoids cold start penalty)"""
        if self._mssql_module is None:
            try:
                from mssql_python import connect
                self._mssql_module = {'connect': connect}
            except ImportError as e:
                logger.error(f"Failed to import mssql-python: {e}")
                raise
        return self._mssql_module
    
    def get_db_connection(self):
        """Get database connection with Managed Identity authentication (retry enabled)"""
        mssql = self._get_mssql_module()
        connect = mssql['connect']

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
        Process a single IoT Hub message.

        Uses the protocol adapter (SignalK, Junction, …) to normalise the raw
        payload into NormalizedEvent objects, then looks up each attribute in
        EntityTypeAttribute and inserts matching rows into EntityTelemetry.

        Args:
            event: Parsed JSON body from IoT Hub message.

        Returns:
            Number of rows inserted.
        """
        self.stats['events_processed'] += 1
        inserted_count = 0

        try:
            if not isinstance(event, dict):
                logger.warning(f"Invalid event type: {type(event)}")
                self.stats['records_skipped'] += 1
                return 0

            # Normalise the raw payload using the registered protocol adapter.
            # get_adapter() selects the right class based on PROVIDER_NAME and
            # falls back to SignalKAdapter for unknown protocols.
            adapter = get_adapter(self.provider_name)
            normalized_events = adapter.parse(event)

            if not normalized_events:
                logger.info("[PROC] No events extracted from message")
                self.stats['records_skipped'] += 1
                return 0

            conn = self.get_db_connection()
            write_cursor = conn.cursor()
            lookup_cursor = conn.cursor()

            try:
                # ingestionTimestampUTC is a Python datetime — mssql-python
                # requires datetime objects for DATETIME2 columns, not ISO strings.
                ingestion_ts: datetime = datetime.utcnow()

                for evt in normalized_events:
                    try:
                        # Filter: EntityTypeAttribute must exist for this entity + code
                        # Note: mssql-python uses @param named format (not ? positional)
                        lookup_cursor.execute("""
                            SELECT eta.entityTypeAttributeId
                            FROM EntityTypeAttribute eta
                            JOIN Entity e ON e.entityTypeId = eta.entityTypeId
                            WHERE e.entityId = @entityId
                              AND eta.entityTypeAttributeCode = @code
                              AND eta.active = 'Y'
                        """, (('@entityId', evt.entity_id), ('@code', evt.attr_code)))

                        row = lookup_cursor.fetchone()
                        if not row:
                            logger.warning(
                                f"[SKIP] No EntityTypeAttribute for "
                                f"entity={evt.entity_id} code={evt.attr_code}"
                            )
                            self.stats['records_skipped'] += 1
                            continue

                        attr_id = int(row[0])

                        # mssql-python named params can't infer type for Python None.
                        # Pass '' for all nullable values; NULLIF in SQL converts '' → NULL.
                        ts: datetime = evt.timestamp
                        ts_str  = ts.strftime('%Y-%m-%dT%H:%M:%S.%f')
                        ing_str = ingestion_ts.strftime('%Y-%m-%dT%H:%M:%S.%f')
                        num_str = str(evt.numeric_value) if evt.numeric_value is not None else ''
                        str_val = evt.string_value       if evt.string_value  is not None else ''
                        lat_str = str(evt.latitude)      if evt.latitude      is not None else ''
                        lon_str = str(evt.longitude)     if evt.longitude     is not None else ''

                        write_cursor.execute("""
                            INSERT INTO dbo.EntityTelemetry
                            (entityId, entityTypeAttributeId,
                             startTimestampUTC, endTimestampUTC,
                             ingestionTimestampUTC, providerDevice,
                             numericValue, stringValue, latitude, longitude)
                            VALUES
                            (@entityId, CAST(@attrId AS INT),
                             CONVERT(DATETIME2, @startTs, 126),
                             CONVERT(DATETIME2, @endTs,   126),
                             CONVERT(DATETIME2, @ingTs,   126),
                             @device,
                             TRY_CAST(NULLIF(@numVal, '') AS FLOAT),
                             NULLIF(@strVal, ''),
                             TRY_CAST(NULLIF(@lat, '') AS FLOAT),
                             TRY_CAST(NULLIF(@lon, '') AS FLOAT))
                        """, (
                            ('@entityId', evt.entity_id),
                            ('@attrId',   str(attr_id)),
                            ('@startTs',  ts_str),
                            ('@endTs',    ts_str),
                            ('@ingTs',    ing_str),
                            ('@device',   evt.provider_device),
                            ('@numVal',   num_str),
                            ('@strVal',   str_val),
                            ('@lat',      lat_str),
                            ('@lon',      lon_str),
                        ))

                        inserted_count += 1
                        self.stats['records_inserted'] += 1

                    except Exception as e:
                        logger.warning(
                            f"[FAIL] Insert [{evt.attr_code}] entity={evt.entity_id}: "
                            f"{str(e)[:120]}"
                        )
                        self.stats['records_failed'] += 1

                conn.commit()

            finally:
                lookup_cursor.close()
                write_cursor.close()
                conn.close()

            entity_ids = {e.entity_id for e in normalized_events}
            logger.info(
                f"[PROC] Entities={entity_ids} | "
                f"parsed={len(normalized_events)} events={self.stats['events_processed']} "
                f"inserted={inserted_count}"
            )

        except Exception as e:
            logger.error(f"Error processing event: {str(e)}")
            self.stats['errors'] += 1

        return inserted_count
    
    def get_stats(self):
        return self.stats


# ============================================================================
# GLOBAL PROCESSOR INSTANCE (Lazy initialization for cold start optimization)
# ============================================================================
processor = None

def get_processor():
    """Get or initialize the event processor with lazy loading"""
    global processor
    if processor is None:
        logger.info("[PROCESSOR] Initializing processor with Managed Identity...")
        try:
            # Only import here when first needed
            processor = SimpleEventProcessor(
                db_server=DB_SERVER,
                db_name=DB_NAME,
                provider_name=PROVIDER_NAME
            )
            logger.info(f"[PROCESSOR] Processor initialized successfully for {PROVIDER_NAME} -> {DB_SERVER}/{DB_NAME}")
        except Exception as e:
            logger.error(f"[PROCESSOR] CRITICAL: Failed to initialize processor: {str(e)[:100]}")
            raise
    return processor


# ============================================================================
# AZURE FUNCTION: HTTP & IoT HUB TRIGGERS
# ============================================================================
app = func.FunctionApp()

@app.route("health", methods=["GET"], auth_level=AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """Health check endpoint - returns processor status"""
    try:
        msg = f"Health check - Provider: {PROVIDER_NAME}, DB: {DB_SERVER}/{DB_NAME}"
        logger.info(f"[HEALTH] {msg}")
        
        # Using Managed Identity for authentication - no password check needed
        
        if not IOT_HUB_CONNECTION_STRING:
            logger.warning("[HEALTH] IoTHubConnectionString not configured (optional)")
        
        processor = get_processor()
        stats = processor.get_stats()
        return func.HttpResponse(
            json.dumps({
                "status": "healthy",
                "provider": PROVIDER_NAME,
                "database": f"{DB_SERVER}/{DB_NAME}",
                "stats": stats
            }),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logger.error(f"[HEALTH] Error: {str(e)[:100]}")
        return func.HttpResponse(
            json.dumps({
                "status": "error",
                "error": str(e)[:100],
                "provider": PROVIDER_NAME
            }),
            status_code=500,
            mimetype="application/json"
        )


@app.event_hub_message_trigger(
    arg_name="messages",
    event_hub_name="iothub-ehub-vxt-iot-hu-66946165-82f53700df",
    connection="IoTHubConnectionString",
    consumer_group="vxt-function"
)
def iot_hub_consumer(messages) -> None:
    """
    Process messages from IoT Hub (Event Hub compatible endpoint)
    
    Receives messages as a list (default cardinality=Many in v4)
    or single message depending on batch settings.
    """
    
    logger.info("[IOT_HUB] ✅ TRIGGER INVOKED - Processing messages from IoT Hub")
    logger.info(f"[IOT_HUB] Messages type: {type(messages)}, Connection: {IOT_HUB_CONNECTION_STRING[:50] if IOT_HUB_CONNECTION_STRING else 'NOT SET'}...")
    
    if not IOT_HUB_CONNECTION_STRING:
        logger.error("[IOT_HUB] IoTHubConnectionString not configured")
        return
    
    processor = get_processor()
    
    # Handle both single message and list of messages
    messages_list = messages if isinstance(messages, list) else [messages]
    
    logger.info(f"[IOT_HUB] Processing {len(messages_list)} message(s)...")
    
    for idx, message in enumerate(messages_list, 1):
        try:
            # Extract message body
            try:
                body = message.get_json() if hasattr(message, 'get_json') else json.loads(message.get_body())
            except (ValueError, AttributeError, TypeError):
                body = try_parse_body(message)
            
            # Extract device properties
            properties = dict(message.properties) if hasattr(message, 'properties') else {}
            device_id = properties.get('deviceId', properties.get('device_id', 'unknown'))
            
            logger.info(f"[RCV {idx}] Device: {device_id} | Body: {json.dumps(body)[:80]}...")
            
            # Ensure body is a dict
            if isinstance(body, (str, bytes)):
                event_payload = {'payload': body, 'deviceId': device_id}
            else:
                event_payload = body or {}
                event_payload['deviceId'] = device_id
            
            # Process event
            inserted_count = processor.process_event(event_payload)
            logger.info(f"[PROC {idx}] Inserted: {inserted_count} | Device: {device_id}")
            
        except Exception as e:
            logger.error(f"Error processing message {idx}: {str(e)[:100]}")
    
    logger.info(f"[IOT_HUB] ✅ BATCH COMPLETE - Processed {len(messages_list)} messages total")


def try_parse_body(message) -> Dict:
    """Try multiple ways to extract message body"""
    try:
        if hasattr(message, 'get_body'):
            body = message.get_body()
            if isinstance(body, bytes):
                return json.loads(body.decode('utf-8'))
            return json.loads(body) if isinstance(body, str) else body
    except:
        pass
    
    try:
        if hasattr(message, 'body'):
            body = message.body
            if isinstance(body, bytes):
                return json.loads(body.decode('utf-8'))
            return json.loads(body) if isinstance(body, str) else body
    except:
        pass
    
    return {}
