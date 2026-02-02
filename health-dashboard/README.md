# Health Dashboard

A standalone React dashboard that displays HealthVitals (map, metrics, and time-series charts).

## Run locally

1. cd health-dashboard
2. npm ci
3. Copy `.env.example` → `.env` and set `REACT_APP_API_BASE` if needed
4. npm start

API endpoints:
- `GET /customers/{customerName}/properties` (same as boat dashboard)
- `GET /health/{ID}?limit=N` (returns health vitals; this dashboard shows all numeric fields)
