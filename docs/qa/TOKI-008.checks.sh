#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-008.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile`; read-only `gh api` GET requests for the CI rows; connections to a
# PostgreSQL and a web server on 127.0.0.1. It writes nothing to GitHub and opens no pull request.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-008.checks.sh [T1 T2 ...]
# It reads files of the commit V with `git show`. Rows that run code use a temporary worktree of V and a
# temporary PostgreSQL cluster made with `initdb` (user qa, trust authentication, no unix socket, a free
# loopback port, every statement logged with its database and application); both are removed when the
# script ends, even when a row fails, and so are the processes it started. The development database and
# the Docker services are not touched, and the repository itself is not changed. Two databases live on the
# cluster: qa_dev, the stand-in for the development database (migrated, with one marker row), and the test
# database toki_qa_test, which the harness under test drops and creates. Rows that mutate a file of the
# worktree restore it afterwards and are paired with an unmutated run. No `.env` file is read or created.
# Every temporary file lives under one folder made in the current shell (BASE, exported as TMPDIR and
# given to every process it starts), which the cleanup removes; the one exception is the optional cache
# of public GitHub answers (QA_CACHE=<folder>). It prints one line for each row: counts, exit codes, ids and
# words; no password and no log text. The end-to-end rows use the ports 5173 and 3000 that the Playwright
# config fixes and are Blocked when one is taken; nothing on the machine is stopped.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
REPO="thanhtruong-agilityio/toki"
WF=".github/workflows/ci.yml"
HIST_UNTIL="${HIST_UNTIL:-2026-11-25T04:30:22Z}"
CACHE="${QA_CACHE:-}"; [ -n "$CACHE" ] && mkdir -p "$CACHE/j" "$CACHE/logs"
doc() { git show "$V:$1" 2>/dev/null; }

BASE=$(mktemp -d); export TMPDIR="$BASE"
before_wt=$(git worktree list | wc -l | tr -d ' ')
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; PIDS=""; PGBIN=""; PGPORT=""; PGDATA=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; }
cleanup() {
  local p
  for p in $PIDS; do kill_tree "$p"; done
  [ -n "$PGPORT" ] && "$PGBIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
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
# pnenv <VAR=value ...> -- <pnpm args>: runs pnpm in the worktree with only those variables
pnenv() { local envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift; ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" ${envs[@]+"${envs[@]}"} corepack pnpm "$@" ); }
INSTALL_RC=""
ensure() {
  [ "$NEED22" = 1 ] && return 1
  if [ -z "$WT" ]; then
    mkdir -p "$BASE/wt0"; git worktree add --detach "$BASE/wt0/wt" "$V" >/dev/null 2>&1 || return 1
    WT="$BASE/wt0/wt"
  fi
  if [ -z "$INSTALL_RC" ]; then pnenv -- install --frozen-lockfile >/dev/null 2>&1; INSTALL_RC=$?; fi
  [ "$INSTALL_RC" = 0 ]
}
need() { ensure && return 0; echo "$1 needs Node 22 and an installed worktree of $V (Blocked)"; return 1; }
reset_wt() { ( cd "$WT" && git checkout -q -- . && git clean -fdq ); }
freeport() { nodebin -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
portbusy() { nodebin -e 'const s=require("net").connect(Number(process.argv[1]),"127.0.0.1");s.on("connect",()=>{console.log("busy");process.exit(0)});s.on("error",()=>{console.log("free");process.exit(0)})' "$1" 2>/dev/null; }

# ---- the temporary PostgreSQL --------------------------------------------------
pg_ready() {
  [ -n "$PGPORT" ] && return 0
  local bin; bin=$(dirname "$(command -v initdb 2>/dev/null)")
  [ -x "$bin/initdb" ] || return 1
  PGBIN="$bin"; PGDATA="$BASE/pg"; PGPORT=$(freeport)
  "$PGBIN/initdb" -D "$PGDATA" -U qa -A trust -E UTF8 --no-locale >/dev/null 2>&1 || { PGPORT=""; return 1; }
  pg_start || { PGPORT=""; return 1; }
}
pg_start() { "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -c listen_addresses=127.0.0.1 -c unix_socket_directories= -c log_statement=all -c log_line_prefix=%d~%a~" -l "$BASE/pg.log" -w start >/dev/null 2>&1; }
pg_stop() { "$PGBIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1; }
sql() { PGAPPNAME=psql "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U qa -d "$1" -At -c "$2" 2>&1; }
dburl() { echo "postgres://qa@127.0.0.1:$PGPORT/$1"; }
DEV="qa_dev"; TESTDB="toki_qa_test"
DEVURL=""; TESTURL=""
env_test() { echo "NODE_ENV=development DATABASE_URL=$DEVURL TEST_DATABASE_URL=$TESTURL"; }
# the stand-in for the development database: migrated, with one marker row
DEV_READY=""
dev_ready() {
  [ -n "$DEV_READY" ] && return 0
  need_pg_ "$1" || return 1
  DEVURL=$(dburl "$DEV"); TESTURL=$(dburl "$TESTDB")
  sql postgres "create database $DEV" >/dev/null
  pnenv DATABASE_URL="$DEVURL" -- --filter @toki/server run db:migrate >/dev/null 2>&1 || return 1
  sql "$DEV" "insert into workspaces (id, name) values ('00000000-0000-7000-8000-000000000001', 'marker')" >/dev/null
  DEV_READY=1
}
need_pg_() { need "$1" || return 1; pg_ready && return 0; echo "$1 could not start a temporary PostgreSQL (Blocked)"; return 1; }
snap() { # the rows of every table and a hash of the schema of the development stand-in
  local t out=""
  for t in $(sql "$DEV" "select tablename from pg_tables where schemaname = 'public' order by 1"); do out="$out $t=$(sql "$DEV" "select count(*) from \"$t\"")"; done
  echo "$out | $(sql "$DEV" "select md5(string_agg(table_name || '.' || column_name || ':' || data_type, ',' order by table_name, ordinal_position)) from information_schema.columns where table_schema = 'public'")"
}

# ---- the shared full run of `pnpm test` ---------------------------------------
FULL_DONE=""; FULL_RC=""; SNAP_BEFORE=""; SNAP_AFTER=""
full_run() {
  [ -n "$FULL_DONE" ] && return 0
  dev_ready "$1" || return 1
  SNAP_BEFORE=$(snap)
  pnenv $(env_test) -- test > "$BASE/full.log" 2>&1; FULL_RC=$?
  SNAP_AFTER=$(snap)
  FULL_DONE=1
}
# a vitest result line: ✓ or ✗ (failed files are printed as FAIL / ❯) with the project and the file
pass_lines() { sed -E 's/\x1b\[[0-9;]*m//g' "$BASE/full.log" | grep -E '^ *✓ +[A-Za-z0-9@/_.-]+ +[^ ]+\.test\.tsx?'; }

# ---- the harness (TypeScript run with tsx inside apps/server) ------------------
write_clock_harness() { cat > "$1" <<'TS'
import { systemClock } from "../../packages/shared/src/clock/clock.js";
import { createTestClock, DEFAULT_TEST_INSTANT } from "../../packages/shared/src/clock/test-clock.js";
const out: Record<string, unknown> = {};
const fixed = Date.UTC(2031, 4, 17, 8, 30, 15, 123);
const tc = createTestClock(); tc.set(fixed);
const reads = (c: { now(): number }) => c.now();
const sys = systemClock.now();
out.t8 = [typeof systemClock.now === "function" && typeof sys === "number" ? 1 : 0, reads(tc) === fixed ? 1 : 0, Math.abs(sys - Date.now()) < 1000 ? 1 : 0];
const c2 = createTestClock(); const start = c2.now();
c2.advance(500); const a = c2.now() === start + 500;
c2.advance(1500); const b = c2.now() === start + 2000;
out.t9 = [a && b && start === DEFAULT_TEST_INSTANT ? 1 : 0];
console.log(JSON.stringify(out));
TS
}
write_guard_harness() { cat > "$1" <<'TS'
import { checkTestDatabase, GuardError } from "./test/guard.js";
const out: Record<string, unknown> = {};
const dev = "postgres://u@127.0.0.1:5432/toki";
const cases: [string, any, string][] = [
  ["same database through localhost", { testUrl: "postgres://u@localhost:5432/toki_test", developmentUrl: "postgres://u@127.0.0.1:5432/toki_test", environments: ["development"] }, "development"],
  ["development value with sslmode", { testUrl: "postgres://u@127.0.0.1:5432/toki_test?sslmode=disable", developmentUrl: "postgres://u@127.0.0.1:5432/toki_test", environments: ["development"] }, "development"],
  ["name without the suffix", { testUrl: "postgres://u@127.0.0.1:5432/toki", developmentUrl: dev, environments: ["development"] }, "suffix"],
  ["non-loopback host", { testUrl: "postgres://u@db.example.com:5432/toki_test", developmentUrl: dev, environments: ["development"] }, "loopback"],
  ["production setting", { testUrl: "postgres://u@127.0.0.1:5432/toki_test", developmentUrl: dev, environments: ["production"] }, "environment"],
];
let refused = 0, named = 0;
for (const [, input, check] of cases) {
  try { checkTestDatabase(input); } catch (e) { if (e instanceof GuardError && e.check === check) { refused++; if (e.message.includes(`(${check})`)) named++; } }
}
let valid = 0; try { checkTestDatabase({ testUrl: "postgres://u@127.0.0.1:5432/toki_test", developmentUrl: dev, environments: ["development"] }); valid = 1; } catch { valid = 0; }
out.t5 = [refused, named, valid];
console.log(JSON.stringify(out));
TS
}

t1() {
  full_run T1 || return
  local folders reporting=0 f n=0 tf hit
  pass_lines > "$BASE/pl.txt"
  folders=$(git ls-tree -r --name-only "$V" -- apps packages | grep -E '\.test\.tsx?$' | cut -d/ -f1-2 | sort -u)
  for f in $folders; do
    hit=0
    for tf in $(git ls-tree -r --name-only "$V" -- "$f" | grep -E '\.test\.tsx?$' | sed "s#^$f/##"); do
      grep -qF "$tf" "$BASE/pl.txt" && { hit=1; break; }
    done
    reporting=$((reporting + hit)); n=$((n + 1))
  done
  echo "T1 $FULL_RC $n $reporting"
}
t2() {
  full_run T2 || return
  local src=0 rep=0
  doc apps/server/test/workspaces.db.test.ts | grep -q 'insert(workspaces)' && doc apps/server/test/workspaces.db.test.ts | grep -qE 'select\(\)\.from\(workspaces\)|eq\(workspaces' && src=1
  pass_lines | grep -q 'workspaces\.db\.test\.ts' && rep=1
  echo "T2 $src $rep"
}
t3() {
  need_pg_ T3 || return
  dev_ready T3 || return
  local rc1 rc2 gone=0 url n
  url=$(dburl toki_qa3_test)
  sql postgres 'drop database if exists toki_qa3_test with (force)' >/dev/null
  echo "$(wc -l < "$BASE/pg.log" | tr -d ' ')" > "$BASE/pglog.mark"
  pnenv NODE_ENV=development DATABASE_URL="$DEVURL" TEST_DATABASE_URL="$url" -- --filter @toki/server exec vitest run --config vitest.db.config.ts > "$BASE/t3a.log" 2>&1; rc1=$?
  cp "$BASE/pg.log" "$BASE/pg.after-a.log"
  sql toki_qa3_test 'create table leftover (x int)' >/dev/null
  pnenv NODE_ENV=development DATABASE_URL="$DEVURL" TEST_DATABASE_URL="$url" -- --filter @toki/server exec vitest run --config vitest.db.config.ts > "$BASE/t3b.log" 2>&1; rc2=$?
  [ "$(sql toki_qa3_test "select to_regclass('public.leftover') is null")" = t ] && gone=1
  echo "T3 $rc1 $rc2 $gone"
}
t4() { full_run T4 || return; local a b; a=${SNAP_BEFORE%% | *}; b=${SNAP_AFTER%% | *}; echo "T4 $([ "$a" = "$b" ] && echo 1 || echo 0)"; echo "  development stand-in rows before:$a after:$b"; }
t5() {
  need_pg_ T5 || return
  local d out cnt lp rc refused_msg=0 src=0 conns
  write_guard_harness "$WT/apps/server/zz-guard.ts"
  out=$( cd "$WT/apps/server" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node --import tsx zz-guard.ts 2>/dev/null | tail -1 )
  lp=$(freeport)
  nodebin -e 'const net=require("net"),fs=require("fs");let n=0;net.createServer(s=>{n++;fs.writeFileSync(process.argv[2],String(n));s.destroy()}).listen(Number(process.argv[1]),"127.0.0.1");' "$lp" "$BASE/conns" &
  local lpid=$!; PIDS="$PIDS $lpid"; sleep 1; : > "$BASE/conns"
  pnenv NODE_ENV=development DATABASE_URL="postgres://qa@127.0.0.1:$lp/devname" TEST_DATABASE_URL="postgres://qa@127.0.0.1:$lp/nosuffix" -- --filter @toki/server exec vitest run --config vitest.db.config.ts > "$BASE/t5.log" 2>&1; rc=$?
  kill_tree "$lpid" 2>/dev/null; wait "$lpid" 2>/dev/null; grep -q 'Test database refused (suffix)' "$BASE/t5.log" && refused_msg=1
  conns=$(cat "$BASE/conns" 2>/dev/null); conns=${conns:-0}
  doc apps/server/test/setup-file-db.ts | grep -q 'current_database()' && src=1
  echo "T5 $(printf '%s' "$out" | jq -r '.t5[0]') $(printf '%s' "$out" | jq -r '.t5[1]') $conns $(printf '%s' "$out" | jq -r '.t5[2]') $src"
  echo "  runtime refusal: exit $([ "$rc" != 0 ] && echo non-zero || echo zero), names the suffix check: $refused_msg"
}
t6() {
  dev_ready T6 || return
  local seed order ab=0 ba=0 rcab="" rcba="" par=0 mut=1
  doc apps/server/vitest.db.config.ts | grep -q 'fileParallelism: false' && par=1
  for seed in 1 2 3 4 5 6 7 8; do
    pnenv $(env_test) -- --filter @toki/server exec vitest run --config vitest.db.config.ts --sequence.shuffle.files --sequence.seed="$seed" --reporter=json --outputFile="$BASE/o$seed.json" >/dev/null 2>&1; rc=$?
    order=$(jq -r '[.testResults | sort_by(.startTime)[] | .name | split("/")[-1]] | join(">")' "$BASE/o$seed.json" 2>/dev/null)
    case "$order" in
      workspaces.db.test.ts*isolation.db.test.ts*) [ -z "$rcab" ] && rcab=$rc ;;
      isolation.db.test.ts*workspaces.db.test.ts*) [ -z "$rcba" ] && rcba=$rc ;;
    esac
    [ -n "$rcab" ] && [ -n "$rcba" ] && break
  done
  [ -n "$rcab" ] && [ -n "$rcba" ] || { echo "T6 could not get both orders from seeds 1 to 8 (Blocked)"; return; }
  # without the emptying step the second file fails
  need T6 || return
  perl -0pi -e 's/await sql\.unsafe\(`truncate[^`]*`\);/\/\* removed \*\//' "$WT/apps/server/test/setup-file-db.ts"
  grep -q 'truncate' "$WT/apps/server/test/setup-file-db.ts" && { echo "T6 the mutation did not apply (Blocked)"; reset_wt; return; }
  pnenv $(env_test) -- --filter @toki/server exec vitest run --config vitest.db.config.ts >/dev/null 2>&1 && mut=0
  reset_wt
  echo "T6 $rcab $rcba $par $mut"
}
t7() {
  full_run T7 || return
  pg_stop
  pnenv $(env_test) -- test > "$BASE/t7.log" 2>&1; local rc=$?
  pg_start
  local msg=0 dbfail dbpass dbskip unitpass
  sed -E 's/\x1b\[[0-9;]*m//g' "$BASE/t7.log" > "$BASE/t7.clean"
  grep -qiE 'cannot reach the test database' "$BASE/t7.clean" && msg=1
  dbfail=$(grep -E '(FAIL|❯|×).*\.db\.test\.ts' "$BASE/t7.clean" | grep -oE '[A-Za-z0-9_.-]+\.db\.test\.ts' | sort -u | wc -l | tr -d ' ')
  dbpass=$(grep -E '^ *✓.*\.db\.test\.ts' "$BASE/t7.clean" | wc -l | tr -d ' ')
  dbskip=$(grep -E '(↓|skipped).*\.db\.test\.ts' "$BASE/t7.clean" | wc -l | tr -d ' ')
  unitpass=$(grep -E '^ *✓.*\.test\.tsx?' "$BASE/t7.clean" | grep -vc '\.db\.test\.ts')
  echo "T7 $([ "$rc" != 0 ] && echo 1 || echo 0) $msg $([ "$dbfail" -ge 1 ] && [ "$dbpass" = 0 ] && [ "$dbskip" = 0 ] && echo 1 || echo 0) $([ "$unitpass" -ge 1 ] && echo 1 || echo 0)"
  echo "  with Postgres stopped: database test files failed $dbfail, passed $dbpass, skipped $dbskip; database-free files passed $unitpass"
}
t8() {
  need T8 || return
  write_clock_harness "$WT/apps/server/zz-clock.ts"
  local out iface=0
  doc packages/shared/src/clock/clock.ts | grep -q 'now(): number' && iface=1
  out=$( cd "$WT/apps/server" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node --import tsx zz-clock.ts 2>/dev/null | tail -1 )
  echo "T8 $iface $(printf '%s' "$out" | jq -r '.t8[1]') $(printf '%s' "$out" | jq -r '.t8[2]') $(printf '%s' "$out" | jq -r '.t8[0]')"
}
t9() {
  need T9 || return
  write_clock_harness "$WT/apps/server/zz-clock.ts"
  local out rc
  out=$( cd "$WT/apps/server" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node --import tsx zz-clock.ts 2>/dev/null | tail -1 )
  pnenv -- exec vitest run packages/shared/src/clock/clock.test.ts >/dev/null 2>&1; rc=$?
  echo "T9 $(printf '%s' "$out" | jq -r '.t9[0]') $([ "$rc" = 0 ] && echo 1 || echo 0)"
}

# ---- end-to-end runs ------------------------------------------------------------
need_e2e() { need "$1" || return 1; for p in 5173 3000; do [ "$(portbusy $p)" = free ] || { echo "$1 port $p is busy (Blocked)"; return 1; }; done; }
E2E_DONE=""; E2E_RC=""; E2E_SNAP_BEFORE=""; E2E_SNAP_AFTER=""
e2e_run() {
  [ -n "$E2E_DONE" ] && return 0
  need_e2e "$1" || return 1
  dev_ready "$1" || return 1
  E2E_SNAP_BEFORE=$(snap)
  PLAYWRIGHT_JSON_OUTPUT_NAME="$BASE/pw.json" pnenv PLAYWRIGHT_JSON_OUTPUT_NAME="$BASE/pw.json" -- test:e2e --reporter=json > "$BASE/e2e.log" 2>&1; E2E_RC=$?
  E2E_SNAP_AFTER=$(snap)
  E2E_DONE=1
}
pw_passed() { jq -r '[.. | objects | select(has("specs")) | .specs[] | select(.ok == true) | .file] | unique | .[]' "$BASE/pw.json" 2>/dev/null; }
t10() {
  e2e_run T10 || return
  local projects passed
  projects=$(jq -r '[.config.projects[].name] | unique | join(",")' "$BASE/pw.json" 2>/dev/null)
  passed=$(jq -r '[.. | objects | select(has("specs")) | .specs[] | select(.ok == true)] | length' "$BASE/pw.json" 2>/dev/null)
  [ -n "$projects" ] || { echo "T10 the Playwright run produced no result (Blocked): $(grep -m1 -iE 'error|executable' "$BASE/e2e.log" | cut -c1-120)"; return; }
  echo "T10 $E2E_RC $([ "$projects" = chromium ] && echo 1 || echo 0) $passed"
  echo "  playwright projects: $projects"
}
t11() {
  e2e_run T11 || return
  local rc mut=0 src=0
  pw_passed | grep -q 'sample\.spec\.ts' && rc=0 || rc=1
  local s; s=$(doc e2e/sample.spec.ts)
  printf '%s' "$s" | grep -q 'app-root' && printf '%s' "$s" | grep -q 'toHaveText("Toki")' && printf '%s' "$s" | grep -qE 'console' && src=1
  need_e2e T11 || return
  sed -i '' 's/toHaveText("Toki")/toHaveText("Tokx")/' "$WT/e2e/sample.spec.ts"
  pnenv -- exec playwright test e2e/sample.spec.ts >/dev/null 2>&1 || mut=1
  reset_wt
  echo "T11 $rc $mut $src"
}
t12() {
  need T12 || return
  local u=0 e=0 cfg=0
  printf 'import { expect, test } from "vitest";\ntest("zz", () => { expect(1 + 1).toBe(2); });\n' > "$WT/packages/shared/src/zz-new.test.ts"
  printf 'import { expect, test } from "@playwright/test";\ntest("zz", async () => { expect(1).toBe(1); });\n' > "$WT/e2e/zz-new.spec.ts"
  pnenv -- exec vitest run packages/shared/src/zz-new.test.ts > "$BASE/t12u.log" 2>&1 && grep -q 'zz-new.test.ts' "$BASE/t12u.log" && u=1
  pnenv -- exec playwright test --list > "$BASE/t12e.log" 2>&1; grep -q 'zz-new.spec.ts' "$BASE/t12e.log" && e=1
  [ "$(cd "$WT" && git status --porcelain | grep -c .)" = 2 ] && [ -z "$(cd "$WT" && git status --porcelain | grep -E 'config|package.json')" ] && cfg=1
  reset_wt
  echo "T12 $u $e $cfg"
}

# ---- CI rows: the workflow at V and the history of real runs (read-only) --------
YML=$(doc "$WF" | grep -v '^[[:space:]]*#')
job_block() { printf '%s\n' "$YML" | awk -v j="$1" '/^jobs:/{on=1; next} on && /^  [A-Za-z0-9_-]+:[[:space:]]*$/{cur=$0; gsub(/[ :]/,"",cur); inj=(cur==j); next} on && inj {print}'; }
HIST="$BASE/hist.tsv"; HIST_OK=""
history() {
  [ -n "$HIST_OK" ] && return "$([ "$HIST_OK" = 1 ] && echo 0 || echo 1)"
  local epoch id event br conc created missing=0 try f
  epoch=$(git log --format=%ct "$V^1..$V^2" 2>/dev/null | sort -n | head -1)
  [ -n "$epoch" ] || epoch=$(git show -s --format=%ct "$V")
  if [ -n "$CACHE" ] && [ -s "$CACHE/runs.tsv" ]; then cp "$CACHE/runs.tsv" "$BASE/runs.tsv"; else
    gh api --paginate "repos/$REPO/actions/workflows/ci.yml/runs?per_page=100" \
      --jq ".workflow_runs[] | select((.created_at | fromdateiso8601) >= $epoch and .created_at <= \"$HIST_UNTIL\") | [.id, .event, .head_branch, (.conclusion // \"\"), .created_at] | @tsv" > "$BASE/runs.raw" 2>"$BASE/gh.err"
    grep -E '^[0-9]+	' "$BASE/runs.raw" > "$BASE/runs.tsv"
    if [ -s "$BASE/runs.raw" ] && [ ! -s "$BASE/runs.tsv" ]; then head -c 200 "$BASE/runs.raw" > "$BASE/gh.err"; fi
    [ -n "$CACHE" ] && [ -s "$BASE/runs.tsv" ] && cp "$BASE/runs.tsv" "$CACHE/runs.tsv"
  fi
  if [ ! -s "$BASE/runs.tsv" ]; then HIST_OK=0; return 1; fi
  mkdir -p "$BASE/j"; export REPO BASE CACHE
  [ -n "$CACHE" ] && cp "$CACHE"/j/*.tsv "$BASE/j/" 2>/dev/null
  cat > "$BASE/fetch.sh" <<'SH'
#!/usr/bin/env bash
gh api "repos/$REPO/actions/runs/$1/jobs?per_page=100" --jq '.jobs[] | [.name, (.conclusion // ""), ([.steps[] | select(.conclusion == "failure") | .name][0] // ""), .id] | @tsv' 2>/dev/null | grep -E '.+	.*	.*	[0-9]+$' > "$BASE/j/$1.tsv"
SH
  cut -f1 "$BASE/runs.tsv" | while read -r r; do [ -s "$BASE/j/$r.tsv" ] || echo "$r"; done | xargs -n 1 -P 4 bash "$BASE/fetch.sh"
  for f in "$BASE"/j/*.tsv; do [ -f "$f" ] || continue; awk -F'\t' 'NF == 4 && $4 ~ /^[0-9]+$/' "$f" > "$f.ok"; mv "$f.ok" "$f"; done
  while IFS=$'\t' read -r id event br conc created; do
    for try in 1 2 3; do
      [ -s "$BASE/j/$id.tsv" ] && break; sleep 1
      gh api "repos/$REPO/actions/runs/$id/jobs?per_page=100" --jq '.jobs[] | [.name, (.conclusion // ""), ([.steps[] | select(.conclusion == "failure") | .name][0] // ""), .id] | @tsv' 2>/dev/null | grep -E '.+	.*	.*	[0-9]+$' > "$BASE/j/$id.tsv"
    done
    [ -s "$BASE/j/$id.tsv" ] || missing=$((missing + 1))
  done < "$BASE/runs.tsv"
  if [ -n "$CACHE" ]; then for id in $(cut -f1 "$BASE/runs.tsv"); do [ -s "$BASE/j/$id.tsv" ] && [ ! -s "$CACHE/j/$id.tsv" ] && cp "$BASE/j/$id.tsv" "$CACHE/j/$id.tsv"; done; fi
  if [ "$missing" -gt 0 ]; then echo "$missing of $(grep -c . "$BASE/runs.tsv") runs could not be read" > "$BASE/gh.err"; HIST_OK=0; return 1; fi
  : > "$HIST"
  while IFS=$'\t' read -r id event br conc created; do
    [ -f "$BASE/j/$id.tsv" ] || continue
    awk -F'\t' -v a="$id" -v b="$event" -v c="$br" -v d="$conc" -v e="$created" 'BEGIN{OFS="\t"} {print a, b, c, d, e, $1, $2, $3, $4}' "$BASE/j/$id.tsv" >> "$HIST"
  done < "$BASE/runs.tsv"
  HIST_OK=1; return 0
}
need_hist() { history && return 0; echo "$1 the history could not be read: $(head -c 120 "$BASE/gh.err" | tr '\n' ' ') (Blocked)"; return 1; }
joblog() {
  local t out
  [ -n "$CACHE" ] && [ -s "$CACHE/logs/$1.log" ] && { cat "$CACHE/logs/$1.log"; return 0; }
  for t in 1 2 3; do
    out=$(gh api --allow-escape-sequences "repos/$REPO/actions/jobs/$1/logs" 2>/dev/null | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g')
    if [ -n "$out" ] && [[ "${out:0:300}" != *"rate limit"* ]]; then
      [ -n "$CACHE" ] && printf '%s\n' "$out" > "$CACHE/logs/$1.log"
      printf '%s\n' "$out"; return 0
    fi
    sleep 1
  done
  return 1
}
t13() {
  local url=0 runs=0 h=0 j
  job_block tests | grep -E 'TEST_DATABASE_URL:' | grep -qE '/[A-Za-z0-9_]+_test$' && url=1
  job_block tests | grep -qE '^      - run: pnpm test$' && runs=1
  need_hist T13 || return
  for j in $(awk -F'\t' '$2 == "pull_request" && $4 == "success" && $6 == "tests" {print $9}' "$HIST" | head -250); do
    joblog "$j" > "$BASE/job.log"
    grep -qE '✓.*\.db\.test\.ts' "$BASE/job.log" && ! grep -qE 'Tests .*skipped' "$BASE/job.log" && { h=1; break; }
  done
  echo "T13 $url $runs $h"
}
t14() {
  local job=0 h=0
  job_block e2e | grep -qE '^      - run: pnpm test:e2e$' && job=1
  [ "$job" = 0 ] && printf '%s\n' "$YML" | awk '/name: end-to-end/{f=1} f' | grep -qE 'run: pnpm test:e2e' && job=1
  need_hist T14 || return
  [ "$(awk -F'\t' '$6 == "end-to-end" && $7 == "failure" && $8 == "Run pnpm test:e2e" && $4 == "failure" {print $1}' "$HIST" | sort -u | wc -l | tr -d ' ')" -ge 1 ] && h=1
  echo "T14 $job $h"
}
t15() {
  full_run T15 || return
  local a=0 b=0 m1=0 m2=0 f
  pass_lines | grep -qE 'server +src/test/app\.test\.ts|server +.*app\.test\.ts' && a=1
  pass_lines | grep -qE 'server-db +.*migrate\.db\.test\.ts' && b=1
  need T15 || return
  f=$(git ls-tree -r --name-only "$V" -- apps/server | grep -E 'src/test/app\.test\.ts$|test/app\.test\.ts$' | head -1)
  perl -0pi -e 's/toBe\([^)]*\)/toBe("__mutated__")/' "$WT/$f"; ( cd "$WT" && git diff --quiet -- "$f" ) && { echo "T15 the mutation of the TOKI-004 test did not apply (Blocked)"; reset_wt; return; }
  pnenv $(env_test) -- test >/dev/null 2>&1 || m1=1
  reset_wt
  perl -0pi -e 's/toBe\([^)]*\)/toBe("__mutated__")/' "$WT/apps/server/src/db/migrate.db.test.ts"; ( cd "$WT" && git diff --quiet -- apps/server/src/db/migrate.db.test.ts ) && { echo "T15 the mutation of the TOKI-005 test did not apply (Blocked)"; reset_wt; return; }
  pnenv $(env_test) -- test >/dev/null 2>&1 || m2=1
  reset_wt
  echo "T15 $a $b $m1 $m2"
}
t16() {
  full_run T16 || return
  local rows sch calls
  [ "${SNAP_BEFORE%% | *}" = "${SNAP_AFTER%% | *}" ] && rows=1 || rows=0
  [ "${SNAP_BEFORE##* | }" = "${SNAP_AFTER##* | }" ] && sch=1 || sch=0
  calls=$(git grep -lE 'dev:reset:db|reset-db\.sh' "$V" -- 'apps/**/*.test.ts' 'packages/**/*.test.ts' 'apps/**/*.test.tsx' 'packages/**/*.test.tsx' 2>/dev/null | wc -l | tr -d ' ')
  echo "T16 $rows $sch $calls"
}
t17() {
  need_pg_ T17 || return
  dev_ready T17 || return
  local url rc drop=0 create=0 other lines; url=$(dburl toki_qa17_test)
  sql postgres 'drop database if exists toki_qa17_test with (force)' >/dev/null
  mark=$(wc -l < "$BASE/pg.log" | tr -d ' ')
  pnenv NODE_ENV=development DATABASE_URL="$DEVURL" TEST_DATABASE_URL="$url" -- --filter @toki/server exec vitest run --config vitest.db.config.ts >/dev/null 2>&1; rc=$?
  tail -n +"$((mark + 1))" "$BASE/pg.log" | grep -E '^postgres~[^~]*~LOG:  statement:' | grep -v '^postgres~psql~' > "$BASE/stm.txt"
  grep -qiE 'statement: drop database if exists "toki_qa17_test" with \(force\)' "$BASE/stm.txt" && drop=1
  grep -qiE 'statement: create database "toki_qa17_test"' "$BASE/stm.txt" && create=1
  other=$(grep -viE 'statement: (drop database if exists "toki_qa17_test" with \(force\)|create database "toki_qa17_test")' "$BASE/stm.txt" | grep -c .)
  echo "T17 $drop $create $other $([ "$rc" = 0 ] && echo 1 || echo 0)"
}
t18() {
  need_pg_ T18 || return
  dev_ready T18 || return
  local name dev=0 tst=0
  cat > "$WT/apps/server/test/zz-name.db.test.ts" <<'TS'
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { createDb } from "../src/db/client.js";
it("reports the database the application's client reaches", async () => {
  const { db, close } = createDb(loadConfig(process.env, ["database"]).database.url);
  const rows = await db.execute<{ name: string }>("select current_database() as name");
  writeFileSync(process.env.QA_OUT as string, rows[0]!.name);
  await close();
  expect(rows.length).toBe(1);
});
TS
  pnenv $(env_test) QA_OUT="$BASE/name.txt" -- --filter @toki/server exec vitest run --config vitest.db.config.ts test/zz-name.db.test.ts >/dev/null 2>&1
  name=$(cat "$BASE/name.txt" 2>/dev/null)
  [ "$name" = "$TESTDB" ] && tst=1; [ "$name" = "$DEV" ] && dev=1
  reset_wt
  echo "T18 $tst $dev"
}
t19() {
  need T19 || return
  local a b rc
  a=$(git grep -lE 'Date\.now\(|new Date\(\)' "$V" -- apps/server/src packages/client-core/src ':!*.test.ts' ':!*.test.tsx' 2>/dev/null | wc -l | tr -d ' ')
  b=$(git grep -lE 'Date\.now\(' "$V" -- packages/shared/src ':!*.test.ts' ':!*.test.tsx' 2>/dev/null | sed "s#^$V:##" | tr '\n' ' ' | sed 's/ $//')
  ( cd "$WT" && bash scripts/check-clock-use.sh >/dev/null 2>&1 ); rc=$?
  echo "T19 $a $(printf '%s' "$b" | wc -w | tr -d ' ') $rc"
  echo "  files with Date.now( in packages/shared/src outside tests: $b"
}
t20() {
  full_run T20 || return
  local rc inc=0 exc=0 sc=0
  pg_stop
  pnenv $(env_test) -- --filter ./apps/server test:unit >/dev/null 2>&1; rc=$?
  pg_start
  doc apps/server/vitest.db.config.ts | grep -E 'include:' | grep -q 'db\.test\.ts' && ! doc apps/server/vitest.db.config.ts | grep -E 'include:' | grep -qvE 'db\.test\.ts' && inc=1
  doc apps/server/vitest.config.ts | grep -E 'exclude:' | grep -q 'db\.test\.ts' && exc=1
  [ "$(doc apps/server/package.json | jq -r '.scripts | has("test") and has("test:unit")')" = true ] && sc=1
  echo "T20 $rc $inc $exc $sc"
}
t21() {
  local doc_n steps=0 only=1 line
  doc_n=$(git grep -l 'playwright install --with-deps chromium' "$V" -- . ':!docs/plans' ':!docs/specs' ':!docs/qa' 2>/dev/null | wc -l | tr -d ' ')
  local blk; blk=$(printf '%s\n' "$YML" | awk '/name: end-to-end/{f=1} f')
  inst=$(printf '%s\n' "$blk" | grep -nE 'run: pnpm exec playwright install' | head -1 | cut -d: -f1); tst=$(printf '%s\n' "$blk" | grep -nE 'run: pnpm test:e2e' | head -1 | cut -d: -f1)
  [ -n "$inst" ] && [ -n "$tst" ] && [ "$inst" -lt "$tst" ] && steps=1
  printf '%s\n' "$YML" | grep -E 'playwright install' | grep -qiE 'firefox|webkit' && only=0
  printf '%s\n' "$YML" | grep -E 'playwright install' | grep -q 'chromium' || only=0
  echo "T21 $([ "$doc_n" -ge 1 ] && echo 1 || echo 0) $steps $only"
}
t22() {
  e2e_run T22 || return
  local seeds hits same=0
  seeds=$(git ls-tree -r --name-only "$V" -- e2e | while read -r f; do doc "$f" | grep -ciE 'seed' ; done | awk '{s += $1} END {print s + 0}')
  hits=$({ doc playwright.config.ts; git ls-tree -r --name-only "$V" -- e2e | while read -r f; do doc "$f"; done; } | grep -cE 'dev:seed|dev:reset:db')
  [ "${E2E_SNAP_BEFORE}" = "${E2E_SNAP_AFTER}" ] && same=1
  echo "T22 $seeds $hits $same (no seeded flow exists at the Version, so the create, seed and drop behavior is not exercised) (Blocked)"
}
t23() {
  e2e_run T23 || return
  local src=0 pass=0 mut=0
  doc e2e/proxy.spec.ts | grep -q '/healthz' && doc e2e/proxy.spec.ts | grep -q '/api/v1' && doc e2e/proxy.spec.ts | grep -qE 'toEqual\(\{ status: "ok" \}\)' && src=1
  pw_passed | grep -q 'proxy\.spec\.ts' && pass=1
  need_e2e T23 || return
  perl -0pi -e 's/env: \{ SERVER_PORT: String\(SERVER_PORT\) \}/env: { SERVER_PORT: "3999" }/' "$WT/playwright.config.ts"
  ( cd "$WT" && git diff --quiet -- playwright.config.ts ) && { echo "T23 the mutation did not apply (Blocked)"; reset_wt; return; }
  pnenv -- test:e2e >/dev/null 2>&1 || mut=1
  reset_wt
  echo "T23 $src $pass $mut"
}

rows="${*:-T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12 T13 T14 T15 T16 T17 T18 T19 T20 T21 T22 T23}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
[ "$HIST_OK" = 1 ] && echo "HISTORY runs $(grep -c . "$BASE/runs.tsv") jobs $(grep -c . "$HIST") from $(git log --format=%cs "$V^1..$V^2" 2>/dev/null | tail -1) until $HIST_UNTIL"
alive=0
pgport="$PGPORT"
cleanup; WT=""
pgleft=0; [ -n "$pgport" ] && [ "$(portbusy "$pgport")" = busy ] && pgleft=1
for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
echo "CLEAN worktrees $([ "$(git worktree list | wc -l | tr -d ' ')" = "$before_wt" ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive postgres-left $pgleft temporary-folder $([ -e "$BASE" ] && echo left || echo removed)"
