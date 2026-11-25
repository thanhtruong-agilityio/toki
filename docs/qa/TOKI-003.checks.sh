#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-003.md. No model, no network. Usage (from the repository root):
#   V=<commit> bash docs/qa/TOKI-003.checks.sh [T1 T2 ...]
# It reads the files of the commit V (the delivery of TOKI-003) in a temporary worktree outside the
# repository. Two groups of rows:
#   static: read the files and run `docker compose config` with made-up values in a clean environment.
#           No service starts, no `.env` is read or created. Claude may run these.
#   stack:  start the real Compose project `toki-dev`, write marker data, run the dev scripts and the
#           resets, which WIPE the development data of that project (decided in concern 3 of the QA spec).
#           They need a root `.env`, so the script writes one only inside its temporary worktree, from
#           made-up values and a random password that is never printed, and removes it with the worktree.
#           They run only with QA_STACK=1, in the Dev's own Terminal panel; Claude never reads that file.
# Each row prints one line: counts, exit codes and words. No password, no `.env` value, no log text.
# Everything temporary lives under one folder made in the current shell (BASE, exported as TMPDIR).
# At the end the script stops the stack (volumes stay) and prints a CLEAN line.
set -uo pipefail
V="${V:-HEAD}"
QA_STACK="${QA_STACK:-0}"
BASE=$(mktemp -d); export TMPDIR="$BASE"
before_wt=$(git worktree list | wc -l | tr -d ' ')
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; STACK_USED=0; LPIDS=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; }
cleanup() {
  local p alive=0 running="" wt_after st_after folder="removed"
  for p in $LPIDS; do kill_tree "$p"; done
  if [ "$STACK_USED" = 1 ] && [ -n "$WT" ] && [ -f "$WT/.env" ]; then c down >/dev/null 2>&1; fi
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
  rm -rf "$BASE"; git worktree prune >/dev/null 2>&1
  [ -d "$BASE" ] && folder="left"
  wt_after=$(git worktree list | wc -l | tr -d ' ')
  st_after=$(git status --porcelain | shasum | cut -d' ' -f1)
  if [ "$STACK_USED" = 1 ]; then running=" toki-dev-running $(docker ps -q --filter label=com.docker.compose.project=toki-dev 2>/dev/null | wc -l | tr -d ' ')"; fi
  for p in $LPIDS; do kill -0 "$p" >/dev/null 2>&1 && alive=$((alive+1)); done
  echo "CLEAN worktrees $([ "$wt_after" = "$before_wt" ] && echo same || echo changed) status $([ "$st_after" = "$before_status" ] && echo same || echo changed) processes $alive$running temporary-folder $folder"
}
trap cleanup EXIT

mkwt() {
  [ -n "$WT" ] && return 0
  mkdir -p "$BASE/wt0"; git worktree add --detach "$BASE/wt0/wt" "$V" >/dev/null 2>&1 || return 1
  WT="$BASE/wt0/wt"
}
doc() { git show "$V:$1" 2>/dev/null; }

# ---------------------------------------------------------------- static helpers
# cfg: docker compose config over the compose file of the worktree, with made-up values and nothing else
cfg() { ( cd "$WT" && env -i PATH="$PATH" HOME="$HOME" TMPDIR="$BASE" POSTGRES_USER=qa POSTGRES_PASSWORD=qa POSTGRES_DB=qa POSTGRES_PORT=1 MINIO_ROOT_USER=qa MINIO_ROOT_PASSWORD=qa MINIO_PORT=2 MINIO_CONSOLE_PORT=3 MAILPIT_SMTP_PORT=4 MAILPIT_WEB_PORT=5 docker compose -f docker-compose.dev.yml "$@" 2>/dev/null ); }
CF="docker-compose.dev.yml"
interp() { grep -o '\${[^}]*}' "$1" | grep -v '^\$\$' ; }          # interpolations, not the escaped $${...}
real_interp() { sed 's/\$\$//g' "$1" | grep -o '\${[^}]*}'; }       # drop $$ first, then list ${...}

# ---------------------------------------------------------------- stack helpers
QU=qauser; DB=qa_dev; TESTDB=qa_test; BUCKET=qa-files
STACK_OK=""
stack_ready() {
  [ -n "$STACK_OK" ] && return "$([ "$STACK_OK" = yes ] && echo 0 || echo 1)"
  STACK_OK=no
  [ "$QA_STACK" = 1 ] || { STACK_WHY="the stack group runs only with QA_STACK=1"; return 1; }
  docker info >/dev/null 2>&1 || { STACK_WHY="Docker is not running"; return 1; }
  docker image inspect toki-dev-minio:RELEASE.2025-10-15T17-29-55Z >/dev/null 2>&1 || { STACK_WHY="the MinIO image is not built here"; return 1; }
  mkwt || { STACK_WHY="no worktree"; return 1; }
  local ports; ports=$(python3 - <<'P'
import socket
s=[];o=[]
for _ in range(5):
    k=socket.socket(); k.bind(("127.0.0.1",0)); s.append(k); o.append(str(k.getsockname()[1]))
print(" ".join(o))
P
)
  set -- $ports; PG=$1; MN=$2; MC=$3; MP_SMTP=$4; MP_WEB=$5
  local pw; pw=$(openssl rand -hex 12)
  ( umask 077; cat > "$WT/.env" <<E
NODE_ENV=development
POSTGRES_USER=$QU
POSTGRES_PASSWORD=$pw
POSTGRES_DB=$DB
POSTGRES_TEST_DB=$TESTDB
POSTGRES_PORT=$PG
MINIO_ROOT_USER=$QU
MINIO_ROOT_PASSWORD=$pw
MINIO_PORT=$MN
MINIO_CONSOLE_PORT=$MC
MINIO_BUCKET=$BUCKET
MAILPIT_SMTP_PORT=$MP_SMTP
MAILPIT_WEB_PORT=$MP_WEB
E
  )
  cp "$WT/.env" "$BASE/env.orig"
  STACK_USED=1; STACK_OK=yes
  echo "STACK before: toki-dev containers $(docker ps -a -q --filter label=com.docker.compose.project=toki-dev | wc -l | tr -d ' ') volumes $(docker volume ls -q --filter label=com.docker.compose.project=toki-dev | wc -l | tr -d ' ') (names and counts only; the data is not read)"
  # start from empty volumes: the volumes of the project hold another stack's data and users (concern 3)
  c down -v >/dev/null 2>&1
  echo "STACK volumes removed: toki-dev volumes now $(docker volume ls -q --filter label=com.docker.compose.project=toki-dev | wc -l | tr -d ' ')"
  return 0
}
c() { ( cd "$WT" && env -i PATH="$PATH" HOME="$HOME" TMPDIR="$BASE" docker compose -p toki-dev --env-file .env -f docker-compose.dev.yml "$@" ); }
# scr <script> [args]: run a dev script in the worktree; X holds extra NAME=value words for its environment
X=""
scr() { local s="$1"; shift; ( cd "$WT" && env -i PATH="$PATH" HOME="$HOME" TMPDIR="$BASE" $X bash "scripts/$s" "$@" ); }
psq() { c exec -T postgres sh -c 'psql -X -q -t -A -U "$POSTGRES_USER" -d "$1" -c "$2"' sh "$1" "$2" 2>/dev/null; }
mcx() { local s="$1"; shift; c exec -T minio sh -c 'mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1 || exit 90; '"$s" sh "$@" 2>/dev/null; }
mail_total() { curl -s --max-time 10 "http://127.0.0.1:$MP_WEB/api/v1/messages" | python3 -c 'import sys,json;print(json.load(sys.stdin)["total"])' 2>/dev/null || echo -1; }
mail_clear() { curl -s --max-time 10 -X DELETE "http://127.0.0.1:$MP_WEB/api/v1/messages" >/dev/null 2>&1; }
send_mail() { python3 - "$MP_SMTP" <<'P'
import smtplib,sys
from email.message import EmailMessage
m=EmailMessage(); m["From"]="qa@example.invalid"; m["To"]="someone@example.invalid"; m["Subject"]="qa marker"; m.set_content("qa")
s=smtplib.SMTP("127.0.0.1",int(sys.argv[1]),timeout=10); s.send_message(m); s.quit()
P
}
mark() { psq "$DB" "create table if not exists marker(id int); insert into marker values (1);" >/dev/null; mcx 'echo qa | mc pipe "local/$1/qa.txt" >/dev/null' "$BUCKET"; send_mail; }
nrow() { local r; r=$(psq "$DB" "select count(*) from marker") || r=""; echo "${r:-0}"; }
nfile() { mcx 'mc ls "local/$1" | wc -l' "$BUCKET" | tr -d ' '; }
ntable() { psq "$DB" "select count(*) from information_schema.tables where table_schema='public'" | tr -d ' '; }
marks_ok() { [ "$(nrow)" = 1 ] && [ "$(nfile)" = 1 ] && [ "$(mail_total)" = 1 ]; }
prep() {
  scr up.sh >/dev/null 2>&1 || return 1
  psq "$DB" "drop table if exists marker" >/dev/null
  mcx 'mc rm --recursive --force "local/$1" >/dev/null 2>&1; mc mb --ignore-existing "local/$1" >/dev/null' "$BUCKET"
  mail_clear; mark
}
mktest() { psq postgres "drop database if exists $TESTDB with (force)" >/dev/null; psq postgres "create database $TESTDB" >/dev/null; psq "$TESTDB" "create table marker(id int); insert into marker values (1)" >/dev/null; }
ntest() { local r; r=$(psq "$TESTDB" "select count(*) from marker") || r=""; echo "${r:-0}"; }
envset() { perl -0pi -e "s/^$1=.*\n//m" "$WT/.env"; printf '%s=%s\n' "$1" "$2" >> "$WT/.env"; }
envdel() { perl -0pi -e "s/^$1=.*\n//m" "$WT/.env"; }
envreset() { cp "$BASE/env.orig" "$WT/.env"; }
b() { [ "$1" = 0 ] && echo 1 || echo 0; }   # exit code -> 1 when it was 0
nz() { [ "$1" != 0 ] && echo 1 || echo 0; } # exit code -> 1 when it was non-zero

# ---------------------------------------------------------------- rows
t1() { mkwt || { echo "T1 no worktree (Blocked)"; return; }
  local n names tag; n=$(cfg config --services | wc -l | tr -d ' '); names=$(cfg config --services | sort | tr '\n' ' ')
  tag=$(cfg config --images | grep '^postgres:' | sed 's/^postgres://')
  echo "T1 $n $([ "$names" = "mailpit minio postgres " ] && echo 1 || echo 0) $([[ "$tag" == 17* ]] && echo 1 || echo 0)"; }
t14() { mkwt || return; local f="$WT/$CF" real mut
  real=$(grep -ciE 'relay|MP_SMTP|smtp_host' "$f"); cp "$f" "$BASE/mut.yml"; echo "      MP_SMTP_RELAY_HOST: x" >> "$BASE/mut.yml"; mut=$(grep -ciE 'relay|MP_SMTP|smtp_host' "$BASE/mut.yml")
  echo "T14 $real $([ "$mut" -ge 1 ] && echo 1 || echo 0)"; }
t15() { mkwt || return; local f="$WT/$CF" n q d creds mut
  n=$(real_interp "$f" | wc -l | tr -d ' '); q=$(real_interp "$f" | grep -c ':?' ); d=$(grep -c ':-' "$f")
  creds=$(grep -E '(USER|PASSWORD|_DB):' "$f" | grep -vc '\${')
  cp "$f" "$BASE/mut.yml"; sed -i.bak 's/\${POSTGRES_DB:?[^}]*}/${POSTGRES_DB:-postgres}/' "$BASE/mut.yml"; mut=$(grep -c ':-' "$BASE/mut.yml")
  echo "T15 $n $q $d $creds $([ "$mut" -ge 1 ] && echo 1 || echo 0)"; }
t16() { mkwt || return; python3 - "$WT/package.json" <<'P'
import json,sys
s=json.load(open(sys.argv[1]))["scripts"]
want=["dev:up","dev:down","dev:reset:db","dev:reset:files","dev:reset:mail","dev:reset"]
print("T16", sum(1 for k in want if k in s), 1 if "dev:seed" in s else 0)
P
}
t17() { mkwt || return; local names n found=0 inv=""
  { real_interp "$WT/$CF" | sed 's/^\${\([A-Z0-9_]*\).*/\1/'; grep -ho 'cfg [A-Z0-9_]*' "$WT"/scripts/*.sh | sed 's/^cfg //'; echo NODE_ENV; } | sort -u > "$BASE/names.txt"
  names=$(wc -l < "$BASE/names.txt" | tr -d ' ')
  # the inventory of TOKI-096 is the file `.env.example` and its table; both are looked for in the commit
  git cat-file -e "$V:.env.example" 2>/dev/null && inv="$BASE/inv.txt" && doc .env.example > "$inv"
  if [ -z "$inv" ]; then echo "T17 $names 0 (there is no .env.example and no inventory file in the commit: TOKI-096 was delivered later) (Blocked)"; return; fi
  for n in $(cat "$BASE/names.txt"); do grep -q "^$n=" "$inv" && found=$((found+1)); done
  echo "T17 $names $found"; }
t20() { mkwt || return; echo "T20 $(cfg config | grep -c '^name: toki-dev$')"; }
t26() { mkwt || return; local imgs mi ma lat; imgs=$(cfg config --images)
  mi=$(echo "$imgs" | grep -c '^toki-dev-minio:RELEASE\.[0-9T-]*Z$'); ma=$(echo "$imgs" | grep -c '^axllent/mailpit:v[0-9]*\.[0-9]*\.[0-9]*$'); lat=$(echo "$imgs" | grep -c ':latest$\|^[^:]*$')
  echo "T26 $mi $ma $lat"; }
t29() { mkwt || return; local s rc out n=0 named=0
  for s in up.sh down.sh reset-db.sh reset-files.sh reset-mail.sh reset.sh; do
    out=$( cd "$WT" && env -i PATH="$PATH" HOME="$HOME" TMPDIR="$BASE" DOCKER_HOST=unix:///nonexistent NODE_ENV=development POSTGRES_DB=qa_dev POSTGRES_TEST_DB=qa_test MINIO_BUCKET=qa-files bash "scripts/$s" 2>&1 ); rc=$?
    [ "$rc" != 0 ] && n=$((n+1)); echo "$out" | grep -qi docker && named=$((named+1))
  done; echo "T29 $n $named"; }

need_stack() { stack_ready || { echo "$1 (Blocked: $STACK_WHY)"; return 1; }; return 0; }

t2() { need_stack T2 || return; scr down.sh >/dev/null 2>&1; local rc h hc; local uo; uo=$(scr up.sh 2>&1); rc=$?
  [ "$rc" != 0 ] && echo "$uo" | grep -E 'Not healthy|failed|Error|error' | head -3 | sed 's/^/  up output: /'
  h=$(c ps --format '{{.Health}}' | grep -c '^healthy$'); hc=$(c config --format json | python3 -c 'import sys,json;print(sum(1 for v in json.load(sys.stdin)["services"].values() if "healthcheck" in v))')
  echo "T2 $rc $h $hc"; }
t2n() { need_stack T2N || return; scr down.sh >/dev/null 2>&1
  python3 -c 'import socket,time,sys;s=socket.socket();s.bind(("127.0.0.1",int(sys.argv[1])));s.listen(1);time.sleep(300)' "$PG" & local lp=$!; LPIDS="$LPIDS $lp"; sleep 1
  local out rc; out=$(scr up.sh 2>&1); rc=$?
  kill_tree "$lp"; wait "$lp" 2>/dev/null
  echo "T2N $(nz $rc) $(echo "$out" | grep -c 'Not healthy: postgres')"; scr down.sh >/dev/null 2>&1; }
t3() { need_stack T3 || return; prep || { echo "T3 (Blocked: prep failed)"; return; }; scr up.sh >/dev/null 2>&1; local rc=$?; echo "T3 $rc $(nrow) $(nfile) $(mail_total)"; }
t4() { need_stack T4 || return; prep || { echo "T4 (Blocked: prep failed)"; return; }; scr down.sh >/dev/null 2>&1; local d=$?; scr up.sh >/dev/null 2>&1; local u=$?; echo "T4 $d $u $(nrow) $(nfile) $(mail_total)"; }
t5() { need_stack T5 || return; prep || { echo "T5 (Blocked: prep failed)"; return; }; mktest; scr reset-db.sh >/dev/null 2>&1; local rc=$?
  echo "T5 $rc $(ntable) $(ntest) $(nfile) $(mail_total)"; psq postgres "drop database if exists $TESTDB with (force)" >/dev/null; }
t6() { need_stack T6 || return; prep || { echo "T6 (Blocked: prep failed)"; return; }; scr reset-files.sh >/dev/null 2>&1; local rc=$? ex=0
  mcx 'mc stat "local/$1" >/dev/null 2>&1' "$BUCKET" && ex=1
  echo "T6 $rc $ex $(nfile) $(nrow) $(mail_total)"; }
t6m() { need_stack T6M || return; prep || { echo "T6M (Blocked: prep failed)"; return; }
  mcx 'mc rb --force "local/$1" >/dev/null' "$BUCKET"; local out rc; out=$(scr reset-files.sh 2>&1); rc=$?
  local still=0; mcx 'mc stat "local/$1" >/dev/null 2>&1' "$BUCKET" && still=1
  scr up.sh >/dev/null 2>&1; local back=0; mcx 'mc stat "local/$1" >/dev/null 2>&1' "$BUCKET" && back=1
  echo "T6M $(nz $rc) $(echo "$out" | grep -c 'pnpm dev:up') $still $back"; }
t7() { need_stack T7 || return; prep || { echo "T7 (Blocked: prep failed)"; return; }; scr reset-mail.sh >/dev/null 2>&1; local rc=$?; echo "T7 $rc $(mail_total) $(nrow) $(nfile)"; }
t8() { need_stack T8 || return; prep || { echo "T8 (Blocked: prep failed)"; return; }; scr reset.sh >/dev/null 2>&1; local rc=$? e=0 own s
  grep -q 'steps="db files mail"' "$WT/scripts/reset.sh" && grep -q 'reset-\$step.sh' "$WT/scripts/reset.sh" && e=3
  own=$(grep -ciE 'mc rm|drop database|api/v1' "$WT/scripts/reset.sh")
  echo "T8 $rc $(ntable) $(nfile) $(mail_total) $e $own"; }
t9() { need_stack T9 || return; prep || { echo "T9 (Blocked: prep failed)"; return; }
  mcx 'mc rb --force "local/$1" >/dev/null' "$BUCKET"; local out rc; out=$(scr reset.sh 2>&1); rc=$?
  echo "T9 $(nz $rc) $(echo "$out" | grep -q 'pnpm dev:reset failed in:.*dev:reset:files' && echo 1 || echo 0) $(ntable) $(mail_total)"; mcx 'mc mb --ignore-existing "local/$1" >/dev/null' "$BUCKET"; }
t10() { need_stack T10 || return; prep || { echo "T10 (Blocked: prep failed)"; return; }
  local runs=0 refused=0 named=0 s i out rc accepted=0
  for i in 1 2 3 4 5 6; do
    envreset; X=""
    case $i in 1) envset NODE_ENV production;; 2) envset NODE_ENV staging;; 3) envdel NODE_ENV;; 4) X="NODE_ENV=production";; 5) envset NODE_ENV production; X="NODE_ENV=development";; 6) envdel NODE_ENV; X="NODE_ENV=production";; esac
    for s in reset-db.sh reset-files.sh reset-mail.sh reset.sh; do out=$(scr $s 2>&1); rc=$?; runs=$((runs+1)); [ "$rc" != 0 ] && refused=$((refused+1)); echo "$out" | grep -q 'NODE_ENV' && named=$((named+1)); done
  done
  local kept=0; envreset; X=""; marks_ok && kept=1
  envreset; for s in reset-db.sh reset-files.sh reset-mail.sh; do scr $s --check >/dev/null 2>&1 && accepted=$((accepted+1)); done
  envdel NODE_ENV; X="NODE_ENV=development"; for s in reset-db.sh reset-files.sh reset-mail.sh; do scr $s --check >/dev/null 2>&1 && accepted=$((accepted+1)); done
  envreset; X=""
  echo "T10 $runs $refused $named $kept $accepted"; }
t11() { need_stack T11 || return; prep || { echo "T11 (Blocked: prep failed)"; return; }; local a b2 rc; a=$(shasum "$WT/.env" | cut -d' ' -f1); scr reset.sh >/dev/null 2>&1; rc=$?; b2=$(shasum "$WT/.env" | cut -d' ' -f1)
  echo "T11 $rc $([ "$a" = "$b2" ] && echo 1 || echo 0)"; }
t12() { need_stack T12 || return; prep || { echo "T12 (Blocked: prep failed)"; return; }; mktest; scr reset.sh >/dev/null 2>&1; local rc=$?; echo "T12 $rc $(ntest)"; psq postgres "drop database if exists $TESTDB with (force)" >/dev/null; }
t13() { need_stack T13 || return; scr up.sh >/dev/null 2>&1; mail_clear; send_mail; echo "T13 $(mail_total)"; }
t18() { need_stack T18 || return; local w wo lines withenv pk
  c config -q >/dev/null 2>&1; w=$?; ( cd "$WT" && env -i PATH="$PATH" HOME="$HOME" docker compose -f docker-compose.dev.yml config -q >/dev/null 2>&1 ); wo=$?
  lines=$(grep -h 'docker compose' "$WT"/scripts/*.sh | grep -v '^[[:space:]]*#' | wc -l | tr -d ' '); withenv=$(grep -h 'docker compose' "$WT"/scripts/*.sh | grep -v '^[[:space:]]*#' | grep -c -- '--env-file .env')
  pk=$(grep '"dev' "$WT/package.json" | grep -c 'docker compose')
  echo "T18 $w $(nz $wo) $lines $withenv $pk"; }
t19() { need_stack T19 || return; mkwt; local nq out rc; nq=$(real_interp "$WT/$CF" | grep -vc ':?'); scr down.sh >/dev/null 2>&1
  envdel POSTGRES_PASSWORD; out=$(scr up.sh 2>&1); rc=$?; envreset
  echo "T19 $nq $(nz $rc) $(echo "$out" | grep -c POSTGRES_PASSWORD)"; }
t21() { need_stack T21 || return; prep || { echo "T21 (Blocked: prep failed)"; return; }; scr down.sh >/dev/null 2>&1
  local s out rc ref=0 msg=0 nonexec; for s in reset-db.sh reset-files.sh reset-mail.sh reset.sh; do out=$(scr $s 2>&1); rc=$?; [ "$rc" != 0 ] && ref=$((ref+1)); echo "$out" | grep -q 'pnpm dev:up' && msg=$((msg+1)); done
  scr up.sh >/dev/null 2>&1; local back=0; marks_ok && back=1
  nonexec=$(grep -hE 'compose[^|]*[[:space:]](run|up|down|stop|restart|rm|kill|start)[[:space:]]' "$WT"/scripts/reset*.sh | grep -vc '^[[:space:]]*#')
  echo "T21 $ref $msg $back $nonexec"; }
t22() { need_stack T22 || return; prep || { echo "T22 (Blocked: prep failed)"; return; }; c stop postgres >/dev/null 2>&1
  local out rc; out=$(scr reset.sh 2>&1); rc=$?; local fm=0; [ "$(nfile)" = 1 ] && [ "$(mail_total)" = 1 ] && fm=1
  scr up.sh >/dev/null 2>&1; echo "T22 $(nz $rc) $(echo "$out" | grep -c 'pnpm dev:up') $fm $(nrow)"; }
t23() { need_stack T23 || return; prep || { echo "T23 (Blocked: prep failed)"; return; }
  ( c exec -T postgres sh -c 'psql -X -q -U "$POSTGRES_USER" -d "$1" -c "select pg_sleep(120)"' sh "$DB" >/dev/null 2>&1 ) & local sp=$!; LPIDS="$LPIDS $sp"; sleep 3
  local sess; sess=$(psq "$DB" "select count(*) from pg_stat_activity where datname='$DB' and pid<>pg_backend_pid()" | tr -d ' ')
  scr reset-db.sh >/dev/null 2>&1; local rc=$?; kill_tree "$sp"; wait "$sp" 2>/dev/null
  echo "T23 $([ "${sess:-0}" -ge 1 ] && echo 1 || echo 0) $rc $(ntable) $([ "$(psq postgres "select count(*) from pg_database where datname='$DB'" | tr -d ' ')" = 1 ] && echo 1 || echo 0)"; }
t24() { need_stack T24 || return; prep || { echo "T24 (Blocked: prep failed)"; return; }; mktest
  local runs=0 refused=0 named=0 i s out rc dbs0 dbs1; dbs0=$(psq postgres "select string_agg(datname,',' order by datname) from pg_database")
  for i in 1 2 3 4 5 6; do envreset
    case $i in 1) envset POSTGRES_DB "$TESTDB";; 2) envset POSTGRES_DB postgres;; 3) envset POSTGRES_DB template0;; 4) envset POSTGRES_DB template1;; 5) envdel POSTGRES_TEST_DB;; 6) envset POSTGRES_TEST_DB "";; esac
    for s in reset-db.sh reset.sh; do out=$(scr $s 2>&1); rc=$?; runs=$((runs+1)); [ "$rc" != 0 ] && refused=$((refused+1)); [ "$i" -ge 5 ] && echo "$out" | grep -q 'POSTGRES_TEST_DB' && named=$((named+1)); done
  done; envreset
  dbs1=$(psq postgres "select string_agg(datname,',' order by datname) from pg_database")
  local ok=0; scr reset-db.sh --check >/dev/null 2>&1 && ok=1
  echo "T24 $runs $refused $named $([ "$dbs0" = "$dbs1" ] && echo 1 || echo 0) $(nrow) $([ "$(nfile)" = 1 ] && [ "$(mail_total)" = 1 ] && echo 1 || echo 0) $ok"
  psq postgres "drop database if exists $TESTDB with (force)" >/dev/null; }
t25() { need_stack T25 || return; scr up.sh >/dev/null 2>&1
  c ps --format json | python3 -c '
import sys,json
raw=sys.stdin.read().strip()
rows=json.loads(raw) if raw.startswith("[") else [json.loads(l) for l in raw.splitlines() if l.strip()]
t=l=0
for r in rows:
    for p in r.get("Publishers") or []:
        if p.get("PublishedPort"):
            t+=1; l+= 1 if p.get("URL")=="127.0.0.1" else 0
print("T25",t,l)'; }
t27() { need_stack T27 || return; scr down.sh >/dev/null 2>&1; c down -v >/dev/null 2>&1; local u1 u2 n1 n2
  scr up.sh >/dev/null 2>&1; u1=$?; n1=$(mcx 'mc ls local | grep -c " $1/$"' "$BUCKET"); scr up.sh >/dev/null 2>&1; u2=$?; n2=$(mcx 'mc ls local | grep -c " $1/$"' "$BUCKET")
  echo "T27 $u1 ${n1:-0} $u2 ${n2:-0}"; }
t28() { need_stack T28 || return; prep || { echo "T28 (Blocked: prep failed)"; return; }; local rc; scr reset.sh </dev/null >/dev/null 2>&1; rc=$?
  echo "T28 $rc $(grep -cE '(^|[[:space:];])read[[:space:]]+-' "$WT"/scripts/reset*.sh | awk -F: '{s+=$NF} END{print s+0}')"; }
t30() { need_stack T30 || return; scr up.sh >/dev/null 2>&1; local a b2 rc mut
  a=$(shasum "$WT/.env" | cut -d' ' -f1); ( cd "$WT" && env -i PATH="$PATH" HOME="$HOME" TMPDIR="$BASE" bash scripts/smoke.test.sh >/dev/null 2>&1 ); rc=$?; b2=$(shasum "$WT/.env" | cut -d' ' -f1)
  perl -0pi -e 's/guard_development "\$ENV_FILE" \|\| exit 1\n//' "$WT/scripts/reset-mail.sh"
  ( cd "$WT" && env -i PATH="$PATH" HOME="$HOME" TMPDIR="$BASE" bash scripts/smoke.test.sh >/dev/null 2>&1 ); mut=$?
  ( cd "$WT" && git checkout -q -- scripts/reset-mail.sh )
  echo "T30 $rc $([ "$a" = "$b2" ] && echo 1 || echo 0) $(nz $mut)"; }

IDS=("$@"); [ ${#IDS[@]} -eq 0 ] && IDS=(T1 T14 T15 T16 T17 T20 T26 T29)
for id in "${IDS[@]}"; do
  case "$id" in
    T1) t1;; T14) t14;; T15) t15;; T16) t16;; T17) t17;; T20) t20;; T26) t26;; T29) t29;;
    T2) t2;; T2N) t2n;; T3) t3;; T4) t4;; T5) t5;; T6) t6;; T6M) t6m;; T7) t7;; T8) t8;; T9) t9;; T10) t10;; T11) t11;; T12) t12;; T13) t13;;
    T18) t18;; T19) t19;; T21) t21;; T22) t22;; T23) t23;; T24) t24;; T25) t25;; T27) t27;; T28) t28;; T30) t30;;
    *) echo "$id unknown";;
  esac
done
