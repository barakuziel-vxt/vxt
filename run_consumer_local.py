#!/usr/bin/env python3
"""
Local Kafka Consumer Runner
===========================
Mirrors the Azure Function (azure-functions/function_app.py) for local development.

Transport:  Kafka (Redpanda) — replaces Azure IoT Hub Event Hub trigger
Logic:      Imports SimpleEventProcessor directly from azure-functions/function_app.py
            → single source of truth for all DB INSERT logic

Usage:
    python run_consumer_local.py [signalk|junction|<provider_name>]

Environment (from .env or shell):
    ENVIRONMENT=local        — enables SQL auth instead of Managed Identity
    DB_SERVER=localhost
    DB_NAME=BoatTelemetryDB
    DB_USER=sa
    DB_PASSWORD=YourStrongPassword123!
    PROVIDER_NAME=N2KToSignalK
    KAFKA_BOOTSTRAP=localhost:9092
"""

import json
import logging
import os
import sys
import time
from kafka import KafkaConsumer, KafkaAdminClient
from kafka.admin import NewTopic
from kafka.errors import TopicAlreadyExistsError
from dotenv import load_dotenv

# Load .env for local dev
load_dotenv()

# ── Configure logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(name)s %(levelname)s %(message)s'
)
logger = logging.getLogger('LocalConsumer')

# ── Import the prod processor (single source of truth) ──────────────────────
# Temporarily add azure-functions to path so we can import function_app
_FUNC_DIR = os.path.join(os.path.dirname(__file__), 'azure-functions')
if _FUNC_DIR not in sys.path:
    sys.path.insert(0, _FUNC_DIR)

from function_app import SimpleEventProcessor  # noqa: E402


# ── Topic → Provider mapping ─────────────────────────────────────────────────
PROVIDER_TOPICS = {
    'N2KToSignalK':  'signalk-telemetry',
    'signalk':       'signalk-telemetry',
    'Junction':      'junction-events',
    'junction':      'junction-events',
}


def ensure_topic(bootstrap: str, topic: str):
    """Create Kafka topic if it doesn't exist (idempotent)."""
    try:
        admin = KafkaAdminClient(bootstrap_servers=bootstrap)
        admin.create_topics([NewTopic(name=topic, num_partitions=1, replication_factor=1)])
        logger.info(f"[Kafka] Created topic: {topic}")
        admin.close()
    except TopicAlreadyExistsError:
        pass
    except Exception as e:
        logger.warning(f"[Kafka] Could not create topic '{topic}': {e}")


def run(provider_name: str):
    bootstrap   = os.environ.get('KAFKA_BOOTSTRAP', 'localhost:9092')
    db_server   = os.environ.get('DB_SERVER', 'localhost')
    db_name     = os.environ.get('DB_NAME', 'BoatTelemetryDB')

    topic = PROVIDER_TOPICS.get(provider_name, f"{provider_name.lower()}-telemetry")

    logger.info(f"[LocalConsumer] Provider : {provider_name}")
    logger.info(f"[LocalConsumer] Topic    : {topic}")
    logger.info(f"[LocalConsumer] DB       : {db_server}/{db_name}")
    logger.info(f"[LocalConsumer] Broker   : {bootstrap}")

    # Ensure topic exists
    ensure_topic(bootstrap, topic)

    # Build the same processor that runs in Azure (sets ENVIRONMENT locally via .env)
    os.environ.setdefault('ENVIRONMENT', 'local')
    os.environ.setdefault('DB_SERVER', db_server)
    os.environ.setdefault('DB_NAME', db_name)
    os.environ.setdefault('PROVIDER_NAME', provider_name)

    processor = SimpleEventProcessor(
        db_server=db_server,
        db_name=db_name,
        provider_name=provider_name,
    )

    # Connect to Kafka with retry
    consumer = None
    for attempt in range(1, 16):
        try:
            consumer = KafkaConsumer(
                topic,
                bootstrap_servers=bootstrap,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                group_id=f"local-consumer-{provider_name.lower()}",
                auto_offset_reset='earliest',
                enable_auto_commit=False,
                consumer_timeout_ms=-1,
                request_timeout_ms=30000,
                session_timeout_ms=10000,
            )
            logger.info(f"[Kafka] Connected on attempt {attempt}")
            break
        except Exception as e:
            backoff = min(3 * (2 ** (attempt - 1)), 30)
            logger.warning(f"[Kafka] Connection failed ({attempt}/15): {e} — retry in {backoff}s")
            time.sleep(backoff)

    if consumer is None:
        logger.error("[Kafka] Could not connect after 15 attempts. Exiting.")
        sys.exit(1)

    logger.info("[LocalConsumer] Consuming…  (Ctrl-C to stop)")
    try:
        for message in consumer:
            try:
                event_payload = message.value or {}
                # Inject deviceId from Kafka metadata if absent (mirrors IoT Hub behaviour)
                if 'deviceId' not in event_payload:
                    event_payload['deviceId'] = f"local-{topic}"

                inserted = processor.process_event(event_payload)

                stats = processor.get_stats()
                if stats['events_processed'] % 10 == 0:
                    logger.info(
                        f"[Stats] processed={stats['events_processed']} "
                        f"inserted={stats['records_inserted']} "
                        f"skipped={stats['records_skipped']} "
                        f"failed={stats['records_failed']}"
                    )

                consumer.commit()

            except Exception as e:
                logger.error(f"[Error] processing message: {e}")
                continue

    except KeyboardInterrupt:
        logger.info("[LocalConsumer] Stopped by user")
    finally:
        stats = processor.get_stats()
        logger.info(
            f"[Final Stats] processed={stats['events_processed']} "
            f"inserted={stats['records_inserted']} "
            f"skipped={stats['records_skipped']} "
            f"failed={stats['records_failed']}"
        )
        consumer.close()


if __name__ == '__main__':
    provider = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('PROVIDER_NAME', 'N2KToSignalK')
    run(provider)
