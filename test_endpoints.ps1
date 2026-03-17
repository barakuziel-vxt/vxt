# Test all dashboard API endpoints
Write-Host "Testing Dashboard API Endpoints" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

$baseUrl = "http://127.0.0.1:8000"

$endpoints = @(
    @{Name = "Protocol"; Url = "/protocols"; Method = "GET"},
    @{Name = "ProtocolAttribute"; Url = "/protocolattributes"; Method = "GET"},
    @{Name = "Provider"; Url = "/providers"; Method = "GET"},
    @{Name = "ProviderEvent"; Url = "/providerevents"; Method = "GET"},
    @{Name = "CustomerEntity"; Url = "/customerentities"; Method = "GET"},
    @{Name = "CustomerGeofence"; Url = "/customergeofencecriteria"; Method = "GET"},
    @{Name = "Customer"; Url = "/customers"; Method = "GET"},
    @{Name = "Entity"; Url = "/entities"; Method = "GET"},
    @{Name = "CustomerSubscription"; Url = "/customersubscriptions"; Method = "GET"}
)

foreach ($endpoint in $endpoints) {
    Write-Host "`n$($endpoint.Name):" -ForegroundColor Yellow
    Write-Host "  URL: $baseUrl$($endpoint.Url)" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$($endpoint.Url)" -Method $endpoint.Method -ErrorAction SilentlyContinue -TimeoutSec 5
        
        if ($response.StatusCode -eq 200) {
            $data = $response.Content | ConvertFrom-Json
            $count = if ($data -is [Array]) { $data.Length } else { 1 }
            Write-Host "  ✓ Status: 200 OK" -ForegroundColor Green
            Write-Host "  ✓ Records: $count" -ForegroundColor Green
            
            if ($count -gt 0 -and $data -is [Array]) {
                Write-Host "  ✓ First field: $($data[0] | ConvertTo-Json | Select-Object -First 5)" -ForegroundColor DarkGreen
            }
        } else {
            Write-Host "  ✗ Status: $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            Write-Host "  ✗ HTTP Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
}

Write-Host ""n================================"" -ForegroundColor Cyan
Write-Host ""Test Complete"" -ForegroundColor Cyan
