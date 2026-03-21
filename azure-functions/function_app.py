#!/usr/bin/env python3
"""
Azure Function: Generic Telemetry Consumer Trigger
Listens to IoT Hub events and processes them into Azure SQL Database

Trigger: IoT Hub Messages
Provider: N2KToSignalK (SignalK maritime protocol)
Target: EntityTelemetry table in Azure SQL

Configuration: Uses IoTHubConnectionString from app settings (Event Hub-compatible endpoint)

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
import pymssql
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
DB_NAME = os.environ.get('DB_NAME', 'vxtdb')
DB_USER = os.environ.get('DB_USER', 'vxtadmin')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '')

# IoT Hub device twin connection (optional, for reading setup config)
IOT_HUB_CONNECTION_STRING = os.environ.get('IOT_HUB_CONNECTION_STRING', '')

# ============================================================================
# TELEMETRY PROCESSOR (Inline implementation)
# ============================================================================
class SimpleEventProcessor:
    """Process telemetry events and insert to database"""
    
    def __init__(self, db_server: str, db_name: str, db_user: str, db_password: str, provider_name: str):
        self.db_server = db_server
        self.db_name = db_name
        self.db_user = db_user
        self.db_password = db_password
        self.provider_name = provider_name
        self.stats = {
            'events_processed': 0,
            'records_inserted': 0,
            'records_skipped': 0,
            'errors': 0
        }
    
    def get_db_connection(self):
        """Get database connection with retry"""
        for attempt in range(2):
            try:
                conn = pymssql.connect(
                    server=self.db_server,
                    user=self.db_user,
                    password=self.db_password,
                    database=self.db_name,
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
                            # Generic insert into EntityTelemetry
                            cursor.execute("""
                            INSERT INTO dbo.EntityTelemetry 
                            (entityId, attributeName, attributeValue, timestamp)
                            VALUES (?, ?, ?, ?)
                            """, (entity_id, key, str(value), timestamp))
                            
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
    """Get or initialize the event processor"""
    global processor
    if processor is None:
        processor = SimpleEventProcessor(
            db_server=DB_SERVER,
            db_name=DB_NAME,
            db_user=DB_USER,
            db_password=DB_PASSWORD,
            provider_name=PROVIDER_NAME
        )
        logger.info(f"[INIT] Processor initialized for {PROVIDER_NAME}")
    return processor


# ============================================================================
# AZURE FUNCTION: IoT HUB TRIGGER
# ============================================================================
app = func.FunctionApp()

@app.function_name("telemetry_consumer")
@app.route("health", methods=["GET"])
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """Health check endpoint"""
    try:
        processor = get_processor()
        stats = processor.get_stats()
        return func.HttpResponse(
            json.dumps({
                "status": "healthy",
                "provider": PROVIDER_NAME,
                "stats": stats
            }),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)[:100]}),
            status_code=500,
            mimetype="application/json"
        )


@app.iot_hub_message_trigger(
    arg_name="messages",
    connection="IoTHubConnectionString"
)
async def iot_hub_consumer(messages: func.AsynchronousIterable) -> None:
    """
    Process messages from IoT Hub
    
    This function is triggered whenever the IoT Hub receives a message
    that matches the routing rules configured in Azure Portal.
    
    Configuration:
    - IoT Hub Routing: Create a route that sends messages to this function
    - Message filter: (properties.provider = 'N2KToSignalK') or leave empty for all
    """
    
    processor = get_processor()
    message_count = 0
    
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
