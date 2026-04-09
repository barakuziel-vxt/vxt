"""
VXT Cloud API – Database connection layer (mssql-python)
========================================================
Uses the official Microsoft mssql-python driver (native TDS, no ODBC needed).
Connection params come from environment variables.
"""

import os
from contextlib import contextmanager

from mssql_python import connect

# ---------------------------------------------------------------------------
# Connection parameters from environment
# ---------------------------------------------------------------------------
MSSQL_SERVER = os.getenv("MSSQL_SERVER", "localhost")
MSSQL_DB = os.getenv("MSSQL_DB", "free-sql-db-5949639")
MSSQL_USER = os.getenv("MSSQL_USER", "sa")
MSSQL_PASS = os.getenv("MSSQL_PASS", "")


def _build_connection_string() -> str:
    """Build an ADO-style connection string for mssql-python."""
    parts = [
        f"Server={MSSQL_SERVER}",
        f"Database={MSSQL_DB}",
        f"UID={MSSQL_USER}",
        f"PWD={MSSQL_PASS}",
        "Encrypt=yes",
        "TrustServerCertificate=yes",
    ]
    return ";".join(parts)


def get_db_connection():
    """Return a new mssql-python connection."""
    return connect(_build_connection_string())


def query_as_dicts(sql: str, params: tuple = ()) -> list[dict]:
    """Execute *sql* and return every row as a dict keyed by column name."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return rows
    finally:
        conn.close()


def execute_sql(sql: str, params: tuple = ()) -> int:
    """Execute a write statement (INSERT/UPDATE/DELETE) and return rows affected."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        affected = cursor.rowcount
        conn.commit()
        return affected
    finally:
        conn.close()


@contextmanager
def get_db():
    """Context manager for connection lifecycle."""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
