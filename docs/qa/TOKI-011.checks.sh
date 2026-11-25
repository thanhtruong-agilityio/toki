#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-011.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile` and one `npm install` of playwright-core into the temporary folder.
# Nothing is written to GitHub and no pull request is opened.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-011.checks.sh [T1 T2 ...]
#   V=<commit> [HOLD=<seconds>] bash docs/qa/TOKI-011.checks.sh GALLERY
#     starts the dev app of the temporary worktree and prints the two addresses (Calm and Focus) that the
#     manual row T4M asks the QA to look at; it stops after HOLD seconds (default 900) or on Ctrl-C.
# It reads files of the commit V with `git show`; the spec of TOKI-011 is read from V as well (Table A and
# Table B are the oracle). Rows that run code use ONE temporary worktree of V under one folder BASE (made
# with mktemp in the current shell, exported as TMPDIR and given to every process it starts through
# `env -i`); BASE, the worktree and every process are removed when the script ends, even when a row fails.
# The repository itself is not changed. Rows that mutate a file of the worktree restore it afterwards, and
# every check that must fail is paired with a run that must pass. No `.env` file is read or created (the
# worktree has none). It prints one line for each row: counts, exit codes and words; never a secret and
# never tool output (the first error line of a refusal is printed only when a row is Blocked).
# The browser rows use the Chromium cached by Playwright, driven by playwright-core 1.65.1 (the version the
# repository pins for TOKI-008) installed into BASE, against the Vite dev server of apps/web in the worktree
# on a free port, with a scratch page that is added to the worktree only. A row that cannot run is Blocked.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
SPEC="docs/specs/2026-11-16-icon-set-design.md"
PKG="packages/ui-web"
doc() { git show "$V:$1" 2>/dev/null; }

BASE=$(mktemp -d); export TMPDIR="$BASE"
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; PIDS=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; }
cleanup() {
  local p
  for p in $PIDS; do kill_tree "$p"; done
  PIDS=""
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
  WT=""
  rm -rf "$BASE"
  git worktree prune >/dev/null 2>&1
}
trap cleanup EXIT
trap 'exit 130' INT TERM

N22=""; NEED22=0
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  N22=$(ls -d "$HOME"/.nvm/versions/node/v22*/bin 2>/dev/null | tail -1)
  [ -n "$N22" ] || NEED22=1
fi
NODEPATH="${N22:+$N22:}$PATH"
nodebin() { PATH="$NODEPATH" node "$@"; }
# pnenv <VAR=value ...> -- <pnpm args>: runs pnpm in the worktree with only those variables
pnenv() { local envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift; ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" ${envs[@]+"${envs[@]}"} corepack pnpm "$@" ); }
# nodein <dir> <args>: runs node in a directory with only the same variables
nodein() { local d="$1"; shift; ( cd "$d" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node "$@" ); }
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
freeport() { python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'; }
src_files() { git ls-tree -r --name-only "$V" -- "$PKG/src/icons" | grep -vE '\.test\.tsx?$'; }

# ---- the oracle: Table A and Table B of the spec of TOKI-011 at V ------------------
prep() {
  [ -s "$BASE/in.json" ] && return 0
  doc "$SPEC" > "$BASE/spec.md"; [ -s "$BASE/spec.md" ] || return 1
  perl -ne 'if (/^\| \d+ \| `([^`]+)` \| `([^`]+)` \|.*\| `([^`]+)` \|\s*$/) { print "$1\t$2\t$3\n" }' "$BASE/spec.md" > "$BASE/tableA.tsv"
  awk '/^### Table B/{on=1; next} /^Reasons, by source/{on=0} on' "$BASE/spec.md" | perl -ne 'print "$1\n" if /^\| `([^`]+)` \|/' > "$BASE/tableB.txt"
  grep -m1 '^  - 7 are never drawn' "$BASE/spec.md" | sed 's/^[^:]*: //; s/\. .*//' | grep -o '`[^`]*`' | tr -d '`' > "$BASE/never.txt"
  jq -n --rawfile a "$BASE/tableA.tsv" --rawfile b "$BASE/tableB.txt" --rawfile n "$BASE/never.txt" '
    ($a | split("\n") | map(select(length > 0) | split("\t"))) as $rows
    | { names: ($rows | map(.[0])), comps: ($rows | map(.[1])), paths: ($rows | map(.[2])),
        leftout: (($n | split("\n") | map(select(length > 0))) + ($b | split("\n") | map(select(length > 0)))) }' > "$BASE/in.json" 2>/dev/null
  [ -s "$BASE/in.json" ]
}
need_prep() { prep && return 0; echo "$1 could not read Table A of the spec at $V (Blocked)"; return 1; }

# ---- the harness: one Vitest file that renders the icons and prints counts --------
write_harness() { cat > "$1" <<'TS'
// @ts-nocheck
import { readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { it } from "vitest";
import * as mod from "./index";
import { iconPaths } from "./icons/paths";

const inp = JSON.parse(readFileSync(process.env.QA_IN, "utf8"));
const M = mod as Record<string, unknown>;
const pascal = (n: string) => n.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("") + "Icon";
const R4: Record<string, string> = {
  class: "ic", viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor",
  "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true",
};
const draw = (C: unknown, props: Record<string, unknown> = {}) => {
  try { return renderToStaticMarkup(createElement(C as never, props)); } catch { return ""; }
};
const attrsOf = (html: string) => {
  const o: Record<string, string> = {};
  const tag = html.match(/^<svg([^>]*)>/);
  if (!tag) return o;
  for (const m of tag[1].matchAll(/ ([A-Za-z:-]+)="([^"]*)"/g)) o[m[1]] = m[2];
  return o;
};
const count = (re: RegExp, s: string) => (s.match(re) || []).length;
const same = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(b).every((k) => a[k] === b[k]);

it("collect", () => {
  const { names, comps, paths, leftout } = inp as { names: string[]; comps: string[]; paths: string[]; leftout: string[] };
  const out: Record<string, number[]> = {};
  const expected = new Set([...comps, "Icon", "iconNames"]);
  out.T1 = [comps.filter((c) => typeof M[c] === "function").length, [...expected].filter((k) => !(k in M)).length];
  const iN = mod.iconNames as string[];
  out.T2 = [iN.length, names.filter((n, i) => iN[i] === n).length];
  out.T3 = [names.length, names.filter((n, i) => { const a = draw(M[comps[i]]); return a !== "" && a === draw(M.Icon, { name: n }); }).length];
  let exact = 0, one = 0, dOk = 0;
  names.forEach((n, i) => {
    const html = draw(M[comps[i]]);
    if (same(attrsOf(html), R4)) exact++;
    if (count(/<svg/g, html) === 1 && count(/<path /g, html) === 1) one++;
    const d = html.match(/<path d="([^"]*)"><\/path><\/svg>$/);
    if (d && d[1] === paths[i]) dOk++;
  });
  out.T4 = [names.length, exact, one];
  out.T4D = [names.length, dOk];
  const per = (f: (C: unknown, n: string) => boolean) => names.filter((n, i) => f(M[comps[i]], n)).length;
  const at = (C: unknown, p: Record<string, unknown>) => attrsOf(draw(C, p));
  out.T5S = [names.length,
    per((C) => { const a = at(C, { size: 14 }); const b = at(C, { size: 30 }); return a.width === "14" && a.height === "14" && b.width === "30" && b.height === "30"; }),
    per((C) => { const a = at(C, {}); return a.width === "18" && a.height === "18"; })];
  out.T5W = [names.length, per((C) => at(C, { strokeWidth: 2.2 })["stroke-width"] === "2.2"), per((C) => at(C, {})["stroke-width"] === "1.75")];
  out.T5C = [names.length, per((C) => at(C, { className: "active" }).class === "ic active"), per((C) => at(C, {}).class === "ic")];
  out.T5P = [names.length, per((C) => { const a = at(C, { "data-testid": "t", style: { color: "red" }, focusable: "false" }); return a["data-testid"] === "t" && a.style === "color:red" && a.focusable === "false"; })];
  const cast = { stroke: "red", fill: "blue", viewBox: "0 0 1 1", width: 99, height: 99, strokeLinecap: "butt", strokeLinejoin: "miter", role: "img", "aria-hidden": false, dangerouslySetInnerHTML: { __html: "<circle></circle>" } };
  out.T5O = [names.length,
    per((C) => same(at(C, cast), R4)),
    per((C) => !("role" in at(C, cast))),
    per((C) => { const h = draw(C, cast); return h !== "" && !h.includes("<circle"); })];
  out.T7 = [names.length, per((C) => at(C, {})["aria-hidden"] === "true"), per((C) => at(C, { "aria-hidden": false })["aria-hidden"] === "true")];
  const pk = Object.keys(iconPaths);
  out.T9 = [leftout.length,
    leftout.filter((n) => iN.includes(n)).length,
    leftout.filter((n) => pascal(n) in M).length,
    leftout.filter((n) => pk.includes(n)).length,
    names.filter((n, i) => iN.includes(n) && comps[i] in M && pk.includes(n)).length];
  const keys = Object.keys(mod);
  const drawn = keys.filter((k) => k !== "iconNames");
  const named = drawn.filter((k) => k === "Icon" || k.endsWith("Icon")).length;
  out.T16 = [keys.length, named, drawn.length - named, keys.filter((k) => k === "iconNames" && k.endsWith("Icon")).length];
  writeFileSync(process.env.QA_OUT, JSON.stringify(out));
});
TS
}
HARN="$BASE/harness.json"; HARN_DONE=""
run_harness() {
  [ -n "$HARN_DONE" ] && return 0
  need "$1" || return 1; need_prep "$1" || return 1
  write_harness "$WT/$PKG/src/zz-qa.test.tsx"
  pnenv QA_IN="$BASE/in.json" QA_OUT="$HARN" -- --filter @toki/ui-web exec vitest run src/zz-qa.test.tsx > "$BASE/h.log" 2>&1
  rm -f "$WT/$PKG/src/zz-qa.test.tsx"
  if [ ! -s "$HARN" ]; then echo "$1 the harness produced no result (Blocked): $(grep -m1 -iE 'error' "$BASE/h.log" | cut -c1-120)"; return 1; fi
  HARN_DONE=1
}
hrow() { run_harness "$1" || return; echo "$1 $(jq -r --arg k "$1" '.[$k] | join(" ")' "$HARN")"; }

# ---- the TypeScript API: exports with their types, and the statements of icons.tsx --
write_ts() { cat > "$1" <<'JS'
const ts = require("typescript"); const fs = require("fs");
const root = process.argv[2], pkg = root + "/packages/ui-web";
const entry = pkg + "/src/index.ts";
const cfg = ts.readConfigFile(pkg + "/tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, pkg);
const prog = ts.createProgram([entry], parsed.options);
const chk = prog.getTypeChecker();
const exp = chk.getExportsOfModule(chk.getSymbolAtLocation(prog.getSourceFile(entry))).map((s) => s.getName()).sort();
const sf = ts.createSourceFile("icons.tsx", fs.readFileSync(pkg + "/src/icons/icons.tsx", "utf8"), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
let imp = 0, expc = 0, oth = 0;
for (const st of sf.statements) {
  if (ts.isImportDeclaration(st)) imp++;
  else if (ts.isVariableStatement(st) && (st.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword) && (st.declarationList.flags & ts.NodeFlags.Const)) expc++;
  else oth++;
}
console.log(JSON.stringify({ exports: exp, statements: sf.statements.length, imp, expc, oth }));
JS
}
tsapi() { write_ts "$WT/zz-ts.cjs"; nodein "$WT" zz-ts.cjs "$WT" 2>/dev/null | tail -1; rm -f "$WT/zz-ts.cjs"; }

# ---- the type rows: one valid file, one file of bad lines, the same lines with directives ----
TY_DONE=""; TY_RC=""; TY_DIR=""
BADS=(
  'T2T|<Icon name="nope" />'
  'T2T|<Icon name="mail" />'
  'T3T|<Icon />'
  'T7T|<BellIcon aria-label="x" />'
  'T7T|<BellIcon aria-labelledby="x" />'
  'T7T|<BellIcon aria-hidden={false} />'
  'T7T|<BellIcon title="x" />'
  'T7T|<BellIcon>x</BellIcon>'
  'T15|<BellIcon stroke="red" />'
  'T15|<BellIcon fill="blue" />'
  'T15|<BellIcon viewBox="0 0 1 1" />'
  'T15|<BellIcon width={20} />'
  'T15|<BellIcon height={20} />'
  'T15|<BellIcon strokeLinecap="butt" />'
  'T15|<BellIcon strokeLinejoin="miter" />'
  'T15|<BellIcon role="img" />'
  'T15|<BellIcon dangerouslySetInnerHTML={{ __html: "x" }} />'
  'T15|<BellIcon ref={null} />'
  'T15|<Icon name="bell" stroke="red" />'
)
tsc_wt() { pnenv -- --filter @toki/ui-web exec tsc --noEmit 2>&1; }
type_run() {
  [ -n "$TY_DONE" ] && return 0
  need "$1" || return 1; need_prep "$1" || return 1
  local src="$WT/$PKG/src" comps out n i g e l
  comps=$(jq -r '.comps | join(", ")' "$BASE/in.json")
  {
    echo "import { Icon, type IconName, type IconProps, ${comps} } from \"./index\";"
    echo 'export const okMap: Record<IconName, true> = {'
    jq -r '.names[] | "  \"" + . + "\": true,"' "$BASE/in.json"
    echo '};'
    echo "export const okComps: Array<(p: IconProps) => unknown> = [${comps}];"
    echo 'export const okProps: IconProps = { size: 16, strokeWidth: 2, className: "a", style: { color: "red" } };'
    echo 'export const ok1 = <BellIcon />;'
    echo 'export const ok2 = <Icon name="bell" />;'
    echo 'export const ok3 = <BellIcon size={16} strokeWidth={2} className="a" data-testid="t" />;'
    echo 'export const ok4 = <Icon name="bell" size={16} strokeWidth={2} className="a" data-testid="t" />;'
  } > "$src/zz-ok.tsx"
  out=$(tsc_wt); TY_RC=$?
  # a file of bad lines: each one differs from a valid line of zz-ok.tsx by the prop under test
  { echo 'import { Icon, BellIcon } from "./index";'; i=0; for e in "${BADS[@]}"; do i=$((i + 1)); echo "export const b$i = ${e#*|};"; done; } > "$src/zz-bad.tsx"
  tsc_wt > "$BASE/ty.bad"
  : > "$BASE/ty.counts"
  for g in T2T T3T T7T T15; do
    n=0; e=0; i=0
    for l in "${BADS[@]}"; do i=$((i + 1)); [ "${l%%|*}" = "$g" ] || continue
      n=$((n + 1)); grep -qE "zz-bad\.tsx\($((i + 1))," "$BASE/ty.bad" && e=$((e + 1))
    done
    echo "$g $n $e" >> "$BASE/ty.counts"
  done
  rm -f "$src/zz-bad.tsx"
  { echo 'import { Icon, BellIcon } from "./index";'; i=0; for e in "${BADS[@]}"; do i=$((i + 1)); echo "// @ts-expect-error the prop under test is refused"; echo "export const b$i = ${e#*|};"; done; } > "$src/zz-dir.tsx"
  tsc_wt >/dev/null; TY_DIR=$?
  rm -f "$src/zz-ok.tsx" "$src/zz-dir.tsx"
  TY_DONE=1
}
trow() { type_run "$1" || return; echo "$1 $TY_RC $(awk -v g="$1" '$1 == g {print $2, $3}' "$BASE/ty.counts") $TY_DIR"; }
t2t() { trow T2T; }
t3t() { trow T3T; }
t7t() { trow T7T; }
t15() { trow T15; }

# ---- browser rows ------------------------------------------------------------------
write_page() {
  cat > "$WT/apps/web/zz-icons.html" <<'EOF'
<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>icons</title></head>
<body><div id="root"></div><script type="module" src="/zz-icons.tsx"></script></body></html>
EOF
  cat > "$WT/apps/web/zz-icons.tsx" <<'EOF'
// @ts-nocheck
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "../../packages/tokens/src/tokens.css";
import * as mod from "../../packages/ui-web/src/index";
const look = new URLSearchParams(location.search).get("look") ?? "calm";
document.documentElement.setAttribute("data-eff", look);
const pascal = (n) => n.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("") + "Icon";
const cells = [];
for (const n of mod.iconNames) {
  cells.push(createElement("span", { key: "a" + n, className: "cell-ink", title: n, style: { color: "var(--ink)", display: "inline-block", margin: 6 } }, createElement(mod[pascal(n)])));
  cells.push(createElement("span", { key: "b" + n, className: "cell-big", title: n, style: { color: "var(--accent)", display: "inline-block", margin: 6 } }, createElement(mod.Icon, { name: n, size: 30 })));
}
document.body.style.background = "var(--bg)";
createRoot(document.getElementById("root")).render(createElement("div", { id: "gallery" }, cells));
EOF
}
write_runner() { cat > "$1" <<'JS'
const { chromium } = require("playwright-core");
const base = process.argv[2];
const read = () => {
  const out = { drawn: 0, inkOk: 0, bigOk: 0, def18: 0, big30: 0, ink: "" };
  const parentColor = (el) => getComputedStyle(el.parentElement).color;
  for (const svg of document.querySelectorAll(".cell-ink svg")) {
    out.drawn++;
    if (getComputedStyle(svg).stroke === parentColor(svg)) out.inkOk++;
    const r = svg.getBoundingClientRect();
    if (r.width === 18 && r.height === 18) out.def18++;
    out.ink = parentColor(svg);
  }
  for (const svg of document.querySelectorAll(".cell-big svg")) {
    if (getComputedStyle(svg).stroke === parentColor(svg)) out.bigOk++;
    const r = svg.getBoundingClientRect();
    if (r.width === 30 && r.height === 30) out.big30++;
  }
  return out;
};
(async () => {
  let browser = null;
  try {
    browser = await chromium.launch();
    const out = {};
    for (const look of ["calm", "focus"]) {
      const page = await browser.newPage();
      await page.goto(base + "/zz-icons.html?look=" + look);
      await page.waitForSelector("#gallery svg", { timeout: 15000 });
      out[look] = await page.evaluate(read);
      await page.close();
    }
    console.log(JSON.stringify(out));
  } catch (e) {
    console.log(JSON.stringify({ error: String(e.message).split("\n")[0].slice(0, 120) }));
  }
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
})();
JS
}
VITE_PORT=""
start_vite() {
  write_page
  VITE_PORT=$(freeport)
  ( cd "$WT" && exec env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm --filter @toki/web exec vite --port "$VITE_PORT" --host 127.0.0.1 > "$BASE/vite.log" 2>&1 ) &
  PIDS="$PIDS $!"
  local t=0
  while [ "$t" -lt 60 ]; do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$VITE_PORT/zz-icons.html" 2>/dev/null)" = 200 ] && return 0
    sleep 0.5; t=$((t + 1))
  done
  return 1
}
BR_DONE=""
browser_run() {
  [ -n "$BR_DONE" ] && return 0
  need "$1" || return 1
  mkdir -p "$BASE/pw"
  ( cd "$BASE/pw" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" npm install --prefix "$BASE/pw" playwright-core@1.65.1 --silent --no-audit --no-fund > "$BASE/npm.log" 2>&1 ) \
    || { echo "$1 playwright-core could not be installed (Blocked): $(head -1 "$BASE/npm.log" | cut -c1-120)"; return 1; }
  start_vite || { echo "$1 the dev app did not answer on a free port (Blocked): $(grep -m1 -iE 'error' "$BASE/vite.log" | cut -c1-120)"; return 1; }
  write_runner "$BASE/pw/run.cjs"
  nodein "$BASE/pw" run.cjs "http://127.0.0.1:$VITE_PORT" > "$BASE/br.out" 2>/dev/null
  BR_JSON=$(tail -1 "$BASE/br.out")
  if [ -z "$BR_JSON" ] || [ "$(printf '%s' "$BR_JSON" | jq -r 'has("error")' 2>/dev/null)" != false ]; then
    echo "$1 the browser run gave no result (Blocked): $(printf '%s' "$BR_JSON" | jq -r '.error // empty' 2>/dev/null)"; return 1
  fi
  BR_DONE=1
}
bj() { printf '%s' "$BR_JSON" | jq -r "$1"; }

# ---- rows --------------------------------------------------------------------------
t1() { hrow T1; }
t1x() {
  need T1X || return; need_prep T1X || return
  local j extra missing total
  j=$(tsapi); [ -n "$j" ] || { echo "T1X the TypeScript API gave no result (Blocked)"; return; }
  printf '%s' "$j" | jq -r '.exports[]' | sort > "$BASE/ex.txt"
  jq -r '.comps[], "Icon", "iconNames", "IconName", "IconProps"' "$BASE/in.json" | sort > "$BASE/want.txt"
  total=$(grep -c . "$BASE/ex.txt"); extra=$(comm -23 "$BASE/ex.txt" "$BASE/want.txt" | grep -c .); missing=$(comm -13 "$BASE/ex.txt" "$BASE/want.txt" | grep -c .)
  echo "T1X $total $extra $missing"
}
t2() { hrow T2; }
t2n() {
  local n=0 hits=0 f body ctl
  for f in $(src_files); do n=$((n + 1)); doc "$f" > "$BASE/s.txt"; grep -qE 'throw |new Error|invariant|assert\(' "$BASE/s.txt" && hits=$((hits + 1)); done
  printf 'throw new Error("x");\n' > "$BASE/ctl.txt"; ctl=0; grep -qE 'throw |new Error|invariant|assert\(' "$BASE/ctl.txt" && ctl=1
  echo "T2N $n $hits $ctl"
}
t3() { hrow T3; }
t4() { hrow T4; }
t4d() { hrow T4D; }
t4m() { echo "T4M Blocked: the look of the 43 icons next to the prototype is a by-eye comparison; the prototype file is not in the tree at $V; the QA runs GALLERY and pastes the result"; }
t5s() { hrow T5S; }
t5w() { hrow T5W; }
t5c() { hrow T5C; }
t5p() { hrow T5P; }
t5o() { hrow T5O; }
t5b() {
  browser_run T5B || return
  echo "T5B $(bj '.calm.drawn') $(bj '.calm.def18') $(bj '.calm.big30') $(bj '.focus.def18') $(bj '.focus.big30')"
}
t6() {
  local n=0 lit=0 imp=0 f
  for f in $(src_files); do
    n=$((n + 1)); doc "$f" > "$BASE/s.txt"
    grep -qE '#|rgb\(|hsl\(' "$BASE/s.txt" && lit=$((lit + 1))
    grep -q '@toki/tokens' "$BASE/s.txt" && imp=$((imp + 1))
  done
  # the same detectors on a planted text with one of each: all four must be found
  printf 'a #fff\nb rgb(1,2,3)\nc hsl(1,2%%,3%%)\nd @toki/tokens\n' > "$BASE/ctl.txt"
  local hits=0
  grep -q '#' "$BASE/ctl.txt" && hits=$((hits + 1)); grep -q 'rgb(' "$BASE/ctl.txt" && hits=$((hits + 1))
  grep -q 'hsl(' "$BASE/ctl.txt" && hits=$((hits + 1)); grep -q '@toki/tokens' "$BASE/ctl.txt" && hits=$((hits + 1))
  echo "T6 $n $lit $imp $hits"
}
t6b() {
  browser_run T6B || return
  local differ=0
  [ "$(bj '.calm.ink')" != "$(bj '.focus.ink')" ] && differ=1
  echo "T6B $(bj '.calm.drawn') $(bj '.calm.inkOk') $(bj '.calm.bigOk') $(bj '.focus.inkOk') $(bj '.focus.bigOk') $differ"
}
t7() { hrow T7; }
t8() {
  local rc=0
  git cat-file -e "$V:docs/blueprint/prototype/index.html" 2>/dev/null || rc=$?
  echo "T8 Blocked: the prototype's icon table is not in the tree at $V (git cat-file exit $rc), so the 43 paths of paths.ts are not compared with it"
}
t9() { hrow T9; }
t10() {
  need T10 || return; need_prep T10 || return
  local t="$WT/$PKG/src/icons" green a b c rc
  local R1='exports exactly the 43 components, Icon and iconNames' R9='has none of the 32 left-out names'
  run_icon_tests() { pnenv -- --filter @toki/ui-web exec vitest run src/icons/icons.test.tsx --reporter=json --outputFile="$BASE/t10.json" >/dev/null 2>&1; echo $?; }
  failed() { jq -r '[.testResults[].assertionResults[] | select(.status == "failed") | .title] | join("|")' "$BASE/t10.json" 2>/dev/null; }
  add_path() { perl -0pi -e 's/\n  menu:/\n  mail: "M3 5h18v14H3z",\n  menu:/' "$t/paths.ts"; }
  add_export() { perl -0pi -e 's/(export const LockIcon = createIcon\("lock"\);\n)/$1export const MailIcon = createIcon("mail");\n/' "$t/icons.tsx"; }
  add_kept() { perl -0pi -e 's/(\n  "lock",)/$1\n  "mail",/' "$t/icons.test.tsx"; }
  drop_left() { perl -0pi -e 's/\n  "mail",//' "$t/icons.test.tsx"; }
  # one icon added the way the spec says: an entry, an export, the two lists (and their lengths)
  drop_left; add_kept; add_path; add_export
  perl -0pi -e 's/toHaveLength\(43\)/toHaveLength(44)/; s/toHaveLength\(32\)/toHaveLength(31)/' "$t/icons.test.tsx"
  green=$(run_icon_tests); reset_wt
  # a name in iconNames (an entry in paths.ts and in the list of the 43) without an export
  add_path; add_kept; a=0; rc=$(run_icon_tests); failed > "$BASE/f.txt"; [ "$rc" != 0 ] && grep -qF "$R1" "$BASE/f.txt" && a=1; reset_wt
  # an export that is not in iconNames
  perl -0pi -e 's/(export const LockIcon = createIcon\("lock"\);\n)/$1export const ZzIcon = createIcon("at");\n/' "$t/icons.tsx"
  b=0; rc=$(run_icon_tests); failed > "$BASE/f.txt"; [ "$rc" != 0 ] && grep -qF "$R1" "$BASE/f.txt" && b=1; reset_wt
  # a left-out name that appears (the list of the 32 not edited)
  add_kept; add_path; add_export
  c=0; rc=$(run_icon_tests); failed > "$BASE/f.txt"; [ "$rc" != 0 ] && grep -qF "$R9" "$BASE/f.txt" && c=1; reset_wt
  echo "T10 $green $a $b $c"
}
t11s() {
  local p s=0 e=0
  p=$(doc "$PKG/package.json")
  [ "$(printf '%s' "$p" | jq -c '.sideEffects')" = '["**/*.css"]' ] && s=1
  [ "$(printf '%s' "$p" | jq -c '.exports')" = '{".":"./src/index.ts"}' ] && e=1
  echo "T11S $s $e"
}
t11e() {
  local re oth
  re=$(doc "$PKG/src/index.ts" | grep -cE '^export \* from "\./icons";?$')
  oth=$(doc "$PKG/src/index.ts" | grep -vE '^export \* from "\./icons";?$|^[[:space:]]*$|^[[:space:]]*//' | grep -c .)
  echo "T11E $re $oth"
}
t11m() {
  need T11M || return
  local j k
  j=$(tsapi); [ -n "$j" ] || { echo "T11M the TypeScript API gave no result (Blocked)"; return; }
  printf 'console.log("planted");\n' >> "$WT/$PKG/src/icons/icons.tsx"
  k=$(tsapi); reset_wt
  echo "T11M $(printf '%s' "$j" | jq -r '[.statements, .imp, .expc, .oth] | join(" ")') $(printf '%s' "$k" | jq -r '.oth')"
}
t12i() {
  local p peer dev
  if [ "$NEED22" = 1 ]; then echo "T12I needs Node 22 and an installed worktree of $V (Blocked)"; return; fi
  ensure >/dev/null 2>&1
  if [ -z "$INSTALL_RC" ]; then echo "T12I could not make a worktree of $V (Blocked)"; return; fi
  p=$(doc "$PKG/package.json")
  peer=$(printf '%s' "$p" | jq -r 'if .peerDependencies.react != null then 1 else 0 end')
  dev=$(printf '%s' "$p" | jq -r '[.devDependencies | keys[] | select(. as $k | ["react","react-dom","@types/react","@types/react-dom","@types/node","vitest"] | index($k))] | length')
  echo "T12I $INSTALL_RC $peer $dev"
}
t12t() {
  need T12T || return
  local rc cfg=0 other
  pnenv -- typecheck >/dev/null 2>&1; rc=$?
  doc "$PKG/tsconfig.json" > "$BASE/tsc.json"
  grep -q '"jsx": "react-jsx"' "$BASE/tsc.json" && grep -q '"DOM"' "$BASE/tsc.json" && cfg=1
  other=$(git diff --name-only "$V^1" "$V" 2>/dev/null | grep -E '(^|/)tsconfig[^/]*\.json$' | grep -vc "^$PKG/tsconfig.json$")
  echo "T12T $rc $cfg $other"
}
t12u() {
  need T12U || return
  local rc
  pnenv -- --filter @toki/ui-web test --reporter=json --outputFile="$BASE/t12u.json" >/dev/null 2>&1; rc=$?
  echo "T12U $rc $(jq -r '[(.testResults | length), .numPassedTests, .numFailedTests] | join(" ")' "$BASE/t12u.json" 2>/dev/null)"
}
planted_lint() { # a file that uses a banned API under ui-web: eslint must refuse it
  [ -n "${PL_RC:-}" ] && return 0
  printf 'export const v = localStorage.getItem("x");\n' > "$WT/$PKG/src/zz-banned.ts"
  pnenv -- exec eslint "$PKG/src/zz-banned.ts" >/dev/null 2>&1; PL_RC=$?
  rm -f "$WT/$PKG/src/zz-banned.ts"
}
t13l() {
  need T13L || return
  local rc; pnenv -- lint >/dev/null 2>&1; rc=$?
  planted_lint
  echo "T13L $rc $([ "$PL_RC" != 0 ] && echo 1 || echo 0)"
}
t13f() {
  need T13F || return
  local rc bad=0; pnenv -- format:check >/dev/null 2>&1; rc=$?
  printf 'export  const   a   =  1\n' > "$WT/$PKG/src/zz-fmt.ts"
  pnenv -- exec prettier --check "$PKG/src/zz-fmt.ts" >/dev/null 2>&1 || bad=1
  rm -f "$WT/$PKG/src/zz-fmt.ts"
  echo "T13F $rc $bad"
}
t13b() {
  need T13B || return
  local present rc
  present=$(doc package.json | jq -r 'if .scripts["lint:boundaries"] != null then 1 else 0 end')
  pnenv -- run lint:boundaries >/dev/null 2>&1; rc=$?
  echo "T13B $present $rc"
}
t13a() {
  need T13A || return
  local n=0 hit=0 f pat='\b(Notification|localStorage|sessionStorage|indexedDB|Audio|AudioContext|caches)\b|serviceWorker|document\.cookie'
  for f in $(src_files); do n=$((n + 1)); doc "$f" > "$BASE/s.txt"; grep -qE "$pat" "$BASE/s.txt" && hit=$((hit + 1)); done
  printf 'export const v = localStorage.getItem("x");\n' > "$BASE/ctl.txt"
  local ctl=0; grep -qE "$pat" "$BASE/ctl.txt" && ctl=1
  planted_lint
  echo "T13A $n $hit $ctl $([ "$PL_RC" != 0 ] && echo 1 || echo 0)"
}
t14() {
  local n=0 hit=0 pj=0 chg ctl=0 f
  for f in $(git ls-tree -r --name-only "$V" -- apps/web/src); do n=$((n + 1)); doc "$f" > "$BASE/s.txt"; grep -qE 'ui-web' "$BASE/s.txt" && hit=$((hit + 1)); done
  doc apps/web/package.json > "$BASE/s.txt"; grep -q 'ui-web' "$BASE/s.txt" && pj=1
  chg=$(git diff --name-only "$V^1" "$V" -- apps/web 2>/dev/null | grep -c .)
  doc eslint.config.js > "$BASE/s.txt"; grep -q 'ui-web' "$BASE/s.txt" && ctl=1
  echo "T14 $n $hit $pj $chg $ctl"
}
t16() { hrow T16; }

gallery() {
  need GALLERY || return
  start_vite || { echo "GALLERY the dev app did not answer on a free port (Blocked)"; return; }
  echo "GALLERY Calm  http://127.0.0.1:$VITE_PORT/zz-icons.html?look=calm"
  echo "GALLERY Focus http://127.0.0.1:$VITE_PORT/zz-icons.html?look=focus"
  echo "GALLERY stops after ${HOLD:-900} seconds or on Ctrl-C"
  sleep "${HOLD:-900}"
}

rows="${*:-T1 T1X T2 T2T T2N T3 T3T T4 T4D T4M T5S T5W T5C T5P T5O T5B T6 T6B T7 T7T T8 T9 T10 T11S T11E T11M T12I T12T T12U T13L T13F T13B T13A T14 T15 T16}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'A-Z' 'a-z')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
alive=0
for p in $PIDS; do kill_tree "$p"; done
sleep 1
for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
cleanup
# "same": no worktree of this run is left in `git worktree list` (other sessions may add or remove their own)
echo "CLEAN worktrees $([ "$(git worktree list | grep -cF "$BASE")" = 0 ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive temporary-folder $([ -d "$BASE" ] && echo left || echo removed)"
