#!/usr/bin/env bash
# pnpm env:pull - write the root .env from the shared development values in
# the Doppler project `toki`, config `dev`.
#
# The file is written only when every check passed, so a failed pull never
# leaves a half-written or empty .env. No value is printed, logged or put on a
# command line; a difference is reported by variable name only.

set -u
# No shell tracing: a trace would print the values this script handles.
set +x

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DOPPLER_PROJECT="toki"
DOPPLER_CONFIG="dev"

# The names the server and the services cannot start without: the rows of
# docs/environment-config.md whose Required column says `yes`. The test
# scripts/local-run.test.sh fails when this list and that table differ.
REQUIRED_NAMES="NODE_ENV DATABASE_URL TEST_DATABASE_URL POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB POSTGRES_TEST_DB MINIO_ROOT_USER MINIO_ROOT_PASSWORD MINIO_BUCKET MINIO_CONSOLE_PORT SMTP_HOST SMTP_PORT MAIL_FROM_ADDRESS MAILPIT_SMTP_PORT MAILPIT_WEB_PORT FIRST_ADMIN_EMAIL WORKSPACE_NAME APP_DOMAIN AUTH_CODE_SECRET APP_ORIGIN"

tmp=""
errors=""
cleanup() {
  [ -n "$tmp" ] && rm -f "$tmp"
  [ -n "$errors" ] && rm -f "$errors"
}
# The temporary files go away on every exit path, an interrupt included.
trap cleanup EXIT
trap 'trap "" INT TERM; exit 130' INT
trap 'trap "" INT TERM; exit 143' TERM

# 1. The environment name, in the shell and in an existing .env.
if ! env_file_is_simple "$ENV_FILE"; then
  fail "Refused: .env has a multi-line value. Put every value on one line. Nothing was changed."
  exit 1
fi
node_env_refusal "$ENV_FILE" || exit 1

# 2. Doppler is installed and logged in.
if ! command -v doppler >/dev/null 2>&1; then
  fail "Doppler is not installed. Install the Doppler CLI (brew install dopplerhq/cli/doppler), then try again. .env was not changed."
  exit 1
fi
if ! doppler me >/dev/null 2>&1; then
  fail "You are not logged in to Doppler. Run \`doppler login\`, then try again. .env was not changed."
  exit 1
fi

# 3. Pull into a temporary file next to .env, readable by its owner only.
umask 077
tmp="$(mktemp "$REPO_ROOT/.env.pull.XXXXXX")" || {
  fail "Could not create a temporary file in the repository root. .env was not changed."
  exit 1
}
errors="$(mktemp)" || exit 1
if ! doppler secrets download -p "$DOPPLER_PROJECT" -c "$DOPPLER_CONFIG" --no-file --format env > "$tmp" 2> "$errors"; then
  # Pick a sentence from the kind of failure. The text Doppler printed is
  # never shown, so nothing from the project can reach the screen.
  reason="$(tr '[:upper:]' '[:lower:]' < "$errors")"
  case "$reason" in
    *"no such host"* | *"dial tcp"* | *timeout* | *"network"* | *"connection"*)
      fail "Could not reach Doppler. Check your network connection, then try again. .env was not changed."
      ;;
    *"could not find"* | *"not found"* | *"does not exist"*)
      fail "Doppler could not find the project $DOPPLER_PROJECT or its config $DOPPLER_CONFIG. Check them on the Doppler site. .env was not changed."
      ;;
    *forbidden* | *"do not have access"* | *"not authorized"* | *unauthorized* | *permission*)
      fail "You do not have access to the Doppler project $DOPPLER_PROJECT. Ask for an invitation, then run \`doppler login\` again. .env was not changed."
      ;;
    *)
      fail "Doppler failed for a reason this script does not know. Run \`doppler secrets -p $DOPPLER_PROJECT -c $DOPPLER_CONFIG\` to see it. .env was not changed."
      ;;
  esac
  exit 1
fi

# 4. Check the temporary file before it can replace anything.
if [ ! -s "$tmp" ]; then
  fail "Doppler returned no values for $DOPPLER_PROJECT/$DOPPLER_CONFIG. .env was not changed."
  exit 1
fi
if ! env_file_is_simple "$tmp"; then
  fail "A value in the Doppler config $DOPPLER_PROJECT/$DOPPLER_CONFIG runs over several lines. Put every value on one line in Doppler. .env was not changed."
  exit 1
fi
missing=""
for name in $REQUIRED_NAMES; do
  if ! value="$(env_file_get "$tmp" "$name")" || [ -z "$value" ]; then
    missing="$missing $name"
  fi
done
if [ -n "$missing" ]; then
  fail "The Doppler config $DOPPLER_PROJECT/$DOPPLER_CONFIG is missing a value for:$missing. Add them on the Doppler site, then try again. .env was not changed."
  exit 1
fi
node_env_refusal "$tmp" ".env from Doppler" || exit 1

# names_of FILE: the variable names a file sets, one per line.
names_of() {
  sed -n 's/^[[:space:]]*\(export[[:space:]][[:space:]]*\)\{0,1\}\([A-Za-z_][A-Za-z0-9_]*\)[[:space:]]*[=:].*/\2/p' "$1"
}
# state_of FILE NAME: `U` when unset, else `S` and the value.
state_of() {
  local value
  if value="$(env_file_get "$1" "$2")"; then printf 'S%s' "$value"; else printf 'U'; fi
}

# 5. An existing .env: compare, then ask once when the two differ.
if [ -e "$ENV_FILE" ]; then
  differing=""
  for name in $( { names_of "$ENV_FILE"; names_of "$tmp"; } | sort -u); do
    if [ "$(state_of "$ENV_FILE" "$name")" != "$(state_of "$tmp" "$name")" ]; then
      differing="$differing $name"
    fi
  done
  if [ -z "$differing" ]; then
    say "Your .env already has the same values as Doppler. Nothing was changed."
    exit 0
  fi
  say "Your .env differs from Doppler in:$differing"
  # TOKI_ASSUME_TTY=1 is for scripts/local-run.test.sh only: it lets standard
  # input stand in for a terminal. Do not set it anywhere else.
  if [ ! -t 0 ] && [ "${TOKI_ASSUME_TTY:-}" != "1" ]; then
    fail "There is no terminal to ask in, so .env was kept. Run this command in a terminal to replace it."
    exit 1
  fi
  printf 'Replace .env with the values from Doppler? [y/N] '
  answer=""
  read -r answer
  case "$answer" in
    y | Y | yes | YES) ;;
    *)
      say "Kept your .env."
      exit 0
      ;;
  esac
fi

# 6. Replace .env last. mv replaces a link itself, not the file it points to.
mv -f "$tmp" "$ENV_FILE" || {
  fail "Could not replace .env."
  exit 1
}
tmp=""
chmod 600 "$ENV_FILE"
say "Wrote .env from Doppler ($DOPPLER_PROJECT/$DOPPLER_CONFIG)."
