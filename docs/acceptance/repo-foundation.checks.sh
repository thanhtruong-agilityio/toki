#!/usr/bin/env bash
# Checks behind docs/acceptance/repo-foundation.md. No model. Usage (from the repository root):
#   C=<commit of main> bash docs/acceptance/repo-foundation.checks.sh <A2|A3|A4|A1|R KEY ID...>
#   A2  the latest completed run of ci.yml on main at C: read-only `gh api` requests (GET).
#   A2W the workflow file at C: triggers (pull_request, push) and the number and ids of its jobs.
#   A3  the real pull request runs of ci.yml in which every check passed: read-only `gh api`.
#   A4  the repository's own lint in a temporary worktree of C on made-up files that break the
#       boundary rules, and on a clean copy of the same files. Needs Node 22 and the registry.
#   R   re-runs rows of a QA record at C: `V=C bash docs/qa/<KEY>.checks.sh <ID...>`; the lines go
#       in the evidence file and say whether a QA requirement still holds at C.
#   A1  "pnpm dev runs": run BY THE QA in their own terminal, in their own checkout, with the
#       development services up (`pnpm dev:up`). It starts `pnpm dev`, counts the processes and
#       the ports they listen on, stops them and prints counts. It does not read or create
#       `.env` (pnpm dev reads it), prints no value, and checks that HEAD is C.
# It prints one line for each check: counts, exit codes and words; no secret, no log text.
# Temporary files live under one folder (BASE, exported as TMPDIR); the last line shows that no
# worktree, process or folder is left and that the repository is unchanged. It writes nothing
# to GitHub. A4 is read from the files of C only; the repository itself is not changed.
set -uo pipefail
C="${C:-}"
[ -n "$C" ] || { echo "C=<commit> is required" >&2; exit 2; }
CH=$(git rev-parse --verify -q "$C^{commit}") || { echo "unknown commit $C" >&2; exit 2; }
REPO="thanhtruong-agilityio/toki"
BASE=$(mktemp -d); export TMPDIR="$BASE"
before_wt=$(git worktree list | wc -l | tr -d ' ')
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; PIDS=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; }
cleanup() {
  local p alive=0 folder=removed w s
  for p in $PIDS; do kill_tree "$p"; done
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
  rm -rf "$BASE"; git worktree prune >/dev/null 2>&1
  [ -d "$BASE" ] && folder=left
  for p in $PIDS; do kill -0 "$p" >/dev/null 2>&1 && alive=$((alive+1)); done
  w=$(git worktree list | wc -l | tr -d ' '); s=$(git status --porcelain | shasum | cut -d' ' -f1)
  echo "CLEAN worktrees $([ "$w" = "$before_wt" ] && echo same || echo changed) status $([ "$s" = "$before_status" ] && echo same || echo changed) processes $alive temporary-folder $folder"
}
trap cleanup EXIT

N22=""; NEED22=0
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  N22=$(ls -d "$HOME"/.nvm/versions/node/v22*/bin 2>/dev/null | tail -1); [ -n "$N22" ] || NEED22=1
fi
NODEPATH="${N22:+$N22:}$PATH"
pn() { ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm "$@" ); }

a2() {
  local runs id concl jobs ok skipped failed
  runs=$(gh api "repos/$REPO/actions/workflows/ci.yml/runs?branch=main&head_sha=$CH&per_page=20" --jq '[.workflow_runs[] | select(.status=="completed")] | sort_by(.created_at) | last | [.id, .conclusion] | @tsv' 2>/dev/null)
  [ -n "$runs" ] && [ "$runs" != "null" ] || { echo "A2 no completed run of ci.yml on main at ${CH:0:7} (Blocked)"; return; }
  id=${runs%%$'\t'*}; concl=${runs#*$'\t'}
  gh api "repos/$REPO/actions/runs/$id/jobs?per_page=100" --jq '.jobs[] | .conclusion' > "$BASE/a2.txt" 2>/dev/null
  jobs=$(wc -l < "$BASE/a2.txt" | tr -d ' ')
  [ "$jobs" -ge 1 ] || { echo "A2 the jobs of the run could not be read (Blocked)"; return; }
  ok=$(grep -c '^success$' "$BASE/a2.txt"); skipped=$(grep -c '^skipped$' "$BASE/a2.txt"); failed=$(grep -c '^failure$\|^cancelled$\|^timed_out$' "$BASE/a2.txt")
  echo "A2 ${CH:0:7} $concl jobs $jobs success $ok skipped $skipped failed $failed"
}
a2w() {
  local f="$BASE/ci.yml" names pr push jobs
  git show "$CH:.github/workflows/ci.yml" > "$f" 2>/dev/null || { echo "A2W no ci.yml in ${CH:0:7} (Blocked)"; return; }
  grep -v '^[[:space:]]*#' "$f" > "$f.nc"
  pr=$(grep -c '^  pull_request' "$f.nc"); push=$(awk '/^on:/{on=1;next} on&&/^[a-z]/{on=0} on' "$f.nc" | grep -c '^  push')
  jobs=$(awk '/^jobs:/{on=1;next} on&&/^  [A-Za-z0-9_-]+:[[:space:]]*$/{n++} END{print n+0}' "$f.nc")
  names=$(awk '/^jobs:/{on=1;next} on&&/^  [A-Za-z0-9_-]+:[[:space:]]*$/{gsub(/[ :]/,"");printf "%s ",$0}' "$f.nc")
  echo "A2W pull_request $pr push $push jobs $jobs ($names)"
}
a3() {
  local tsv
  tsv=$(gh api --paginate "repos/$REPO/actions/workflows/ci.yml/runs?event=pull_request&status=completed&per_page=100" --jq '.workflow_runs[] | .conclusion' 2>/dev/null)
  [ -n "$tsv" ] || { echo "A3 the pull request runs could not be read (Blocked)"; return; }
  echo "A3 total $(echo "$tsv" | wc -l | tr -d ' ') success $(echo "$tsv" | grep -c '^success$') failure $(echo "$tsv" | grep -c '^failure$')"
}
put() { mkdir -p "$(dirname "$WT/$1")"; printf '%s\n' "$2" > "$WT/$1"; }
a4() {
  [ "$NEED22" = 1 ] && { echo "A4 needs Node 22 (Blocked)"; return; }
  mkdir -p "$BASE/wt0"; git worktree add --detach "$BASE/wt0/wt" "$CH" >/dev/null 2>&1 || { echo "A4 no worktree (Blocked)"; return; }
  WT="$BASE/wt0/wt"
  pn install --frozen-lockfile >/dev/null 2>&1 || { echo "A4 install failed (Blocked)"; return; }
  local bad="packages/client-core/src/zz-a.ts packages/shared/src/zz-b.ts apps/server/src/modules/zzb/index.ts"
  put packages/client-core/src/zz-a.ts 'export const v = window;'
  put packages/shared/src/zz-b.ts 'import "@toki/ui-web";'
  put apps/server/src/modules/zza/inner.ts 'export const x = 1;'
  put apps/server/src/modules/zza/index.ts 'export const y = 1;'
  put apps/server/src/modules/zzb/index.ts 'import { x } from "../zza/inner"; export const z = x;'
  local j rc fired rules
  j="$BASE/bad.json"; ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec eslint -f json $bad > "$j" 2>/dev/null ); rc=$?
  fired=$(jq '[.[] | select([.messages[] | select(.severity==2 and ((.ruleId // "") | test("^(toki/|no-restricted-|@typescript-eslint/no-restricted-imports)")))] | length > 0)] | length' "$j" 2>/dev/null || echo 0)
  rules=$(jq -r '[.[].messages[] | select(.severity==2) | .ruleId // empty | select(test("^(toki/|no-restricted-|@typescript-eslint/no-restricted-imports)"))] | unique | length' "$j" 2>/dev/null || echo 0)
  put packages/client-core/src/zz-a.ts 'export const v = 1;'
  put packages/shared/src/zz-b.ts 'export const w = 2;'
  put apps/server/src/modules/zzb/index.ts 'import { y } from "../zza/index"; export const z = y;'
  local rc2; ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec eslint $bad >/dev/null 2>&1 ); rc2=$?
  echo "A4 $([ "$rc" != 0 ] && echo 1 || echo 0) $fired 3 $rules $rc2"
}
r() {
  local key="$1"; shift
  [ -f "docs/qa/$key.checks.sh" ] || { echo "R no checks script for $key (Blocked)"; return; }
  V="$CH" bash "docs/qa/$key.checks.sh" "$@" 2>&1 | grep -v '^CLEAN' | sed "s/^/R $key /"
}
a1() {
  git diff --quiet "$CH" HEAD -- . ':(exclude)docs' || { echo "A1 the files outside docs/ differ from ${CH:0:7}: use a checkout of that commit (Blocked)"; return; }
  ( env PATH="$NODEPATH" corepack pnpm dev >/dev/null 2>&1 ) & local pid=$!; PIDS="$PIDS $pid"
  sleep 60
  local all n=0 ports=0 left=0 p list names
  desc() { local c; echo "$1"; for c in $(pgrep -P "$1" 2>/dev/null); do desc "$c"; done; }
  all=$(desc "$pid" | tr '\n' ' ')
  list=$(echo $all | tr ' ' ',')
  n=$(echo $all | wc -w | tr -d ' ')
  ports=$(lsof -nP -iTCP -sTCP:LISTEN -a -p "$list" 2>/dev/null | awk 'NR>1{print $9}' | sed 's/.*://' | sort -u | wc -l | tr -d ' ')
  names=$(ps -o comm= -p "$list" 2>/dev/null | sed 's#.*/##' | sort | uniq -c | awk '{printf "%s:%s ",$2,$1}')
  kill_tree "$pid"; sleep 8
  for p in $all; do kill -0 "$p" >/dev/null 2>&1 && left=$((left+1)); done
  echo "A1 processes $n ports $ports left $left ($names)"
}

mode="${1:-}"; [ $# -gt 0 ] && shift
case "$mode" in
  A2) a2;; A2W) a2w;; A3) a3;; A4) a4;; A1) a1;; R) r "$@";;
  *) echo "usage: C=<commit> bash docs/acceptance/repo-foundation.checks.sh <A2|A2W|A3|A4|A1|R KEY ID...>" >&2; exit 2;;
esac
