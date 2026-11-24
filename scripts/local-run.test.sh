#!/usr/bin/env bash
# Test for `pnpm env:pull` and `pnpm start:local` (TOKI-106).
#
#   bash scripts/local-run.test.sh
#
# Every case runs in a temporary copy of the scripts, with fake doppler,
# docker, node, pnpm, curl and lsof first on PATH. It never touches the real
# Docker, the real .env or the network, and it uses invented values only.
# Like scripts/smoke.test.sh it is not part of `pnpm test`.
#
# `start:local` is stopped with SIGTERM here: a background process of a
# non-interactive shell ignores SIGINT, and the script handles both the same.

set -u

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASEPATH="/usr/bin:/bin:/usr/sbin:/sbin"
MARK="SECRETVALUE"

failures=0
checks=0
case_no=0

pass() { checks=$((checks + 1)); }
flunk() {
  checks=$((checks + 1))
  failures=$((failures + 1))
  printf 'FAIL: %s\n' "$*" >&2
}
expect_equal() { if [ "$2" = "$3" ]; then pass; else flunk "$1: expected '$2', got '$3'"; fi; }
expect_rc() { expect_equal "$1 (exit code)" "$2" "$rc"; }
expect_rc_nonzero() { if [ "$rc" -ne 0 ]; then pass; else flunk "$1: expected a non-zero exit code"; fi; }
expect_out() { if grep -qiF -- "$2" "$C/out"; then pass; else flunk "$1: output has no '$2'"; fi; }
expect_no_out() { if grep -qiF -- "$2" "$C/out"; then flunk "$1: output has '$2'"; else pass; fi; }
expect_call() { if grep -qF -- "$2" "$C/calls.log" 2>/dev/null; then pass; else flunk "$1: no call '$2'"; fi; }
expect_no_call() { if grep -qF -- "$2" "$C/calls.log" 2>/dev/null; then flunk "$1: unexpected call '$2'"; else pass; fi; }
expect_no_line() { if grep -qxF -- "$2" "$C/calls.log" 2>/dev/null; then flunk "$1: unexpected call '$2'"; else pass; fi; }
expect_same_file() { if cmp -s "$2" "$3"; then pass; else flunk "$1: files differ"; fi; }

T="$(mktemp -d)"
strays="$T/strays"
: > "$strays"
cleanup() {
  while read -r p; do [ -n "$p" ] && kill "$p" 2>/dev/null; done < "$strays"
  rm -rf "$T"
}
trap cleanup EXIT

# ------------------------------------------------------------ the fakes ---

mkdir -p "$T/fakes"

cat > "$T/fakes/doppler" <<'FAKE'
#!/bin/sh
echo "doppler $*" >> "$FAKE_DIR/calls.log"
case "$1" in
  me)
    [ "${FAKE_DOPPLER_LOGIN:-yes}" = yes ] && exit 0
    echo "Doppler Error: you must provide a token" >&2
    exit 1
    ;;
  secrets)
    case "${FAKE_DOPPLER_MODE:-ok}" in
      ok) cat "$FAKE_DIR/doppler.out" ;;
      slow) sleep 3; cat "$FAKE_DIR/doppler.out" ;;
      empty) exit 0 ;;
      network) echo "dial tcp: lookup api.doppler.com: no such host" >&2; exit 1 ;;
      access) echo "Doppler Error: forbidden: you do not have access to this project" >&2; exit 1 ;;
      config) echo "Doppler Error: Could not find requested config" >&2; exit 1 ;;
      other) echo "Doppler Error: something odd" >&2; exit 1 ;;
    esac
    ;;
esac
exit 0
FAKE

cat > "$T/fakes/docker" <<'FAKE'
#!/bin/sh
echo "docker $*" >> "$FAKE_DIR/calls.log"
[ "$1" = info ] && [ "${FAKE_DOCKER:-up}" = down ] && exit 1
exit 0
FAKE

cat > "$T/fakes/node" <<'FAKE'
#!/bin/sh
[ "$1" = "--version" ] && { echo "${FAKE_NODE_VERSION:-v22.23.5}"; exit 0; }
exit 0
FAKE

cat > "$T/fakes/pnpm" <<'FAKE'
#!/bin/sh
case "$1" in
  --version) echo "${FAKE_PNPM_VERSION:-12.21.0}"; exit 0 ;;
  dev:up) echo "pnpm dev:up" >> "$FAKE_DIR/calls.log"; exit "${FAKE_DEVUP_EXIT:-0}" ;;
  dev:down) echo "pnpm dev:down" >> "$FAKE_DIR/calls.log"; exit 0 ;;
  --filter) echo "pnpm migrate" >> "$FAKE_DIR/calls.log"; exit "${FAKE_MIGRATE_EXIT:-0}" ;;
  dev)
    echo "pnpm dev" >> "$FAKE_DIR/calls.log"
    : > "$FAKE_DIR/dev.started"
    sh -c 'sleep 300; :' &
    child=$!
    sleep 1
    echo "$$ $child $(pgrep -P "$child")" > "$FAKE_DIR/dev.pids"
    wait
    ;;
  *) echo "pnpm $*" >> "$FAKE_DIR/calls.log" ;;
esac
exit 0
FAKE

cat > "$T/fakes/curl" <<'FAKE'
#!/bin/sh
[ -e "$FAKE_DIR/dev.started" ] && exit 0
exit 22
FAKE

cat > "$T/fakes/lsof" <<'FAKE'
#!/bin/sh
for a in "$@"; do
  case "$a" in
    -iTCP:*) port="${a#-iTCP:}" ;;
  esac
done
[ -f "$FAKE_DIR/ports/$port" ] && cat "$FAKE_DIR/ports/$port"
exit 0
FAKE
chmod +x "$T"/fakes/*

# ---------------------------------------------------------------- cases ---

# The required names according to the inventory (a table meant for people).
inventory_required() {
  awk -F'|' '/^\| `[A-Z_]+` /{n=$2; gsub(/[` ]/,"",n); r=$5; gsub(/ /,"",r); if (r=="yes") print n}' \
    "$SRC/docs/environment-config.md"
}

new_case() {
  case_no=$((case_no + 1))
  C="$T/c$case_no"
  mkdir -p "$C/scripts" "$C/bin" "$C/home" "$C/state" "$C/ports" "$C/docs"
  cp "$SRC"/scripts/*.sh "$C/scripts/"
  cp "$SRC/.env.example" "$C/.env.example"
  printf '{\n  "packageManager": "pnpm@12.21.0"\n}\n' > "$C/package.json"
  for f in "$T"/fakes/*; do ln -s "$f" "$C/bin/$(basename "$f")"; done
  : > "$C/calls.log"
  # What the fake doppler returns: every required name with an invented value.
  {
    inventory_required | while read -r name; do
      case "$name" in
        NODE_ENV) echo "NODE_ENV=development" ;;
        MAILPIT_WEB_PORT) echo "MAILPIT_WEB_PORT=8025" ;;
        *_PORT) echo "$name=1025" ;;
        *) echo "$name=${MARK}_$name" ;;
      esac
    done
    echo "SERVER_PORT=3000"
  } > "$C/doppler.out"
}

# A plain .env for the start:local cases.
write_env() {
  cp "$C/doppler.out" "$C/.env"
  chmod 600 "$C/.env"
}

# run "VAR=value ..." script [arg...]   (stdin from $STDIN, else empty)
run() {
  local extra="$1" script="$2"
  shift 2
  # shellcheck disable=SC2086
  ( cd "$C" && env -u NODE_ENV $extra PATH="$C/bin:${CASE_BASE:-$BASEPATH}" HOME="$C/home" XDG_STATE_HOME="$C/state" \
      FAKE_DIR="$C" bash "scripts/$script" "$@" ) < "${STDIN:-/dev/null}" > "$C/out" 2>&1
  rc=$?
}

start_bg() {
  local extra="$1" script="$2"
  # shellcheck disable=SC2086
  ( cd "$C" && exec env -u NODE_ENV $extra PATH="$C/bin:${CASE_BASE:-$BASEPATH}" HOME="$C/home" XDG_STATE_HOME="$C/state" \
      FAKE_DIR="$C" bash "scripts/$script" ) < /dev/null > "$C/out" 2>&1 &
  bgpid=$!
}

wait_text() { # file text seconds
  local i=0
  while [ "$i" -lt "$3" ]; do
    grep -qF -- "$2" "$1" 2>/dev/null && return 0
    sleep 1
    i=$((i + 1))
  done
  return 1
}

stop_bg() {
  kill -TERM "$bgpid" 2>/dev/null
  wait "$bgpid" 2>/dev/null
  rc=$?
}

expect_no_temp() { if ls "$C"/.env.pull.* >/dev/null 2>&1; then flunk "$1: a temporary .env.pull file is left"; else pass; fi; }
# An own run: a process whose command line names start-local, with a child
# that can hold a port. Sets own_pid (the process) and own_child (its child).
own_proc() {
  bash -c 'sleep 300 & wait' start-local-test &
  own_pid=$!
  echo "$own_pid" >> "$strays"
  sleep 0.5
  own_child="$(pgrep -P "$own_pid" | head -n 1)"
  [ -n "$own_child" ] && echo "$own_child" >> "$strays"
}
# The run file of the case's worktree, or of another path.
case_run_file() {
  ( cd "$C" && env HOME="$C/home" XDG_STATE_HOME="$C/state" bash -c '. scripts/lib.sh; run_file' )
}
file_mode() { stat -f '%Lp' "$1" 2>/dev/null || stat -c '%a' "$1"; }
alive() { kill -0 "$1" 2>/dev/null; }
stray() { sleep 300 & echo $! >> "$strays"; stray_pid=$!; }

# ------------------------------------------------------------- env:pull ---

# R1: the file holds what Doppler returned.
new_case
run "" env-pull.sh
expect_rc "R1 pull" 0
expect_same_file "R1 .env equals the pulled values" "$C/.env" "$C/doppler.out"
expect_call "R1 the call names the project and config" "-p toki -c dev"
# R4: only the owner reads it.
expect_equal "R4 mode" "600" "$(file_mode "$C/.env")"
expect_no_out "R16 pull output" "$MARK"

# R2: a failed pull leaves an existing .env as it was.
for mode in network access config other empty; do
  new_case
  echo "OLD=keep" > "$C/.env"
  cp "$C/.env" "$C/.env.before"
  run "FAKE_DOPPLER_MODE=$mode" env-pull.sh
  expect_rc_nonzero "R2 mode $mode"
  expect_same_file "R2 mode $mode leaves .env" "$C/.env" "$C/.env.before"
  expect_no_temp "R2 mode $mode"
  expect_no_out "R16 mode $mode" "$MARK"
done

# R2/R17: a pulled file that says production is never written.
new_case
echo "OLD=keep" > "$C/.env"
cp "$C/.env" "$C/.env.before"
sed 's/^NODE_ENV=.*/NODE_ENV=production/' "$C/doppler.out" > "$C/doppler.tmp" && mv "$C/doppler.tmp" "$C/doppler.out"
run "" env-pull.sh
expect_rc_nonzero "R17 pulled production"
expect_same_file "R17 pulled production leaves .env" "$C/.env" "$C/.env.before"
expect_out "R17 pulled production" "not 'development'"

# R3: a broken link and a link to a file are replaced by a regular file.
new_case
ln -s "$C/missing-target" "$C/.env"
run "" env-pull.sh
expect_rc "R3 broken link" 0
if [ -L "$C/.env" ] || [ ! -s "$C/.env" ]; then flunk "R3 broken link: not a regular non-empty file"; else pass; fi
new_case
echo "OLD=value" > "$C/target.env"
ln -s "$C/target.env" "$C/.env"
STDIN="$C/answer"
echo y > "$C/answer"
run "TOKI_ASSUME_TTY=1" env-pull.sh
STDIN=""
expect_rc "R3 link to a file" 0
if [ -L "$C/.env" ]; then flunk "R3 link to a file: still a link"; else pass; fi
expect_same_file "R3 link to a file: new content" "$C/.env" "$C/doppler.out"
expect_equal "R3 link to a file: target untouched" "OLD=value" "$(cat "$C/target.env")"

# R5: an existing .env that differs.
new_case
sed 's/^WORKSPACE_NAME=.*/WORKSPACE_NAME=OLDVALUE_workspace/' "$C/doppler.out" > "$C/.env"
cp "$C/.env" "$C/.env.before"
STDIN="$C/answer"; echo y > "$C/answer"
run "TOKI_ASSUME_TTY=1" env-pull.sh
expect_rc "R5 yes" 0
expect_same_file "R5 yes replaces" "$C/.env" "$C/doppler.out"
expect_out "R5 names the differing variable" "WORKSPACE_NAME"
expect_no_out "R5 prints no new value" "$MARK"
expect_no_out "R5 prints no old value" "OLDVALUE"
new_case
sed 's/^WORKSPACE_NAME=.*/WORKSPACE_NAME=OLDVALUE_workspace/' "$C/doppler.out" > "$C/.env"
cp "$C/.env" "$C/.env.before"
STDIN="$C/answer"; echo n > "$C/answer"
run "TOKI_ASSUME_TTY=1" env-pull.sh
expect_rc "R5 no" 0
expect_same_file "R5 no keeps" "$C/.env" "$C/.env.before"
expect_no_temp "R5 no"
STDIN="$C/answer"; echo "maybe" > "$C/answer"
run "TOKI_ASSUME_TTY=1" env-pull.sh
expect_rc "R5 any other answer" 0
expect_same_file "R5 any other answer keeps" "$C/.env" "$C/.env.before"
STDIN=""
run "" env-pull.sh
expect_rc "R5 no terminal" 1
expect_same_file "R5 no terminal keeps" "$C/.env" "$C/.env.before"
expect_out "R5 no terminal says why" "terminal"
expect_no_out "R5 no terminal prints no value" "OLDVALUE"
new_case
cp "$C/doppler.out" "$C/.env"
cp "$C/.env" "$C/.env.before"
run "" env-pull.sh
expect_rc "R5 same values" 0
expect_same_file "R5 same values keep" "$C/.env" "$C/.env.before"
expect_out "R5 same values say so" "same"

# R6: a missing or empty required name stops the pull and is named.
new_case
grep -v '^AUTH_CODE_SECRET=' "$C/doppler.out" > "$C/doppler.tmp" && mv "$C/doppler.tmp" "$C/doppler.out"
sed 's/^DATABASE_URL=.*/DATABASE_URL=/' "$C/doppler.out" > "$C/doppler.tmp" && mv "$C/doppler.tmp" "$C/doppler.out"
echo "OLD=keep" > "$C/.env"
cp "$C/.env" "$C/.env.before"
run "" env-pull.sh
expect_rc_nonzero "R6 missing names"
expect_out "R6 names the missing one" "AUTH_CODE_SECRET"
expect_out "R6 names the empty one" "DATABASE_URL"
expect_no_out "R6 prints no value" "$MARK"
expect_same_file "R6 leaves .env" "$C/.env" "$C/.env.before"
# R6: the list in the script is the Required column of the inventory.
list="$(sed -n 's/^REQUIRED_NAMES="\(.*\)"$/\1/p' "$SRC/scripts/env-pull.sh" | tr ' ' '\n' | sed '/^$/d' | sort)"
expect_equal "R6 the list equals the inventory" "$(inventory_required | sort)" "$list"
for name in $list; do
  if grep -q "^$name=" "$SRC/.env.example"; then pass; else flunk "R6 $name is not in .env.example"; fi
done

# R7: one sentence for each way the pull cannot work. .env stays as it is.
new_case
rm "$C/bin/doppler"
echo "OLD=keep" > "$C/.env"; cp "$C/.env" "$C/.env.before"
run "" env-pull.sh
expect_rc_nonzero "R7 no doppler"; expect_out "R7 no doppler" "install"
expect_same_file "R7 no doppler leaves .env" "$C/.env" "$C/.env.before"
new_case
run "FAKE_DOPPLER_LOGIN=no" env-pull.sh
expect_rc_nonzero "R7 not logged in"; expect_out "R7 not logged in" "doppler login"
new_case
run "FAKE_DOPPLER_MODE=access" env-pull.sh
expect_rc_nonzero "R7 no access"; expect_out "R7 no access" "access"
new_case
run "FAKE_DOPPLER_MODE=config" env-pull.sh
expect_rc_nonzero "R7 no config"; expect_out "R7 no config" "config"
new_case
run "FAKE_DOPPLER_MODE=network" env-pull.sh
expect_rc_nonzero "R7 no network"; expect_out "R7 no network" "network"
new_case
run "FAKE_DOPPLER_MODE=other" env-pull.sh
expect_rc_nonzero "R7 unknown failure"; expect_out "R7 unknown failure" "doppler secrets -p toki -c dev"

# R17: the environment name.
new_case
run "NODE_ENV=production" env-pull.sh
expect_rc_nonzero "R17 production in the shell"
expect_out "R17 names the shell" "shell"
[ -e "$C/.env" ] && flunk "R17 production in the shell wrote .env" || pass
new_case
echo "NODE_ENV=production" > "$C/.env"; cp "$C/.env" "$C/.env.before"
run "" env-pull.sh
expect_rc_nonzero "R17 production in .env"
expect_out "R17 names the file" ".env"
expect_same_file "R17 production in .env leaves it" "$C/.env" "$C/.env.before"
new_case
run "" env-pull.sh
expect_rc "R17 unset with no .env still pulls" 0
expect_same_file "R17 unset with no .env writes it" "$C/.env" "$C/doppler.out"
new_case
run "NODE_ENV=" env-pull.sh
expect_rc_nonzero "R17 empty in the shell"
[ -e "$C/.env" ] && flunk "R17 empty in the shell wrote .env" || pass
new_case
printf 'NODE_ENV=\n' > "$C/.env"; cp "$C/.env" "$C/.env.before"
run "" env-pull.sh
expect_rc_nonzero "R17 empty in .env"
expect_same_file "R17 empty in .env leaves it" "$C/.env" "$C/.env.before"
# R16: the value of NODE_ENV is not printed either.
new_case
run "NODE_ENV=${MARK}_name" env-pull.sh
expect_rc_nonzero "R16 odd NODE_ENV"
expect_no_out "R16 odd NODE_ENV is not printed" "$MARK"

# A multi-line value is refused, in .env and in what Doppler returns.
new_case
printf 'KEY="abc\nmore"\n' > "$C/.env"; cp "$C/.env" "$C/.env.before"
run "" env-pull.sh
expect_rc_nonzero "multi-line .env"
expect_out "multi-line .env" "multi-line"
expect_same_file "multi-line .env is kept" "$C/.env" "$C/.env.before"
new_case
printf 'KEY="abc\nmore"\n' >> "$C/doppler.out"
echo "OLD=keep" > "$C/.env"; cp "$C/.env" "$C/.env.before"
run "" env-pull.sh
expect_rc_nonzero "multi-line pulled value"
expect_out "multi-line pulled value" "several lines"
expect_same_file "multi-line pulled value leaves .env" "$C/.env" "$C/.env.before"
expect_no_temp "multi-line pulled value"

# An interrupt removes the temporary files and leaves .env alone.
new_case
echo "OLD=keep" > "$C/.env"; cp "$C/.env" "$C/.env.before"
start_bg "FAKE_DOPPLER_MODE=slow" env-pull.sh
wait_text "$C/calls.log" "secrets download" 10
kill -TERM "$bgpid"
wait "$bgpid" 2>/dev/null
sleep 4
expect_no_temp "interrupted env:pull"
expect_same_file "interrupted env:pull leaves .env" "$C/.env" "$C/.env.before"

# --------------------------------------------------------- start:local ---

# R8: missing tools are named together, and nothing starts.
new_case
write_env
run "FAKE_NODE_VERSION=v20.1.0 FAKE_DOCKER=down FAKE_PNPM_VERSION=10.0.0" start-local.sh
expect_rc_nonzero "R8 several problems"
expect_out "R8 Node" "has Node 20"
expect_out "R8 Docker" "Docker is not running"
expect_out "R8 pnpm" "has pnpm 10.0.0"
expect_no_call "R8 starts nothing" "pnpm dev:up"
new_case
write_env
run "FAKE_PNPM_VERSION=10.0.0" start-local.sh
expect_rc_nonzero "R8 wrong pnpm alone"
expect_out "R8 wrong pnpm alone" "has pnpm 10.0.0"
expect_no_out "R8 wrong pnpm alone does not blame Node" "has Node"
expect_no_call "R8 wrong pnpm alone starts nothing" "pnpm dev:up"
new_case
write_env
rm "$C/bin/docker"
run "" start-local.sh
expect_rc_nonzero "R8 no Docker"
expect_out "R8 no Docker" "Docker is not installed"
new_case
write_env
# A PATH that holds the real tools the script needs, but not lsof or curl.
mkdir -p "$T/minpath"
for tool in bash sh env awk sed grep cut tr cat ps cksum mktemp ls rm mv cp chmod mkdir dirname sleep kill stat cmp sort head pgrep basename uname tail wc ln touch date; do
  real="$(PATH="$BASEPATH" command -v "$tool")" && ln -sf "$real" "$T/minpath/$tool"
done
rm -f "$C/bin/lsof" "$C/bin/curl"
CASE_BASE="$T/minpath"
run "" start-local.sh
CASE_BASE=""
expect_rc_nonzero "R8 no lsof and no curl"
expect_out "R8 no lsof" "lsof"
expect_out "R8 no curl" "curl"
expect_no_call "R8 no lsof starts nothing" "pnpm dev:up"
new_case
run "FAKE_DOPPLER_LOGIN=no" start-local.sh
expect_rc_nonzero "R8 doppler not logged in and no .env"
expect_out "R8 doppler not logged in" "doppler login"
expect_no_call "R8 doppler not logged in starts nothing" "pnpm dev:up"
new_case
write_env
run "FAKE_NODE_VERSION=v24.1.0" start-local.sh
expect_rc_nonzero "R8 wrong Node alone"
expect_out "R8 wrong Node alone" "has Node 24"
expect_no_out "R8 wrong Node alone does not blame Docker" "Docker"
expect_no_call "R8 wrong Node alone starts nothing" "pnpm dev:up"
new_case
rm "$C/bin/doppler"
run "" start-local.sh
expect_rc_nonzero "R8 no doppler and no .env"
expect_out "R8 doppler" "doppler"
expect_no_call "R8 starts nothing without doppler" "pnpm dev:up"

# R9: an existing .env is used as it is, with no call to Doppler.
new_case
write_env
run "FAKE_DEVUP_EXIT=1" start-local.sh
expect_no_call "R9 no doppler call" "doppler"
expect_call "R9 goes on" "pnpm dev:up"

# R10: a missing .env is pulled first; a failed pull stops everything.
new_case
run "FAKE_DEVUP_EXIT=1" start-local.sh
expect_call "R10 pulls" "doppler secrets"
expect_call "R10 then starts the services" "pnpm dev:up"
new_case
run "FAKE_DOPPLER_MODE=network" start-local.sh
expect_rc_nonzero "R10 failed pull"
expect_no_call "R10 failed pull starts nothing" "pnpm dev:up"

# R11: the order, and a stop at the first failing step.
new_case
write_env
run "FAKE_DEVUP_EXIT=1" start-local.sh
expect_rc_nonzero "R11 dev:up fails"
expect_out "R11 names the step" "dev:up"
expect_no_call "R11 no migrate after a failed dev:up" "pnpm migrate"
new_case
write_env
run "FAKE_MIGRATE_EXIT=1" start-local.sh
expect_rc_nonzero "R11 migrate fails"
expect_out "R11 names the migrate step" "migrat"
expect_no_line "R11 no dev after a failed migrate" "pnpm dev"

# R14, R15, R11 order, R16: a whole run, stopped by a signal.
# stop_check CASE-NAME: after the run is stopped, nothing of the dev tree is
# left, the run file is gone and the services were not touched.
stop_check() {
  local pids p left=0
  pids="$(cat "$C/dev.pids" 2>/dev/null)"
  if [ -n "$pids" ]; then pass; else flunk "$1: the fake dev tree never recorded its processes"; fi
  for p in $pids; do alive "$p" && left=$((left + 1)); done
  expect_equal "$1: no process of the dev tree is left" "0" "$left"
  if [ -f "$run_file" ]; then flunk "$1: the run file is still there"; else pass; fi
  expect_no_call "$1: does not stop the services" "pnpm dev:down"
  expect_no_call "$1: never resets" "reset"
  expect_out "$1: says how to stop the services" "pnpm dev:down"
}
new_case
write_env
start_bg "" start-local.sh
if wait_text "$C/out" "http://localhost:5173" 30; then pass; else flunk "R14 the address was not printed"; fi
wait_text "$C/dev.pids" "" 10
expect_out "R14 the address" "http://localhost:5173"
expect_out "R14 the mail catcher" "http://localhost:8025"
expect_out "R14 the first admin variable" "FIRST_ADMIN_EMAIL"
expect_no_out "R14 prints no value" "$MARK"
expect_call "R11 dev:up" "pnpm dev:up"
order="$(grep -n 'pnpm dev:up\|pnpm migrate\|^pnpm dev$' "$C/calls.log" | cut -d: -f2- | tr '\n' ',')"
expect_equal "R11 order" "pnpm dev:up,pnpm migrate,pnpm dev," "$order"
run_file="$(case_run_file)"
if [ -f "$run_file" ]; then pass; else flunk "R12 the run file was not written"; fi
expect_equal "R12 the run file holds the pid of the run" "$bgpid" "$(cat "$run_file")"
stop_bg
stop_check "R15 SIGTERM"

# R15: the real Ctrl+C is SIGINT. A job started under job control has the
# default SIGINT, so the script's own handler is what stops the run.
new_case
write_env
set -m
start_bg "" start-local.sh
set +m
wait_text "$C/out" "http://localhost:5173" 30
wait_text "$C/dev.pids" "" 10
run_file="$(case_run_file)"
kill -INT "$bgpid" 2>/dev/null
wait "$bgpid" 2>/dev/null
rc=$?
expect_equal "R15 SIGINT exit code" "130" "$rc"
stop_check "R15 SIGINT"

# R15: a second signal during the cleanup does not cut it short.
new_case
write_env
start_bg "" start-local.sh
wait_text "$C/out" "http://localhost:5173" 30
wait_text "$C/dev.pids" "" 10
run_file="$(case_run_file)"
kill -TERM "$bgpid" 2>/dev/null
kill -TERM "$bgpid" 2>/dev/null
wait "$bgpid" 2>/dev/null
stop_check "R15 two signals"

# R12: a port held by another process stops the command, which is not killed.
new_case
write_env
stray; foreign="$stray_pid"
echo "$foreign" > "$C/ports/5173"
run "" start-local.sh
expect_rc_nonzero "R12 busy web port"
expect_out "R12 names the port" "5173"
expect_out "R12 names the pid" "$foreign"
expect_out "R12 names the process" "sleep"
if alive "$foreign"; then pass; else flunk "R12 the foreign process was killed"; fi
expect_no_call "R12 starts nothing" "pnpm dev:up"
# R12: a live run file of this worktree does not make a foreign listener ours.
new_case
write_env
own_proc
stray; foreign="$stray_pid"
echo "$own_child" > "$C/ports/3000"
echo "$foreign" > "$C/ports/5173"
mkdir -p "$(dirname "$(case_run_file)")"
echo "$own_pid" > "$(case_run_file)"
run "" start-local.sh
expect_rc_nonzero "R12 own run file and a foreign listener"
expect_out "R12 own run file and a foreign listener names the pid" "$foreign"
expect_no_call "R12 own run file and a foreign listener starts nothing" "pnpm dev:up"
if alive "$foreign"; then pass; else flunk "R12 the foreign process was killed"; fi
# R12: another worktree's run file does not make a listener ours.
new_case
write_env
own_proc
echo "$own_child" > "$C/ports/5173"
echo "$own_child" > "$C/ports/3000"
other_sum="$(printf '%s' "$C-another-worktree" | cksum | cut -d' ' -f1)"
mkdir -p "$C/state/toki/local-run"
echo "$own_pid" > "$C/state/toki/local-run/$other_sum.pid"
run "" start-local.sh
expect_rc_nonzero "R12 another worktree's run"
expect_no_call "R12 another worktree's run starts nothing" "pnpm dev:up"
# R12: a stale run file is ignored, and a foreign listener is still foreign.
new_case
write_env
mkdir -p "$(dirname "$(case_run_file)")"
echo "999999" > "$(case_run_file)"
run "FAKE_DEVUP_EXIT=1" start-local.sh
expect_call "R12 a stale run file does not stop the command" "pnpm dev:up"
new_case
write_env
stray; foreign="$stray_pid"
echo "$foreign" > "$C/ports/3000"
mkdir -p "$(dirname "$(case_run_file)")"
echo "999999" > "$(case_run_file)"
run "" start-local.sh
expect_rc_nonzero "R12 a stale run file and a foreign listener"
expect_out "R12 a stale run file and a foreign listener" "3000"
expect_no_call "R12 a stale run file and a foreign listener starts nothing" "pnpm dev:up"
# R12: a run file whose pid now belongs to another program is stale.
new_case
write_env
stray; reused="$stray_pid"
mkdir -p "$(dirname "$(case_run_file)")"
echo "$reused" > "$(case_run_file)"
run "FAKE_DEVUP_EXIT=1" start-local.sh
expect_call "R12 a reused pid is not an own run" "pnpm dev:up"

# R13: this worktree's own run is already going. The listeners are a child of
# the run, so the walk up the process tree is what proves they are ours.
new_case
write_env
own_proc
echo "$own_child" > "$C/ports/5173"
echo "$own_child" > "$C/ports/3000"
mkdir -p "$(dirname "$(case_run_file)")"
echo "$own_pid" > "$(case_run_file)"
run "" start-local.sh
expect_rc "R13 already running" 0
expect_out "R13 prints the address" "http://localhost:5173"
expect_no_call "R13 starts no second run" "pnpm dev:up"
expect_no_line "R13 starts no second dev" "pnpm dev"
# R13: the run is still starting (the file is there, the ports are free): a
# second run waits instead of starting, and leaves the first run's file alone.
new_case
write_env
own_proc
mkdir -p "$(dirname "$(case_run_file)")"
echo "$own_pid" > "$(case_run_file)"
run "" start-local.sh
expect_rc_nonzero "R13 still starting"
expect_out "R13 still starting" "already starting"
expect_no_call "R13 still starting starts nothing" "pnpm dev:up"
expect_equal "R13 still starting keeps the first run's file" "$own_pid" "$(cat "$(case_run_file)")"

# R17: the environment name for start:local.
new_case
write_env
run "NODE_ENV=production" start-local.sh
expect_rc_nonzero "R17 production in the shell"
expect_no_call "R17 production starts nothing" "pnpm dev:up"
new_case
write_env
sed 's/^NODE_ENV=.*/NODE_ENV=production/' "$C/.env" > "$C/.env.tmp" && mv "$C/.env.tmp" "$C/.env"
run "" start-local.sh
expect_rc_nonzero "R17 production in .env"
expect_no_call "R17 production in .env starts nothing" "pnpm dev:up"
new_case
write_env
grep -v '^NODE_ENV=' "$C/.env" > "$C/.env.tmp" && mv "$C/.env.tmp" "$C/.env"
run "FAKE_DEVUP_EXIT=1" start-local.sh
expect_call "R17 unset in both goes on" "pnpm dev:up"

# R16: no invented value anywhere a command wrote.
leaks=0
for f in "$T"/c*/out "$T"/c*/calls.log; do
  grep -q "$MARK" "$f" 2>/dev/null && leaks=$((leaks + 1))
done
expect_equal "R16 no value in any output or call log" "0" "$leaks"

# ------------------------------------------------------------- the docs ---

# R18: the README names both commands and does not tell anyone to copy a .env.
readme="$SRC/README.md"
if grep -q 'pnpm env:pull' "$readme" && grep -q 'pnpm start:local' "$readme"; then pass; else flunk "R18 the README lacks a command"; fi
if grep -Eq 'cp [^ ]*\.env( |$)' "$readme"; then flunk "R18 the README tells the reader to copy a .env between folders"; else pass; fi
if grep -q 'Commands: TBD' "$readme"; then flunk "R18 the README still says Commands: TBD"; else pass; fi
for s in env:pull start:local; do
  if grep -q "\"$s\":" "$SRC/package.json"; then pass; else flunk "package.json has no $s script"; fi
done

if [ "$failures" -eq 0 ]; then
  echo "all $checks checks passed"
else
  echo "$failures of $checks checks failed" >&2
  exit 1
fi
