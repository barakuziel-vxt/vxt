#!/usr/bin/env python3
"""
Test Event Hub Consumer - Simulates the Azure Function trigger
Listens directly to the IoT Hub Event Hub-compatible endpoint
and prints messages as they arrive.
"""

import os
import sys
import json
import logging
from datetime import datetime
from azure.eventhub import EventHubConsumerClient
from azure.identity import DefaultAzureCredential

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(name)s] %(message)s'
)
logger = logging.getLogger("EventHubConsumer")

# Get credentials from environment
ENDPOINT = os.environ.get('EVENT_HUB_ENDPOINT', 'sb://ihsuproddbres051dednamespace.servicebus.windows.net/')
SHARED_ACCESS_KEY = os.environ.get('EVENT_HUB_KEY', 'fWmQKA04f6DhGHrMLxPYM6eY7PkNmRAjnAIoTH2GGF8=')
ENTITY_PATH = os.environ.get('EVENT_HUB_ENTITY_PATH', 'iothub-ehub-vxt-iot-hu-66946165-82f53700df')
CONSUMER_GROUP = os.environ.get('CONSUMER_GROUP', '$Default')

# Construct connection string
CONNECTION_STRING = f"Endpoint={ENDPOINT};SharedAccessKeyName=iothubowner;SharedAccessKey={SHARED_ACCESS_KEY};EntityPath={ENTITY_PATH}"

logger.info(f"Connecting to Event Hub...")
logger.info(f"  Endpoint: {ENDPOINT}")
logger.info(f"  Entity Path: {ENTITY_PATH}")
logger.info(f"  Consumer Group: {CONSUMER_GROUP}")

def on_partition_init(partition_context):
    """Called when partition is initialized"""
    logger.info(f"✅ Partition {partition_context.partition_id} initialized")

def on_partition_close(partition_context):
    """Called when partition is closed"""
    logger.info(f"⚠️  Partition {partition_context.partition_id} closed")

def on_error(partition_context, error):
    """Called when an error occurs"""
    logger.error(f"❌ Error on partition {partition_context.partition_id}: {error}")

def on_event(partition_context, event):
    """Called when a message is received"""
    try:
        message_body = event.body_as_str() if hasattr(event, 'body_as_str') else str(event.body_as_json())
        
        logger.info(f"")
        logger.info(f"{'='*70}")
        logger.info(f"📨 MESSAGE RECEIVED from IoT Hub Event Hub endpoint")
        logger.info(f"{'='*70}")
        logger.info(f"Partition ID: {partition_context.partition_id}")
        logger.info(f"Sequence Number: {event.sequence_number}")
        logger.info(f"Timestamp: {event.enqueued_time}")
        logger.info(f"Offset: {event.offset}")
        
        # Try to parse as JSON
        try:
            parsed = json.loads(message_body) if isinstance(message_body, str) else message_body
            logger.info(f"Message (JSON):")
            logger.info(json.dumps(parsed, indent=2))
        except:
            logger.info(f"Message (raw):")
            logger.info(message_body[:500])  # First 500 chars
        
        logger.info(f"{'='*70}")
        logger.info(f"")
        
    except Exception as e:
        logger.error(f"Error processing event: {e}", exc_info=True)

def main():
    """Main consumer loop"""
    client = None
    try:
        logger.info("Creating Event Hub consumer client...")
        
        # Create consumer client
        client = EventHubConsumerClient.from_connection_string(
            conn_str=CONNECTION_STRING,
            consumer_group=CONSUMER_GROUP,
            partition_id=None,  # Listen to all partitions
            on_partition_init=on_partition_init,
            on_partition_close=on_partition_close,
            on_error=on_error,
            on_event=on_event,
            logging_enable=True,
            max_wait_time=10  # Wait max 10 seconds for events
        )
        
        logger.info("✅ Event Hub consumer client created successfully")
        logger.info("")
        logger.info("🎧 Listening for messages from IoT Hub...")
        logger.info("Press Ctrl+C to stop.")
        logger.info("")
        
        # Start receiving
        with client:
            client.receive(
                on_event=on_event,
                on_error=on_error,
                on_partition_init=on_partition_init,
                on_partition_close=on_partition_close,
                starting_position="-1"  # Start from latest
            )
            
    except KeyboardInterrupt:
        logger.info("")
        logger.info("⏹️  Stopping consumer...")
        
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}", exc_info=True)
        sys.exit(1)
        
    finally:
        if client:
            logger.info("Closing Event Hub consumer client...")

if __name__ == "__main__":
    main()
