#!/usr/bin/env bash
# Smoke test for the dev reset scripts.
#
#   bash infra/dev/smoke.test.sh
#
# Part 1 checks the guard and the .env reader and needs no Docker.
# Part 2 needs the services up (`pnpm dev:up`). It WIPES the development data,
# like `pnpm dev:reset`: the development database, the development bucket and
# the Mailpit inbox. It writes fake marker data only and never writes `.env`.

set -u

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/dev/lib.sh
. "$DEV_DIR/lib.sh"
# shellcheck source=infra/dev/guard.sh
. "$DEV_DIR/guard.sh"

failures=0
checks=0

pass() { checks=$((checks + 1)); }
flunk() {
  checks=$((checks + 1))
  failures=$((failures + 1))
  printf 'FAIL: %s\n' "$*" >&2
}

# expect_equal WHAT EXPECTED ACTUAL
expect_equal() {
  if [ "$2" = "$3" ]; then pass; else flunk "$1: expected '$2', got '$3'"; fi
}

# ---------------------------------------------------------------- part 1 ---

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# --- env_file_get
cat > "$tmp/sample.env" <<'SAMPLE'
# a comment
PLAIN=one
  export EXPORTED=two
DOUBLE="three four"
SINGLE='five six'
COMMENTED=seven # trailing comment
EMPTY=
TWICE=first
TWICE=second
NODE_ENVX=wrong
SAMPLE

expect_equal "env_file_get plain" "one" "$(env_file_get "$tmp/sample.env" PLAIN)"
expect_equal "env_file_get export" "two" "$(env_file_get "$tmp/sample.env" EXPORTED)"
expect_equal "env_file_get double quotes" "three four" "$(env_file_get "$tmp/sample.env" DOUBLE)"
expect_equal "env_file_get single quotes" "five six" "$(env_file_get "$tmp/sample.env" SINGLE)"
expect_equal "env_file_get inline comment" "seven" "$(env_file_get "$tmp/sample.env" COMMENTED)"
expect_equal "env_file_get last one wins" "second" "$(env_file_get "$tmp/sample.env" TWICE)"
expect_equal "env_file_get empty value" "" "$(env_file_get "$tmp/sample.env" EMPTY)"
if env_file_get "$tmp/sample.env" EMPTY >/dev/null; then pass; else flunk "env_file_get: an empty value is still set"; fi
if env_file_get "$tmp/sample.env" MISSING >/dev/null; then flunk "env_file_get: a missing name must return 1"; else pass; fi
if env_file_get "$tmp/sample.env" NODE_ENV >/dev/null; then flunk "env_file_get: NODE_ENVX must not match NODE_ENV"; else pass; fi
if env_file_get "$tmp/absent.env" PLAIN >/dev/null; then flunk "env_file_get: a missing file must return 1"; else pass; fi

# --- guard_development (R10)
# guard_case WHAT EXPECTED(pass|refuse) SHELL_VALUE|-unset- FILE_LINE|-none-
guard_case() {
  local what="$1" expected="$2" shell_value="$3" file_line="$4" output status
  if [ "$file_line" = "-none-" ]; then
    : > "$tmp/guard.env"
  else
    printf '%s\n' "$file_line" > "$tmp/guard.env"
  fi
  if [ "$shell_value" = "-unset-" ]; then
    output="$(unset NODE_ENV; guard_development "$tmp/guard.env" 2>&1)"
    status=$?
  else
    output="$(NODE_ENV="$shell_value" guard_development "$tmp/guard.env" 2>&1)"
    status=$?
  fi
  if [ "$expected" = "pass" ]; then
    if [ "$status" -eq 0 ]; then pass; else flunk "guard: $what must pass, got: $output"; fi
  else
    if [ "$status" -eq 0 ]; then
      flunk "guard: $what must refuse"
    elif printf '%s' "$output" | grep -q 'NODE_ENV'; then
      pass
    else
      flunk "guard: $what refused without naming NODE_ENV: $output"
    fi
  fi
}

guard_case "development in .env only" pass -unset- "NODE_ENV=development"
guard_case "development in the shell only" pass development -none-
guard_case "development in both" pass development "NODE_ENV=development"
guard_case "production in .env" refuse -unset- "NODE_ENV=production"
guard_case "unknown value in .env" refuse -unset- "NODE_ENV=staging"
guard_case "not set anywhere" refuse -unset- -none-
guard_case "development in .env, production in the shell" refuse production "NODE_ENV=development"
guard_case "production in .env, development in the shell" refuse development "NODE_ENV=production"
guard_case "not in .env, production in the shell" refuse production -none-
guard_case "empty in .env" refuse -unset- "NODE_ENV="
guard_case "empty in the shell, development in .env" refuse "" "NODE_ENV=development"
guard_case "wrong case" refuse -unset- "NODE_ENV=Development"
guard_case "development with a suffix" refuse -unset- "NODE_ENV=development2"

# A missing .env file sets nothing: only the shell counts.
if (unset NODE_ENV; guard_development "$tmp/absent.env" >/dev/null 2>&1); then
  flunk "guard: no file and no shell value must refuse"
else
  pass
fi

# --- guard_database_names (R24)
# names_case WHAT EXPECTED DEV TEST|-unset- [MUST_NAME]
names_case() {
  local what="$1" expected="$2" dev="$3" test_name="$4" must_name="${5:-}" output status
  if [ "$test_name" = "-unset-" ]; then
    output="$(check_database_names "$dev" 2>&1)"
    status=$?
  else
    output="$(check_database_names "$dev" "$test_name" 2>&1)"
    status=$?
  fi
  if [ "$expected" = "pass" ]; then
    if [ "$status" -eq 0 ]; then pass; else flunk "names: $what must pass, got: $output"; fi
  elif [ "$status" -eq 0 ]; then
    flunk "names: $what must refuse"
  elif [ -n "$must_name" ] && ! printf '%s' "$output" | grep -q "$must_name"; then
    flunk "names: $what refused without naming $must_name: $output"
  else
    pass
  fi
}

names_case "two different names" pass toki_dev toki_test
names_case "development equals test" refuse toki_test toki_test
names_case "postgres" refuse postgres toki_test
names_case "template0" refuse template0 toki_test
names_case "template1" refuse template1 toki_test
names_case "test name not set" refuse toki_dev -unset- POSTGRES_TEST_DB
names_case "test name empty" refuse toki_dev "" POSTGRES_TEST_DB
names_case "development name empty" refuse "" toki_test POSTGRES_DB

# --- valid_bucket_name
for name in toki-dev abc a.b-c; do
  if valid_bucket_name "$name"; then pass; else flunk "bucket name '$name' must be valid"; fi
done
for name in "" ab "a b" "Toki" "-abc" "abc-" "a/b" "*"; do
  if valid_bucket_name "$name"; then flunk "bucket name '$name' must be refused"; else pass; fi
done

if [ "$failures" -ne 0 ]; then
  printf 'smoke test: %d of %d checks failed (part 1, no Docker needed)\n' "$failures" "$checks" >&2
  exit 1
fi
printf 'part 1 ok: %d checks (guard and .env reader)\n' "$checks"

# ---------------------------------------------------------------- part 2 ---
# From here on the test talks to the running services and wipes their data.

stop() {
  printf 'smoke test cannot run: %s\n' "$*" >&2
  exit 2
}

require_docker || stop "Docker is needed for part 2."
for service in postgres minio mailpit; do
  require_service "$service" || stop "the $service service is not up."
done
guard_development "$ENV_FILE" || stop "the environment is not development."
database="$(guard_database_names)" || stop "the database names are not usable."
bucket="$(require_bucket_name)" || stop "the bucket name is not usable."

# A second database stands in for the test database (TOKI-008 creates the real
# one). No reset may touch it.
other_database="toki_smoke_other"
[ "$database" != "$other_database" ] || stop "POSTGRES_DB must not be '$other_database'."

env_checksum() { cksum < "$ENV_FILE"; }
checksum_before="$(env_checksum)"

# Each probe prints a number, or stops the test: an error is never read as
# "empty".
number_or_stop() {
  case "$2" in
    '' | *[!0-9]*) stop "could not read $1 (got '$2')." ;;
  esac
  printf '%s' "$2"
}

sql() { # sql DATABASE STATEMENT
  printf '%s\n' "$2" | in_postgres "$1" -At
}

table_count() { # tables in a database, outside the system schemas
  number_or_stop "the tables of $1" "$(sql "$1" "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema');")"
}

object_count() {
  number_or_stop "the objects of $bucket" "$(in_minio '
    listing="$(mc ls --recursive "local/$1")" || exit 1
    printf "%s\n" "$listing" | sed "/^\$/d" | wc -l | tr -d " "
  ' "$bucket")"
}

bucket_exists() {
  in_minio 'mc stat "local/$1" >/dev/null 2>&1' "$bucket"
}

mail_count() {
  number_or_stop "the Mailpit inbox" "$(in_mailpit 'wget -q -O - "http://127.0.0.1:8025/api/v1/messages?limit=1"' |
    sed -n 's/.*"total":\([0-9][0-9]*\).*/\1/p')"
}

seed_database() { # seed_database DATABASE
  sql "$1" "CREATE TABLE IF NOT EXISTS toki_smoke_marker (note text); INSERT INTO toki_smoke_marker VALUES ('marker');" ||
    stop "could not write the marker row to $1."
}

seed_file() {
  in_minio 'printf "toki smoke marker\n" | mc pipe "local/$1/toki-smoke-marker.txt" >/dev/null' "$bucket" ||
    stop "could not write the marker file."
}

seed_mail() {
  in_mailpit '
    printf "From: smoke@example.test\r\nTo: marker@example.test\r\nSubject: toki smoke marker\r\n\r\nmarker\r\n" |
      /mailpit sendmail -S 127.0.0.1:1025 marker@example.test
  ' || stop "could not send the marker mail."
}

drop_other_database() {
  sql postgres "DROP DATABASE IF EXISTS $other_database WITH (FORCE);" >/dev/null 2>&1
}
trap 'drop_other_database; rm -rf "$tmp"' EXIT

# expect_stores WHAT TABLES OBJECTS MAILS
# The second database must hold its marker table at every point.
expect_stores() {
  expect_equal "$1: tables in $database" "$2" "$(table_count "$database")"
  expect_equal "$1: objects in $bucket" "$3" "$(object_count)"
  expect_equal "$1: mails in the inbox" "$4" "$(mail_count)"
  expect_equal "$1: tables in $other_database" "1" "$(table_count "$other_database")"
}

run_script() { # run_script NAME -> sets $output and $status
  output="$(bash "$DEV_DIR/$1.sh" < /dev/null 2>&1)"
  status=$?
}

# --- a clean start, then one marker in each store
run_script reset
expect_equal "reset before the test: exit status ($output)" "0" "$status"
drop_other_database
sql postgres "CREATE DATABASE $other_database;" || stop "could not create $other_database."
seed_database "$other_database"
seed_database "$database"
seed_file
seed_mail
expect_stores "after seeding" 1 1 1

# --- the guard refuses and changes nothing (R10)
for script in reset-db reset-files reset-mail reset; do
  for value in production staging; do
    output="$(NODE_ENV="$value" bash "$DEV_DIR/$script.sh" < /dev/null 2>&1)"
    status=$?
    if [ "$status" -eq 0 ]; then
      flunk "$script with NODE_ENV=$value must refuse, it exited 0"
    elif ! printf '%s' "$output" | grep -q 'Refused: NODE_ENV'; then
      flunk "$script with NODE_ENV=$value failed, but not with the guard's refusal: $output"
    else
      pass
    fi
    expect_stores "$script with NODE_ENV=$value" 1 1 1
  done
done

# --- each reset empties its own store only (R5, R6, R7)
run_script reset-db
expect_equal "reset-db: exit status ($output)" "0" "$status"
expect_stores "after reset-db" 0 1 1
seed_database "$database"

run_script reset-files
expect_equal "reset-files: exit status ($output)" "0" "$status"
if bucket_exists; then pass; else flunk "reset-files must keep the bucket"; fi
expect_stores "after reset-files" 1 0 1
seed_file

run_script reset-mail
expect_equal "reset-mail: exit status ($output)" "0" "$status"
expect_stores "after reset-mail" 1 1 0
seed_mail

# --- dev:reset does all three (R8) and leaves a clean state
run_script reset
expect_equal "reset: exit status ($output)" "0" "$status"
if bucket_exists; then pass; else flunk "reset must keep the bucket"; fi
expect_stores "after reset" 0 0 0

# --- no reset wrote .env (R11)
expect_equal ".env checksum" "$checksum_before" "$(env_checksum)"

if [ "$failures" -ne 0 ]; then
  printf 'smoke test: %d of %d checks failed\n' "$failures" "$checks" >&2
  exit 1
fi
printf 'smoke test ok: %d checks\n' "$checks"
