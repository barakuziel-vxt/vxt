"""
Azure Function: Process Junction Health Telemetry
Triggered by: Azure IoT Hub messages
Provider: Junction (health provider, LOINC-based medical/health data)
Data: People health data (heart rate, blood pressure, temperature, etc)

STATUS: DEFERRED - NOT YET ACTIVATED
Deploy this function later when ready to collect health provider data

Configuration Mode:
Same as SignalK - supports both Device Twin and Database modes
  - Device Twin Mode (Primary): No database access needed
  - Database Mode (Fallback): Uses database credentials

To activate:
1. Uncomment the main() function below
2. Delete placeholder_main()
3. Deploy to Azure
4. Configure IoT Hub routing to direct Junction messages to this function
"""

import azure.functions as func
import json
import os
import logging
from telemetry_processor import TelemetryProcessor
from typing import Optional, Dict

# Configure logging
logger = logging.getLogger(__name__)

# Junction provider configuration (fixed)
PROVIDER_NAME = 'Junction'

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
    2. Database Mode (fallback): Reads setup from Azure SQL
    
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


# UNCOMMENT WHEN READY TO ACTIVATE JUNCTION HEALTH DATA COLLECTION
# (Supports both Device Twin mode and Database mode, matching SignalK architecture)
"""
async def main(messages: func.AsynchronousIterable) -> None:
    
    Process IoT Hub messages from Junction provider (health/people telemetry)
    
    Configuration:
    - Attempts to read setup from Device Twin (if available)
    - Falls back to database mode if Device Twin not configured
    
    Each message from IoT Hub represents health telemetry:
    - Heart rate (beats per minute)
    - Blood pressure (systolic/diastolic)
    - Body temperature
    - Oxygen saturation (SpO2)
    - Respiratory rate
    - Other LOINC-based health measurements
    
    The function:
    1. Receives IoT Hub message from health wearable/sensor
    2. Gets processor (from Device Twin or Database)
    3. Validates and parses the message
    4. Calls TelemetryProcessor to convert Junction format to normalized EntityTelemetry
    5. Inserts into Azure SQL database
    
    Args:
        messages: AsyncIterable of IoT Hub messages
    
    
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
                    logger.info(f"[Junction] Processing messages in {processor_mode.upper()} mode")
                
                # Parse IoT Hub message
                try:
                    body = message.get_json() if hasattr(message, 'get_json') else json.loads(message.get_body())
                except (ValueError, AttributeError):
                    body = message.get_body()
                
                logger.info(f"[Junction] Processing health telemetry - Device: {device_id}")
                
                # Extract the actual event payload
                # IoT Hub messages might be wrapped, so extract the actual telemetry
                event_payload = body if isinstance(body, dict) else {'payload': body}
                
                # Process event using TelemetryProcessor
                inserted_count = processor.process_event(event_payload)
                
                if inserted_count > 0:
                    logger.info(f"[Junction] ✓ Inserted {inserted_count} health records into EntityTelemetry")
                else:
                    logger.debug(f"[Junction] No records inserted (filtered or invalid entity)")
                
            except json.JSONDecodeError as e:
                logger.error(f"[Junction] Failed to parse JSON message: {e}")
                logger.error(f"Message body: {message.get_body()}")
                continue
            except Exception as e:
                logger.error(f"[Junction] Error processing message: {e}", exc_info=True)
                # Don't re-raise - continue processing other messages
                continue
        
        # Log statistics after processing batch
        if processor:
            stats = processor.get_stats()
            logger.info(f"[Junction] Batch complete - {stats['events_processed']} events, "
                       f"{stats['records_inserted']} inserted, "
                       f"success rate: {stats['success_rate']:.1f}%")
        
    except Exception as e:
        logger.error(f"[Junction] FATAL: Function error: {e}", exc_info=True)
        raise
"""


# PLACEHOLDER: This function is not yet active
def placeholder_main():
    """
    This function will be activated when you're ready to collect Junction health data.
    
    To activate:
    1. Uncomment the main() function above
    2. Delete this placeholder function
    3. Redeploy to Azure
    4. Update IoT Hub message routing to include Junction messages
    """
    logger.info("Junction health telemetry collection is not yet active")
    logger.info("To activate, follow the instructions in the docstring")
