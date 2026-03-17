# Test all dashboard API endpoints
Write-Host "Testing Dashboard API Endpoints" -ForegroundColor Cyan

$baseUrl = "http://127.0.0.1:8000"
$endpoints = @(
    @{Name = "Protocol"; Url = "/protocols"},
    @{Name = "ProtocolAttribute"; Url = "/protocolattributes"},
    @{Name = "Provider"; Url = "/providers"},
    @{Name = "ProviderEvent"; Url = "/providerevents"},
    @{Name = "CustomerEntity"; Url = "/customerentities"},
    @{Name = "CustomerGeofence"; Url = "/customergeofencecriteria"},
    @{Name = "Customer"; Url = "/customers"},
    @{Name = "Entity"; Url = "/entities"},
    @{Name = "CustomerSubscription"; Url = "/customersubscriptions"}
)

foreach ($ep in $endpoints) {
    Write-Host ""
    Write-Host "$($ep.Name):" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$($ep.Url)" -ErrorAction SilentlyContinue
        $data = $response.Content | ConvertFrom-Json
        $count = if ($data -is [Array]) { $data.Length } else { 1 }
        Write-Host "  Status: 200 OK - Records: $count" -ForegroundColor Green
    } catch {
        Write-Host "  Status: ERROR - $($_.Exception.Message)" -ForegroundColor Red
    }
}
