"""
Azure Function: Process SignalK Vessel Telemetry
Triggered by: Azure IoT Hub messages
Provider: N2KToSignalK (NMEA 2000 maritime telemetry)
Data: Yacht/vessel operational data (engine temp, position, speed, compass, etc)

Configuration Mode:
  - Device Twin Mode (Primary): Reads setup from Device Twin properties.desired.setup
    - No database access needed
    - Supports edge devices, offline scenarios
    - Faster (no DB queries per message)
  
  - Database Mode (Fallback): Reads setup from Azure SQL database
    - Required environment variables: DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD
    - Legacy mode for migration period
    - Useful when Device Twin not configured

Environment Variables:
  - DB_SERVER: vxtdb.database.windows.net (optional, for database mode fallback)
  - DB_NAME: free-sql-db-5949639 (optional, for database mode fallback)
  - DB_USER: vxt (optional, for database mode fallback)
  - DB_PASSWORD: (optional, from Key Vault, for database mode fallback)
  - IOT_HUB_CONNECTION_STRING: IoT Hub service connection (optional, for reading Device Twin)
"""

import azure.functions as func
import json
import os
import logging
from telemetry_processor import TelemetryProcessor
from typing import Optional, Dict

# Configure logging
logger = logging.getLogger(__name__)

# SignalK provider configuration (fixed)
PROVIDER_NAME = 'N2KToSignalK'

# Database configuration (from environment variables - optional, for fallback)
DB_SERVER = os.environ.get('DB_SERVER', 'vxtdb.database.windows.net')
DB_NAME = os.environ.get('DB_NAME', 'free-sql-db-5949639')
DB_USER = os.environ.get('DB_USER', 'vxt')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
IOT_HUB_CONNECTION_STRING = os.environ.get('IOT_HUB_CONNECTION_STRING')

# Global processor instance (initialized once, reused across function invocations)
processor = None
processor_mode = None  # Track which mode we're using: 'twin' or 'database'


def get_setup_from_device_twin(device_id: str) -> Optional[Dict]:
    """
    Try to get setup configuration from Device Twin
    
    Args:
        device_id: Azure IoT device ID
    
    Returns:
        Setup dict from device twin, or None if unavailable
    """
    if not IOT_HUB_CONNECTION_STRING:
        logger.debug(f"IOT_HUB_CONNECTION_STRING not configured, skipping Device Twin lookup")
        return None
    
    try:
        from azure.iot.hub import IoTHubRegistryManager
        
        # Parse connection string to get IoT Hub name
        registry_manager = IoTHubRegistryManager.from_connection_string(IOT_HUB_CONNECTION_STRING)
        
        # Get device twin
        twin = registry_manager.get_twin(device_id)
        logger.info(f"[Twin] Retrieved device twin for device: {device_id}")
        
        # Extract setup configuration from desired properties
        setup_config = twin.properties.desired.get('setup')
        
        if setup_config:
            logger.info(f"[Twin] ✓ Found setup config in device twin for {device_id}")
            return setup_config
        else:
            logger.debug(f"[Twin] No setup config in device twin for {device_id}")
            return None
    
    except ImportError:
        logger.warning("azure.iot.hub not available - Device Twin mode unsupported")
        return None
    except Exception as e:
        logger.warning(f"[Twin] Failed to read device twin for {device_id}: {e}")
        return None


def get_processor(device_id: Optional[str] = None):
    """
    Get or initialize TelemetryProcessor
    
    Supports two modes:
    1. Device Twin Mode (preferred): Reads setup from Device Twin
       - No database access
       - Works offline
       - Better performance
    
    2. Database Mode (fallback): Reads setup from Azure SQL
       - Traditional mode
       - Always available
    
    Args:
        device_id: Optional device ID for Device Twin lookup
    """
    global processor, processor_mode
    
    if processor is None:
        # Try Device Twin mode first
        setup_config = None
        if device_id:
            setup_config = get_setup_from_device_twin(device_id)
        
        if setup_config:
            # Initialize from Device Twin
            logger.info(f"Initializing TelemetryProcessor from Device Twin")
            processor = TelemetryProcessor.from_json_config(
                provider_name=PROVIDER_NAME,
                setup_config=setup_config
            )
            processor_mode = 'twin'
            logger.info(f"[OK] TelemetryProcessor initialized in DEVICE TWIN mode")
        else:
            # Fall back to Database mode
            if not (DB_SERVER and DB_NAME and DB_USER and DB_PASSWORD):
                raise ValueError("Database credentials not configured and Device Twin not available")
            
            logger.info(f"Initializing TelemetryProcessor from Azure SQL database (fallback)")
            processor = TelemetryProcessor(
                provider_name=PROVIDER_NAME,
                db_server=DB_SERVER,
                db_name=DB_NAME,
                db_user=DB_USER,
                db_password=DB_PASSWORD
            )
            processor_mode = 'database'
            logger.info(f"[OK] TelemetryProcessor initialized in DATABASE mode")
    
    return processor


async def main(messages: func.AsynchronousIterable) -> None:
    """
    Process IoT Hub messages from SignalK provider (maritime/vessel telemetry)
    
    Configuration:
    - Attempts to read setup from Device Twin (if available)
    - Falls back to database mode if Device Twin not configured
    
    Each message from IoT Hub represents vessel telemetry:
    - Engine temperature
    - GPS position/heading
    - Speed through water
    - Navigation data
    - Environmental conditions (wind, water temp, etc)
    
    The function:
    1. Receives IoT Hub message
    2. Gets processor (from Device Twin or Database)
    3. Validates and parses the message
    4. Calls TelemetryProcessor to convert protocol-specific format to normalized EntityTelemetry
    5. Inserts into Azure SQL database
    
    Args:
        messages: AsyncIterable of IoT Hub messages
    """
    
    try:
        device_id = None
        processor = None
        
        async for message in messages:
            try:
                # Extract device ID from message properties
                properties = dict(message.properties) if hasattr(message, 'properties') else {}
                device_id = properties.get('deviceId', properties.get('device_id', 'unknown'))
                
                # Initialize processor on first message (or device change)
                if processor is None:
                    processor = get_processor(device_id=device_id)
                    logger.info(f"[SignalK] Processing messages in {processor_mode.upper()} mode")
                
                # Parse IoT Hub message
                try:
                    body = message.get_json() if hasattr(message, 'get_json') else json.loads(message.get_body())
                except (ValueError, AttributeError):
                    body = message.get_body()
                
                logger.info(f"[SignalK] Processing vessel telemetry - Device: {device_id}")
                
                # Extract the actual event payload
                # IoT Hub messages might be wrapped, so extract the actual telemetry
                event_payload = body if isinstance(body, dict) else {'payload': body}
                
                # Process event using TelemetryProcessor
                inserted_count = processor.process_event(event_payload)
                
                if inserted_count > 0:
                    logger.info(f"[SignalK] ✓ Inserted {inserted_count} telemetry records into EntityTelemetry")
                else:
                    logger.debug(f"[SignalK] No records inserted (filtered or invalid entity)")
                
            except json.JSONDecodeError as e:
                logger.error(f"[SignalK] Failed to parse JSON message: {e}")
                logger.error(f"Message body: {message.get_body()}")
                continue
            except Exception as e:
                logger.error(f"[SignalK] Error processing message: {e}", exc_info=True)
                # Don't re-raise - continue processing other messages
                continue
        
        # Log statistics after processing batch
        if processor:
            stats = processor.get_stats()
            logger.info(f"[SignalK] Batch complete - {stats['events_processed']} events, "
                       f"{stats['records_inserted']} inserted, "
                       f"success rate: {stats['success_rate']:.1f}%")
        
    except Exception as e:
        logger.error(f"[SignalK] FATAL: Function error: {e}", exc_info=True)
        raise
