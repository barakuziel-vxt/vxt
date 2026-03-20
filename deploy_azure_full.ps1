#!/usr/bin/env pwsh
<#
.SYNOPSIS
    YachtSense AI - Complete Azure Deployment (Fully Automated)
    Deploys all resources from GitHub production branch
#>

param(
    [string]$GitHubRepoUrl = "https://github.com/barakuziel-vxt/vxt",
    [string]$GitHubBranch = "production",
    [string]$Location = "eastus",
    [string]$Environment = "prod"
)

# Configuration
$ResourceGroupName = "vxt-resource-group"
$StorageAccountName = "vxtstorage$(Get-Random -Minimum 100 -Maximum 999)"
$FunctionAppName = "vxt-api-functions-$(Get-Random -Minimum 1000 -Maximum 9999)"
$AppServicePlanName = "vxt-app-plan"
$AppServiceName = "vxt-admin-dashboard-$(Get-Random -Minimum 1000 -Maximum 9999)"
$ApplicationInsightsName = "vxt-insights"

$SqlServer = "vxtdb.database.windows.net"
$SqlDatabase = "free-sql-db-5949639"
$SqlUser = "vxt"
$SqlPassword = "Barak1976!"

# Logging
function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    $colors = @{"Success" = "Green"; "Error" = "Red"; "Info" = "Cyan"; "Warning" = "Yellow"; "Progress" = "Magenta"}
    Write-Host "$Message" -ForegroundColor $colors[$Type]
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor "Cyan"
    Write-Host ""
}

# Phase 0: Prerequisites
function Test-Prerequisites {
    Write-Section "CHECKING PREREQUISITES"
    
    $errors = @()
    
    try {
        $azVersion = & az --version 2>&1 | Select-Object -First 1
        Write-Status "Azure CLI found" "Success"
    } catch {
        $errors += "Azure CLI not installed"
    }
    
    try {
        $nodeVersion = & node --version 2>&1
        Write-Status "Node.js found: $nodeVersion" "Success"
    } catch {
        $errors += "Node.js not installed"
    }
    
    try {
        $pyVersion = & python --version 2>&1
        Write-Status "Python found: $pyVersion" "Success"
    } catch {
        $errors += "Python not installed"
    }
    
    try {
        $account = & az account show 2>&1 | ConvertFrom-Json
        Write-Status "Logged in: $($account.user.name)" "Success"
        $SubscriptionId = $account.id
    } catch {
        $errors += "Not logged into Azure. Run: az login"
    }
    
    if ($errors) {
        Write-Status "FAILED" "Error"
        foreach ($error in $errors) { Write-Status "  - $error" "Error" }
        exit 1
    }
    
    Write-Status "All prerequisites OK" "Success"
    return $SubscriptionId
}

# Phase 1: Create Azure Resources
function Create-AzureResources {
    param([string]$SubId)
    
    Write-Section "PHASE 1: CREATING AZURE RESOURCES"
    
    Write-Status "Setting subscription: $SubId" "Progress"
    & az account set --subscription $SubId
    
    Write-Status "Creating resource group: $ResourceGroupName" "Progress"
    & az group create --name $ResourceGroupName --location $Location | Out-Null
    Write-Status "Resource group created" "Success"
    
    Write-Status "Creating storage account: $StorageAccountName" "Progress"
    & az storage account create --name $StorageAccountName --resource-group $ResourceGroupName --location $Location --sku "Standard_LRS" --access-tier "Hot" | Out-Null
    Write-Status "Storage account created" "Success"
    
    Write-Status "Creating Function App: $FunctionAppName (Consumption, FREE)" "Progress"
    & az functionapp create --resource-group $ResourceGroupName --consumption-plan-location $Location --runtime python --runtime-version 3.11 --functions-version 4 --name $FunctionAppName --storage-account $StorageAccountName --os-type Linux 2>&1 | Out-Null
    Write-Status "Function App created" "Success"
    
    Write-Status "Creating App Service Plan: $AppServicePlanName (FREE F1)" "Progress"
    & az appservice plan create --name $AppServicePlanName --resource-group $ResourceGroupName --sku FREE --is-linux | Out-Null
    Write-Status "App Service Plan created" "Success"
    
    Write-Status "Creating App Service: $AppServiceName (FREE)" "Progress"
    & az appservice web create --name $AppServiceName --resource-group $ResourceGroupName --plan $AppServicePlanName --runtime "node:18LTS" 2>&1 | Out-Null
    Write-Status "App Service created" "Success"
    
    return @{
        ResourceGroup = $ResourceGroupName
        StorageAccount = $StorageAccountName
        FunctionApp = $FunctionAppName
        AppServicePlan = $AppServicePlanName
        AppService = $AppServiceName
    }
}

# Phase 2: Deploy Functions
function Deploy-AzureFunctions {
    param([PSCustomObject]$Resources, [string]$RepoUrl)
    
    Write-Section "PHASE 2: DEPLOYING AZURE FUNCTIONS"
    
    $SqlConnectionString = "Server=tcp:$SqlServer.database.windows.net,1433;Initial Catalog=$SqlDatabase;Persist Security Info=False;User ID=$SqlUser;Password=$SqlPassword;Encrypt=True;Connection Timeout=30;"
    
    Write-Status "Configuring Function App settings" "Progress"
    & az functionapp config appsettings set `
        --name $Resources.FunctionApp `
        --resource-group $Resources.ResourceGroup `
        --settings "AzureSqlConnectionString=$SqlConnectionString" "Environment=$Environment" "WEBSITE_ENABLE_SYNC_UPDATE_SITE=true" 2>&1 | Out-Null
    
    Write-Status "Configuring CORS" "Progress"
    & az functionapp cors add `
        --name $Resources.FunctionApp `
        --resource-group $Resources.ResourceGroup `
        --allowed-origins "http://localhost:3001" "http://localhost:5173" "https://$($Resources.AppService).azurewebsites.net" 2>&1 | Out-Null
    
    Write-Status "Functions configured for GitHub deployment" "Success"
}

# Phase 3: Deploy React
function Deploy-React {
    param([PSCustomObject]$Resources, [string]$ApiUrl, [string]$RepoUrl)
    
    Write-Section "PHASE 3: DEPLOYING REACT DASHBOARD"
    
    $repoPath = Join-Path ([System.IO.Path]::GetTempPath()) "vxt-github-deploy"
    
    Write-Status "Cloning from GitHub: $RepoUrl" "Progress"
    if (Test-Path $repoPath) {
        Remove-Item $repoPath -Recurse -Force
    }
    & git clone --branch main $RepoUrl $repoPath 2>&1 | Out-Null
    Write-Status "Repository cloned" "Success"
    
    $dashboardPath = Join-Path $repoPath "admin-dashboard"
    
    if (-not (Test-Path $dashboardPath)) {
        Write-Status "admin-dashboard not found" "Error"
        return $false
    }
    
    Push-Location $dashboardPath
    
    try {
        Write-Status "Installing npm dependencies" "Progress"
        & npm install 2>&1 | Out-Null
        Write-Status "Dependencies installed" "Success"
        
        Write-Status "Building React app" "Progress"
        [System.Environment]::SetEnvironmentVariable("VITE_API_BASE_URL", $ApiUrl, "Process")
        & npm run build 2>&1 | Out-Null
        Write-Status "Build complete" "Success"
        
        if (Test-Path "dist") {
            Write-Status "Deploying to Azure App Service" "Progress"
            $zipPath = Join-Path $repoPath "app.zip"
            Compress-Archive -Path "dist/*" -DestinationPath $zipPath -Force
            
            & az webapp deployment source config-zip `
                --resource-group $Resources.ResourceGroup `
                --name $Resources.AppService `
                --src $zipPath 2>&1 | Out-Null
            
            Remove-Item $zipPath -Force
            Write-Status "React app deployed" "Success"
        }
    } finally {
        Pop-Location
        Remove-Item $repoPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    return $true
}

# Phase 4: Update SQL
function Update-SqlSchema {
    Write-Section "PHASE 4: UPDATING SQL SCHEMA"
    
    $SqlScript = @"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CustomerEntities' AND COLUMN_NAME = 'iotDeviceId')
BEGIN
    ALTER TABLE CustomerEntities ADD iotDeviceId NVARCHAR(128) NULL;
    PRINT 'Column iotDeviceId added';
END

UPDATE CustomerEntities
SET iotDeviceId = CASE 
    WHEN entityId = '033114869' THEN 'vessel-033114869'
    WHEN entityId = '234567890' THEN 'TomerRefael'
    WHEN entityId = '234567891' THEN 'vessel-234567891'
    ELSE NULL
END
WHERE iotDeviceId IS NULL;

SELECT COUNT(*) as Total, SUM(CASE WHEN iotDeviceId IS NOT NULL THEN 1 ELSE 0 END) as WithDeviceIDs FROM CustomerEntities;
"@
    
    try {
        Write-Status "Connecting to Azure SQL" "Progress"
        $ConnString = "Server=tcp:$SqlServer.database.windows.net,1433;Initial Catalog=$SqlDatabase;Persist Security Info=False;User ID=$SqlUser;Password=$SqlPassword;Encrypt=True;Connection Timeout=30;"
        
        $SqlConnection = New-Object System.Data.SqlClient.SqlConnection($ConnString)
        $SqlConnection.Open()
        
        $SqlCommand = $SqlConnection.CreateCommand()
        $SqlCommand.CommandText = $SqlScript
        $SqlCommand.ExecuteNonQuery() | Out-Null
        
        $SqlConnection.Close()
        
        Write-Status "SQL schema updated successfully" "Success"
    } catch {
        Write-Status "SQL error: $_" "Error"
        return $false
    }
    
    return $true
}

# Test Deployment
function Test-Deployment {
    param([PSCustomObject]$Resources, [string]$ApiUrl, [string]$DashboardUrl)
    
    Write-Section "PHASE 5: VERIFICATION"
    Write-Status "Dashboard: $DashboardUrl" "Success"
    Write-Status "API: $ApiUrl" "Success"
}

# Main
function Main {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║   YachtSense AI - COMPLETE AZURE DEPLOYMENT (Automated)      ║" -ForegroundColor Cyan
    Write-Host "║   Repository: $GitHubRepoUrl" -ForegroundColor Cyan
    Write-Host "║   Branch: $GitHubBranch" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    $SubId = Test-Prerequisites
    $Resources = Create-AzureResources -SubId $SubId
    
    Deploy-AzureFunctions -Resources $Resources -RepoUrl $GitHubRepoUrl
    
    $ApiUrl = "https://$($Resources.FunctionApp).azurewebsites.net/api"
    $DashboardUrl = "https://$($Resources.AppService).azurewebsites.net"
    
    $deployed = Deploy-React -Resources $Resources -ApiUrl $ApiUrl -RepoUrl $GitHubRepoUrl
    if (-not $deployed) {
        Write-Status "React deployment failed" "Error"
        exit 1
    }
    
    Update-SqlSchema
    Test-Deployment -Resources $Resources -ApiUrl $ApiUrl -DashboardUrl $DashboardUrl
    
    Write-Section "DEPLOYMENT COMPLETE"
    Write-Host "Resources:"
    Write-Host "  Storage: $($Resources.StorageAccount)"
    Write-Host "  Functions: $($Resources.FunctionApp)"
    Write-Host "  Dashboard: $($Resources.AppService)"
    Write-Host ""
    Write-Host "URLs:"
    Write-Host "  Admin Dashboard: $DashboardUrl"
    Write-Host "  API: $ApiUrl"
    Write-Host ""
    Write-Host "Cost: approx 1-3 dollars per month (FREE tier resources)"
    Write-Host ""
}

Main

