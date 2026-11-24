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
  add_problem "pnpm $wanted_pnpm is needed and this shell has pnpm $have_pnpm. Run \`corepack enable\`, under Node 22."
fi

if ! command -v docker >/dev/null 2>&1; then
  add_problem "Docker is not installed. Install Docker."
elif ! docker info >/dev/null 2>&1; then
  add_problem "Docker is not running. Start Docker."
fi

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

# 2. This worktree's own run may already be going.
if own_pid="$(own_run_pid)"; then
  all_own=1
  for port in "$(server_port)" "$WEB_PORT"; do
    listeners="$(port_listeners "$port")"
    [ -n "$listeners" ] || all_own=0
    for pid in $listeners; do
      is_own_listener "$pid" || all_own=0
    done
  done
  if [ "$all_own" -eq 1 ]; then
    say "Toki is already running from this worktree (process $own_pid)."
    print_addresses
    exit 0
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

# 5. The services, the migrations, then the server and the web app.
if ! pnpm dev:up; then
  fail "pnpm start:local stopped at: pnpm dev:up."
  exit 1
fi
if ! pnpm --filter @toki/server db:migrate; then
  fail "pnpm start:local stopped at: the database migrations (pnpm --filter @toki/server db:migrate)."
  exit 1
fi

dev_pid=""
cleanup() {
  trap - EXIT INT TERM
  if [ -n "$dev_pid" ]; then
    kill_tree "$dev_pid"
    wait "$dev_pid" 2>/dev/null
  fi
  rm -f "$(run_file)"
  say "Stopped the server and the web app. The services are still running; stop them with pnpm dev:down."
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

pnpm dev &
dev_pid=$!
mkdir -p "$(dirname "$(run_file)")"
printf '%s' "$$" > "$(run_file)"

# 6. Wait until the web app answers, then say where to go.
waited=0
until curl -fsS -o /dev/null "http://127.0.0.1:$WEB_PORT/healthz" 2>/dev/null; do
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
