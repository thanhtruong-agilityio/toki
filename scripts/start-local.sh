#!/usr/bin/env bash
# pnpm start:local - start the whole development setup with one command:
# check the tools, get the .env when it is missing, start the services, apply
# the migrations, start the server and the web app, and print where to go.
#
# It never runs a reset script and never stops the services, so it cannot
# harm the data of another builder who uses the same Docker. It stays in the
# foreground; Ctrl+C stops the server and the web app and leaves the services
# up (`pnpm dev:down` stops them).

set -u
# No shell tracing: a trace would print the values this script handles.
set +x

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

WEB_PORT=5173
WAIT_SECONDS=90

is_port() {
  case "$1" in '' | *[!0-9]*) return 1 ;; esac
}

server_port() {
  local port
  if port="$(cfg SERVER_PORT)" && is_port "$port"; then printf '%s' "$port"; else printf '3000'; fi
}

mail_port() {
  local port
  if port="$(cfg MAILPIT_WEB_PORT)" && is_port "$port"; then printf '%s' "$port"; else printf '8025'; fi
}

print_addresses() {
  say "  Web app:      http://localhost:$WEB_PORT"
  say "  Mail catcher: http://localhost:$(mail_port)"
  say "Sign in with the email in FIRST_ADMIN_EMAIL (in .env). The sign-in code arrives in the mail catcher."
}

# 1. Every tool the run needs, checked in one pass and reported together.
problems=""
add_problem() { problems="$problems  - $1"$'\n'; }

node_major=""
if node_version="$(node --version 2>/dev/null)"; then
  node_major="${node_version#v}"
  node_major="${node_major%%.*}"
fi
if [ -z "$node_major" ]; then
  add_problem "Node is not installed. Install Node 22 (with nvm: \`nvm install\` in the repository root)."
elif [ "$node_major" != "22" ]; then
  add_problem "Node 22 is needed and this shell has Node ${node_version#v}. Switch to Node 22 (with nvm: \`nvm install\` in the repository root)."
fi

wanted_pnpm="$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"pnpm@\([^"]*\)".*/\1/p' "$REPO_ROOT/package.json" | head -n 1)"
if ! have_pnpm="$(pnpm --version 2>/dev/null)"; then
  add_problem "pnpm is not available. Run \`corepack enable\` (or put \`corepack\` in front of each pnpm command)."
elif [ -n "$wanted_pnpm" ] && [ "$have_pnpm" != "$wanted_pnpm" ]; then
  add_problem "pnpm $wanted_pnpm is needed and this shell has pnpm $have_pnpm. Run \`corepack enable\` under Node 22, or run this as \`corepack pnpm start:local\`."
fi

if ! command -v docker >/dev/null 2>&1; then
  add_problem "Docker is not installed. Install Docker."
elif ! docker info >/dev/null 2>&1; then
  add_problem "Docker is not running. Start Docker."
fi

for tool in lsof curl cksum ps; do
  command -v "$tool" >/dev/null 2>&1 || add_problem "The command $tool is not installed, and this script needs it."
done

if [ ! -e "$ENV_FILE" ]; then
  if ! command -v doppler >/dev/null 2>&1; then
    add_problem "There is no .env and Doppler is not installed. Install the Doppler CLI (brew install dopplerhq/cli/doppler) and run \`doppler login\`, or copy .env.example to .env and fill it."
  elif ! doppler me >/dev/null 2>&1; then
    add_problem "There is no .env and you are not logged in to Doppler. Run \`doppler login\`, or copy .env.example to .env and fill it."
  fi
fi

if [ -n "$problems" ]; then
  fail "pnpm start:local cannot start yet:"
  printf '%s' "$problems" >&2
  fail "Nothing was started."
  exit 1
fi

# 2. This worktree's own run may already be going, or still starting.
if own_pid="$(own_run_pid)" && [ "$own_pid" != "$$" ]; then
  all_own=1
  foreign=0
  for port in "$(server_port)" "$WEB_PORT"; do
    listeners="$(port_listeners "$port")"
    [ -n "$listeners" ] || all_own=0
    for pid in $listeners; do
      if ! is_own_listener "$pid"; then
        all_own=0
        foreign=1
      fi
    done
  done
  if [ "$all_own" -eq 1 ]; then
    say "Toki is already running from this worktree (process $own_pid)."
    print_addresses
    exit 0
  fi
  if [ "$foreign" -eq 0 ]; then
    fail "Toki is already starting from this worktree (process $own_pid). Wait for it to finish, or stop it with Ctrl+C in its terminal. Nothing was started."
    exit 1
  fi
fi

# 3. The .env: used as it is when it exists, pulled when it is missing.
if [ ! -e "$ENV_FILE" ]; then
  bash "$DEV_DIR/env-pull.sh" || exit 1
fi
if ! env_file_is_simple "$ENV_FILE"; then
  fail "Refused: .env has a multi-line value. Put every value on one line. Nothing was started."
  exit 1
fi
node_env_refusal "$ENV_FILE" || exit 1

# 4. The ports must be free, or held by this worktree's own run.
for port in "$(server_port)" "$WEB_PORT"; do
  for pid in $(port_listeners "$port"); do
    if ! is_own_listener "$pid"; then
      name="$(ps -o comm= -p "$pid" 2>/dev/null)"
      fail "Port $port is in use by ${name:-another process} (process $pid). Stop it and try again. It was left running and nothing was started."
      exit 1
    fi
  done
done

# 5. Claim the run, then the services, the migrations, the server and the web
# app. The run file is written before anything starts, so a second run of this
# worktree sees it; a run removes the file only when it holds its own id.
dev_pid=""
claimed=0
cleanup() {
  # A second Ctrl+C must not cut the cleanup short.
  trap '' INT TERM
  trap - EXIT
  if [ -n "$dev_pid" ]; then
    kill_tree "$dev_pid"
    wait "$dev_pid" 2>/dev/null
    say "Stopped the server and the web app. The services are still running; stop them with pnpm dev:down."
  fi
  if [ "$claimed" -eq 1 ] && [ "$(cat "$(run_file)" 2>/dev/null)" = "$$" ]; then
    rm -f "$(run_file)"
  fi
}
trap cleanup EXIT
# The first thing a signal does is to ignore the next ones, so a second Ctrl+C
# cannot cut the cleanup short.
trap 'trap "" INT TERM; exit 130' INT
trap 'trap "" INT TERM; exit 143' TERM

claim_run_file() {
  local file
  file="$(run_file)"
  mkdir -p "$(dirname "$file")"
  if [ -f "$file" ] && ! own_run_pid >/dev/null; then rm -f "$file"; fi
  ( set -o noclobber; printf '%s' "$$" > "$file" ) 2>/dev/null
}
if ! claim_run_file; then
  fail "Another pnpm start:local of this worktree started at the same moment. Wait for it, then try again. Nothing was started."
  exit 1
fi
claimed=1

if ! pnpm dev:up; then
  fail "pnpm start:local stopped at: pnpm dev:up."
  exit 1
fi
if ! pnpm --filter @toki/server db:migrate; then
  fail "pnpm start:local stopped at: the database migrations (pnpm --filter @toki/server db:migrate)."
  exit 1
fi

pnpm dev &
dev_pid=$!

# 6. Wait until the web app answers, then say where to go. Vite listens on one
# address, the one `localhost` resolves to (::1 or 127.0.0.1), so ask for
# `localhost`: curl tries both.
waited=0
until curl -fsS -o /dev/null "http://localhost:$WEB_PORT/healthz" 2>/dev/null; do
  if ! kill -0 "$dev_pid" 2>/dev/null; then
    fail "pnpm start:local stopped at: pnpm dev ended before the web app answered."
    exit 1
  fi
  if [ "$waited" -ge "$WAIT_SECONDS" ]; then
    fail "pnpm start:local stopped at: the web app did not answer within $WAIT_SECONDS seconds."
    exit 1
  fi
  sleep 1
  waited=$((waited + 1))
done

say "Toki is running."
print_addresses
say "Press Ctrl+C to stop the server and the web app. The services keep running; stop them with pnpm dev:down."
wait "$dev_pid"
