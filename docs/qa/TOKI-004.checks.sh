#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-004.md. No network except the package registry
# through `pnpm install --frozen-lockfile` and requests to a server on 127.0.0.1; no model.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-004.checks.sh [T1 T2 ...]
# It reads files of the commit V with `git show`. Rows that run the server or its tests use a
# temporary worktree of V, created on first use and removed when the script ends, even when a
# row fails; every process the script starts is stopped by the same trap. The repository itself
# is not changed. The server is given throwaway values on the command line (`env -i`, so no
# value of the caller's shell reaches it); no `.env` file is read or created. It prints one line
# for each row: counts, exit codes and words, never a value of a variable.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
doc() { git show "$V:$1" 2>/dev/null; }

before_wt=$(git worktree list | wc -l | tr -d ' ')
before_status=$(git status --porcelain | wc -l | tr -d ' ')
WT=""; TMPS=""; PIDS=""
cleanup() {
  local p d
  for p in $PIDS; do kill "$p" >/dev/null 2>&1; done
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
  for d in $TMPS; do rm -rf "$d"; done
  git worktree prune >/dev/null 2>&1
}
trap cleanup EXIT

N22=""; NEED22=0
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  N22=$(ls -d "$HOME"/.nvm/versions/node/v22*/bin 2>/dev/null | tail -1)
  [ -n "$N22" ] || NEED22=1
fi
NODEPATH="${N22:+$N22:}$PATH"
pn() { ( cd "$WT" && PATH="$NODEPATH" corepack pnpm "$@" ); }
INSTALL_RC=""
ensure() {
  [ "$NEED22" = 1 ] && return 1
  if [ -z "$WT" ]; then
    local d; d=$(mktemp -d); TMPS="$TMPS $d"
    git worktree add --detach "$d/wt" "$V" >/dev/null 2>&1 || return 1
    WT="$d/wt"
  fi
  if [ -z "$INSTALL_RC" ]; then pn install --frozen-lockfile >/dev/null 2>&1; INSTALL_RC=$?; fi
  [ "$INSTALL_RC" = 0 ]
}
need() { ensure && return 0; echo "$1 needs Node 22 and an installed worktree of $V (Blocked)"; return 1; }
tmpdir() { local d; d=$(mktemp -d); TMPS="$TMPS $d"; echo "$d"; }
freeport() { PATH="$NODEPATH" node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
portbusy() { PATH="$NODEPATH" node -e 'const s=require("net").connect($1,"127.0.0.1");s.on("connect",()=>{console.log("busy");process.exit(0)});s.on("error",()=>{console.log("free");process.exit(0)})' 2>/dev/null; }

# start_server <outfile> <errfile> VAR=value ...: starts the real entry point directly with Node,
# in the background, with only the given variables. Sets SPID. Returns 1 if it did not listen.
SPID=""
start_server() {
  local out="$1" err="$2"; shift 2
  : > "$out"; : > "$err"
  ( cd "$WT/apps/server" && exec env -i PATH="$NODEPATH" HOME="$HOME" "$@" node --import tsx src/main.ts ) >"$out" 2>"$err" &
  SPID=$!; PIDS="$PIDS $SPID"
  local i
  for i in $(seq 1 100); do
    grep -q 'Server listening' "$out" && return 0
    kill -0 "$SPID" 2>/dev/null || return 1
    sleep 0.2
  done
  return 1
}
stop_server() { kill -TERM "$SPID" >/dev/null 2>&1; wait "$SPID" 2>/dev/null; }
get() { curl -s -o "$2" -w '%{http_code}' "http://127.0.0.1:$1$3" 2>/dev/null; } # port, bodyfile, path

DEAD_DB='postgres://qa:qa@127.0.0.1:1/qa'  # nothing listens on port 1

t1() {
  need T1 || return
  local d port out lines match=0 addr; d=$(tmpdir); port=$(freeport); out="$d/o"
  start_server "$out" "$d/e" NODE_ENV=development SERVER_PORT="$port" SERVER_HOST=127.0.0.1 LOG_LEVEL=info DATABASE_URL="$DEAD_DB" || { echo "T1 server did not start (Blocked)"; return; }
  get "$port" "$d/b" /healthz >/dev/null; stop_server
  lines=$(grep -c 'Server listening' "$out")
  addr=$(grep 'Server listening' "$out" | head -1 | jq -r '.msg' | sed 's/.*listening at //')
  [ "$addr" = "http://127.0.0.1:$port" ] && match=1
  echo "T1 $lines $match"
}
t2() {
  local files
  files=$(git grep -l 'process\.env' "$V" -- apps/server/src ':!apps/server/src/test' 2>/dev/null | sed "s#^$V:apps/server/src/##" | sort | tr '\n' ' ' | sed 's/ $//')
  echo "T2 $(printf '%s' "$files" | wc -w | tr -d ' ') $files"
}
t3() {
  need T3 || return
  local d n=0 names=0 both=0 rc
  d=$(tmpdir)
  runcase() { # extra vars...; prints exit code, leaves stderr in $d/e
    ( cd "$WT/apps/server" && env -i PATH="$NODEPATH" HOME="$HOME" "$@" node --import tsx src/main.ts ) >"$d/o" 2>"$d/e"; echo $?
  }
  rc=$(runcase); [ "$rc" = 1 ] && n=$((n + 1))
  grep -q '^NODE_ENV' "$d/e" && grep -q '^DATABASE_URL' "$d/e" && { names=$((names + 1)); both=1; }
  rc=$(runcase NODE_ENV="   " DATABASE_URL="$DEAD_DB"); [ "$rc" = 1 ] && n=$((n + 1))
  grep -q '^NODE_ENV' "$d/e" && names=$((names + 1))
  rc=$(runcase NODE_ENV=development DATABASE_URL=); [ "$rc" = 1 ] && n=$((n + 1))
  grep -q '^DATABASE_URL' "$d/e" && names=$((names + 1))
  echo "T3 $n $names $both"
}
t4() {
  need T4 || return
  local d rc nz=0 names=0 leak
  d=$(tmpdir)
  ( cd "$WT/apps/server" && env -i PATH="$NODEPATH" HOME="$HOME" NODE_ENV=development DATABASE_URL="$DEAD_DB" LOG_LEVEL=loudSECRETVALUE SERVER_PORT=99999SECRETPORT node --import tsx src/main.ts ) >"$d/o" 2>"$d/e"; rc=$?
  [ "$rc" = 1 ] && nz=1
  grep -q '^LOG_LEVEL' "$d/e" && names=$((names + 1))
  grep -q '^SERVER_PORT' "$d/e" && names=$((names + 1))
  leak=$(cat "$d/o" "$d/e" | grep -c 'SECRETVALUE\|SECRETPORT')
  echo "T4 $nz $names $leak"
}
t5() {
  need T5 || return
  local d port code body=0; d=$(tmpdir); port=$(freeport)
  start_server "$d/o" "$d/e" NODE_ENV=development SERVER_PORT="$port" DATABASE_URL="$DEAD_DB" || { echo "T5 server did not start (Blocked)"; return; }
  code=$(get "$port" "$d/b" /healthz); stop_server
  [ "$(jq -c . "$d/b" 2>/dev/null)" = '{"status":"ok"}' ] && body=1
  echo "T5 $code $body"
}
t6() {
  need T6 || return
  local d port good total; d=$(tmpdir); port=$(freeport)
  start_server "$d/o" "$d/e" NODE_ENV=development SERVER_PORT="$port" DATABASE_URL="$DEAD_DB" LOG_LEVEL=debug || { echo "T6 server did not start (Blocked)"; return; }
  get "$port" "$d/b" /healthz >/dev/null; get "$port" "$d/b" /api/v1/nothing >/dev/null; stop_server
  total=$(grep -c . "$d/o")
  good=$(jq -cR 'fromjson? | select(type == "object")' "$d/o" | grep -c .)
  echo "T6 $good $total"
}
t7() {
  need T7 || return
  local d port out id lines fields=0 hz_info hz_debug; d=$(tmpdir); port=$(freeport); out="$d/o"
  start_server "$out" "$d/e" NODE_ENV=development SERVER_PORT="$port" DATABASE_URL="$DEAD_DB" LOG_LEVEL=info || { echo "T7 server did not start (Blocked)"; return; }
  get "$port" "$d/b" '/api/v1/zz?x=1' >/dev/null; get "$port" "$d/b" /healthz >/dev/null; stop_server
  id=$(jq -rR 'fromjson? | select(.msg == "request completed" and .path == "/api/v1/zz") | .reqId' "$out" | head -1)
  lines=$([ -n "$id" ] && jq -cR --arg i "$id" 'fromjson? | select(.reqId == $i)' "$out" | grep -c . || echo 0)
  jq -eR 'fromjson? | select(.msg == "request completed" and .path == "/api/v1/zz") | (.method == "GET")' "$out" >/dev/null 2>&1 && fields=$((fields + 1))
  jq -eR 'fromjson? | select(.msg == "request completed" and .path == "/api/v1/zz") | (.path == "/api/v1/zz")' "$out" >/dev/null 2>&1 && fields=$((fields + 1))
  jq -eR 'fromjson? | select(.msg == "request completed" and .path == "/api/v1/zz") | (.status == 404)' "$out" >/dev/null 2>&1 && fields=$((fields + 1))
  jq -eR 'fromjson? | select(.msg == "request completed" and .path == "/api/v1/zz") | (.durationMs | type == "number")' "$out" >/dev/null 2>&1 && fields=$((fields + 1))
  jq -eR 'fromjson? | select(.msg == "request completed" and .path == "/api/v1/zz") | (.reqId | type == "string")' "$out" >/dev/null 2>&1 && fields=$((fields + 1))
  hz_info=$(jq -cR 'fromjson? | select(.msg == "request completed" and .path == "/healthz")' "$out" | grep -c .)
  # the same /healthz request at level debug
  d=$(tmpdir); port=$(freeport); out="$d/o"
  start_server "$out" "$d/e" NODE_ENV=development SERVER_PORT="$port" DATABASE_URL="$DEAD_DB" LOG_LEVEL=debug || { echo "T7 server did not start at debug (Blocked)"; return; }
  get "$port" "$d/b" /healthz >/dev/null; stop_server
  hz_debug=$(jq -cR 'fromjson? | select(.msg == "request completed" and .path == "/healthz")' "$out" | grep -c .)
  echo "T7 $lines $fields $hz_info $hz_debug"
}

# The in-process harness: buildApp with test routes, requests through app.inject.
HARNESS='
import { ErrorResponseSchema } from "@toki/shared";
import { Writable } from "node:stream";
import { z } from "zod";
import { buildApp } from "./src/app.js";
import { AppError } from "./src/errors.js";
const config: any = { server: { env: "development", port: 3000, host: "127.0.0.1", logLevel: "info" }, database: { url: "postgres://fake:fake@127.0.0.1:1/fake" } };
function capture() { const chunks: string[] = []; const stream = new Writable({ write(c, _e, d) { chunks.push(c.toString()); d(); } }); return { stream, text: () => chunks.join("") }; }
const order: string[] = [];
let scopePrefix = "";
async function make() {
  const log = capture();
  const app = buildApp({ config, logStream: log.stream, registerRoutes: (scope) => {
    scopePrefix = (scope as any).prefix; order.push("register");
    scope.get("/ok", async () => ({ ok: true }));
    scope.get("/boom", async () => { throw new Error("boom-internal-detail"); });
    scope.get("/app-error", async () => { throw new AppError(409, "conflict_test", "A test conflict.", { field: "x" }); });
    scope.get("/validate", async (request) => z.object({ n: z.coerce.number() }).parse(request.query));
    scope.get("/status/:code", async (request) => { throw Object.assign(new Error("raised by a plugin"), { statusCode: Number((request.params as any).code) }); });
  } });
  await app.ready(); order.push("ready");
  return { app, log };
}
const out: Record<string, unknown> = {};
const { app, log } = await make();
const cases: [string, string, number][] = [["/api/v1/nope", "404", 404], ["/api/v1/validate?n=secret-value-1", "validation", 400], ["/api/v1/app-error", "known", 409], ["/api/v1/status/429", "framework", 429], ["/api/v1/boom", "unexpected", 500]];
let okc = 0;
for (const [url, , status] of cases) {
  const r = await app.inject({ url });
  if (r.statusCode === status && ErrorResponseSchema.safeParse(JSON.parse(r.body)).success) okc++;
}
out.t8 = [okc, cases.length];
const boom = await app.inject({ url: "/api/v1/boom" });
const b = JSON.parse(boom.body);
out.t9 = [
  boom.statusCode === 500 && b.error.code === "internal_error" && typeof b.error.message === "string" && b.error.message.length > 0 ? 1 : 0,
  !boom.body.includes("boom-internal-detail") && !/\n\s+at /.test(boom.body) && !boom.body.includes("stack") ? 1 : 0,
  JSON.stringify(Object.keys(b.error.details ?? {})) === JSON.stringify(["requestId"]) ? 1 : 0,
  log.text().includes("boom-internal-detail") && /at /.test(log.text()) ? 1 : 0,
];
const ok = await app.inject({ url: "/api/v1/ok" });
const noPrefix = await app.inject({ url: "/ok" });
let refused = 0;
try { buildApp({ config }).get("/outside", async () => ({})); } catch (e) { if (/\/api\/v1/.test(String(e))) refused = 1; }
out.t10 = [ok.statusCode, noPrefix.statusCode, refused];
let same = 0;
for (const url of ["/api/v1/nope", "/api/v1/boom"]) {
  const vi = JSON.parse((await app.inject({ url, headers: { "accept-language": "vi" } })).body).error;
  const en = JSON.parse((await app.inject({ url, headers: { "accept-language": "en" } })).body).error;
  if (vi.code === en.code && vi.message === en.message) same++;
}
out.t12 = [same, 2];
const plain = buildApp({ config }); await plain.ready();
out.t16 = [plain ? 1 : 0, log.text().length > 0 ? 1 : 0, scopePrefix === "/api/v1" && order.join(",") === "register,ready" ? 1 : 0];
console.log(JSON.stringify(out));
'
harness() { # runs the harness once; prints its JSON line
  need HARNESS || return 1
  [ -f "$WT/apps/server/zz-harness.ts" ] || printf '%s\n' "$HARNESS" > "$WT/apps/server/zz-harness.ts"
  [ -n "${HARNESS_OUT:-}" ] || HARNESS_OUT=$( cd "$WT/apps/server" && env -i PATH="$NODEPATH" HOME="$HOME" node --import tsx zz-harness.ts 2>/dev/null | tail -1 )
  [ -n "$HARNESS_OUT" ]
}
hval() { printf '%s' "$HARNESS_OUT" | jq -r "$1 | join(\" \")"; }
t8()  { harness && echo "T8 $(hval .t8)" || echo "T8 the harness did not run (Blocked)"; }
t9()  { harness && echo "T9 $(hval .t9)" || echo "T9 the harness did not run (Blocked)"; }
t10() { harness && echo "T10 $(hval .t10)" || echo "T10 the harness did not run (Blocked)"; }
t12() { harness && echo "T12 $(hval .t12)" || echo "T12 the harness did not run (Blocked)"; }
t16() { harness && echo "T16 $(hval .t16)" || echo "T16 the harness did not run (Blocked)"; }

t11() {
  need T11 || return
  local out rc n
  out=$( cd "$WT" && env -u DATABASE_URL -u TEST_DATABASE_URL PATH="$NODEPATH" corepack pnpm --filter @toki/server test 2>&1 ); rc=$?
  n=$(printf '%s\n' "$out" | sed -n 's/.*Tests[[:space:]]*\([0-9][0-9]*\) passed.*/\1/p' | tail -1)
  echo "T11 $rc ${n:-0}"
}
t13() {
  local names n found=0 total=0
  names=$(doc apps/server/src/config.ts | awk '/export const configVariableNames/{on=1} on{print} on && /^};/{exit}' | grep -oE '"[A-Z][A-Z0-9_]+"' | tr -d '"' | sort -u)
  for n in $names; do total=$((total + 1)); doc .env.example | grep -q "^$n=" && found=$((found + 1)); done
  echo "T13 $total $found"
}
t14() {
  local a=0 b=0 c
  doc apps/server/package.json | jq -r '.scripts.dev' | grep -q -- '--env-file=../../.env' && a=1
  [ "$(doc package.json | jq -r '.scripts.dev')" = "pnpm -r --parallel --if-present run dev" ] && b=1
  c=$(git grep -ciE 'dotenv|loadEnvFile|readFileSync\(.*\.env' "$V" -- apps/server/src ':!apps/server/src/test' 2>/dev/null | awk -F: '{s += $NF} END {print s + 0}')
  echo "T14 $a $b $c"
}
t15() {
  need T15 || return
  local d port rc1 rc2; d=$(tmpdir)
  port=$(freeport)
  start_server "$d/o" "$d/e" NODE_ENV=development SERVER_PORT="$port" DATABASE_URL="$DEAD_DB" || { echo "T15 server did not start (Blocked)"; return; }
  kill -TERM "$SPID"; wait "$SPID" 2>/dev/null; rc1=$?
  port=$(freeport)
  start_server "$d/o" "$d/e" NODE_ENV=development SERVER_PORT="$port" DATABASE_URL="$DEAD_DB" || { echo "T15 server did not start (Blocked)"; return; }
  kill -INT "$SPID"; wait "$SPID" 2>/dev/null; rc2=$?
  echo "T15 $rc1 $rc2"
}
t17() {
  local exists=0 mods
  git ls-tree -r --name-only "$V" -- apps/server/src/modules | grep -q . && exists=1
  mods=$(git ls-tree "$V" apps/server/src/modules/ | awk '$2 == "tree"' | grep -c .)
  echo "T17 $exists $mods"
}
t18() {
  need T18 || return
  local d port a b; d=$(tmpdir)
  if [ "$(portbusy 3000)" = busy ]; then echo "T18 port 3000 is busy (Blocked)"; return; fi
  start_server "$d/o" "$d/e" NODE_ENV=development DATABASE_URL="$DEAD_DB" || { echo "T18 server did not start (Blocked)"; return; }
  a=$(lsof -nP -a -p "$SPID" -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 {print $9}' | head -1); stop_server
  port=$(freeport)
  start_server "$d/o" "$d/e" NODE_ENV=development SERVER_PORT="$port" SERVER_HOST=0.0.0.0 DATABASE_URL="$DEAD_DB" || { echo "T18 server did not start with 0.0.0.0 (Blocked)"; return; }
  b=$(lsof -nP -a -p "$SPID" -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 {print $9}' | head -1); stop_server
  echo "T18 ${a%%:*} ${a##*:} ${b%%:*}"
}
t19() {
  local only=0 other
  doc apps/server/src/config.ts | grep -E '^[[:space:]]*database: \["DATABASE_URL"\]' >/dev/null && only=1
  other=$(doc apps/server/src/config.ts | grep -cE '"(DB_[A-Z]+|POSTGRES_[A-Z_]+|DATABASE_(HOST|PORT|USER|PASSWORD|NAME))"')
  echo "T19 $only $other"
}
t20() {
  need T20 || return
  local d port code body=0; d=$(tmpdir); port=$(freeport)
  start_server "$d/o" "$d/e" NODE_ENV=development SERVER_PORT="$port" DATABASE_URL="postgres://qa:qa@db.invalid:5432/qa" || { echo "T20 server did not start (Blocked)"; return; }
  code=$(get "$port" "$d/b" /healthz); stop_server
  [ "$(jq -c . "$d/b" 2>/dev/null)" = '{"status":"ok"}' ] && body=1
  echo "T20 $code $body"
}

rows="${*:-T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12 T13 T14 T15 T16 T17 T18 T19 T20}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
cleanup; WT=""; TMPS=""; PIDS=""
echo "CLEAN worktrees $([ "$(git worktree list | wc -l | tr -d ' ')" = "$before_wt" ] && echo same || echo changed) status $([ "$(git status --porcelain | wc -l | tr -d ' ')" = "$before_status" ] && echo same || echo changed)"
