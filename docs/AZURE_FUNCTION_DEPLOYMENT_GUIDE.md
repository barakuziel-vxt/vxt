# Azure Function Deployment Guide

## Architecture Overview

```
Azure IoT Hub (1M events/month free)
        ↓
Azure Functions (Python runtime)
        ├─ Function 1: Junction Events → TelemetryProcessor → SQL
        └─ Function 2: SignalK Events → TelemetryProcessor → SQL
        ↓
Azure SQL Database (already provisioned)
```

---

## Phase 1: Prepare Functions Locally

### 1.1 Test TelemetryProcessor Locally

Ensure the refactored `generic_telemetry_consumer.py` still works with Kafka:

```bash
cd C:\VXT

# Install dependencies if needed (already in venv)
pip install kafka-python pyodbc

# Test with Junction provider
python -c "
from telemetry_processor import TelemetryProcessor
processor = TelemetryProcessor('Junction')
print(f'Processor initialized: {processor.provider_config}')
print(f'Cached entities: {len(processor.entity_cache)}')
print(f'Statistics: {processor.get_stats()}')
"
```

Expected output:
```
[OK] Resolved provider name 'Junction' to provider ID 1
[OK] TelemetryProcessor initialized: {...}
[OK] Cached entities: 2
Statistics: {'events_processed': 0, ...}
```

### 1.2 Verify Kafka Consumer Still Works

```bash
# Run the refactored Kafka consumer
python run_junction_consumer.py
```

It should connect and start consuming using TelemetryProcessor internally.

---

## Phase 2: Create Azure Functions Project

### 2.1 Create Local Functions Project

First, install Azure Functions Core Tools:
https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local

```bash
# Create new Functions project
func init YachtSenseAzureFunctions --python

cd YachtSenseAzureFunctions

# Create IoT Hub trigger function for Junction
func new --name process_junction_events --template "Azure IoT Hub (Event Hub)"

# Create IoT Hub trigger function for SignalK  
func new --name process_signalk_events --template "Azure IoT Hub (Event Hub)"
```

### 2.2 Project Structure

```
YachtSenseAzureFunctions/
├── process_junction_events/
│   ├── __init__.py           # Function code
│   └── function_app.py       # Function definition
├── process_signalk_events/
│   ├── __init__.py
│   └── function_app.py
├── requirements.txt          # Python dependencies
├── host.json                 # Function host config
├── local.settings.json       # Local dev settings
└── .funcignore
```

### 2.3 Add Dependencies

Edit `requirements.txt`:

```
azure-functions
pyodbc
jsonpath-ng
```

Then install:

```bash
pip install -r requirements.txt
```

### 2.4 Copy Project Files

Copy these files from C:\VXT to the Functions project root:

```bash
# From C:\VXT
copy telemetry_processor.py YachtSenseAzureFunctions\
copy provider_adapters.py YachtSenseAzureFunctions\
```

### 2.5 Update Function Code

For `process_junction_events/function_app.py`:

```python
import azure.functions as func
import json
import logging
import os
from telemetry_processor import TelemetryProcessor

# Get environment variables (set in Azure)
DB_SERVER = os.environ.get('DB_SERVER', 'vxtdb.database.windows.net')
DB_NAME = os.environ.get('DB_NAME', 'free-sql-db-5949639')
DB_USER = os.environ.get('DB_USER', 'vxt')
DB_PASSWORD = os.environ.get('DB_PASSWORD')

# Initialize processor (reused across invocations)
processor = TelemetryProcessor(
    provider_name='Junction',
    db_server=DB_SERVER,
    db_name=DB_NAME,
    db_user=DB_USER,
    db_password=DB_PASSWORD
)

@func.trigger_variables(binding_name='messages')
async def process_junction_events(messages: func.InputStream) -> None:
    """Process Junction health provider events from IoT Hub"""
    
    logger = logging.getLogger(__name__)
    
    for message in messages:
        try:
            event_data = json.loads(message.getvalue())
            logger.info(f'Processing Junction event: {event_data}')
            
            inserted_count = processor.process_event(event_data)
            logger.info(f'Inserted {inserted_count} records')
            
        except Exception as e:
            logger.error(f'Error processing message: {e}')
```

For `process_signalk_events/function_app.py`, do the same but with `provider_name='SignalK'`.

### 2.6 Local Testing

Test locally with Azure Functions Core Tools:

```bash
# Set environment variables
set DB_SERVER=127.0.0.1
set DB_NAME=BoatTelemetryDB
set DB_USER=sa
set DB_PASSWORD=YourStrongPassword123!

# Start local Functions runtime
func start
```

The functions will be available at:
- `http://localhost:7071/api/process_junction_events`
- `http://localhost:7071/api/process_signalk_events`

---

## Phase 3: Deploy to Azure

### 3.1 Create Resource Group and Function App

```bash
# Login to Azure
az login

# Create resource group
az group create --name YachtSenseRG --location eastus

# Create Function App (Python, Consumption plan - always within free tier)
az functionapp create \
  --resource-group YachtSenseRG \
  --consumption-plan-location eastus \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --name yachtsense-functions \
  --storage-account <create-new-storage-account>
```

### 3.2 Deploy Functions

```bash
# Publish functions to Azure
func azure functionapp publish yachtsense-functions

# Or use Visual Studio Code Azure Functions extension for GUI deployment
```

### 3.3 Configure Application Settings

Set secure connection strings in Azure:

```bash
az functionapp config appsettings set \
  --name yachtsense-functions \
  --resource-group YachtSenseRG \
  --settings \
    DB_SERVER=vxtdb.database.windows.net \
    DB_NAME=free-sql-db-5949639 \
    DB_USER=vxt \
    DB_PASSWORD=Barak1976! \
    FUNCTIONS_EXTENSION_VERSION=~4 \
    FUNCTIONS_WORKER_RUNTIME=python
```

### 3.4 Configure IoT Hub Routing

Set up IoT Hub to route device messages to your Functions:

1. Go to Azure Portal → IoT Hub → Message routing
2. Create route:
   - Name: `route_to_functions`
   - Data source: `Device Telemetry Messages`
   - Endpoint: Select your Function App endpoint
   - Condition: Leave empty (route all messages)
   - Enable: Yes

---

## Phase 4: Test End-to-End

### 4.1 Send Test Message from Raspberry Pi

From Raspberry Pi:

```bash
az iot device send-d2c-message \
  --hub-name VXT-IoT-Hub \
  --device-id TomerRefael \
  --data '{"provider":"Junction","entityId":"033114869","heartRate":72,"timestamp":"2026-02-15T10:00:00Z"}'
```

### 4.2 Monitor Function Execution

Azure Portal → Function App → Monitor:
- Check invocation logs
- View execution duration
- Track success/error rates

### 4.3 Verify Database

Query Azure SQL to see inserted records:

```sql
-- Check EntityTelemetry table
SELECT TOP 10 
  entityId, 
  entityTypeAttributeId, 
  numericValue, 
  startTimestampUTC
FROM dbo.EntityTelemetry
ORDER BY startTimestampUTC DESC
```

---

## Local Development Mode (Ongoing)

Keep testing locally before deploying:

```bash
# Terminal 1: Start Docker SQL Edge
docker-compose up -d

# Terminal 2: Start Kafka consumer (uses new TelemetryProcessor)
python run_junction_consumer.py

# Terminal 3: Start simulators to send test events
python Simulate_Junction_health_provider_Barak.py
```

All three still work exactly as before - `generic_telemetry_consumer.py` now internally uses `TelemetryProcessor`.

---

## Cost Analysis (Free Tier)

| Component | Free Quota | Monthly Cost |
|-----------|-----------|------------|
| IoT Hub | 1M messages | $0 |
| Azure Functions | 1M executions | $0 |
| App Service (API) | F1 (1 instance) | $0 |
| Static Web Apps (React) | Free tier | $0 |
| SQL Database | Free tier (1GB) | $0 |
| **Total Monthly** | | **$0** |

All limits calculated for 33k events/day (1M/month) = within free tier.

---

## Troubleshooting

### Function not triggering from IoT Hub

- Check IoT Hub → Endpoints → Events → Consumer groups
- Verify routing rule is enabled
- Check Function → Monitor for errors

### Database connection timeout

- Verify Azure SQL firewall rules allow Function App IP
- Check database credentials in application settings
- Ensure SQL Server is accepting connections

### Out of sync: Local vs Production

- Local: Using local SQL edge database
- Production: Using Azure SQL database
- Ensure both have same schema (they should from sync_missing_records.py)
- Never run simulators against production!

---

## Next Steps

1. ✅ Extract TelemetryProcessor (DONE)
2. ✅ Refactor Kafka consumer (DONE)
3. ⏳ Create Azure Functions project (above)
4. ⏳ Deploy to Azure (above)
5. ⏳ Configure IoT Hub routing (above)
6. ⏳ Deploy FastAPI to App Service F1
7. ⏳ Deploy React to Static Web Apps

You can stop here for now and proceed with deploying FastAPI/React if you prefer, or continue with Azure Functions. Let me know your priority!
