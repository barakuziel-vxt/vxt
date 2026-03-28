# =============================================================================
# YachtSense AI - One-Time Local Database Setup
# =============================================================================
# Run ONCE after first 'docker-compose up -d'.
# Creates DB, login, runs ALL db/sql migrations in order, then inserts data.
#
# Usage:
#   1. docker-compose up -d
#   2. .\setup_database_once.ps1
#   3. .\start_all.ps1  (normal startup from now on)
# =============================================================================

$DB_NAME   = "free-sql-db-5949639"
$DB_USER   = "vxt"
$DB_PASS   = "Barak1976!"
$SA_PASS   = "YourStrongPassword123!"
$CONTAINER = "yacht-sql"
$SQLCMD    = "/opt/mssql-tools18/bin/sqlcmd"

# -- Helpers ------------------------------------------------------------------

function Invoke-SQL {
    param([string]$Query, [string]$Database = "master")
    docker exec $CONTAINER $SQLCMD `
        -S localhost -U sa -P $SA_PASS -d $Database -Q $Query -C -N -b 2>&1
}

function Invoke-SQLFile {
    param([string]$LocalPath, [string]$Database = $DB_NAME)
    $filename = Split-Path $LocalPath -Leaf
    docker cp $LocalPath "${CONTAINER}:/tmp/${filename}" | Out-Null
    $result = docker exec $CONTAINER $SQLCMD `
        -S localhost -U sa -P $SA_PASS -d $Database `
        -i "/tmp/${filename}" -C -N -b 2>&1
    docker exec $CONTAINER /bin/bash -c "rm -f /tmp/${filename}" 2>&1 | Out-Null
    return $result
}

# Wrap a data file with IDENTITY_INSERT ON so explicit IDs are accepted
function Invoke-DataFile {
    param([string]$LocalPath, [string]$TableName, [string]$Database = $DB_NAME)
    $tmp     = [System.IO.Path]::GetTempFileName() + ".sql"
    $content = [System.IO.File]::ReadAllText($LocalPath, [System.Text.Encoding]::UTF8)
    $wrapped = "SET IDENTITY_INSERT [$TableName] ON;`r`n" + $content + "`r`nSET IDENTITY_INSERT [$TableName] OFF;"
    [System.IO.File]::WriteAllText($tmp, $wrapped, [System.Text.Encoding]::UTF8)
    $result = Invoke-SQLFile -LocalPath $tmp -Database $Database
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    return $result
}

function Show-Result {
    param([object]$Result)
    $Result | Where-Object { $_ -and $_ -match "Msg \d+.*(16|17|18|19|20|21|22|23)" } |
        ForEach-Object { Write-Host "    WARN: $_" -ForegroundColor Yellow }
}

# =============================================================================
# STEP 0: Wait for SQL Server
# =============================================================================
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  YachtSense AI - One-Time Database Setup" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

Write-Host "[0/6] Waiting for SQL Server container to be healthy..." -ForegroundColor Yellow

docker inspect $CONTAINER 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Container '$CONTAINER' not found. Run 'docker-compose up -d' first." -ForegroundColor Red
    exit 1
}

$maxWait = 90; $waited = 0
while ($waited -lt $maxWait) {
    $h = docker inspect -f "{{.State.Health.Status}}" $CONTAINER 2>&1
    if ($h -eq "healthy") { break }
    Write-Host "  Status: $h -- waiting... ($waited/$maxWait s)" -ForegroundColor DarkYellow
    Start-Sleep 5; $waited += 5
}
if ((docker inspect -f "{{.State.Health.Status}}" $CONTAINER 2>&1) -ne "healthy") {
    Write-Host "ERROR: Not healthy after ${maxWait}s. Check: docker logs $CONTAINER" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] SQL Server is healthy." -ForegroundColor Green

# =============================================================================
# STEP 1: Drop + recreate database
# =============================================================================
Write-Host ""
Write-Host "[1/6] Creating clean database '$DB_NAME'..." -ForegroundColor Yellow

Invoke-SQL @"
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'$DB_NAME')
BEGIN
    ALTER DATABASE [$DB_NAME] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$DB_NAME];
END
"@ | Out-Null

Invoke-SQL "CREATE DATABASE [$DB_NAME];" | Out-Null
Write-Host "[OK] Database '$DB_NAME' ready." -ForegroundColor Green

# =============================================================================
# STEP 2: Create login + DB user
# =============================================================================
Write-Host ""
Write-Host "[2/6] Creating login '$DB_USER'..." -ForegroundColor Yellow

Invoke-SQL "IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = N'$DB_USER') CREATE LOGIN [$DB_USER] WITH PASSWORD = N'$DB_PASS', CHECK_POLICY = OFF;" | Out-Null
Invoke-SQL "IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = N'$DB_USER') BEGIN CREATE USER [$DB_USER] FOR LOGIN [$DB_USER]; ALTER ROLE db_owner ADD MEMBER [$DB_USER]; END" -Database $DB_NAME | Out-Null

Write-Host "[OK] Login '$DB_USER' (db_owner) ready." -ForegroundColor Green

# =============================================================================
# STEP 3: Create supplemental tables missing from db/sql/
# =============================================================================
Write-Host ""
Write-Host "[3/6] Creating supplemental tables not in db/sql/..." -ForegroundColor Yellow

# 'Customers' is a separate business account table (different from 'Customer')
Invoke-SQL @"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='Customers' AND TABLE_SCHEMA='dbo')
CREATE TABLE dbo.Customers (
    customerId           INT PRIMARY KEY IDENTITY(1,1),
    customerName         VARCHAR(200) NOT NULL,
    primaryContactName   VARCHAR(100) NULL,
    primaryContactEmail  VARCHAR(320) NULL,
    primaryContactPhone  VARCHAR(50)  NULL,
    billingAddress1      VARCHAR(200) NULL,
    billingAddress2      VARCHAR(200) NULL,
    billingCity          VARCHAR(100) NULL,
    billingState         VARCHAR(100) NULL,
    billingPostalCode    VARCHAR(30)  NULL,
    billingCountry       VARCHAR(100) NULL,
    propertyId           INT NULL,
    active               CHAR(1)      NOT NULL DEFAULT 'Y',
    createDate           DATETIME     NOT NULL DEFAULT GETDATE(),
    lastUpdateTimestamp  DATETIME     NOT NULL DEFAULT GETDATE(),
    lastUpdateUser       VARCHAR(128) NOT NULL DEFAULT SUSER_SNAME()
);
"@ -Database $DB_NAME | Out-Null

# 'EntityTypeCriteria' is referenced by azure_data but has no migration script
Invoke-SQL @"
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='EntityTypeCriteria' AND TABLE_SCHEMA='dbo')
CREATE TABLE dbo.EntityTypeCriteria (
    EntityTypeCriteriaId  INT PRIMARY KEY IDENTITY(1,1),
    EntityTypeId          INT          NOT NULL,
    EntityTypeAttributeId INT          NOT NULL,
    STRValue              NVARCHAR(200) NULL,
    MinValue              FLOAT         NULL,
    MaxValue              FLOAT         NULL,
    Score                 INT           NOT NULL DEFAULT 0,
    active                CHAR(1)       NOT NULL DEFAULT 'Y',
    createDate            DATETIME2     NOT NULL DEFAULT GETDATE(),
    lastUpdateTimestamp   DATETIME2     NOT NULL DEFAULT GETDATE(),
    lastUpdateUser        NVARCHAR(128) NOT NULL DEFAULT SUSER_SNAME()
);
"@ -Database $DB_NAME | Out-Null

Write-Host "[OK] Supplemental tables ready." -ForegroundColor Green

# =============================================================================
# STEP 4: Run ALL db/sql migration scripts in sorted order
# =============================================================================
Write-Host ""
Write-Host "[4/6] Running db/sql migration scripts in order..." -ForegroundColor Yellow

# Skip files that are SELECT-only, examples, or non-SQL content
$SKIP_PATTERNS = @('select_', 'export-', 'example_queries', 'ZZOld_')

$migrationFiles = Get-ChildItem "$PSScriptRoot\db\sql\*.sql" | Sort-Object Name | Where-Object {
    $n = $_.Name
    foreach ($p in $SKIP_PATTERNS) { if ($n -like "*$p*") { return $false } }
    return $true
}

$total = $migrationFiles.Count; $c = 0
foreach ($file in $migrationFiles) {
    $c++
    Write-Host "  [$c/$total] $($file.Name)" -ForegroundColor Gray
    $r = Invoke-SQLFile $file.FullName
    # Only surface real errors (Severity 16+), not expected failures from old migrations
    $r | Where-Object { $_ -match "Msg (207|208|515|547|1767|1750|2627|2601)" -and $_ -match "Level (1[6-9]|2\d)" } |
        ForEach-Object { Write-Host "    WARN: $_" -ForegroundColor Yellow }
}

Write-Host "[OK] All migration scripts complete ($total files)." -ForegroundColor Green

# =============================================================================
# STEP 4b: Second pass for scripts that had unresolved FK deps on first pass
# =============================================================================
# These scripts reference AnalyzeFunction (created at 0152).
# Running them in a fresh second pass ensures their FKs are satisfied.
Write-Host ""
Write-Host "[4b/6] Second pass for FK-deferred scripts..." -ForegroundColor Yellow

$DEFERRED_PASS2 = @(
    '0022_Create_Event_table.sql',          # FK -> AnalyzeFunction (0152)
    '0027_Create_EventAttribute_table.sql', # FK -> Event + EntityTypeAttribute
    '0077_Create_Geofence_Events.sql',      # references Event
    '0160_Create_EventLog_tables.sql',      # FK -> Event + Entity
    '0165_Create_AnalyzeScore_function.sql',# references Event
    '0167_Create_AnalysisLog_table.sql'     # FK -> EventLog
)
$dc2 = 0
foreach ($name in $DEFERRED_PASS2) {
    $file = "$PSScriptRoot\db\sql\$name"
    if (Test-Path $file) {
        $dc2++
        Write-Host "  [$dc2] $name" -ForegroundColor Gray
        $r = Invoke-SQLFile $file
        $r | Where-Object { $_ -match "Msg \d+" -and $_ -match "Level (1[6-9]|2\d)" } |
            ForEach-Object { Write-Host "    WARN: $_" -ForegroundColor Yellow }
    }
}
Write-Host "[OK] Second pass complete ($dc2 scripts)." -ForegroundColor Green

# =============================================================================
# STEP 5: Populate data in FK-safe dependency order
# =============================================================================
Write-Host ""
Write-Host "[5/6] Populating data from azure_data_*.sql files..." -ForegroundColor Yellow

# Order: parent tables first, child tables after.
# id=$true  means the table has an IDENTITY PK with explicit values in the export
# id=$false means composite or string PK (no IDENTITY_INSERT needed)
$DATA_FILES = @(
    # Tier 1 - no FK dependencies
    @{ f="azure_data_EntityCategory.sql";          t="EntityCategory";          id=$true  },
    @{ f="azure_data_Protocol.sql";                t="Protocol";                id=$true  },
    @{ f="azure_data_Provider.sql";                t="Provider";                id=$true  },
    # Tier 2 - depend on Tier 1
    @{ f="azure_data_EntityType.sql";              t="EntityType";              id=$true  },
    @{ f="azure_data_ProtocolAttribute.sql";       t="ProtocolAttribute";       id=$true  },
    @{ f="azure_data_ProviderEvent.sql";           t="ProviderEvent";           id=$true  },
    # Tier 3 - depend on Tier 2
    @{ f="azure_data_EntityTypeAttribute.sql";     t="EntityTypeAttribute";     id=$true  },
    # Tier 4 - depend on Tier 3
    @{ f="azure_data_EntityTypeAttributeScore.sql";t="EntityTypeAttributeScore";id=$true  },
    @{ f="azure_data_EntityTypeCriteria.sql";      t="EntityTypeCriteria";      id=$true  },
    # AnalyzeFunction (independent)
    @{ f="azure_data_AnalyzeFunction.sql";         t="AnalyzeFunction";         id=$true  },
    # Event requires EntityType + AnalyzeFunction
    @{ f="azure_data_Event.sql";                   t="Event";                   id=$true  },
    # EventAttribute - composite PK (eventId + entityTypeAttributeId)
    @{ f="azure_data_EventAttribute.sql";          t="EventAttribute";          id=$false },
    # Customer accounts
    @{ f="azure_data_Customer.sql";                t="Customer";                id=$true  },
    @{ f="azure_data_Customers.sql";               t="Customers";               id=$true  },
    # Entity - string PK (entityId)
    @{ f="azure_data_Entity.sql";                  t="Entity";                  id=$false },
    # Customer relationships
    @{ f="azure_data_CustomerEntities.sql";        t="CustomerEntities";        id=$true  },
    @{ f="azure_data_CustomerSubscriptions.sql";   t="CustomerSubscriptions";   id=$true  },
    @{ f="azure_data_CustomerGeofenceCriteria.sql";t="CustomerGeofenceCriteria";id=$true  },
    # Transactional logs - need Entity + Event
    @{ f="azure_data_EventLog.sql";                t="EventLog";                id=$true  },
    @{ f="azure_data_EventLogDetails.sql";         t="EventLogDetails";         id=$true  }
    # AnalysisLog intentionally excluded - runtime log only, not needed for setup
)

$dtotal = $DATA_FILES.Count; $dc = 0
foreach ($entry in $DATA_FILES) {
    $dc++
    $path = Join-Path $PSScriptRoot $entry.f
    if (-not (Test-Path $path)) {
        Write-Host "  [$dc/$dtotal] SKIP (not found): $($entry.f)" -ForegroundColor DarkGray
        continue
    }
    Write-Host "  [$dc/$dtotal] $($entry.f)" -ForegroundColor Gray
    if ($entry.id) {
        $r = Invoke-DataFile -LocalPath $path -TableName $entry.t
    } else {
        $r = Invoke-SQLFile -LocalPath $path
    }
    $r | Where-Object { $_ -match "Msg \d+" -and $_ -match "Level (1[6-9]|2\d)" } |
        ForEach-Object { Write-Host "    WARN: $_" -ForegroundColor Yellow }
}

Write-Host "[OK] Data population complete." -ForegroundColor Green

# =============================================================================
# STEP 6: Verify - show all tables and row counts
# =============================================================================
Write-Host ""
Write-Host "[6/6] Verification - table row counts:" -ForegroundColor Yellow

docker exec $CONTAINER $SQLCMD -S localhost -U sa -P $SA_PASS -d $DB_NAME -C -N -Q `
    "SELECT t.name, SUM(p.rows) AS rows FROM sys.tables t JOIN sys.partitions p ON t.object_id=p.object_id AND p.index_id<2 GROUP BY t.name ORDER BY t.name" 2>&1 |
    Where-Object { $_ -notmatch "^--|----|rows affected" } |
    Where-Object { $_.Trim() } |
    ForEach-Object { Write-Host "  $_" -ForegroundColor White }

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Server  : localhost,1433" -ForegroundColor White
Write-Host "  Database: $DB_NAME" -ForegroundColor White
Write-Host "  User    : $DB_USER" -ForegroundColor White
Write-Host ""
Write-Host "Run .\start_all.ps1 for normal startup." -ForegroundColor Green
Write-Host "Data persists in Docker volume - no need to re-run this script." -ForegroundColor DarkGray
Write-Host ""
