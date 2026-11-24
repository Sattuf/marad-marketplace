#!/usr/bin/env sh
# Five-minute tour of the platform through the public API (run `make up` first).
#   sh scripts/demo.sh        or        make demo
set -eu
API=${API_URL:-http://localhost:3000/api/v1}
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s);console.log(eval('v'+process.argv[1]))})" "$1"; }
step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }

step "1. Health of the gateway"
curl -fsS "${API%/api/v1}/health"; echo

step "2. Demo data (accounts + listings, idempotent)"
node scripts/seed-demo.mjs | tail -n 4

step "3. Sign in as the demo seller (RS256 access token, kid header)"
LOGIN=$(curl -fsS "$API/auth/login" -H 'content-type: application/json' \
  -d '{"identifier":"seller@demo.marad.local","password":"Demo!Passw0rd"}')
TOKEN=$(printf '%s' "$LOGIN" | json '.tokens.access_token')
printf '%s' "$TOKEN" | cut -d. -f1 | node -e "process.stdin.on('data',d=>console.log('JWT header:',Buffer.from(d.toString().trim(),'base64url').toString()))"

step "4. Publish a listing — one request, traced across gateway → listings → search (+ more)"
curl -fsS "$API/listings" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H 'X-Request-ID: demo-tour-0001' \
  -d '{"title":"دراجة هوائية للتجربة","description":"من سكربت العرض التوضيحي","price":150}' | json '.id' | sed 's/^/listing id: /'

step "5. Ranked search (Elasticsearch, A/B variant assigned per visitor)"
sleep 2
curl -fsS "$API/search?q=%D8%AF%D8%B1%D8%A7%D8%AC%D8%A9&limit=3&session_id=demo" | json '' 

step "6. Security: a forged admin token is rejected, internal routes are not exposed"
FORGED="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4Iiwicm9sZSI6ImFkbWluIn0.c2lnbmF0dXJl"
printf 'forged token on /admin/reports → HTTP %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$API/admin/reports" -H "authorization: Bearer $FORGED")"
printf 'internal POST /listings/batch → HTTP %s\n' "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/listings/batch")"

step "7. One error shape everywhere, with the request id"
curl -s "$API/listings/not-a-uuid" -H 'X-Request-ID: demo-tour-0002'; echo

cat <<'TXT'

Explore:
  Web app        http://localhost:3100     (seller@ / buyer@ / admin@demo.marad.local — Demo!Passw0rd)
  Swagger (all)  http://localhost:3000/api/docs   (service dropdown, top right)
  Jaeger         http://localhost:16686    (service api-gateway → find the "demo-tour" request)
  Grafana        http://localhost:3200     (admin / GRAFANA_ADMIN_PASSWORD in infra/.env)
TXT
