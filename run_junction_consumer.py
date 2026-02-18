#!/usr/bin/env python
"""
Junction Provider Consumer - Uses GenericTelemetryConsumer with Junction provider
"""

from generic_telemetry_consumer import GenericTelemetryConsumer
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    consumer = GenericTelemetryConsumer(
        provider_name="Junction",
        db_server='localhost',
        db_name='BoatTelemetryDB',
        db_user='sa',
        db_password='YourStrongPassword123!'
    )
    consumer.consume_and_insert()
