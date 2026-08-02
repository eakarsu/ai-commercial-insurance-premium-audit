#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; source ./.env; set +a; fi
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
