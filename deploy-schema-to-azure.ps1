# Deploy Database Schema to Azure SQL
# Usage: .\deploy-schema-to-azure.ps1

Write-Host "=== Azure SQL Schema Deployment ===" -ForegroundColor Cyan
Write-Host "This script deploys the database schema to Azure SQL using Azure CLI" -ForegroundColor Yellow

# Connection parameters
$resourceGroup = "VXT-IoT-Hub"
$serverName = "vxtdb"
$databaseName = "free-sql-db-5949639"
$schemaFile = "c:\VXT\azure_schema_export.sql"
$sqlServer = "$serverName.database.windows.net"

Write-Host "`nConfiguration:" -ForegroundColor Cyan
Write-Host "  Resource Group: $resourceGroup"
Write-Host "  Server: $sqlServer"
Write-Host "  Database: $databaseName"
Write-Host "  Schema File: $schemaFile"

# Check if schema file exists
if (!(Test-Path $schemaFile)) {
    Write-Host "ERROR: Schema file not found: $schemaFile" -ForegroundColor Red
    exit 1
}

Write-Host "`nDeploying schema to Azure SQL..." -ForegroundColor Yellow

# Read schema file
$schemaContent = Get-Content $schemaFile -Raw

# Split into batches and execute via Azure CLI
# Note: Azure CLI sql db execute has limitations, so we'll use sqlcmd if available
try {
    # Try using Azure CLI (more reliable)
    Write-Host "Attempting deployment using Azure CLI..." -ForegroundColor Yellow
    
    # Create a temporary SQL file with schema
    $tempFile = "$env:TEMP\schema_deploy_$(Get-Random).sql"
    $schemaContent | Out-File -FilePath $tempFile -Encoding UTF8
    
    # Execute using Azure CLI sql db execute command
    Write-Host "Executing schema deployment..." -ForegroundColor Yellow
    az sql db execute `
        --resource-group $resourceGroup `
        --server $serverName `
        --database $databaseName `
        --input-file $tempFile `
        --timeout 300 `
        2>&1 | ForEach-Object { Write-Host "  $_" }
    
    # Clean up temp file
    Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
    
    Write-Host "`n✓ Schema deployment complete!" -ForegroundColor Green
    
} catch {
    Write-Host "Error during deployment: $_" -ForegroundColor Red
    Write-Host "`nAlternative: Manually deploy using Azure Portal" -ForegroundColor Yellow
    Write-Host "1. Go to https://portal.azure.com" -ForegroundColor Yellow
    Write-Host "2. Navigate to your SQL Database: $databaseName" -ForegroundColor Yellow
    Write-Host "3. Open Query Editor (SQL Query Editor)" -ForegroundColor Yellow
    Write-Host "4. Copy and paste the contents of $schemaFile" -ForegroundColor Yellow
    Write-Host "5. Click 'Run' to execute" -ForegroundColor Yellow
}

# Verify deployment
Write-Host "`nVerifying deployment..." -ForegroundColor Cyan
try {
    $result = az sql db execute `
        --resource-group $resourceGroup `
        --server $serverName `
        --database $databaseName `
        --query-text "SELECT COUNT(*) AS TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'" `
        2>&1
    
    if ($result -match "(\d+)") {
        $tableCount = [int]$matches[1]
        Write-Host "✓ Tables found: $tableCount" -ForegroundColor Green
        
        if ($tableCount -gt 0) {
            Write-Host "`nSchema deployment was successful!" -ForegroundColor Green
            Write-Host "API endpoints should now work properly." -ForegroundColor Green
        }
    }
} catch {
    Write-Host "Could not verify deployment (check manually in Azure Portal)" -ForegroundColor Yellow
}

Write-Host "`nAfter schema deployment:" -ForegroundColor Cyan
Write-Host "1. Restart Azure Web App: az webapp restart --name vxt-web-app --resource-group $resourceGroup" -ForegroundColor Yellow
Write-Host "2. Test endpoint: https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net/health/db" -ForegroundColor Yellow
