#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-005.md. No network except the package registry through
# `pnpm install --frozen-lockfile` and connections to a PostgreSQL on 127.0.0.1; no model.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-005.checks.sh [T1 T2 ...]
# It reads files of the commit V with `git show`. Rows that run the code use a temporary worktree
# of V and a temporary PostgreSQL cluster made with `initdb` (user qa, trust authentication, no
# unix socket, a free loopback port); both are removed when the script ends, even when a row
# fails, and so are the processes it started. The development database and the Docker services
# are not touched, and the repository itself is not changed. Every temporary file lives under one
# folder made in the current shell (BASE, exported as TMPDIR and given to the processes it starts),
# which the cleanup removes. No `.env` file is read or created. It prints one line for each row:
# counts, exit codes, type names and words; the only password is a made-up one in row T14, and the
# row checks that it is absent from the output.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
doc() { git show "$V:$1" 2>/dev/null; }

BASE=$(mktemp -d); export TMPDIR="$BASE"
before_wt=$(git worktree list | wc -l | tr -d ' ')
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; TMPS=""; PIDS=""; PGBIN=""; PGPORT=""; PGDATA=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; }
cleanup() {
  local p d
  for p in $PIDS; do kill_tree "$p"; done
  [ -n "$PGPORT" ] && "$PGBIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1
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
# pn <env assignments...> -- <pnpm args...>: runs pnpm in the worktree with only those variables
pnenv() { local envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift; ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" ${envs[@]+"${envs[@]}"} corepack pnpm "$@" ); }
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
reset_wt() { ( cd "$WT" && git checkout -q -- . && git clean -fdq ); }
freeport() { nodebin -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }

# ---- the temporary PostgreSQL ------------------------------------------------
pg_ready() {
  [ -n "$PGPORT" ] && return 0
  local bin; bin=$(dirname "$(command -v initdb 2>/dev/null)")
  [ -x "$bin/initdb" ] || return 1
  PGBIN="$bin"; PGDATA="$BASE/pg"; PGPORT=$(freeport)
  "$PGBIN/initdb" -D "$PGDATA" -U qa -A trust -E UTF8 --no-locale >/dev/null 2>&1 || { PGPORT=""; return 1; }
  "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=" -l "$BASE/pg.log" -w start >/dev/null 2>&1 || { PGPORT=""; return 1; }
  return 0
}
need_pg() { need "$1" || return 1; pg_ready && return 0; echo "$1 could not start a temporary PostgreSQL (Blocked)"; return 1; }
sql() { "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U qa -d "$1" -At -c "$2" 2>&1; }
DBN=0
newdb() { DBN=$((DBN + 1)); NDB="qa_db_$DBN"; sql postgres "create database $NDB" >/dev/null; }
dburl() { echo "postgres://qa@127.0.0.1:$PGPORT/$1"; }
has_workspaces() { [ "$(sql "$1" "select count(*) from pg_class where relname = 'workspaces' and relkind = 'r'")" = 1 ] && echo 1 || echo 0; }

# ---- the harness -------------------------------------------------------------
write_harness() { cat > "$1" <<'TS'
import { mkdirSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { uuidv7 } from "uuidv7";
import { loadConfig } from "./src/config.js";
import { createDb } from "./src/db/client.js";
import { migrationsFolder, runMigrations } from "./src/db/migrate.js";
import { workspaces } from "./src/modules/workspace/schema.js";
const base = process.env.QA_PG as string;            // postgres://qa@127.0.0.1:PORT
const dead = process.env.QA_DEAD as string;          // a loopback port where nothing listens
const tmp = process.env.QA_TMP as string;
const out: Record<string, unknown> = {};
const raw = (db: string) => postgres(`${base}/${db}`, { max: 1, onnotice: () => {} });
async function admin(q: string) { const a = raw("postgres"); try { await a.unsafe(q); } finally { await a.end(); } }
async function fresh(name: string) { await admin(`create database ${name}`); return `${base}/${name}`; }
const msgs = (e: any) => { const o: string[] = []; for (let x = e; x instanceof Error; x = (x as any).cause) o.push(x.message + " " + ((x as any).code ?? "")); return o.join(" | "); };

// T1: a client from the value of the configuration module, select 1
try {
  const url = await fresh("h1");
  const { database } = loadConfig({ DATABASE_URL: url }, ["database"]);
  const { db, close } = createDb(database.url);
  const rows: any = await db.execute("select 1 as one"); out.t1 = rows[0]?.one; await close();
} catch (e) { out.t1 = ["error"]; }
// T4: two migrations, the second depends on the first, apply in order
try {
  const url = await fresh("h4"); const folder = join(tmp, "two"); mkdirSync(folder, { recursive: true });
  cpSync(migrationsFolder, folder, { recursive: true });
  const j = JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8"));
  const first = j.entries[j.entries.length - 1];
  j.entries.push({ ...first, idx: first.idx + 1, when: first.when + 1000, tag: "0001_second" });
  writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(j));
  writeFileSync(join(folder, "0001_second.sql"), `CREATE TABLE "second" ("id" uuid PRIMARY KEY, "ws" uuid NOT NULL REFERENCES "workspaces"("id"));`);
  let ok = 1; try { await runMigrations(url, folder); } catch { ok = 0; }
  const c = raw("h4"); const r = await c`select count(*)::int as n from drizzle.__drizzle_migrations`; const t = await c`select count(*)::int as n from pg_class where relname in ('workspaces','second') and relkind = 'r'`; await c.end();
  out.t4 = ok && r[0].n === 2 && t[0].n === 2 ? 1 : 0;
} catch (e) { out.t4 = ["error"]; }
// T7: one valid and one broken migration: the run rejects, the Postgres error text is in the output,
// and the table of the valid migration does not exist afterwards
try {
  const url = await fresh("h7"); const folder = join(tmp, "broken"); mkdirSync(folder, { recursive: true });
  cpSync(migrationsFolder, folder, { recursive: true });
  const j = JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8"));
  const first = j.entries[j.entries.length - 1];
  j.entries.push({ ...first, idx: first.idx + 1, when: first.when + 1000, tag: "0001_broken" });
  writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(j));
  writeFileSync(join(folder, "0001_broken.sql"), `CREAT TABLE broken (id int);`);
  let rejected = 0, text = ""; try { await runMigrations(url, folder); } catch (e) { rejected = 1; text = msgs(e); }
  const c = raw("h7"); const t = await c`select count(*)::int as n from pg_class where relname = 'workspaces' and relkind = 'r'`; await c.end();
  out.t7 = [rejected, /syntax error/i.test(text) ? 1 : 0, t[0].n];
} catch (e) { out.t7 = ["error"]; }
// T8, T9, T15: the table, after the real migrations
try {
  const url = await fresh("h8"); await runMigrations(url, migrationsFolder);
  const { db, close } = createDb(url); const c = raw("h8");
  const ins: any = await db.insert(workspaces).values({ name: "a" }).returning({ id: workspaces.id });
  const id: string = ins[0].id;
  const type = (await c`select data_type from information_schema.columns where table_name = 'workspaces' and column_name = 'id'`)[0].data_type;
  const pk = (await c`select count(*)::int as n from information_schema.key_column_usage k join information_schema.table_constraints t on k.constraint_name = t.constraint_name where t.constraint_type = 'PRIMARY KEY' and k.table_name = 'workspaces' and k.column_name = 'id'`)[0].n;
  out.t8 = [type, pk, id.replace(/-/g, "")[12]];
  const attempt = async (name: string | null, withName: boolean) => { try { if (withName) await c`insert into workspaces (id, name) values (${uuidv7()}, ${name})`; else await c`insert into workspaces (id) values (${uuidv7()})`; return ""; } catch (e: any) { return String(e.message); } };
  const a = await attempt(null, false), b = await attempt("", true), cc = await attempt("x".repeat(101), true), d = await attempt("y".repeat(100), true);
  out.t9 = [/"name"/.test(a) && /not-null/i.test(a) ? 1 : 0, /workspaces_name_length/.test(b) ? 1 : 0, /workspaces_name_length/.test(cc) ? 1 : 0, d === "" ? 1 : 0];
  // T15: the second row was stored with the first
  const cols = await c`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_name = 'workspaces' order by ordinal_position`;
  const created: any = cols.find((x: any) => x.column_name === "created_at");
  const close5 = (await c`select (extract(epoch from (now() - created_at)) < 5 and extract(epoch from (now() - created_at)) > -5) as ok from workspaces where name = 'a'`)[0].ok;
  await db.insert(workspaces).values({ name: "second" });
  const rows = (await c`select count(*)::int as n from workspaces where name in ('a','second')`)[0].n;
  const cons = (await c`select string_agg(conname, ',' order by conname) as s from pg_constraint where conrelid = 'workspaces'::regclass`)[0].s;
  out.t15 = [
    created.data_type === "timestamp with time zone" ? 1 : 0,
    created.is_nullable === "NO" && /now\(\)/.test(String(created.column_default)) ? 1 : 0,
    close5 ? 1 : 0,
    rows === 2 ? 1 : 0,
    cols.map((x: any) => x.column_name).join(",") === "id,name,created_at" ? 1 : 0,
    cons === "workspaces_name_length,workspaces_pkey" ? 1 : 0,
  ];
  await c.end(); await close();
} catch (e) { out.t8 = ["error"]; out.t9 = ["error"]; out.t15 = ["error"]; }
// T16: a client on a loopback port where nothing listens
{
  let built = 1; let rejects = 0;
  try { const { db, close } = createDb(`postgres://u:p@127.0.0.1:${dead}/x`); try { await db.execute("select 1"); } catch { rejects = 1; } await close(); } catch { built = 0; }
  out.t16 = [built, rejects];
}
console.log(JSON.stringify(out));

TS
}
HARNESS_OUT=""
harness() {
  [ -n "$HARNESS_OUT" ] && return 0
  [ -f "$WT/apps/server/zz-harness.ts" ] || write_harness "$WT/apps/server/zz-harness.ts"
  local dead; dead=$(freeport)
  mkdir -p "$BASE/harness"
  HARNESS_OUT=$( cd "$WT/apps/server" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" QA_PG="postgres://qa@127.0.0.1:$PGPORT" QA_DEAD="$dead" QA_TMP="$BASE/harness" node --import tsx zz-harness.ts 2>"$BASE/harness.err" | tail -1 )
  [ -n "$HARNESS_OUT" ]
}
hval() { printf '%s' "$HARNESS_OUT" | jq -r "$1"; }
hrow() { # $1 row id, $2 jq path
  need_pg "$1" || return
  harness || { echo "$1 the harness did not run: $(head -c 200 "$BASE/harness.err" | tr '\n' ' ') (Blocked)"; return; }
  echo "$1 $(hval "$2")"
}

# ---- rows --------------------------------------------------------------------
t1() {
  need_pg T1 || return
  harness || { echo "T1 the harness did not run (Blocked)"; return; }
  local one files
  one=$(hval '.t1')
  # the test files that read the development value from the environment
  files=$(git grep -l 'process\.env\.DATABASE_URL' "$V" -- apps/server 2>/dev/null | grep -c '\.test\.ts$')
  echo "T1 $one $files"
}
t2() {
  need T2 || return
  local d rc out; d="$BASE/t2"; mkdir -p "$d"
  out=$( cd "$WT/apps/server" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" NODE_ENV=development node --import tsx src/main.ts 2>&1 ); rc=$?
  echo "T2 $([ "$rc" != 0 ] && echo 1 || echo 0) $(printf '%s' "$out" | grep -q 'DATABASE_URL' && echo 1 || echo 0)"
}
t3() {
  need T3 || return
  local sqlf snap jour n
  perl -0pi -e 's/name: text\("name"\)\.notNull\(\),/name: text("name").notNull(),\n    note: text("note"),/' "$WT/apps/server/src/modules/workspace/schema.ts"
  pnenv -- --filter @toki/server run db:generate >/dev/null 2>&1
  n=$(cd "$WT" && git status --porcelain -- apps/server/migrations | wc -l | tr -d ' ')
  sqlf=$(cd "$WT" && git status --porcelain -- apps/server/migrations | grep -cE '^\?\? .*migrations/0001_[^/]*\.sql$')
  snap=$(cd "$WT" && git status --porcelain -- apps/server/migrations | grep -cE '^\?\? .*meta/0001_snapshot\.json$')
  jour=$(cd "$WT" && git status --porcelain -- apps/server/migrations | grep -cE '^ ?M .*meta/_journal\.json$')
  reset_wt
  echo "T3 $sqlf $snap $jour $n"
}
t4() {
  need_pg T4 || return
  harness || { echo "T4 the harness did not run (Blocked)"; return; }
  local rc
  newdb; pnenv DATABASE_URL="$(dburl "$NDB")" -- --filter @toki/server run db:migrate >/dev/null 2>&1; rc=$?
  echo "T4 $rc $(has_workspaces "$NDB") $(hval '.t4')"
}
schema_hash() { sql "$1" "select md5(string_agg(table_name || '.' || column_name || ':' || data_type || ':' || is_nullable, ',' order by table_name, ordinal_position)) from information_schema.columns where table_schema = 'public'; "; }
t5() {
  need_pg T5 || return
  local rc h1 h2 m1 m2
  newdb
  pnenv DATABASE_URL="$(dburl "$NDB")" -- --filter @toki/server run db:migrate >/dev/null 2>&1
  h1=$(schema_hash "$NDB"); m1=$(sql "$NDB" "select count(*) from drizzle.__drizzle_migrations")
  pnenv DATABASE_URL="$(dburl "$NDB")" -- --filter @toki/server run db:migrate >/dev/null 2>&1; rc=$?
  h2=$(schema_hash "$NDB"); m2=$(sql "$NDB" "select count(*) from drizzle.__drizzle_migrations")
  echo "T5 $rc $([ -n "$h1" ] && [ "$h1" = "$h2" ] && echo 1 || echo 0) $([ -n "$m1" ] && [ "$m1" = "$m2" ] && echo 1 || echo 0)"
}
t6() {
  need_pg T6 || return
  local rc
  newdb; pnenv DATABASE_URL="$(dburl "$NDB")" -- run db:migrate >/dev/null 2>&1; rc=$?
  echo "T6 $rc $(has_workspaces "$NDB")"
}
t7() { hrow T7 '.t7 | join(" ")'; }
t8() { hrow T8 '.t8 | join(" ")'; }
t9() { hrow T9 '.t9 | join(" ")'; }
t10() {
  local files hits=0 f rows=0 withval=0 line
  files=$(git diff --name-only "$V^1" "$V" 2>/dev/null)
  [ -n "$files" ] || { echo "T10 the diff of $V could not be measured (Blocked)"; return; }
  for f in $files; do hits=$((hits + $(doc "$f" | grep -cE 'postgres(ql)?://[^[:space:]/:@]+:[^[:space:]@]+@'))); done
  while IFS= read -r line; do [ -n "$line" ] || continue; rows=$((rows + 1)); [ -n "${line#*=}" ] && withval=$((withval + 1)); done <<< "$(doc .env.example | grep -E '^(DATABASE_URL|TEST_DATABASE_URL)=')"
  echo "T10 $hits $rows $withval"
}
t11() {
  local r steps=0 roll=0 p
  r=$(doc apps/server/src/db/README.md | tr '\n' ' ' | tr -s ' ')
  [ -n "$r" ] || { echo "T11 0 0 0"; return; }
  for p in 'table definition' 'db:generate' 'db:migrate' 'Commit the whole'; do printf '%s' "$r" | grep -qiF -- "$p" && steps=$((steps + 1)); done
  for p in 'forward-only' 'down migration' 'previous release' 'previous image tag' 'database backup' 'new migration'; do printf '%s' "$r" | grep -qiF -- "$p" && roll=$((roll + 1)); done
  echo "T11 1 $steps $roll"
}
t12() { echo "T12 manual: wipes the development database, so the QA runs it by hand (Blocked until then)"; }
t13() {
  need_pg T13 || return
  local dev srv rc1 rc2 rc3 rc4 marker left m3=0 m4=0 o3 o4 psrv
  newdb; dev="$NDB"; sql "$dev" "create table marker(x int); insert into marker values (1)" >/dev/null
  srv="postgres://qa@127.0.0.1:$PGPORT/postgres"
  run() { ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" DATABASE_URL="$(dburl "$dev")" "$@" corepack pnpm --filter @toki/server test ) 2>&1; }
  run TEST_DATABASE_URL="$srv" >"$BASE/t13a" 2>&1; rc1=$?
  run TEST_DATABASE_URL="$srv" >"$BASE/t13b" 2>&1; rc2=$?
  marker=$(sql "$dev" "select count(*) from marker")
  left=$(sql postgres "select count(*) from pg_database where datname like 'toki_test_%'")
  run TEST_DATABASE_URL="postgres://qa@192.0.2.1:5432/postgres" >"$BASE/t13c" 2>&1; rc3=$?
  grep -q 'not a loopback address' "$BASE/t13c" && m3=1
  ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" DATABASE_URL="$(dburl "$dev")" corepack pnpm --filter @toki/server test ) >"$BASE/t13d" 2>&1; rc4=$?
  grep -q 'TEST_DATABASE_URL is not set' "$BASE/t13d" && m4=1
  echo "T13 $rc1 $rc2 $marker $left $([ "$rc3" != 0 ] && echo 1 || echo 0) $m3 $([ "$rc4" != 0 ] && [ "$m4" = 1 ] && echo 1 || echo 0)"
}
t14() {
  need T14 || return
  local o1 o2 rc1 rc2 dead leak
  o1=$(pnenv -- --filter @toki/server run db:migrate 2>&1); rc1=$?
  dead=$(freeport)
  o2=$(pnenv DATABASE_URL="postgres://qa:SECRETPW@127.0.0.1:$dead/qadb" -- --filter @toki/server run db:migrate 2>&1); rc2=$?
  leak=$(printf '%s\n' "$o2" | grep -ciE 'SECRETPW|postgres://')
  echo "T14 $([ "$rc1" != 0 ] && echo 1 || echo 0) $(printf '%s' "$o1" | grep -q 'DATABASE_URL' && echo 1 || echo 0) $([ "$rc2" != 0 ] && echo 1 || echo 0) $(printf '%s' "$o2" | grep -q "cannot be reached at 127.0.0.1:$dead/qadb" && echo 1 || echo 0) $leak"
}
t15() { hrow T15 '.t15 | join(" ")'; }
t16() {
  need_pg T16 || return
  harness || { echo "T16 the harness did not run (Blocked)"; return; }
  local dead out pid alive=0 code
  dead=$(freeport)
  ( cd "$WT/apps/server" && exec env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" NODE_ENV=development SERVER_PORT="$(freeport)" DATABASE_URL="postgres://u:p@127.0.0.1:$dead/x" node --import tsx src/main.ts ) >"$BASE/t16o" 2>&1 &
  pid=$!; PIDS="$PIDS $pid"
  local port i; port=""
  for i in $(seq 1 100); do port=$(grep -o 'listening at http://127.0.0.1:[0-9]*' "$BASE/t16o" | head -1 | sed 's/.*://'); [ -n "$port" ] && break; kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done
  sleep 1
  kill -0 "$pid" 2>/dev/null && alive=1
  code=$([ -n "$port" ] && curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:$port/healthz" 2>/dev/null || echo 0)
  kill_tree "$pid"; wait "$pid" 2>/dev/null
  echo "T16 $(hval '.t16 | join(" ")') $alive $code"
}

rows="${*:-T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12 T13 T14 T15 T16}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
alive=0; for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
pgleft=0
cleanup; WT=""; TMPS=""
for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done; PIDS=""
[ -n "$PGPORT" ] && [ "$(nodebin -e 'const s=require("net").connect(Number(process.argv[1]),"127.0.0.1");s.on("connect",()=>{console.log("busy");process.exit(0)});s.on("error",()=>{console.log("free");process.exit(0)})' "$PGPORT")" = busy ] && pgleft=$((pgleft + 1))
echo "CLEAN worktrees $([ "$(git worktree list | wc -l | tr -d ' ')" = "$before_wt" ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive postgres-left $pgleft temporary-folder $([ -e "$BASE" ] && echo left || echo removed)"
