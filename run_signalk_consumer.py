#!/usr/bin/env python3
"""
SignalK Provider Consumer
Runs GenericTelemetryConsumer configured for N2KToSignalK maritime protocol
"""

import logging
from generic_telemetry_consumer import GenericTelemetryConsumer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Initialize and run SignalK consumer"""
    try:
        logger.info("=" * 60)
        logger.info("Starting SignalK (N2KToSignalK) Telemetry Consumer")
        logger.info("=" * 60)
        
        # Initialize consumer for SignalK provider
        consumer = GenericTelemetryConsumer(
            provider_name="N2KToSignalK",
            db_server='localhost',
            db_name='BoatTelemetryDB',
            db_user='sa',
            db_password='YourStrongPassword123!'
        )
        
        logger.info("Consumer initialized successfully")
        logger.info(f"Provider: {consumer.provider_config['TopicName']}")
        logger.info(f"Batch Size: {consumer.provider_config['BatchSize']}")
        logger.info("")
        logger.info("Starting event consumption...")
        logger.info("Listening to Kafka topic: signalk-events")
        logger.info("Press Ctrl+C to stop")
        logger.info("")
        
        # Main consumer loop
        consumer.consume_and_insert()
        
    except KeyboardInterrupt:
        logger.info("\nConsumer stopped by user")
    except Exception as e:
        logger.error(f"Fatal error in SignalK consumer: {e}", exc_info=True)
        raise

if __name__ == '__main__':
    main()
