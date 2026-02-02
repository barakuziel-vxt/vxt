# Local Setup

1. Python
   - Create a venv: `python -m venv .venv`
   - Activate and install: `pip install -r requirements.txt`
2. Dashboard
   - `cd boat-dashboard`
   - `npm install`
   - `npm start`

   - Optional: set `REACT_APP_API_BASE` when your API is hosted on a different host/port.
     You can copy `boat-dashboard/.env.example` → `boat-dashboard/.env` and edit the value.

3. Database
   - See `tables/boat-telemetry-db/README.md` for SQL initialization scripts

4. Tests
   - Run `pytest` from repo root

Tips
- Use `pre-commit` hooks to keep style consistent.
