#!/usr/bin/env sh
# Creates infra/.env from infra/.env.example with fresh random secrets.
# Never overwrites an existing infra/.env.
set -eu
cd "$(dirname "$0")/.."
target=infra/.env
if [ -f "$target" ]; then
  echo "$target already exists — leaving it untouched."
  exit 0
fi
rand() { openssl rand -hex 32; }
umask 077
while IFS= read -r line; do
  case "$line" in
    POSTGRES_PASSWORD=|JWT_ACCESS_SECRET=|JWT_REFRESH_SECRET=|INTERNAL_SECRET=|DIDIT_WEBHOOK_SECRET=|METRICS_TOKEN=|GRAFANA_ADMIN_PASSWORD=)
      printf '%s%s\n' "$line" "$(rand)" ;;
    *) printf '%s\n' "$line" ;;
  esac
done < infra/.env.example > "$target"
echo "Created $target with random secrets (mode 600)."
