#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-001.md. No network except the package registry
# through `pnpm install --frozen-lockfile`; no model.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-001.checks.sh [T1 T2 ...]
# It reads files of the commit V with `git show`. Rows that run a tool (install, type check,
# `pnpm dev`) use a temporary worktree of V, created on first use and removed when the script
# ends, even when a row fails. The repository itself is not changed. It prints one line for
# each row: counts, names, exit codes and words. Install output is never kept, only the exit
# code and whether it names a version problem.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack so the
# `packageManager` pin decides its version.
set -uo pipefail
V="${V:-HEAD}"
doc() { git show "$V:$1" 2>/dev/null; }
PROJECTS="apps/server apps/web packages/shared packages/client-core packages/tokens packages/i18n packages/platform packages/ui-web"
NAMES="@toki/server @toki/web @toki/shared @toki/client-core @toki/tokens @toki/i18n @toki/platform @toki/ui-web"

before_wt=$(git worktree list | wc -l | tr -d ' ')
before_status=$(git status --porcelain | wc -l | tr -d ' ')
WT=""; WT2=""; TMPS=""
cleanup() {
  local d
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
  [ -n "$WT2" ] && git worktree remove --force "$WT2" >/dev/null 2>&1
  for d in $TMPS; do rm -rf "$d"; done
  git worktree prune >/dev/null 2>&1
}
trap cleanup EXIT

# Node bins: N22 (empty means the default node is 22), NOT22 (a Node of another major).
N22=""; NEED22=0; NOT22=""
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  N22=$(ls -d "$HOME"/.nvm/versions/node/v22*/bin 2>/dev/null | tail -1)
  [ -n "$N22" ] || NEED22=1
  NOT22=$(dirname "$(command -v node 2>/dev/null)" 2>/dev/null)
else
  NOT22=$(ls -d "$HOME"/.nvm/versions/node/v*/bin 2>/dev/null | grep -v '/v22' | tail -1)
fi
pn() { # run corepack pnpm in $1 (a directory) under Node 22
  local dir="$1"; shift
  ( cd "$dir" && PATH="${N22:+$N22:}$PATH" corepack pnpm "$@" )
}
newwt() { # print the path of a new temporary worktree of V
  local d; d=$(mktemp -d); TMPS="$TMPS $d"
  git worktree add --detach "$d/wt" "$V" >/dev/null 2>&1 && echo "$d/wt"
}
INSTALL_RC=""
ensure() { # the main temporary worktree, installed once
  [ "$NEED22" = 1 ] && return 1
  if [ -z "$WT" ]; then WT=$(newwt); [ -n "$WT" ] || return 1; fi
  if [ -z "$INSTALL_RC" ]; then pn "$WT" install --frozen-lockfile >/dev/null 2>&1; INSTALL_RC=$?; fi
  return 0
}
need() { # prints the Blocked line and returns 1 when a tool row cannot run
  ensure && return 0
  echo "$1 needs Node 22 and a worktree of $V (Blocked)"; return 1
}
restore() { ( cd "$WT" && git checkout -q -- . ); }

t1() {
  local g=0 ws; ws=$(doc pnpm-workspace.yaml)
  printf '%s\n' "$ws" | grep -qF 'apps/*' && printf '%s\n' "$ws" | grep -qF 'packages/*' && g=1
  need T1 || return
  echo "T1 $g $INSTALL_RC"
}
t2() {
  need T2 || return
  local found diff
  found=$(pn "$WT" ls -r --depth -1 --json 2>/dev/null | jq -r '.[].name' | grep -v '^toki$' | sort)
  diff=$(diff <(printf '%s\n' "$found") <(printf '%s\n' $NAMES | sort) | grep -c '^[<>]')
  echo "T2 $(printf '%s\n' "$found" | grep -c .) $diff"
}
t3() {
  local n=0 p
  for p in apps/mobile apps/desktop packages/ui-native; do [ -n "$(git ls-tree -r --name-only "$V" -- "$p")" ] && n=$((n + 1)); done
  echo "T3 $n"
}
t4() {
  local ok=0 files bad=0 p f exp
  files=$(git ls-tree -r --name-only "$V" -- apps packages | grep -c .)
  for p in $PROJECTS; do
    local list pj good=1
    list=$(git ls-tree -r --name-only "$V" -- "$p" | sort | tr '\n' ' ')
    [ "$list" = "$p/package.json $p/src/index.ts $p/tsconfig.json " ] || good=0
    pj=$(doc "$p/package.json")
    [ "$(printf '%s' "$pj" | jq -r '.private')" = "true" ] || good=0
    [ "$(printf '%s' "$pj" | jq -r '.type')" = "module" ] || good=0
    case "$p" in packages/*) [ "$(printf '%s' "$pj" | jq -c '.exports')" = '{".":"./src/index.ts"}' ] || good=0 ;; esac
    [ "$(doc "$p/src/index.ts")" = "export {};" ] || good=0
    if [ "$good" = 1 ]; then ok=$((ok + 1)); else bad=$((bad + 1)); fi
  done
  echo "T4 $ok $files $bad"
}
t5() {
  local base n=0 ext=0 forb=0 p
  base=$(doc tsconfig.base.json)
  [ "$(printf '%s' "$base" | jq -r '.compilerOptions.strict')" = "true" ] && n=$((n + 1))
  [ "$(printf '%s' "$base" | jq -r '.compilerOptions.module')" = "ESNext" ] && n=$((n + 1))
  [ "$(printf '%s' "$base" | jq -r '.compilerOptions.moduleResolution')" = "Bundler" ] && n=$((n + 1))
  [ "$(printf '%s' "$base" | jq -r '.compilerOptions.noEmit')" = "true" ] && n=$((n + 1))
  for p in $PROJECTS; do
    doc "$p/tsconfig.json" | grep -q '"extends"[[:space:]]*:[[:space:]]*"[./]*tsconfig.base.json"' && ext=$((ext + 1))
    forb=$((forb + $(doc "$p/tsconfig.json" | grep -cE '"(strict|target|module|moduleResolution)"')))
  done
  echo "T5 $n $ext $forb"
}
t6() { need T6 || return; pn "$WT" typecheck >/dev/null 2>&1; echo "T6 $?"; }
t7() {
  need T7 || return
  local nonzero=0 printed=0 p out rc
  for p in $PROJECTS; do
    printf '\nconst x: number = "a";\n' >> "$WT/$p/src/index.ts"
    out=$(pn "$WT" typecheck 2>&1); rc=$?
    [ "$rc" -ne 0 ] && nonzero=$((nonzero + 1))
    printf '%s\n' "$out" | grep -q "$p.*src/index.ts" && printed=$((printed + 1))
    restore
  done
  echo "T7 $nonzero $printed"
}
t8() {
  local pj; pj=$(doc package.json)
  echo "T8 $(printf '%s' "$pj" | jq -r '.engines.node') $(printf '%s' "$pj" | jq -r '.devEngines.runtime.version') $(printf '%s' "$pj" | jq -r '.devEngines.runtime.onFail') $(doc .nvmrc | tr -d '[:space:]')"
}
t9() {
  [ -n "$NOT22" ] || { echo "T9 needs a Node that is not 22 (Blocked)"; return; }
  [ "$NEED22" = 1 ] && { echo "T9 needs Node 22 for the corepack pin (Blocked)"; return; }
  WT2=$(newwt); [ -n "$WT2" ] || { echo "T9 no worktree (Blocked)"; return; }
  local out rc nz=0 mention=0 nm=0
  out=$( cd "$WT2" && PATH="$NOT22:$PATH" corepack pnpm install --frozen-lockfile 2>&1 ); rc=$?
  [ "$rc" -ne 0 ] && nz=1
  printf '%s\n' "$out" | grep -qiE 'runtime|node.*(version|required|22)|unsupported' && mention=1
  [ -d "$WT2/node_modules" ] && nm=1
  echo "T9 $nz $mention $nm"
  printf '%s\n' "$out" | grep -m1 -iE 'runtime|node.*(version|required|22)|unsupported' | sed 's/^/  first error line: /' | cut -c1-200
}
t10() {
  need T10 || return
  local pm ok1=0 ok2=0 ok3=0 other
  pm=$(doc package.json | jq -r '.packageManager')
  printf '%s' "$pm" | grep -qE '^pnpm@[0-9]+\.[0-9]+\.[0-9]+$' && ok1=1
  [ "$(pn "$WT" --version 2>/dev/null)" = "${pm#pnpm@}" ] && ok2=1
  git ls-tree --name-only "$V" -- pnpm-lock.yaml | grep -q . && ok3=1
  other=$(git ls-tree --name-only "$V" -- package-lock.json yarn.lock | grep -c .)
  echo "T10 $ok1 $ok2 $ok3 $other"
}
t11() {
  need T11 || return
  local dep=0 ok=0 a
  for a in apps/server apps/web; do
    [ "$(doc "$a/package.json" | jq -r '.dependencies["@toki/shared"]')" = "workspace:*" ] && dep=$((dep + 1))
    printf 'import {} from "@toki/shared";\n' >> "$WT/$a/src/index.ts"
    pn "$WT" typecheck >/dev/null 2>&1 && ok=$((ok + 1))
    restore
  done
  echo "T11 $dep $ok"
}
t12() {
  need T12 || return
  local exact=0 a=0 b=0 tmp left p
  [ "$(doc .gitignore)" = "$(printf 'node_modules\ndist\n.env\n.env.*\n!.env.example')" ] && exact=1
  tmp=$(mktemp -d); TMPS="$TMPS $tmp"; git init -q "$tmp"; doc .gitignore > "$tmp/.gitignore"
  for p in .env .env.local; do (cd "$tmp" && git check-ignore -q "$p") && a=$((a + 1)); done
  (cd "$tmp" && git check-ignore -q .env.example) && b=1
  pn "$WT" typecheck >/dev/null 2>&1
  left=$(cd "$WT" && git status --porcelain | wc -l | tr -d ' ')
  echo "T12 $exact $a $b $left"
}
t13() {
  need T13 || return
  local exact=0 devs=0 p rc
  [ "$(doc package.json | jq -r '.scripts.dev')" = "pnpm -r --parallel --if-present run dev" ] && exact=1
  for p in $PROJECTS; do [ "$(doc "$p/package.json" | jq -r '.scripts.dev // empty')" != "" ] && devs=$((devs + 1)); done
  pn "$WT" dev >/dev/null 2>&1; rc=$?
  echo "T13 $exact $devs $rc"
}

rows="${*:-T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12 T13}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
cleanup; WT=""; WT2=""; TMPS=""
echo "CLEAN worktrees $([ "$(git worktree list | wc -l | tr -d ' ')" = "$before_wt" ] && echo same || echo changed) status $([ "$(git status --porcelain | wc -l | tr -d ' ')" = "$before_status" ] && echo same || echo changed)"
