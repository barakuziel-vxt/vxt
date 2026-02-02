# Developer Onboarding (short)

Follow these steps to get started (10–15 min):

1. Clone the repository.
2. Create a feature branch, e.g. `chore/repo-structure` or `feature/<your>-<what>`.
3. Create a Python venv and activate it:
   - `python -m venv .venv`
   - Windows PowerShell: ` .\.venv\Scripts\Activate.ps1`
4. Copy `.env.example` to `.env` and edit credentials for your local DB/broker.
5. Install Python deps (if `requirements.txt` exists): `pip install -r requirements.txt`.
6. Start services:
   - Quick: run `start_all.ps1` (Windows PowerShell), or
   - Use `docker-compose up` (if you prefer Docker).  
7. Frontend dashboards: `cd boat-dashboard && npm install && npm run dev` and same for `health-dashboard`.
8. To run SQL scripts: use `run_sql_script.py` or your SQL client against the DB; SQL files are under `tables/boat-telemetry-db/sql/`.

Notes:
- Keep changes small and PR-based; the `CONTRIBUTING.md` has guidance on PRs and branch naming.
- If you need an environment, ask the repo owner to share connection values or add them to secure variables (do not commit secrets).