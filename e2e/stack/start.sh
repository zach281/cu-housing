#!/usr/bin/env bash
# Starts a local, disposable copy of the Supabase services this app uses
# (TEST ONLY, for machines without Docker):
#   Postgres (yours) + Supabase Auth + PostgREST + storage emulation + SMTP sink
# behind one gateway on http://localhost:54321.
#
#   ADMIN_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres e2e/stack/start.sh
#
# It DROPS and recreates a database named "stack" on that server.
# Then run the app with:
#   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_test_key
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${ADMIN_DATABASE_URL:?Set ADMIN_DATABASE_URL to a superuser connection on a disposable Postgres 15+ server}"
STACK_DIR="${STACK_DIR:-/var/tmp/cu-housing-stack}"
BIN_DIR="${BIN_DIR:-/var/tmp/cu-housing-bin}"
POSTGREST_VERSION=v12.2.3
AUTH_VERSION=v2.177.0
JWT_SECRET="local-test-jwt-secret-at-least-32-characters-long"
export PUBLISHABLE_KEY="sb_publishable_local_test_key"
APP_URL="${APP_URL:-http://localhost:3100}"

PG_HOST=$(psql "$ADMIN_DATABASE_URL" -Atc "select coalesce(host(inet_server_addr()), '127.0.0.1')")
PG_PORT=$(psql "$ADMIN_DATABASE_URL" -Atc "select inet_server_port()")
[ -z "$PG_PORT" ] && PG_PORT=$(psql "$ADMIN_DATABASE_URL" -Atc "show port")
db_url() { echo "postgres://$1@${PG_HOST:-127.0.0.1}:$PG_PORT/stack?sslmode=disable"; }

# --- binaries (official GitHub releases) -------------------------------------
mkdir -p "$BIN_DIR"
if [ ! -x "$BIN_DIR/postgrest" ]; then
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz" | tar -xJ -C "$BIN_DIR"
fi
if [ ! -x "$BIN_DIR/auth/auth" ]; then
  mkdir -p "$BIN_DIR/auth"
  curl -fsSL "https://github.com/supabase/auth/releases/download/$AUTH_VERSION/auth-$AUTH_VERSION-x86.tar.gz" | tar -xz -C "$BIN_DIR/auth"
fi

# --- stop anything from a previous run ---------------------------------------
"$(dirname "$0")/stop.sh" >/dev/null 2>&1 || true
rm -rf "$STACK_DIR"; mkdir -p "$STACK_DIR"/{outbox,storage,logs}

# --- database ------------------------------------------------------------------
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" "$ADMIN_DATABASE_URL" -c "drop database if exists stack with (force)" -c "create database stack"
STACK_ADMIN_URL=$("${PSQL[@]}" "$ADMIN_DATABASE_URL" -Atc "select regexp_replace('$ADMIN_DATABASE_URL', '/[^/?]*(\?|$)', '/stack\1')")
"${PSQL[@]}" "$STACK_ADMIN_URL" -f e2e/stack/init.sql

export GOTRUE_DB_DRIVER=postgres
export DATABASE_URL="$(db_url supabase_auth_admin)"
export GOTRUE_DB_MIGRATIONS_PATH="$BIN_DIR/auth/migrations"
export API_EXTERNAL_URL="http://localhost:54321/auth/v1"
export GOTRUE_API_HOST=127.0.0.1 PORT=9999 GOTRUE_SITE_URL="$APP_URL" GOTRUE_URI_ALLOW_LIST="$APP_URL/**"
export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
export GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
export GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=false GOTRUE_PASSWORD_MIN_LENGTH=8
export GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=2500 GOTRUE_SMTP_USER=test GOTRUE_SMTP_PASS=test
export GOTRUE_SMTP_ADMIN_EMAIL=noreply@test.local GOTRUE_SMTP_SENDER_NAME="Test"
export GOTRUE_RATE_LIMIT_EMAIL_SENT=100000 GOTRUE_RATE_LIMIT_VERIFY=100000 GOTRUE_RATE_LIMIT_TOKEN_REFRESH=100000
export GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS=100000 GOTRUE_LOG_LEVEL=warn
# Same as Supabase's own self-hosting config: email links go through the gateway.
export GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify
export GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify
(cd "$BIN_DIR/auth" && ./auth migrate) > "$STACK_DIR/logs/auth-migrate.log" 2>&1 \
  || { echo "auth migrate failed:"; tail -20 "$STACK_DIR/logs/auth-migrate.log"; exit 1; }

for f in supabase/migrations/*.sql; do "${PSQL[@]}" -o /dev/null "$STACK_ADMIN_URL" -f "$f"; done
[ -f supabase/seed.sql ] && "${PSQL[@]}" -o /dev/null "$STACK_ADMIN_URL" -f supabase/seed.sql

# --- services ------------------------------------------------------------------
start() { local name=$1; shift; (setsid "$@" > "$STACK_DIR/logs/$name.log" 2>&1 & echo $! > "$STACK_DIR/$name.pid"); }

OUTBOX_DIR="$STACK_DIR/outbox" SMTP_PORT=2500 start smtp node e2e/stack/smtp-sink.mjs

start auth bash -c "cd '$BIN_DIR/auth' && exec ./auth serve"

PGRST_DB_URI="$(db_url authenticator)" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=54330 \
  start postgrest "$BIN_DIR/postgrest"

JWT_SECRET="$JWT_SECRET" STORAGE_DIR="$STACK_DIR/storage" DATABASE_URL="$(db_url postgres)" \
  start gateway node e2e/stack/gateway.mjs

# --- wait until healthy ----------------------------------------------------------
for i in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://localhost:54321/auth/v1/health" -H "apikey: $PUBLISHABLE_KEY" \
     && curl -fsS -o /dev/null "http://localhost:54321/rest/v1/" -H "apikey: $PUBLISHABLE_KEY"; then
    echo "Local stack ready on http://localhost:54321 (outbox: $STACK_DIR/outbox)"
    exit 0
  fi
  sleep 0.5
done
echo "Stack failed to start. Logs:"; tail -n 15 "$STACK_DIR"/logs/*.log; exit 1
