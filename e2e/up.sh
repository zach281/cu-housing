#!/usr/bin/env bash
# One command to (re)start everything the end-to-end tests need on this
# machine: a throwaway Postgres cluster, the local Supabase-like stack, and a
# production build of the app on :3100. Safe to re-run after a reboot.
set -euo pipefail
cd "$(dirname "$0")/.."

PGDATA_DIR="${PGDATA_DIR:-/var/tmp/pgtest}"
PG_PORT="${PG_PORT:-54329}"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"

# Postgres (run as the postgres OS user when we're root)
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
if ! pg_isready -q -h 127.0.0.1 -p "$PG_PORT"; then
  if [ ! -d "$PGDATA_DIR/data" ]; then
    mkdir -p "$PGDATA_DIR"; [ "$(id -u)" = 0 ] && chown postgres "$PGDATA_DIR"
    as_pg "$PGBIN/initdb -D $PGDATA_DIR/data -A trust -U postgres >/dev/null"
  fi
  as_pg "$PGBIN/pg_ctl -D $PGDATA_DIR/data -o '-p $PG_PORT -k $PGDATA_DIR -c listen_addresses=127.0.0.1' -l $PGDATA_DIR/log start >/dev/null"
  for _ in $(seq 1 20); do pg_isready -q -h 127.0.0.1 -p "$PG_PORT" && break; sleep 0.5; done
fi

ADMIN_DATABASE_URL="postgres://postgres@127.0.0.1:$PG_PORT/postgres?sslmode=disable" bash e2e/stack/start.sh

# App, built against the local stack
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_test_key
fuser -k 3100/tcp >/dev/null 2>&1 || true
npm run build >/var/tmp/next-build.log 2>&1 || { tail -30 /var/tmp/next-build.log; exit 1; }
(setsid npx next start -p 3100 >/var/tmp/next.log 2>&1 &)
for _ in $(seq 1 40); do curl -fsS -o /dev/null http://localhost:3100/ && break; sleep 0.5; done
echo "App ready on http://localhost:3100"
