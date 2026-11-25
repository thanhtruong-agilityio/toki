#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-002.md. No network except the package registry
# through `pnpm install --frozen-lockfile`; no model.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-002.checks.sh [T1 T2 ...]
# It reads files of the commit V with `git show`. Every row that runs ESLint or Prettier uses
# one temporary worktree of V, created on first use and removed when the script ends, even
# when a row fails; a row that adds files to it restores it afterwards. The repository itself
# is not changed. It prints one line for each row: counts, exit codes and words. Tool output
# is never kept.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack so the
# `packageManager` pin decides its version.
set -uo pipefail
V="${V:-HEAD}"
doc() { git show "$V:$1" 2>/dev/null; }
BOUNDARY='^(toki/|no-restricted-|@typescript-eslint/no-restricted-imports)'
PORTABLE="client-core shared i18n tokens"

before_wt=$(git worktree list | wc -l | tr -d ' ')
before_status=$(git status --porcelain | wc -l | tr -d ' ')
WT=""; TMPS=""
cleanup() {
  local d
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
pn() { ( cd "$WT" && PATH="${N22:+$N22:}$PATH" corepack pnpm "$@" ); }
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
put() { mkdir -p "$(dirname "$WT/$1")"; printf '%s\n' "$2" > "$WT/$1"; }
lintj() { pn exec eslint -f json "$@" 2>/dev/null; } # JSON on standard output
fired() { # $1 JSON, $2 relative file: has an error from a boundary rule
  printf '%s' "$1" | jq -e --arg f "$2" '[.[] | select(.filePath | endswith($f)) | .messages[] | select(.severity == 2 and ((.ruleId // "") | test("'"$BOUNDARY"'")))] | length > 0' >/dev/null 2>&1
}
clean() { # $1 JSON, $2 relative file: no message at all
  printf '%s' "$1" | jq -e --arg f "$2" '[.[] | select(.filePath | endswith($f)) | .messages[]] | length == 0' >/dev/null 2>&1
}

# ---- case lists -------------------------------------------------------------
# The 15 globals cases of R5; one file body for each. Echoes "name|body" lines.
globals_cases() {
  local g
  for g in window document localStorage navigator location matchMedia; do echo "bare-$g|export const v = $g;"; done
  echo 'win-document|export const v = window.document;'
  echo 'glob-document|export const v = globalThis.document;'
  echo 'self-document|export const v = self.document;'
  echo 'destruct|const { document } = window; export const v = document;'
  for g in Window Document Element HTMLElement SVGSVGElement; do echo "type-$g|export type T = $g;"; done
}
fire_cases() { # $1 package dir, $2 cases function; writes files, prints "fired tried"
  local pkg="$1" fn="$2" line name body files="" tried=0 n=0 json f
  while IFS='|' read -r name body; do
    [ -n "$name" ] || continue
    f="$pkg/src/zz-$name.ts"; put "$f" "$body"; files="$files $f"; tried=$((tried + 1))
  done <<< "$($fn)"
  json=$(lintj $files)
  for f in $files; do fired "$json" "$f" && n=$((n + 1)); done
  echo "$n $tried"
}

t1() {
  need T1 || return
  local rc ign=0
  pn lint >/dev/null 2>&1; rc=$?
  put dist/zz-ignored.ts 'export const v = window; export  const   w=1'
  put packages/client-core/dist/zz-ignored.ts 'export const v = window;'
  pn lint >/dev/null 2>&1 && ign=1
  reset_wt
  echo "T1 $rc $ign"
}
t2() {
  need T2 || return
  local ok=0 p rule w=0 pc
  for p in "packages/client-core/src/index.ts:toki/client-core-globals" "packages/ui-web/src/index.ts:toki/platform-apis" "apps/server/src/app.ts:toki/module-entry"; do
    rule="${p#*:}"; pc=$(pn exec eslint --print-config "${p%%:*}" 2>/dev/null)
    printf '%s' "$pc" | jq -e --arg r "$rule" '.rules[$r][0] | (. == 2 or . == "error")' >/dev/null 2>&1 && ok=$((ok + 1))
  done
  put packages/client-core/src/zz-warn.ts $'// eslint-disable-next-line\nexport const a = 1;'
  pn lint >/dev/null 2>&1 || w=1
  reset_wt
  echo "T2 $ok $w"
}
t3() { echo "T3 $(doc eslint.config.js | grep -ci 'file picking' | awk '{print ($1 > 0) ? 1 : 0}')"; }
t4() {
  need T4 || return
  local rc bad=0 named=0 out
  pn format:check >/dev/null 2>&1; rc=$?
  put apps/web/src/zz-bad.ts 'export  const   a   =  1'
  out=$(pn format:check 2>&1); [ $? -ne 0 ] && bad=1
  printf '%s\n' "$out" | grep -q 'zz-bad.ts' && named=1
  reset_wt
  echo "T4 $rc $bad $named"
}
t5() {
  need T5 || return
  local fc
  put packages/shared/src/zz-fmt.ts 'export  const   a   =  1'
  pn format >/dev/null 2>&1
  pn format:check >/dev/null 2>&1; fc=$?
  reset_wt
  echo "T5 $fc"
}
t17() {
  need T17 || return
  local le
  put packages/shared/src/zz-fmt.ts 'export  const   a   =  1'
  pn format >/dev/null 2>&1
  pn exec eslint packages/shared/src/zz-fmt.ts >/dev/null 2>&1; le=$?
  reset_wt
  echo "T17 $le"
}
t6() {
  need T6 || return
  local fired=0 tried=0 allowed=0 p r f
  for p in $PORTABLE; do
    r=$(fire_cases "packages/$p" globals_cases); fired=$((fired + ${r% *})); tried=$((tried + ${r#* }))
    f="packages/$p/src/zz-allowed.ts"; put "$f" 'export const ok = [console, fetch, setTimeout, URL, new Map()];'
    clean "$(lintj "$f")" "$f" && allowed=$((allowed + 1))
    reset_wt
  done
  echo "T6 $fired $tried $allowed"
}
t7() {
  need T7 || return
  local r; r=$(fire_cases packages/platform globals_cases); reset_wt; echo "T7 $r"
}
imports_cases() {
  echo 'react-dom|import "react-dom";'
  echo 'react-dom-client|import "react-dom/client";'
  echo 'ui-web|import "@toki/ui-web";'
  echo 'ui-web-sub|import "@toki/ui-web/button";'
  echo 'ui-web-rel|import "../../ui-web/src/index";'
  echo 'dynamic|export const p = import("react-dom");'
}
platform_web_cases() {
  echo 'platform-web|import "@toki/platform/web";'
  echo 'platform-web-sub|import "@toki/platform/web/storage";'
  echo 'platform-web-rel|import "../../platform/src/web/index";'
}
t8() {
  need T8 || return
  local fired=0 tried=0 p r
  for p in $PORTABLE; do r=$(fire_cases "packages/$p" imports_cases); fired=$((fired + ${r% *})); tried=$((tried + ${r#* })); reset_wt; done
  echo "T8 $fired $tried"
}
t9() {
  need T9 || return
  local fired=0 tried=0 p r
  for p in $PORTABLE; do r=$(fire_cases "packages/$p" platform_web_cases); fired=$((fired + ${r% *})); tried=$((tried + ${r#* })); reset_wt; done
  echo "T9 $fired $tried"
}
mod_files() {
  put apps/server/src/modules/a/index.ts 'export const a = 1;'
  put apps/server/src/modules/a/deep/y.ts 'export const y = 1;'
  put apps/server/src/modules/b/index.ts 'export const b = 1;'
  put apps/server/src/modules/b/inner.ts 'export const inner = 1;'
  put apps/server/src/modules/b/db/index.ts 'export const db = 1;'
}
t10() {
  need T10 || return
  mod_files
  put apps/server/src/modules/a/zz-c1.ts 'import "../b/inner";'
  put apps/server/src/modules/a/zz-c2.ts 'import "../b/db/index";'
  put apps/server/src/modules/a/zz-c3.ts 'import "./deep/y";'
  local j f=0 pass=0
  j=$(lintj apps/server/src/modules/a/zz-c1.ts apps/server/src/modules/a/zz-c2.ts apps/server/src/modules/a/zz-c3.ts)
  fired "$j" apps/server/src/modules/a/zz-c1.ts && f=$((f + 1))
  fired "$j" apps/server/src/modules/a/zz-c2.ts && f=$((f + 1))
  fired "$j" apps/server/src/modules/a/zz-c3.ts || pass=1
  reset_wt
  echo "T10 $f 2 $pass"
}
t11() {
  need T11 || return
  mod_files
  put apps/server/src/modules/a/zz-c4.ts 'import "../b";'
  put apps/server/src/modules/a/zz-c5.ts 'import "../b/index";'
  put apps/server/src/modules/a/zz-c6.ts 'import "../b/index.js";'
  local j ok=0 f
  j=$(lintj apps/server/src/modules/a/zz-c4.ts apps/server/src/modules/a/zz-c5.ts apps/server/src/modules/a/zz-c6.ts)
  for f in zz-c4 zz-c5 zz-c6; do fired "$j" "apps/server/src/modules/a/$f.ts" || ok=$((ok + 1)); done
  reset_wt
  echo "T11 $ok 3"
}
t12() {
  need T12 || return
  mod_files
  put apps/server/src/zz-shared.ts 'import "./modules/b/inner";'
  put apps/server/src/zz-shared-ok.ts 'import "./modules/b/index";'
  local j f=0 pass=0
  j=$(lintj apps/server/src/zz-shared.ts apps/server/src/zz-shared-ok.ts)
  fired "$j" apps/server/src/zz-shared.ts && f=1
  fired "$j" apps/server/src/zz-shared-ok.ts || pass=1
  reset_wt
  echo "T12 $f 1 $pass"
}
ui_cases() {
  local g
  for g in Notification localStorage sessionStorage indexedDB Audio AudioContext caches; do echo "bare-$g|export const v = $g;"; done
  echo 'sw|export const v = navigator.serviceWorker;'
  echo 'cookie|export const v = document.cookie;'
  echo 'win-ls|export const v = window.localStorage;'
  echo 'glob-ls|export const v = globalThis.localStorage;'
  echo 'self-ls|export const v = self.localStorage;'
  echo 'win-sw|export const v = window.navigator.serviceWorker;'
  echo 'destruct|const { localStorage } = window; export const v = localStorage;'
  echo 'audio|export const V = () => <audio />;'
}
t13() {
  need T13 || return
  local line name body files="" tried=0 n=0 j f
  while IFS='|' read -r name body; do
    [ -n "$name" ] || continue
    f="packages/ui-web/src/zz-$name.tsx"; put "$f" "$body"; files="$files $f"; tried=$((tried + 1))
  done <<< "$(ui_cases)"
  j=$(lintj $files)
  for f in $files; do fired "$j" "$f" && n=$((n + 1)); done
  reset_wt
  echo "T13 $n $tried"
}
t14() {
  need T14 || return
  put packages/ui-web/src/zz-ok.tsx 'import { notify } from "@toki/platform"; export const v = notify;'
  local j e
  j=$(lintj packages/ui-web/src/zz-ok.tsx)
  e=$(printf '%s' "$j" | jq '[.[].messages[] | select(.severity == 2)] | length')
  reset_wt
  echo "T14 $e"
}
t15() {
  need T15 || return
  local okp=0 tried=0 okg=0 spec pc rule path
  for spec in "packages/client-core/src/index.ts:toki/client-core-globals" "packages/shared/src/index.ts:toki/client-core-globals" \
              "packages/i18n/src/index.ts:toki/client-core-globals" "packages/tokens/src/index.ts:toki/client-core-globals" \
              "packages/ui-web/src/index.ts:toki/platform-apis" "apps/server/src/modules/example/index.ts:toki/module-entry" \
              "apps/server/src/app.ts:toki/module-entry"; do
    path="${spec%%:*}"; rule="${spec#*:}"; tried=$((tried + 1))
    pc=$(pn exec eslint --print-config "$path" 2>/dev/null)
    printf '%s' "$pc" | jq -e --arg r "$rule" '(.rules[$r][0] | (. == 2 or . == "error")) and (.linterOptions.noInlineConfig == true)' >/dev/null 2>&1 && okp=$((okp + 1))
    case "$path" in
      packages/ui-web/*|apps/*) ;;
      *) printf '%s' "$pc" | jq -e '(.languageOptions.globals | keys) as $k
          | (["console","setTimeout","clearTimeout","setInterval","clearInterval","queueMicrotask","fetch","Headers","Request","Response","WebSocket","URL","URLSearchParams","AbortController","AbortSignal","Object","Promise"] | all(. as $g | $k | index($g)))
          and (["window","document","localStorage","navigator","location","matchMedia","self"] | all(. as $g | ($k | index($g)) == null))
          and ((.languageOptions.globals.globalThis // "off") | tostring | test("off|false"))' >/dev/null 2>&1 && okg=$((okg + 1)) ;;
    esac
  done
  echo "T15 $okp $tried $okg"
}
t16() {
  need T16 || return
  local still=0 msg=0 failed=0 i f j body
  i=0
  while IFS= read -r body; do
    i=$((i + 1)); f="packages/client-core/src/zz-inline$i.ts"
    put "$f" "$(printf '%b' "$body")"
    j=$(lintj "$f")
    fired "$j" "$f" && still=$((still + 1))
    printf '%s' "$j" | jq -e '[.[].messages[] | select(.ruleId == null and (.line // 0) > 0 and (.message | test("inline|comment|directive"; "i")))] | length > 0' >/dev/null 2>&1 && msg=$((msg + 1))
    pn exec eslint --max-warnings 0 "$f" >/dev/null 2>&1 || failed=$((failed + 1))
  done <<'CASES'
// eslint-disable-next-line\nexport const v = window;
export const v = window; // eslint-disable-line
/* eslint-disable */\nexport const v = window;
/* eslint toki/client-core-globals: off */\nexport const v = window;
/* global window */\nexport const v = window;
CASES
  reset_wt
  echo "T16 $still $msg $failed"
}

rows="${*:-T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12 T13 T14 T15 T16 T17}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
cleanup; WT=""; TMPS=""
echo "CLEAN worktrees $([ "$(git worktree list | wc -l | tr -d ' ')" = "$before_wt" ] && echo same || echo changed) status $([ "$(git status --porcelain | wc -l | tr -d ' ')" = "$before_status" ] && echo same || echo changed)"
