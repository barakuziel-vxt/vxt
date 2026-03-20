# ============================================================================
# Azure VXT Deployment Automation Script
# Deploys Web App F1 + Function App Y1 with Python code deployment
# ============================================================================

param(
    [string]$SubscriptionName = "",
    [string]$ResourceGroup = "VXT-IoT-Hub",
    [string]$Location = "northeurope",
    [string]$WebAppName = "vxt-web-app",
    [string]$FunctionAppName = "vxt-function",
    [string]$StorageAccountName = "vxtstorage",
    [string]$SqlServerName = "vxtdb",
    [string]$SkuWebApp = "F1",
    [string]$SkuFunction = "Y1"
)

# ============================================================================
# COLORS FOR OUTPUT
# ============================================================================
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Reset = "`e[0m"

function Write-Status {
    param([string]$Message, [string]$Status)
    $icon = if ($Status -eq "success") { "✓" } else { "⚠" }
    $color = if ($Status -eq "success") { $Green } else { $Yellow }
    Write-Host "$color[$icon]$Reset $Message"
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "$Red[✗]$Reset $Message"
}

# ============================================================================
# STEP 1: CHECK PREREQUISITES
# ============================================================================
Write-Host "`n$Yellow=== STEP 1: Checking Prerequisites ===$Reset`n"

# Check Azure CLI
try {
    $cliVersion = az version --query '"azure-cli"' -o tsv
    Write-Status "Azure CLI installed (v$cliVersion)" "success"
} catch {
    Write-Error-Custom "Azure CLI not found. Install from: https://aka.ms/installazurecliwindows"
    exit 1
}

# Check if logged in
try {
    $user = az account show --query "user.name" -o tsv 2>$null
    if (-not $user) {
        throw "Not authenticated"
    }
    Write-Status "Logged in as: $user" "success"
} catch {
    Write-Host "$Yellow[!]$Reset Not authenticated. Initiating login..."
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Azure login failed"
        exit 1
    }
}

# ============================================================================
# STEP 2: SET SUBSCRIPTION
# ============================================================================
Write-Host "`n$Yellow=== STEP 2: Setting Subscription ===$Reset`n"

if ($SubscriptionName) {
    az account set --subscription "$SubscriptionName"
    Write-Status "Subscription set to: $SubscriptionName" "success"
} else {
    $current = az account show --query "name" -o tsv
    Write-Status "Using current subscription: $current" "success"
}

# Get Subscription ID for later use
$SubscriptionId = az account show --query "id" -o tsv

# ============================================================================
# STEP 3: CREATE RESOURCE GROUP
# ============================================================================
Write-Host "`n$Yellow=== STEP 3: Creating Resource Group ===$Reset`n"

$rgExists = az group exists --name $ResourceGroup
if ($rgExists -eq "true") {
    Write-Status "Resource group '$ResourceGroup' already exists" "success"
} else {
    Write-Host "Creating resource group '$ResourceGroup' in $Location..."
    az group create --name $ResourceGroup --location $Location
    Write-Status "Resource group created" "success"
}

# ============================================================================
# STEP 4: CREATE STORAGE ACCOUNT (for Function App)
# ============================================================================
Write-Host "`n$Yellow=== STEP 4: Creating Storage Account ===$Reset`n"

$storageExists = az storage account show --name $StorageAccountName --resource-group $ResourceGroup 2>$null
if ($storageExists) {
    Write-Status "Storage account '$StorageAccountName' already exists" "success"
} else {
    Write-Host "Creating storage account '$StorageAccountName'..."
    az storage account create `
        --name $StorageAccountName `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Standard_LRS
    Write-Status "Storage account created" "success"
}

# ============================================================================
# STEP 5: CREATE APP SERVICE PLAN
# ============================================================================
Write-Host "`n$Yellow=== STEP 5: Creating App Service Plans ===$Reset`n"

# Plan for Web App (Linux)
$webPlanName = "$WebAppName-plan"
$webPlanExists = az appservice plan show --name $webPlanName --resource-group $ResourceGroup 2>$null
if ($webPlanExists) {
    Write-Status "App Service plan '$webPlanName' already exists" "success"
} else {
    Write-Host "Creating Linux App Service plan for Web App..."
    az appservice plan create `
        --name $webPlanName `
        --resource-group $ResourceGroup `
        --sku "$($SkuWebApp)" `
        --is-linux
    Write-Status "Web App service plan created" "success"
}

# Plan for Function App (Consumption - no explicit plan needed)
Write-Status "Function App will use Consumption plan (Y1)" "success"

# ============================================================================
# STEP 6: CREATE WEB APP
# ============================================================================
Write-Host "`n$Yellow=== STEP 6: Creating Web App (F1) ===$Reset`n"

$webAppExists = az webapp show --name $WebAppName --resource-group $ResourceGroup 2>$null
if ($webAppExists) {
    Write-Status "Web App '$WebAppName' already exists" "success"
} else {
    Write-Host "Creating Web App '$WebAppName'..."
    az webapp create `
        --name $WebAppName `
        --resource-group $ResourceGroup `
        --plan $webPlanName `
        --runtime python:3.11
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Web App created" "success"
    } else {
        Write-Error-Custom "Web App creation failed"
    }
}

# ============================================================================
# STEP 7: CONFIGURE WEB APP SETTINGS
# ============================================================================
Write-Host "`n$Yellow=== STEP 7: Configuring Web App ===$Reset`n"

Write-Host "Configuring Web App environment variables..."

# Get SQL password (user input or from environment)
$SqlPassword = $env:SQL_PASSWORD
if (-not $SqlPassword) {
    Write-Host "$Yellow[?]$Reset Enter SQL Database password: " -NoNewline
    $SqlPassword = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
}

# Set App Settings
az webapp config appsettings set `
    --name $WebAppName `
    --resource-group $ResourceGroup `
    --settings `
        WEBSITES_PORT=8000 `
        ENVIRONMENT=production `
        SQL_CONNECTION_STRING="Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=vxtdb;Uid=vxtadmin;Pwd=$SqlPassword;"

Write-Status "Web App configured with environment variables" "success"

# Configure Python startup
Write-Host "Configuring Python startup command..."
az webapp config set `
    --name $WebAppName `
    --resource-group $ResourceGroup `
    --startup-file "gunicorn -w 4 -k uvicorn.workers.UvicornWorker api_flask:app"

Write-Status "Python startup configured" "success"

# ============================================================================
# STEP 8: CREATE FUNCTION APP
# ============================================================================
Write-Host "`n$Yellow=== STEP 8: Creating Function App (Y1) ===$Reset`n"

$funcAppExists = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup 2>$null
if ($funcAppExists) {
    Write-Status "Function App '$FunctionAppName' already exists" "success"
} else {
    Write-Host "Creating Function App '$FunctionAppName'..."
    az functionapp create `
        --name $FunctionAppName `
        --resource-group $ResourceGroup `
        --storage-account $StorageAccountName `
        --runtime python `
        --runtime-version 3.11 `
        --functions-version 4
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Function App created" "success"
    } else {
        Write-Error-Custom "Function App creation failed"
    }
}

# ============================================================================
# STEP 9: CONFIGURE FUNCTION APP SETTINGS
# ============================================================================
Write-Host "`n$Yellow=== STEP 9: Configuring Function App ===$Reset`n"

Write-Host "Configuring Function App environment variables..."

az functionapp config appsettings set `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --settings `
        WEBSITES_PORT=8000 `
        ENVIRONMENT=production `
        SQL_CONNECTION_STRING="Driver={ODBC Driver 17 for SQL Server};Server=vxtdb.database.windows.net,1433;Database=vxtdb;Uid=vxtadmin;Pwd=$SqlPassword;" `
        IOTHUB_CONNECTION_STRING=$env:IOTHUBROSTON_CONNECTION_STRING

Write-Status "Function App configured" "success"

# ============================================================================
# STEP 10: DISPLAY RESOURCE INFO
# ============================================================================
Write-Host "`n$Yellow=== STEP 10: Resource Summary ===$Reset`n"

Write-Host "$Green Web App URLs:$Reset"
$webAppUrl = az webapp show --name $WebAppName --resource-group $ResourceGroup --query "defaultHostName" -o tsv
Write-Host "  Production: https://$webAppUrl"
Write-Host "  Health Check: https://$webAppUrl/health"

Write-Host "`n$Green Function App URLs:$Reset"
$funcAppUrl = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup --query "defaultHostName" -o tsv
Write-Host "  Function App: https://$funcAppUrl"

Write-Host "`n$Green Resources:$Reset"
Write-Host "  Resource Group: $ResourceGroup"
Write-Host "  Location: $Location"
Write-Host "  Web App SKU: $SkuWebApp"
Write-Host "  Function App SKU: $SkuFunction (Consumption)"
Write-Host "  Storage Account: $StorageAccountName"

# ============================================================================
# STEP 11: POST-DEPLOYMENT INSTRUCTIONS
# ============================================================================
Write-Host "`n$Yellow=== STEP 11: Next Steps ===$Reset`n"

Write-Host "1. $Green Deploy Code (Web App):$Reset"
Write-Host "   - GitHub Actions will automatically deploy on push to prod branch"
Write-Host "   - Ensure AZURE_PUBLISH_PROFILE secret is configured in GitHub"

Write-Host "\n2. $Green Deploy Function App:$Reset"
Write-Host "   - GitHub Actions will automatically deploy on push to azure-functions/"
Write-Host "   - Ensure AZURE_CREDENTIALS secret is configured in GitHub"

Write-Host "\n3. $Green Test Health Endpoints:$Reset"
Write-Host "   curl https://$webAppUrl/health/db"
Write-Host "   curl https://$funcAppUrl/api/health"

Write-Host "`n$Green=== Deployment Script Complete ===$Reset`n"
