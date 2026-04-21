# generic_telemetry_consumer.py
"""
Kafka Consumer Wrapper — Local Development
==========================================
Thin Kafka consumer with ZERO protocol logic.

All telemetry processing lives in azure-functions/telemetry_engine.py — the
same engine used by the production Azure Function (function_app.py, IoT Hub
trigger).  This wrapper only handles:
  - Discovering active Kafka topics from the Provider table
  - Polling Kafka and deserialising JSON frames
  - Routing eventCode payloads → process_event_message()
  - Routing all other payloads   → SimpleEventProcessor.process_event()
  - Committing offsets and logging stats

To add a new protocol (SignalK path, LOINC code, etc.):
  1. Add/update EntityTypeAttribute rows in the DB — that's it.
  2. If it's a brand-new wire protocol, add an adapter to
     azure-functions/protocol_adapters.py and register it in ADAPTERS.

No changes to this file are ever needed for new telemetry attributes.
"""

# ---------------------------------------------------------------------------
# Env setup MUST happen before telemetry_engine is imported so that module-
# level constants (API_BASE_URL, etc.) pick up the local values.
# ---------------------------------------------------------------------------
import os
from dotenv import load_dotenv

load_dotenv()                                           # pick up .env file first
os.environ.setdefault('ENVIRONMENT', 'local')          # SA auth, not Managed Identity
os.environ.setdefault('DB_SERVER',   'localhost')
os.environ.setdefault('DB_NAME',     'BoatTelemetryDB')
os.environ.setdefault('DB_USER',     'sa')
os.environ.setdefault('DB_PASSWORD', 'YourStrongPassword123!')
os.environ.setdefault('API_BASE_URL', 'http://localhost:8000')  # local FastAPI

# ---------------------------------------------------------------------------
# Add azure-functions/ to sys.path so we can import telemetry_engine and
# protocol_adapters without copying them.
# ---------------------------------------------------------------------------
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'azure-functions'))

from telemetry_engine import (          # noqa: E402  (must come after sys.path setup)
    SimpleEventProcessor,
    auto_detect_provider,
    process_event_message,
)

import json
import logging
import threading
import time
from kafka import KafkaConsumer

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Topic discovery
# ---------------------------------------------------------------------------

def _get_active_topics() -> list:
    """Return all distinct TopicName values from active Provider rows."""
    from mssql_python import connect
    conn_str = os.environ.get(
        'SQL_CONNECTION_STRING',
        f"Server={os.environ['DB_SERVER']},1433;"
        f"Database={os.environ['DB_NAME']};"
        f"UID={os.environ['DB_USER']};"
        f"PWD={os.environ['DB_PASSWORD']};"
        "Encrypt=no;TrustServerCertificate=yes;",
    )
    conn = connect(conn_str)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT DISTINCT TopicName FROM Provider "
        "WHERE Active = 'Y' AND TopicName IS NOT NULL"
    )
    topics = [row[0] for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return topics


# ---------------------------------------------------------------------------
# Consumer loop
# ---------------------------------------------------------------------------

def run_consumer(bootstrap_servers: str = 'localhost:9092') -> None:
    """Single consumer loop — subscribes to all active topics at once."""
    topics = _get_active_topics()
    if not topics:
        logger.error("[KAFKA] No active topics found in Provider table — exiting")
        return

    logger.info(f"[KAFKA] Subscribing to topics: {topics}")

    processor = SimpleEventProcessor(
        db_server=os.environ['DB_SERVER'],
        db_name=os.environ['DB_NAME'],
        provider_name='KafkaLocal',
    )

    consumer = KafkaConsumer(
        *topics,
        bootstrap_servers=bootstrap_servers,
        value_deserializer=lambda m: json.loads(m.decode('utf-8')),
        group_id='kafka-consumer-wrapper',
        auto_offset_reset='latest',  # only consume new messages; avoids replaying stale historical data
        enable_auto_commit=False,
        consumer_timeout_ms=-1,
        request_timeout_ms=30000,
        session_timeout_ms=10000,
        connections_max_idle_ms=540000,
    )

    logger.info("[KAFKA] Consumer started — waiting for messages...")

    try:
        for message in consumer:
            try:
                event = message.value

                # Route: orchestrator events → EventLog via API
                #        all other events    → EntityTelemetry via processor
                if isinstance(event, dict) and 'eventCode' in event:
                    ok = process_event_message(event)
                    logger.debug(f"[EVENT] topic={message.topic} routed={ok}")
                else:
                    processor.process_event(event)

                consumer.commit()

                stats = processor.get_stats()
                if stats['events_processed'] % 25 == 0 and stats['events_processed'] > 0:
                    logger.info(
                        f"[STATS] topic={message.topic} | "
                        f"events={stats['events_processed']} "
                        f"inserted={stats['records_inserted']} "
                        f"skipped={stats['records_skipped']} "
                        f"failed={stats['records_failed']}"
                    )

            except Exception as e:
                logger.error(f"[KAFKA] Error processing message: {e}")
                continue

    except KeyboardInterrupt:
        logger.info("[KAFKA] Consumer stopped by user")
    finally:
        consumer.close()
        processor.print_stats()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Kafka Telemetry Consumer (local dev wrapper)')
    parser.add_argument('--bootstrap-servers', default='localhost:9092',
                        help='Kafka bootstrap servers (default: localhost:9092)')
    parser.add_argument('--log-level', default='INFO',
                        help='Log level (default: INFO)')
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format='%(asctime)s - %(levelname)s - %(message)s',
    )

    run_consumer(bootstrap_servers=args.bootstrap_servers)

