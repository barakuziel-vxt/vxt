# API

This folder contains API-related scripts and small services (single-file apps currently).

Key files (top-level project root also contains some):
- `api_flask.py` — Flask-based API
- `api_httpserver.py`, `api_simple.py` — lightweight/testing servers
- `serve_flask.py`, `run_api.py` — run helpers

Run (example):
1. Activate venv and install deps.
2. `python api_flask.py` or `python run_api.py`.

Notes:
- Add a `requirements.txt` per-service if dependencies grow.
- Keep API-specific tests in `api/tests/` if you add them (or `tests/api/`).