"""Fix EntityTelemetry IDENTITY using Azure AD access token via pyodbc."""
import subprocess
import struct
import pyodbc

# Get AAD token
result = subprocess.run(
    'az account get-access-token --resource https://database.windows.net --query accessToken -o tsv',
    shell=True, capture_output=True, text=True
)
token = result.stdout.strip()
print(f"Token: {token[:30]}...")

# Encode token as SQL Server expects: UTF-16-LE packed struct
token_bytes = token.encode('utf-16-le')
# Prepend with length as a DWORD (ODBC access token struct format)
access_token = struct.pack('I', len(token_bytes)) + token_bytes

SQL_COPT_SS_ACCESS_TOKEN = 1256

conn_str = (
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=vxtdb.database.windows.net,1433;'
    'DATABASE=free-sql-db-5949639;'
    'Encrypt=yes;'
    'TrustServerCertificate=no;'
)
try:
    conn = pyodbc.connect(conn_str, attrs_before={SQL_COPT_SS_ACCESS_TOKEN: access_token})
    conn.autocommit = True
    cursor = conn.cursor()
    print("Connected via AAD token!")
    
    cursor.execute("""
        SELECT COLUMNPROPERTY(OBJECT_ID('dbo.EntityTelemetry'), 'entityTelemetryId', 'IsIdentity') AS IsIdentity
    """)
    row = cursor.fetchone()
    print("IsIdentity:", row[0])
    
    cursor.execute("SELECT COUNT(*) FROM dbo.EntityTelemetry")
    row2 = cursor.fetchone()
    print("Row count:", row2[0])
    
    if row[0] != 1:
        print("Applying IDENTITY fix...")
        cursor.execute("ALTER TABLE dbo.EventLogDetails DROP CONSTRAINT IF EXISTS FK_EventLogDetails_EntityTelemetry")
        print("  [1/3] Dropped FK")
        cursor.execute("DROP TABLE IF EXISTS dbo.EntityTelemetry")
        print("  [2/3] Dropped table")
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
        print("  [3/3] Recreated with IDENTITY(1,1)")
        
        cursor.execute("""
            SELECT COLUMNPROPERTY(OBJECT_ID('dbo.EntityTelemetry'), 'entityTelemetryId', 'IsIdentity')
        """)
        row3 = cursor.fetchone()
        print(f"  Verified IsIdentity: {row3[0]}")
    else:
        print("IDENTITY already present - no action needed")
    
    cursor.close()
    conn.close()
    print("Done!")
except Exception as e:
    print(f"ERROR: {e}")
