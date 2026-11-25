#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-017.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile`, and read-only `gh api` GET requests to GitHub for the CI history rows
# (list runs, list the jobs of a run). It writes nothing to GitHub and opens no pull request.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-017.checks.sh [T1 T2 T2B ...]
# It reads files of the commit V with `git show` (and `git archive` for the source scans). Rows that run a
# tool use ONE temporary worktree of V, created on first use, with `pnpm install --frozen-lockfile` run
# there: the tests of `packages/i18n`, `tsc`, ESLint, the check command and `tsx` probe scripts that call the
# package. The probes, the temporary files and every change a row makes (a missing Vietnamese text, an
# unlisted namespace, a wrong key, a file with an error) exist only inside that worktree and are undone
# after the row. A check that must fail is paired with a run that must pass. No browser, no database and
# no port: the provider is rendered to a string with `react-dom/server`. No `.env` file is read or created
# (the worktree has none). Every temporary file lives under one folder made in the current shell (BASE,
# exported as TMPDIR and given to every child through `env -i`), which the cleanup removes; the one
# exception is the optional cache of public GitHub answers (QA_CACHE=<folder>). It prints one line for each
# row: counts, exit codes and words; no tool output and no secret. The last line `CLEAN worktrees same ...`
# says that no worktree made by the script is left under its folder (other worktrees of the repository may
# come and go, so their number is not compared), that `git status` is as it was, that no process it started
# is alive and that the temporary folder is removed. A row that cannot be shown prints `Blocked` and the
# reason. The manual rows (none are expected) print `Blocked` until the QA pastes a result.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
REPO="thanhtruong-agilityio/toki"
WF=".github/workflows/ci.yml"
SPEC="docs/specs/2026-11-16-i18n-package-design.md"
# The history is a snapshot: only runs created up to this instant count, so a rerun gives the same lines.
HIST_UNTIL="${HIST_UNTIL:-2026-11-25T09:00:00Z}"
CACHE="${QA_CACHE:-}"; [ -n "$CACHE" ] && mkdir -p "$CACHE/j"
doc() { git show "$V:$1" 2>/dev/null; }

BASE=$(mktemp -d); export TMPDIR="$BASE"
BASENAME=$(basename "$BASE")
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; PIDS=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; }
cleanup() {
  local p
  for p in $PIDS; do kill_tree "$p"; done
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
PK="packages/i18n"
# changed(): 0 when the worktree differs from V (a mutation really applied)
changed() { ( cd "$WT" && ! git diff --quiet ) || [ -n "$(cd "$WT" && git ls-files --others --exclude-standard)" ]; }
# edit <file relative to the worktree> <perl -0pi code>
edit() { perl -0pi -e "$2" "$WT/$1"; }
# add a line before the closing brace of a nav catalog: addnav <en|vi> <line>
addnav() { L="$2" perl -0pi -e 's/\n\};\s*\z/\n  $ENV{L}\n};\n/' "$WT/$PK/src/messages/$1/nav.ts"; }
b() { [ "$1" = 1 ] && echo 1 || echo 0; }

# ---- the static scan (a Node script; reads a folder, prints one JSON object) --------------
write_scan() { cat > "$BASE/scan.mjs" <<'JS'
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const root = process.argv[2];
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
// removes comments and, when blank is set, the content of string literals
function strip(src, blank) {
  let out = "", i = 0, q = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) {
      if (c === "\\") { out += blank ? "  " : c + n; i += 2; continue; }
      if (c === q) { q = null; out += c; i++; continue; }
      out += blank ? " " : c; i++; continue;
    }
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}
const all = walk(join(root, "packages/i18n/src")).map((p) => relative(join(root, "packages/i18n/src"), p));
const files = all.filter((f) => !/\.test\.[a-z]+$/.test(f));
const res = { sources: files.length, intlFiles: [], intlUses: 0, intlExplicit: 0, languageTyped: 0, navigator: 0, toLocaleString: 0, toLocaleDateString: 0, toLocaleTimeString: 0, globals: 0, nodeImports: 0, reactDom: 0, reactImporters: [], stateTokens: 0, memoOnLanguage: 0 };
const GLOBALS = /(?<![.\w$])(window|document|localStorage|sessionStorage|location|process|Buffer|__dirname|__filename|require|XMLHttpRequest|indexedDB)\b/g;
const NODEMOD = /\b(?:from|import)\s*\(?\s*["'](?:node:[a-z_/]+|fs|path|os|url|util|crypto|child_process|http|https|stream|events|buffer|assert|net|zlib)["']/g;
for (const f of files) {
  const raw = readFileSync(join(root, "packages/i18n/src", f), "utf8");
  const code = strip(raw, false), blank = strip(raw, true);
  if (/\bIntl\b/.test(blank)) res.intlFiles.push(f);
  for (const m of blank.matchAll(/\bIntl\b/g)) {
    res.intlUses++;
    const rest = code.slice(m.index);
    const call = /^Intl\.[A-Za-z]+\s*\(/.exec(rest);
    let arg = "";
    if (call) {
      let d = 0, j = call[0].length, s = j;
      for (; j < rest.length; j++) { const ch = rest[j]; if (ch === "(") d++; else if (ch === ")") { if (d === 0) break; d--; } else if (ch === "," && d === 0) break; }
      arg = rest.slice(s, j).trim();
    }
    const literal = /^(["'`])[^"'`${}]+\1$/.test(arg);
    const typed = arg === "language" && /\blanguage\s*:\s*Language\b/.test(code);
    if (literal || typed) res.intlExplicit++;
    if (typed) res.languageTyped++;
  }
  res.navigator += (blank.match(/\bnavigator\b/g) || []).length;
  res.toLocaleString += (blank.match(/\btoLocaleString\b/g) || []).length;
  res.toLocaleDateString += (blank.match(/\btoLocaleDateString\b/g) || []).length;
  res.toLocaleTimeString += (blank.match(/\btoLocaleTimeString\b/g) || []).length;
  res.globals += (blank.match(GLOBALS) || []).length;
  res.nodeImports += (code.match(NODEMOD) || []).length;
  res.reactDom += (code.match(/["']react-dom(?:\/[^"']*)?["']/g) || []).length;
  if (/\bfrom\s*["']react(?:\/[^"']*)?["']|\bimport\s*\(\s*["']react["']/.test(code)) res.reactImporters.push(f);
  if (f === "react.ts") {
    res.stateTokens = (blank.match(/\b(useState|useReducer|useRef|useEffect|useSyncExternalStore|localStorage|sessionStorage|let)\b/g) || []).length;
    res.memoOnLanguage = /useMemo\s*<[^>]*>\s*\([^;]*,\s*\[\s*language\s*\]\s*,?\s*\)/.test(code) ? 1 : 0;
  }
}
console.log(JSON.stringify(res));
JS
}
SCANDIR=""
write_arch() { # the source of V in $BASE/arch (once)
  [ -n "$SCANDIR" ] && return 0
  mkdir -p "$BASE/arch"; git archive "$V" packages/i18n | tar -x -C "$BASE/arch" 2>/dev/null || return 1
  write_scan; SCANDIR="$BASE/arch"
}
scan() { nodebin "$BASE/scan.mjs" "$1" 2>/dev/null | tail -1; }
sj() { printf '%s' "$1" | jq -r "$2"; }
# a copy of the archive for the mutated scans
mutcopy() { rm -rf "$BASE/mut"; mkdir -p "$BASE/mut"; cp -R "$BASE/arch/packages" "$BASE/mut/"; }

# ---- the probes (TypeScript run with tsx inside packages/i18n of the worktree) -----------
write_probe_api() { cat > "$1" <<'TS'
import * as P from "./src/index";
import { translateWith, createTranslatorWith } from "./src/translate";
import { en as realEn } from "./src/messages/en";
import { vi as realVi } from "./src/messages/vi";
const out: Record<string, unknown> = {};
const sum = (xs: boolean[]) => xs.filter(Boolean).length;
const navKeys = ["home","activity","later","files","people","preferences","more","directMessages","channels","starred","conversations","search","admin"].map((k) => "nav." + k);
out.t1 = [sum([JSON.stringify(P.LANGUAGES) === '["en","vi"]']), sum([P.DEFAULT_LANGUAGE === "en"])];
const others: unknown[] = [undefined, null, "", "fr", "VI", "vi-VN", 0, {}, "EN"];
out.t2 = [sum([P.isLanguage("en"), P.isLanguage("vi")]), sum(others.map((v) => P.isLanguage(v) === false))];
out.t2b = [sum(others.slice(0, 6).map((v) => P.resolveLanguage(v) === "en")), sum([P.resolveLanguage("en") === "en", P.resolveLanguage("vi") === "vi"]), sum(others.slice(6).map((v) => P.resolveLanguage(v) === "en"))];
const names = P.LANGUAGE_NAMES as Record<string, string>;
const catalogText = JSON.stringify(realEn) + JSON.stringify(realVi);
out.t3 = [sum([names.en === "English", names.vi === "Tiếng Việt"]), Object.keys(names).length, sum([catalogText.includes('"English"'), catalogText.includes('"Tiếng Việt"')])];
out.t4 = [sum([P.translate("en", "nav.home") === "Home", P.translate("vi", "nav.home") === "Trang chủ"])];
const C: any = {
  en: { greet: "Hello {name}", tries: "{count} tries left", plain: "Plain", pair: "{a} and {b}", n: { one: "{count} try left", other: "{count} tries left" }, onlyEn: "Only English", onlyEnPlural: { one: "{count} item", other: "{count} items" } },
  vi: { greet: "Xin chào {name}", tries: "{count} lần thử còn lại", plain: "Đơn giản", pair: "{a} và {b}", n: { other: "{count} lần thử còn lại" } },
};
const T = (l: string, k: string, p?: any) => translateWith(C, l as any, k, p);
out.t5 = [sum([T("en", "greet", { name: "Ann" }) === "Hello Ann"]), sum([T("en", "tries", { count: 1234567 }) === "1234567 tries left", T("en", "greet", { name: 7 }) === "Hello 7"]), sum([T("en", "tries", { count: 2 }) === "2 tries left"])];
out.t5b = [sum([T("en", "greet") === "Hello {name}"]), sum([T("en", "plain", { name: "x" }) === "Plain"]), sum([T("en", "pair", { a: "X" }) === "X and {b}"])];
const counts = [0, 1, 2, 1.5];
out.t6 = [sum(counts.map((c) => T("en", "n", { count: c }) === (c === 1 ? "1 try left" : c + " tries left"))), sum([T("en", "n", { count: 1 }) === "1 try left", T("en", "n", { count: 0 }) === "0 tries left"])];
out.t6b = [sum(counts.map((c) => T("vi", "n", { count: c }) === c + " lần thử còn lại"))];
out.t6c = [sum([T("en", "n") === "{count} tries left"]), sum([T("en", "n", { count: "1" as any }) === "1 tries left"]), sum([T("en", "n", { count: null as any }) === "null tries left"])];
const protoKeys = ["nav.toString", "nav.constructor", "nav.valueOf", "constructor", "toString", "__proto__"];
let throws = 0, calls = 0;
const attempt = (f: () => unknown) => { calls++; try { f(); } catch { throws++; } };
for (const k of protoKeys) attempt(() => P.translate("vi", k as any));
attempt(() => P.translate("fr" as any, "nav.home"));
attempt(() => P.translate("en", "nav.home", null as any));
attempt(() => P.translate("en", "nav.home", new Proxy({}, { has() { throw 1; }, get() { throw 1; }, getOwnPropertyDescriptor() { throw 1; } }) as any));
out.t7 = [sum(protoKeys.map((k) => P.translate("en", k as any) === k)), throws, calls];
out.t7b = [sum([T("vi", "onlyEn") === "Only English"]), sum([T("vi", "onlyEnPlural", { count: 1 }) === "1 item"]), sum([T("vi", "plain") === "Đơn giản"])];
out.t7c = sum([T("en", "nope.nope") === "nope.nope", T("vi", "nope.nope") === "nope.nope", T("vi", "onlyNowhere") === "onlyNowhere", P.translate("vi", "nav.nope" as any) === "nav.nope"]);
let n = 0, diff = 0;
const sets: any[] = [undefined, { count: 1 }, { count: 0 }, { count: "1" }, { x: "y" }];
for (const l of P.LANGUAGES) for (const k of [...navKeys, "nav.nope", "nav.toString"]) for (const p of sets) { n++; if (P.translate(l, k as any, p) !== P.createTranslator(l)(k as any, p)) diff++; }
const sets2: any[] = [...sets, { name: "Ann" }];
for (const l of P.LANGUAGES) { const tr = createTranslatorWith(C, l); for (const k of [...Object.keys(C.en), "nope"]) for (const p of sets2) { n++; if (translateWith(C, l, k, p) !== tr(k as any, p)) diff++; } }
out.t9 = [n, diff, sum([P.createTranslator("en") === P.createTranslator("en")]), sum([P.createTranslator("vi") === P.createTranslator("vi")]), sum([P.createTranslator("en") !== P.createTranslator("vi")])];
console.log(JSON.stringify(out));
TS
}
write_probe_react() { cat > "$1" <<'TS'
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { I18nProvider, useTranslation } from "./src/react";
const seen: unknown[] = [];
function Probe() { const { t, language } = useTranslation(); seen.push(t); return h("p", null, language + "|" + t("nav.home")); }
const r = (el: any) => renderToString(el).replace(/<!--.*?-->/g, "").replace(/<\/?p>/g, "");
const sum = (xs: boolean[]) => xs.filter(Boolean).length;
const tree = (language: any) => h(I18nProvider, { language } as any, h(Probe));
const a = r(tree("en")), v = r(tree("vi")), c = r(tree("en"));
const none = r(h(I18nProvider, null as any, h(Probe)));
const noProvider = r(h(Probe));
const out: Record<string, unknown> = {};
out.t10 = [sum([v.startsWith("vi|")]), sum([v === "vi|Trang chủ"])];
out.t10b = [sum([none === "en|Home"]), sum([noProvider === "en|Home"])];
out.t11 = [sum([a === "en|Home"]), sum([v === "vi|Trang chủ"]), sum([c === a])];
out.t11b = [sum([seen[0] === seen[2]]), sum([seen[0] !== seen[1]])];
console.log(JSON.stringify(out));
TS
}
write_probe_fmt() { cat > "$1" <<'TS'
import { formatNumber } from "./src/index";
const sum = (xs: boolean[]) => xs.filter(Boolean).length;
const out: Record<string, unknown> = {};
const NF = Intl.NumberFormat;
const args: unknown[] = [];
(Intl as any).NumberFormat = function (...a: unknown[]) { args.push(a[0]); return new (NF as any)(...a); };
formatNumber("vi", 1); formatNumber("en", 1);
(Intl as any).NumberFormat = NF;
out.t24 = [sum([formatNumber("en", 1204) === "1,204"]), sum([formatNumber("en", 1234567.5) === "1,234,567.5"]), sum([args[1] === "en-GB"])];
const xs = [1204, 1234567.5, 0, -5, 1.5];
out.t24b = [sum(xs.map((x) => formatNumber("vi", x) === new Intl.NumberFormat("vi").format(x))), sum([args[0] === "vi"])];
let calls = 0, thrown = 0;
for (const l of ["en", "vi"] as const) for (const x of [0, -5, 1.5]) { calls++; try { formatNumber(l, x); } catch { thrown++; } }
(Intl as any).NumberFormat = undefined;
const gone = formatNumber("en", 1204);
(Intl as any).NumberFormat = function () { throw new Error("no data"); };
const boom = formatNumber("en", 1204);
(Intl as any).NumberFormat = NF;
out.t24c = [calls, thrown, sum([gone === "1204"]), sum([boom === "1204"])];
out.t24d = [new Intl.NumberFormat().resolvedOptions().locale, formatNumber("en", 1204), sum([formatNumber("vi", 1234567.5) === new Intl.NumberFormat("vi").format(1234567.5)])];
console.log(JSON.stringify(out));
TS
}
PA=""; PR=""; PF=""
runprobe() { # <name> <writer> <var>; the probe file lives in the worktree, outside src, and is removed
  need "$1" || return 1
  local f="$WT/$PK/zz-$1.ts" out
  "$2" "$f"
  out=$(pnenv -- --filter @toki/i18n exec tsx "zz-$1.ts" 2>"$BASE/probe.err" | tail -1)
  rm -f "$f"
  if ! printf '%s' "$out" | jq -e . >/dev/null 2>&1; then echo "$1 the probe gave no result (Blocked)"; return 1; fi
  printf -v "$3" '%s' "$out"
}
pa() { [ -n "$PA" ] || runprobe api write_probe_api PA; [ -n "$PA" ]; }
pr() { [ -n "$PR" ] || runprobe react write_probe_react PR; [ -n "$PR" ]; }
pf() { [ -n "$PF" ] || runprobe fmt write_probe_fmt PF; [ -n "$PF" ]; }
jx() { sj "$1" "$2 | map(tostring) | join(\" \")"; }

# ---- type probes: a temporary file inside src, run through the package's tsc ----------------
tsc_try() { # <file content> -> TSC_RC, TSC_NAMES (1 when the output names the file)
  printf '%s\n' "$1" > "$WT/$PK/src/zz-types.ts"
  pnenv -- --filter @toki/i18n exec tsc --noEmit > "$BASE/tsc.out" 2>&1; TSC_RC=$?
  TSC_NAMES=$(grep -c 'zz-types\.ts' "$BASE/tsc.out")
  rm -f "$WT/$PK/src/zz-types.ts"
}
tsc_pair() { # <label> <good content> <bad content>
  need "$1" || return
  tsc_try "$2"; local good=$TSC_RC
  tsc_try "$3"
  echo "$1 $good $([ "$TSC_RC" != 0 ] && echo 1 || echo 0) $([ "$TSC_NAMES" -ge 1 ] && echo 1 || echo 0)"
}

# ---- the check command in the worktree -------------------------------------------------
CK_RC=""
chk() { # runs `pnpm --filter @toki/i18n check`; keeps its own lines (not the pnpm banner)
  pnenv -- --filter @toki/i18n check > "$BASE/ck.raw" 2>&1; CK_RC=$?
  grep -E '^(en|vi) |^i18n check:' "$BASE/ck.raw" > "$BASE/ck.out"
}
plines() { grep -cE '^(en|vi) ' "$BASE/ck.out"; }
named() { grep -cxF "$1" "$BASE/ck.out"; }
summary() { grep -E '^i18n check:' "$BASE/ck.out" | head -1; }
# a mutated run: <apply function> -> prints "<clean rc> <mutated rc>" through CLEAN_RC and CK_RC
# the vi and en sources of the small mutations
m_a() { edit "$PK/src/messages/vi/nav.ts" 's/^  home: .*\n//m'; }
m_b() { addnav vi 'extra: "Thêm nữa",'; }
m_c() { edit "$PK/src/messages/vi/nav.ts" 's/home: "Trang chủ"/home: ""/; s/activity: "Hoạt động"/activity: "   "/'; addnav en 'emptyForm: { one: "", other: "x" },'; addnav vi 'emptyForm: { other: "y" },'; }
m_d_ok() { addnav en 'tries: { one: "One try left", other: "{count} tries left" },'; addnav vi 'tries: { other: "{count} lần thử còn lại" },'; }
m_d_bad() { addnav en 'tries: { one: "One try left", other: "{count} tries left" },'; addnav vi 'tries: { other: "lần thử còn lại" },'; }
m_e() { addnav en 'Bad_key: "x",'; addnav vi 'Bad_key: "x",'; }
m_f() {
  addnav en 'p: { one: "x" },'; addnav vi 'p: { other: "x" },'
  addnav en 'q: { other: "x" },'; addnav vi 'q: { other: "x" },'
  addnav en 'r: { one: "a", other: "b", few: "c" },'; addnav vi 'r: { other: "b" },'
  addnav en 's: { one: "a", other: "b" },'; addnav vi 's: { one: "a", other: "b" },'
}
mutrun() { # <function> -> CK_RC after the mutation (checked to apply), then restores
  "$1"; if ! changed; then CK_RC="none"; reset_wt; return; fi
  chk; reset_wt
}

# ---- the workflow at V, without comment lines --------------------------------------------
YML=$(doc "$WF" | grep -v '^[[:space:]]*#')
job_block() { printf '%s\n' "$YML" | awk -v j="$1" '/^jobs:/{on=1; next} on && /^  [A-Za-z0-9_-]+:[[:space:]]*$/{cur=$0; gsub(/[ :]/,"",cur); inj=(cur==j); next} on && inj {print}'; }

# ---- the history of real runs (read-only) ------------------------------------------------
HIST="$BASE/hist.tsv"; HIST_OK=""
history() {
  [ -n "$HIST_OK" ] && return "$([ "$HIST_OK" = 1 ] && echo 0 || echo 1)"
  local epoch id event br conc created
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
  if [ -n "$CACHE" ]; then cp "$CACHE"/j/*.tsv "$BASE/j/" 2>/dev/null; fi
  cut -f1 "$BASE/runs.tsv" | while read -r r; do [ -s "$BASE/j/$r.tsv" ] || echo "$r"; done | xargs -P 4 -I{} bash -c 'gh api "repos/$REPO/actions/runs/{}/jobs?per_page=100" --jq ".jobs[] | [.name, (.conclusion // \"\"), ([.steps[] | select(.conclusion == \"failure\") | .name][0] // \"\"), .id] | @tsv" > "$BASE/j/{}.tsv" 2>/dev/null'
  local f
  for f in "$BASE"/j/*.tsv; do
    [ -f "$f" ] || continue
    awk -F'\t' 'NF == 4 && $4 ~ /^[0-9]+$/' "$f" > "$f.ok"; mv "$f.ok" "$f"
  done
  local missing=0 try
  while IFS=$'\t' read -r id event br conc created; do
    for try in 1 2 3; do
      [ -s "$BASE/j/$id.tsv" ] && break
      sleep 1
      gh api "repos/$REPO/actions/runs/$id/jobs?per_page=100" --jq '.jobs[] | [.name, (.conclusion // ""), ([.steps[] | select(.conclusion == "failure") | .name][0] // ""), .id] | @tsv' 2>/dev/null | grep -E '.+	.*	.*	[0-9]+$' > "$BASE/j/$id.tsv"
    done
    [ -s "$BASE/j/$id.tsv" ] || missing=$((missing + 1))
  done < "$BASE/runs.tsv"
  if [ -n "$CACHE" ]; then
    for id in $(cut -f1 "$BASE/runs.tsv"); do [ -s "$BASE/j/$id.tsv" ] && [ ! -s "$CACHE/j/$id.tsv" ] && cp "$BASE/j/$id.tsv" "$CACHE/j/$id.tsv"; done
  fi
  if [ "$missing" -gt 0 ]; then echo "$missing of $(grep -c . "$BASE/runs.tsv") runs could not be read" > "$BASE/gh.err"; HIST_OK=0; return 1; fi
  : > "$HIST"
  while IFS=$'\t' read -r id event br conc created; do
    [ -f "$BASE/j/$id.tsv" ] || continue
    awk -F'\t' -v a="$id" -v b="$event" -v c="$br" -v d="$conc" -v e="$created" 'BEGIN{OFS="\t"} {print a, b, c, d, e, $1, $2, $3, $4}' "$BASE/j/$id.tsv" >> "$HIST"
  done < "$BASE/runs.tsv"
  HIST_OK=1; return 0
}
need_hist() { history && return 0; echo "$1 the history could not be read: $(head -c 120 "$BASE/gh.err" | tr '\n' ' ') (Blocked)"; return 1; }
# columns of HIST: 1 run id, 2 event, 3 branch, 4 run conclusion, 5 created, 6 job name, 7 job conclusion, 8 failed step, 9 job id

# ================================ the rows ================================================
t1() { pa T1 || return; echo "T1 $(jx "$PA" '.t1')"; }
t1b() { tsc_pair T1B "import type { Language } from './languages';
export const a: Language = 'en';
export const b: Language = 'vi';" "import type { Language } from './languages';
export const a: Language = 'fr';"; }
t2() { pa T2 || return; echo "T2 $(jx "$PA" '.t2')"; }
t2b() { pa T2B || return; echo "T2B $(jx "$PA" '.t2b')"; }
t3() { pa T3 || return; echo "T3 $(jx "$PA" '.t3')"; }
t4() { pa T4 || return; echo "T4 $(jx "$PA" '.t4')"; }
t5() { pa T5 || return; echo "T5 $(jx "$PA" '.t5')"; }
t5b() { pa T5B || return; echo "T5B $(jx "$PA" '.t5b')"; }
t6() { pa T6 || return; echo "T6 $(jx "$PA" '.t6')"; }
t6b() { pa T6B || return; echo "T6B $(jx "$PA" '.t6b')"; }
t6c() { pa T6C || return; echo "T6C $(jx "$PA" '.t6c')"; }
t6d() { tsc_pair T6D "import { translate } from './translate';
export const a = translate('en', 'nav.home', { count: 1 });" "import { translate } from './translate';
export const a = translate('en', 'nav.home', { count: '1' });"; }
t7() { pa T7 || return; echo "T7 $(jx "$PA" '.t7')"; }
t7b() { pa T7B || return; echo "T7B $(jx "$PA" '.t7b')"; }
t7c() { pa T7C || return; echo "T7C $(sj "$PA" '.t7c')"; }
t8() { tsc_pair T8 "import { translate } from './translate';
export const a = translate('en', 'nav.home');" "import { translate } from './translate';
export const a = translate('en', 'nav.nope');"; }
t8b() { tsc_pair T8B "import type { MessageKey } from './translate';
type Code = 'a' | 'b';
export const m: Record<Code, MessageKey> = { a: 'nav.home', b: 'nav.admin' };" "import type { MessageKey } from './translate';
type Code = 'a' | 'b';
export const m: Record<Code, MessageKey> = { a: 'nav.home', b: 'nav.nope' };"; }
t9() { pa T9 || return; echo "T9 $(jx "$PA" '.t9')"; }
t10() { pr T10 || return; echo "T10 $(jx "$PR" '.t10')"; }
t10b() { pr T10B || return; echo "T10B $(jx "$PR" '.t10b')"; }
t11() {
  pr T11 || return; write_arch || { echo "T11 could not read the source (Blocked)"; return; }
  local s tokens mut
  s=$(scan "$SCANDIR"); tokens=$(sj "$s" '.stateTokens')
  mutcopy; printf '\nconst copy = useState("en");\n' >> "$BASE/mut/$PK/src/react.ts"; mut=$(sj "$(scan "$BASE/mut")" '.stateTokens')
  echo "T11 $(jx "$PR" '.t11') $tokens $([ "$mut" -ge 1 ] && echo 1 || echo 0)"
}
t11b() {
  pr T11B || return; write_arch || { echo "T11B could not read the source (Blocked)"; return; }
  local s memo mut
  s=$(scan "$SCANDIR"); memo=$(sj "$s" '.memoOnLanguage')
  mutcopy; perl -0pi -e 's/\[language\]/[]/' "$BASE/mut/$PK/src/react.ts"; mut=$(sj "$(scan "$BASE/mut")" '.memoOnLanguage')
  echo "T11B $memo $(jx "$PR" '.t11b') $mut"
}
t12() {
  write_arch || { echo "T12 could not read the source (Blocked)"; return; }
  local s m n first
  s=$(scan "$SCANDIR")
  mutcopy; printf '\nexport const a = new Intl.NumberFormat();\nexport const b = new Intl.NumberFormat(undefined);\nexport const c = new Intl.NumberFormat(void 0);\n' >> "$BASE/mut/$PK/src/format.ts"
  m=$(scan "$BASE/mut")
  mutcopy; printf '\nexport const p = new Intl.PluralRules("en");\n' >> "$BASE/mut/$PK/src/translate.ts"
  n=$(scan "$BASE/mut")
  first=$(sj "$s" '.intlFiles | join(",")')
  echo "T12 $(sj "$s" '.sources') $(sj "$s" '.intlFiles | length') $([ "$first" = "format.ts" ] && echo 1 || echo 0) $(sj "$s" '.intlUses') $(sj "$s" '.intlExplicit') $(sj "$s" '.languageTyped') $(sj "$m" '.intlUses - .intlExplicit') $(sj "$n" '.intlFiles | length')"
}
t12b() {
  write_arch || { echo "T12B could not read the source (Blocked)"; return; }
  local s m
  s=$(scan "$SCANDIR")
  mutcopy; printf '\nexport const a = navigator.language;\nexport const b = (1).toLocaleString();\nexport const c = new Date().toLocaleDateString();\nexport const d = new Date().toLocaleTimeString();\n' >> "$BASE/mut/$PK/src/translate.ts"
  m=$(scan "$BASE/mut")
  echo "T12B $(sj "$s" '[.navigator, .toLocaleString, .toLocaleDateString, .toLocaleTimeString] | map(tostring) | join(" ")') $(sj "$m" '.navigator + .toLocaleString + .toLocaleDateString + .toLocaleTimeString')"
}
t13() {
  need T13 || return
  chk; local clean=$CK_RC
  printf 'export const extra = { a: "A", b: "B" };\n' > "$WT/$PK/src/messages/en/extra.ts"
  chk; local rc=$CK_RC n; n=$(named 'en messages/en/extra.ts: not listed in index.ts')
  local pl; pl=$(plines); reset_wt
  echo "T13 $clean $rc $n $pl"
}
list_extra() { # <lang>: list the file extra in the index of the language
  perl -0pi -e 's/\A/import { extra } from ".\/extra";\n/; s/\{ nav \};/{ nav, extra };/' "$WT/$PK/src/messages/$1/index.ts"
}
t13b() {
  need T13B || return
  printf 'export const extra = { a: "A", b: "B" };\n' > "$WT/$PK/src/messages/en/extra.ts"; list_extra en
  chk; local rc=$CK_RC a b; a=$(named 'vi extra.a: missing'); b=$(named 'vi extra.b: missing')
  local pl; pl=$(plines); reset_wt
  echo "T13B $rc $a $b $pl"
}
t13c() {
  need T13C || return
  local l
  for l in en vi; do printf 'export const extra = { a: "A", b: "B" };\n' > "$WT/$PK/src/messages/$l/extra.ts"; list_extra "$l"; done
  chk; local rc=$CK_RC keys other
  keys=$(summary | sed -nE 's/^i18n check: ([0-9]+) keys.*/\1/p')
  other=$(cd "$WT" && { git diff --name-only; git ls-files --others --exclude-standard; } | grep -vc "^$PK/src/messages/")
  reset_wt
  echo "T13C $rc ${keys:-none} $other"
}
t14() {
  need T14 || return
  chk; local clean=$CK_RC
  addnav en 'one: "x",'; addnav vi 'one: "x",'
  edit "$PK/src/messages/en/nav.ts" 's/\n\};\s*\z/\n  a: { b: { c: { d: "x" } } },\n};\n/'; edit "$PK/src/messages/vi/nav.ts" 's/\n\};\s*\z/\n  a: { b: { c: { d: "x" } } },\n};\n/'
  changed || { echo "T14 the mutation did not apply (Blocked)"; reset_wt; return; }
  chk; local rc=$CK_RC n1 n2 pl
  n1=$(grep -cE '^en nav\.one: ' "$BASE/ck.out"); n2=$(grep -cE '^en nav\.a\.b\.c\.d: ' "$BASE/ck.out"); pl=$(plines)
  reset_wt
  echo "T14 $clean $rc $((n1 + n2)) $pl"
}
t14b() {
  need T14B || return
  local k
  # the keys that the committed English catalog really holds, read with a probe of the catalog
  printf 'import { en } from "./src/messages/en";\nconsole.log(JSON.stringify(Object.keys(en.nav).map((k) => "nav." + k)));\n' > "$WT/$PK/zz-keys.ts"
  local real; real=$(pnenv -- --filter @toki/i18n exec tsx zz-keys.ts 2>/dev/null | tail -1); rm -f "$WT/$PK/zz-keys.ts"
  local total=0 good=0
  for k in $(printf '%s' "$real" | jq -r '.[]'); do
    total=$((total + 1))
    # the naming rule of the spec: 2 to 4 dotted parts, each lowerCamelCase, none a plural form name
    printf '%s' "$k" | grep -qE '^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*){1,3}$' && ! printf '%s' "$k" | tr '.' '\n' | grep -qxE 'zero|one|two|few|many|other' && good=$((good + 1))
  done
  # the same rule on bad keys must refuse them
  local refused=0
  for k in nav.Bad_key nav.one a.b.c.d.e nav; do
    printf '%s' "$k" | grep -qE '^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*){1,3}$' && ! printf '%s' "$k" | tr '.' '\n' | grep -qxE 'zero|one|two|few|many|other' || refused=$((refused + 1))
  done
  echo "T14B $total $good $refused"
}
t15() {
  need T15 || return
  doc "$SPEC" | sed -n 's/^| `\(nav\.[A-Za-z]*\)` | \(.*\) | \(.*\) |$/\1\t\2\t\3/p' > "$BASE/table.tsv"
  local rows; rows=$(grep -c . "$BASE/table.tsv")
  printf 'import { translate } from "./src/index";\nimport { readFileSync } from "node:fs";\nlet bad = 0, n = 0;\nfor (const line of readFileSync(process.argv[2], "utf8").split("\\n")) { if (!line) continue; const [k, en, vi] = line.split("\\t"); n += 2; if (translate("en", k as any) !== en) bad++; if (translate("vi", k as any) !== vi) bad++; }\nconsole.log(JSON.stringify([n, bad]));\n' > "$WT/$PK/zz-table.ts"
  local out; out=$(pnenv -- --filter @toki/i18n exec tsx zz-table.ts "$BASE/table.tsv" 2>/dev/null | tail -1); rm -f "$WT/$PK/zz-table.ts"
  printf '%s' "$out" | jq -e . >/dev/null 2>&1 || { echo "T15 the probe gave no result (Blocked)"; return; }
  # the same comparison on a table with one changed text must find it
  perl -pe 's/\t[^\t]*$/\tchanged/ if $. == 1' "$BASE/table.tsv" > "$BASE/table2.tsv"
  printf 'import { translate } from "./src/index";\nimport { readFileSync } from "node:fs";\nlet bad = 0;\nfor (const line of readFileSync(process.argv[2], "utf8").split("\\n")) { if (!line) continue; const [k, en, vi] = line.split("\\t"); if (translate("en", k as any) !== en) bad++; if (translate("vi", k as any) !== vi) bad++; }\nconsole.log(JSON.stringify([bad]));\n' > "$WT/$PK/zz-table.ts"
  local mut; mut=$(pnenv -- --filter @toki/i18n exec tsx zz-table.ts "$BASE/table2.tsv" 2>/dev/null | tail -1); rm -f "$WT/$PK/zz-table.ts"
  echo "T15 $rows $(jx "$out" '.') $(jx "$mut" '.')"
}
t15b() {
  need T15B || return
  doc "$SPEC" | sed -n 's/^| `\(nav\.[A-Za-z]*\)` |.*/\1/p' | sort > "$BASE/spec-keys.txt"
  printf 'import { en } from "./src/messages/en";\nimport { vi } from "./src/messages/vi";\nconsole.log(JSON.stringify({ en: Object.keys(en), vi: Object.keys(vi), enNav: Object.keys(en.nav).map((k) => "nav." + k), viNav: Object.keys(vi.nav).map((k) => "nav." + k) }));\n' > "$WT/$PK/zz-ns.ts"
  local out; out=$(pnenv -- --filter @toki/i18n exec tsx zz-ns.ts 2>/dev/null | tail -1); rm -f "$WT/$PK/zz-ns.ts"
  printf '%s' "$out" | jq -e . >/dev/null 2>&1 || { echo "T15B the probe gave no result (Blocked)"; return; }
  printf '%s' "$out" | jq -r '.enNav[]' | sort > "$BASE/en-keys.txt"; printf '%s' "$out" | jq -r '.viNav[]' | sort > "$BASE/vi-keys.txt"
  local extra missing
  extra=$(comm -13 "$BASE/spec-keys.txt" "$BASE/en-keys.txt" | grep -c .); missing=$(comm -23 "$BASE/spec-keys.txt" "$BASE/en-keys.txt" | grep -c .)
  echo "T15B $(grep -c . "$BASE/en-keys.txt") $(sj "$out" '.en | length') $(sj "$out" '.vi | length') $extra $missing $(cmp -s "$BASE/en-keys.txt" "$BASE/vi-keys.txt" && echo 1 || echo 0)"
}
t15c() {
  write_arch || { echo "T15C could not read the source (Blocked)"; return; }
  doc "$SPEC" | sed -n 's/^| `\(nav\.[A-Za-z]*\)` | \(.*\) | \(.*\) |$/\1\t\2\t\3/p' > "$BASE/table.tsv"
  local f n best=0 bestf="" k en vi
  for f in $(git ls-tree -r --name-only "$V" -- "$PK/src" | grep -E '\.test\.ts$'); do
    doc "$f" > "$BASE/tf.txt"; n=0
    while IFS=$'\t' read -r k en vi; do
      grep -qF "$k" "$BASE/tf.txt" && grep -qF "$vi" "$BASE/tf.txt" && grep -qF "$en" "$BASE/tf.txt" && n=$((n + 1))
    done < "$BASE/table.tsv"
    [ "$n" -gt "$best" ] && { best=$n; bestf=$f; }
  done
  echo "T15C $(grep -c . "$BASE/table.tsv") $best $(basename "${bestf:-none}")"
}
t16() {
  need T16 || return
  chk; local rc=$CK_RC lines keys exact
  lines=$(grep -c '^i18n check:' "$BASE/ck.out"); keys=$(summary | sed -nE 's/^i18n check: ([0-9]+) keys.*/\1/p')
  exact=$(summary | grep -cE '^i18n check: [0-9]+ keys, 2 languages, no problem$')
  echo "T16 $rc $lines ${keys:-none} $exact $(plines)"
}
t17a() { need T17A || return; chk; local clean=$CK_RC; mutrun m_a; echo "T17A $clean $CK_RC $(named 'vi nav.home: missing') $(plines)"; }
t17b() { need T17B || return; chk; local clean=$CK_RC; mutrun m_b; echo "T17B $clean $CK_RC $(named 'en nav.extra: missing') $(plines)"; }
t17c() {
  need T17C || return; chk; local clean=$CK_RC; mutrun m_c
  echo "T17C $clean $CK_RC $(named 'vi nav.home: empty text') $(named 'vi nav.activity: empty text') $(named 'en nav.emptyForm: empty text in form one') $(plines)"
}
t17d() {
  need T17D || return; chk; local clean=$CK_RC
  mutrun m_d_ok; local ok=$CK_RC okp; okp=$(plines)
  mutrun m_d_bad; local bad=$CK_RC n; n=$(grep -cE '^vi nav\.tries: placeholders differ' "$BASE/ck.out")
  echo "T17D $clean $ok $okp $bad $n $(plines)"
}
t17e() { need T17E || return; chk; local clean=$CK_RC; mutrun m_e; echo "T17E $clean $CK_RC $(grep -cE '^en nav\.Bad_key: breaks the naming rule' "$BASE/ck.out") $(plines)"; }
t17f() {
  need T17F || return; chk; local clean=$CK_RC; mutrun m_f
  echo "T17F $clean $CK_RC $(named 'en nav.p: plural forms lack other') $(named 'en nav.q: plural forms lack one in English') $(named 'en nav.r: form few is not used in en') $(named 'vi nav.s: form one is not used in vi') $(plines)"
}
t17g() {
  need T17G || return
  m_a; m_b; m_c; m_d_bad; m_e; m_f
  changed || { echo "T17G the mutation did not apply (Blocked)"; reset_wt; return; }
  chk; reset_wt
  local pl sum; pl=$(plines); sum=$(summary | sed -nE 's/^i18n check: ([0-9]+) problems?$/\1/p')
  echo "T17G $CK_RC $pl ${sum:-none} $([ "$pl" = "${sum:-x}" ] && echo 1 || echo 0)"
}
t18() {
  need T18 || return; chk; local clean=$CK_RC
  edit "$PK/src/messages/vi/nav.ts" 's/home: "Trang chủ"/home: "Home"/'
  changed || { echo "T18 the mutation did not apply (Blocked)"; reset_wt; return; }
  chk; local rc=$CK_RC
  echo "T18 $clean $rc $(summary | grep -cE 'no problem$') $(plines)"
  reset_wt
}
t19() {
  need T19 || return
  local script root pkgl rootl same
  script=$(doc package.json | jq -r '.scripts["i18n:check"]')
  pnenv -- i18n:check > "$BASE/root.raw" 2>&1; local rrc=$?
  grep -E '^(en|vi) |^i18n check:' "$BASE/root.raw" > "$BASE/root.out"
  chk; local prc=$CK_RC
  echo "T19 $([ "$script" = "pnpm --filter @toki/i18n check" ] && echo 1 || echo 0) $rrc $prc $(cmp -s "$BASE/root.out" "$BASE/ck.out" && echo 1 || echo 0) $(grep -c . "$BASE/root.out")"
}
t19b() {
  need T19B || return
  m_a; changed || { echo "T19B the mutation did not apply (Blocked)"; reset_wt; return; }
  pnenv -- i18n:check > "$BASE/root.raw" 2>&1; local rrc=$?
  grep -E '^(en|vi) |^i18n check:' "$BASE/root.raw" > "$BASE/root.out"
  chk; local prc=$CK_RC
  echo "T19B $rrc $prc $(cmp -s "$BASE/root.out" "$BASE/ck.out" && echo 1 || echo 0) $(grep -cxF 'vi nav.home: missing' "$BASE/root.out") $(grep -cxF 'vi nav.home: missing' "$BASE/ck.out")"
  reset_wt
}
t20() {
  local blk; blk=$(job_block i18n)
  local named=0 runs=0 other=0 inst=0 ents=0 uses=0 baduses=0 l
  printf '%s\n' "$blk" | grep -qE '^    name:[[:space:]]*i18n[[:space:]]*$' && named=1
  runs=$(printf '%s\n' "$blk" | grep -cE '^      - run:')
  printf '%s\n' "$blk" | grep -E '^      - run:' | grep -qxE '      - run: pnpm i18n:check' && other=1
  inst=$(printf '%s\n' "$blk" | grep -E '^      - run:' | grep -cE 'pnpm install --frozen-lockfile')
  ents=$(printf '%s\n' "$YML" | grep -cE '^    name:[[:space:]]*i18n[[:space:]]*$')
  while read -r l; do
    case "$l" in *actions/checkout@*|*pnpm/action-setup@*|*actions/setup-node@*) ;; *) baduses=$((baduses + 1)) ;; esac
  done < <(printf '%s\n' "$blk" | grep -E '^      - uses:')
  echo "T20 $named $((runs - inst)) $other $inst $ents $baduses"
}
t20b() {
  need_hist T20B || return
  local mt pr later
  mt=$(perl -MPOSIX -e 'print strftime("%Y-%m-%dT%H:%M:%SZ", gmtime($ARGV[0]))' "$(git show -s --format=%ct "$V")")
  pr=$(awk -F'\t' '$2 == "pull_request" && $3 == "feat/toki-017-i18n-package" && $6 == "i18n" {print $1}' "$HIST" | sort -u | wc -l | tr -d ' ')
  later=$(awk -F'\t' -v t="$mt" '$5 > t && $6 == "i18n" {print $1}' "$HIST" | sort -u | wc -l | tr -d ' ')
  echo "T20B $pr $later"
}
t20c() {
  need_hist T20C || return
  local failed red
  failed=$(awk -F'\t' '$6 == "i18n" && $7 == "failure" {print $1}' "$HIST" | sort -u | wc -l | tr -d ' ')
  red=$(awk -F'\t' '$6 == "i18n" && $7 == "failure" && $4 == "failure" {print $1}' "$HIST" | sort -u | wc -l | tr -d ' ')
  if [ "$failed" = 0 ]; then echo "T20C $failed $red no run of ci.yml up to $HIST_UNTIL shows the i18n job failed, so no red run is shown by the history; the red exit of the check itself is row T19B (Blocked)"; return; fi
  echo "T20C $failed $red $(awk -F'\t' '$6 == "i18n" && $7 == "failure" && $8 == "Run pnpm i18n:check" {print $1}' "$HIST" | sort -u | wc -l | tr -d ' ')"
}
t20d() {
  need_hist T20D || return
  local ok runs
  runs=$(awk -F'\t' '$2 == "pull_request" && $6 == "i18n" {print $1}' "$HIST" | sort -u | wc -l | tr -d ' ')
  ok=$(awk -F'\t' '$2 == "pull_request" && $6 == "i18n" && $7 == "success" && $4 == "success" {print $1}' "$HIST" | sort -u | wc -l | tr -d ' ')
  echo "T20D $([ "$runs" -ge 1 ] && echo 1 || echo 0) $([ "$ok" -ge 1 ] && echo 1 || echo 0)"
}
t21() {
  local pj m; pj=$(doc "$PK/package.json")
  m=$(printf '%s' "$pj" | jq '.exports["./extra"] = "./src/extra.ts"')
  ok() { printf '%s' "$1" | jq -r '(.exports | keys | sort) == [".", "./react"] and .exports["."] == "./src/index.ts" and .exports["./react"] == "./src/react.ts"'; }
  echo "T21 $(printf '%s' "$pj" | jq -r '.exports | length') $([ "$(ok "$pj")" = true ] && echo 1 || echo 0) $([ "$(ok "$m")" = true ] && echo 1 || echo 0)"
}
t21b() {
  local pj m; pj=$(doc "$PK/package.json")
  m=$(printf '%s' "$pj" | jq '.dependencies = {"react": "19.3.1"}')
  ok() { printf '%s' "$1" | jq -r '(.peerDependencies | has("react")) and (has("dependencies") | not)'; }
  echo "T21B $(printf '%s' "$pj" | jq -r '.peerDependencies | has("react") | if . then 1 else 0 end') $([ "$(ok "$pj")" = true ] && echo 1 || echo 0) $([ "$(ok "$m")" = true ] && echo 1 || echo 0)"
}
t21c() {
  write_arch || { echo "T21C could not read the source (Blocked)"; return; }
  local s m
  s=$(scan "$SCANDIR")
  mutcopy; printf '\nimport { useMemo } from "react";\nexport const u = useMemo;\n' >> "$BASE/mut/$PK/src/translate.ts"; m=$(scan "$BASE/mut")
  echo "T21C $(sj "$s" '.sources') $(sj "$s" '.reactImporters | length') $([ "$(sj "$s" '.reactImporters | join(",")')" = "react.ts" ] && echo 1 || echo 0) $(sj "$m" '.reactImporters | length')"
}
t21d() {
  need T21D || return
  printf 'let a = 0, b = 0;\ntry { await import("./src/index"); a = 1; } catch {}\ntry { await import("./src/react"); b = 1; } catch {}\nconsole.log(JSON.stringify([a, b]));\n' > "$WT/$PK/zz-noreact.ts"
  local with; with=$(pnenv -- --filter @toki/i18n exec tsx zz-noreact.ts 2>/dev/null | tail -1)
  # react made unreachable for the package (the worktree only): the main entry still loads, the react entry does not
  local d="$WT/$PK/node_modules" moved=0
  [ -e "$d/react" ] && { mv "$d/react" "$d/react.off"; moved=1; }
  local without; without=$(pnenv -- --filter @toki/i18n exec tsx zz-noreact.ts 2>/dev/null | tail -1)
  [ "$moved" = 1 ] && mv "$d/react.off" "$d/react"
  rm -f "$WT/$PK/zz-noreact.ts"
  echo "T21D $(jx "$with" '.') $(jx "$without" '.') $moved"
}
t22() {
  write_arch || { echo "T22 could not read the source (Blocked)"; return; }
  local s m
  s=$(scan "$SCANDIR")
  mutcopy; printf '\nimport fs from "node:fs";\nexport const w = window;\nexport const d = document.title;\nexport const p = process.env;\n' >> "$BASE/mut/$PK/src/translate.ts"; m=$(scan "$BASE/mut")
  echo "T22 $(sj "$s" '.sources') $(sj "$s" '.globals') $(sj "$s" '.nodeImports') $(sj "$s" '.reactDom') $(sj "$m" '.globals + .nodeImports')"
}
t22b() {
  need T22B || return
  pnenv -- exec eslint "$PK" --max-warnings 0 > "$BASE/es.out" 2>&1; local clean=$?
  printf '\nexport const zzWindow = window;\n' >> "$WT/$PK/src/languages.ts"
  pnenv -- exec eslint "$PK" --max-warnings 0 > "$BASE/es.out" 2>&1; local bad=$?
  reset_wt
  echo "T22B $clean $([ "$bad" != 0 ] && echo 1 || echo 0)"
}
t23() {
  need T23 || return
  pnenv -- --filter @toki/i18n test > "$BASE/vt.out" 2>&1; local rc=$?
  local files passed failed
  sed -E 's/\x1b\[[0-9;]*m//g' "$BASE/vt.out" > "$BASE/vt.txt"
  passed=$(sed -n 's/.*Test Files.* \([0-9]*\) passed.*/\1/p' "$BASE/vt.txt" | head -1)
  failed=$(sed -n 's/.*Test Files.* \([0-9]*\) failed.*/\1/p' "$BASE/vt.txt" | head -1)
  edit "$PK/src/languages.ts" 's/DEFAULT_LANGUAGE = "en"/DEFAULT_LANGUAGE = "vi"/'
  changed || { echo "T23 the mutation did not apply (Blocked)"; reset_wt; return; }
  pnenv -- --filter @toki/i18n test > "$BASE/vt2.out" 2>&1; local mut=$?
  reset_wt
  echo "T23 $rc ${passed:-0} ${failed:-0} $([ "$mut" != 0 ] && echo 1 || echo 0)"
}
t23b() {
  need T23B || return
  pnenv -- typecheck > "$BASE/tc.out" 2>&1; local rc=$?
  printf 'export const zz: number = "a";\n' > "$WT/$PK/src/zz-types.ts"
  pnenv -- typecheck > "$BASE/tc2.out" 2>&1; local bad=$?
  reset_wt
  echo "T23B $rc $([ "$bad" != 0 ] && echo 1 || echo 0)"
}
t23c() {
  need T23C || return
  local inc ok=0 testf scr
  inc=$(jq -c '.include' "$WT/$PK/tsconfig.json")
  pnenv -- --filter @toki/i18n exec tsc --noEmit --listFilesOnly > "$BASE/lf.out" 2>&1
  testf=$(grep -c "/$PK/src/.*\.test\.ts$" "$BASE/lf.out"); scr=$(grep -c "/$PK/scripts/check\.ts$" "$BASE/lf.out")
  [ "$inc" = '["src","scripts"]' ] && ok=1
  edit "$PK/tsconfig.json" 's/"include": \["src", "scripts"\]/"include": ["src"]/'
  changed || { echo "T23C the mutation did not apply (Blocked)"; reset_wt; return; }
  pnenv -- --filter @toki/i18n exec tsc --noEmit --listFilesOnly > "$BASE/lf2.out" 2>&1
  local scr2; scr2=$(grep -c "/$PK/scripts/check\.ts$" "$BASE/lf2.out")
  reset_wt
  echo "T23C $ok $([ "$testf" -ge 1 ] && echo 1 || echo 0) $scr $scr2"
}
t24() { pf T24 || return; echo "T24 $(jx "$PF" '.t24')"; }
t24b() { pf T24B || return; echo "T24B $(jx "$PF" '.t24b')"; }
t24c() { pf T24C || return; echo "T24C $(jx "$PF" '.t24c')"; }
t24d() {
  need T24D || return
  pf T24D || return
  local base out loc
  write_probe_fmt "$WT/$PK/zz-fmt2.ts"
  out=$(pnenv LC_ALL=vi_VN.UTF-8 LANG=vi_VN.UTF-8 -- --filter @toki/i18n exec tsx zz-fmt2.ts 2>/dev/null | tail -1); rm -f "$WT/$PK/zz-fmt2.ts"
  printf '%s' "$out" | jq -e . >/dev/null 2>&1 || { echo "T24D the probe gave no result (Blocked)"; return; }
  base=$(sj "$PF" '.t24d[0]'); loc=$(sj "$out" '.t24d[0]')
  echo "T24D $([ "$base" != "$loc" ] && echo 1 || echo 0) $([ "$(sj "$out" '.t24d[1]')" = "1,204" ] && echo 1 || echo 0) $(sj "$out" '.t24d[2]') $([ "$(sj "$PF" '.t24d[1]')" = "$(sj "$out" '.t24d[1]')" ] && echo 1 || echo 0)"
}

ALL="T1 T1B T2 T2B T3 T4 T5 T5B T6 T6B T6C T6D T7 T7B T7C T8 T8B T9 T10 T10B T11 T11B T12 T12B T13 T13B T13C T14 T14B T15 T15B T15C T16 T17A T17B T17C T17D T17E T17F T17G T18 T19 T19B T20 T20B T20C T20D T21 T21B T21C T21D T22 T22B T23 T23B T23C T24 T24B T24C T24D"
rows="${*:-$ALL}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't' | tr 'ABCDEFG' 'abcdefg')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
[ "$HIST_OK" = 1 ] && echo "HISTORY runs $(grep -c . "$BASE/runs.tsv") jobs $(grep -c . "$HIST") from $(git log --format=%cs "$V^1..$V^2" 2>/dev/null | tail -1) until $HIST_UNTIL"
alive=0
cleanup; WT=""
for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
alive=$((alive + $(pgrep -f "$BASENAME" 2>/dev/null | wc -l | tr -d ' ')))
echo "CLEAN worktrees $([ "$(git worktree list | grep -c "$BASENAME")" = 0 ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive temporary-folder $([ -e "$BASE" ] && echo left || echo removed)"
