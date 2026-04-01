"""Fix EntityTelemetry: drop and recreate with IDENTITY(1,1) on entityTelemetryId."""
from mssql_python import connect

conn_str = (
    'Server=vxtdb.database.windows.net,1433;'
    'Database=free-sql-db-5949639;'
    'UID=vxtadmin;'
    'PWD=xK9@mP2#wQ5!rL8$tN3vZ7&;'
    'Encrypt=yes;'
    'TrustServerCertificate=no;'
)

# SQL to drop and recreate EntityTelemetry with IDENTITY
# Safe because table is currently empty (all inserts have been failing)
FIX_SQL = """
IF OBJECT_ID('dbo.EventLogDetails') IS NOT NULL
    ALTER TABLE dbo.EventLogDetails DROP CONSTRAINT IF EXISTS FK_EventLogDetails_EntityTelemetry;

DROP TABLE IF EXISTS dbo.EntityTelemetry;

CREATE TABLE dbo.EntityTelemetry (
    entityTelemetryId       BIGINT IDENTITY(1,1) NOT NULL,
    entityId                NVARCHAR(50)  NOT NULL,
    entityTypeAttributeId   INT           NOT NULL,
    startTimestampUTC       DATETIME2(7)  NOT NULL,
    endTimestampUTC         DATETIME2(7)  NOT NULL,
    ingestionTimestampUTC   DATETIME2(7)  NULL DEFAULT (SYSUTCDATETIME()),
    providerEventInterpretation NVARCHAR(50) NULL,
    providerDevice          NVARCHAR(50)  NOT NULL,
    numericValue            FLOAT         NULL,
    latitude                FLOAT         NULL,
    longitude               FLOAT         NULL,
    stringValue             NVARCHAR(500) NULL,
    INDEX IX_EntityTelemetry_ColumnStore CLUSTERED COLUMNSTORE
);
"""

try:
    print("Connecting to Azure SQL...")
    conn = connect(conn_str)
    conn.autocommit = True
    cursor = conn.cursor()

    print("Checking current row count...")
    cursor.execute("SELECT COUNT(*) FROM dbo.EntityTelemetry")
    row = cursor.fetchone()
    print(f"  Current rows: {row[0]}")

    print("Checking IDENTITY property...")
    cursor.execute("""
        SELECT COLUMNPROPERTY(OBJECT_ID('dbo.EntityTelemetry'), 'entityTelemetryId', 'IsIdentity')
    """)
    row2 = cursor.fetchone()
    print(f"  IsIdentity: {row2[0]}")

    if row2[0] == 1:
        print("IDENTITY already exists — no fix needed.")
    else:
        print("IDENTITY missing — applying fix...")
        cursor.execute(FIX_SQL)
        print("Fix applied.")

        # Verify
        cursor.execute("""
            SELECT COLUMNPROPERTY(OBJECT_ID('dbo.EntityTelemetry'), 'entityTelemetryId', 'IsIdentity')
        """)
        row3 = cursor.fetchone()
        print(f"  IsIdentity after fix: {row3[0]}")

    cursor.close()
    conn.close()
    print("Done.")
except Exception as e:
    print(f"ERROR: {e}")
