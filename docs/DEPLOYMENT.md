# Deployment (Kubernetes / Helm)

> Prepared, not deployed. The chart lives in `infra/helm/marad`; `helm lint --strict` and
> `helm template` run clean, and Trivy's Kubernetes checks report no HIGH/CRITICAL issue.

## What the chart creates

| Object | Per service | Notes |
|---|---|---|
| Deployment | 12 (gateway, 10 services, web) | non-root, read-only root FS, all capabilities dropped, `RuntimeDefault` seccomp, no service-account token, probes on `/health` |
| Service | 12 | ClusterIP |
| PodDisruptionBudget | 12 | `minAvailable: 1` |
| HorizontalPodAutoscaler | gateway (default) | enable per service in `values.yaml` |
| NetworkPolicy | — | default: pods accept traffic only from the release; gateway, socket and web also from the ingress controller |
| Ingress | — | `api.example.com` → gateway (`/socket.io` → messaging), `www.example.com` → web |
| Job (hook) | — | `db/migrations` before every install/upgrade (advisory-locked, idempotent) |

Data stores are **not** in the chart: use managed PostgreSQL 16, Redis 7 and Elasticsearch/OpenSearch 8.

## 1. Build and push the images

```bash
REG=ghcr.io/your-org TAG=1.0.0
for s in api-gateway auth-service listings-service search-service messaging-service transactions-service identity-service; do
  docker build -f infra/docker/node-workspace.Dockerfile --build-arg SERVICE=$s -t $REG/marad-$s:$TAG . && docker push $REG/marad-$s:$TAG
done
for s in users-service moderation-service fraud-service personalization-service; do
  docker build -t $REG/marad-$s:$TAG services/$s && docker push $REG/marad-$s:$TAG
done
docker build -t $REG/marad-migrate:$TAG db && docker push $REG/marad-migrate:$TAG
docker build -f infra/docker/web.Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
  --build-arg NEXT_PUBLIC_SOCKET_URL=https://api.example.com \
  -t $REG/marad-web:$TAG . && docker push $REG/marad-web:$TAG
```

## 2. Create the secrets (never in values.yaml)

```bash
node scripts/gen-jwt-keys.mjs > /tmp/jwt.env   # JWT_PUBLIC_JWKS + JWT_PRIVATE_KEY_B64

kubectl create secret generic marad-app \
  --from-literal=DATABASE_URL='postgresql://marad:***@db.internal:5432/marad_db?sslmode=require' \
  --from-literal=REDIS_HOST=redis.internal \
  --from-literal=INTERNAL_SECRET="$(openssl rand -hex 32)" \
  --from-literal=JWT_PUBLIC_JWKS="$(grep ^JWT_PUBLIC_JWKS /tmp/jwt.env | cut -d= -f2- | tr -d "'")" \
  --from-literal=DIDIT_WEBHOOK_SECRET=... --from-literal=METRICS_TOKEN="$(openssl rand -hex 32)"

kubectl create secret generic marad-auth-signing \
  --from-literal=JWT_PRIVATE_KEY_B64="$(grep ^JWT_PRIVATE_KEY_B64 /tmp/jwt.env | cut -d= -f2-)" \
  --from-literal=JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
shred -u /tmp/jwt.env
```

Only auth-service mounts `marad-auth-signing`. In production prefer the External Secrets Operator
or sealed-secrets over `kubectl create secret`.

## 3. Install

```bash
helm upgrade --install marad infra/helm/marad -n marad --create-namespace \
  --set image.registry=ghcr.io/your-org --set image.tag=1.0.0 \
  --set ingress.apiHost=api.example.com --set ingress.webHost=www.example.com \
  --set config.CORS_ORIGINS=https://www.example.com --set config.COOKIE_DOMAIN=.example.com
```

## 4. Key rotation (access tokens)

1. Generate a new pair; put **both** public keys in `JWT_PUBLIC_JWKS` (`{"keys":[old,new]}`) and roll the verifiers.
2. Switch `JWT_PRIVATE_KEY_B64` to the new private key and roll auth-service.
3. After 15 minutes (access-token lifetime) remove the old public key.

## Production checklist (not covered by the chart)

- Per-service PostgreSQL roles with grants on their own tables only, and per-caller internal secrets (SECURITY_AUDIT S16).
- Restrict image registries (Kyverno/Gatekeeper) — Trivy KSV-0032..0035, 0125.
- WAF / bot protection on `/auth/*`, backups with tested restore, alerting rules on the Grafana dashboards.
