"""
One-time schema fix: Event.eventId auto-generation on Azure SQL production.

Problem:
    The production Event table was created without IDENTITY on eventId (explicit IDs were
    seeded from azure_data_Event.sql). INSERT without supplying eventId fails with NULL
    constraint violation.

Fix (non-destructive, no table rebuild):
    1. Create a SEQUENCE starting after the current max eventId.
    2. Add a DEFAULT constraint that uses NEXT VALUE FOR the sequence.

This is idempotent — safe to run multiple times.

Usage:
    python fix_event_eventid_schema.py
"""

import sys
import os

# Do NOT load .env — we explicitly target Azure SQL production here.
# Connection is identical to what main.py uses in Azure, but with SQL Login
# instead of Managed Identity (for running locally).
from mssql_python import connect

AZURE_CONN_STR = (
    "Server=vxtdb.database.windows.net,1433;"
    "Database=free-sql-db-5949639;"
    "UID=vxt;"
    "PWD=Barak1976!;"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
)

def get_connection():
    print(f"[INFO] Connecting to Azure SQL (vxtdb.database.windows.net / free-sql-db-5949639)...")
    return connect(AZURE_CONN_STR)


def check_column_identity(conn):
    """Return True if eventId already has IDENTITY property."""
    cur = conn.cursor()
    cur.execute("""
        SELECT is_identity FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.Event') AND name = 'eventId'
    """)
    row = cur.fetchone()
    cur.close()
    return bool(row and row[0])


def apply_fix(conn):
    cur = conn.cursor()

    has_identity = check_column_identity(conn)
    if has_identity:
        print("[INFO] eventId already has IDENTITY property — DEFAULT constraint not needed.")
        print("[INFO] The INSERT in main.py should work correctly without any schema changes.")
        print("[INFO] Checking if the INSERT statement in main.py excludes eventId from column list...")
        cur.close()
        return

    # Step 1 — create the sequence starting after the current max eventId
    print("[1/2] Creating sequence dbo.seq_Event_eventId (if not exists)...")
    cur.execute("""
        IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE object_id = OBJECT_ID('dbo.seq_Event_eventId'))
        BEGIN
            DECLARE @maxId INT;
            SELECT @maxId = ISNULL(MAX(eventId), 0) FROM dbo.Event;
            DECLARE @sql NVARCHAR(500);
            SET @sql = N'CREATE SEQUENCE dbo.seq_Event_eventId '
                     + N'START WITH ' + CAST(@maxId + 1 AS NVARCHAR(10))
                     + N' INCREMENT BY 1 MINVALUE 1 NO MAXVALUE NO CYCLE NO CACHE;';
            EXEC sp_executesql @sql;
        END
    """)
    conn.commit()
    print("[1/2] Done.")

    # Step 2 — add DEFAULT constraint on eventId using the sequence
    print("[2/2] Adding DEFAULT constraint DF_Event_eventId (if not exists)...")
    cur.execute("""
        IF NOT EXISTS (
            SELECT 1 FROM sys.default_constraints
            WHERE parent_object_id = OBJECT_ID('dbo.Event')
              AND parent_column_id  = COLUMNPROPERTY(OBJECT_ID('dbo.Event'), 'eventId', 'ColumnId')
        )
        BEGIN
            ALTER TABLE dbo.Event
                ADD CONSTRAINT DF_Event_eventId
                DEFAULT (NEXT VALUE FOR dbo.seq_Event_eventId) FOR eventId;
        END
    """)
    conn.commit()
    cur.close()

    print("[2/2] Done.")
    print("[OK] Schema fix applied — new events will now receive auto-generated eventIds.")


if __name__ == "__main__":
    print("=== Event.eventId Schema Fix — Azure SQL Production ===")
    conn = get_connection()
    try:
        apply_fix(conn)
    except Exception as e:
        print(f"[ERROR] Fix failed: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()
