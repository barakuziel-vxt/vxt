<#
Runs a SQL script file against a SQL Server instance using sqlcmd or Invoke-Sqlcmd.
Usage (interactive):
  .\run_sql_file.ps1 -ServerInstance "localhost\SQLEXPRESS" -Database "VXT" -FilePath "..\db\sql\0011_Create_Events_table.sql"

You can also provide SQL credentials or use Windows Integrated Auth when -UseIntegratedAuth is specified.
#>
param(
    [Parameter(Mandatory=$true)] [string]$ServerInstance,
    [Parameter(Mandatory=$true)] [string]$Database,
    [Parameter(Mandatory=$true)] [string]$FilePath,
    [string]$Username,
    [string]$Password,
    [switch]$UseIntegratedAuth
)

Write-Host "Running SQL file: $FilePath against $ServerInstance/$Database"

if (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue) {
    Write-Host "Using Invoke-Sqlcmd (SqlServer module)"
    if ($UseIntegratedAuth) {
        Invoke-Sqlcmd -ServerInstance $ServerInstance -Database $Database -InputFile $FilePath -ErrorAction Stop
    } elseif ($Username -and $Password) {
        $secPwd = ConvertTo-SecureString $Password -AsPlainText -Force
        $cred = New-Object System.Management.Automation.PSCredential($Username, $secPwd)
        Invoke-Sqlcmd -ServerInstance $ServerInstance -Database $Database -InputFile $FilePath -Username $Username -Password $Password -ErrorAction Stop
    } else {
        Write-Host "No credentials provided; defaulting to Integrated Auth. Use -UseIntegratedAuth to force."
        Invoke-Sqlcmd -ServerInstance $ServerInstance -Database $Database -InputFile $FilePath -ErrorAction Stop
    }
} else {
    Write-Host "Invoke-Sqlcmd not found; falling back to sqlcmd.exe"
    $sqlcmd = "sqlcmd"
    $args = "-S `"$ServerInstance`" -d `"$Database`" -i `"$FilePath`" -b"
    if (-not $UseIntegratedAuth) {
        if ($Username -and $Password) {
            $args = "-S `"$ServerInstance`" -d `"$Database`" -U `"$Username`" -P `"$Password`" -i `"$FilePath`" -b"
        } else {
            $args = "-S `"$ServerInstance`" -d `"$Database`" -E -i `"$FilePath`" -b"
        }
    } else {
        $args = "-S `"$ServerInstance`" -d `"$Database`" -E -i `"$FilePath`" -b"
    }

    & $sqlcmd $args
    if ($LASTEXITCODE -ne 0) { throw "sqlcmd failed with exit code $LASTEXITCODE" }
}

Write-Host "SQL execution completed."
