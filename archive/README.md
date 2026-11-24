# Archive

Files removed from the active tree, kept here for reference (nothing is deleted without a copy).

| Path | Removed in | Why |
|---|---|---|
| `dockerfiles/*.Dockerfile` | T2.1 | Original per-service Dockerfiles: `npm install` without the lockfile, ran as root, no health check, and compose used their `builder` stage with `npm run start:dev`. Replaced by `infra/docker/node-workspace.Dockerfile` (workspace services) and hardened per-service Dockerfiles (users, moderation, fraud, personalization). |
| `lockfiles/listings-service.package-lock.json` | T1.2 | listings-service is a member of the root npm workspace, so this lockfile was never used by `npm ci`; it was stale and pinned vulnerable versions that scanners (Trivy) report. |
| `fraud-service-stub/` | T1.3 | `services/fraud-service/app/` was an empty FastAPI skeleton left from Sprint 0 (the real service is `main.py` at the service root, which the Dockerfile runs). Only its own smoke test imported it. |
| `eslint/listings-service.eslintrc.js` | T5.1 | ESLint 8 config of a workspace service; replaced by the root flat config `eslint.config.mjs` (ESLint 9) shared by the 7 workspace services. |
