# Database (short)

SQL scripts live in `db/sql/` (moved from `tables/boat-telemetry-db/sql/`). Key files include schema and sample `select_from_DB.sql`.

How to run SQL scripts
- Use `run_sql_script.py` in the repo to execute SQL against your dev DB, or use your SQL client (e.g., SQL Server Management Studio / sqlcmd).

Notes and future improvements
- When the project grows, move SQL to `db/migrations/` and adopt a migration tool (Flyway, Alembic, Liquibase).
- Keep seed and test data in a `db/seeds/` folder later.

Deprecated / removed files
- `db/sql/changes_to_be_done.sql` — removed as it contained ad-hoc notes and TODOs. The removal is documented in the commit message `chore(db): remove obsolete changes_to_be_done.sql`. If you need the file contents, retrieve it from the repository history (or ask the maintainer).