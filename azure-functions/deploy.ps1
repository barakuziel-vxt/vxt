# Deploy Azure Function: Generic Telemetry Consumer
# PowerShell deployment script for Windows

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "Deploying Azure Function: Telemetry Consumer (IoT Hub Trigger)" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""

$FUNCTION_APP_NAME = "vxt-telemetry-consumer"
$RESOURCE_GROUP = "VXT-IoT-Hub"
$REGION = "northeurope"
$STORAGE_ACCOUNT = "vxtsto"

# Step 1: Check Azure CLI
Write-Host "[1/5] Checking Azure CLI..." -ForegroundColor Yellow
try {
    $azVersion = az version 2>&1 | Select-Object -First 1
    Write-Host "✓ Azure CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Azure CLI not found. Install from: https://aka.ms/azure-cli" -ForegroundColor Red
    exit 1
}

# Step 2: Check Azure Functions Core Tools
Write-Host "[2/5] Checking Azure Functions Core Tools..." -ForegroundColor Yellow
try {
    $funcVersion = func --version 2>&1
    Write-Host "✓ Azure Functions Core Tools found: $funcVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Azure Functions Core Tools not found." -ForegroundColor Red
    Write-Host "   Install from: https://aka.ms/azure-functions-core-tools" -ForegroundColor Red
    exit 1
}

# Step 3: Install dependencies
Write-Host "[3/5] Installing Python dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Step 4: Check if function app exists
Write-Host "[4/5] Checking function app..." -ForegroundColor Yellow
$functionAppExists = az functionapp show `
    --name $FUNCTION_APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --query "id" `
    --output tsv 2>&1

if ($LASTEXITCODE -eq 0 -and $functionAppExists) {
    Write-Host "✓ Function app exists: $FUNCTION_APP_NAME" -ForegroundColor Green
    Write-Host "  Redeploying code..." -ForegroundColor Cyan
    func azure functionapp publish $FUNCTION_APP_NAME --build remote --verbose
} else {
    Write-Host "Creating new function app..." -ForegroundColor Cyan
    az functionapp create `
        --name $FUNCTION_APP_NAME `
        --resource-group $RESOURCE_GROUP `
        --runtime python `
        --runtime-version 3.11 `
        --functions-version 4 `
        --os-type Linux `
        --storage-account $STORAGE_ACCOUNT | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Function app created" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create function app" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Deploying function code..." -ForegroundColor Cyan
    func azure functionapp publish $FUNCTION_APP_NAME --build remote --verbose
}

# Step 5: Configure app settings
Write-Host "[5/5] Configuring application settings..." -ForegroundColor Yellow
az functionapp config appsettings set `
    --name $FUNCTION_APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --settings `
        DB_SERVER="vxtdb.database.windows.net" `
        DB_NAME="vxtdb" `
        DB_USER="vxtadmin" `
        DB_PASSWORD=$(Get-Content -Path "local.settings.json" | ConvertFrom-Json | Select-Object -ExpandProperty Values | Select-Object -ExpandProperty DB_PASSWORD) `
        PROVIDER_NAME="N2KToSignalK" | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ App settings configured" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Green
Write-Host "✓ Deployment Complete!" -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Function Details:" -ForegroundColor Cyan
Write-Host "  Function App: $FUNCTION_APP_NAME" -ForegroundColor White
Write-Host "  URL: https://$FUNCTION_APP_NAME.azurewebsites.net" -ForegroundColor White
Write-Host "  Health: https://$FUNCTION_APP_NAME.azurewebsites.net/api/health" -ForegroundColor White
Write-Host "  Resource Group: $RESOURCE_GROUP" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Go to Azure Portal → IoT Hub → Message Routing" -ForegroundColor White
Write-Host "2. Create a new route with:" -ForegroundColor White
Write-Host "   - Source: IoT Hub Messages" -ForegroundColor White
Write-Host "   - Endpoint: $FUNCTION_APP_NAME" -ForegroundColor White
Write-Host "   - Query: properties.provider = 'N2KToSignalK' (or leave blank for all)" -ForegroundColor White
Write-Host "3. Test by sending a message to IoT Hub from Raspberry Pi" -ForegroundColor White
Write-Host ""
