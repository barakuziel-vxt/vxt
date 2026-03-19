# Azure Function: Generic Telemetry Consumer

## Overview

This Azure Function acts as a generic consumer that listens to IoT Hub events and processes them into Azure SQL Database.

```
Raspberry Pi → IoT Hub → Azure Function → SQL Database
     ↑                                          ↓
     └─ Sends telemetry via SignalK format     └─ Stores in EntityTelemetry table
```

## Architecture

- **Trigger**: Azure IoT Hub (Event Hub-compatible trigger)
- **Provider**: N2KToSignalK (maritime protocol - SignalK format)
- **Processor**: SimpleEventProcessor (processes events into SQL)
- **Target**: Azure SQL Database (EntityTelemetry table)

## Features

✓ **IoT Hub trigger** - Processes messages in real-time
✓ **Database retry** - Handles temporary connection timeouts
✓ **Health endpoint** - Check function status via HTTP
✓ **Async processing** - Handles multiple messages in batch
✓ **Logging** - Full diagnostic logging for troubleshooting

## Configuration

### Environment Variables (Azure Portal)

Set these in your Function App configuration:

```
DB_SERVER           = vxtdb.database.windows.net
DB_NAME             = vxtdb  
DB_USER             = vxtadmin
DB_PASSWORD         = [your_database_password]
PROVIDER_NAME       = N2KToSignalK
IoTHubConnectionString = [your_iot_hub_connection_string]
```

### IoT Hub Routing (Azure Portal)

1. Go to **IoT Hub → Message Routing → Routes**
2. Create a new route:
   - **Name**: `telemetry-consumer`
   - **Source**: `IoT Hub Messages`
   - **Endpoint**: Select your function app
   - **Query**: `properties.provider = 'N2KToSignalK'` (or leave empty for all)

## Deployment

### Option 1: PowerShell (Windows) - RECOMMENDED

```powershell
cd c:\VXT\azure-functions
.\deploy.ps1
```

### Option 2: Bash (Linux/Mac)

```bash
cd /path/to/azure-functions
chmod +x deploy.sh
./deploy.sh
```

### Option 3: Manual

```bash
# Install dependencies
pip install -r requirements.txt

# Deploy to Azure
func azure functionapp publish vxt-telemetry-consumer --build remote
```

## Testing

### Local Testing

```bash
# Start function locally
func start

# In another terminal, send a test message
curl -X POST http://localhost:7071/api/test \
  -H "Content-Type: application/json" \
  -d '{
    "entityId": "234567890",
    "timestamp": "2026-03-18T12:00:00Z",
    "values": {
      "latitude": 59.5,
      "longitude": 18.5,
      "sog": 10.5
    }
  }'
```

### Health Check (Production)

```bash
curl https://vxt-telemetry-consumer.azurewebsites.net/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "provider": "N2KToSignalK",
  "stats": {
    "events_processed": 125,
    "records_inserted": 450,
    "records_skipped": 5,
    "errors": 0
  }
}
```

## Event Format

The function expects events in this format:

```json
{
  "entityId": "234567890",
  "timestamp": "2026-03-18T12:00:00Z",
  "values": {
    "latitude": 59.5,
    "longitude": 18.5,
    "sog": 10.68,
    "cog": 245.5,
    "waterTemp": 18.5
  }
}
```

Or using older field names:

```json
{
  "mmsi": "234567890",
  "timestamp": "2026-03-18T12:00:00Z",
  "data": {
    "latitude": 59.5,
    "longitude": 18.5
  }
}
```

## Processing Logic

1. **Validation**: Check that event has entityId/mmsi
2. **Connection**: Connect to Azure SQL with automatic retry
3. **Extraction**: Extract telemetry values from `values` or `data` object
4. **Insertion**: Insert each key-value pair into EntityTelemetry table
5. **Logging**: Log success/failure with stats

## Troubleshooting

### Function not triggering

Check:
- IoT Hub routing rule is configured correctly
- Function app is running (status in Azure Portal)
- IoT Hub connection string is set
- Security rules allow access

### Database connection errors

Check:
- DB credentials in App Settings
- SQL Server firewall rule allows Azure services
- Database actually exists
- EntityTelemetry table is created

### Performance issues

If function is slow:
1. Check database query performance
2. Increase timeout in get_db_connection()
3. Consider batching inserts
4. Scale function plan upward

## Future Enhancements

- [ ] Implement TelemetryProcessor for format conversion
- [ ] Add Device Twin configuration support
- [ ] Implement batch inserts for better performance
- [ ] Add Azure Key Vault for secrets management
- [ ] Add Application Insights monitoring
- [ ] Implement multi-provider routing

## References

- [Azure Functions Python v2 Model](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python)
- [IoT Hub Message Routing](https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-message-routing-overview)
- [SignalK Specification](https://signalk.org/specification/)
