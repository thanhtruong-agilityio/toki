#!/usr/bin/env bash
# Shared helpers for the dev scripts. Source it; it does nothing on its own
# except move to the repository root.
#
# Written for the Bash 3.2 that macOS ships.

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DEV_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
COMPOSE_FILE="infra/docker-compose.dev.yml"
COMPOSE_PROJECT="toki-dev"
UP_HINT="Run \`pnpm dev:up\` first."

cd "$REPO_ROOT" || exit 1

say() { printf '%s\n' "$*"; }
fail() { printf '%s\n' "$*" >&2; }

# Compose, always from the repository root and always with the root .env.
compose() {
  docker compose --env-file .env -f "$COMPOSE_FILE" "$@"
}

# env_file_get FILE NAME
# Prints the value NAME has in an env file, without running the file.
# Returns 1 when the file does not set NAME (or does not exist).
# The last assignment wins. Handles an optional `export`, single or double
# quotes around the value, and a ` # comment` after an unquoted value.
env_file_get() {
  local file="$1" name="$2" line value found=1 result=""
  [ -f "$file" ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    # Trim leading whitespace, then an optional `export `.
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in
      export[[:space:]]*) line="${line#export}"; line="${line#"${line%%[![:space:]]*}"}" ;;
    esac
    case "$line" in
      "$name="*) value="${line#"$name="}" ;;
      *) continue ;;
    esac
    case "$value" in
      \"*)
        value="${value#\"}"
        value="${value%%\"*}"
        ;;
      \'*)
        value="${value#\'}"
        value="${value%%\'*}"
        ;;
      *)
        value="${value%%[[:space:]]#*}"
        value="${value%"${value##*[![:space:]]}"}"
        ;;
    esac
    result="$value"
    found=0
  done < "$file"
  [ "$found" -eq 0 ] || return 1
  printf '%s' "$result"
}

# cfg NAME
# The value the dev scripts use for NAME: the shell value when the variable
# is set, else the value in the root .env. Compose resolves names the same way.
# Returns 1 when neither sets it.
cfg() {
  local name="$1"
  if [ -n "${!name+x}" ]; then
    printf '%s' "${!name}"
    return 0
  fi
  env_file_get "$ENV_FILE" "$name"
}

# The root .env holds every value Compose needs; without it nothing can start.
require_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    fail "There is no .env in the repository root. Create it with the values the dev services need, then try again."
    return 1
  fi
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker is not installed. Install Docker, then try again."
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    fail "Docker is not running. Start Docker, then try again."
    return 1
  fi
}

# require_service NAME
# Passes only when service NAME of the toki-dev project is running.
require_service() {
  local service="$1" running
  if ! running="$(compose ps --status running --services 2>&1)"; then
    fail "$running"
    fail "Could not read the state of the $COMPOSE_PROJECT services. $UP_HINT"
    return 1
  fi
  if ! printf '%s\n' "$running" | grep -qx "$service"; then
    fail "The $service service of $COMPOSE_PROJECT is not running. $UP_HINT"
    return 1
  fi
}

# valid_bucket_name NAME
# An S3 bucket name: 3 to 63 characters, lowercase letters, digits, dots and
# hyphens, starting and ending with a letter or digit. An empty or odd name
# must never reach `mc`, where it could address every bucket.
valid_bucket_name() {
  printf '%s' "$1" | grep -Eq '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'
}

# require_bucket_name
# Prints the development bucket name, or explains why it cannot be used.
require_bucket_name() {
  local bucket
  if ! bucket="$(cfg MINIO_BUCKET)" || [ -z "$bucket" ]; then
    fail "MINIO_BUCKET is not set. Set it in .env."
    return 1
  fi
  if ! valid_bucket_name "$bucket"; then
    fail "MINIO_BUCKET is not a valid bucket name: 3 to 63 lowercase letters, digits, dots or hyphens."
    return 1
  fi
  printf '%s' "$bucket"
}

# in_minio SCRIPT [ARG...]
# Runs a shell script in the minio container, with `mc` pointed at the local
# server as the alias `local`. ARGs reach the script as $1, $2, ... The root
# user and password come from the container's own environment, so they never
# pass through this machine.
in_minio() {
  local script="$1"
  shift
  compose exec -T minio sh -c '
    mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null || exit 90
    '"$script" sh "$@"
}

# in_postgres DATABASE [PSQL-ARG...]
# Runs psql in the postgres container over the local socket, as the Postgres
# user of the container, reading SQL from standard input. Each statement
# commits on its own.
in_postgres() {
  compose exec -T postgres sh -c '
    database="$1"
    shift
    exec psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$database" "$@"
  ' sh "$@"
}

# in_mailpit SCRIPT
# Runs a shell script in the mailpit container.
in_mailpit() {
  compose exec -T mailpit sh -c "$1"
}
