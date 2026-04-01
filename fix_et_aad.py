"""Fix EntityTelemetry: drop and recreate with IDENTITY using pyodbc + AAD token."""
import subprocess

def get_aad_token():
    result = subprocess.run(
        'az account get-access-token --resource https://database.windows.net/ --query accessToken -o tsv',
        shell=True, capture_output=True, text=True
    )
    if result.returncode != 0:
        raise Exception(f"az token failed: {result.stderr}")
    return result.stdout.strip()

try:
    import pyodbc
except ImportError:
    print("pyodbc not installed. Installing...")
    subprocess.run('pip install pyodbc', shell=True)
    import pyodbc

token = get_aad_token()
print(f"Got AAD token: {token[:20]}...")

drivers = [x for x in pyodbc.drivers() if 'SQL Server' in x]
print(f"Available ODBC drivers: {drivers}")
driver = 'ODBC Driver 18 for SQL Server' if 'ODBC Driver 18 for SQL Server' in drivers else (drivers[-1] if drivers else None)
if not driver:
    raise Exception("No SQL Server ODBC driver found")
print(f"Using driver: {driver}")

conn_str = (
    f'DRIVER={{{driver}}};'
    'SERVER=vxtdb.database.windows.net,1433;'
    'DATABASE=free-sql-db-5949639;'
    'Encrypt=yes;'
    'TrustServerCertificate=no;'
)

SQL_COPT_SS_ACCESS_TOKEN = 1256
# Token must be UTF-16-LE encoded for ODBC access token
token_bytes = bytes(token, 'utf-8')

try:
    conn = pyodbc.connect(conn_str, attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token_bytes})
    conn.autocommit = True
    cursor = conn.cursor()
    print("Connected successfully!")

    cursor.execute("SELECT COUNT(*) FROM dbo.EntityTelemetry")
    row = cursor.fetchone()
    print(f"Current rows: {row[0]}")

    cursor.execute("""
        SELECT COLUMNPROPERTY(OBJECT_ID('dbo.EntityTelemetry'), 'entityTelemetryId', 'IsIdentity')
    """)
    row2 = cursor.fetchone()
    is_identity = row2[0]
    print(f"IsIdentity: {is_identity}")

    if is_identity == 1:
        print("IDENTITY already exists — no fix needed!")
    else:
        print(f"IDENTITY missing. Rows in table: {row[0]}. Applying fix...")

        cursor.execute("ALTER TABLE dbo.EventLogDetails DROP CONSTRAINT IF EXISTS FK_EventLogDetails_EntityTelemetry")
        print("  [1/3] Dropped FK on EventLogDetails")

        cursor.execute("DROP TABLE IF EXISTS dbo.EntityTelemetry")
        print("  [2/3] Dropped EntityTelemetry")

        cursor.execute("""
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
)""")
        print("  [3/3] Created EntityTelemetry with IDENTITY(1,1)")

        cursor.execute("""
            SELECT COLUMNPROPERTY(OBJECT_ID('dbo.EntityTelemetry'), 'entityTelemetryId', 'IsIdentity')
        """)
        row3 = cursor.fetchone()
        print(f"  Verified IsIdentity: {row3[0]}")

    cursor.close()
    conn.close()
    print("\nDone!")
except Exception as e:
    print(f"ERROR: {e}")
