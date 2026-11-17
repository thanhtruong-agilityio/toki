#!/usr/bin/env bash
# pnpm dev:reset:db - leave the development database with no table and no row.
#
# It drops and recreates only the development database, by name. The Postgres
# server, its volume and every other database (the test database among them)
# are left alone. It runs no migration.
#
# With --check it runs every check and stops before it changes anything.

set -u

# shellcheck source=scripts/dev/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=scripts/dev/guard.sh
. "$DEV_DIR/guard.sh"

guard_development "$ENV_FILE" || exit 1
database="$(guard_database_names)" || exit 1
require_docker || exit 1
require_service postgres || exit 1
[ "${1:-}" = "--check" ] && exit 0

# FORCE closes the sessions that are still connected to the database.
if ! printf '%s\n' \
  'DROP DATABASE IF EXISTS :"db" WITH (FORCE);' \
  'CREATE DATABASE :"db";' |
  in_postgres postgres -v "db=$database"; then
  fail "pnpm dev:reset:db failed: could not drop and recreate '$database'."
  exit 1
fi

say "The development database '$database' is empty."
