#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
shared_openrouter_env="$(cd .. && pwd)/.openrouter.env"
if [ -f "$shared_openrouter_env" ]; then set -a; source "$shared_openrouter_env"; set +a; fi
if [ -f .env ]; then set -a; source ./.env; set +a; fi
export UI_PORT="${UI_PORT:-4519}"
export API_PORT="${API_PORT:-5519}"
export UI_HOST="${UI_HOST:-127.0.0.1}"
export API_HOST="${API_HOST:-127.0.0.1}"
export PUBLIC_HOST="${PUBLIC_HOST:-$UI_HOST}"
export OPENROUTER_BASE_URL="${OPENROUTER_BASE_URL:-https://openrouter.ai/api/v1}"
export OPENROUTER_MODEL="${OPENROUTER_MODEL:-anthropic/claude-haiku-4.5}"
export SESSION_SECRET="${SESSION_SECRET:-local-demo-session-secret-change-before-production}"
if [ -z "${DATABASE_URL:-}" ]; then
  db_user="${PGUSER:-$(id -un)}"
  db_name="profit_ai_commercial_insurance_premium_audit"
  if ! psql -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname='$db_name'" | grep -q 1; then createdb -h 127.0.0.1 -U "$db_user" "$db_name"; fi
  export DATABASE_URL="postgresql://$db_user@127.0.0.1:5432/$db_name"
fi
for migration in backend/migrations/*.sql; do
  PGOPTIONS='--client-min-messages=warning' psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done
node backend/scripts/seed.mjs
node backend/server.mjs &
api_pid=$!
cleanup() { kill "$api_pid" 2>/dev/null || true; wait "$api_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
for _ in {1..40}; do curl -fsS "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1 && break; sleep 0.1; done
echo "Premium Audit Intelligence UI: http://$PUBLIC_HOST:$UI_PORT"
echo "Premium Audit Intelligence API: http://$PUBLIC_HOST:$API_PORT"
cd frontend
exec ./node_modules/.bin/vite --host "$UI_HOST" --port "$UI_PORT"
