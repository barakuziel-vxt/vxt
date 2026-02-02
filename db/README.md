# Database (short)

SQL scripts live in `tables/boat-telemetry-db/sql/` for now. Key files include schema and sample `select_from_DB.sql`.

How to run SQL scripts
- Use `run_sql_script.py` in the repo to execute SQL against your dev DB, or use your SQL client (e.g., SQL Server Management Studio / sqlcmd).

Notes and future improvements
- When the project grows, move SQL to `db/migrations/` and adopt a migration tool (Flyway, Alembic, Liquibase).
- Keep seed and test data in a `db/seeds/` folder later.