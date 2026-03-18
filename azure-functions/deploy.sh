#!/bin/bash
# Deploy Azure Function: Generic Telemetry Consumer

echo "========================================================================"
echo "Deploying Azure Function: Telemetry Consumer (IoT Hub Trigger)"
echo "========================================================================"

FUNCTION_APP_NAME="vxt-telemetry-consumer"
RESOURCE_GROUP="VXT-IoT-Hub"
REGION="northeurope"

echo ""
echo "[1/4] Checking Azure CLI..."
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found. Install from: https://aka.ms/azure-cli"
    exit 1
fi

echo "✓ Azure CLI found"

echo ""
echo "[2/4] Checking Azure Functions Core Tools..."
if ! command -v func &> /dev/null; then
    echo "❌ Azure Functions Core Tools not found."
    echo "Install from: https://aka.ms/azure-functions-core-tools"
    exit 1
fi

echo "✓ Azure Functions Core Tools found"

echo ""
echo "[3/4] Installing Python dependencies..."
pip install -r requirements.txt

echo ""
echo "[4/4] Deploying function app..."
echo ""
echo "Function App: $FUNCTION_APP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo "Region: $REGION"
echo ""

# Check if function app exists
if az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP > /dev/null 2>&1; then
    echo "✓ Function app exists. Redeploying..."
    func azure functionapp publish $FUNCTION_APP_NAME --build remote
else
    echo "Creating new function app..."
    az functionapp create \
        --name $FUNCTION_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --runtime python \
        --runtime-version 3.11 \
        --functions-version 4 \
        --os-type Linux \
        --storage-account vxtsto
    
    echo "Deploying function code..."
    func azure functionapp publish $FUNCTION_APP_NAME --build remote
fi

echo ""
echo "========================================================================"
echo "✓ Deployment Complete!"
echo "========================================================================"
echo ""
echo "Function URL: https://$FUNCTION_APP_NAME.azurewebsites.net"
echo "Health Check: https://$FUNCTION_APP_NAME.azurewebsites.net/api/health"
echo ""
echo "Next steps:"
echo "1. Configure IoT Hub routing to this function"
echo "2. Set environment variables in Azure Portal:"
echo "   - DB_SERVER"
echo "   - DB_NAME"
echo "   - DB_USER"
echo "   - DB_PASSWORD"
echo "   - IoTHubConnectionString (optional)"
echo "3. Test by sending a message to IoT Hub"
echo ""
