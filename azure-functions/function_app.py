#!/usr/bin/env python3
"""
Azure Function: Generic Telemetry Consumer Trigger
Listens to IoT Hub events and processes them into Azure SQL Database

Trigger: IoT Hub Messages
Provider: N2KToSignalK (SignalK maritime protocol)
Target: EntityTelemetry table in Azure SQL

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
import time

PROVIDER_NAME = os.environ.get('PROVIDER_NAME', 'N2KToSignalK')

# Database configuration - UNIFIED approach (same as Web App)
# Read from SQL_CONNECTION_STRING environment variable (set in Azure Function settings)
SQL_CONNECTION_STRING = os.environ.get('SQL_CONNECTION_STRING', '')

def parse_connection_string(conn_str: str) -> Dict:
    """Parse SQL_CONNECTION_STRING and return pymssql connection parameters"""
    if not conn_str:
        # Fallback to individual parameters (backward compatibility)
        db_server = os.environ.get('DB_SERVER', 'vxtdb.database.windows.net')
        db_name = os.environ.get('DB_NAME', 'free-sql-db-5949639')
        db_user = os.environ.get('DB_USER', 'vxt')
        db_password = os.environ.get('DB_PASSWORD', '')
        
        return {
            'server': db_server.split(',')[0] if ',' in db_server else db_server,
            'port': int(db_server.split(',')[1]) if ',' in db_server else 1433,
            'database': db_name,
            'user': db_user,
            'password': db_password,
            'timeout': 120,
        }
    
    # Parse connection string
    config = {}
    for item in conn_str.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            config[key.strip()] = value.strip()
    
    # Get required values (handle both 'User' and 'User Id')
    server_key = config.get('Server', '')
    database_key = config.get('Database', '')
    user_key = config.get('User') or config.get('User Id', '')
    password_key = config.get('Password', '')
    
    # Parse server and port
    if ',' in server_key:
        server, port = server_key.split(',')
        port = int(port)
    else:
        server = server_key
        port = 1433
    
    return {
        'server': server,
        'port': port,
        'database': database_key,
        'user': user_key,
        'password': password_key,
        'timeout': 120,
    }

# Parse connection string once at startup
DB_CONFIG = parse_connection_string(SQL_CONNECTION_STRING)

# IoT Hub device twin connection (optional, for reading setup config)
IOT_HUB_CONNECTION_STRING = os.environ.get('IOT_HUB_CONNECTION_STRING', '')

# ============================================================================
# TELEMETRY PROCESSOR (Inline implementation)
# ============================================================================
class SimpleEventProcessor:
    """Process telemetry events and insert to database"""
    
    def __init__(self, db_config: Dict, provider_name: str):
        self.db_config = db_config
        self.provider_name = provider_name
        self.stats = {
            'events_processed': 0,
            'records_inserted': 0,
            'records_skipped': 0,
            'errors': 0
        }
    
    def get_db_connection(self):
        """Get database connection with exponential backoff retry (same as Web App)"""
        max_attempts = 5
        backoff_seconds = [2, 5, 10, 20, 30]
        
        for attempt in range(max_attempts):
            try:
                attempt_num = attempt + 1
                logger.info(f"DB connection attempt {attempt_num}/{max_attempts} ({self.db_config['server']})")
                
                conn = pymssql.connect(
                    server=self.db_config['server'],
                    user=self.db_config['user'],
                    password=self.db_config['password'],
                    database=self.db_config['database'],
                    port=self.db_config['port'],
                    timeout=self.db_config['timeout']
                )
                logger.info(f"Database connection successful on attempt {attempt_num}")
                return conn
            except Exception as e:
                error_msg = str(e)[:150]
                logger.error(f"Connection attempt {attempt_num} failed: {error_msg}")
                
                if attempt < max_attempts - 1:
                    wait_time = backoff_seconds[attempt]
                    logger.info(f"Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Database connection failed after {max_attempts} attempts")
                    raise Exception(f"DB connection failed: {error_msg}")
    
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
            
            # PARSE SignalK format: Extract from context and updates
            # Handle SignalK format: context='vessels.urn:mrn:imo:mmsi:234567890'
            context = event.get('context', '')
            entity_id = None
            
            # Try to extract MMSI from context
            if 'mmsi:' in context:
                entity_id = context.split('mmsi:')[-1]
            else:
                # Fallback to direct entityId or mmsi fields
                entity_id = event.get('entityId') or event.get('mmsi')
            
            if not entity_id:
                logger.warning(f"Event missing entityId/mmsi: {json.dumps(event)[:100]}")
                self.stats['records_skipped'] += 1
                return 0
            
            # Extract telemetry timestamp
            timestamp = event.get('timestamp', datetime.utcnow().isoformat())
            
            # Parse SignalK updates structure
            telemetry_data = {}
            
            # Handle SignalK format with updates array
            if 'updates' in event and isinstance(event['updates'], list):
                for update in event['updates']:
                    if isinstance(update, dict) and 'values' in update:
                        for value_item in update.get('values', []):
                            if isinstance(value_item, dict):
                                # SignalK value format: {'path': '...', 'value': ...}
                                path = value_item.get('path', '')
                                value = value_item.get('value')
                                if path and value is not None:
                                    telemetry_data[path] = value
            else:
                # Fallback to direct values/data structure
                telemetry_data = event.get('values', {}) or event.get('data', {})
            
            if not telemetry_data:
                logger.info(f"No telemetry data in event for entity {entity_id}")
                self.stats['records_skipped'] += 1
                return 0
            
            # Connect to database
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            try:
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
            
            logger.info(f"Entity {entity_id}: Inserted {inserted_count} records from {len(telemetry_data)} values")
                
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
            db_config=DB_CONFIG,
            provider_name=PROVIDER_NAME
        )
        logger.info(f"[INIT] Processor initialized for {PROVIDER_NAME}")
        logger.info(f"[INIT] Database: {DB_CONFIG['server']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
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
