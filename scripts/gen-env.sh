#!/usr/bin/env sh
# Creates infra/.env from infra/.env.example with fresh random secrets and an RS256 key pair
# for access tokens. Never overwrites a value; an existing infra/.env only gets the keys it
# is missing (e.g. after an upgrade).
set -eu
cd "$(dirname "$0")/.."
target=infra/.env
rand() { openssl rand -hex 32; }

jwt_keys() {
  if command -v node >/dev/null 2>&1; then
    node scripts/gen-jwt-keys.mjs
  else
    docker run --rm -v "$PWD/scripts:/s:ro" node:20-alpine node /s/gen-jwt-keys.mjs
  fi
}

umask 077
if [ ! -f "$target" ]; then
  while IFS= read -r line; do
    case "$line" in
      POSTGRES_PASSWORD=|JWT_REFRESH_SECRET=|INTERNAL_SECRET=|DIDIT_WEBHOOK_SECRET=|METRICS_TOKEN=|GRAFANA_ADMIN_PASSWORD=)
        printf '%s%s\n' "$line" "$(rand)" ;;
      JWT_PUBLIC_JWKS=|JWT_PRIVATE_KEY_B64=) ;;  # appended below
      *) printf '%s\n' "$line" ;;
    esac
  done < infra/.env.example > "$target"
  echo "Created $target with random secrets (mode 600)."
fi

if ! grep -q '^JWT_PUBLIC_JWKS=.' "$target"; then
  sed -i.bak '/^JWT_PUBLIC_JWKS=$/d; /^JWT_PRIVATE_KEY_B64=$/d; /^JWT_ACCESS_SECRET=/d' "$target" && rm -f "$target.bak"
  { echo ""; echo "# RS256 key pair for access tokens (scripts/gen-jwt-keys.mjs)"; jwt_keys; } >> "$target"
  echo "Added an RS256 key pair for access tokens to $target."
fi
