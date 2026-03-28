#!/usr/bin/env python3
"""
Azure Function: Generic Telemetry Consumer Trigger
Listens to IoT Hub events and processes them into Azure SQL Database

Trigger: IoT Hub Messages
Provider: N2KToSignalK (SignalK maritime protocol)
Target: EntityTelemetry table in Azure SQL

Configuration: Uses IoTHubConnectionString from app settings (Event Hub-compatible endpoint)
Deployment: Workflow moved to .github/workflows - now properly recognized by GitHub Actions

Setup:
1. IoT Hub Routing: Forward messages with specific conditions to this function
2. Function bindings: IoT Hub trigger
3. Device Twin (optional): Deploy setup config to device twin for filtering rules
4. Database (fallback): Use EntityTypeAttribute configuration as fallback

Processing flow:
Event from Raspberry Pi → IoT Hub → Function Trigger → TelemetryProcessor → SQL Insert
"""

import azure.functions as func
from azure.functions import AuthLevel
import json
import os
import logging
from datetime import datetime
from typing import Optional, Dict, List

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
            'errors': 0
        }
        self._mssql_module = None  # Lazy load on first use
    
    def _get_mssql_module(self):
        """Lazy load mssql-python only when needed (avoids cold start penalty)"""
        if self._mssql_module is None:
            try:
                from mssql_python import connect, errors as mssql_errors
                self._mssql_module = {'connect': connect, 'errors': mssql_errors}
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
        Process a telemetry event and insert to database
        
        Args:
            event: Event dictionary from IoT Hub
        
        Returns:
            Number of records inserted
        """
        self.stats['events_processed'] += 1
        inserted_count = 0
        
        try:
            # Validate event structure
            if not isinstance(event, dict):
                logger.warning(f"Invalid event type: {type(event)}")
                self.stats['records_skipped'] += 1
                return 0
            
            # Extract core fields
            entity_id = event.get('entityId') or event.get('mmsi')
            timestamp = event.get('timestamp', datetime.utcnow().isoformat())
            
            if not entity_id:
                logger.warning("Event missing entityId/mmsi")
                self.stats['records_skipped'] += 1
                return 0
            
            # Connect to database
            conn = self.get_db_connection()
            write_cursor = conn.cursor()
            lookup_cursor = conn.cursor()
            
            try:
                # Extract telemetry values from SignalK format
                telemetry_data = event.get('values', {}) or event.get('data', {})
                
                if not telemetry_data:
                    logger.info(f"No telemetry data in event for entity {entity_id}")
                    cursor.close()
                    return 0

                ingestion_ts = datetime.utcnow().isoformat()

                # Insert each telemetry value using correct EntityTelemetry schema
                for attr_code, value in telemetry_data.items():
                    if value is None:
                        continue
                    try:
                        # Look up entityTypeAttributeId via entity -> entityType -> attribute
                        lookup_cursor.execute("""
                            SELECT eta.entityTypeAttributeId
                            FROM EntityTypeAttribute eta
                            JOIN Entity e ON e.entityTypeId = eta.entityTypeId
                            WHERE e.entityId = @entityId
                              AND eta.entityTypeAttributeCode = @code
                              AND eta.active = 'Y'
                        """, (('@entityId', entity_id), ('@code', attr_code)))
                        row = lookup_cursor.fetchone()
                        if not row:
                            logger.debug(f"No attribute mapping: {entity_id}/{attr_code}")
                            self.stats['records_skipped'] += 1
                            continue

                        attr_id = row[0]

                        # Handle position dict vs scalar values
                        lat = None
                        lon = None
                        numeric_val = None
                        string_val = None
                        if isinstance(value, dict):
                            lat = value.get('lat') or value.get('latitude')
                            lon = value.get('lon') or value.get('longitude')
                        else:
                            try:
                                numeric_val = float(value)
                            except (ValueError, TypeError):
                                string_val = str(value)

                        write_cursor.execute("""
                            INSERT INTO dbo.EntityTelemetry
                            (entityId, entityTypeAttributeId, startTimestampUTC, endTimestampUTC,
                             ingestionTimestampUTC, providerDevice, numericValue, stringValue,
                             latitude, longitude)
                            VALUES (@entityId, @attrId, @startTs, @endTs, @ingTs, @device,
                                    @numVal, @strVal, @lat, @lon)
                        """, (
                            ('@entityId', entity_id),
                            ('@attrId', attr_id),
                            ('@startTs', timestamp),
                            ('@endTs', timestamp),
                            ('@ingTs', ingestion_ts),
                            ('@device', device_id),
                            ('@numVal', numeric_val),
                            ('@strVal', string_val),
                            ('@lat', lat),
                            ('@lon', lon)
                        ))

                        inserted_count += 1
                        self.stats['records_inserted'] += 1
                    except Exception as e:
                        logger.warning(f"Failed to insert {attr_code}: {str(e)[:80]}")
                        self.stats['records_skipped'] += 1

                conn.commit()
                
            finally:
                lookup_cursor.close()
                write_cursor.close()
                conn.close()
            
            logger.info(f"Entity {entity_id}: Inserted {inserted_count} records")
                
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
