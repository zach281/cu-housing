#!/usr/bin/env bash
# Runs every migration, then the RLS test suite, against a throwaway database.
#
# Usage:
#   TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
#
# The target must be a plain PostgreSQL 15+ server you don't care about: this
# script DROPS and recreates a database called cu_housing_test on it.
# (With the Supabase CLI running, use `supabase db reset` and then
#  `psql "$(supabase status -o env | grep DB_URL ...)" -f supabase/tests/rls.test.sql`.)
set -euo pipefail

: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to an admin connection on a disposable Postgres server}"
cd "$(dirname "$0")/.."

DB=cu_housing_test
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" "$TEST_DATABASE_URL" -c "drop database if exists $DB" -c "create database $DB"
TARGET=$("${PSQL[@]}" "$TEST_DATABASE_URL" -Atc "select regexp_replace('$TEST_DATABASE_URL', '/[^/?]*(\?|$)', '/$DB\1')")

"${PSQL[@]}" "$TARGET" -f supabase/tests/supabase_stubs.sql
for f in supabase/migrations/*.sql; do
  echo "→ applying $(basename "$f")"
  "${PSQL[@]}" "$TARGET" -f "$f"
done

echo "→ running RLS tests"
"${PSQL[@]}" "$TARGET" -f supabase/tests/rls.test.sql
"${PSQL[@]}" "$TEST_DATABASE_URL" -c "drop database $DB"
