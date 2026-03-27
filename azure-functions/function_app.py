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
import json
import os
import logging
from mssql_python import connect, errors as mssql_errors
from azure.identity import ManagedIdentityCredential
from datetime import datetime
from typing import Optional, Dict, List

# Configure logging
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION (from environment variables)
# ============================================================================
PROVIDER_NAME = os.environ.get('PROVIDER_NAME', 'N2KToSignalK')

# Database configuration
DB_SERVER = os.environ.get('DB_SERVER', 'vxtdb.database.windows.net')
DB_NAME = os.environ.get('DB_NAME', 'free-sql-db-5949639')

# IoT Hub device twin connection (optional, for reading setup config)
IOT_HUB_CONNECTION_STRING = os.environ.get('IoTHubConnectionString', os.environ.get('IOT_HUB_CONNECTION_STRING', ''))

# Log startup configuration
logger.info(f"[STARTUP] Provider: {PROVIDER_NAME}")
logger.info(f"[STARTUP] Database: {DB_SERVER}/{DB_NAME}")
logger.info(f"[STARTUP] Authentication: Managed Identity (azure_function)")
logger.info(f"[STARTUP] IoTHubConnectionString configured: {bool(IOT_HUB_CONNECTION_STRING)}")
logger.info("[STARTUP] Function app initialized and ready to receive events")
logger.info(f"[STARTUP] IoT Hub Connection: {'SET' if IOT_HUB_CONNECTION_STRING else 'NOT SET'}")

# ============================================================================
# TELEMETRY PROCESSOR (Inline implementation)
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
    
    def get_db_connection(self):
        """Get database connection with Managed Identity authentication (retry enabled)"""
        for attempt in range(2):
            try:
                # Use official mssql-python driver with Managed Identity
                # Function app's Managed Identity (azure_function) authenticates automatically
                conn = connect(
                    server=self.db_server,
                    database=self.db_name,
                    authentication="ActiveDirectoryMSI",
                    port=1433,
                    timeout=30
                )
                return conn
            except Exception as e:
                if attempt < 1:
                    import time
                    time.sleep(1)
                else:
                    raise Exception(f"DB connection failed: {str(e)[:100]}")
    
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
            cursor = conn.cursor()
            
            try:
                # Extract telemetry values from SignalK format
                # Standard SignalK structure: event['values'] = {...} or event['data'] = {...}
                telemetry_data = event.get('values', {}) or event.get('data', {})
                
                if not telemetry_data:
                    logger.info(f"No telemetry data in event for entity {entity_id}")
                    cursor.close()
                    return 0
                
                # Insert each telemetry value
                for key, value in telemetry_data.items():
                    if value is not None:
                        try:
                            # Generic insert into EntityTelemetry using mssql-python syntax
                            # Parameter format: @ instead of ?
                            cursor.execute("""
                            INSERT INTO dbo.EntityTelemetry 
                            (entityId, attributeName, attributeValue, timestamp)
                            VALUES (@entityId, @attrName, @attrValue, @ts)
                            """, (
                                ('@entityId', entity_id),
                                ('@attrName', key),
                                ('@attrValue', str(value)),
                                ('@ts', timestamp)
                            ))
                            
                            inserted_count += 1
                            self.stats['records_inserted'] += 1
                        except Exception as e:
                            logger.warning(f"Failed to insert {key}: {str(e)[:50]}")
                            self.stats['records_skipped'] += 1
                
                conn.commit()
                
            finally:
                cursor.close()
                conn.close()
            
            logger.info(f"Entity {entity_id}: Inserted {inserted_count} records")
                
        except Exception as e:
            logger.error(f"Error processing event: {str(e)[:100]}")
            self.stats['errors'] += 1
        
        return inserted_count
    
    def get_stats(self):
        return self.stats


# ============================================================================
# GLOBAL PROCESSOR INSTANCE
# ============================================================================
processor = None

def get_processor():
    """Get or initialize the event processor with Managed Identity"""
    global processor
    if processor is None:
        logger.info("[PROCESSOR] Initializing processor with Managed Identity...")
        try:
            processor = SimpleEventProcessor(
                db_server=DB_SERVER,
                db_name=DB_NAME,
                provider_name=PROVIDER_NAME
            )
            # Test connection to ensure Managed Identity is working
            conn = processor.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1 as test")
            cursor.close()
            conn.close()
            logger.info(f"[PROCESSOR] Processor initialized successfully for {PROVIDER_NAME} -> {DB_SERVER}/{DB_NAME}")
            logger.info(f"[PROCESSOR] Authentication: Managed Identity (azure_function user)")
        except Exception as e:
            logger.error(f"[PROCESSOR] CRITICAL: Failed to initialize processor: {str(e)[:100]}")
            raise
    return processor


# ============================================================================
# AZURE FUNCTION: HTTP & IoT HUB TRIGGERS
# ============================================================================
app = func.FunctionApp()

@app.route("health", methods=["GET"])
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
    event_hub_name="vxt-iot-hub",
    connection="IoTHubConnectionString"
)
async def iot_hub_consumer(messages: func.AsynchronousIterable) -> None:
    """
    Process messages from IoT Hub (Event Hub compatible endpoint)
    
    Trigger binding reads from IoTHubConnectionString app setting
    This function is triggered whenever the IoT Hub receives a message
    that matches the routing rules configured in Azure Portal.
    
    Configuration:
    - IoT Hub Must have messages routed to this function endpoint
    - Trigger uses built-in Event Hub-compatible endpoint
    - Connection string format: Endpoint=sb://...;SharedAccessKey=...
    """
    
    logger.info("[IOT_HUB] ✅ TRIGGER INVOKED - Starting to process messages from IoT Hub")
    
    if not IOT_HUB_CONNECTION_STRING:
        logger.error("[IOT_HUB] IoTHubConnectionString not configured - cannot process messages")
        return
    
    processor = get_processor()
    message_count = 0
    
    logger.info("[IOT_HUB] Processor initialized, waiting for messages...")
    
    async for message in messages:
        try:
            message_count += 1
            
            # Extract message body
            try:
                body = message.get_json() if hasattr(message, 'get_json') else json.loads(message.get_body())
            except (ValueError, AttributeError, TypeError):
                body = try_parse_body(message)
            
            # Extract device properties
            properties = dict(message.properties) if hasattr(message, 'properties') else {}
            device_id = properties.get('deviceId', properties.get('device_id', 'unknown'))
            
            logger.info(f"[RCV {message_count}] Device: {device_id} | Body: {json.dumps(body)[:80]}...")
            
            # Ensure body is a dict
            if isinstance(body, (str, bytes)):
                event_payload = {'payload': body, 'deviceId': device_id}
            else:
                event_payload = body or {}
                event_payload['deviceId'] = device_id
            
            # Process event
            inserted_count = processor.process_event(event_payload)
            logger.info(f"[PROC {message_count}] Inserted: {inserted_count} | Device: {device_id}")
            
        except Exception as e:
            logger.error(f"Error processing message {message_count}: {str(e)[:100]}")
    
    logger.info(f"[IOT_HUB] ✅ BATCH COMPLETE - Processed {message_count} messages total")


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
