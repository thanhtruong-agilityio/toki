#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-016.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile` (served from the pnpm store when it is warm) and, for one row, a
# read-only `gh pr view`. Connections to a Vite dev server and to the server of the Playwright config on
# 127.0.0.1. It writes nothing to GitHub and opens no pull request.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-016.checks.sh [T1 T2 ...]
#   V=<commit> bash docs/qa/TOKI-016.checks.sh serve   starts the preview page for the manual rows, prints
#                                                      its addresses and waits for Enter.
# It reads files of the commit V with `git show`. Rows that run a tool use ONE temporary worktree of V,
# created on first use under one folder (BASE, made in the current shell, exported as TMPDIR and given to
# every process it starts through `env -i`), installed with `pnpm install --frozen-lockfile` under Node 22.
# The browser rows run the ticket's own browser test, e2e/component-preview.spec.ts, ONCE in that worktree
# (Chromium, the Playwright config of V, which fixes the ports 5173 and 3000: the script never stops a
# process that holds them and prints Blocked when one is busy) and each row reads its tests from the one
# report, by title, and prints passed, failed and skipped counts (a skipped or fixme test is not a pass).
# Rows that must show a check failing change a file of the worktree, run again and restore it with
# `git checkout`; they are paired with the unchanged run. Everything the script started (worktree, folder,
# processes) is removed when it ends, even when a row fails. The repository itself is not changed. No
# `.env` file is read or created. One output line for each row: counts, exit codes and words; no secret and
# no tool output. A row that loops prints how many items it checked. A row that cannot be shown prints
# "(Blocked)" and the reason. Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through
# corepack. The browser is the Chromium that Playwright has cached on the machine.
set -uo pipefail
V="${V:-HEAD}"
doc() { git show "$V:$1" 2>/dev/null; }
exists() { git cat-file -e "$V:$1" 2>/dev/null; }
files() { git ls-tree -r --name-only "$V" -- "$@" 2>/dev/null; }
has() { local n; n=$(doc "$1" | grep -cE -- "$2"); [ "${n:-0}" -ge 1 ]; }
cnt() { local n; n=$(doc "$1" | grep -cE -- "$2"); echo "${n:-0}"; }
WEB="apps/web"
PV="$WEB/src/preview"
E2E="e2e/component-preview.spec.ts"

BASE=$(mktemp -d); export TMPDIR="$BASE"
BASENAME=$(basename "$BASE")
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; PIDS=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; wait "$1" 2>/dev/null; }
sweep() { pkill -f "$BASENAME" >/dev/null 2>&1; sleep 0.3; pkill -9 -f "$BASENAME" >/dev/null 2>&1; }
cleanup() {
  local p
  for p in $PIDS; do kill_tree "$p"; done
  PIDS=""
  sweep
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
  WT=""
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
# mut <file> <perl expression>: changes a file of the worktree; true when it changed
mut() { perl -0pi -e "$2" "$WT/$1"; ( cd "$WT" && ! git diff --quiet -- "$1" ); }
freeport() { python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'; }
portbusy() { python3 -c 'import socket,sys; s = socket.socket(); s.settimeout(1); r = s.connect_ex(("127.0.0.1", int(sys.argv[1]))); print("busy" if r == 0 else "free")' "$1"; }
firstline() { head -1 | tr -d '\r' | cut -c1-160; }

# ---- the helpers written into the temporary folder ----------------------------------------------------------
SUM="$BASE/sum.mjs"
cat > "$SUM" <<'JS'
// node sum.mjs pw|vt <report.json> <regex>: prints "passed failed skipped" (and, for pw, the number of
// annotations of the type table-b2-unmatched) of the tests whose full title matches the regex.
import fs from "node:fs";
const [, , kind, file, re] = process.argv;
const R = new RegExp(re);
let p = 0, f = 0, s = 0, a = 0;
const data = JSON.parse(fs.readFileSync(file, "utf8"));
if (kind === "pw") {
  const walk = (suite, path) => {
    const here = suite.file && suite.title === suite.file ? path : path.concat(suite.title);
    for (const spec of suite.specs || []) {
      const full = here.concat(spec.title).join(" > ");
      if (!R.test(full)) continue;
      for (const t of spec.tests || []) {
        const last = t.results.length ? t.results[t.results.length - 1].status : "none";
        if (t.status === "expected" && last === "passed") p++;
        else if (t.status === "skipped") s++;
        else f++;
        for (const an of t.annotations || []) if (an.type === "table-b2-unmatched") a++;
      }
    }
    for (const c of suite.suites || []) walk(c, here);
  };
  for (const top of data.suites || []) walk(top, []);
  console.log(`${p} ${f} ${s} ${a}`);
} else {
  for (const tr of data.testResults || []) {
    for (const t of tr.assertionResults || []) {
      const full = (t.ancestorTitles || []).concat(t.title).join(" > ");
      if (!R.test(full)) continue;
      if (t.status === "passed") p++;
      else if (t.status === "failed") f++;
      else s++;
    }
  }
  console.log(`${p} ${f} ${s}`);
}
JS

STATIC="$BASE/static.mjs"
cat > "$STATIC" <<'JS'
// node static.mjs <command> <V> [text to add]: reads files of the commit V with `git show` and prints counts.
//   imports  names imported by the page's own files from @toki/ui-web and @toki/tokens, names outside the
//            allowed lists, files scanned, files outside src/preview that import the examples or the page
//   css      selectors of preview.css, selectors that are not .pv-*, body or :root
//   pin      the three devDependencies of apps/web pinned to the version of packages/ui-web (1 each)
import { execFileSync } from "node:child_process";
const [, , cmd, V, add] = process.argv;
const git = (...a) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const show = (p) => git("show", `${V}:${p}`);
const list = (dir) => git("ls-tree", "-r", "--name-only", V, "--", dir).split("\n").filter(Boolean);
const isCode = (p) => /\.(ts|tsx)$/.test(p);
const isTest = (p) => /\.test\.(ts|tsx)$/.test(p);
function importsOf(text) {
  const out = [];
  const re = /import\s+(?:type\s+)?(?:([\w*\s{},]+?)\s+from\s+)?["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(text))) {
    const names = [];
    const braces = /\{([^}]*)\}/.exec(m[1] || "");
    if (braces) for (const part of braces[1].split(",")) { const n = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim(); if (n) names.push(n); }
    out.push({ source: m[2], names });
  }
  return out;
}
if (cmd === "imports") {
  const dir = "apps/web/src/preview";
  const sources = list(dir).filter((p) => isCode(p) && !isTest(p));
  const ui = new Set(), tok = new Set();
  let bad = 0;
  const allowUi = new Set(["componentExamples", "Icon", "iconNames", "ToastProvider", "useToasts"]);
  const allowTok = new Set(["looks", "accents", "densities"]);
  sources.forEach((p, i) => {
    let text = show(p);
    if (add && i === 0) text = add + "\n" + text;
    for (const e of importsOf(text)) {
      if (e.source === "@toki/ui-web" || e.source === "@toki/ui-web/examples") {
        for (const n of e.names) { ui.add(n); if (!allowUi.has(n)) bad++; }
        if (e.source === "@toki/ui-web/examples" && e.names.join() !== "componentExamples") bad++;
      } else if (e.source === "@toki/tokens") {
        for (const n of e.names) { tok.add(n); if (!allowTok.has(n)) bad++; }
      } else if (/^@toki\/ui-web/.test(e.source) && e.source !== "@toki/ui-web/base.css") bad++;
      else if (/^@toki\/tokens\//.test(e.source) && e.source !== "@toki/tokens/tokens.css") bad++;
    }
  });
  const outside = list("apps/web/src").filter((p) => isCode(p) && !p.startsWith(dir + "/"));
  let leak = 0;
  for (const p of outside) for (const e of importsOf(show(p))) if (/ui-web\/examples/.test(e.source) || /(^|\/)preview(\/|$)/.test(e.source)) leak++;
  console.log(`${ui.size} ${tok.size} ${bad} ${sources.length} ${leak}`);
} else if (cmd === "css") {
  let css = show("apps/web/src/preview/preview.css");
  if (add) css += "\n" + add + "\n";
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const sel = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      const pre = css.slice(start, i).trim();
      if (pre && !pre.startsWith("@")) for (const part of pre.split(",")) sel.push(part.trim());
      start = i + 1;
    } else if (ch === "}" || ch === ";") start = i + 1;
  }
  const badSel = sel.filter((s) => !/^(?:\.pv-[\w-]+|body|:root)(?![\w-])/.test(s));
  console.log(`${sel.length} ${badSel.length}`);
} else if (cmd === "pin") {
  const a = JSON.parse(show("apps/web/package.json")).devDependencies || {};
  const b = JSON.parse(show("packages/ui-web/package.json"));
  const bd = { ...(b.devDependencies || {}), ...(b.dependencies || {}) };
  const same = ["jsdom", "@testing-library/react", "@testing-library/dom"].map((n) => (a[n] && a[n] === bd[n] && /^\d/.test(a[n]) ? 1 : 0));
  console.log(same.join(" "));
}
JS
sumpw() { nodebin "$SUM" pw "$BASE/pw-$1.json" "$2"; }
sumvt() { nodebin "$SUM" vt "$BASE/vt-$1.json" "$2"; }
stat_() { nodebin "$STATIC" "$@" 2>/dev/null; }

# ---- the browser test: ONE run of the ticket's own spec, and the mutated runs --------------------------------
PW_ERR=""; PW_DONE=""
pw_run() { # <name> [grep regex]: runs the ticket's browser test, the report goes to $BASE/pw-<name>.json
  local name="$1" g="${2:-}" args=(exec playwright test "$E2E" --reporter=json)
  [ -n "$g" ] && args+=(--grep "$g")
  rm -f "$BASE/pw-$name.json"
  pnenv PLAYWRIGHT_JSON_OUTPUT_NAME="$BASE/pw-$name.json" -- "${args[@]}" > "$BASE/pw-$name.out" 2>&1
  [ -s "$BASE/pw-$name.json" ]
}
pw_ready() {
  [ -n "$PW_DONE" ] && return 0
  [ -n "$PW_ERR" ] && return 1
  ensure || { PW_ERR="Node 22 or the install of the worktree is not available"; return 1; }
  local p
  for p in 5173 3000; do
    if [ "$(portbusy "$p")" = busy ]; then PW_ERR="port $p is busy and the script never stops another process"; return 1; fi
  done
  if pw_run full; then PW_DONE=1; return 0; fi
  PW_ERR="the browser test did not write a report: $(grep -m1 -iE 'error|cannot|not found' "$BASE/pw-full.out" 2>/dev/null | firstline)"
  return 1
}
pw_need() { pw_ready && return 0; echo "$1 the browser test could not run: $PW_ERR (Blocked)"; return 1; }
# mutrun <name> <grep> <file> <perl>: changes one file, runs the filtered browser test, restores the file;
# prints nothing, the report is $BASE/pw-<name>.json (absent when the change did not apply)
mutrun() {
  rm -f "$BASE/pw-$1.json"
  if mut "$3" "$4"; then pw_run "$1" "$2"; fi
  reset_wt
}
mutpair() { # <name> <regex>: "passed failed" of the mutated run, or "0 0 (the change did not apply)"
  if [ -s "$BASE/pw-$1.json" ]; then sumpw "$1" "$2" | awk '{print $1, $2}'; else echo "x x"; fi
}

VT_DONE=""; VT_ERR=""
vt_run() { # <name>: the Vitest files of apps/web (node and jsdom), report in $BASE/vt-<name>.json
  rm -f "$BASE/vt-$1.json"
  pnenv -- --filter ./apps/web exec vitest run --reporter=json --outputFile="$BASE/vt-$1.json" > "$BASE/vt-$1.out" 2>&1
  [ -s "$BASE/vt-$1.json" ]
}
vt_need() {
  [ -n "$VT_DONE" ] && return 0
  [ -n "$VT_ERR" ] || ensure || VT_ERR="Node 22 or the install of the worktree is not available"
  [ -n "$VT_ERR" ] && { echo "$1 the Vitest run could not start: $VT_ERR (Blocked)"; return 1; }
  vt_run full && { VT_DONE=1; return 0; }
  VT_ERR="the Vitest run wrote no report"; echo "$1 the Vitest run could not start: $VT_ERR (Blocked)"; return 1
}

# ---- the build: one run of `pnpm --filter ./apps/web build` in the worktree ----------------------------------
BUILD_RC=""
build_need() {
  need "$1" || return 1
  if [ -z "$BUILD_RC" ]; then pnenv -- --filter ./apps/web build > "$BASE/build.out" 2>&1; BUILD_RC=$?; fi
  return 0
}
DIST() { echo "$WT/$WEB/dist"; }

# ===========================================================================================================
# R1
t1() {
  pw_need T1 || return
  local title meta
  title=$(cnt $WEB/preview.html '<title>Toki component preview</title>')
  meta=$(cnt $WEB/preview.html 'content="width=device-width, initial-scale=1, viewport-fit=cover"')
  echo "T1 $title $meta $(sumpw full 'R1: the page opens' | cut -d' ' -f1-3)"
}
t2() { pw_need T2 || return; echo "T2 $(sumpw full 'R1: the app at /' | cut -d' ' -f1-3)"; }
# R2
t3() {
  pw_need T3 || return
  build_need T3 || return
  local d html onlyindex root name nfiles
  d=$(DIST)
  html=$(find "$d" -name '*.html' | wc -l | tr -d ' ')
  onlyindex=0; [ "$html" = 1 ] && [ -f "$d/index.html" ] && onlyindex=1
  root=$(grep -rlF -- 'preview-root' "$d" 2>/dev/null | wc -l | tr -d ' ')
  name=$(grep -rlF -- 'preview.html' "$d" 2>/dev/null | wc -l | tr -d ' ')
  nfiles=$(find "$d" -type f | wc -l | tr -d ' ')
  echo "T3 $BUILD_RC $html $onlyindex $root $name $nfiles $(sumpw full 'a build holds index.html only' | cut -d' ' -f1-3)"
}
t4() {
  local inp lib
  inp=$(cnt $WEB/vite.config.ts 'rollupOptions|rolldownOptions|input')
  lib=$(cnt $WEB/vite.config.ts '\blib\b[[:space:]]*:')
  echo "T4 $inp $lib"
}
t5() {
  build_need T5 || return
  local d rc1 rc2 n2 rc3 n3 rc4 leak="$BASE/dist-leak" cf="$WEB/vite.config.ts"
  d=$(DIST)
  pnenv -- --filter ./apps/web run check:no-dev-pages > "$BASE/t5a.out" 2>&1; rc1=$?
  # the page added to the build input in the temporary worktree
  if mut "$cf" 's/plugins: \[react\(\)\],/plugins: [react()],\n    build: { rollupOptions: { input: { main: "index.html", preview: "preview.html" } } },/'; then
    pnenv -- --filter ./apps/web run check:no-dev-pages > "$BASE/t5b.out" 2>&1; rc2=$?
    n2=$(grep -q 'preview.html' "$BASE/t5b.out" && echo 1 || echo 0)
  else rc2=x; n2=x; fi
  reset_wt
  # the page left in a copy of the build folder
  rm -rf "$leak"; cp -R "$d" "$leak"
  printf '<div data-testid="preview-root">' > "$leak/preview.html"
  pnenv -- --filter ./apps/web run check:no-dev-pages -- --dist "$leak" > "$BASE/t5c.out" 2>&1; rc3=$?
  n3=$(grep -q 'preview.html' "$BASE/t5c.out" && echo 1 || echo 0)
  rm -rf "$leak"
  pnenv -- --filter ./apps/web run check:no-dev-pages > "$BASE/t5d.out" 2>&1; rc4=$?
  echo "T5 $rc1 $([ "$rc2" != 0 ] && [ "$rc2" != x ] && echo 1 || echo 0) $n2 $([ "$rc3" != 0 ] && echo 1 || echo 0) $n3 $rc4"
}
t6() {
  local last root ci shared
  last=0; doc $WEB/package.json | grep -E '"build"' | grep -qE 'check:no-dev-pages"?[[:space:]]*,?[[:space:]]*$' && last=1
  root=$(cnt package.json '"build": "pnpm -r --if-present run build"')
  ci=$(cnt .github/workflows/ci.yml 'pnpm (run )?build')
  shared=0; has $WEB/scripts/check-no-dev-pages.mjs 'name: "preview.html", marker: "preview-root"' && shared=1
  echo "T6 $last $root $([ "$ci" -ge 1 ] && echo 1 || echo 0) $shared"
}
t7() {
  build_need T7 || return
  pnenv -- run size > "$BASE/t7.out" 2>&1; local rc=$?
  echo "T7 $rc"
}
# R3
t8() { echo "T8 $(cnt $WEB/preview.html 'rel="stylesheet"[^>]*/src/fonts/fonts\.css|/src/fonts/fonts\.css[^>]*rel="stylesheet"')"; }
t9() {
  vt_need T9 || return
  local r
  r=$(doc $PV/main.tsx | grep -E '^import ' | awk '
    { n++; if ($0 ~ /tokens\.css"/) tok = n; else if ($0 ~ /ui-web\/base\.css"/) base = n; else if ($0 ~ /\.\/preview\.css"/) pcss = n; else if ($0 !~ /\.css"/ && !first) first = n }
    END { print (tok == 1 ? 1 : 0), (base == 2 ? 1 : 0), (pcss > base && base > 0 ? 1 : 0), (first > base && base > 0 ? 1 : 0) }')
  echo "T9 $r $(sumvt full 'style order \(R3\) > (main.tsx imports|preview.css is imported|preview.html loads)')"
}
t10() {
  vt_need T10 || return
  local f n=0 hits=0 c
  for f in $(files $WEB/src | grep -E '\.(ts|tsx)$' | grep -v '^apps/web/src/main\.tsx$' | grep -v '\.test\.'); do
    n=$((n + 1)); c=$(doc "$f" | grep -cE '^import .*fonts\.css'); [ "$c" -gt 0 ] && hits=$((hits + 1))
  done
  echo "T10 $n $hits $(sumvt full 'style order \(R3\) > only src/main.tsx')"
}
t11() {
  ensure || { echo "T11 needs Node 22 and an installed worktree of $V (Blocked)"; return; }
  local has=0
  doc $WEB/package.json | grep -q '"check:fonts"' && has=1
  [ "$has" = 0 ] && doc package.json | grep -q '"check:fonts"' && has=1
  pnenv -- --filter ./apps/web run check:fonts > "$BASE/t11.out" 2>&1; local rc=$?
  echo "T11 $has $rc"
}
# R4
t12() { pw_need T12 || return; echo "T12 $(sumpw full 'R4: no address gives calm' | cut -d' ' -f1-3)"; }
t13() { pw_need T13 || return; echo "T13 $(sumpw full 'R4: an address with the three values' | cut -d' ' -f1-3)"; }
t14() { pw_need T14 || return; echo "T14 $(sumpw full 'R4: an unknown value gives the default' | cut -d' ' -f1-3)"; }
t15() {
  pw_need T15 || return
  local sel store
  sel=$(doc $PV/PreviewPage.tsx | grep -c '<select')
  store=0; local f; for f in $(files $PV | grep -E '\.(ts|tsx)$' | grep -v '\.test\.'); do store=$((store + $(doc "$f" | grep -cE 'localStorage|sessionStorage|document\.cookie'))); done
  echo "T15 $sel $store $(sumpw full 'R4: each control changes the attributes' | cut -d' ' -f1-3)"
}
t16() { pw_need T16 || return; echo "T16 $(sumpw full 'R4: the device.s dark setting' | cut -d' ' -f1-3)"; }
t17() {
  vt_need T17 || return
  local call=0 f
  for f in $(files $PV | grep -E '\.(ts|tsx)$' | grep -v '\.test\.'); do call=$((call + $(doc "$f" | grep -cE 'applyAppearance\('))); done
  echo "T17 $call $(sumvt full '(readControls|applyControls and writeAddress) \(R4\)')"
}
# R5, R6
t18() { pw_need T18 || return; echo "T18 $(sumpw full 'R5: one section per entry, in order' | cut -d' ' -f1-3)"; }
t19() {
  pw_need T19 || return
  local ex=0; exists $PV/FontsSection.tsx && ex=1
  echo "T19 $ex $(sumpw full 'R5, R10: the fonts section comes between' | cut -d' ' -f1-3)"
}
t20() {
  pw_need T20 || return
  local re='R6: figures per entry equal data-count'
  mutrun m2 "$re" $PV/ExampleSection.tsx 's/examples\.map\(\(example\)/examples.slice(1).map((example)/'
  echo "T20 $(sumpw full "$re" | cut -d' ' -f1-3) $(mutpair m2 "$re")"
}
# R7
t21() {
  vt_need T21 || return; pw_need T21 || return
  echo "T21 $(sumvt full 'ExampleFigure \(R6, R7\)') $(sumpw full 'R7: no figure failed' | cut -d' ' -f1-3)"
}
t22() {
  local head=0; doc $PV/ExampleFigure.test.tsx | head -1 | grep -q '^// @vitest-environment jsdom' && head=1
  echo "T22 $head $(stat_ pin "$V")"
}
# R8
t23() { pw_need T23 || return; echo "T23 $(sumpw full 'every selector of Table B1 matches' | cut -d' ' -f1-3)"; }
t24() { pw_need T24 || return; echo "T24 $(sumpw full 'Table B2 is reported, not failed')"; }
t25() { pw_need T25 || return; echo "T25 $(sumpw full '(the entries that exist each have a figure|Menu, Modal and Sheet have an entry)' | cut -d' ' -f1-3)"; }
# R9
t26() {
  pw_need T26 || return
  local re='R9: 43 icon cells'
  mutrun m3 "$re" $PV/IconsSection.tsx 's/\{iconNames\.map\(/{iconNames.slice(1).map(/'
  echo "T26 $(sumpw full "$re" | cut -d' ' -f1-3) $(mutpair m3 "$re")"
}
# R10
t27() {
  pw_need T27 || return
  local ex=0 css=0; exists $PV/FontsSection.tsx && ex=1; exists $WEB/src/fonts/fonts.css && css=1
  echo "T27 $ex $css $(sumpw full 'R5, R10: the fonts section comes between' | cut -d' ' -f1-3)"
}
# R11
M1RE='(R11: 32 token rows|the 13 rows hold|Calm and indigo|Focus and indigo)'
m1() {
  [ -n "${M1_DONE:-}" ] && return
  M1_DONE=1
  mutrun m1 "$M1RE" packages/tokens/src/tokens.css 's/#0F766E/#0F766F/g; s/#4F46E5/#4F46E6/g'
}
t28() { pw_need T28 || return; m1; local re='R11: 32 token rows'; echo "T28 $(sumpw full "$re" | cut -d' ' -f1-3) $(mutpair m1 "$re")"; }
t29() { pw_need T29 || return; echo "T29 $(sumpw full 'R11: a colour token shows a swatch' | cut -d' ' -f1-3)"; }
# R12
t30() {
  pw_need T30 || return
  local prov; prov=$(cnt $PV/main.tsx '<ToastProvider>')
  echo "T30 $prov $(sumpw full 'one polite live region' | cut -d' ' -f1-3)"
}
t31() { pw_need T31 || return; echo "T31 $(sumpw full 'R12: a plain toast shows' | cut -d' ' -f1-3)"; }
t32() { pw_need T32 || return; echo "T32 $(sumpw full 'R12: a toast with an action' | cut -d' ' -f1-3)"; }
t33() { pw_need T33 || return; echo "T33 $(sumpw full 'R12: three toasts in a row' | cut -d' ' -f1-3)"; }
# R13
t34() {
  pw_need T34 || return; vt_need T34 || return
  echo "T34 $(sumpw full 'overlays open and close \(R13\)' | cut -d' ' -f1-3) $(sumvt full 'overlays are drawn as given \(R13\)')"
}
# R14, R15
t35() { pw_need T35 || return; m1; local re='the 13 rows hold'; echo "T35 $(sumpw full "$re" | cut -d' ' -f1-3) $(mutpair m1 "$re")"; }
t36() { pw_need T36 || return; m1; local re='(Calm and indigo|Focus and indigo)'; echo "T36 $(sumpw full "$re" | cut -d' ' -f1-3) $(mutpair m1 "$re")"; }
t37() { pw_need T37 || return; echo "T37 $(sumpw full 'the default avatar is' | cut -d' ' -f1-3)"; }
t38() { pw_need T38 || return; echo "T38 $(sumpw full 'an avatar with a size keeps it' | cut -d' ' -f1-3)"; }
# R16
t39() {
  pw_need T39 || return
  local re='no sideways scroll and no wide figure at'
  mutrun m5 "$re" $PV/preview.css 's/\z/\n.pv-page { min-width: 2000px; }\n/'
  echo "T39 $(sumpw full "$re" | cut -d' ' -f1-3) $(mutpair m5 "$re")"
}
t40() { pw_need T40 || return; echo "T40 $(sumpw full 'at 719 px every control' | cut -d' ' -f1-3)"; }
t41() { pw_need T41 || return; echo "T41 $(sumpw full 'at 720 px the sizes drop' | cut -d' ' -f1-3)"; }
# R17
t42() {
  pw_need T42 || return; vt_need T42 || return
  local re='(every section shows the lines of Table D|a section whose value is none)'
  mutrun m4 "$re" $PV/references.ts 's/Button: "82-93, 309, 714"/Button: "82-93, 309, 715"/'
  echo "T42 $(sumpw full "$re" | cut -d' ' -f1-3) $(sumvt full 'prototype references \(R17\)') $(mutpair m4 "$re")"
}
t43() { pw_need T43 || return; echo "T43 $(sumpw full 'the fonts section shows its line' | cut -d' ' -f1-3)"; }
# R18
t44() {
  vt_need T44 || return
  local f n=0 i18n=0 prov=0 css0 css1 mutvt
  for f in $(files $PV | grep -E '\.(ts|tsx)$' | grep -v '\.test\.'); do
    n=$((n + 1)); i18n=$((i18n + $(doc "$f" | grep -cE '@toki/i18n|I18nProvider')))
  done
  css0=$(stat_ css "$V"); css1=$(stat_ css "$V" '.btn { color: red; }')
  # the Vitest check, run again with a selector that does not start with .pv- added to preview.css
  mutvt="x"
  if mut $PV/preview.css 's/\z/\n.btn { color: red; }\n/'; then
    vt_run m6 && mutvt=$(sumvt m6 'words and styles of the page \(R18\) > preview.css has only' | awk '{print $1, $2}')
  fi
  reset_wt
  echo "T44 $n $i18n $css0 $css1 $(sumvt full 'words and styles of the page \(R18\)') $mutvt"
}
# R19
t45() {
  local changed under
  if ! git rev-parse -q --verify "$V^2" >/dev/null 2>&1; then echo "T45 $V is not a merge commit, so the pull request cannot be read from it (Blocked)"; return; fi
  changed=$(git diff --name-only "$V^1" "$V" | wc -l | tr -d ' ')
  under=$(git diff --name-only "$V^1" "$V" | grep -c '^packages/')
  echo "T45 $changed $under $(git diff "$V^1" "$V" -- packages | wc -l | tr -d ' ')"
}
t46() {
  vt_need T46 || return
  local r0 r1
  r0=$(stat_ imports "$V"); r1=$(stat_ imports "$V" 'import { Button } from "@toki/ui-web";')
  echo "T46 $r0 $(echo "$r1" | awk '{print $3}') $(sumvt full 'imports of the page \(R19\)')"
}
# R20
t47() { pw_need T47 || return; echo "T47 $(sumpw full 'loading the page logs no error or warning' | cut -d' ' -f1-3)"; }
t48() { pw_need T48 || return; echo "T48 $(sumpw full 'R20: seven .woff2 responses' | cut -d' ' -f1-3)"; }
# R21 (by eye)
t49() { echo "T49 (Blocked) manual row: the QA compares the components, icons, fonts and tokens with the prototype in Calm and Focus at 360 by 560, 720 and 1100 px (six views) and pastes the result"; }
t50() { echo "T50 (Blocked) manual row: the QA opens each of the 13 overlay examples at 360 by 560, 719, 720, 1099 and 1100 px in Calm and Focus (ten rows) and pastes the result"; }
t51() { echo "T51 (Blocked) manual row: the QA compares indigo, clay and violet in each look at 1100 px and comfortable and compact on the default avatar in each look (ten rows) and pastes the result"; }
t52() { echo "T52 (Blocked) manual row: the QA opens the page in Safari and in Firefox, Calm at 1100 px, and pastes the result"; }
t53() {
  command -v gh >/dev/null 2>&1 || { echo "T53 gh is not installed (Blocked)"; return; }
  local n; n=$(git log -1 --format=%s "$V" | sed -nE 's/^Merge pull request #([0-9]+) .*/\1/p')
  [ -n "$n" ] || { echo "T53 $V is not a merge commit of a pull request (Blocked)"; return; }
  gh pr view "$n" --json body,author,reviews > "$BASE/pr.json" 2>/dev/null || { echo "T53 the pull request could not be read with gh (Blocked)"; return; }
  nodebin -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const lines = (d.body || "").split("\n").filter((l) => /^\s*\|/.test(l));
    const seps = lines.filter((l) => /^\s*\|[\s:|-]+\|\s*$/.test(l) && /---/.test(l)).length;
    const rows = Math.max(0, lines.length - 2 * seps);
    const others = (d.reviews || []).filter((r) => r.author && r.author.login !== d.author.login).length;
    console.log(`T53 ${seps} ${rows} ${others}`);
  ' "$BASE/pr.json"
}
# R22
t54() {
  need T54 || return
  local a b c rc3
  pnenv -- run lint > "$BASE/t54a.out" 2>&1; a=$?
  pnenv -- run format:check > "$BASE/t54b.out" 2>&1; b=$?
  pnenv -- run typecheck > "$BASE/t54c.out" 2>&1; c=$?
  build_need T54 || return; rc3=$BUILD_RC
  echo "T54 $a $b $c $rc3"
}
t55() {
  need T55 || return
  local has=0; doc package.json | grep -q '"lint:boundaries"' && has=1
  pnenv -- run lint:boundaries > "$BASE/t55.out" 2>&1; local rc=$?
  echo "T55 $has $rc"
}
t56() {
  need T56 || return
  pnenv -- exec vitest run --project '!server-db' --reporter=json --outputFile="$BASE/vt-all.json" > "$BASE/t56.out" 2>&1; local rc1=$?
  local r="x x x"; [ -s "$BASE/vt-all.json" ] && r=$(sumvt all '.')
  pnenv -- exec node --test tools/bundle-size/check.test.mjs apps/web/scripts/check-no-dev-pages.test.mjs > "$BASE/t56b.out" 2>&1; local rc2=$?
  echo "T56 the whole of \`pnpm test\` also runs the server database project, which needs a PostgreSQL test database that this machine does not provide (Blocked); database-free Vitest exit $rc1, passed/failed/skipped $r; node --test exit $rc2"
}
t57() {
  need T57 || return
  local p
  for p in 5173 3000; do [ "$(portbusy "$p")" = busy ] && { echo "T57 port $p is busy and the script never stops another process (Blocked)"; return; }; done
  pnenv -- run test:e2e > "$BASE/t57.out" 2>&1; local rc=$?
  local fa sk shot=0
  fa=$(grep -oE '[0-9]+ failed' "$BASE/t57.out" | tail -1 | cut -d' ' -f1); sk=$(grep -oE '[0-9]+ skipped' "$BASE/t57.out" | tail -1 | cut -d' ' -f1)
  exists e2e/component-preview-screenshots.spec.ts && shot=1
  echo "T57 $rc ${fa:-0} ${sk:-0} $shot"
}
t58() {
  local f n=0 dis=0
  for f in $(files $PV $E2E | grep -E '\.(ts|tsx)$'); do n=$((n + 1)); dis=$((dis + $(doc "$f" | grep -c 'eslint-disable'))); done
  echo "T58 $n $dis"
}
# R23
t59() { pw_need T59 || return; echo "T59 $(sumpw full 'the 13 overlay examples \(R23\)' | cut -d' ' -f1-3)"; }
t60() { pw_need T60 || return; echo "T60 $(sumpw full 'the panel stays inside the window \(R23\)' | cut -d' ' -f1-3)"; }
# R24
t61() {
  pw_need T61 || return
  local spec=0 png=0; exists e2e/component-preview-screenshots.spec.ts && spec=1
  png=$(files e2e | grep -cE 'component-preview-screenshots.*\.png$')
  echo "T61 $spec $png $(sumpw full 'R24: the screenshots of the six views' | cut -d' ' -f1-3)"
}

# ---- serve: the preview page for the manual rows ---------------------------------------------------------------
serve() {
  need serve || return
  local port; port=$(freeport)
  ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm --filter ./apps/web exec vite --host 127.0.0.1 --port "$port" --strictPort > "$BASE/serve.log" 2>&1 ) &
  PIDS="$PIDS $!"
  local i; for i in $(seq 1 60); do [ "$(portbusy "$port")" = busy ] && break; sleep 0.5; done
  [ "$(portbusy "$port")" = busy ] || { echo "serve the Vite server did not start (Blocked)"; return; }
  echo "serve Calm  http://127.0.0.1:$port/preview.html?look=calm"
  echo "serve Focus http://127.0.0.1:$port/preview.html?look=focus"
  echo "serve the controls change look, accent and density; the prototype is opened by the QA in a second window"
  echo "serve press Enter to stop and clean up"
  read -r _ || true
}

if [ "${1:-}" = serve ]; then serve; else
rows="${*:-$(seq -f 'T%g' 1 61 | tr '\n' ' ')}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
fi
for p in $PIDS; do kill_tree "$p"; done
cleanup
alive=$(pgrep -f "$BASENAME" 2>/dev/null | wc -l | tr -d ' ')
echo "CLEAN worktrees $([ "$(git worktree list | grep -cF "$BASENAME")" = 0 ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive temporary-folder $([ -d "$BASE" ] && echo kept || echo removed)"
