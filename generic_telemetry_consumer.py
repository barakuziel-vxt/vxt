# generic_telemetry_consumer.py
"""
Generic Telemetry Consumer with Adapter Pattern
Uses TelemetryProcessor for protocol conversion and insertion logic
Focuses on Kafka consumption and message delivery
"""

import json
import logging
import os
import threading
import time
from dotenv import load_dotenv
from kafka import KafkaConsumer
from typing import List, Dict, Optional
import sys
from telemetry_processor import TelemetryProcessor

# Load .env before any DB access
load_dotenv()

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

    def run_all_providers():
        """Query DB for all active providers and start one consumer thread each."""
        from mssql_python import connect as mssql_connect
        conn_str = os.getenv('SQL_CONNECTION_STRING')
        if not conn_str:
            logger.error("SQL_CONNECTION_STRING not set — cannot discover providers")
            sys.exit(1)
        conn = mssql_connect(conn_str)
        cursor = conn.cursor()
        cursor.execute("SELECT ProviderName FROM Provider WHERE Active = 'Y'")
        providers = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()

        if not providers:
            logger.error("No active providers found in database")
            sys.exit(1)

        logger.info(f"Starting {len(providers)} active provider thread(s): {providers}")

        threads = []
        for pname in providers:
            try:
                consumer = GenericTelemetryConsumer(provider_name=pname)
            except AttributeError as e:
                logger.warning(f"Skipping provider '{pname}': no adapter found ({e})")
                continue
            except Exception as e:
                logger.warning(f"Skipping provider '{pname}': init failed ({e})")
                continue
            t = threading.Thread(
                target=consumer.consume_and_insert,
                name=f"consumer-{pname}",
                daemon=True,
            )
            t.start()
            threads.append(t)
            logger.info(f"[OK] Started thread for provider: {pname}")

        try:
            for t in threads:
                t.join()
        except KeyboardInterrupt:
            logger.info("All consumers interrupted by user")

    parser = argparse.ArgumentParser(description='Generic Telemetry Consumer with Adapter Pattern')
    parser.add_argument('provider_name', type=str, nargs='?', default=None,
                        help='Provider name (e.g., Junction). Omit to run all active providers.')
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

    if args.provider_name is None:
        run_all_providers()
    else:
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
