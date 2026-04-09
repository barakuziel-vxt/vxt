$ServerName = "."
$DatabaseName = "vxtdb"

$scripts = @(
    @{ Name = "0177_A"; File = "db/sql/0177_A_Create_EntityIoTDevice.sql"; },
    @{ Name = "0177_B"; File = "db/sql/0177_B_Create_AppUser.sql"; },
    @{ Name = "0177_C"; File = "db/sql/0177_C_Create_UserApplication.sql"; },
    @{ Name = "0177_D"; File = "db/sql/0177_D_Create_UserAuthorization.sql"; },
    @{ Name = "0177_E"; File = "db/sql/0177_E_Create_UserAppPushNotification.sql"; }
)

Write-Host ""
Write-Host "Migration 0177: User Device Management Tables"
Write-Host ""

$successCount = 0

foreach ($script in $scripts) {
    Write-Host "$($script.Name): " -NoNewline
    
    if (-not (Test-Path $script.File)) {
        Write-Host "File not found"
        continue
    }
    
    sqlcmd -S "$ServerName" -d "$DatabaseName" -i $script.File
    
    if ($?) {
        $successCount++
    }
}

Write-Host ""
Write-Host "Result: $successCount of 5 scripts executed successfully"
Write-Host ""
