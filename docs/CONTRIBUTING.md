# Contributing to VXT

Thank you for contributing! Please follow these guidelines:

- Fork and create feature branches from `main` using the naming `feature/short-description`.
- Keep PRs small and focused. Add tests for new behavior.
- Run `pytest` locally and ensure the dashboard builds (`cd boat-dashboard && npm ci && npm run build`).
- Use `flake8` / `black` to format Python code; run `npm run lint` for JS if available.

PR template suggestions:
- Short description
- Related issue (if any)
- Testing performed
- Checklist: tests added, docs updated

Quick PR process
- Create PR targeting `main`.
- Request at least one reviewer and wait for approval before merging.
- Keep PRs focused and small; rebase or squash merge as appropriate.
