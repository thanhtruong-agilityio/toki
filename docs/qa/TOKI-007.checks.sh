#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-007.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile`, and read-only `gh api` GET requests to GitHub (list runs, list the
# jobs of a run, read a job log). It writes nothing to GitHub and opens no pull request.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-007.checks.sh [T1 T2 ...]
# Static rows read files of the commit V with `git show`. The rows about the behavior of the bundle
# size script use a temporary worktree of V, removed when the script ends. History rows read the real
# runs of the workflow `ci.yml` created from the first commit of the pull request that delivered V: which job and step
# failed and which jobs ran. The workflow changed after the delivery, so history shows how CI behaved
# later, not the file at V. A row whose evidence is not in the history prints Blocked.
# Every temporary file lives under one folder made in the current shell (BASE, exported as TMPDIR), which
# the cleanup removes. It prints one line for each row: counts, ids and words; no token and no log text.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
REPO="thanhtruong-agilityio/toki"
WF=".github/workflows/ci.yml"
doc() { git show "$V:$1" 2>/dev/null; }

BASE=$(mktemp -d); export TMPDIR="$BASE"
before_wt=$(git worktree list | wc -l | tr -d ' ')
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; PIDS=""
cleanup() {
  local p
  for p in $PIDS; do kill "$p" >/dev/null 2>&1; done
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

# ---- the workflow at V, without comment lines --------------------------------
YML=$(doc "$WF" | grep -v '^[[:space:]]*#')
job_ids() { printf '%s\n' "$YML" | awk '/^jobs:/{on=1; next} on && /^  [A-Za-z0-9_-]+:[[:space:]]*$/{gsub(/[ :]/,""); print}'; }
job_block() { printf '%s\n' "$YML" | awk -v j="$1" '/^jobs:/{on=1; next} on && /^  [A-Za-z0-9_-]+:[[:space:]]*$/{cur=$0; gsub(/[ :]/,"",cur); inj=(cur==j); next} on && inj {print}'; }
job_name() { job_block "$1" | sed -n 's/^    name:[[:space:]]*//p' | head -1; }
jobs_with() { local n=0 j; for j in $(job_ids); do job_block "$j" | grep -qE "$1" && n=$((n + 1)); done; echo "$n"; }

# ---- the history of real runs (read-only) ------------------------------------
HIST="$BASE/hist.tsv"; HIST_OK=""
history() {
  [ -n "$HIST_OK" ] && return "$([ "$HIST_OK" = 1 ] && echo 0 || echo 1)"
  local epoch id event br conc created
  # from the first commit of the pull request that delivered V (its own runs count), else from V
  epoch=$(git log --format=%ct "$V^1..$V^2" 2>/dev/null | sort -n | head -1)
  [ -n "$epoch" ] || epoch=$(git show -s --format=%ct "$V")
  gh api --paginate "repos/$REPO/actions/workflows/ci.yml/runs?per_page=100" \
    --jq ".workflow_runs[] | select((.created_at | fromdateiso8601) >= $epoch) | [.id, .event, .head_branch, (.conclusion // \"\"), .created_at] | @tsv" > "$BASE/runs.tsv" 2>"$BASE/gh.err"
  if [ ! -s "$BASE/runs.tsv" ]; then HIST_OK=0; return 1; fi
  mkdir -p "$BASE/j"; export REPO BASE
  cut -f1 "$BASE/runs.tsv" | xargs -P 8 -I{} bash -c 'gh api "repos/$REPO/actions/runs/{}/jobs?per_page=100" --jq ".jobs[] | [.name, (.conclusion // \"\"), ([.steps[] | select(.conclusion == \"failure\") | .name][0] // \"\"), .id] | @tsv" > "$BASE/j/{}.tsv" 2>/dev/null' 
  : > "$HIST"
  while IFS=$'\t' read -r id event br conc created; do
    [ -f "$BASE/j/$id.tsv" ] || continue
    awk -F'\t' -v a="$id" -v b="$event" -v c="$br" -v d="$conc" -v e="$created" 'BEGIN{OFS="\t"} {print a, b, c, d, e, $1, $2, $3, $4}' "$BASE/j/$id.tsv" >> "$HIST"
  done < "$BASE/runs.tsv"
  HIST_OK=1; return 0
}
need_hist() { history && return 0; echo "$1 the history could not be read: $(head -c 120 "$BASE/gh.err" | tr '\n' ' ') (Blocked)"; return 1; }
# count of runs in which job $1 failed at the step named $2
failed_at() { awk -F'\t' -v j="$1" -v s="$2" '$6 == j && $7 == "failure" && $8 == s {print $1}' "$HIST" | sort -u | wc -l | tr -d ' '; }
joblog() { gh api --allow-escape-sequences "repos/$REPO/actions/jobs/$1/logs" 2>/dev/null | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g'; }

t1() {
  local ex=0 pr=0 push=0 hp=0 hq=0
  doc "$WF" >/dev/null && [ -n "$YML" ] && ex=1
  printf '%s\n' "$YML" | awk '/^on:/{on=1; next} on && /^[^ ]/{exit} on {print}' > "$BASE/on.txt"
  grep -qE '^  pull_request:' "$BASE/on.txt" && pr=1
  grep -qE '^  push:' "$BASE/on.txt" && grep -qE 'branches:[[:space:]]*\[main\]' "$BASE/on.txt" && push=1
  need_hist T1 || return
  [ "$(awk -F'\t' '$2 == "pull_request"' "$HIST" | wc -l | tr -d ' ')" -ge 1 ] && hp=1
  [ "$(awk -F'\t' '$2 == "push" && $3 == "main"' "$HIST" | wc -l | tr -d ' ')" -ge 1 ] && hq=1
  echo "T1 $ex $pr $push $((hp * hq))"
}
t2() {
  local a b
  a=$(job_block lint | grep -cE '^      - run: pnpm lint$'); b=$(job_block lint | grep -cE '^      - run: pnpm format:check$')
  need_hist T2 || return
  local fl ff; fl=$(failed_at lint "Run pnpm lint"); ff=$(failed_at lint "Run pnpm format:check")
  [ "$fl" -ge 1 ] && fl=1 || fl=0; [ "$ff" -ge 1 ] && ff=1 || ff=0
  echo "T2 $((a + b)) $fl $ff"
}
t3() {
  local runs=0 id j hit=0 n=0
  job_block lint | grep -qE '^      - run: pnpm lint$' && runs=1
  need_hist T3 || return
  for j in $(awk -F'\t' '$6 == "lint" && $7 == "failure" && $8 == "Run pnpm lint" {print $9}' "$HIST" | head -6); do
    n=$((n + 1)); joblog "$j" > "$BASE/job.log"; grep -qiE 'boundary' "$BASE/job.log" && { hit=1; break; }
  done
  if [ "$hit" = 1 ]; then echo "T3 $runs 1"; else echo "T3 $runs 0 (none of the failed lint runs read in the history names a boundary rule) (Blocked)"; fi
}
t4() { local s; s=$(job_block typecheck | grep -cE '^      - run: pnpm typecheck$'); need_hist T4 || return; local f; f=$(failed_at "type check" "Run pnpm typecheck"); echo "T4 $s $([ "$f" -ge 1 ] && echo 1 || echo 0)"; }
t5() { local s; s=$(job_block tests | grep -cE '^      - run: pnpm test$'); need_hist T5 || return; local f; f=$(failed_at tests "Run pnpm test"); echo "T5 $s $([ "$f" -ge 1 ] && echo 1 || echo 0)"; }
t6() {
  local s sc=0 f
  s=$(job_block build | grep -cE '^      - run: pnpm build$')
  [ "$(doc package.json | jq -r '.scripts.build')" = "pnpm -r --if-present run build" ] && sc=1
  need_hist T6 || return
  f=$(failed_at build "Run pnpm build")
  if [ "$f" -ge 1 ]; then echo "T6 $s $sc 1"; else echo "T6 $s $sc 0 (no run in the history failed at pnpm build) (Blocked)"; fi
}
t7() {
  need T7 || return
  local lim reads=0 deps tool=0 build=0 sd=0 ver=0 low=0 d out rc o
  lim=$(doc tools/bundle-size/limit.json | jq -r '.bytes')
  doc tools/bundle-size/check.mjs | grep -q '"dist"' && reads=1
  deps=$({ doc package.json; doc apps/web/package.json; } | jq -r '(.dependencies // {}) + (.devDependencies // {}) | keys[]' | grep -ciE 'size-limit|bundlesize|bundlewatch|bundle-analyzer|visualizer')
  [ "$(doc package.json | jq -r '.scripts.size')" = "node tools/bundle-size/check.mjs" ] && doc tools/bundle-size/check.mjs | grep -q 'spawnSync' && doc tools/bundle-size/check.mjs | grep -q 'build' && build=1
  d="$BASE/synth"; mkdir -p "$d/assets"
  nodebin -e '
    const fs=require("fs"), z=require("zlib"), c=require("crypto"), d=process.argv[1];
    const blob=(n)=>c.randomBytes(n).toString("base64");
    fs.writeFileSync(d+"/index.html", `<html><head><script type="module" src="/assets/entry.js"></script><link rel="modulepreload" href="/assets/pre.js"></head></html>`);
    fs.writeFileSync(d+"/assets/entry.js", `import "./stat.js";\nconst lazy = () => import("./dyn.js");\n//${blob(3000)}`);
    fs.writeFileSync(d+"/assets/stat.js", `export const s = 1;\n//${blob(2000)}`);
    fs.writeFileSync(d+"/assets/pre.js", `export const p = 1;\n//${blob(1500)}`);
    fs.writeFileSync(d+"/assets/dyn.js", `export const y = 1;\n//${blob(4000)}`);
    const g=(f)=>z.gzipSync(fs.readFileSync(d+"/assets/"+f),{level:9}).length;
    fs.writeFileSync(d+"/expect.json", JSON.stringify({without:g("entry.js")+g("stat.js")+g("pre.js"), with:g("entry.js")+g("stat.js")+g("pre.js")+g("dyn.js")}));
  ' "$d"
  out=$(cd "$WT" && PATH="$NODEPATH" node --input-type=module -e '
    import { measure, verdict } from "./tools/bundle-size/check.mjs";
    import fs from "node:fs";
    const d = process.argv[1]; const e = JSON.parse(fs.readFileSync(d + "/expect.json", "utf8"));
    const m = measure(d);
    const at = verdict(1000, 1000), under = verdict(999, 1000), over = verdict(1500, 1000);
    const three = (t) => /\b1500\b/.test(t) && /\b1000\b/.test(t) && /500/.test(t);
    console.log(JSON.stringify([m === e.without && m !== e.with ? 1 : 0, !at.ok && under.ok && !over.ok && three(over.message) ? 1 : 0]));
  ' "$d" 2>/dev/null | tail -1)
  sd=$(printf '%s' "$out" | jq -r '.[0] // 0'); ver=$(printf '%s' "$out" | jq -r '.[1] // 0')
  # the real script in a made-up root that has a build script and the synthetic dist: with the real
  # limit it passes, with the limit lowered it fails and prints size, limit and difference
  local fr="$BASE/fakeroot" okreal=0 nob=0
  mkdir -p "$fr/tools/bundle-size" "$fr/apps/web"
  doc tools/bundle-size/check.mjs > "$fr/tools/bundle-size/check.mjs"
  printf '{ "name": "fake", "private": true }\n' > "$fr/package.json"
  printf 'packages:\n  - "apps/*"\n' > "$fr/pnpm-workspace.yaml"
  printf '{ "name": "@toki/web", "private": true, "scripts": { "build": "node -e 0" } }\n' > "$fr/apps/web/package.json"
  cp -R "$d" "$fr/apps/web/dist"
  printf '{ "bytes": 200000 }\n' > "$fr/tools/bundle-size/limit.json"
  o=$( cd "$fr" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node tools/bundle-size/check.mjs 2>&1 ); rc=$?
  [ "$rc" = 0 ] && printf '%s' "$o" | grep -q '^OK' && okreal=1
  printf '{ "bytes": 1000 }\n' > "$fr/tools/bundle-size/limit.json"
  o=$( cd "$fr" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node tools/bundle-size/check.mjs 2>&1 ); rc=$?
  [ "$rc" != 0 ] && printf '%s' "$o" | grep -qE 'size [0-9]+ bytes, limit 1000 bytes, difference \+[0-9]+ bytes' && [ "$okreal" = 1 ] && low=1
  # the real tree at the Version: apps/web has no build script yet, so the check passes and says so
  o=$(pnenv -- size 2>&1); rc=$?
  [ "$rc" = 0 ] && printf '%s' "$o" | grep -q 'no bundle to measure' && nob=1
  echo "T7 $lim $reads $deps $build $sd $ver $low $nob"
}
t8() {
  local ok=0 j names n=0 distinct
  for j in $(job_ids); do n=$((n + 1)); names="$names|$(job_name "$j")"; done
  for nm in 'lint' 'type check' 'tests' 'build' 'bundle size'; do printf '%s' "$names" | grep -qF "|$nm" && ok=$((ok + 1)); done
  distinct=$([ "$n" = 5 ] && echo 1 || echo 0)
  need_hist T8 || return
  local h=0; awk -F'\t' '$2 == "pull_request" {print $1 "\t" $6}' "$HIST" | sort -u | awk -F'\t' '{c[$1]=c[$1] "|" $2} END {for (r in c) print c[r]}' | while read -r l; do :; done
  h=$(awk -F'\t' '$2 == "pull_request" {print $1 "\t" $6}' "$HIST" | sort -u | awk -F'\t' '{c[$1]=c[$1] "|" $2} END {for (r in c) if (c[r] ~ /\|lint/ && c[r] ~ /\|type check/ && c[r] ~ /\|tests/ && c[r] ~ /\|build/ && c[r] ~ /\|bundle size/) n++; print n + 0}')
  echo "T8 $ok $distinct $([ "$h" -ge 1 ] && echo 1 || echo 0)"
}
t9() {
  need_hist T9 || return
  local failed withfailed bad
  failed=$(awk -F'\t' '$4 == "failure" {print $1}' "$HIST" | sort -u | wc -l | tr -d ' ')
  withfailed=$(awk -F'\t' '$4 == "failure" && $7 == "failure" {print $1}' "$HIST" | sort -u | wc -l | tr -d ' ')
  bad=$(awk -F'\t' '$4 == "success" && $7 == "failure" {print $1}' "$HIST" | sort -u | wc -l | tr -d ' ')
  echo "T9 $failed $withfailed $bad"
}
t10() {
  local sc=0 s outside
  for s in lint format:check typecheck test build size; do [ "$(doc package.json | jq -r --arg s "$s" '.scripts | has($s)')" = true ] && sc=$((sc + 1)); done
  outside=$(printf '%s\n' "$YML" | grep -E '^[[:space:]]+- run:' | sed 's/^[[:space:]]*- run:[[:space:]]*//' | grep -vxE 'pnpm install --frozen-lockfile|pnpm lint|pnpm format:check|pnpm typecheck|pnpm test|pnpm build|pnpm size' | grep -c .)
  echo "T10 $sc $outside"
}
t11() {
  local ci dir cr env
  ci=$(printf '%s\n' "$YML" | grep -cE 'secrets\.|secrets\[|secrets:')
  dir=$(for f in $(git ls-tree --name-only "$V" .github/workflows/ | sed 's#.*/##'); do doc ".github/workflows/$f" | grep -vE '^[[:space:]]*#' | grep -E 'secrets\.|secrets\[|secrets:'; done | grep -c .)
  cr=$(printf '%s\n' "$YML" | grep -c 'contents: read')
  env=$(git ls-tree -r --name-only "$V" | grep -E '(^|/)\.env(\.|$)' | grep -vE '\.env\.example$' | grep -c .)
  echo "T11 $ci $dir $cr $env"
}
t12() {
  local lit_n lit_p nodeok=0 pnpmok=0 pm j v
  lit_n=$(printf '%s\n' "$YML" | grep -cE '^[[:space:]]+node-version:')
  lit_p=$(printf '%s\n' "$YML" | grep -cE '^[[:space:]]+version:')
  pm=$(doc package.json | jq -r '.packageManager' | sed 's/^pnpm@//')
  need_hist T12 || return
  j=$(awk -F'\t' '$4 == "success" && $6 == "lint" {print $9}' "$HIST" | head -1)
  if [ -n "$j" ]; then
    joblog "$j" > "$BASE/job.log"
    grep -qE '^[0-9TZ:.-]+ node: v22\.' "$BASE/job.log" && nodeok=1
    v=$(grep -oE '\+ pnpm [0-9]+\.[0-9]+\.[0-9]+' "$BASE/job.log" | head -1 | sed 's/+ pnpm //')
    [ -n "$v" ] && [ "$v" = "$pm" ] && pnpmok=1
  fi
  echo "T12 $lit_n $lit_p $nodeok $pnpmok"
}
t13() {
  need_hist T13 || return
  local n
  n=$(awk -F'\t' '$2 == "pull_request" {r[$1]=r[$1] "|" $6 ":" $7} END {for (k in r) if (r[k] ~ /\|lint:success/ && r[k] ~ /\|type check:success/ && r[k] ~ /\|tests:success/ && r[k] ~ /\|build:success/ && r[k] ~ /\|bundle size:success/) c++; print c + 0}' "$HIST")
  echo "T13 $n"
}
t14() {
  local files hits
  files=$(git ls-tree --name-only "$V" .github/workflows/ | grep -c .)
  hits=0; for f in $(git ls-tree --name-only "$V" .github/workflows/ | sed 's#.*/##'); do hits=$((hits + $(doc ".github/workflows/$f" | grep -ciE 'e2e|playwright'))); done
  echo "T14 $files $hits"
}
t15() {
  local img=0 url=0 sec j h=0 n
  printf '%s\n' "$(job_block tests)" | grep -qE 'image: postgres:17$' && img=17
  job_block tests | grep -E 'TEST_DATABASE_URL:' | grep -qE '/[A-Za-z0-9_]+_test$' && url=1
  sec=$(job_block tests | grep -cE 'secrets\.')
  need_hist T15 || return
  n=0
  for j in $(awk -F'\t' '$4 == "success" && $6 == "tests" {print $9}' "$HIST" | head -12); do
    n=$((n + 1)); joblog "$j" > "$BASE/job.log"
    grep -qE 'Tests +[0-9]+ passed' "$BASE/job.log" && grep -qE '✓.*\.db\.test\.ts' "$BASE/job.log" && ! grep -qE 'Tests .*skipped' "$BASE/job.log" && { h=1; break; }
  done
  echo "T15 $img $url $sec $h"
}
t16() {
  local co st in needs coe h
  co=$(jobs_with 'uses: actions/checkout'); st=$(jobs_with 'uses: actions/setup-node'); in=$(jobs_with 'run: pnpm install --frozen-lockfile')
  needs=$(printf '%s\n' "$YML" | grep -cE '^    needs:'); coe=$(printf '%s\n' "$YML" | grep -c 'continue-on-error')
  need_hist T16 || return
  h=$(awk -F'\t' '{t[$1]++; if ($7 == "failure") f[$1]++; if ($7 == "skipped" || $7 == "cancelled") s[$1]++} END {for (k in f) if (f[k] >= 2 && t[k] >= 5 && !(k in s)) c++; print c + 0}' "$HIST")
  echo "T16 $co $st $in $needs $coe $([ "$h" -ge 1 ] && echo 1 || echo 0)"
}
t17() {
  need_hist T17 || return
  local n
  n=$(awk -F'\t' '$7 == "failure" && $8 == "Run pnpm install --frozen-lockfile" {r[$1]=r[$1] "|" $6} END {for (k in r) if (r[k] ~ /\|lint/ && r[k] ~ /\|type check/ && r[k] ~ /\|tests/ && r[k] ~ /\|build/ && r[k] ~ /\|bundle size/) c++; print c + 0}' "$HIST")
  echo "T17 $([ "$n" -ge 1 ] && echo 1 || echo 0)"
}
t18() {
  local grp=0 cip=0 cache c hc=0 hh=0 j
  printf '%s\n' "$YML" | grep -qE 'group: ci-\$\{\{ github\.event\.pull_request\.number \|\| github\.sha \}\}' && grp=1
  printf '%s\n' "$YML" | grep -qE "cancel-in-progress: \\$\\{\\{ github\\.event_name == 'pull_request' \\}\\}" && cip=1
  cache=$(jobs_with 'cache: pnpm')
  need_hist T18 || return
  c=$(awk -F'\t' '$2 == "pull_request" && $4 == "cancelled" {print $1 "\t" $3 "\t" $5}' "$HIST" | sort -u | while IFS=$'\t' read -r id br cr; do awk -F'\t' -v b="$br" -v t="$cr" '$2 == "pull_request" && $3 == b && $5 > t {found=1} END {exit !found}' "$HIST" && echo 1; done | head -1)
  [ -n "$c" ] && hc=1
  for j in $(awk -F'\t' '$4 == "success" && $6 == "lint" {print $9}' "$HIST" | head -40); do
    joblog "$j" > "$BASE/job.log"; grep -q 'Cache hit for: node-cache' "$BASE/job.log" && { hh=1; break; }
  done
  echo "T18 $grp $cip $cache $hc $hh"
}
t19() {
  local n
  n=$(printf '%s\n' "$YML" | grep -cE 'changed\.sh|paths-filter')
  echo "T19 $([ "$n" -ge 1 ] && echo 1 || echo 0)"
}

rows="${*:-T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12 T13 T14 T15 T16 T17 T18 T19}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
alive=0; for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
cleanup; WT=""
echo "CLEAN worktrees $([ "$(git worktree list | wc -l | tr -d ' ')" = "$before_wt" ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive temporary-folder $([ -e "$BASE" ] && echo left || echo removed)"
