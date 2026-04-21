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
from typing import Dict

from telemetry_engine import SimpleEventProcessor, auto_detect_provider, process_event_message

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
            
            # Route: eventCode present → event registration, otherwise → telemetry
            if isinstance(event_payload, dict) and 'eventCode' in event_payload:
                ok = process_event_message(event_payload)
                logger.info(f"[EVENT {idx}] Processed: {ok} | Device: {device_id}")
            else:
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
