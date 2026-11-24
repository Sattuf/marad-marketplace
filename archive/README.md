# Archive

Files removed from the active tree, kept here for reference (nothing is deleted without a copy).

| Path | Removed in | Why |
|---|---|---|
| `dockerfiles/*.Dockerfile` | T2.1 | Original per-service Dockerfiles: `npm install` without the lockfile, ran as root, no health check, and compose used their `builder` stage with `npm run start:dev`. Replaced by `infra/docker/node-workspace.Dockerfile` (workspace services) and hardened per-service Dockerfiles (users, moderation, fraud, personalization). |
