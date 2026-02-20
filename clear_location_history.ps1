# Clear Location History from EntityTelemetry
# Removes all incorrect location data (Helsinki, Taiwan, etc.)
# Prepares database for fresh Haifa port location data from simulator

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Clearing Location History" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$Server = "localhost,1433"
$Database = "BoatTelemetryDB"
$Username = "sa"
$Password = "YourStrongPassword123!"

# Build connection string
$ConnectionString = "Server=$Server;Database=$Database;User Id=$Username;Password=$Password;"

try {
    # Create connection
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $ConnectionString
    $connection.Open()
    
    Write-Host "[OK] Connected to SQL Server" -ForegroundColor Green
    
    # Execute the clear query
    $command = $connection.CreateCommand()
    $command.CommandText = "UPDATE EntityTelemetry SET latitude = NULL, longitude = NULL WHERE latitude IS NOT NULL OR longitude IS NOT NULL;"
    
    $rowsAffected = $command.ExecuteNonQuery()
    
    Write-Host "[OK] Successfully cleared location history" -ForegroundColor Green
    Write-Host "    Rows updated: $rowsAffected" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "[i] New simulator runs will generate location data from Haifa port" -ForegroundColor Cyan
    Write-Host "    Start: Haifa (32.8315366 N, 35.0036234 E)" -ForegroundColor Cyan
    Write-Host "    Route: North 5nm, West 2.5nm, Return cycle" -ForegroundColor Cyan
    Write-Host ""
    
    $connection.Close()
    
} catch {
    Write-Host "[ERROR] $($_)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  1. SQL Server is running: docker ps" -ForegroundColor Yellow
    Write-Host "  2. Connection details are correct" -ForegroundColor Yellow
    Write-Host "  3. BoatTelemetryDB exists" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run simulator: .\.venv\Scripts\python.exe simulate_signalk_vessel.py" -ForegroundColor Yellow
Write-Host "  2. View map: http://localhost:3001/admin/entity-telemetry-analytics" -ForegroundColor Yellow
