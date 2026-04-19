# generic_telemetry_consumer.py
"""
Generic Telemetry Consumer with Adapter Pattern
Uses TelemetryProcessor for protocol conversion and insertion logic
Focuses on Kafka consumption and message delivery
"""

import json
import logging
import time
from kafka import KafkaConsumer
from typing import List, Dict, Optional
import sys
from telemetry_processor import TelemetryProcessor

logger = logging.getLogger(__name__)


class GenericTelemetryConsumer:
    """
    Kafka consumer wrapper around TelemetryProcessor
    Handles Kafka connection, message consumption, and offset management
    All protocol conversion and insertion logic delegated to TelemetryProcessor
    """
    
    def __init__(self, provider_name: str, db_server='localhost', db_name='BoatTelemetryDB', 
                 db_user='sa', db_password='YourStrongPassword123!'):
        self.provider_name = provider_name
        self.db_server = db_server
        self.db_name = db_name
        self.db_user = db_user
        self.db_password = db_password
        
        # Initialize TelemetryProcessor (handles all business logic)
        self.processor = TelemetryProcessor(
            provider_name=provider_name,
            db_server=db_server,
            db_name=db_name,
            db_user=db_user,
            db_password=db_password
        )
        
        # Get topic name from processor's provider config
        self.topic_name = self.processor.provider_config['TopicName']
        
        # Initialize Kafka consumer
        self.consumer = self._init_kafka_consumer()
        
        logger.info(f"[OK] Consumer initialized: {self.processor.provider_config['ProviderName']}")

    
    def _init_kafka_consumer(self):
        """Initialize Kafka consumer with retry logic"""
        max_retries = 15
        retry_delay = 3
        
        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"Attempting Kafka connection (attempt {attempt}/{max_retries})...")
                consumer = KafkaConsumer(
                    self.topic_name,
                    bootstrap_servers='localhost:9092',
                    value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                    group_id=f"consumer-provider-{self.processor.provider_id}",
                    client_id=f"client-{self.processor.provider_id}",
                    auto_offset_reset='earliest',
                    enable_auto_commit=False,
                    consumer_timeout_ms=-1,
                    request_timeout_ms=30000,
                    session_timeout_ms=10000,
                    connections_max_idle_ms=540000
                )
                logger.info(f"[OK] Connected to Kafka topic: {self.topic_name}")
                return consumer
            except Exception as e:
                if attempt < max_retries:
                    backoff_delay = retry_delay * (2 ** min(attempt - 1, 3))
                    logger.warning(f"Kafka connection failed (attempt {attempt}/{max_retries}): {e}")
                    logger.info(f"Retrying in {backoff_delay} seconds...")
                    time.sleep(backoff_delay)
                else:
                    logger.error(f"Failed to connect to Kafka after {max_retries} attempts: {e}")
                    raise
    
    def consume_and_insert(self, max_events=None):
        """Main consumer loop - consume messages and delegate processing to TelemetryProcessor"""
        logger.info("=" * 80)
        logger.info(f"Starting consumer: {self.processor.provider_config['ProviderName']}")
        logger.info(f"Provider ID: {self.processor.provider_id}")
        logger.info(f"Kafka Topic: {self.topic_name}")
        logger.info("=" * 80)
        
        try:
            for message in self.consumer:
                try:
                    event = message.value
                    
                    # Delegate all processing to TelemetryProcessor
                    inserted_count = self.processor.process_event(event)
                    
                    # Log progress every 25 events
                    stats = self.processor.get_stats()
                    if stats['events_processed'] % 25 == 0:
                        logger.info(f"Progress: {stats['events_processed']} events, "
                                  f"{stats['records_inserted']} inserted, "
                                  f"{stats['records_skipped']} skipped")
                    
                    # Commit offset after successful processing
                    self.consumer.commit()
                    
                    if max_events and stats['events_processed'] >= max_events:
                        break
                        
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    continue
            
            # Print final statistics
            self.processor.print_stats()
            
        except KeyboardInterrupt:
            logger.info("\nConsumer interrupted by user")
            self.processor.print_stats()
        finally:
            self.consumer.close()



if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Generic Telemetry Consumer with Adapter Pattern')
    parser.add_argument('provider_name', type=str, help='Provider name to consume for (e.g., Junction, Terra)')
    parser.add_argument('--db-server', default='localhost', help='Database server (default: localhost)')
    parser.add_argument('--db-name', default='BoatTelemetryDB', help='Database name (default: BoatTelemetryDB)')
    parser.add_argument('--db-user', default='sa', help='Database user (default: sa)')
    parser.add_argument('--db-password', default='YourStrongPassword123!', help='Database password')
    parser.add_argument('--log-level', default='INFO', help='Log level (default: INFO)')
    
    args = parser.parse_args()
    
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    try:
        consumer = GenericTelemetryConsumer(
            provider_name=args.provider_name,
            db_server=args.db_server,
            db_name=args.db_name,
            db_user=args.db_user,
            db_password=args.db_password
        )
        consumer.consume_and_insert()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
