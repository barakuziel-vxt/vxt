# VXT

Boat telemetry demo project

Overview
- Python services (anomaly_detector, API, producers/consumers)
- React dashboard in `boat-dashboard`
- Uses a local SQLite / SQL scripts in `tables/boat-telemetry-db`

Goals
- Host on Azure (Event Hubs with Kafka API, Azure Functions for Python, Azure SQL)
- CI/CD using GitHub Actions + Terraform

Quick start (local)
1. Create a Python venv and activate:
   ```bash
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1   # Windows (PowerShell)
   pip install -r requirements.txt
   ```
2. Run the dashboard:
   cd boat-dashboard
   npm install
   npm start

Developer onboarding & quick tips
- See `DEVELOPER_ONBOARDING.md` for a short, step-by-step setup to get a second developer running in ~10 minutes.
- Convenience scripts: `start_all.ps1` (Windows) or `docker-compose.yml` (optional) to bring up local services quickly.

Tests
- Run `pytest` from project root.

Infrastructure & Deployment
- Terraform scaffolding in `infra/` (provider configuration, resource stubs)
- Workflows in `.github/workflows/` for CI, infra plan/apply and deploy

License
- MIT License (see `LICENSE`)

Contributing
- See `CONTRIBUTING.md` for PR/process guidance

Notes
- This repo is intended to be **private** under your GitHub account (you requested private visibility). Update the repo name or visibility in GitHub when creating it.
