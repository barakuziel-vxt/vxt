#!/usr/bin/env pwsh

param(
    [string]$GitHubRepo = "https://github.com/barakuziel-vxt/vxt",
    [string]$Branch = "production",
    [string]$Location = "eastus"
)

Write-Host "YachtSense AI - Azure Deployment" -ForegroundColor Cyan
Write-Host ""

# Check Azure login
Write-Host "Checking Azure login..." -ForegroundColor Yellow
$account = az account show 2>&1 | ConvertFrom-Json
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green
$SubscriptionId = $account.id

# Configuration
$RgName = "vxt-resource-group"
$Storage = "vxtstorage$(Get-Random -Min 100 -Max 999)"
$FuncApp = "vxt-api-functions-$(Get-Random -Min 1000 -Max 9999)"
$AppPlan = "vxt-app-plan"
$AppService = "vxt-admin-dashboard-$(Get-Random -Min 1000 -Max 9999)"

Write-Host ""
Write-Host "Deployment Configuration:" -ForegroundColor Cyan
Write-Host "  Subscription: $SubscriptionId"
Write-Host "  GitHub: $GitHubRepo ($Branch branch)"
Write-Host "  Location: $Location"
Write-Host "  Resources:"
Write-Host "    - Resource Group: $RgName"
Write-Host "    - Storage: $Storage"
Write-Host "    - Function App: $FuncApp"
Write-Host "    - App Service: $AppService"
Write-Host ""

# Phase 1: Create Resources
Write-Host "Phase 1: Creating Azure Resources..." -ForegroundColor Cyan
az account set --subscription $SubscriptionId
az group create --name $RgName --location $Location
az storage account create --name $Storage --resource-group $RgName --location $Location --sku Standard_LRS
az functionapp create --resource-group $RgName --consumption-plan-location $Location --runtime python --runtime-version 3.11 --functions-version 4 --name $FuncApp --storage-account $Storage --os-type Linux
az appservice plan create --name $AppPlan --resource-group $RgName --sku FREE --is-linux
az appservice web create --name $AppService --resource-group $RgName --plan $AppPlan --runtime "node:18LTS"
Write-Host "Resources created successfully" -ForegroundColor Green

# Phase 2: Configure Functions
Write-Host ""
Write-Host "Phase 2: Configuring Functions..." -ForegroundColor Cyan
$SqlConnStr = "Server=tcp:vxtdb.database.windows.net,1433;Initial Catalog=free-sql-db-5949639;Persist Security Info=False;User ID=vxt;Password=Barak1976!;Encrypt=True;Connection Timeout=30;"
az functionapp config appsettings set --name $FuncApp --resource-group $RgName --settings "AzureSqlConnectionString=$SqlConnStr" "Environment=prod"
az functionapp cors add --name $FuncApp --resource-group $RgName --allowed-origins "http://localhost:3001" "http://localhost:5173" "https://$AppService.azurewebsites.net"
Write-Host "Functions configured" -ForegroundColor Green

# Phase 3: Deploy React Dashboard
Write-Host ""
Write-Host "Phase 3: Deploying React Dashboard..." -ForegroundColor Cyan
$TempPath = [System.IO.Path]::GetTempPath() + "vxt-deploy"
if (Test-Path $TempPath) { Remove-Item $TempPath -Recurse -Force }
git clone --branch main $GitHubRepo $TempPath
$DashPath = "$TempPath/admin-dashboard"
Push-Location $DashPath
npm install
$ApiUrl = "https://$FuncApp.azurewebsites.net/api"
[System.Environment]::SetEnvironmentVariable("VITE_API_BASE_URL", $ApiUrl, "Process")
npm run build
$ZipPath = "$TempPath/app.zip"
Compress-Archive -Path "dist/*" -DestinationPath $ZipPath -Force
az webapp deployment source config-zip --resource-group $RgName --name $AppService --src $ZipPath
Pop-Location
Remove-Item $TempPath -Recurse -Force
Write-Host "Dashboard deployed" -ForegroundColor Green

# Phase 4: Update SQL
Write-Host ""
Write-Host "Phase 4: Updating SQL Schema..." -ForegroundColor Cyan
$SqlContent = @"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CustomerEntities' AND COLUMN_NAME = 'iotDeviceId')
BEGIN
    ALTER TABLE CustomerEntities ADD iotDeviceId NVARCHAR(128) NULL;
END
UPDATE CustomerEntities SET iotDeviceId = CASE WHEN entityId = '033114869' THEN 'vessel-033114869' WHEN entityId = '234567890' THEN 'TomerRefael' WHEN entityId = '234567891' THEN 'vessel-234567891' ELSE NULL END WHERE iotDeviceId IS NULL;
SELECT COUNT(DISTINCT entityId) as TotalEntities, SUM(CASE WHEN iotDeviceId IS NOT NULL THEN 1 ELSE 0 END) as EntitiesWithDeviceIDs FROM CustomerEntities;
"@
$SqlConn = New-Object System.Data.SqlClient.SqlConnection($SqlConnStr)
$SqlConn.Open()
$SqlCmd = $SqlConn.CreateCommand()
$SqlCmd.CommandText = $SqlContent
$SqlCmd.ExecuteNonQuery() | Out-Null
$SqlConn.Close()
Write-Host "SQL Schema updated" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Live URLs:" -ForegroundColor Yellow
Write-Host "  Dashboard: https://$AppService.azurewebsites.net" -ForegroundColor Cyan
Write-Host "  API:       https://$FuncApp.azurewebsites.net/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "Resources Created:" -ForegroundColor Yellow
Write-Host "  Resource Group: $RgName" -ForegroundColor Cyan
Write-Host "  Storage:        $Storage (1-2 dollars/month)" -ForegroundColor Cyan  
Write-Host "  Function App:   $FuncApp (FREE - 1M calls/month)" -ForegroundColor Cyan
Write-Host "  App Service:    $AppService (FREE F1 tier)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Visit dashboard: https://$AppService.azurewebsites.net" -ForegroundColor Cyan
Write-Host "  2. Test IoT Device ID sync feature" -ForegroundColor Cyan
Write-Host "  3. Monitor in Azure Portal" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Monthly Cost: Approximately 1-3 dollars (FREE tier resources)" -ForegroundColor Green
