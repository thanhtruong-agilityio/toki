#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-009.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile` and one `npm install playwright-core` into the temporary folder.
# It writes nothing to GitHub, opens no pull request and uses no `gh`.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-009.checks.sh [T1 T2 T2B ...]
# It reads files of the commit V with `git show`. Rows that run code use ONE temporary worktree of V,
# made under one folder (BASE, made in the current shell, exported as TMPDIR and given to every process
# it starts through `env -i`), with its own `corepack pnpm install --frozen-lockfile` under Node 22.
# The 30 states of R16 run in the headless Chromium that Playwright has cached, against a page of the
# temporary worktree that loads packages/tokens/src/tokens.css and is served from 127.0.0.1 on a free
# port found with python. The values the rows compare with are read from the spec of TOKI-009 at V
# (Tables A to E and the text of R1, R4, R10 and R15), not from the package under test.
# A check that must fail is paired with a run that must pass: a file of the temporary worktree is
# changed, the check runs, and `git checkout` restores the file. A row that cannot be shown prints
# Blocked and the reason. The ending trap removes the worktree, the server, every process it started and
# BASE, even when a row fails, and the last line says so. No `.env` file is read or created. It prints one
# line for each row: counts, exit codes and words; no tool output and no value of a secret.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
SPEC="docs/specs/2026-11-16-tokens-package-design.md"
doc() { git show "$V:$1" 2>/dev/null; }

BASE=$(mktemp -d); export TMPDIR="$BASE"
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
reset_wt() { ( cd "$WT" && git checkout -q -- . ); rm -f "$WT/packages/tokens/src/zz-types.ts"; }
freeport() { python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()'; }
firstline() { head -n 1 "$1" 2>/dev/null | cut -c1-140; }

# ---- the harness: reads the spec, the package and tokens.css, prints one line for each row -----------
write_harness() { cat > "$WT/packages/tokens/zz-harness.ts" <<'TS'
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as api from "./src/index";
import { toCss } from "./src/css";

const BASE = process.env.QA_BASE as string;
const spec = readFileSync(join(BASE, "spec.md"), "utf8");
const root = process.cwd();
const css = readFileSync(join(root, "src/tokens.css"), "utf8");
const out: string[] = [];
const say = (id: string, text: string) => out.push(`${id} ${text}`);
const A: any = api;

// ---- what the spec says ----
const canon = (x: any): any => Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x;
const same = (a: any, b: any) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const section = (from: string, to: string) => { const i = spec.indexOf("\n" + from); return spec.slice(i, spec.indexOf("\n" + to, i + 1)); };
const rawRows = (t: string) => t.split("\n").filter((l) => l.startsWith("|") && !/^\|\s*:?-/.test(l)).slice(1).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
const val = (c: string) => { const s = c.replace(/`/g, ""); return /^\d+$/.test(s) ? Number(s) : s; };
const rowsA = rawRows(section("Table A.", "Table B.")).map((r) => ({ v: r[0].replace(/`/g, ""), k: r[1].replace(/`/g, ""), calm: val(r[2]), focus: val(r[3]) }));
const rowsB = rawRows(section("Table B.", "Table C.")).map((r) => ({ look: r[0].toLowerCase(), accent: r[1].toLowerCase(), v: [val(r[2]), val(r[3]), val(r[4]), val(r[5])] }));
const rowsC = rawRows(section("Table C.", "Table D.")).map((r) => ({ d: r[0].toLowerCase(), v: [val(r[1]), val(r[2]), val(r[3])] }));
const rowsD = rawRows(section("Table D.", "Table E.")).map((r) => ({ look: r[0].toLowerCase(), v: [val(r[1]), val(r[2])] }));
const layersOf = (cell: string) => cell.trim() === "none" ? [] : [...cell.matchAll(/`([^`]+)`/g)].map((m) => { const p = /^(\d+) (\d+) (\d+) (\d+) (.+)$/.exec(m[1])!; return { x: +p[1], y: +p[2], blur: +p[3], spread: +p[4], color: p[5] }; });
const rowsE = rawRows(section("Table E.", "The prototype writes alpha")).map((r) => ({ look: r[0].toLowerCase(), shadow: layersOf(r[1]), pop: layersOf(r[2]) }));
const ACC = ["accent", "onAccent", "accentSoft", "accentText"], DEN = ["avatarSize", "messageGap", "rowHeight"], RAD = ["radius", "radiusSm"], SHA = ["shadow", "pop"];
const looksX = ["calm", "focus"], accentsX = ["teal", "indigo", "clay", "violet"], densX = ["comfortable", "compact"];
const expPal: any = {}, expAcc: any = {}, expDen: any = {}, expRad: any = {}, expSh: any = {};
for (const l of looksX) { expPal[l] = Object.fromEntries(rowsA.map((r: any) => [r.k, r[l]])); expAcc[l] = {}; }
for (const r of rowsB) expAcc[r.look][r.accent] = Object.fromEntries(ACC.map((k, i) => [k, r.v[i]]));
for (const r of rowsC) expDen[r.d] = Object.fromEntries(DEN.map((k, i) => [k, r.v[i]]));
for (const r of rowsD) expRad[r.look] = Object.fromEntries(RAD.map((k, i) => [k, r.v[i]]));
for (const r of rowsE) expSh[r.look] = { shadow: r.shadow, pop: r.pop };
const r1 = spec.split("\n").find((l) => l.startsWith("- R1. "))!;
const r4 = spec.split("\n").find((l) => l.startsWith("- R4. "))!;
const r10 = spec.split("\n").find((l) => l.startsWith("- R10. "))!;
const r15 = spec.split("\n").find((l) => l.startsWith("- R15. "))!;
const union = (name: string) => [...(new RegExp("`" + name + "` \\(`([^`]+)`\\)").exec(r1)![1].matchAll(/"(\w+)"/g))].map((m) => m[1]);
const ld = /`lookDensity` is `\{ calm: "(\w+)", focus: "(\w+)" \}`/.exec(r4)!;
const expLookDen: any = { calm: ld[1], focus: ld[2] };
const specNames = [...r10.matchAll(/`(--[a-z0-9-]+)`/g)].map((m) => m[1]);

// ---- the form of a value in tokens.css (R15), and the 32 properties ----
type Kind = "color" | "px" | "pct" | "shadow";
const VARS: [string, string, Kind][] = [
  ...rowsA.map((r: any): [string, string, Kind] => [r.v, r.k, typeof r.calm === "number" ? "pct" : "color"]),
  ["--accent", "accent", "color"], ["--on-accent", "onAccent", "color"], ["--accent-soft", "accentSoft", "color"], ["--accent-text", "accentText", "color"],
  ["--av", "avatarSize", "px"], ["--gap", "messageGap", "px"], ["--row", "rowHeight", "px"],
  ["--radius", "radius", "px"], ["--radius-sm", "radiusSm", "px"], ["--shadow", "shadow", "shadow"], ["--pop", "pop", "shadow"],
];
const kindOf: any = Object.fromEntries(VARS.map(([v, , k]) => [v, k]));
const keyOf: any = Object.fromEntries(VARS.map(([v, k]) => [v, k]));
const fmtShadow = (l: any[]) => l.length ? l.map((a) => `${a.x}px ${a.y}px ${a.blur}px ${a.spread}px ${a.color}`).join(", ") : "none";
const cssOf = (t: any) => Object.fromEntries(VARS.map(([v, k, kind]) => [v, kind === "px" ? `${t[k]}px` : kind === "pct" ? `${t[k]}%` : kind === "shadow" ? fmtShadow(t[k]) : t[k]]));
const specTheme = (look: string, accent: string, den: string) => ({ ...expPal[look], ...expAcc[look][accent], ...expDen[den], ...expRad[look], ...expSh[look] });
const cmp = (actual: any, exp: any) => { let bad = 0; const n = Object.keys(exp).length; for (const k of Object.keys(exp)) if (!same(actual?.[k], exp[k])) bad++; for (const k of Object.keys(actual ?? {})) if (!(k in exp)) bad++; return { n, bad }; };

// ---- R1 to R8: the objects ----
say("T1", `${[[A.looks, union("Look")], [A.accents, union("Accent")], [A.densities, union("Density")]].filter(([a, b]: any) => JSON.stringify(a) === JSON.stringify(b)).length}`);
say("T2", looksX.map((l) => `${Object.values(A.palettes[l] ?? {}).filter((v) => typeof v === "string").length} ${Object.values(A.palettes[l] ?? {}).filter((v) => typeof v === "number").length}`).join(" "));
{ let n = 0, bad = 0; for (const l of looksX) { const c = cmp(A.palettes[l], expPal[l]); n += c.n; bad += c.bad; } say("T2B", `${n} ${bad}`); }
{ let pairs = 0, exact = 0, n = 0, bad = 0;
  for (const l of looksX) for (const a of accentsX) { pairs++; const x = A.accentColors?.[l]?.[a]; if (x && same(Object.keys(x).sort(), [...ACC].sort())) exact++; const c = cmp(x, expAcc[l][a]); n += c.n; bad += c.bad; }
  say("T3", `${pairs} ${exact}`); say("T3B", `${n} ${bad}`); }
{ let n = 0, bad = 0; for (const d of densX) { const c = cmp(A.densityValues?.[d], expDen[d]); n += c.n; bad += c.bad; } bad += Object.keys(A.densityValues ?? {}).filter((k) => !densX.includes(k)).length; say("T4", `${n} ${bad}`);
  const c = cmp(A.lookDensity, expLookDen); say("T4B", `${c.n} ${c.bad}`); }
{ let n = 0, bad = 0; for (const l of looksX) { const c = cmp(A.radii?.[l], expRad[l]); n += c.n; bad += c.bad; } say("T5", `${n} ${bad}`); }
{ let lists = 0, layers = 0, fields = 0, bad = 0;
  for (const l of looksX) for (const s of SHA) {
    lists++; const e = expSh[l][s], a = A.shadows?.[l]?.[s];
    if (!Array.isArray(a) || a.length !== e.length) bad++;
    layers += e.length; fields += e.length * 5;
    if (Array.isArray(a)) e.forEach((x: any, i: number) => { bad += cmp(a[i], x).bad; });
  }
  say("T6", `${lists} ${layers} ${fields} ${bad}`);
  say("T6B", `${Array.isArray(A.shadows?.focus?.shadow) ? 1 : 0} ${A.shadows?.focus?.shadow?.length ?? -1}`); }

// ---- R7: getTheme, 24 calls ----
{ const expKeys = [...Object.keys(expPal.calm), ...ACC, ...DEN, ...RAD, ...SHA];
  let calls = 0, badKeys = 0, accN = 0, accBad = 0, otherN = 0, otherBad = 0, omitCalls = 0, omitN = 0, omitBad = 0;
  for (const l of looksX) for (const a of accentsX) for (const d of [...densX, undefined]) {
    calls++; const t = A.getTheme(l, a, d); const eden = d ?? expLookDen[l];
    if (!same(Object.keys(t).sort(), [...expKeys].sort())) badKeys++;
    const ca = cmp(Object.fromEntries(ACC.map((k) => [k, t[k]])), expAcc[l][a]); accN += ca.n; accBad += ca.bad;
    const co = cmp(Object.fromEntries([...Object.keys(expPal[l]), ...DEN, ...RAD, ...SHA].map((k) => [k, t[k]])), { ...expPal[l], ...expDen[eden], ...expRad[l], ...expSh[l] }); otherN += co.n; otherBad += co.bad;
    if (d === undefined) { omitCalls++; const c = cmp(Object.fromEntries(DEN.map((k) => [k, t[k]])), expDen[expLookDen[l]]); omitN += c.n; omitBad += c.bad; }
  }
  say("T7", `${calls} ${expKeys.length} ${badKeys}`); say("T7B", `${calls} ${accN} ${accBad}`); say("T7C", `${omitCalls} ${omitN} ${omitBad}`); say("T7D", `${calls} ${otherN} ${otherBad}`); }

// ---- R8: the form of every exported value ----
{ const LEN = new Set([...DEN, ...RAD, "x", "y", "blur", "spread"]), TINT = new Set(rowsA.filter((r: any) => typeof r.calm === "number").map((r: any) => r.k));
  const COL = new Set([...rowsA.filter((r: any) => typeof r.calm === "string").map((r: any) => r.k), ...ACC, "color"]);
  const leaves: [string, any][] = [];
  const walk = (v: any, key: string) => { if (typeof v === "function") return; if (Array.isArray(v)) { v.forEach((x) => walk(x, key)); return; } if (v && typeof v === "object") { for (const [k, x] of Object.entries(v)) walk(x, k); return; } leaves.push([key, v]); };
  for (const [k, v] of Object.entries(A)) walk(v, k);
  for (const l of looksX) for (const a of accentsX) for (const d of [...densX, undefined]) walk(A.getTheme(l, a, d), "theme");
  const len = leaves.filter(([k]) => LEN.has(k)), tint = leaves.filter(([k]) => TINT.has(k)), col = leaves.filter(([k]) => COL.has(k));
  say("T8", `${len.length} ${len.filter(([, v]) => typeof v !== "number" || !Number.isFinite(v)).length}`);
  say("T8B", `${col.length} ${col.filter(([, v]) => !(typeof v === "string" && (/^#[0-9A-F]{6}$/.test(v) || /^rgba\(\d+,\d+,\d+,\d+(\.\d+)?\)$/.test(v)))).length}`);
  say("T8C", `${tint.length} ${tint.filter(([, v]) => typeof v !== "number" || v < 0 || v > 100).length}`);
  const sus = (s: string) => /var\(|calc\(/.test(s) || /\d\s*(px|rem|em|pt|vh|vw|vmin|vmax|cm|mm|%)(?![A-Za-z])/.test(s);
  const strs = leaves.filter(([, v]) => typeof v === "string");
  say("T8D", `${strs.length} ${strs.filter(([, v]) => sus(v)).length} ${["16px", "var(--bg)", "calc(1px + 2px)", "12rem"].filter(sus).length}`); }

// ---- R9: the exports of package.json ----
{ const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const want: any = { ".": "./src/index.ts", "./tokens.css": "./src/tokens.css" };
  const ex = pkg.exports ?? {};
  say("T9", `${Object.keys(ex).length} ${Object.keys(want).filter((k) => ex[k] === want[k]).length}`);
  say("T9B", `${Object.values(ex).length} ${Object.values(ex).filter((t: any) => existsSync(join(root, t))).length}`); }

// ---- the blocks of tokens.css ----
type Rule = { sel: string; decls: [string, string][]; media?: string; pos: number };
const rules: Rule[] = [];
{ const text = css.replace(/\/\*[\s\S]*?\*\//g, ""); let pos = 0;
  const blocks = (t: string) => { const r: { sel: string; body: string }[] = []; let i = 0; while (i < t.length) { const o = t.indexOf("{", i); if (o < 0) break; let d = 1, j = o + 1; while (j < t.length && d) { if (t[j] === "{") d++; else if (t[j] === "}") d--; j++; } r.push({ sel: t.slice(i, o).trim(), body: t.slice(o + 1, j - 1) }); i = j; } return r; };
  const decls = (b: string): [string, string][] => b.split(";").map((d) => d.trim()).filter(Boolean).map((d) => { const k = d.indexOf(":"); return [d.slice(0, k).trim(), d.slice(k + 1).trim()]; });
  for (const b of blocks(text)) { const p = pos++; if (b.sel.startsWith("@media")) { const m = b.sel.slice(6).trim(); for (const x of blocks(b.body)) rules.push({ sel: x.sel, decls: decls(x.body), media: m, pos: p }); } else rules.push({ sel: b.sel, decls: decls(b.body), pos: p }); } }
const top = (sel: string) => rules.filter((r) => !r.media && r.sel === sel);
const dec = (r: Rule | undefined, n: string) => r?.decls.find(([k]) => k === n)?.[1];
const SEL_CALM = ':root, :root[data-eff="calm"]', SEL_FOCUS = ':root[data-eff="focus"]', SEL_DEV = ":root:not([data-eff])", MEDIA = "(prefers-color-scheme: dark)";
const calmR = top(SEL_CALM)[0], focusR = top(SEL_FOCUS)[0], devR = rules.find((r) => r.media === MEDIA && r.sel === SEL_DEV);
const props = (r: Rule | undefined) => (r?.decls ?? []).filter(([k]) => k.startsWith("--"));

// R10
{ const declared = new Set(rules.flatMap((r) => props(r).map(([k]) => k)));
  say("T10", `${declared.size} ${specNames.length} ${[...declared].filter((k) => !specNames.includes(k)).length} ${specNames.filter((k) => !declared.has(k)).length}`); }
// R11
say("T11", `${top(SEL_CALM).length} ${top(SEL_FOCUS).length}`);
say("T11B", `${props(calmR).length} ${specNames.filter((n) => !props(calmR).some(([k]) => k === n)).length} ${props(focusR).length} ${specNames.filter((n) => !props(focusR).some(([k]) => k === n)).length}`);
{ let n = 0, bad = 0;
  for (const [l, r] of [["calm", calmR], ["focus", focusR]] as [string, Rule | undefined][]) { const e: any = cssOf(specTheme(l, "teal", expLookDen[l])); for (const k of Object.keys(e)) { n++; if (dec(r, k) !== e[k]) bad++; } }
  say("T11C", `${n} ${bad}`); }
say("T11D", `2 ${(dec(calmR, "color-scheme") === "light" ? 0 : 1) + (dec(focusR, "color-scheme") === "dark" ? 0 : 1)}`);
// R12
say("T12", `${rules.filter((r) => r.media === MEDIA).length} ${rules.filter((r) => r.media === MEDIA && r.sel === SEL_DEV).length}`);
{ const a = devR?.decls ?? [], b = focusR?.decls ?? []; let bad = Math.abs(a.length - b.length); for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) bad++; say("T12B", `${a.length} ${b.length} ${bad}`); }
// R13
{ const re = /^:root\[data-eff="(calm|focus)"\]\[data-accent="(\w+)"\]$/; const acc = rules.filter((r) => !r.media && /data-accent/.test(r.sel));
  let found = 0, n = 0, bad = 0;
  for (const l of looksX) for (const a of accentsX.filter((x) => x !== "teal")) { const r = top(`:root[data-eff="${l}"][data-accent="${a}"]`)[0]; if (r) found++; const e: any = Object.fromEntries(ACC.map((k) => [Object.entries(keyOf).find(([, kk]) => kk === k)![0], expAcc[l][a][k]]));
    for (const k of Object.keys(e)) { n++; if (dec(r, k) !== e[k]) bad++; } bad += Math.abs((r?.decls.length ?? 4) - 4); }
  say("T13", `${found} ${acc.length - found + acc.filter((r) => !re.test(r.sel)).length}`); say("T13B", `${found} ${n} ${bad}`);
  say("T13C", `${rules.filter((r) => /data-accent="teal"/.test(r.sel)).length} ${acc.length}`); }
// R14
{ const dr = densX.map((d) => top(`:root[data-density="${d}"]`)[0]); const all = rules.filter((r) => /data-density/.test(r.sel));
  let n = 0, bad = 0;
  densX.forEach((d, i) => { const r = dr[i]; const e: any = { "--av": `${expDen[d].avatarSize}px`, "--gap": `${expDen[d].messageGap}px`, "--row": `${expDen[d].rowHeight}px` }; for (const k of Object.keys(e)) { n++; if (dec(r, k) !== e[k]) bad++; } bad += Math.abs((r?.decls.length ?? 3) - 3); });
  say("T14", `${dr.filter(Boolean).length} ${all.length - dr.filter(Boolean).length}`); say("T14B", `${dr.filter(Boolean).length} ${n} ${bad}`);
  const minD = Math.min(...all.map((r) => r.pos)); const lp = [calmR, devR, focusR].map((r) => r?.pos ?? -1);
  say("T14C", `${lp.length} ${lp.filter((p) => p >= minD).length}`); }
// R15
{ const t = (l: string, a = "teal") => A.getTheme(l, a);
  const lookBlocks: [Rule | undefined, any][] = [[calmR, t("calm")], [devR, t("focus")], [focusR, t("focus")]];
  const accBlocks: [Rule, any][] = rules.filter((r) => !r.media && /^:root\[data-eff="(calm|focus)"\]\[data-accent="\w+"\]$/.test(r.sel)).map((r) => { const m = /data-eff="(\w+)"\]\[data-accent="(\w+)"/.exec(r.sel)!; return [r, t(m[1], m[2])]; });
  const denBlocks = rules.filter((r) => /data-density/.test(r.sel));
  const pick = (r: Rule | undefined, kind: Kind) => (r?.decls ?? []).filter(([k]) => kindOf[k] === kind);
  const lens = [...lookBlocks.flatMap(([r]) => pick(r, "px")), ...denBlocks.flatMap((r) => pick(r, "px"))];
  say("T15", `${lens.length} ${lens.filter(([, v]) => !/^\d+(\.\d+)?px$/.test(v)).length}`);
  const tints = lookBlocks.flatMap(([r]) => pick(r, "pct"));
  say("T15B", `${tints.length} ${tints.filter(([, v]) => !/^\d+(\.\d+)?%$/.test(v)).length}`);
  const cols: [string, string, any][] = [...lookBlocks.flatMap(([r, th]) => pick(r, "color").map(([k, v]): [string, string, any] => [k, v, th])), ...accBlocks.flatMap(([r, th]) => pick(r, "color").map(([k, v]): [string, string, any] => [k, v, th]))];
  say("T15C", `${cols.length} ${cols.filter(([, v]) => !(/^#[0-9A-F]{6}$/.test(v) || /^rgba\(\d+,\d+,\d+,\d+(\.\d+)?\)$/.test(v))).length} ${cols.filter(([k, v, th]) => v !== th[keyOf[k]]).length}`);
  const colr = "(#[0-9A-F]{6}|rgba\\(\\d+,\\d+,\\d+,\\d+(\\.\\d+)?\\))", layer = `\\d+px \\d+px \\d+px \\d+px ${colr}`; const shRe = new RegExp(`^(none|${layer}(, ${layer})*)$`);
  const shs: [string, string, any][] = lookBlocks.flatMap(([r, th]) => pick(r, "shadow").map(([k, v]): [string, string, any] => [k, v, th]));
  say("T15D", `${shs.length} ${shs.filter(([, v]) => !shRe.test(v)).length} ${shs.filter(([k, v, th]) => v !== fmtShadow(th[keyOf[k]])).length}`);
  const ex = [...r15.matchAll(/(Calm|Focus) `(--[a-z-]+)`: `([^`]+)`/g)];
  say("T15E", `${ex.length} ${ex.filter((m) => dec(m[1] === "Calm" ? calmR : focusR, m[2]) === m[3]).length}`); }
// R17
say("T17", `${toCss() === css ? 1 : 0} ${css.split("\n").length - 1}`);
{ const head = css.trimStart(); const c = head.startsWith("/*") ? head.slice(0, head.indexOf("*/")) : "";
  say("T17C", `${head.startsWith("/*") ? 1 : 0} ${/generated/i.test(c) ? 1 : 0} ${c.includes("pnpm --filter @toki/tokens generate") ? 1 : 0}`); }

// ---- R18, R19: the files of the package ----
const files = readFileSync(join(BASE, "files.txt"), "utf8").split("\n").filter(Boolean).filter((f) => !f.endsWith("src/tokens.test.ts"));
const text = (f: string) => readFileSync(join(root, "../..", f), "utf8");
{ const names = ["--stage", "--stage-bar", "--stage-ink", "--stage-line", "--stage-muted", "--tile"]; const re = (n: string) => new RegExp(`${n}(?![\\w-])`);
  say("T18", `${names.length} ${files.length} ${files.reduce((n, f) => n + names.filter((x) => re(x).test(text(f))).length, 0)} ${names.filter((x) => re(x).test(`a { color: var(${x}); }`)).length}`); }
{ const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const src = files.filter((f) => /^packages\/tokens\/src\/.*\.ts$/.test(f));
  const dom = (s: string) => /\b(window|document|navigator|localStorage|sessionStorage|location|HTMLElement|XMLHttpRequest|fetch|requestAnimationFrame)\b/.test(strip(s));
  const node = (s: string) => /\bprocess\b|\brequire\s*\(|\bBuffer\b|__dirname|__filename|from\s+["'](node:[^"']+|fs|path|os|url|child_process|crypto|util)["']|import\s+["']node:|import\(\s*["']node:/.test(strip(s));
  const spec2 = (s: string) => [...strip(s).matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].filter((m) => !m[1].startsWith(".")).length;
  const bodies = src.map(text);
  say("T19", `${src.length} ${bodies.filter(dom).length} ${["window.x", "document.body", "navigator.userAgent", "localStorage.a", "fetch(u)", "location.href"].filter(dom).length}`);
  say("T19B", `${src.length} ${bodies.filter(node).length} ${["process.env", "require('x')", "import 'node:fs'", "Buffer.from(1)", "import {a} from 'fs'", "__dirname"].filter(node).length}`);
  say("T19C", `${src.length} ${bodies.reduce((n, b) => n + spec2(b), 0)} ${["import a from 'react'", "import 'x'", "export * from 'zod'", "import b from '@toki/shared'"].filter((s) => spec2(s) > 0).length}`);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")); say("T19D", `${"dependencies" in pkg ? 1 : 0} ${Object.keys(pkg.devDependencies ?? {}).length}`); }

// ---- the 30 states of R16: what the browser must show, from getTheme ----
{ const states: any[] = [];
  const dens: (string | null)[] = ["comfortable", "compact", null];
  for (const l of looksX) for (const a of accentsX) for (const d of dens) states.push({ group: "a-light", eff: l, accent: a, density: d, scheme: "light", expected: cssOf(A.getTheme(l, a, d ?? undefined)) });
  for (const s of ["light", "dark"]) for (const d of dens) states.push({ group: "b", eff: null, accent: null, density: d, scheme: s, expected: cssOf(A.getTheme(s === "light" ? "calm" : "focus", "teal", d ?? undefined)) });
  for (const l of looksX) for (const a of accentsX) for (const d of dens) states.push({ group: "a-dark", eff: l, accent: a, density: d, scheme: "dark", expected: cssOf(A.getTheme(l, a, d ?? undefined)) });
  writeFileSync(join(BASE, "expected.json"), JSON.stringify(states)); }

console.log(out.join("\n"));
TS
}

# ---- the browser script (Playwright's library, installed into BASE; the cached Chromium) ------------
write_pw() { cat > "$BASE/pw/run.mjs" <<'JS'
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const BASE = process.env.QA_BASE;
const [url, expectedFile, outFile] = process.argv.slice(2);
const done = (o) => { writeFileSync(outFile, JSON.stringify(o)); process.exit(0); };
let browser;
try {
  const { chromium } = createRequire(BASE + "/pw/")("playwright-core");
  browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto(url);
  const states = JSON.parse(readFileSync(expectedFile, "utf8"));
  const names = Object.keys(states[0].expected);
  const res = [];
  for (const s of states) {
    await page.emulateMedia({ colorScheme: s.scheme });
    const got = await page.evaluate(({ eff, accent, density, names }) => {
      const r = document.documentElement;
      for (const [n, v] of [["data-eff", eff], ["data-accent", accent], ["data-density", density]]) v == null ? r.removeAttribute(n) : r.setAttribute(n, v);
      const cs = getComputedStyle(r);
      return names.map((n) => cs.getPropertyValue(n).trim());
    }, { eff: s.eff, accent: s.accent, density: s.density, names });
    res.push({ group: s.group, compared: names.length, mismatches: names.filter((n, i) => got[i] !== s.expected[n]).length });
  }
  await browser.close();
  done({ error: null, states: res });
} catch (e) {
  try { await browser?.close(); } catch {}
  done({ error: String(e && e.message || e).split("\n")[0].slice(0, 140), states: [] });
}
JS
}

# ---- the shared runs ---------------------------------------------------------------------------------
HARNESS_DONE=""; HARNESS_RC=""
harness() {
  [ -n "$HARNESS_DONE" ] && return "$HARNESS_RC"
  doc "$SPEC" > "$BASE/spec.md"
  git ls-tree -r --name-only "$V" -- packages/tokens > "$BASE/files.txt"
  write_harness
  pnenv QA_BASE="$BASE" -- --filter @toki/tokens exec tsx zz-harness.ts > "$BASE/h.out" 2> "$BASE/h.err"; HARNESS_RC=$?
  HARNESS_DONE=1; return "$HARNESS_RC"
}
hline() { grep -E "^$1 " "$BASE/h.out" | head -n 1; }
hrow() { # a row that is one line of the harness
  need "$1" || return
  harness || { echo "$1 the harness did not run: $(firstline "$BASE/h.err") (Blocked)"; return; }
  hline "$1" || echo "$1 the harness printed no line (Blocked)"
}
hval() { hline "$1" | cut -d' ' -f2-; }

TEST_DONE=""; TEST_RC=""
test_run() {
  [ -n "$TEST_DONE" ] && return 0
  pnenv -- --filter @toki/tokens exec vitest run --reporter=json --outputFile="$BASE/vt.json" > /dev/null 2>&1; TEST_JSON_RC=$?
  pnenv -- --filter @toki/tokens test > "$BASE/vt.log" 2>&1; TEST_RC=$?
  TEST_DONE=1
}
vt_count() { # tests whose title starts with $1: how many, how many passed
  jq -r --arg p "^$1( |$)" '[.testResults[].assertionResults[] | select(.title | test($p))] | "\(length) \(map(select(.status == "passed")) | length)"' "$BASE/vt.json" 2> /dev/null
}

BROWSER_DONE=""; BROWSER_ERR=""
browser_runs() {
  [ -n "$BROWSER_DONE" ] && return 0
  BROWSER_DONE=1
  harness || { BROWSER_ERR="the harness did not run"; return 1; }
  mkdir -p "$BASE/pw"; echo '{"private":true}' > "$BASE/pw/package.json"
  ( cd "$BASE/pw" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" npm install playwright-core@1.65.1 --ignore-scripts --no-audit --no-fund --cache "$BASE/npm-cache" > "$BASE/npm.log" 2>&1 ) || { BROWSER_ERR="playwright-core did not install: $(firstline "$BASE/npm.log")"; return 1; }
  write_pw
  local port; port=$(freeport)
  printf '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="src/tokens.css"></head><body></body></html>\n' > "$WT/packages/tokens/zz-page.html"
  ( cd "$WT" && exec env -i PATH="$PATH" python3 -m http.server "$port" --bind 127.0.0.1 > /dev/null 2>&1 ) &
  PIDS="$PIDS $!"; disown "$!" 2> /dev/null; sleep 1
  local url="http://127.0.0.1:$port/packages/tokens/zz-page.html" i
  for i in clean mutated; do
    if [ "$i" = mutated ]; then
      perl -0pi -e 's/--bg: #F2F4EF;/--bg: #F2F4EE;/' "$WT/packages/tokens/src/tokens.css"
      ( cd "$WT" && git diff --quiet -- packages/tokens/src/tokens.css ) && { BROWSER_ERR="the mutation did not apply"; return 1; }
    fi
    env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" QA_BASE="$BASE" node "$BASE/pw/run.mjs" "$url" "$BASE/expected.json" "$BASE/pw-$i.json" > "$BASE/pw-$i.log" 2>&1
    [ "$i" = mutated ] && reset_wt
    [ -s "$BASE/pw-$i.json" ] || { BROWSER_ERR="the browser script wrote nothing: $(firstline "$BASE/pw-$i.log")"; return 1; }
    local e; e=$(jq -r '.error // empty' "$BASE/pw-$i.json")
    [ -z "$e" ] || { BROWSER_ERR="$e"; return 1; }
  done
  return 0
}
pwrow() { # $1 id, $2 group
  need "$1" || return
  browser_runs || { echo "$1 the browser could not be driven: $BROWSER_ERR (Blocked)"; return; }
  local q='[.states[] | select(.group == $g)]'
  local st va bad mut
  st=$(jq -r --arg g "$2" "$q | length" "$BASE/pw-clean.json"); va=$(jq -r --arg g "$2" "$q | map(.compared) | add" "$BASE/pw-clean.json")
  bad=$(jq -r --arg g "$2" "$q | map(.mismatches) | add" "$BASE/pw-clean.json")
  mut=$(jq -r --arg g "$2" "$q | map(.mismatches) | add | if . > 0 then 1 else 0 end" "$BASE/pw-mutated.json")
  echo "$1 $st $va $bad $mut"
}

# ---- the rows ----------------------------------------------------------------------------------------
t1() {
  need T1 || return
  harness || { echo "T1 the harness did not run: $(firstline "$BASE/h.err") (Blocked)"; return; }
  local a b
  cat > "$WT/packages/tokens/src/zz-types.ts" <<'TS'
import type { Accent, Density, Look } from "./index";
type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
export const a: Eq<Look, "calm" | "focus"> = true;
export const b: Eq<Accent, "teal" | "indigo" | "clay" | "violet"> = true;
export const c: Eq<Density, "comfortable" | "compact"> = true;
TS
  pnenv -- --filter @toki/tokens exec tsc --noEmit > "$BASE/t1a.log" 2>&1; a=$?
  perl -0pi -e 's/Eq<Look, "calm" \| "focus">/Eq<Look, "calm">/' "$WT/packages/tokens/src/zz-types.ts"
  pnenv -- --filter @toki/tokens exec tsc --noEmit > "$BASE/t1b.log" 2>&1; b=$?
  reset_wt
  echo "T1 $(hval T1) $a $([ "$b" != 0 ] && echo 1 || echo 0)"
}
t2() { hrow T2; }; t2b() { hrow T2B; }; t3() { hrow T3; }; t3b() { hrow T3B; }
t4() { hrow T4; }; t4b() { hrow T4B; }; t5() { hrow T5; }; t6() { hrow T6; }; t6b() { hrow T6B; }
t7() { hrow T7; }; t7b() { hrow T7B; }; t7c() { hrow T7C; }; t7d() { hrow T7D; }
t8() { hrow T8; }; t8b() { hrow T8B; }; t8c() { hrow T8C; }; t8d() { hrow T8D; }
t9() { hrow T9; }; t9b() { hrow T9B; }
t9c() {
  need T9C || return
  local web="$WT/apps/web" r a b c
  grep -q '"dependencies"' "$web/package.json" || { echo "T9C apps/web has no dependencies object to add the link to (Blocked)"; return; }
  perl -0pi -e 's/("dependencies":\s*\{)/$1\n    "\@toki\/tokens": "workspace:*",/' "$web/package.json"
  pnenv -- install --no-frozen-lockfile --prefer-offline > "$BASE/t9c.log" 2>&1 || { reset_wt; echo "T9C the workspace link could not be installed: $(firstline "$BASE/t9c.log") (Blocked)"; return; }
  r=$( cd "$web" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node --input-type=module -e '
    const res = (s) => { try { return import.meta.resolve(s); } catch (e) { return "ERR:" + e.code; } };
    console.log(res("@toki/tokens/tokens.css")); console.log(res("@toki/tokens")); console.log(res("@toki/tokens/zz-not-exported.css"));' 2>/dev/null )
  a=0; b=0; c=0
  printf '%s\n' "$r" | sed -n 1p | grep -q 'packages/tokens/src/tokens\.css$' && [ -f "$WT/packages/tokens/src/tokens.css" ] && a=1
  printf '%s\n' "$r" | sed -n 2p | grep -q 'packages/tokens/src/index\.ts$' && b=1
  printf '%s\n' "$r" | sed -n 3p | grep -q 'ERR:ERR_PACKAGE_PATH_NOT_EXPORTED' && c=1
  reset_wt
  echo "T9C $a $b $c"
}
t9d() { need T9D || return; test_run; echo "T9D $(vt_count R9)"; }
t10() { hrow T10; }; t11() { hrow T11; }; t11b() { hrow T11B; }; t11c() { hrow T11C; }; t11d() { hrow T11D; }
t12() { hrow T12; }; t12b() { hrow T12B; }
t12c() { need T12C || return; test_run; echo "T12C $(vt_count R12)"; }
t13() { hrow T13; }; t13b() { hrow T13B; }; t13c() { hrow T13C; }
t14() { hrow T14; }; t14b() { hrow T14B; }; t14c() { hrow T14C; }
t15() { hrow T15; }; t15b() { hrow T15B; }; t15c() { hrow T15C; }; t15d() { hrow T15D; }; t15e() { hrow T15E; }
t16() { pwrow T16 a-light; }; t16b() { pwrow T16B b; }; t16c() { pwrow T16C a-dark; }
t16d() { need T16D || return; test_run; echo "T16D $(vt_count R16a) $(vt_count R16b)"; }
t17() { hrow T17; }
t17b() {
  need T17B || return
  local f="$WT/packages/tokens/src/tokens.css" before rc after
  printf '\n/* changed by hand */\n' >> "$f"
  ( cd "$WT" && git diff --quiet -- packages/tokens/src/tokens.css ); before=$?
  pnenv -- --filter @toki/tokens run generate > "$BASE/t17b.log" 2>&1; rc=$?
  ( cd "$WT" && git diff --quiet -- packages/tokens/src/tokens.css ); after=$?
  reset_wt
  echo "T17B $before $rc $([ "$after" = 0 ] && echo 1 || echo 0)"
}
t17c() { hrow T17C; }
t17d() {
  need T17D || return
  test_run
  local rc named=0
  perl -0pi -e 's/--bg: #F2F4EF;/--bg: #F2F4EE;/' "$WT/packages/tokens/src/tokens.css"
  ( cd "$WT" && git diff --quiet -- packages/tokens/src/tokens.css ) && { echo "T17D the mutation did not apply (Blocked)"; return; }
  pnenv -- --filter @toki/tokens test > "$BASE/t17d.log" 2>&1; rc=$?
  grep -qF 'pnpm --filter @toki/tokens generate' "$BASE/t17d.log" && named=1
  reset_wt
  echo "T17D $TEST_RC $([ "$rc" != 0 ] && echo 1 || echo 0) $named"
}
t18() { hrow T18; }; t19() { hrow T19; }; t19b() { hrow T19B; }; t19c() { hrow T19C; }; t19d() { hrow T19D; }
t20() {
  need T20 || return
  test_run
  echo "T20 $TEST_RC $(jq -r '"\(.numPassedTests) \(.numFailedTests)"' "$BASE/vt.json" 2> /dev/null || echo '? ?')"
}
TC_DONE=""; TC_RC=""
t20b() {
  need T20B || return
  pnenv -- typecheck > "$BASE/t20b.log" 2>&1; TC_RC=$?
  echo "T20B $TC_RC"
}
t20c() {
  need T20C || return
  local inc_s inc_x r1 n1 r2 n2 tj="$(doc packages/tokens/tsconfig.json)"
  inc_s=$(printf '%s' "$tj" | jq -r '.include | index("src") != null | if . then 1 else 0 end')
  inc_x=$(printf '%s' "$tj" | jq -r '.include | index("scripts") != null | if . then 1 else 0 end')
  printf '\nconst zzx: number = "a";\n' >> "$WT/packages/tokens/scripts/generate-css.ts"
  pnenv -- typecheck > "$BASE/t20c1.log" 2>&1; r1=$?; n1=0; grep -qF 'generate-css.ts' "$BASE/t20c1.log" && n1=1
  reset_wt
  printf '\nconst zzx: number = "a";\n' >> "$WT/packages/tokens/src/tokens.test.ts"
  pnenv -- typecheck > "$BASE/t20c2.log" 2>&1; r2=$?; n2=0; grep -qF 'tokens.test.ts' "$BASE/t20c2.log" && n2=1
  reset_wt
  echo "T20C $inc_s $inc_x $([ "$r1" != 0 ] && echo 1 || echo 0) $n1 $([ "$r2" != 0 ] && echo 1 || echo 0) $n2"
}

rows="${*:-T1 T2 T2B T3 T3B T4 T4B T5 T6 T6B T7 T7B T7C T7D T8 T8B T8C T8D T9 T9B T9C T9D T10 T11 T11B T11C T11D T12 T12B T12C T13 T13B T13C T14 T14B T14C T15 T15B T15C T15D T15E T16 T16B T16C T16D T17 T17B T17C T17D T18 T19 T19B T19C T19D T20 T20B T20C}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'A-Z' 'a-z')
  if declare -F "$fn" > /dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
cleanup; WT=""
alive=0
for p in $PIDS; do kill -0 "$p" 2> /dev/null && alive=$((alive + 1)); done
left=$(ps -axo command | awk -v b="$BASE" 'index($0, b) && !/awk/ { n++ } END { print n + 0 }')
echo "CLEAN worktrees $([ "$(git worktree list | grep -cF "$(basename "$BASE")")" = 0 ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $((left + alive)) temporary-folder $([ -e "$BASE" ] && echo left || echo removed)"
