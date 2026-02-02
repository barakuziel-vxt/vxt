# Architecture

High-level components:
- Producers: `boat_simulator_*` publish telemetry (will use Event Hubs / Kafka API on Azure)
- Consumers: `boat_consumer.py` subscribes to telemetry
- Anomaly detection: `anomaly_detector.py` (Python)
- API services: `api_simple.py`, `api_flask.py`, `api_httpserver.py` (expose telemetry and anomalies)
- Dashboard: React app at `boat-dashboard` (static web app)

Planned Azure components:
- Event Hubs namespace (Kafka API)
- Azure Functions (Python) triggered by Event Hubs
- Azure SQL for persistent storage
- Static Web App / Blob Storage to host the dashboard
