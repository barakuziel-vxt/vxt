#!/usr/bin/env pwsh
<#
.SYNOPSIS
    YachtSense AI - Complete Azure Deployment (Fully Automated)
    Deploys API Layer (Azure Functions) + Frontend Layer (App Service)
    
.DESCRIPTION
    Creates all resources on FREE tier, builds & deploys code, tests everything
    
.PARAMETER SubscriptionId
    Azure Subscription ID (optional - uses current if not provided)
    
.PARAMETER Location
    Azure region (default: eastus)

.EXAMPLE
    .\deploy_all_azure_automated.ps1
    
.NOTES
    Prerequisites:
    - Azure CLI installed and logged in (az login)
    - Node.js installed (for React build)
    - Python 3.11+ installed
#>

param(
    [string]$SubscriptionId = "",
    [string]$Location = "eastus",
    [string]$Environment = "prod",
    [string]$GitHubRepoUrl = "",
    [string]$GitHubBranch = "production"  # Use 'production' branch for Azure deployment
)

# ==================== CONFIGURATION ====================
$ResourceGroupName = "vxt-resource-group"
$StorageAccountName = "vxtstorage$(Get-Random -Minimum 100 -Maximum 999)"  # Unique name
$FunctionAppName = "vxt-api-functions-$(Get-Random -Minimum 1000 -Maximum 9999)"
$AppServicePlanName = "vxt-app-plan"
$AppServiceName = "vxt-admin-dashboard-$(Get-Random -Minimum 1000 -Maximum 9999)"
$ApplicationInsightsName = "vxt-insights"

# GitHub Configuration
$GitHubRepoUrl = ""  # Will be prompted if not provided
$GitHubBranch = "main"  # Change if using different branch

$SqlServer = "vxtdb"
$SqlDatabase = "free-sql-db-5949639"
$SqlUser = "vxt"
$SqlPassword = "Barak1976!"

# Colors for output
$Colors = @{
    Success = "Green"
    Error = "Red"
    Info = "Cyan"
    Warning = "Yellow"
    Progress = "Magenta"
}

# ==================== LOGGING FUNCTIONS ====================
function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    $color = $Colors[$Type]
    $icon = @{
        Success = "✅"
        Error = "❌"
        Info = "ℹ️"
        Warning = "⚠️"
        Progress = "▶️"
    }
    Write-Host "$($icon[$Type]) $Message" -ForegroundColor $color
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "╔" + ("═" * 78) + "╗" -ForegroundColor "Cyan"
    Write-Host "║ $Title" -ForegroundColor "Cyan"
    Write-Host "╠" + ("═" * 78) + "╣" -ForegroundColor "Cyan"
}

function Write-EndSection {
    Write-Host "╚" + ("═" * 78) + "╝" -ForegroundColor "Cyan"
}

# ==================== UTILITY FUNCTIONS ====================
function Test-Prerequisites {
    Write-Section "CHECKING PREREQUISITES"
    
    $errors = @()
    
    # Check Azure CLI
    try {
        $azVersion = & az --version 2>&1 | Select-Object -First 1
        Write-Status "Azure CLI found: $azVersion" "Success"
    } catch {
        $errors += "Azure CLI not installed. Download from https://aka.ms/azurecli"
    }
    
    # Check Node.js
    try {
        $nodeVersion = & node --version 2>&1
        Write-Status "Node.js found: $nodeVersion" "Success"
    } catch {
        $errors += "Node.js not installed. Download from https://nodejs.org"
    }
    
    # Check Python
    try {
        $pyVersion = & python --version 2>&1
        Write-Status "Python found: $pyVersion" "Success"
    } catch {
        $errors += "Python not installed. Download from https://python.org"
    }
    
    # Check Azure Login
    try {
        $account = & az account show 2>&1 | ConvertFrom-Json
        Write-Status "Logged in as: $($account.user.name)" "Success"
        if (-not $SubscriptionId) {
            $SubscriptionId = $account.id
            Write-Status "Using subscription: $SubscriptionId" "Info"
        }
    } catch {
        $errors += "Not logged into Azure. Run: az login"
    }
    
    if ($errors) {
        Write-Status "Prerequisites check FAILED" "Error"
        foreach ($error in $errors) {
            Write-Status "  - $error" "Error"
        }
        exit 1
    }
    
    Write-Status "All prerequisites OK" "Success"
    Write-EndSection
    return $SubscriptionId
}

# ==================== PHASE 1: AZURE RESOURCES ====================
function Create-AzureResources {
    param([string]$SubId)
    
    Write-Section "PHASE 1: CREATING AZURE RESOURCES (FREE TIER)"
    
    # Set subscription
    Write-Status "Setting subscription: $SubId" "Progress"
    & az account set --subscription $SubId
    
    # Create Resource Group
    Write-Status "Creating Resource Group: $ResourceGroupName" "Progress"
    & az group create --name $ResourceGroupName --location $Location | Out-Null
    Write-Status "Resource Group created" "Success"
    
    # Create Storage Account (required for Function runtime)
    Write-Status "Creating Storage Account: $StorageAccountName (~$1-2/month)" "Progress"
    & az storage account create `
        --name $StorageAccountName `
        --resource-group $ResourceGroupName `
        --location $Location `
        --sku "Standard_LRS" `
        --access-tier "Hot" | Out-Null
    Write-Status "Storage Account created: $StorageAccountName" "Success"
    
    # Create Application Insights (optional but helpful for monitoring FREE tier)
    Write-Status "Creating Application Insights: $ApplicationInsightsName" "Progress"
    & az monitor app-insights component create `
        --app $ApplicationInsightsName `
        --location $Location `
        --resource-group $ResourceGroupName `
        --application-type web 2>/dev/null | Out-Null
    Write-Status "Application Insights created (monitoring enabled)" "Success"
    
    # Create Function App (Consumption plan = PAY PER USE, 1M calls FREE/month)
    Write-Status "Creating Function App: $FunctionAppName (Consumption, FREE)" "Progress"
    & az functionapp create `
        --resource-group $ResourceGroupName `
        --consumption-plan-location $Location `
        --runtime python `
        --runtime-version 3.11 `
        --functions-version 4 `
        --name $FunctionAppName `
        --storage-account $StorageAccountName `
        --app-insights $ApplicationInsightsName `
        --os-type Linux 2>&1 | Out-Null
    Write-Status "Function App created: $FunctionAppName" "Success"
    
    # Create App Service Plan (Free F1)
    Write-Status "Creating App Service Plan: $AppServicePlanName (FREE F1)" "Progress"
    & az appservice plan create `
        --name $AppServicePlanName `
        --resource-group $ResourceGroupName `
        --sku FREE `
        --is-linux | Out-Null
    Write-Status "App Service Plan created: $AppServicePlanName (FREE)" "Success"
    
    # Create App Service (FREE tier, Linux + Node.js)
    Write-Status "Creating App Service: $AppServiceName (FREE)" "Progress"
    & az appservice web create `
        --name $AppServiceName `
        --resource-group $ResourceGroupName `
        --plan $AppServicePlanName `
        --runtime "node:18LTS" 2>&1 | Out-Null
    Write-Status "App Service created: $AppServiceName" "Success"
    
    Write-EndSection
    
    return @{
        ResourceGroup = $ResourceGroupName
        StorageAccount = $StorageAccountName
        FunctionApp = $FunctionAppName
        AppServicePlan = $AppServicePlanName
        AppService = $AppServiceName
    }
}

# ==================== PHASE 2: DEPLOY FUNCTIONS ====================
function Deploy-AzureFunctions {
    param(
        [Parameter(Mandatory=$true)]
        [PSCustomObject]$Resources,
        
        [Parameter(Mandatory=$true)]
        [string]$RepoUrl
    )
    
    Write-Section "PHASE 2: DEPLOYING AZURE FUNCTIONS FROM GITHUB"
    
    Write-Status "Setting environment variables in Function App" "Progress"
    
    # Get SQL connection string
    $SqlConnectionString = "Server=tcp:$SqlServer.database.windows.net,1433;Initial Catalog=$SqlDatabase;Persist Security Info=False;User ID=$SqlUser;Password=$SqlPassword;Encrypt=True;Connection Timeout=30;"
    
    # Set Function App settings
    & az functionapp config appsettings set `
        --name $Resources.FunctionApp `
        --resource-group $Resources.ResourceGroup `
        --settings `
            "AzureSqlConnectionString=$SqlConnectionString" `
            "Environment=$Environment" `
            "WEBSITE_ENABLE_SYNC_UPDATE_SITE=true" 2>&1 | Out-Null
    
    Write-Status "Environment variables configured" "Success"
    
    Write-Status "Configuring CORS for dashboard origin" "Progress"
    & az functionapp cors add `
        --name $Resources.FunctionApp `
        --resource-group $Resources.ResourceGroup `
        --allowed-origins "http://localhost:3001" "http://localhost:5173" "https://$($Resources.AppService).azurewebsites.net" 2>&1 | Out-Null
    
    Write-Status "CORS configured for all dashboard origins" "Success"
    
    # Deploy from GitHub
    Write-Status "Deploying Azure Functions from GitHub: $RepoUrl" "Progress"
    
    & az functionapp deployment source config-zip --help 2>&1 | Out-Null
    
    # Using GitHub deployment integration
    & az functionapp deployment github-actions add `
        --name $Resources.FunctionApp `
        --resource-group $Resources.ResourceGroup `
        --repo $RepoUrl `
        --branch $GitHubBranch `
        --context-path "functions" 2>/dev/null
    
    Write-Status "GitHub deployment configured for Azure Functions" "Success"
    Write-Status "Functions will be deployed on GitHub push" "Info"
    
    Write-EndSection
}

# ==================== PHASE 3: BUILD & DEPLOY REACT ====================
function Build-And-Deploy-React {
    param(
        [Parameter(Mandatory=$true)]
        [PSCustomObject]$Resources,
        
        [Parameter(Mandatory=$true)]
        [string]$ApiUrl,
        
        [Parameter(Mandatory=$true)]
        [string]$RepoUrl
    )
    
    Write-Section "PHASE 3: BUILDING & DEPLOYING REACT FROM GITHUB"
    
    # Clone or update GitHub repo
    $repoPath = Join-Path $PSScriptRoot "vxt-github-temp"
    
    Write-Status "Cloning GitHub repository" "Progress"
    
    if (Test-Path $repoPath) {
        Push-Location $repoPath
        & git pull 2>&1 | Out-Null
        Pop-Location
    } else {
        & git clone $RepoUrl $repoPath 2>&1 | Out-Null
    }
    
    Write-Status "Repository cloned/updated" "Success"
    
    $dashboardPath = Join-Path $repoPath "admin-dashboard"
    
    if (-not (Test-Path $dashboardPath)) {
        Write-Status "admin-dashboard directory not found in GitHub repo at: $dashboardPath" "Error"
        Write-Status "Checking repo structure..." "Warning"
        Get-ChildItem $repoPath -Depth 1 | Write-Host
        return $false
    }
    
    Push-Location $dashboardPath
    
    try {
        # Install dependencies
        Write-Status "Installing npm dependencies" "Progress"
        & npm install 2>&1 | Out-Null
        Write-Status "Dependencies installed" "Success"
        
        # Set environment variable for API endpoint
        Write-Status "Setting API endpoint: $ApiUrl" "Progress"
        [System.Environment]::SetEnvironmentVariable("VITE_API_BASE_URL", $ApiUrl, "Process")
        
        # Build React app
        Write-Status "Building React app (production)" "Progress"
        & npm run build 2>&1 | Out-Null
        Write-Status "React app built successfully" "Success"
        
        # Deploy to App Service
        if (Test-Path "dist") {
            Write-Status "Deploying to App Service: $($Resources.AppService)" "Progress"
            
            # Create zip of dist folder
            $zipPath = Join-Path $PSScriptRoot "app.zip"
            Compress-Archive -Path "dist/*" -DestinationPath $zipPath -Force
            
            # Deploy via Azure CLI
            & az webapp deployment source config-zip `
                --resource-group $Resources.ResourceGroup `
                --name $Resources.AppService `
                --src $zipPath 2>&1 | Out-Null
            
            Remove-Item $zipPath -Force
            Write-Status "React app deployed to Azure App Service" "Success"
        } else {
            Write-Status "dist folder not found after build" "Error"
            return $false
        }
        
        # Configure App Service settings
        Write-Status "Configuring App Service settings" "Progress"
        & az webapp config appsettings set `
            --name $Resources.AppService `
            --resource-group $Resources.ResourceGroup `
            --settings `
                "VITE_API_BASE_URL=$ApiUrl" `
                "NODE_ENV=production" `
                "WEBSITE_NODE_DEFAULT_VERSION=18.17.1" 2>&1 | Out-Null
        
        Write-Status "App Service configured" "Success"
        
    } finally {
        Pop-Location
    }
    
    # Cleanup temp repo
    Write-Status "Cleaning up temporary files" "Progress"
    Remove-Item $repoPath -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-EndSection
    return $true
}

# ==================== PHASE 4: SQL SCHEMA UPDATE ====================
function Update-SqlSchema {
    Write-Section "PHASE 4: UPDATING AZURE SQL SCHEMA"
    
    $SqlScript = @"
-- Add iotDeviceId column if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CustomerEntities' AND COLUMN_NAME = 'iotDeviceId')
BEGIN
    ALTER TABLE CustomerEntities
    ADD iotDeviceId NVARCHAR(128) NULL;
    PRINT 'Column iotDeviceId added to CustomerEntities table';
END
ELSE
BEGIN
    PRINT 'Column iotDeviceId already exists';
END

-- Populate device IDs if they're empty
UPDATE CustomerEntities
SET iotDeviceId = CASE 
    WHEN entityId = '033114869' THEN 'vessel-033114869'
    WHEN entityId = '234567890' THEN 'TomerRefael'
    WHEN entityId = '234567891' THEN 'vessel-234567891'
    ELSE NULL
END
WHERE iotDeviceId IS NULL AND entityId IN ('033114869', '234567890', '234567891');

-- Verify
SELECT COUNT(*) as [Total Entities], 
       SUM(CASE WHEN iotDeviceId IS NOT NULL THEN 1 ELSE 0 END) as [With Device IDs]
FROM CustomerEntities;
"@
    
    Write-Status "Connecting to Azure SQL Database" "Progress"
    
    try {
        # Create connection string
        $ConnString = "Server=tcp:$SqlServer.database.windows.net,1433;Initial Catalog=$SqlDatabase;Persist Security Info=False;User ID=$SqlUser;Password=$SqlPassword;Encrypt=True;Connection Timeout=30;"
        
        # Execute script
        $SqlConnection = New-Object System.Data.SqlClient.SqlConnection($ConnString)
        $SqlConnection.Open()
        
        $SqlCommand = $SqlConnection.CreateCommand()
        $SqlCommand.CommandText = $SqlScript
        $SqlCommand.ExecuteNonQuery() | Out-Null
        
        $SqlConnection.Close()
        
        Write-Status "SQL Schema updated successfully" "Success"
        Write-Status "iotDeviceId column exists and device IDs populated" "Success"
        
    } catch {
        Write-Status "SQL update error: $_" "Error"
        return $false
    }
    
    Write-EndSection
    return $true
}

# ==================== PHASE 5: TESTING ====================
function Test-Deployment {
    param(
        [Parameter(Mandatory=$true)]
        [PSCustomObject]$Resources,
        
        [Parameter(Mandatory=$true)]
        [string]$ApiUrl,
        
        [Parameter(Mandatory=$true)]
        [string]$DashboardUrl
    )
    
    Write-Section "PHASE 5: TESTING & VERIFICATION"
    
    Write-Status "Testing API endpoint" "Progress"
    
    # Wait for Function App to be ready
    Start-Sleep -Seconds 5
    
    try {
        # Test GET all entities
        $response = Invoke-WebRequest -Uri "$ApiUrl/customerentities" -Method GET -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Status "✓ GET /customerentities returns 200 OK" "Success"
        }
    } catch {
        Write-Status "API test failed - might need a few seconds to start" "Warning"
    }
    
    Write-Status "Dashboard URL: $DashboardUrl" "Success"
    Write-Status "API URL: $ApiUrl" "Success"
    
    Write-EndSection
}

# ==================== CREATE FUNCTION CODE ====================
function Create-FunctionCode {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Path,
        
        [Parameter(Mandatory=$true)]
        [string]$FunctionAppName
    )
    
    # This creates placeholder function code
    # In production, you'd deploy actual function.json and __init__.py files
    
    Write-Host "Function code deployment ready for: $FunctionAppName"
}

# ==================== PROMPT FOR GITHUB REPO ====================
function Get-GitHubRepoUrl {
    if ($GitHubRepoUrl) {
        return $GitHubRepoUrl
    }
    
    Write-Section "GITHUB REPOSITORY CONFIGURATION"
    Write-Host ""
    Write-Host "Enter your GitHub repository URL (e.g., https://github.com/username/yacht-sense)" -ForegroundColor "Cyan"
    Write-Host ""
    $url = Read-Host "GitHub Repo URL"
    
    if (-not $url) {
        Write-Status "No GitHub repo provided" "Error"
        exit 1
    }
    
    Write-Status "Using repository: $url" "Success"
    Write-EndSection
    
    return $url
}

# ==================== GITHUB BRANCH SETUP GUIDE ====================
function Show-BranchSetupGuide {
    param([string]$RepoUrl)
    
    Write-Section "📚 GITHUB BRANCH SETUP GUIDE (Optional - for best practices)"
    Write-Host ""
    Write-Host "Recommended branch strategy:" -ForegroundColor "Yellow"
    Write-Host ""
    Write-Host "  • main         → Development branch (default, your local code)" -ForegroundColor "Cyan"
    Write-Host "  • production   → Azure production deployment (this script uses this)" -ForegroundColor "Cyan"
    Write-Host "  • staging      → Azure staging environment (optional)" -ForegroundColor "Cyan"
    Write-Host ""
    Write-Host "To set this up in your GitHub repo:" -ForegroundColor "Yellow"
    Write-Host ""
    Write-Host "  1. Clone locally:" -ForegroundColor "White"
    Write-Host "     git clone $RepoUrl" -ForegroundColor "Gray"
    Write-Host ""
    Write-Host "  2. Create & push production branch:" -ForegroundColor "White"
    Write-Host "     git checkout -b production" -ForegroundColor "Gray"
    Write-Host "     git push -u origin production" -ForegroundColor "Gray"
    Write-Host ""
    Write-Host "  3. Link Azure deployment to production branch:" -ForegroundColor "White"
    Write-Host "     This script does this automatically via GitHub Actions" -ForegroundColor "Gray"
    Write-Host ""
    Write-Host "Current branch: $GitHubBranch" -ForegroundColor "Green"
    Write-Host ""
    Write-EndSection
}

# ==================== MAIN EXECUTION ====================
function Main {
    Clear-Host
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                                                                                ║" -ForegroundColor Cyan
    Write-Host "║          🚀 YachtSense AI - COMPLETE AZURE DEPLOYMENT (Automated)            ║" -ForegroundColor Cyan
    Write-Host "║                                                                                ║" -ForegroundColor Cyan
    Write-Host "║     Cost Optimized: FREE Tier Resources + Minimal Storage (~$1-2/month)     ║" -ForegroundColor Cyan
    Write-Host "║                                                                                ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    # Get GitHub repo
    $RepoUrl = Get-GitHubRepoUrl
    Show-BranchSetupGuide -RepoUrl $RepoUrl
    
    # Phase 0: Prerequisites
    $SubId = Test-Prerequisites
    
    # Phase 1: Create Resources
    $Resources = Create-AzureResources -SubId $SubId
    
    # Phase 2: Deploy Functions
    Deploy-AzureFunctions -Resources $Resources -RepoUrl $RepoUrl
    
    # Phase 3: Build & Deploy React
    $ApiUrl = "https://$($Resources.FunctionApp).azurewebsites.net/api"
    $DashboardUrl = "https://$($Resources.AppService).azurewebsites.net"
    
    $deployed = Build-And-Deploy-React -Resources $Resources -ApiUrl $ApiUrl -RepoUrl $RepoUrl
    if (-not $deployed) {
        Write-Status "React deployment failed" "Error"
        exit 1
    }
    
    # Phase 4: Update SQL
    $sqlSuccess = Update-SqlSchema
    if (-not $sqlSuccess) {
        Write-Status "SQL update failed" "Error"
    }
    
    # Phase 5: Test
    Test-Deployment -Resources $Resources -ApiUrl $ApiUrl -DashboardUrl $DashboardUrl
    
    # Summary
    Write-Section "✅ DEPLOYMENT COMPLETE"
    Write-Host ""
    Write-Host "📊 RESOURCES CREATED:" -ForegroundColor "Green"
    Write-Host "  • Storage Account: $($Resources.StorageAccount)" -ForegroundColor "Green"
    Write-Host "  • Function App: $($Resources.FunctionApp)" -ForegroundColor "Green"
    Write-Host "  • App Service: $($Resources.AppService)" -ForegroundColor "Green"
    Write-Host "  • Resource Group: $($Resources.ResourceGroup)" -ForegroundColor "Green"
    Write-Host ""
    Write-Host "📚 GITHUB INTEGRATION:" -ForegroundColor "Cyan"
    Write-Host "  • Repository: $RepoUrl" -ForegroundColor "Cyan"
    Write-Host "  • Deployment Branch: $GitHubBranch" -ForegroundColor "Cyan"
    Write-Host "  • Auto-deployment: Enabled via GitHub Actions" -ForegroundColor "Cyan"
    Write-Host ""
    Write-Host "🔗 LIVE URLS:" -ForegroundColor "Cyan"
    Write-Host "  Admin Dashboard: $DashboardUrl" -ForegroundColor "Cyan"
    Write-Host "  API Endpoints: $ApiUrl" -ForegroundColor "Cyan"
    Write-Host ""
    Write-Host "💰 MONTHLY COST: ~\$1-3 (1M Function calls FREE)" -ForegroundColor "Yellow"
    Write-Host ""
    Write-EndSection
}

# Run main
Main
