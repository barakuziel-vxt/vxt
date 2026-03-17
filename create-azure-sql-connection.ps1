# Create Azure SQL Database Connection in VS Code MSSQL Extension
# This script configures the connection profile in VS Code settings

$vscodeSettingsPath = "$env:APPDATA\Code\User\settings.json"

Write-Host "Creating Azure SQL Connection in VS Code..." -ForegroundColor Green
Write-Host "Settings file: $vscodeSettingsPath" -ForegroundColor Gray

# Check if settings file exists
if (-not (Test-Path $vscodeSettingsPath)) {
    Write-Host "Creating new settings.json..." -ForegroundColor Yellow
    $settings = @{
        "mssql.connections" = @()
    } | ConvertTo-Json
    Set-Content -Path $vscodeSettingsPath -Value $settings -Encoding UTF8
}

# Read current settings
$settingsContent = Get-Content -Path $vscodeSettingsPath -Raw
$settings = $settingsContent | ConvertFrom-Json

# Ensure mssql.connections array exists
if (-not ($settings | Get-Member -Name "mssql.connections" -ErrorAction SilentlyContinue)) {
    $settings | Add-Member -NotePropertyName "mssql.connections" -NotePropertyValue @()
}

# Remove existing azure-vxtdb connection if it exists
$settings."mssql.connections" = @($settings."mssql.connections" | Where-Object { $_.connectionName -ne "azure-vxtdb" })

# Create new connection profile
$newConnection = @{
    connectionName = "azure-vxtdb"
    server = "vxtdb.database.windows.net"
    database = "vxtdb"
    username = "vxtadmin"
    password = "Barak1008!"
    authenticationType = "SqlLogin"
    port = 1433
    encrypt = $true
    trustServerCertificate = $false
    connectTimeout = 30
    commandTimeout = 30
    applicationName = "VS Code MSSQL"
}

# Add new connection
$settings."mssql.connections" += $newConnection

# Save updated settings
$updatedJson = $settings | ConvertTo-Json -Depth 10
Set-Content -Path $vscodeSettingsPath -Value $updatedJson -Encoding UTF8

Write-Host ""
Write-Host "OK - Azure SQL Connection Created!" -ForegroundColor Green
Write-Host ""
Write-Host "Connection Details:" -ForegroundColor Cyan
Write-Host "  Connection Name: azure-vxtdb"
Write-Host "  Server: vxtdb.database.windows.net"
Write-Host "  Database: vxtdb"
Write-Host "  Username: vxtadmin"
Write-Host "  Port: 1433"

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Reload VS Code (Ctrl+Shift+P -> Developer: Reload Window)"
Write-Host "2. Open MSSQL Explorer (View -> Explorer -> MSSQL)"
Write-Host "3. Click Add Connection button"
Write-Host "4. Select azure-vxtdb from the list"
Write-Host "5. It will connect automatically"

Write-Host ""
Write-Host "Configuration Complete!" -ForegroundColor Green
