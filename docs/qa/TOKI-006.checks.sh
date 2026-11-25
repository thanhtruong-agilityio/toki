#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-006.md. No network except the package registry
# (pnpm install --frozen-lockfile, and npm install of @playwright/test into a temporary folder)
# and requests to 127.0.0.1; no model.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-006.checks.sh [T1 T2 ...]
# It reads files of the commit V with `git show`. Rows that run Vite, the build or the type check
# use a temporary worktree of V, created on first use and removed when the script ends, even when
# a row fails; every process the script starts is stopped by the same trap, and no other process
# is touched. The repository itself is not changed. Processes get only the variables given on the
# command line (`env -i`); no `.env` file is read or created. It prints one line for each row:
# counts, status codes and words, never a value of a variable.
# The browser rows use @playwright/test (the version `main` uses) installed with npm into a
# temporary folder and the Chromium that Playwright has already cached; no browser is downloaded.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
PW_VERSION=1.65.1
doc() { git show "$V:$1" 2>/dev/null; }

# Every temporary file of the script lives under one folder, made here in the current shell, so
# the cleanup removes all of it whatever subshell created it.
BASE=$(mktemp -d); export TMPDIR="$BASE"
before_wt=$(git worktree list | wc -l | tr -d ' ')
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; TMPS=""; PIDS=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; }
cleanup() {
  local p d
  for p in $PIDS; do kill_tree "$p"; done
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
  for d in $TMPS; do rm -rf "$d"; done
  rm -rf "$BASE"
  git worktree prune >/dev/null 2>&1
}
trap cleanup EXIT

N22=""; NEED22=0
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  N22=$(ls -d "$HOME"/.nvm/versions/node/v22*/bin 2>/dev/null | tail -1)
  [ -n "$N22" ] || NEED22=1
fi
NODEPATH="${N22:+$N22:}$PATH"
nodebin() { PATH="$NODEPATH" node "$@"; }
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
mk() { TMPD=$(mktemp -d); TMPS="$TMPS $TMPD"; } # sets TMPD in this shell, so cleanup removes it
freeport() { nodebin -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
portbusy() { nodebin -e 'const s=require("net").connect(Number(process.argv[1]),"127.0.0.1");s.on("connect",()=>{console.log("busy");process.exit(0)});s.on("error",()=>{console.log("free");process.exit(0)})' "$1" 2>/dev/null; }
need_port() { # $1 row, $2 port: the row is Blocked when the port is taken
  [ "$(portbusy "$2")" = free ] && return 0
  echo "$1 port $2 is busy (Blocked)"; return 1
}
get() { curl -s -o "$2" -w '%{http_code}' --max-time 15 "$1" 2>/dev/null; } # url, bodyfile

# ---- helpers: Vite, stub server, size, browser ------------------------------
VPID=""
start_vite() { # $1 outfile, rest: VAR=value ... Starts the dev command with only those variables.
  local out="$1"; shift
  : > "$out"
  ( cd "$WT" && exec env -i PATH="$NODEPATH" HOME="$HOME" NO_COLOR=1 FORCE_COLOR=0 "$@" corepack pnpm --filter ./apps/web dev ) >"$out" 2>&1 &
  VPID=$!; PIDS="$PIDS $VPID"
  local i
  for i in $(seq 1 150); do
    grep -q 'localhost:5173' "$out" && [ "$(portbusy 5173)" = busy ] && return 0
    kill -0 "$VPID" 2>/dev/null || return 1
    sleep 0.2
  done
  return 1
}
stop_vite() { kill_tree "$VPID"; wait "$VPID" 2>/dev/null; local i; for i in $(seq 1 25); do [ "$(portbusy 5173)" = free ] && return 0; sleep 0.2; done; }
SPID=""
start_stub() { # $1 port, $2 logfile: answers every path with a fixed body and logs the path it received
  local d; mk; d=$TMPD
  cat > "$d/stub.js" <<'JS'
const http = require("http"), fs = require("fs");
const port = Number(process.argv[2]), log = process.argv[3];
http.createServer((req, res) => {
  fs.appendFileSync(log, req.url + "\n");
  res.setHeader("content-type", "text/plain");
  res.end("STUB-BODY-" + req.url.split("?")[0]);
}).listen(port, "127.0.0.1");
JS
  : > "$2"
  nodebin "$d/stub.js" "$1" "$2" >/dev/null 2>&1 &
  SPID=$!; PIDS="$PIDS $SPID"
  local i; for i in $(seq 1 50); do [ "$(portbusy "$1")" = busy ] && return 0; sleep 0.1; done
  return 1
}
stop_stub() { kill_tree "$SPID"; wait "$SPID" 2>/dev/null; }
BUILD_RC=""
build_once() { [ -n "$BUILD_RC" ] || { ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" SERVER_PORT=48271 corepack pnpm --filter ./apps/web build ) >/dev/null 2>&1; BUILD_RC=$?; }; }
PWDIR=""
playwright_ready() { # installs @playwright/test into a temporary folder, once
  [ -n "$PWDIR" ] && [ -d "$PWDIR/node_modules/@playwright/test" ] && return 0
  mk; PWDIR=$TMPD
  ( cd "$PWDIR" && PATH="$NODEPATH" PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund --silent --prefix "$PWDIR" "@playwright/test@$PW_VERSION" >/dev/null 2>&1 )
  [ -d "$PWDIR/node_modules/@playwright/test" ]
}
BROWSE_JS='
const { chromium } = require(process.argv[2] + "/node_modules/@playwright/test");
(async () => {
  const base = process.argv[3], paths = process.argv.slice(4);
  const b = await chromium.launch({ headless: true });
  const out = [];
  for (const p of paths) {
    const page = await b.newPage();
    const errs = [], pes = [], fails = [], reqs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", (e) => pes.push(String(e)));
    page.on("requestfailed", (r) => fails.push(r.url()));
    page.on("request", (r) => reqs.push(r.url()));
    const r = await page.goto(base + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const root = await page.locator("[data-testid=app-root]").allTextContents();
    const body = (await page.locator("body").innerText()).trim();
    out.push({ p, status: r ? r.status() : 0, root, body, errs: errs.length, pes: pes.length, fails: fails.length, icons: reqs.filter((u) => /favicon|\.ico(\?|$)/i.test(u)).length });
    await page.close();
  }
  await b.close();
  console.log(JSON.stringify(out));
})().catch((e) => { console.log("BROWSER_ERROR " + String(e.message).split("\n")[0]); process.exit(1); });
'
browse() { # paths...: runs the browser against the dev server on 5173; prints the JSON line
  local d; mk; d=$TMPD; printf '%s\n' "$BROWSE_JS" > "$d/browse.js"
  nodebin "$d/browse.js" "$PWDIR" http://127.0.0.1:5173 "$@" 2>/dev/null | tail -1
}
SIZE_JS='
const fs = require("fs"), zlib = require("zlib"), path = require("path");
const dist = process.argv[2];
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const queue = [];
for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) queue.push(m[1]);
for (const m of html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)) queue.push(m[1]);
for (const m of html.matchAll(/<link[^>]*href="([^"]+)"[^>]*rel="modulepreload"/g)) queue.push(m[1]);
const seen = new Set(); let total = 0, files = 0;
while (queue.length) {
  const ref = queue.pop(); const f = ref.replace(/^\//, "");
  if (seen.has(f)) continue; seen.add(f);
  const full = path.join(dist, f);
  if (!f.endsWith(".js") || !fs.existsSync(full)) continue;
  const buf = fs.readFileSync(full); const src = buf.toString("utf8");
  total += zlib.gzipSync(buf).length; files++;
  for (const m of src.matchAll(/(?:^|[^.\w$])(?:import|export)\s*(?:[^\x27"()]*?from\s*)?["\x27]([^"\x27]+\.js)["\x27]/g))
    queue.push(path.posix.join(path.posix.dirname(f), m[1]));
}
console.log(files + " " + total + " " + (total < 200000 ? 1 : 0));
'

# ---- rows --------------------------------------------------------------------
t1() {
  need T1 || return; need_port T1 5173 || return
  local d out prints=0 bound=0 rc nz=0 err=0 fallback=1 dummy; mk; d=$TMPD; out="$d/o"
  start_vite "$out" || { echo "T1 the dev server did not start (Blocked)"; return; }
  grep -q 'http://localhost:5173/' "$out" && prints=1
  [ "$(portbusy 5173)" = busy ] && bound=1
  stop_vite
  nodebin -e 'require("net").createServer().listen(5173,"127.0.0.1")' >/dev/null 2>&1 &
  dummy=$!; PIDS="$PIDS $dummy"; sleep 1
  ( cd "$WT" && exec env -i PATH="$NODEPATH" HOME="$HOME" NO_COLOR=1 FORCE_COLOR=0 timeout 25 corepack pnpm --filter ./apps/web dev ) >"$d/o2" 2>&1 & local vp=$!
  local i; for i in $(seq 1 100); do kill -0 "$vp" 2>/dev/null || break; [ "$(portbusy 5174)" = busy ] && break; sleep 0.2; done
  [ "$(portbusy 5174)" = free ] && fallback=0
  wait "$vp" 2>/dev/null; rc=$?
  { [ "$rc" != 0 ] && [ "$rc" != 124 ]; } && nz=1
  grep -qiE 'already in use|EADDRINUSE' "$d/o2" && err=1
  grep -qE 'localhost:517[0-9]' "$d/o2" && fallback=1
  kill_tree "$dummy"; wait "$dummy" 2>/dev/null
  echo "T1 $prints $bound $nz $err $((1 - fallback))"
}
t2() {
  need T2 || return; need_port T2 5173 || return
  playwright_ready || { echo "T2 @playwright/test could not be installed (Blocked)"; return; }
  local d j; mk; d=$TMPD
  start_vite "$d/o" || { echo "T2 the dev server did not start (Blocked)"; return; }
  j=$(browse /); stop_vite
  case "$j" in BROWSER_ERROR*|"") echo "T2 the browser did not run: ${j:-no output} (Blocked)"; return ;; esac
  printf '%s' "$j" | jq -r '.[0] | "T2 \(.status) \(.root | join("|")) \(.errs + .pes) \(.fails) \(.icons)"'
}
t3() {
  local routes plugin gen crl files
  routes=$(git ls-tree -r --name-only "$V" -- apps/web/src/routes | wc -l | tr -d ' ')
  plugin=$({ doc apps/web/vite.config.ts; doc apps/web/package.json; } | grep -ciE 'router-plugin|TanStackRouter|tanstack/router-')
  gen=$(git ls-tree -r --name-only "$V" -- apps/web | grep -ciE 'routeTree\.gen|\.gen\.(ts|tsx)$')
  files=$(git grep -l 'createRouter(' "$V" -- apps/web/src 2>/dev/null | sed "s#^$V:apps/web/src/##" | sort | tr '\n' ' ' | sed 's/ $//')
  crl=$(printf '%s' "$files" | wc -w | tr -d ' ')
  echo "T3 $routes $plugin $gen $crl $files"
}
t4() {
  need T4 || return; need_port T4 5173 || return
  playwright_ready || { echo "T4 @playwright/test could not be installed (Blocked)"; return; }
  local d j; mk; d=$TMPD
  start_vite "$d/o" || { echo "T4 the dev server did not start (Blocked)"; return; }
  j=$(browse /no-such-page /a/b/c); stop_vite
  case "$j" in BROWSER_ERROR*|"") echo "T4 the browser did not run: ${j:-no output} (Blocked)"; return ;; esac
  printf '%s' "$j" | jq -r '"T4 \([.[] | select(.body == "Page not found")] | length) \([.[].pes] | add)"'
}
t5() {
  local n files prov=0 wraps=0 imp=0 m
  n=$(git grep -c 'new QueryClient(' "$V" -- apps/web/src 2>/dev/null | awk -F: '{s += $NF} END {print s + 0}')
  files=$(git grep -l 'new QueryClient(' "$V" -- apps/web/src 2>/dev/null | sed "s#^$V:apps/web/src/##" | sort | tr '\n' ' ' | sed 's/ $//')
  m=$(doc apps/web/src/main.tsx | tr '\n' ' ')
  printf '%s' "$m" | grep -q 'QueryClientProvider client={queryClient}' && prov=1
  printf '%s' "$m" | grep -qE 'QueryClientProvider client=\{queryClient\}>[[:space:]]*<RouterProvider router=\{router\} />[[:space:]]*</QueryClientProvider>' && wraps=1
  printf '%s' "$m" | grep -qE 'import \{ queryClient \} from "\./query-client"' && imp=1
  echo "T5 $n $files $((prov * wraps * imp))"
}
t6() {
  need T6 || return; need_port T6 5173 || return
  local d sp eq=0 seen=0 body; mk; d=$TMPD; sp=$(freeport)
  start_stub "$sp" "$d/stublog" || { echo "T6 the stub did not start (Blocked)"; return; }
  start_vite "$d/o" SERVER_PORT="$sp" || { stop_stub; echo "T6 the dev server did not start (Blocked)"; return; }
  get "http://127.0.0.1:5173/api/v1/hello/world?x=1" "$d/b" >/dev/null
  [ "$(cat "$d/b")" = "STUB-BODY-/api/v1/hello/world" ] && eq=1
  grep -qx '/api/v1/hello/world?x=1' "$d/stublog" && seen=1
  stop_vite; stop_stub
  echo "T6 $eq $seen"
}
t7() {
  need T7 || return; need_port T7 5173 || return; need_port T7 3000 || return
  build_once
  local d reached=0 cfg=0 extra leak=0 c; mk; d=$TMPD
  start_stub 3000 "$d/stublog" || { echo "T7 the stub on 3000 did not start (Blocked)"; return; }
  start_vite "$d/o" || { stop_stub; echo "T7 the dev server did not start (Blocked)"; return; }
  get "http://127.0.0.1:5173/api/v1/x" "$d/b1" >/dev/null; get "http://127.0.0.1:5173/healthz" "$d/b2" >/dev/null
  [ "$(cat "$d/b1")" = "STUB-BODY-/api/v1/x" ] && reached=$((reached + 1))
  [ "$(cat "$d/b2")" = "STUB-BODY-/healthz" ] && reached=$((reached + 1))
  stop_vite; stop_stub
  c=$(doc apps/web/vite.config.ts)
  printf '%s' "$c" | grep -q 'loadEnv(mode, root, "")' && printf '%s' "$c" | grep -q 'new URL("../..", import.meta.url)' && cfg=1
  extra=$(printf '%s\n' "$c" | grep -vE '^[[:space:]]*//' | grep -ciE 'PROXY_TARGET|API_URL|API_PROXY|VITE_')
  if [ "$BUILD_RC" = 0 ]; then leak=$(grep -rlE 'SERVER_PORT|48271' "$WT/apps/web/dist" 2>/dev/null | wc -l | tr -d ' '); else leak="build failed"; fi
  echo "T7 $reached $cfg $extra $leak"
}
t8() {
  need T8 || return; need_port T8 5173 || return
  local d dead code5=0 up s; mk; d=$TMPD; dead=$(freeport)
  start_vite "$d/o" SERVER_PORT="$dead" || { echo "T8 the dev server did not start (Blocked)"; return; }
  s=$(get "http://127.0.0.1:5173/api/v1/x" "$d/b"); case "$s" in 5??) code5=1 ;; esac
  up=$(get "http://127.0.0.1:5173/" "$d/b2")
  stop_vite
  echo "T8 $code5 $up"
}
t9() {
  need T9 || return
  build_once
  local has=0; [ -f "$WT/apps/web/dist/index.html" ] && has=1
  echo "T9 $BUILD_RC $has"
}
t10() {
  need T10 || return
  build_once
  [ "$BUILD_RC" = 0 ] || { echo "T10 the build failed (Blocked)"; return; }
  local d; mk; d=$TMPD; printf '%s\n' "$SIZE_JS" > "$d/size.js"
  echo "T10 $(nodebin "$d/size.js" "$WT/apps/web/dist")"
}
t11() { need T11 || return; pn --filter ./apps/web typecheck >/dev/null 2>&1; echo "T11 $?"; }
t12() {
  local added hits all
  git rev-parse --verify -q "$V^1" >/dev/null || { echo "T12 $V has no first parent, so its diff cannot be measured (Blocked)"; return; }
  all=$(git diff --name-only "$V^1" "$V" | wc -l | tr -d ' ')
  added=$(git diff --name-status "$V^1" "$V" -- packages/client-core packages/ui-web | grep -c '^A')
  hits=$(git grep -nE 'Notification|localStorage|sessionStorage|indexedDB|navigator\.serviceWorker|Audio|AudioContext' "$V" -- apps/web/src 2>/dev/null | wc -l | tr -d ' ')
  echo "T12 $added $hits $all"
}
t13() {
  need T13 || return; need_port T13 5173 || return
  local d sp dead ok=0 five=0 alive=0 s; mk; d=$TMPD; sp=$(freeport); dead=$(freeport)
  start_stub "$sp" "$d/stublog" || { echo "T13 the stub did not start (Blocked)"; return; }
  start_vite "$d/o" SERVER_PORT="$sp" || { stop_stub; echo "T13 the dev server did not start (Blocked)"; return; }
  get "http://127.0.0.1:5173/healthz" "$d/b" >/dev/null
  [ "$(cat "$d/b")" = "STUB-BODY-/healthz" ] && grep -qx '/healthz' "$d/stublog" && ok=1
  stop_vite; stop_stub
  start_vite "$d/o2" SERVER_PORT="$dead" || { echo "T13 the dev server did not start without a server (Blocked)"; return; }
  s=$(get "http://127.0.0.1:5173/healthz" "$d/b2"); case "$s" in 5??) five=1 ;; esac
  [ "$(get "http://127.0.0.1:5173/" "$d/b3")" = 200 ] && alive=1
  stop_vite
  echo "T13 $ok $five $alive"
}

rows="${*:-T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12 T13}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
alive=0; for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
cleanup; WT=""; TMPS=""
for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done; PIDS=""
echo "CLEAN worktrees $([ "$(git worktree list | wc -l | tr -d ' ')" = "$before_wt" ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive ports $(portbusy 5173) $(portbusy 3000) temporary-folder $([ -e "$BASE" ] && echo left || echo removed)"
