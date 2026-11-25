#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-015.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile`. It writes nothing to GitHub and opens no pull request.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-015.checks.sh [T1A T2A ...]
# It reads files of the commit V with `git show`. Rows that run a tool use ONE temporary worktree of V,
# created on first use, with `pnpm install --frozen-lockfile` run there: the unit tests of `ui-web` and
# `apps/web`, the TypeScript compiler, ESLint, Prettier, the web build, and a Vite dev server of the
# worktree on a free loopback port with the cached Chromium driven by Playwright (the fixture page
# `shell-fixture.html` of the ticket) serve the browser rows. The probes, the type files and the driver
# exist only inside the temporary worktree and are deleted after use. The rows that run the ticket's own
# browser test (`e2e/app-shell.spec.ts`, `pnpm test:e2e`) need the ports 5173 and 3000 that the Playwright
# config fixes and are Blocked when one is taken; nothing on the machine is stopped. Rows that change a
# file of the worktree restore it afterwards and are paired with the unchanged run; rows that only read
# files are paired with a changed copy of the text held in memory. No `.env` file is read or created: the
# worktree has none. Every temporary file lives under one folder made in the current shell (BASE,
# exported as TMPDIR and given to every process it starts) which the cleanup removes. It prints one line
# for each row: counts, exit codes and words; no tool output and no secret. The last line
# `CLEAN worktrees same ...` says that no worktree made by the script is left (other worktrees of the
# repository may come and go while it runs), that `git status` is as it was, that no process it started
# is alive and that the temporary folder is removed. A row that cannot be shown prints `Blocked` and the
# reason. The manual rows print `Blocked` until the QA pastes a result.
# `V=<commit> bash docs/qa/TOKI-015.checks.sh serve` starts the fixture of the worktree for the manual rows
# and waits for the Enter key; it is not a row and prints no evidence.
# Paths: the spec names `packages/ui-web/src/shell`, `apps/web/src/shell/sections.ts` and
# `apps/web/src/shell-fixture`; the delivery moved them to `layout` and `scripts/shell-fixture`. A row
# that names such a path prints the files found at the spec's path and at the path found at V (spec 
# concern 5), and still compares the behavior at the path found.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
SPEC=docs/specs/2026-11-16-app-shell-design.md
UI=packages/ui-web
doc() { git show "$V:$1" 2>/dev/null; }

BASE=$(mktemp -d); export TMPDIR="$BASE"
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; PIDS=""; ALLPIDS=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; }
cleanup() {
  local p
  for p in $PIDS; do kill_tree "$p"; wait "$p" 2>/dev/null; done
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
restore() { ( cd "$WT" && git checkout -q -- "$1" ); }
# mutate <file> <perl substitution>: true when the file changed
mutate() { perl -0pi -e "$2" "$WT/$1"; ( cd "$WT" && ! git diff --quiet -- "$1" ); }
freeport() { python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'; }
portbusy() { python3 -c 'import socket,sys
s = socket.socket(); s.settimeout(1)
try:
    s.connect(("127.0.0.1", int(sys.argv[1]))); print("busy")
except OSError:
    print("free")' "$1"; }
first_error() { grep -m1 -iE 'error|cannot|failed' "$1" 2>/dev/null | cut -c1-120; }
b01() { [ "$1" -gt 0 ] 2>/dev/null && echo 1 || echo 0; }
# a path of the spec and the path found at V: "<files at the spec path> <files at the found path>"
pathcount() { echo "$(git ls-tree -r --name-only "$V" -- "$1" | grep -c . || true) $(git ls-tree -r --name-only "$V" -- "$2" | grep -c . || true)"; }
SHELLDIR="$UI/src/layout"   # where the shell code lives at V
[ -n "$(git ls-tree -r --name-only "$V" -- "$UI/src/shell" | head -1)" ] && SHELLDIR="$UI/src/shell"
SECTIONS="apps/web/src/layout/sections.ts"
[ -n "$(git ls-tree -r --name-only "$V" -- apps/web/src/shell/sections.ts | head -1)" ] && SECTIONS="apps/web/src/shell/sections.ts"
FIXDIR="apps/web/scripts/shell-fixture"
[ -n "$(git ls-tree -r --name-only "$V" -- apps/web/src/shell-fixture | head -1)" ] && FIXDIR="apps/web/src/shell-fixture"

# ---- the CSS reader: a small parser, so a row reads declarations and not text ---------------------
CSSJS="$BASE/css.mjs"
cat > "$CSSJS" <<'JS'
import fs from "node:fs";
const norm = (v) => v.replace(/\s+/g, "").replace(/(^|[^\d])\.(\d)/g, "$10.$2");
const nmedia = (m) => m.replace(/@media/, "").replace(/\s+/g, "").toLowerCase();
function split(text, sep) {
  const out = []; let depth = 0, q = "", cur = "";
  for (const ch of text) {
    if (q) { if (ch === q) q = ""; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === sep && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}
function decls(body) {
  const d = [];
  for (const s of split(body, ";")) { const i = s.indexOf(":"); if (i > 0) d.push([s.slice(0, i).trim(), norm(s.slice(i + 1))]); }
  return d;
}
// rules: { media, selector, decls: [[prop, value]] }; keyframes: { name, from }
function parse(text, ctx, kfs) {
  const rules = []; let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i); if (open < 0) break;
    const head = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < text.length && depth > 0) { if (text[j] === "{") depth++; else if (text[j] === "}") depth--; j++; }
    const body = text.slice(open + 1, j - 1);
    if (head.startsWith("@keyframes")) {
      const m = /from\s*\{([^}]*)\}/.exec(body);
      kfs.push({ name: head.replace("@keyframes", "").trim(), from: m ? decls(m[1]).map(([p, v]) => `${p}:${v}`).join(";") : "" });
    } else if (head.startsWith("@")) rules.push(...parse(body, nmedia(head), kfs));
    else for (const sel of split(head, ",")) rules.push({ media: ctx, selector: sel.replace(/\s+/g, " "), decls: decls(body) });
    i = j;
  }
  return rules;
}
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");
const read = (f, kfs = []) => parse(strip(fs.readFileSync(f, "utf8")), "", kfs);
const keys = (rules) => { const s = new Set(); for (const r of rules) for (const [p, v] of r.decls) s.add(`${r.media}§${r.selector}§${p}:${v}`); return s; };

// ---- the tables of the spec -------------------------------------------------------------------
function specRules(specFile, letters) {
  const lines = fs.readFileSync(specFile, "utf8").split("\n");
  const rules = [], kfs = [];
  const base = { C: "", D: "(min-width:720px)", E: "(min-width:720px)", F: "(min-width:720px)", G: "(max-width:719px)", H: "", I: "" };
  for (let i = 0; i < lines.length; i++) {
    const t = /^Table ([C-J])\./.exec(lines[i]);
    if (!t || !letters.includes(t[1])) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith("|")) j++;
    const rows = [];
    while (j < lines.length && lines[j].startsWith("|")) { rows.push(lines[j]); j++; }
    for (const row of rows.slice(2)) {
      const cells = row.split("|").slice(1, -1).map((c) => c.trim());
      const sm = /^`([^`]+)`(.*)$/.exec(cells[0]);
      if (!sm) continue;
      let media = base[t[1]];
      const note = sm[2];
      const mm = /`@media ([^`]+)`/.exec(note);
      if (mm) media = nmedia(mm[1]);
      if (/overlay block/.test(note)) media = "(min-width:720px)and(max-width:1099px)";
      if (/956 to 1099 block/.test(note)) media = "(min-width:956px)and(max-width:1099px)";
      const dm = /^`([^`]+)`/.exec(cells[1]);
      if (!dm) continue;
      if (/@keyframes/.test(cells[1])) {
        const nm = /`@keyframes ([^`]+)`/.exec(cells[1]);
        const fm = /from `([^`]+)`/.exec(cells[1]);
        kfs.push({ name: nm[1], from: decls(fm[1]).map(([p, v]) => `${p}:${v}`).join(";") });
      }
      for (const sel of split(sm[1], ",")) rules.push({ media, selector: sel.replace(/\s+/g, " "), decls: decls(dm[1]) });
    }
  }
  return { rules, kfs };
}
const [mode, ...args] = process.argv.slice(2);
if (mode === "tables") {
  // tables <spec> <letters> <css file>: "<declarations in the tables> <matched> <missing> <extra> <keyframes in the tables> <keyframes matched>"
  const [spec, letters, file] = args;
  const want = specRules(spec, letters);
  const kfs = [];
  const have = keys(read(file, kfs));
  const w = keys(want.rules);
  let matched = 0, missing = 0, extra = 0;
  for (const k of w) { if (have.has(k)) matched++; else missing++; }
  for (const k of have) if (!w.has(k)) extra++;
  const kmatch = want.kfs.filter((k) => kfs.some((h) => h.name === k.name && h.from === k.from)).length;
  console.log(`${w.size} ${matched} ${missing} ${extra} ${want.kfs.length} ${kmatch}`);
} else if (mode === "medias") {
  // medias <css>: the distinct media conditions, one per line, then containers and !important
  const text = strip(fs.readFileSync(args[0], "utf8"));
  const set = new Set([...text.matchAll(/@media\s+([^{]+)\{/g)].map((m) => nmedia(m[1])));
  console.log([...set].sort().join("\n"));
  console.log(`containers ${(text.match(/@container/g) || []).length}`);
  console.log(`important ${(text.match(/!\s*important/g) || []).length}`);
} else if (mode === "names") {
  // names <allowed file> <css>: "<declarations> <colour literals> <unknown var names> <unknown custom properties>"
  const allowed = new Set(fs.readFileSync(args[0], "utf8").split(/\s+/).filter(Boolean));
  for (const a of ["--tabh", "--shell-panel", "--shell-convs-min"]) allowed.add(a);
  let n = 0, lit = 0, bad = 0, def = 0;
  for (const r of read(args[1])) for (const [p, v] of r.decls) {
    n++;
    if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(\d/.test(v)) lit++;
    if (p.startsWith("--") && !allowed.has(p)) def++;
    for (const m of v.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) if (!allowed.has(m[1])) bad++;
  }
  console.log(`${n} ${lit} ${bad} ${def}`);
} else if (mode === "looks") {
  // looks <css>: "<rules naming data-look, data-accent or data-density> <rules naming data-eff with a value other than calm or focus>"
  const all = read(args[0]);
  const hit = all.filter((r) => /data-(look|accent|density)/.test(r.selector)).length;
  const odd = all.filter((r) => [...r.selector.matchAll(/data-eff="?([a-z]*)"?/g)].some((m) => !["calm", "focus"].includes(m[1]))).length;
  console.log(`${hit} ${odd}`);
} else if (mode === "hover") {
  // hover <css>: ":hover rules, the ones that hide, the ones that change a property other than background, color, border-color"
  const all = read(args[0]).filter((r) => /:hover/.test(r.selector));
  let hide = 0, other = 0;
  for (const r of all) {
    for (const [p, v] of r.decls) {
      if ((p === "opacity" && /^0(\.0+)?$/.test(v)) || (p === "visibility" && v === "hidden") || (p === "display" && v === "none")) hide++;
      if (!["background", "color", "border-color"].includes(p)) other++;
    }
  }
  console.log(`${all.length} ${hide} ${other}`);
} else if (mode === "tabh") {
  // tabh <css>: "<definitions> <definitions on .app under 720> <reads> <reads whose selector begins with .app>"
  const all = read(args[0]);
  let defs = 0, defOk = 0, reads = 0, readOk = 0;
  for (const r of all) for (const [p, v] of r.decls) {
    if (p === "--tabh") { defs++; if (r.selector === ".app" && r.media === "(max-width:719px)") defOk++; }
    if (/var\(--tabh/.test(v)) { reads++; if (/^(\.app|\.sidebar|\.nav|\.convs|\.main|\.side|\.toast-anchor)(?![A-Za-z0-9_-])/.test(r.selector)) readOk++; }
  }
  console.log(`${defs} ${defOk} ${reads} ${readOk}`);
} else if (mode === "fonts") {
  // fonts <spec> <css>: "<font-family declarations in the css> <the ones that are in Table C to G>"
  const [spec, file] = args;
  const isF = (k) => /§font-family:/.test(k);
  const want = new Set([...keys(specRules(spec, "CDEFG").rules)].filter(isF));
  const have = [...keys(read(file))].filter(isF);
  console.log(`${have.length} ${have.filter((k) => want.has(k)).length}`);
} else if (mode === "decl") {
  // decl <css> <selector> <media or -> <prop>: the value, or "none"
  const [file, sel, media, prop] = args;
  const out = [];
  for (const r of read(file)) if (r.selector === sel && r.media === (media === "-" ? "" : media)) for (const [p, v] of r.decls) if (p === prop) out.push(v);
  console.log(out.length ? out[out.length - 1] : "none");
}
JS
# cssrun <mode> <file at V> <perl substitution applied in memory first or -> <args...>
cssfile() { local f="$BASE/c.$$.$RANDOM.css"; if [ -n "${2:-}" ] && [ "$2" != - ]; then doc "$1" | perl -0pe "$2" > "$f"; else doc "$1" > "$f"; fi; echo "$f"; }
SPECFILE="$BASE/spec.md"; doc "$SPEC" > "$SPECFILE"

# ---- the sources of the probes, the type files and the driver (written into the temporary folder) ----
PROBE_UI="$BASE/probe-ui.tsx"
cat > "$PROBE_UI" <<'UITSX'
import { act, cleanup, fireEvent, render, renderHook, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { writeFileSync } from "node:fs";
import { createRef, useRef, type ReactElement, type ReactNode } from "react";
import { test, vi } from "vitest";
import * as ui from "../src/index";
import type { NavSection } from "../src/index";
import { applyAppearance as applyDirect } from "../src/appearance";

const { AppShell, BottomTabs, WorkspaceHeader, SearchBox, UserCard, SidePanel, SectionPage, TabList, Tab, derivePane, useNarrow, useToastAvoid, MenuIcon } = ui;
const out: Record<string, number[]> = {};
const n = (x: boolean) => (x ? 1 : 0);
const sum = (xs: boolean[]) => xs.filter(Boolean).length;
const mount = (el: ReactElement): HTMLElement => render(el).container;
const step = async (key: string, fn: () => number[] | Promise<number[]>) => {
  try {
    out[key] = await fn();
  } catch {
    out[key] = [-1];
  }
};
const cast = (o: Record<string, unknown>) => o as unknown as object;
const seq = (el: Element | null) => (el ? [...el.children].map((c) => `${c.tagName.toLowerCase()}.${(c.getAttribute("class") ?? "").split(" ")[0]}`).join(" ") : "-");

const S: NavSection[] = [
  { id: "home", icon: "home", label: "Home", href: "#home", badge: 3, badgeLabel: "3 unread", tab: true },
  { id: "activity", icon: "bell", label: "Activity", href: "#activity", badge: 12, tab: true },
  { id: "later", icon: "bookmark", label: "Later", href: "#later", tab: true },
  { id: "files", icon: "folder", label: "Files", href: "#files", tab: true },
  { id: "prefs", icon: "settings", label: "Prefs", href: "#prefs", calmHidden: true, more: true },
];
const labels = { mainNavigation: "Main", conversations: "Convs" };
const account = { label: "Account", name: "Ann Lee", hue: 10 };
const noop = () => {};
const shell = (p: Record<string, unknown> = {}) => {
  const { children, ...rest } = p;
  return (
    <AppShell sections={S} currentSection="home" labels={labels} account={account} {...(rest as object)}>
      {(children as ReactNode) ?? <i data-k="content">content</i>}
    </AppShell>
  );
};
const root = (c: HTMLElement) => c.querySelector(".app") as HTMLElement;
const R = (x: ReactElement, sel = ".app") => mount(x).querySelector(sel) as HTMLElement;

function stubMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const state = { matches };
  const mm = vi.fn((q: string) => ({
    get matches() { return state.matches; },
    media: q,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }));
  (window as unknown as { matchMedia: unknown }).matchMedia = mm;
  return { state, listeners, fire: () => act(() => [...listeners].forEach((l) => l())) };
}
const noMedia = () => { delete (window as unknown as { matchMedia?: unknown }).matchMedia; };

test("probe", async () => {
  // ---- R1
  const names = ["AppShell", "BottomTabs", "WorkspaceHeader", "SearchBox", "UserCard", "SidePanel", "SectionPage", "TabList", "Tab", "derivePane", "useNarrow", "applyAppearance"];
  await step("T1A", () => {
    const have = names.filter((k) => typeof (ui as Record<string, unknown>)[k] === "function" || typeof (ui as Record<string, unknown>)[k] === "object").length;
    return [have, names.length];
  });
  // ---- R2: every component with empty text props draws no text
  await step("T2B", () => {
    const empty = [
      mount(<AppShell sections={[{ id: "a", icon: "home", label: "", href: "#a", tab: true }]} currentSection="a" labels={{ mainNavigation: "", conversations: "" }}
        workspace={{ name: "", detail: "" }} search={{ label: "", hint: "", onOpen: noop }} account={{ label: "", name: "", hue: 0, detail: "" }}
        list={<div />} panel={<SidePanel title="" labels={{ back: "", close: "" }} onClose={noop} />} panelLabel="" moreTab={{ label: "", open: false, onOpen: noop }} />),
      mount(<BottomTabs sections={[{ id: "a", icon: "home", label: "", href: "#a", tab: true }]} moreTab={{ label: "", open: false, onOpen: noop }} />),
      mount(<WorkspaceHeader workspace={{ name: "", detail: "" }} />),
      mount(<SearchBox search={{ label: "", hint: "", onOpen: noop }} />),
      mount(<UserCard account={{ label: "", name: "", hue: 0, detail: "" }} />),
      mount(<SidePanel title="" labels={{ back: "", close: "" }} onClose={noop} />),
      mount(<SectionPage title="" />),
      mount(<TabList aria-label=""><Tab id="t" selected onSelect={noop} /></TabList>),
    ].map((c) => (c.textContent ?? "").replace(/\s/g, "") === "");
    const control = mount(<SearchBox search={{ label: "x", onOpen: noop }} />).textContent !== "";
    return [sum(empty), empty.length, n(control)];
  });
  // ---- R3
  await step("T3A", () => {
    const cases: Array<[Record<string, unknown>, string, string, number]> = [
      [{}, "div.sidebar main.main div.toast-anchor", "nav.nav div.usercard", 0],
      [{ list: <i /> }, "div.sidebar main.main div.toast-anchor", "nav.nav aside.convs div.usercard", 1],
      [{ panel: <i />, panelLabel: "Details" }, "div.sidebar main.main aside.side div.toast-anchor", "nav.nav div.usercard", 1],
      [{ list: <i />, panel: <i />, panelLabel: "Details" }, "div.sidebar main.main aside.side div.toast-anchor", "nav.nav aside.convs div.usercard", 2],
    ];
    const ok: boolean[] = [];
    for (const [p, r, s, comp] of cases) {
      const c = mount(shell(p));
      ok.push(seq(root(c)) === r, seq(c.querySelector(".sidebar")) === s);
      const q = within(c);
      ok.push(q.queryAllByRole("navigation").length === 1 && q.queryAllByRole("main").length === 1 && q.queryAllByRole("complementary").length === comp);
    }
    return [sum(ok), ok.length];
  });
  await step("T3B", () => {
    const a = mount(shell({ list: <i />, panel: <i />, panelLabel: "Details" }));
    const b = mount(shell());
    const r = root(a);
    return [
      n(a.querySelector(".sidebar")!.getAttribute("data-has-list") === ""),
      n(!b.querySelector(".sidebar")!.hasAttribute("data-has-list")),
      n(a.querySelector("nav")!.getAttribute("aria-label") === "Main"),
      n(a.querySelector(".convs")!.getAttribute("aria-label") === "Convs"),
      n(a.querySelector(".side")!.getAttribute("aria-label") === "Details"),
      n(r.tagName === "DIV" && r.className === "app" && r.getAttribute("data-testid") === "shell"),
      n(a.querySelector("main")!.textContent === "content"),
    ];
  });
  // ---- R4
  await step("T4A", () => {
    let ok = 0, total = 0;
    for (const section of ["home", "files"]) for (const chatOpen of [false, true]) for (const panelOpen of [false, true]) for (const hasList of [false, true]) {
      total++;
      const want = panelOpen ? "side" : section === "home" && !chatOpen && hasList ? "list" : "main";
      if (derivePane({ section, chatOpen, panelOpen, hasList }) === want) ok++;
    }
    return [ok, total];
  });
  await step("T4B", () => {
    const a = root(mount(shell({ list: <i />, chatOpen: true, panel: <i />, panelLabel: "p", currentSection: "files" })));
    const b = root(mount(shell({ list: <i /> })));
    return [
      n(a.getAttribute("data-section") === "files"), n(a.getAttribute("data-pane") === "side"),
      n(a.getAttribute("data-chat-open") === ""), n(a.getAttribute("data-panel") === ""),
      n(b.getAttribute("data-section") === "home" && b.getAttribute("data-pane") === "list" && !b.hasAttribute("data-chat-open") && !b.hasAttribute("data-panel")),
    ];
  });
  // ---- R5
  await step("T5A", () => {
    const c = mount(shell());
    const items = [...c.querySelectorAll<HTMLElement>(".nav-items a.ni")];
    const cur = items.filter((a) => a.getAttribute("aria-current") === "page");
    const hid = items.filter((a) => a.hasAttribute("data-calm-hidden"));
    return [
      items.length, n(items.map((a) => a.getAttribute("data-id")).join() === S.map((s) => s.id).join()),
      n(items.every((a, i) => a.querySelector("svg") !== null && a.querySelector("span.lb")?.textContent === S[i]!.label)),
      cur.length, n(cur[0]?.getAttribute("data-id") === "home"), hid.length, n(hid[0]?.getAttribute("data-id") === "prefs"),
    ];
  });
  await step("T5D", () => {
    const c = mount(shell());
    const items = [...c.querySelectorAll<HTMLElement>(".nav-items a.ni")];
    const home = items[0]!.querySelector(".cnt"), act2 = items[1]!.querySelector(".cnt");
    return [n(home?.classList.contains("mute") === true), n(act2 !== null && !act2.classList.contains("mute")), n(home?.querySelector(".sr")?.textContent === "3 unread"), n(act2?.querySelector(".sr") === null && act2.textContent === "12"), items.filter((a) => a.querySelector(".cnt")).length];
  });
  await step("T5B", async () => {
    const calls = vi.fn();
    const withNav = mount(shell({ onNavigate: calls }));
    const a = withNav.querySelector<HTMLElement>('.nav-items a[data-id="activity"]')!;
    const ok: boolean[] = [];
    ok.push(fireEvent.click(a, { button: 0 }) === false && calls.mock.calls.length === 1);
    for (const m of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) { calls.mockClear(); ok.push(fireEvent.click(a, { button: 0, [m]: true }) === true && calls.mock.calls.length === 0); }
    calls.mockClear(); ok.push(fireEvent.click(a, { button: 1 }) === true && calls.mock.calls.length === 0);
    const without = mount(shell());
    ok.push(fireEvent.click(without.querySelector('.nav-items a[data-id="activity"]')!, { button: 0 }) === true);
    return [sum(ok), ok.length];
  });
  await step("T5C", async () => {
    const calls = vi.fn();
    const c = mount(shell({ onNavigate: calls }));
    const a = c.querySelector<HTMLElement>('.nav-items a[data-id="later"]')!;
    const user = userEvent.setup();
    a.focus();
    await user.keyboard("{Enter}");
    return [calls.mock.calls.length, n((calls.mock.calls[0]?.[0] as NavSection | undefined)?.id === "later")];
  });
  // ---- R6
  await step("T6A", () => {
    const c = mount(<BottomTabs sections={S} currentSection="home" moreTab={{ label: "More", open: false, onOpen: noop }} />);
    const links = [...c.querySelectorAll<HTMLElement>(".nav-tabs a.nt")];
    const btn = c.querySelectorAll(".nav-tabs button.nt");
    const more = btn[0];
    const bar = c.querySelector(".nav-tabs")!;
    const mi = mount(<MenuIcon />).innerHTML;
    cleanup();
    const c2 = mount(<BottomTabs sections={S} currentSection="home" moreTab={{ label: "More", open: false, onOpen: noop }} />);
    return [
      links.length, n(links.map((a) => a.getAttribute("data-id")).join() === "home,activity,later,files"),
      n(links.every((a, i) => a.querySelector("svg") !== null && a.querySelector("span")?.textContent === S[i]!.label)),
      btn.length, n(bar.lastElementChild === more), n(more?.querySelector("span")?.textContent === "More"), n(more?.querySelector("svg")?.outerHTML === c2.querySelector("button.nt svg")?.outerHTML && mi.length > 0),
      mount(<BottomTabs sections={S} currentSection="home" />).querySelectorAll("button.nt").length,
    ];
  });
  await step("T6B", async () => {
    const onOpen = vi.fn(); const ref = createRef<HTMLButtonElement>();
    const c = mount(<BottomTabs sections={S} currentSection="files" moreTab={{ label: "More", open: true, onOpen, ref }} />);
    const b = c.querySelector<HTMLElement>("button.nt")!;
    const closed = mount(<BottomTabs sections={S} currentSection="files" moreTab={{ label: "More", open: false, onOpen: noop }} />).querySelector("button.nt")!;
    const cur = mount(<BottomTabs sections={S} currentSection="prefs" moreTab={{ label: "More", open: false, onOpen: noop }} />).querySelector("button.nt")!;
    const c3 = mount(<BottomTabs sections={S} currentSection="files" moreTab={{ label: "More", open: true, onOpen, ref }} />);
    const b3 = c3.querySelector<HTMLElement>("button.nt")!;
    fireEvent.click(b3);
    const user = userEvent.setup();
    b3.focus(); await user.keyboard(" ");
    return [
      n(b.getAttribute("aria-haspopup") === "dialog"), n(b.getAttribute("aria-expanded") === "true"), n(closed.getAttribute("aria-expanded") === "false"),
      n(cur.getAttribute("aria-current") === "page"), n(!closed.hasAttribute("aria-current")), onOpen.mock.calls.length, n(ref.current === b3),
    ];
  });
  await step("T6C", () => {
    const s: NavSection[] = S.map((x) => ({ ...x, badge: undefined }));
    const c = mount(<BottomTabs sections={s} currentSection="home" moreTab={{ label: "More", open: false, onOpen: noop }} />);
    const withBadges = mount(<BottomTabs sections={S} currentSection="home" moreTab={{ label: "More", open: false, onOpen: noop }} />);
    return [c.querySelectorAll(".cnt").length, withBadges.querySelectorAll("button.nt .cnt").length, withBadges.querySelectorAll('a.nt[data-id="files"] .cnt').length, withBadges.querySelectorAll("a.nt .cnt").length];
  });
  // ---- R7
  await step("T7A", () => {
    let hidden = 0, cases = 0;
    for (const badge of [0, -1, Number.NaN, undefined]) {
      cases++;
      const sec: NavSection[] = [{ id: "home", icon: "home", label: "H", href: "#h", badge: badge as number, tab: true }];
      const c = mount(<AppShell sections={sec} currentSection="home" labels={labels}>x</AppShell>);
      if (c.querySelectorAll(".cnt").length === 0) hidden++;
    }
    const shown = [1, 100].map((b) => {
      const sec: NavSection[] = [{ id: "files", icon: "folder", label: "F", href: "#f", badge: b, tab: true }];
      const c = mount(<AppShell sections={sec} currentSection="home" labels={labels}>x</AppShell>);
      return [...c.querySelectorAll(".cnt")].length === 2 && [...c.querySelectorAll(".cnt")].every((e) => e.textContent === String(b));
    });
    return [hidden, cases, sum(shown), shown.length];
  });
  // ---- R8
  await step("T8A", () => {
    const first = (name: string) => R(<WorkspaceHeader workspace={{ name }} />, ".ws").querySelector(".wsl")?.textContent;
    const c = R(<WorkspaceHeader workspace={{ name: "harbour", detail: "8 people" }} />, ".ws");
    const nd = R(<WorkspaceHeader workspace={{ name: "harbour" }} />, ".ws");
    return [
      n(c.tagName === "DIV" && seq(c) === "span.wsl div.wst" && seq(c.querySelector(".wst")) === "div.wsn div.wss"),
      n(c.querySelector(".wsn")?.textContent === "harbour" && c.querySelector(".wss")?.textContent === "8 people" && c.querySelector(".wsl")?.textContent === "H"),
      n(nd.querySelector(".wss") === null && nd.querySelector(".wsn") !== null),
      n(first("élan") === "É" && first("\u{1F600} joy") === "\u{1F600}" && first("ǆa") === "Ǆ"),
      n(mount(<WorkspaceHeader />).childElementCount === 0),
    ];
  });
  await step("T8B", () => {
    const onOpen = vi.fn();
    const b = R(<SearchBox search={{ label: "Search", hint: "Ctrl K", onOpen }} />, "button");
    fireEvent.click(b);
    const nh = R(<SearchBox search={{ label: "Search", onOpen }} />, "button");
    return [
      n(b.classList.contains("srch") && b.getAttribute("aria-label") === "Search" && b.getAttribute("type") === "button"),
      n(seq(b).endsWith("span.t span.kbd")),
      n(b.querySelector(".t")?.textContent === "Search" && b.querySelector(".kbd")?.textContent === "Ctrl K"),
      onOpen.mock.calls.length, n(nh.querySelector(".kbd") === null), n(mount(<SearchBox />).childElementCount === 0),
    ];
  });
  await step("T8C", () => {
    const c = mount(<UserCard account={{ label: "Account", name: "Ann Lee", hue: 10, presence: "active", presenceLabel: "Active", detail: "Online" }} />);
    const card = c.querySelector(".ucard")!;
    const bare = mount(<UserCard account={{ label: "Account", name: "Ann Lee", hue: 10 }} />);
    const av = c.querySelector<HTMLElement>(".av")!;
    return [
      n(c.firstElementChild!.className === "usercard" && card.tagName === "DIV" && card.getAttribute("role") === null && card.getAttribute("tabindex") === null),
      n(av.style.getPropertyValue("--s") === "36px"), n(c.querySelector(".pdw .pd") !== null),
      n(c.querySelector(".uct .un")?.textContent === "Ann Lee" && c.querySelector(".uct .us")?.textContent === "Online"),
      n(bare.querySelector(".us") === null), n(mount(<UserCard />).childElementCount === 0),
    ];
  });
  await step("T8D", async () => {
    const ref = createRef<HTMLButtonElement>(); const onClick = vi.fn(); const onKeyDown = vi.fn();
    const c = mount(<UserCard account={{ label: "Account", name: "Ann Lee", hue: 10, triggerProps: { ref, "aria-haspopup": "menu", "aria-expanded": false, onClick, onKeyDown } }} />);
    const b = c.querySelector<HTMLElement>("button.ucard")!;
    const user = userEvent.setup();
    await user.click(b);
    b.focus(); await user.keyboard("{ArrowDown}");
    const owned = mount(<UserCard account={{ label: "Account", name: "A", hue: 1, triggerProps: cast({ "aria-label": "x", type: "submit", className: "zz" }) }} />).querySelector("button.ucard")!;
    return [
      n(b.getAttribute("aria-haspopup") === "menu" && b.getAttribute("aria-expanded") === "false"), n(ref.current === b), onClick.mock.calls.length, onKeyDown.mock.calls.length,
      n(b.getAttribute("aria-label") === "Account" && b.getAttribute("type") === "button"), n(owned.getAttribute("aria-label") === "Account" && owned.getAttribute("type") === "button" && owned.className === "ucard"),
    ];
  });
  // ---- R9
  await step("T9A", async () => {
    document.querySelectorAll('[role="dialog"], dialog').forEach((e) => e.remove());
    const onOpen = vi.fn();
    const c = mount(shell({ moreTab: { label: "More", open: false, onOpen } }));
    const before = document.querySelectorAll('[role="dialog"], dialog').length;
    await userEvent.setup().click(c.querySelector("button.nt")!);
    return [before, document.querySelectorAll('[role="dialog"], dialog').length, onOpen.mock.calls.length];
  });
  // ---- R11
  await step("T11A", () => {
    const onClose = vi.fn();
    const c = mount(<SidePanel title="Details" subtitle="8 people" labels={{ back: "Back", close: "Close" }} onClose={onClose}><i data-k="x" /></SidePanel>);
    const sh = c.querySelector(".sh")!;
    const back = sh.querySelector<HTMLElement>("button.ib.back-side"), close = sh.querySelector<HTMLElement>("button.ib.sm.closex");
    if (back) fireEvent.click(back);
    if (close) fireEvent.click(close);
    const ns = mount(<SidePanel title="Details" labels={{ back: "Back", close: "Close" }} onClose={onClose} />);
    return [
      n(seq(sh) === "button.ib h2.ell button.ib"), n(back?.getAttribute("aria-label") === "Back" && close?.getAttribute("aria-label") === "Close"),
      n(sh.querySelector("h2.ell")?.firstChild?.textContent === "Details" && sh.querySelector("h2 span.muted")?.textContent === "8 people"),
      n(c.querySelector(".sb > i[data-k]") !== null), onClose.mock.calls.length, n(ns.querySelector("h2 span.muted") === null),
    ];
  });
  await step("T11B", () => {
    const onClose = vi.fn();
    mount(<SidePanel title="D" labels={{ back: "b", close: "c" }} onClose={onClose} />);
    const key = (init: KeyboardEventInit, target: EventTarget = document.body) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
    key({ key: "Escape" });
    const a = onClose.mock.calls.length;
    key({ key: "Enter" }); key({ key: "Escape", isComposing: true });
    const popup = document.createElement("div"); document.body.appendChild(popup);
    popup.addEventListener("keydown", (e) => e.stopPropagation());
    key({ key: "Escape" }, popup);
    const prevented = document.createElement("div"); document.body.appendChild(prevented);
    prevented.addEventListener("keydown", (e) => e.preventDefault());
    key({ key: "Escape" }, prevented);
    const b = onClose.mock.calls.length;
    key({ key: "Escape" });
    const c2 = onClose.mock.calls.length;
    cleanup(); key({ key: "Escape" });
    popup.remove(); prevented.remove();
    return [a, b - a, c2 - b, onClose.mock.calls.length - c2];
  });
  // ---- R12
  await step("T12A", () => {
    const c = mount(<div id="h"><SectionPage title="Activity" actions={<button id="act">Mark</button>}><i data-k="b" /></SectionPage></div>);
    const h = c.querySelector("#h")!;
    const sh = h.querySelector(".sechead")!;
    const plain = mount(<div id="h"><SectionPage title="T" /></div>).querySelector("#h")!;
    return [
      n(seq(h) === "div.sechead div.secbody"), n(sh.firstElementChild?.tagName === "H1" && sh.firstElementChild.className === "title" && sh.firstElementChild.textContent === "Activity"),
      n(sh.lastElementChild?.id === "act"), n(h.querySelector(".secbody > i[data-k]") !== null), n(plain.querySelector(".sechead")!.childElementCount === 1),
      n(mount(<SectionPage title="" />).textContent === ""),
    ];
  });
  // ---- R13, R14
  const tabs = (sel: string, onSelect: (id: string) => void, panel = true) => (
    <TabList aria-label="Views">
      {["a", "b", "c"].map((id) => <Tab key={id} id={`t-${id}`} selected={sel === id} panelId={panel ? `p-${id}` : undefined} onSelect={() => onSelect(id)}>{id}</Tab>)}
    </TabList>
  );
  await step("T13A", () => {
    const onSelect = vi.fn();
    const c = mount(tabs("b", onSelect));
    const list = c.querySelector(".tabs")!;
    const ts = [...c.querySelectorAll<HTMLElement>("button.tab")];
    fireEvent.click(ts[2]!);
    const np = mount(tabs("a", noop, false));
    return [
      n(list.tagName === "DIV" && list.getAttribute("role") === "tablist" && list.getAttribute("aria-label") === "Views"),
      n(ts.every((t) => t.getAttribute("role") === "tab" && t.getAttribute("type") === "button")), n(ts.map((t) => t.getAttribute("aria-selected")).join() === "false,true,false"),
      n(ts.map((t) => t.id).join() === "t-a,t-b,t-c"), n(ts.map((t) => t.getAttribute("aria-controls")).join() === "p-a,p-b,p-c"), n(np.querySelector("button.tab")!.hasAttribute("aria-controls") === false),
      n(ts.map((t) => t.tabIndex).join() === "-1,0,-1"), onSelect.mock.calls.length, n(onSelect.mock.calls[0]?.[0] === "c"),
    ];
  });
  await step("T14A", async () => {
    const onSelect = vi.fn();
    const c = mount(tabs("a", onSelect));
    const ts = [...c.querySelectorAll<HTMLElement>("button.tab")];
    const user = userEvent.setup();
    const at = () => ts.findIndex((t) => t === document.activeElement);
    const ok: boolean[] = [];
    ts[0]!.focus();
    await user.keyboard("{ArrowRight}"); ok.push(at() === 1);
    await user.keyboard("{ArrowRight}"); ok.push(at() === 2);
    await user.keyboard("{ArrowRight}"); ok.push(at() === 0);
    await user.keyboard("{ArrowLeft}"); ok.push(at() === 2);
    await user.keyboard("{Home}"); ok.push(at() === 0);
    await user.keyboard("{End}"); ok.push(at() === 2);
    ok.push(onSelect.mock.calls.length === 0);
    await user.keyboard("x"); await user.keyboard("{ArrowUp}"); ok.push(at() === 2 && onSelect.mock.calls.length === 0);
    await user.keyboard("{Enter}"); ok.push(onSelect.mock.calls.length === 1 && onSelect.mock.calls[0]![0] === "c");
    await user.keyboard(" "); ok.push(onSelect.mock.calls.length === 2);
    return [sum(ok), ok.length];
  });
  await step("T14B", async () => {
    const orig = Element.prototype.scrollIntoView;
    const spy = vi.fn();
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = spy;
    const c = mount(tabs("a", noop));
    const before = spy.mock.calls.length;
    const first = c.querySelector<HTMLElement>("button.tab")!;
    first.focus();
    await userEvent.setup().keyboard("{ArrowRight}");
    const moved = spy.mock.calls.length - before;
    const arg = JSON.stringify(spy.mock.calls[spy.mock.calls.length - 1]?.[0]);
    const r = render(tabs("a", noop)); const k = spy.mock.calls.length;
    r.rerender(tabs("c", noop));
    const sel = spy.mock.calls.length - k;
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = orig;
    return [moved, n(arg === JSON.stringify({ inline: "nearest", block: "nearest" })), sel];
  });
  // ---- R25
  await step("T25A", () => {
    const comp = { ref: null as null | HTMLElement };
    const innerHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    const spyRect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const k = this.dataset.box ?? this.className.split(" ")[0];
      if (k === "composer") return new DOMRect(0, 738, 400, 62);
      if (k === "toast-anchor") return new DOMRect(0, 0, 400, 800);
      return new DOMRect(0, 0, 0, 0);
    });
    function Composer() { const r = useRef<HTMLDivElement>(null); useToastAvoid(r); return <div ref={r} data-box="composer" />; }
    const region = (c: HTMLElement) => c.querySelector<HTMLElement>(".toasts")!;
    const without = region(mount(shell())).style.bottom;
    const withC = region(mount(shell({ children: <Composer /> }))).style.bottom;
    comp.ref = null;
    spyRect.mockRestore();
    if (innerHeight) Object.defineProperty(window, "innerHeight", innerHeight);
    return [n(without === "20px"), n(withC === "76px")];
  });
  // ---- R28
  await step("T28A", () => {
    const html = document.documentElement;
    stubMedia(false);
    applyDirect({ look: "calm" }); const a = html.getAttribute("data-eff");
    applyDirect({ look: "focus" }); const b = html.getAttribute("data-eff");
    applyDirect({ look: "calm" })();
    return [n(a === "calm"), n(b === "focus")];
  });
  await step("T28B", () => {
    const html = document.documentElement;
    const m = stubMedia(true);
    const stop = applyDirect({ look: "device" }); const dark = html.getAttribute("data-eff");
    m.state.matches = false; m.fire(); const light = html.getAttribute("data-eff");
    m.state.matches = true; m.fire(); const dark2 = html.getAttribute("data-eff");
    const listenersOn = m.listeners.size;
    stop(); m.state.matches = false; m.fire(); const afterStop = html.getAttribute("data-eff");
    const m2 = stubMedia(false);
    applyDirect({ look: "device" }); applyDirect({ look: "focus" });
    const replaced = m2.listeners.size;
    noMedia(); applyDirect({ look: "device" }); const none = html.getAttribute("data-eff");
    return [n(dark === "focus"), n(light === "calm"), n(dark2 === "focus"), listenersOn, n(afterStop === "focus"), replaced, n(none === "calm")];
  });
  await step("T28C", () => {
    const html = document.documentElement;
    stubMedia(false);
    const accents = ["teal", "indigo", "clay", "violet"].filter((a) => { applyDirect({ look: "calm", accent: a as "teal" }); return html.getAttribute("data-accent") === a; }).length;
    applyDirect({ look: "calm" }); const def = html.getAttribute("data-accent");
    applyDirect({ look: "calm", accent: "pink" as "teal" }); const unk = html.getAttribute("data-accent");
    const dens = ["comfortable", "compact"].filter((d) => { applyDirect({ look: "calm", density: d as "compact" }); return html.getAttribute("data-density") === d; }).length;
    applyDirect({ look: "calm", density: "compact" }); applyDirect({ look: "calm" }); const gone = html.hasAttribute("data-density");
    applyDirect({ look: "calm", density: "tight" as "compact" }); const unkD = html.hasAttribute("data-density");
    return [accents, n(def === "teal"), n(unk === "teal"), dens, n(!gone), n(!unkD)];
  });
  // ---- R29
  await step("T29A", () => {
    const m = stubMedia(true);
    const h = renderHook(() => useNarrow());
    const first = h.result.current;
    m.state.matches = false; m.fire();
    const second = h.result.current;
    m.state.matches = true; m.fire();
    const third = h.result.current;
    const queried = (window.matchMedia as unknown as { mock: { calls: string[][] } }).mock.calls.some((c) => c[0] === "(max-width: 719px)");
    h.unmount(); noMedia();
    const none = renderHook(() => useNarrow()).result.current;
    return [n(first === true), n(second === false), n(third === true), n(queried), n(none === false)];
  });
  await step("T29D", () => {
    const row = <button id="row">row</button>;
    cleanup(); stubMedia(true);
    const a = render(shell({ list: row }));
    const first = document.activeElement === document.body;
    a.rerender(shell({ list: row, chatOpen: true }));
    const toMain = document.activeElement === a.container.querySelector("main");
    cleanup(); stubMedia(true);
    const b = render(shell({ list: row, chatOpen: true, children: <button id="mb">mb</button> }));
    (b.container.querySelector("#mb") as HTMLElement).focus();
    b.rerender(shell({ list: row, chatOpen: true, children: <button id="mb">mb</button>, panel: <i />, panelLabel: "p" }));
    const toSide = document.activeElement === b.container.querySelector("aside.side");
    cleanup(); stubMedia(true);
    const c = render(shell({ list: row }));
    c.rerender(shell({ list: row, panel: <button id="in" autoFocus>in</button>, panelLabel: "p" }));
    const kept = document.activeElement === c.container.querySelector("#in");
    cleanup(); stubMedia(false);
    const d = render(shell({ list: row }));
    d.rerender(shell({ list: row, chatOpen: true }));
    const wide = document.activeElement === document.body;
    return [n(first), n(toMain), n(toSide), n(kept), n(wide)];
  });
  // ---- R34
  await step("T34A", () => {
    const refs = { app: createRef<HTMLDivElement>(), sec: createRef<HTMLDivElement>(), tl: createRef<HTMLDivElement>(), tab: createRef<HTMLButtonElement>(), sb: createRef<HTMLButtonElement>(), uc: createRef<HTMLDivElement>(), wh: createRef<HTMLDivElement>() };
    const c = mount(
      <>
        <AppShell ref={refs.app} sections={S} currentSection="home" labels={labels}>x</AppShell>
        <SectionPage ref={refs.sec} title="t" />
        <TabList ref={refs.tl} aria-label="v"><Tab ref={refs.tab} id="a" selected onSelect={noop}>a</Tab></TabList>
        <SearchBox ref={refs.sb} search={{ label: "s", onOpen: noop }} />
        <UserCard ref={refs.uc} account={{ label: "l", name: "n", hue: 1 }} />
        <WorkspaceHeader ref={refs.wh} workspace={{ name: "w" }} />
      </>,
    );
    return [
      n(refs.app.current === c.querySelector("div.app")), n(refs.sec.current === c.querySelector("div.sechead")), n(refs.tl.current === c.querySelector("div.tabs")),
      n(refs.tab.current === c.querySelector("button.tab")), n(refs.sb.current === c.querySelector("button.srch")), n(refs.uc.current === c.querySelector("div.usercard")), n(refs.wh.current === c.querySelector("div.ws")),
    ];
  });
  await step("T34B", () => {
    const x = { className: "zz", "data-k": "1" };
    const pick = (el: ReactElement, sel: string) => R(el, sel);
    const els: Array<[ReactElement, string, string]> = [
      [<AppShell sections={S} currentSection="home" labels={labels} {...cast(x)}>x</AppShell>, ".app", "app zz"],
      [<SectionPage title="t" {...cast(x)} />, ".sechead", "sechead zz"],
      [<TabList aria-label="v" {...cast(x)} />, ".tabs", "tabs zz"],
      [<TabList aria-label="v"><Tab id="a" selected onSelect={noop} {...cast(x)}>a</Tab></TabList>, "button.tab", "tab zz"],
      [<SearchBox search={{ label: "s", onOpen: noop }} {...cast(x)} />, ".srch", "srch zz"],
      [<UserCard account={{ label: "l", name: "n", hue: 1 }} {...cast(x)} />, ".usercard", "usercard zz"],
      [<WorkspaceHeader workspace={{ name: "w" }} {...cast(x)} />, ".ws", "ws zz"],
    ];
    let cls = 0, attr = 0;
    for (const [el, sel, want] of els) { const e = pick(el, sel); if (e.className === want) cls++; if (e.getAttribute("data-k") === "1") attr++; }
    const owned = [
      R(<AppShell sections={S} currentSection="home" labels={labels} {...cast({ "data-testid": "zz", role: "banner" })}>x</AppShell>).getAttribute("data-testid") === "shell",
      R(<TabList aria-label="v" {...cast({ role: "menu" })} />, ".tabs").getAttribute("role") === "tablist",
      R(<TabList aria-label="v"><Tab id="a" selected onSelect={noop} {...cast({ role: "menuitem", type: "submit" })}>a</Tab></TabList>, "button.tab").getAttribute("role") === "tab",
      R(<SearchBox search={{ label: "s", onOpen: noop }} {...cast({ type: "submit", "aria-label": "zz" })} />, ".srch").getAttribute("aria-label") === "s",
    ];
    return [cls, attr, sum(owned), owned.length];
  });
  writeFileSync(process.env.QA_OUT as string, JSON.stringify(out));
});
UITSX
PROBE_WEB="$BASE/probe-web.tsx"
cat > "$PROBE_WEB" <<'WEBTSX'
// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { I18nProvider } from "@toki/i18n/react";
import { writeFileSync } from "node:fs";
import { test, vi } from "vitest";
import { sections, visibleSections, currentSectionId, type SectionRow } from "__SECTIONS_IMPORT__";
import { routeTree } from "../src/router";
import { rootRoute } from "../src/routes/__root";
import { appLayoutRoute, AppShellRoute } from "../src/routes/app-layout";
import { indexRoute } from "../src/routes/index";

const out: Record<string, number[]> = {};
const n = (x: boolean) => (x ? 1 : 0);
const sum = (xs: boolean[]) => xs.filter(Boolean).length;
const step = async (key: string, fn: () => number[] | Promise<number[]>) => {
  try { out[key] = await fn(); } catch { out[key] = [-1]; }
};
const paths: Record<string, string> = { home: "/", activity: "/activity", later: "/later", files: "/files", people: "/people", preferences: "/prefs", admin: "/admin" };
const outside = (rows: Array<{ id: string; to: string }>) => ({
  ids: rows.filter((r) => !Object.keys(paths).includes(r.id)).length,
  to: rows.filter((r) => paths[r.id] !== r.to).length,
});
async function mount(language: "en" | "vi", path = "/") {
  cleanup();
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  await act(async () => { render(<I18nProvider language={language}><RouterProvider router={router} /></I18nProvider>); });
  await screen.findByTestId("shell");
  return router;
}
const row = (id: string, roles?: Array<"member" | "admin">): SectionRow => ({ id, icon: "home", labelKey: "nav.home", to: `/${id}`, match: () => false, tab: true, roles });

test("probe", async () => {
  await step("T10A", () => {
    const a = outside(sections);
    const c = outside([...sections, { id: "mail", to: "/mail" }]);
    return [sections.length, a.ids, a.to, c.ids + c.to];
  });
  await step("T30C", () => {
    const home = sections[0]!;
    const m = [home.match("/"), home.match("/c/abc"), home.match("/c/abc/t/def"), !home.match("/activity"), !home.match("/cx")];
    return [sections.length, n(home.id === "home" && home.to === "/" && home.tab === true), sum(m), m.length, n(currentSectionId(sections, "/c/x") === "home" && currentSectionId(sections, "/nowhere") === undefined)];
  });
  await step("T30A", () => {
    const o = appLayoutRoute.options as unknown as { id?: string; path?: string; component?: unknown; getParentRoute: () => unknown };
    const kids = (rootRoute as unknown as { children?: unknown[] }).children ?? [];
    const under = (appLayoutRoute as unknown as { children?: unknown[] }).children ?? [];
    return [
      n(o.id === "_app"), n(o.path === undefined), n(o.getParentRoute() === rootRoute), n(o.component === AppShellRoute && AppShellRoute.name === "AppShellRoute"),
      n((indexRoute.options as unknown as { getParentRoute: () => unknown }).getParentRoute() === appLayoutRoute),
      n(routeTree === rootRoute), kids.length, under.length, n(kids.every((k) => k === appLayoutRoute)),
    ];
  });
  await step("T30D", async () => {
    const router = await mount("en");
    const spy = vi.spyOn(router, "navigate");
    const shell = screen.getByTestId("shell");
    const a = document.querySelector<HTMLElement>("a.ni")!;
    await userEvent.setup().click(a);
    return [
      n(shell.getAttribute("data-section") === "home"), document.querySelectorAll("a.ni").length, n(a.getAttribute("href") === "/" && a.textContent === "Home"),
      document.querySelectorAll("a.nt").length, n(spy.mock.calls.some((c) => JSON.stringify(c[0]) === '{"to":"/"}')),
    ];
  });
  await step("T31C", async () => {
    await mount("en");
    const en = document.querySelector("nav")!.getAttribute("aria-label");
    const enItem = document.querySelector("a.ni")!.textContent;
    await mount("vi");
    const vi2 = document.querySelector("nav")!.getAttribute("aria-label");
    const viItem = document.querySelector("a.ni")!.textContent;
    return [n(en === "Main"), n(vi2 === "Điều hướng chính"), n(enItem === "Home"), n(viItem === "Trang chủ")];
  });
  await step("T36A", () => {
    const rows = [row("home"), row("mod", ["member"]), row("admin", ["admin"])];
    const ids = (r: SectionRow[]) => r.map((x) => x.id).join();
    return [n(ids(visibleSections("member", rows)) === "home,mod"), n(ids(visibleSections("admin", rows)) === "home,admin"), n(ids(visibleSections(undefined, rows)) === "home"), n(ids(visibleSections(undefined)) === ids(sections.filter((s) => !s.roles)))];
  });
  const mountWith = async (role: "member" | "admin" | undefined, rows: SectionRow[]) => {
    cleanup();
    const root = createRootRoute({ component: () => <AppShellRoute role={role} rows={rows} /> });
    const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ["/"] }) });
    await act(async () => { render(<I18nProvider language="en"><RouterProvider router={router} /></I18nProvider>); });
    await screen.findByTestId("shell");
    return [...document.querySelectorAll<HTMLElement>("a.ni")].map((a) => a.dataset.id).join();
  };
  await step("T36C", async () => {
    const rows = [row("home"), row("activity"), row("people"), row("admin", ["admin"])];
    const m = await mountWith("member", rows), a = await mountWith("admin", rows), u = await mountWith(undefined, rows);
    return [n(m === "home,activity,people"), n(a === "home,activity,people,admin"), n(u === "home,activity,people")];
  });
  writeFileSync(process.env.QA_OUT as string, JSON.stringify(out));
});
WEBTSX
TYPES_POS="$BASE/types-pos.tsx"
cat > "$TYPES_POS" <<'POSTSX'
import type { AppShellProps, NavSection, PaneName, AppearanceOptions, Look, Accent, Density } from "../src/index";
import { AppShell, BottomTabs, SidePanel, TabList } from "../src/index";

const l = { mainNavigation: "m", conversations: "c" };
const noop = () => {};
export const a = <AppShell sections={[]} currentSection="" labels={l} panel={<div />} panelLabel="x">x</AppShell>;
export const b = <TabList aria-label="x" />;
export const c = <SidePanel title="" labels={{ back: "", close: "" }} onClose={noop} />;
export const d = <BottomTabs sections={[]} />;
export const e: NavSection = { id: "a", icon: "home", label: "", href: "" };
export type Used = [AppShellProps, NavSection, PaneName, AppearanceOptions, Look, Accent, Density];
POSTSX
TYPES_NEG="$BASE/types-neg.tsx"
cat > "$TYPES_NEG" <<'NEGTSX'
// E6
import type { Nope } from "../src/index";
import { AppShell, BottomTabs, SidePanel, TabList } from "../src/index";
import type { NavSection } from "../src/index";

const l = { mainNavigation: "m", conversations: "c" };
const noop = () => {};
// E1
export const a = <AppShell sections={[]} currentSection="" labels={l} panel={<div />}>x</AppShell>;
// E2
export const b = <TabList />;
// E3
export const c = <SidePanel title="" labels={{ back: "", close: "" }} onClose={noop} ref={null} />;
// E4
export const d = <BottomTabs sections={[]} ref={null} />;
// E5
export const e: NavSection = { id: "a", icon: "no-such-icon", label: "", href: "" };
export type X = Nope;
NEGTSX
DRIVER="$BASE/driver.mjs"
cat > "$DRIVER" <<'DRIVERJS'
// The browser driver of docs/qa/TOKI-015.checks.sh: measures the fixture page of the ticket and prints one JSON
// object, one array of numbers for each row. It writes nothing else.
import { chromium } from "@playwright/test";
const base = process.argv[2];
const want = (process.argv[3] || "all").split(",");
const on = (g) => want.includes("all") || want.includes(g);
let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (e) {
  console.log(JSON.stringify({ error: String(e.message).split("\n")[0].slice(0, 160) }));
  process.exit(0);
}
const out = {};
const n = (x) => (x ? 1 : 0);
const LOOKS = ["calm", "focus"];
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
let ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
let page = await ctx.newPage();
let clocked = false;
// a page that had a paused clock is dropped, so that no later row runs on frozen timers
const fresh = async () => { await ctx.close(); ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } }); page = await ctx.newPage(); };
const open = async (look, w, h, q = {}, clock = false) => {
  if (clock || clocked) { await fresh(); clocked = false; }
  if (clock) {
    clocked = true;
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  }
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${base}/shell-fixture.html?${new URLSearchParams({ look, ...q })}`);
  await page.waitForSelector('[data-testid="shell"]');
  await page.waitForFunction(() => document.getAnimations().length === 0);
};
// rects of the first element of each selector: { x, y, w, h, r, b, d (display), v (visibility), z }
const rects = (sels) =>
  page.evaluate((list) => {
    const o = {};
    for (const sel of list) {
      const e = document.querySelector(sel);
      if (!e) { o[sel] = null; continue; }
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      o[sel] = { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom, d: s.display, v: s.visibility, z: s.zIndex };
    }
    return o;
  }, sels);

out.HTTP = [(await page.request.get(`${base}/shell-fixture.html`)).status()];
const W8 = [[360, 560], [719, 800], [720, 800], [800, 800], [956, 800], [1099, 800], [1100, 800], [1400, 800]];
const tally = (checks) => [checks.length, checks.filter(Boolean).length];
const step = async (key, fn) => { try { out[key] = await fn(); } catch (e) { out[key] = [-1]; } };

// ---- R18, R8
if (on("g18")) {
  await step("T18A", async () => {
    const c = [];
    for (const w of [1100, 720]) {
      await open("calm", w, 800);
      const r = await rects([".sidebar", ".main"]);
      c.push(near(r[".sidebar"].w, 272), near(r[".main"].x, 272), near(r[".main"].r, w - 12), near(r[".main"].y, 12), near(r[".main"].b, 800 - 12));
    }
    return tally(c);
  });
  await step("T18B", async () => {
    const c = [];
    for (const w of [1100, 720]) {
      await open("focus", w, 800);
      const r = await rects([".nav", ".convs", ".main"]);
      c.push(near(r[".nav"].w, 68), near(r[".convs"].r, 356), near(r[".main"].x, 356), near(r[".main"].r, w));
    }
    return tally(c);
  });
  await step("T18C", async () => {
    const c = [];
    for (const look of LOOKS) for (const [w, h] of [[719, 800], [360, 560]]) {
      await open(look, w, h);
      const r = await rects([".nav", ".convs", ".usercard", ".sidebar"]);
      c.push(near(r[".nav"].h, 62), near(r[".nav"].b, h), near(r[".nav"].w, w), near(r[".convs"].w, w) && near(r[".convs"].h, h - 62) && near(r[".convs"].y, 0), r[".usercard"] === null || r[".usercard"].d === "none", r[".sidebar"].d === "block");
    }
    return tally(c);
  });
  await step("T18D", async () => {
    const c = [];
    for (const w of [720, 800, 956, 1099, 1100, 1400]) {
      await open("focus", w, 800, { section: "activity" });
      const r = await rects([".nav", ".main", ".convs"]);
      c.push(near(r[".nav"].x, 0) && near(r[".nav"].w, 68), near(r[".main"].x, 68), near(r[".main"].r, w), r[".convs"] === null || r[".convs"].d === "none");
    }
    return tally(c);
  });
  await step("T18E", async () => {
    const c = [];
    for (const w of [1100, 720]) {
      await open("calm", w, 800);
      const r = await rects([".ws", ".wsn", ".wss"]);
      c.push(near(r[".ws"].h, 45.4), near(r[".wss"].y, r[".wsn"].b, 0.5));
    }
    return tally(c);
  });
  await step("T18F", async () => {
    const c = [];
    for (const w of [1100, 720]) {
      await open("focus", w, 800);
      const r = await rects([".ws", ".wst", ".wsn", ".wss", ".nav"]);
      c.push(r[".wst"].d === "none", near(r[".ws"].w, 51), r[".ws"].r <= r[".nav"].r + 0.5, r[".wsn"].w === 0 && r[".wsn"].h === 0 && r[".wss"].w === 0);
    }
    return tally(c);
  });
  await step("T18G", async () => {
    const c = [];
    for (const [look, want] of [["calm", 67], ["focus", 64]]) for (const w of [1100, 720]) {
      await open(look, w, 800);
      c.push(near((await rects([".usercard"]))[".usercard"].h, want));
    }
    return tally(c);
  });
  await step("T8E", async () => {
    const c = [];
    for (const look of LOOKS) for (const w of [720, 1100]) {
      await open(look, w, 800);
      c.push(near((await rects([".ucard .av"]))[".ucard .av"].w, 36));
    }
    return tally(c);
  });
}

// ---- R19
if (on("g19")) {
  await step("T19A", async () => {
    const c = [];
    for (const look of LOOKS) for (const w of [720, 800, 1099]) {
      await open(look, w, 800);
      const a = (await rects([".main"]))[".main"];
      await open(look, w, 800, { panel: 1 });
      const r = await rects([".main", ".side"]);
      c.push(near(r[".main"].x, a.x) && near(r[".main"].w, a.w) && near(r[".main"].y, a.y) && near(r[".main"].h, a.h));
      c.push(near(r[".side"].w, 360));
      c.push(near(r[".side"].r, look === "calm" ? w - 12 : w));
      c.push(Number(r[".side"].z) > (Number(r[".main"].z) || 0));
      c.push(r[".side"].x >= r[".main"].x - 1 && r[".side"].r <= r[".main"].r + 1);
    }
    return tally(c);
  });
  await step("T19B", async () => {
    const c = [];
    for (const [look, withP, without] of [["calm", 444, 816], ["focus", 384, 744]]) {
      await open(look, 1100, 800, { panel: 1 });
      const r = await rects([".main", ".side"]);
      c.push(near(r[".main"].w, withP), near(r[".side"].w, 360));
      await open(look, 1100, 800);
      c.push(near((await rects([".main"]))[".main"].w, without));
    }
    return tally(c);
  });
  await step("T19C", async () => {
    const c = [];
    for (const look of LOOKS) for (const [w, h] of [[719, 800], [360, 560]]) {
      await open(look, w, h, { panel: 1 });
      const r = await rects([".side", ".nav"]);
      c.push(near(r[".side"].x, 0) && near(r[".side"].y, 0) && near(r[".side"].w, w) && near(r[".side"].h, h), r[".side"].v === "visible", r[".nav"].v === "hidden");
    }
    return tally(c);
  });
}

// ---- R20
const content = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    const kids = [...el.children].filter((k) => getComputedStyle(k).display !== "none");
    const a = kids[0].getBoundingClientRect(), b = kids[kids.length - 1].getBoundingClientRect();
    return { content: b.bottom - a.top + el.scrollTop, box: el.clientHeight, scrolls: el.scrollHeight > el.clientHeight, ov: getComputedStyle(el).overflowY, items: kids.length, ni: kids.map((k) => k.getBoundingClientRect().height) };
  }, sel);
if (on("g20")) {
  const scenarios = [["admin", {}], ["admin8", { extra: 2 }], ["member", { role: "member" }]];
  await step("T20A", async () => {
    const c = [];
    for (const h of [560, 480, 420]) for (const [name, q] of scenarios) {
      await open("calm", 1100, h, q);
      const r = await rects([".convs", ".ws", ".srch", ".usercard"]);
      const it = await content(".nav-items");
      c.push(r[".convs"].h >= 239.5 && near(r[".convs"].h, 240));
      c.push(it.ov === "auto", it.scrolls, it.ni.every((x) => near(x, 30)));
      c.push([".ws", ".srch", ".convs", ".usercard"].every((s) => r[s].y >= -0.5 && r[s].b <= h + 0.5));
    }
    return tally(c);
  });
  await step("T20B", async () => {
    const c = [];
    for (const [h, nav, box] of [[560, 253, 149.6], [480, 173, 69.6], [420, 113, 9.6]]) {
      await open("calm", 1100, h);
      const r = await rects([".nav"]);
      const it = await content(".nav-items");
      c.push(near(r[".nav"].h, nav), near(it.box, box));
      if (h === 560) c.push(near(it.content, 185));
    }
    await open("calm", 1100, 560, { role: "member" }); c.push(near((await content(".nav-items")).content, 154));
    await open("calm", 1100, 560, { extra: 2 }); c.push(near((await content(".nav-items")).content, 247));
    return tally(c);
  });
  await step("T20C", async () => {
    const c = [];
    for (const [h, box] of [[560, 396], [480, 316], [420, 256]]) {
      await open("focus", 1100, h);
      const a = await content(".nav-items"), card = (await rects([".usercard"]))[".usercard"];
      c.push(near(a.box, box), a.scrolls === (h !== 560), near(a.content, 356), card.b <= h + 0.5, a.ov === "auto");
      await open("focus", 1100, h, { role: "member" });
      const m = await content(".nav-items");
      c.push(m.scrolls === (h === 420), near(m.content, 305));
    }
    return tally(c);
  });
}

// ---- R21
if (on("g21")) {
  await step("T21A", async () => {
    const c = [];
    for (const look of LOOKS) for (const section of ["home", "activity", "later", "files", "people", "admin", "preferences"]) {
      await open(look, 360, 560, { section, extra: 2 });
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      const r = await rects([".nav", ".convs", ".main"]);
      const inside = (x) => x && x.x >= -0.5 && x.r <= 360.5 && x.y >= -0.5 && x.b <= 560.5;
      c.push(m.sw <= m.iw, inside(r[".nav"]), inside(section === "home" ? r[".convs"] : r[".main"]));
    }
    return tally(c);
  });
  await step("T21B", async () => {
    let checked = 0, ok = 0;
    for (const look of LOOKS) for (const [w, h] of [[719, 800], [360, 560]]) for (const q of [{ pane: "main" }, { pane: "side" }, { section: "activity" }, {}]) {
      await open(look, w, h, q);
      const hs = await page.evaluate(() => [...document.querySelectorAll(".nt, .tab, .ib, .btn")].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.getBoundingClientRect().height));
      checked += hs.length; ok += hs.filter((x) => x >= 39.5).length;
    }
    return [checked, ok];
  });
  await step("T21C", async () => {
    const c = [];
    for (const look of LOOKS) {
      await open(look, 360, 560);
      const m = await page.evaluate(() => {
        const bar = document.querySelector(".nav-tabs");
        const items = [...bar.querySelectorAll(".nt")].map((e) => e.getBoundingClientRect());
        return { n: items.length, minW: Math.min(...items.map((r) => r.width)), sameRow: items.every((r) => Math.abs(r.y - items[0].y) < 1), noScroll: bar.scrollWidth <= bar.clientWidth + 1 };
      });
      c.push(m.n === 5, m.minW >= 63.5, m.sameRow, m.noScroll);
    }
    return tally(c);
  });
  await step("T21D", async () => {
    const c = [];
    for (const look of LOOKS) {
      await open(look, 360, 560);
      c.push(await page.evaluate(() => getComputedStyle(document.querySelector(".nav-tabs")).overflowX === "auto"));
    }
    return tally(c);
  });
}

// ---- R22, R11
if (on("g22")) {
  await step("T22A", async () => {
    const c = [];
    for (const look of LOOKS) for (const w of [719, 360]) {
      const h = w === 360 ? 560 : 800;
      await open(look, w, h, { pane: "list" });
      let r = await rects([".convs", ".main", ".side", ".nav"]);
      c.push(r[".convs"].v === "visible", r[".main"].v === "hidden", r[".side"] === null, r[".nav"].v === "visible");
      await open(look, w, h, { pane: "main" });
      r = await rects([".convs", ".main", ".nav"]);
      c.push(r[".main"].v === "visible", r[".convs"].v === "hidden", r[".nav"].v === "hidden" && near(r[".nav"].y, h));
      await open(look, w, h, { pane: "side" });
      r = await rects([".convs", ".main", ".side", ".nav"]);
      c.push(r[".side"].v === "visible" && near(r[".side"].w, w) && near(r[".side"].h, h), r[".main"].v === "hidden", r[".convs"].v === "hidden", r[".nav"].v === "hidden" && near(r[".nav"].y, h));
    }
    return tally(c);
  });
  await step("T22B", async () => {
    let presses = 0, bad = 0, visitedShown = 0, cases = 0;
    const shown = { list: ".convs", main: ".main", side: ".side" };
    const hiddenSels = { list: [".main", ".side"], main: [".convs", ".side", ".nav"], side: [".convs", ".main", ".nav"] };
    for (const look of LOOKS) for (const w of [719, 360]) for (const pane of ["list", "main", "side"]) {
      await open(look, w, w === 360 ? 560 : 800, { pane });
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      let saw = false; cases++;
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab"); presses++;
        const st = await page.evaluate(([sel, hid]) => {
          const a = document.activeElement;
          const inside = (s) => { const e = document.querySelector(s); return !!e && !!a && e.contains(a); };
          return { bad: hid.some(inside), inShown: inside(sel) };
        }, [shown[pane], hiddenSels[pane]]);
        if (st.bad) bad++;
        if (st.inShown) saw = true;
      }
      if (saw) visitedShown++;
    }
    return [presses, bad, cases, visitedShown];
  });
  await step("T22C", async () => {
    const c = [];
    for (const look of LOOKS) {
      await open(look, 360, 560, { panel: 1, pane: "list" });
      const read = () => page.evaluate(() => [".convs", ".main", ".nav"].map((s) => getComputedStyle(document.querySelector(s)).transitionDuration).concat(getComputedStyle(document.querySelector(".side")).animationDuration));
      const a = await read();
      c.push(a.slice(0, 3).every((d) => d.split(",").map((p) => p.trim()).join() === "0.18s,0.18s"), a[3] === "0.18s");
      await page.emulateMedia({ reducedMotion: "reduce" });
      const b = await read();
      c.push(b.every((d) => d.split(",").every((p) => parseFloat(p) < 0.001)));
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
    return tally(c);
  });
  await step("T11C", async () => {
    const c = [];
    for (const look of LOOKS) for (const [w, back, close] of [[719, "inline-grid", "none"], [720, "none", null]]) {
      await open(look, w, 800, { panel: 1 });
      const r = await rects([".sh .back-side", ".sh .closex"]);
      if (w === 719) c.push(r[".sh .back-side"].d !== "none", r[".sh .closex"].d === "none");
      else c.push(r[".sh .back-side"].d === "none", r[".sh .closex"].d !== "none");
    }
    return tally(c);
  });
}

// ---- R23, R25
const TW = [[360, 560], [719, 800], [720, 800], [800, 800], [956, 800], [1099, 800], [1100, 800]];
const inter = (a, b) => a && b && Math.min(a.r, b.r) - Math.max(a.x, b.x) > 0.5 && Math.min(a.b, b.b) - Math.max(a.y, b.y) > 0.5;
async function toastCase(look, w, h, q) {
  await open(look, w, h, { ...q, toasts: 1 }, true);
  await page.waitForFunction(() => document.querySelectorAll(".toast").length === 3);
  await page.waitForFunction(() => document.getAnimations().length === 0);
  return page.evaluate(() => {
    const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height, v: getComputedStyle(e).visibility }; };
    const q1 = (s) => box(document.querySelector(s));
    return { vh: innerHeight, toasts: [...document.querySelectorAll(".toast")].map(box), nav: q1(".nav"), composer: q1('[data-testid="composer"]'), panelComposer: q1('[data-testid="panel-composer"]'), sidebar: q1(".sidebar"), side: q1(".side"), anchor: q1(".toast-anchor") };
  });
}
const toastCases = (w) => (w < 720 ? [["list", { pane: "list" }], ["chat", { pane: "main" }], ["panel", { pane: "side" }]] : [["plain", {}], ["panel", { panel: 1 }]]);
if (on("g23")) {
  const cache = [];
  for (const look of LOOKS) for (const [w, h] of TW) for (const [name, q] of toastCases(w)) cache.push({ look, w, h, name, s: await toastCase(look, w, h, q) });
  await step("T23A", async () => {
    const c = cache.map(({ w, name, s }) => {
      const narrow = w < 720;
      const barShown = narrow && s.nav && s.nav.v === "visible" && s.nav.y < s.vh - 1;
      const obstacles = [barShown ? s.nav : null, s.composer && s.composer.x < w && s.composer.r > 0 ? s.composer : null, s.panelComposer, narrow ? null : s.sidebar, w >= 956 && name === "panel" ? s.side : null].filter(Boolean);
      return s.toasts.length === 3 && s.toasts.every((t) => obstacles.every((o) => !inter(t, o)));
    });
    return tally(c);
  });
  await step("T23B", async () => {
    const c = cache.map(({ w, s }) => {
      const narrow = w < 720;
      const barShown = narrow && s.nav && s.nav.v === "visible" && s.nav.y < s.vh - 1;
      const comps = [s.composer && s.composer.x < w && s.composer.r > 0 && s.composer.y < s.vh ? s.composer : null, s.panelComposer && s.panelComposer.x < w && s.panelComposer.r > 0 ? s.panelComposer : null].filter(Boolean);
      return s.toasts.length === 3 && s.toasts.every((t) => comps.every((o) => t.b <= o.y + 0.5) && (!barShown || t.b <= s.nav.y + 0.5));
    });
    return tally(c);
  });
  await step("T23D", async () => {
    const c = [];
    const calm = { 720: 436, 800: 516, 956: 312, 1099: 455, 1100: 444 }, focus = { 720: 364, 800: 444, 956: 240, 1099: 383, 1100: 384 };
    for (const look of LOOKS) {
      const table = look === "calm" ? calm : focus;
      for (const w of Object.keys(table)) c.push(near(cache.find((x) => x.look === look && x.w === Number(w) && x.name === "panel").s.anchor.w, table[w]));
      for (const [w, h] of [[360, 560], [719, 800]]) {
        const a = cache.find((x) => x.look === look && x.w === w && x.name === "list").s.anchor;
        c.push(near(a.w, w) && near(a.h, h) && near(a.x, 0) && near(a.y, 0));
      }
    }
    return tally(c);
  });
  await step("T23C", async () => {
    const c = [];
    for (const look of LOOKS) for (const [w, h] of [[1100, 800], [360, 560]]) {
      await open(look, w, h, { toasts: 1 }, true);
      await page.waitForSelector(".toasts");
      const m = await page.evaluate(() => {
        const region = document.querySelector(".toasts"), app = document.querySelector(".app");
        let bad = 0, n = 0;
        for (let e = region.parentElement; e; e = e.parentElement) {
          n++;
          const s = getComputedStyle(e);
          if ((s.position !== "static" && s.zIndex !== "auto") || s.transform !== "none" || Number(s.opacity) < 1 || s.filter !== "none" || s.isolation === "isolate" || (s.contain && s.contain !== "none")) bad++;
        }
        return { after: region.previousElementSibling === app && !app.contains(region), n, bad, appFixed: getComputedStyle(app).position === "fixed" };
      });
      c.push(m.after, m.bad === 0, m.n >= 3, m.appFixed);
    }
    return tally(c);
  });
  await step("T23E", async () => {
    const c = [];
    for (const look of LOOKS) for (const w of [1100, 720]) {
      await open(look, w, 800);
      const m = await page.evaluate(() => {
        const a = document.querySelector(".toast-anchor"), s = getComputedStyle(a);
        const r = a.getBoundingClientRect(), mr = document.querySelector(".main").getBoundingClientRect();
        return { aria: a.getAttribute("aria-hidden") === "true", empty: a.childElementCount === 0 && a.textContent === "", pe: s.pointerEvents === "none", vis: s.visibility === "hidden", same: Math.abs(r.x - mr.x) <= 1 && Math.abs(r.y - mr.y) <= 1 && Math.abs(r.width - mr.width) <= 1 && Math.abs(r.height - mr.height) <= 1 };
      });
      c.push(m.aria, m.empty, m.pe, m.vis, m.same);
    }
    return tally(c);
  });
  await step("T25B", async () => {
    const c = [];
    for (const look of LOOKS) {
      await open(look, 1100, 800, { panel: 1 });
      const m = await page.evaluate(() => [".main", ".side"].map((s) => { const e = getComputedStyle(document.querySelector(s)); return [e.overflowX === "hidden" && e.overflowY === "hidden", e.transform === "none"]; }));
      c.push(m[0][0], m[1][0], m[0][1], m[1][1]);
    }
    return tally(c);
  });
  await step("T25C", async () => {
    // a registered composer moves the toasts: the toasts of the chat (with a composer) stand higher than those of a section page
    const c = [];
    for (const look of LOOKS) {
      const a = await toastCase(look, 1100, 800, {}), b = await toastCase(look, 1100, 800, { section: "activity" });
      const lowA = a.vh - Math.max(...a.toasts.map((t) => t.b)), lowB = b.vh - Math.max(...b.toasts.map((t) => t.b));
      c.push(lowA > lowB + 30, near(lowB, 20));
    }
    return tally(c);
  });
}

// ---- R15
if (on("g15")) {
  await step("T15B", async () => {
    const cases = [[".main", { empty: "main" }, "main"], [".secbody", { section: "activity", empty: "secbody" }, null], [".sb", { panel: 1, empty: "sb" }, null]];
    const c = [];
    for (const look of LOOKS) for (const w of [360, 720, 1100]) for (const [parent, q, narrowPane] of cases) {
      const query = { ...q };
      if (w < 720 && narrowPane) query.pane = narrowPane;
      await open(look, w, w === 360 ? 560 : 800, query);
      const m = await page.evaluate((sel) => {
        const p = document.querySelector(sel), e = p.querySelector(":scope > .empty"), r = p.getBoundingClientRect(), s = getComputedStyle(p);
        const area = { l: r.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft), r: r.right - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight), t: r.top + parseFloat(s.borderTopWidth) + parseFloat(s.paddingTop), b: r.bottom - parseFloat(s.borderBottomWidth) - parseFloat(s.paddingBottom) };
        const k = [...e.children].map((x) => x.getBoundingClientRect());
        return { dx: (Math.min(...k.map((x) => x.left)) + Math.max(...k.map((x) => x.right))) / 2 - (area.l + area.r) / 2, dy: (Math.min(...k.map((x) => x.top)) + Math.max(...k.map((x) => x.bottom))) / 2 - (area.t + area.b) / 2, icon: !!e.querySelector(".eic") };
      }, parent);
      c.push(m.icon && Math.abs(m.dx) <= 1 && Math.abs(m.dy) <= 1);
    }
    return tally(c);
  });
}

// ---- R27, R29, R5, R6, R36, R32
if (on("g27")) {
  await step("T27D", async () => {
    const c = [];
    for (const look of LOOKS) for (const [w, size] of [[719, "15px"], [720, "14px"]]) {
      await open(look, w, 800);
      c.push((await page.evaluate(() => getComputedStyle(document.body).fontSize)) === size);
    }
    return tally(c);
  });
}
if (on("g29")) {
  await step("T29B", async () => {
    const c = [];
    for (const look of LOOKS) {
      await open(look, 360, 560);
      await page.click(".convs .crow");
      await page.waitForFunction(() => document.activeElement === document.querySelector("main.main"), null, { timeout: 3000 }).then(() => c.push(true), () => c.push(false));
    }
    return tally(c);
  });
  await step("T29C", async () => {
    const c = [];
    for (const look of LOOKS) {
      await open(look, 720, 800);
      await page.click(".convs .crow");
      await page.waitForTimeout(400);
      c.push(await page.evaluate(() => document.activeElement !== document.querySelector("main.main") && document.activeElement !== document.querySelector(".convs")));
    }
    return tally(c);
  });
}
if (on("g5")) {
  await step("T5E", async () => {
    const c = [];
    for (const look of LOOKS) for (const w of [720, 1100]) {
      await open(look, w, 800);
      const r = await rects(['a.ni[data-id="preferences"]']);
      const attr = await page.evaluate(() => document.querySelector('a.ni[data-id="preferences"]').hasAttribute("data-calm-hidden"));
      c.push(attr, look === "calm" ? r['a.ni[data-id="preferences"]'].d === "none" : r['a.ni[data-id="preferences"]'].d !== "none");
    }
    return tally(c);
  });
  await step("T6D", async () => {
    const c = [];
    for (const look of LOOKS) {
      await open(look, 360, 560);
      const m = await page.evaluate(() => [...document.querySelectorAll(".nav-tabs .nt")].map((e) => `${e.tagName.toLowerCase()}:${e.querySelector(":scope > span").textContent.trim()}`));
      c.push(m.join() === "a:Home,a:Activity,a:Later,a:Files,button:More");
    }
    return tally(c);
  });
  await step("T36D", async () => {
    const vis = (q, look) => open(look, 1100, 800, q).then(() => page.evaluate(() => [...document.querySelectorAll("a.ni")].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.dataset.id)));
    const cm = await vis({ role: "member" }, "calm"), ca = await vis({ role: "admin" }, "calm"), fm = await vis({ role: "member" }, "focus"), fa = await vis({}, "focus");
    return [cm.length, n(cm.includes("admin")), ca.length, n(ca.includes("admin")), fm.length, n(fm.includes("admin")), fa.length, n(fa.includes("admin"))];
  });
  await step("T32F", async () => {
    const c = [];
    await open("calm", 1100, 800, { section: "activity" }); c.push(await page.evaluate(() => document.querySelector(".app").dataset.section === "activity"));
    await open("calm", 360, 560, { pane: "list" }); c.push(await page.evaluate(() => document.querySelector(".app").dataset.pane === "list"));
    await open("calm", 360, 560, { pane: "main" }); c.push(await page.evaluate(() => document.querySelector(".app").dataset.pane === "main"));
    await open("calm", 360, 560, { pane: "side" }); c.push(await page.evaluate(() => document.querySelector(".app").dataset.pane === "side"));
    await open("calm", 1100, 800, { panel: 1 }); c.push(await page.evaluate(() => document.querySelector(".side") !== null && document.querySelector(".app").hasAttribute("data-panel")));
    await open("calm", 1100, 800, { role: "member" }); c.push(await page.evaluate(() => document.querySelector('a.ni[data-id="admin"]') === null));
    await open("calm", 1100, 800, { extra: 2 }); c.push(await page.evaluate(() => document.querySelectorAll(".nav-items a.ni").length === 9));
    await open("calm", 1100, 800, { extra: 5 }); c.push(await page.evaluate(() => document.querySelectorAll(".nav-items a.ni").length === 9));
    await open("calm", 1100, 800, { toasts: 1 }, true); c.push((await page.locator(".toast").count()) === 3);
    await open("focus", 1100, 800); c.push(await page.evaluate(() => document.documentElement.dataset.eff === "focus"));
    await open("calm", 1100, 800); c.push(await page.evaluate(() => document.documentElement.dataset.eff === "calm"));
    return tally(c);
  });
  await step("T32G", async () => {
    await open("calm", 1100, 800, { panel: 1 });
    const a = await page.evaluate(() => ({ ws: document.querySelector(".wsn").textContent.length > 0, rows: document.querySelectorAll(".convs button.crow").length, tabs: document.querySelectorAll(".tabs .tab").length, comp: document.querySelector('[data-testid="composer"] input') !== null, panel: document.querySelector(".side .sh") !== null && document.querySelector(".side .sb") !== null, people: document.querySelectorAll(".side .sb .row").length, pcomp: document.querySelector('[data-testid="panel-composer"]') !== null }));
    await open("calm", 1100, 800, { empty: "main" });
    const e = await page.evaluate(() => document.querySelector(".main .empty") !== null);
    await open("calm", 360, 560);
    await page.click(".nav-tabs button.nt");
    const more = await page.evaluate(() => document.querySelectorAll('[data-testid="more-rows"] li').length);
    return [n(a.ws), a.rows, a.tabs, n(a.comp), n(a.panel), a.people, n(a.pcomp), n(e), more];
  });
}
await browser.close();
console.log(JSON.stringify(out));
DRIVERJS

# ---- the probes: a Vitest file written into the worktree, run, and deleted ------------------------
# (the sources of the probes follow the helpers; they exist only inside the temporary worktree)
# probe_run <ui|web> <name>: leaves $BASE/<name>.json (the values of every row of that probe)
probe_run() {
  local kind="$1" name="$2" dest pkg rel
  if [ "$kind" = ui ]; then
    pkg=@toki/ui-web; dest="$WT/$UI/tests/zz-qa-probe.test.tsx"; cp "$PROBE_UI" "$dest"
  else
    pkg=@toki/web; dest="$WT/apps/web/tests/zz-qa-probe.test.tsx"
    rel="../${SECTIONS#apps/web/}"; rel="${rel%.ts}"
    sed "s#__SECTIONS_IMPORT__#$rel#" "$PROBE_WEB" > "$dest"
  fi
  pnenv QA_OUT="$BASE/$name.json" -- --filter "$pkg" exec vitest run tests/zz-qa-probe.test.tsx > "$BASE/$name.log" 2>&1
  rm -f "$dest"
}
# The mutations of the unit probes: <file>|<perl substitution>. They are applied together to the worktree,
# the probe is run once, and every file is restored. Each one targets one row; the row line shows its own
# values under the mutations after the word `mutated`.
MUT_UI=(
  "$SHELLDIR/derivePane.ts|s/input\.section === \"home\"/input.section === \"hom\"/"
  "$SHELLDIR/NavSection.tsx|s/\s*!event\.ctrlKey &&//"
  "$SHELLDIR/NavSection.tsx|s/badge > 0/badge >= 0/"
  "$SHELLDIR/NavSection.tsx|s/variant=\{section\.id === \"home\" \? \"mute\" : undefined\}//"
  "$SHELLDIR/SidePanel.tsx|s/event\.defaultPrevented \|\| //"
  "$SHELLDIR/SidePanel.tsx|s/className=\"closex\"/className=\"closexx\"/"
  "$SHELLDIR/TabList.tsx|s/: \(from \+ last\) % tabs\.length;/: from;/"
  "$SHELLDIR/TabList.tsx|s/target\.focus\(\);\n\s*scrollIntoView\(target\);/target.focus();/"
  "$SHELLDIR/TabList.tsx|s/tabIndex=\{selected \? 0 : -1\}/tabIndex={0}/"
  "$SHELLDIR/AppShell.tsx|s/<UserCard account=\{account\} \/>/{null}/"
  "$SHELLDIR/AppShell.tsx|s/data-has-list=\{hasList \? \"\" : undefined\}//"
  "$SHELLDIR/AppShell.tsx|s/data-chat-open=\{chatOpen \? \"\" : undefined\}//"
  "$SHELLDIR/AppShell.tsx|s/if \(!target \|\| target\.contains\(document\.activeElement\)\) return;/if (!target) return;/"
  "$SHELLDIR/WorkspaceHeader.tsx|s/first\.toUpperCase\(\)/first/"
  "$SHELLDIR/WorkspaceHeader.tsx|s/className=\{cx\(\"ws\", className\)\}/className=\"ws\"/"
  "$SHELLDIR/SearchBox.tsx|s/ref=\{ref\}//"
  "$SHELLDIR/SearchBox.tsx|s/\{search\.label\}<\/span>/{search.label}Z<\/span>/"
  "$SHELLDIR/BottomTabs.tsx|s/\.filter\(\(section\) => section\.tab\)//"
  "$SHELLDIR/BottomTabs.tsx|s/aria-haspopup=\"dialog\"/aria-haspopup=\"menu\"/"
  "$SHELLDIR/BottomTabs.tsx|s/onClick=\{\(\) => moreTab\.onOpen\(\)\}/onClick={() => { moreTab.onOpen(); document.body.insertAdjacentHTML(\"beforeend\", \"<div role=dialog><\/div>\"); }}/"
  "$SHELLDIR/SectionPage.tsx|s/\{actions\}//"
  "$SHELLDIR/UserCard.tsx|s/size=\{36\}/size={30}/"
  "$SHELLDIR/UserCard.tsx|s/\n\s*type=\"button\"//"
  "$UI/src/appearance.ts|s/query\.addEventListener\(\"change\", set\);//"
  "$SHELLDIR/NavSection.tsx|s/aria-current=\{current \? \"page\" : undefined\}/aria-current={undefined}/"
  "$SHELLDIR/SearchBox.tsx|s/onClick=\{\(\) => search\.onOpen\(\)\}//"
  "$SHELLDIR/useNarrow.ts|s/list\.addEventListener\(\"change\", notify\);//"
  "$UI/src/appearance.ts|s/: \"teal\";/: \"indigo\";/"
  "$UI/src/appearance.ts|s/root\.setAttribute\(\"data-eff\", \"focus\"\);/root.setAttribute(\"data-eff\", \"calm\");/"
  "$UI/src/index.ts|s/export \* from \"\.\/appearance\";\n//"
)
MUT_WEB=(
  "$SECTIONS|s/pathname\.startsWith\(\"\/c\/\"\)/pathname.startsWith(\"\/d\/\")/"
  "$SECTIONS|s/row\.roles\.includes\(role\)/true/"
  "apps/web/src/routes/app-layout.tsx|s/id: \"_app\"/id: \"_apx\"/"
  "apps/web/src/routes/app-layout.tsx|s/void router\.navigate\(\{ to: section\.href \}\);//"
  "apps/web/src/routes/app-layout.tsx|s/const rows = visibleSections\(role, list\);/const rows = visibleSections(undefined, list);/"
  "packages/i18n/src/messages/en/nav.ts|s/mainLabel: \"Main\"/mainLabel: \"Mainx\"/"
)
# apply_muts <item>...: applies every mutation, true when all changed a file
MUT_APPLIED=()
apply_muts() {
  local item f p ok=1 h; MUT_APPLIED=()
  for item in "$@"; do
    f="${item%%|*}"; p="${item#*|}"
    h=$(shasum "$WT/$f" | cut -d' ' -f1)
    perl -0pi -e "$p" "$WT/$f"
    [ "$h" = "$(shasum "$WT/$f" | cut -d' ' -f1)" ] && { ok=0; echo "mutation did not apply: $f $p" >> "$BASE/mut.log"; }
    MUT_APPLIED+=("$f")
  done
  [ "$ok" = 1 ]
}
restore_muts() { local f; for f in ${MUT_APPLIED[@]+"${MUT_APPLIED[@]}"}; do restore "$f"; done; MUT_APPLIED=(); }
PU_DONE=""; PW_DONE=""
pu_ready() { # the unit probe of ui-web, plain and mutated
  need "$1" || return 1
  if [ -z "$PU_DONE" ]; then
    probe_run ui pu
    if apply_muts "${MUT_UI[@]}"; then probe_run ui pum; else echo "the ui mutations did not apply" > "$BASE/pum.log"; fi
    restore_muts; PU_DONE=1
  fi
  [ -f "$BASE/pu.json" ] || { echo "$1 the probe produced no result (Blocked): $(first_error "$BASE/pu.log")"; return 1; }
  [ "$(jq -r --arg k "$1" '.[$k] | length' "$BASE/pu.json" 2>/dev/null)" -ge 1 ] 2>/dev/null || { echo "$1 the probe has no result for this row (Blocked)"; return 1; }
}
pw_ready() { # the unit probe of apps/web
  need "$1" || return 1
  if [ -z "$PW_DONE" ]; then
    probe_run web pwb
    if apply_muts "${MUT_WEB[@]}"; then probe_run web pwbm; else echo "the web mutations did not apply" > "$BASE/pwbm.log"; fi
    restore_muts; PW_DONE=1
  fi
  [ -f "$BASE/pwb.json" ] || { echo "$1 the probe produced no result (Blocked): $(first_error "$BASE/pwb.log")"; return 1; }
  [ "$(jq -r --arg k "$1" '.[$k] | length' "$BASE/pwb.json" 2>/dev/null)" -ge 1 ] 2>/dev/null || { echo "$1 the probe has no result for this row (Blocked)"; return 1; }
}
# vals <json file> <row>: the values of a row, joined by spaces ("-" when the file or the row is missing)
vals() { jq -r --arg k "$2" '.[$k] | map(tostring) | join(" ")' "$BASE/$1.json" 2>/dev/null || echo "-"; }
# prow <ui|web> <ID> [mutated]: the line of a probe row
prow() {
  local kind="$1" id="$2" m="${3:-}" f=pu fm=pum
  if [ "$kind" = web ]; then f=pwb; fm=pwbm; pw_ready "$id" || return; else pu_ready "$id" || return; fi
  if [ -n "$m" ]; then
    [ -f "$BASE/$fm.json" ] || { echo "$id $(vals $f "$id") the mutated copy could not be run (Blocked): $(first_error "$BASE/$fm.log")"; return; }
    echo "$id $(vals $f "$id") mutated $(vals $fm "$id")"
  else
    echo "$id $(vals $f "$id")"
  fi
}

# ---- the type checks: files written into the worktree, compiled with the repository's tsc ---------------
TSC_DONE=""
tsc_run() {
  need "$1" || return 1
  [ -n "$TSC_DONE" ] && return 0
  cp "$TYPES_POS" "$WT/$UI/tests/zz-qa-types.tsx"; cp "$TYPES_NEG" "$WT/$UI/tests/zz-qa-types-neg.tsx"
  ( cd "$WT/$UI" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec tsc --noEmit ) > "$BASE/tsc.log" 2>&1
  rm -f "$WT/$UI/tests/zz-qa-types.tsx" "$WT/$UI/tests/zz-qa-types-neg.tsx"
  TSC_DONE=1
}
# tscrow <ID> <marker>: "<errors in the valid file> <1 when the case marked <marker> is an error>"
tscrow() {
  tsc_run "$1" || return
  local pos line e
  pos=$(grep -c 'zz-qa-types\.tsx(' "$BASE/tsc.log" || true)
  line=$(grep -n "^// $2\$" "$TYPES_NEG" | cut -d: -f1)
  e=$(grep -c "zz-qa-types-neg\.tsx($((line + 1))," "$BASE/tsc.log" || true)
  echo "$pos $e"
}

# ---- the unit tests of the ticket: one run of the ui-web suite, read by test name -------------------------
UI_RC=""
ui_run() {
  [ -n "$UI_RC" ] && return 0
  need "$1" || return 1
  pnenv -- --filter @toki/ui-web test --reporter=json --outputFile="$BASE/ui.json" > "$BASE/ui.log" 2>&1; UI_RC=$?
  [ -s "$BASE/ui.json" ] || { echo "$1 the test run produced no result (Blocked): $(first_error "$BASE/ui.log")"; UI_RC=""; return 1; }
}
# ut <file> <regex on the full test name>: "passed failed" for the tests that match, from the run at V
ut() { jq -r --arg f "$1" --arg r "$2" '[.testResults[] | select(.name | endswith("/" + $f)) | .assertionResults[] | select(.fullName | test($r))] | "\(map(select(.status == "passed")) | length) \(map(select(.status != "passed")) | length)"' "$BASE/ui.json"; }

# ---- rows that read files of V (each paired with a changed copy of the text held in memory) --------------
# a row is `tNN`: the function name is the lower-case row id
tmpfile() { echo "$BASE/f.$RANDOM.$$"; }
SHELLCSS="$SHELLDIR/shell.css"
t1b() {
  local idx sh ap p
  idx=$(doc "$UI/src/index.ts")
  sh=$(printf '%s\n' "$idx" | grep -cx 'export \* from "./shell";' || true)
  ap=$(printf '%s\n' "$idx" | grep -cx 'export \* from "./appearance";' || true)
  p=$(pathcount "$UI/src/shell" "$UI/src/layout")
  echo "T1B shell-export $sh appearance-export $ap files-at-src/shell ${p% *} files-at-src/layout ${p#* }"
}
t1c() {
  local v ex ctl
  v=$(doc "$UI/package.json" | jq -r '.exports["./utilities.css"] // "none"')
  ex=$(git ls-tree --name-only "$V" -- "$UI/src/styles/utilities.css" | grep -c . || true)
  ctl=$(doc "$UI/package.json" | jq 'del(.exports["./utilities.css"])' | jq -r '.exports["./utilities.css"] // "none"')
  echo "T1C $([ "$v" = ./src/styles/utilities.css ] && echo 1 || echo 0) $ex $([ "$ctl" = none ] && echo 0 || echo 1)"
}
mutrun() { # <key> <file> <perl> <test file under the ui-web package>
  [ -f "$BASE/mut-$1.json" ] && return 0
  mutate "$2" "$3" || { echo "mutation $1 did not apply" > "$BASE/mut-$1.log"; return 1; }
  pnenv -- --filter @toki/ui-web exec vitest run "$4" --reporter=json --outputFile="$BASE/mut-$1.json" > "$BASE/mut-$1.log" 2>&1
  restore "$2"
  [ "$(jq -r '.numTotalTests' "$BASE/mut-$1.json" 2>/dev/null)" -ge 1 ] 2>/dev/null || { rm -f "$BASE/mut-$1.json"; echo "the mutated run ran no test" >> "$BASE/mut-$1.log"; }
}
mfail() { jq -r --arg f "$2" --arg r "$3" '[.testResults[] | select(.name | endswith("/" + $f)) | .assertionResults[] | select(.fullName | test($r)) | select(.status != "passed")] | length' "$BASE/mut-$1.json" 2>/dev/null || echo "-"; }
t1d() {
  ui_run T1D || return
  local f=tests/components/exports.test.ts r="no component export ends in Icon"
  mutrun t1d "$UI/src/components/index.ts" 's/\z/export const ZzIcon = 1;\n/' "$f"
  [ -s "$BASE/mut-t1d.json" ] || { echo "T1D $(ut "$f" "$r") the mutated copy could not be run (Blocked): $(first_error "$BASE/mut-t1d.log")"; return; }
  echo "T1D $(ut "$f" "$r") mutated failed $(mfail t1d "$f" "$r")"
}
t2a() {
  local f n=0 hits ctl p
  : > "$BASE/src.all"
  for f in $(git ls-tree -r --name-only "$V" -- "$SHELLDIR" | grep -E '\.tsx?$'); do doc "$f" >> "$BASE/src.all"; n=$((n + 1)); done
  hits=$(grep -cE '@toki/(i18n|platform|client-core)' "$BASE/src.all" || true)
  ctl=$({ cat "$BASE/src.all"; echo 'import { t } from "@toki/i18n";'; } | grep -cE '@toki/(i18n|platform|client-core)' || true)
  p=$(pathcount "$UI/src/shell" "$UI/src/layout")
  echo "T2A files-at-src/shell ${p% *} files-at-src/layout ${p#* } sources $n imports $hits mutated $ctl"
}
t10a() {
  pw_ready T10A || return
  local p v; p=$(pathcount apps/web/src/shell/sections.ts "$SECTIONS"); set -- $(vals pwb T10A)
  echo "T10A spec-path ${p% *} found-path ${p#* } rows $1 ids-outside $2 paths-outside $3 mutated $4"
}
t15a() {
  local f ok=0 tot=0 sel pair g
  f=$(cssfile "$SHELLCSS"); g=$(cssfile "$SHELLCSS" 's/(\.secbody \{[^}]*?)display: flex;/$1display: block;/')
  for sel in .main .secbody .sb .convs; do for pair in display:flex flex-direction:column min-height:0; do
    tot=$((tot + 1)); [ "$(nodebin "$CSSJS" decl "$f" "$sel" - "${pair%%:*}")" = "${pair#*:}" ] && ok=$((ok + 1))
  done; done
  for sel in .secbody .sb; do tot=$((tot + 1)); [ "$(nodebin "$CSSJS" decl "$f" "$sel" - overflow-y)" = auto ] && ok=$((ok + 1)); done
  local m=0; for sel in .main .secbody .sb .convs; do for pair in display:flex flex-direction:column min-height:0; do
    [ "$(nodebin "$CSSJS" decl "$g" "$sel" - "${pair%%:*}")" = "${pair#*:}" ] && m=$((m + 1)); done; done
  for sel in .secbody .sb; do [ "$(nodebin "$CSSJS" decl "$g" "$sel" - overflow-y)" = auto ] && m=$((m + 1)); done
  echo "T15A $tot $ok mutated $m"
}
t16a() {
  local a b
  a=$(nodebin "$CSSJS" tables "$SPECFILE" CDEFG "$(cssfile "$SHELLCSS")")
  b=$(nodebin "$CSSJS" tables "$SPECFILE" CDEFG "$(cssfile "$SHELLCSS" 's/width: 272px;/width: 273px;/')")
  set -- $b
  echo "T16A $a mutated $3 $4"
}
t16b() {
  local f g allowed bad=0 n=0 m c i c2 i2
  allowed=$'(max-width:719px)\n(min-width:720px)\n(min-width:720px)and(max-width:1099px)\n(min-width:956px)and(max-width:1099px)'
  f=$(cssfile "$SHELLCSS"); nodebin "$CSSJS" medias "$f" > "$BASE/m.txt"
  while read -r m; do case "$m" in containers*|important*) ;; *) n=$((n + 1)); grep -qxF -- "$m" <<< "$allowed" || bad=$((bad + 1));; esac; done < "$BASE/m.txt"
  c=$(grep '^containers' "$BASE/m.txt" | cut -d' ' -f2); i=$(grep '^important' "$BASE/m.txt" | cut -d' ' -f2)
  g=$(cssfile "$SHELLCSS" 's/\z/\n\@container app (max-width: 720px) { .zz { color: red !important; } }\n/'); nodebin "$CSSJS" medias "$g" > "$BASE/m2.txt"
  c2=$(grep '^containers' "$BASE/m2.txt" | cut -d' ' -f2); i2=$(grep '^important' "$BASE/m2.txt" | cut -d' ' -f2)
  echo "T16B conditions $n unlisted $bad container-queries $c important $i mutated $c2 $i2"
}
tokens_names() { doc docs/specs/2026-11-16-tokens-package-design.md | grep '^- R10\.' | grep -oE '`--[a-z0-9-]+`' | tr -d '`' | sort -u > "$BASE/names.txt"; }
t17a() {
  local a b names
  tokens_names; names=$(grep -c . "$BASE/names.txt" || true)
  a=$(nodebin "$CSSJS" names "$BASE/names.txt" "$(cssfile "$SHELLCSS")")
  b=$(nodebin "$CSSJS" names "$BASE/names.txt" "$(cssfile "$SHELLCSS" 's/\z/\n.zz { color: #fff; background: var(--zzz); }\n/')")
  set -- $a; local n=$1 lit=$2 bad=$3 def=$4; set -- $b
  echo "T17A names $names declarations $n literals $lit unknown-vars $bad unknown-properties $def mutated $(($2 - lit)) $(($3 - bad))"
}
t17b() {
  local f a b e
  f=$(cssfile "$SHELLCSS"); a=$(nodebin "$CSSJS" looks "$f"); e=$(grep -c 'data-eff' "$f" || true)
  b=$(nodebin "$CSSJS" looks "$(cssfile "$SHELLCSS" 's/\z/\n[data-look="x"] .zz { color: red; }\n/')")
  echo "T17B $a selectors-naming-data-eff $(b01 "$e") mutated ${b%% *}"
}
t17c() {
  local a b
  a=$(nodebin "$CSSJS" hover "$(cssfile "$SHELLCSS")"); b=$(nodebin "$CSSJS" hover "$(cssfile "$SHELLCSS" 's/\z/\n.zz:hover { opacity: 0; width: 1px; }\n/')")
  set -- $b
  echo "T17C $a mutated $2 $3"
}
t17d() {
  local a b
  a=$(nodebin "$CSSJS" fonts "$SPECFILE" "$(cssfile "$SHELLCSS")")
  b=$(nodebin "$CSSJS" fonts "$SPECFILE" "$(cssfile "$SHELLCSS" 's/font-family: "JetBrains Mono"/font-family: "Zz Mono"/')")
  echo "T17D $a mutated ${b#* }"
}
t24a() {
  local a b other g
  a=$(nodebin "$CSSJS" tabh "$(cssfile "$SHELLCSS")")
  b=$(nodebin "$CSSJS" tabh "$(cssfile "$SHELLCSS" 's/\z/\n.toasts { bottom: calc(var(--tabh) + 14px); }\n/')")
  other=$(git grep -l 'var(--tabh' "$V" -- "$UI/src" apps/web/src | grep -vc "$SHELLCSS" || true)
  set -- $b
  echo "T24A $a other-files $other mutated $3 $4"
}
t26a() {
  local a b
  a=$(nodebin "$CSSJS" tables "$SPECFILE" H "$(cssfile "$UI/src/styles/utilities.css")")
  b=$(nodebin "$CSSJS" tables "$SPECFILE" H "$(cssfile "$UI/src/styles/utilities.css" 's/font-size: 12\.5px/font-size: 13px/')")
  set -- $b
  echo "T26A $a mutated $3 $4"
}
import_order() { # <file text> -> "<base.css before app.css before utilities.css> <all three before the first import of code>"
  awk '/^import / { n++; if ($0 ~ /^import "/) { if ($0 ~ /base\.css/) b = n; if ($0 ~ /app\.css/) a = n; if ($0 ~ /utilities\.css/) u = n } else if (!c) c = n }
    END { print ((b && a && u && b < a && a < u) ? 1 : 0), ((c && u && u < c) ? 1 : 0) }'
}
t26b() {
  local a other swapped
  a=$(doc apps/web/src/main.tsx | import_order)
  other=$(git grep -l 'utilities\.css' "$V" -- "$UI/src" apps/web/src | grep -vc 'apps/web/src/main\.tsx' || true)
  swapped=$(doc apps/web/src/main.tsx | perl -0pe 's/(import "\.\/app\.css";\n)(import "\@toki\/ui-web\/utilities\.css";\n)/$2$1/' | import_order)
  echo "T26B order-and-before-code $a other-importers $other mutated $swapped"
}
t27a() {
  local a b
  a=$(nodebin "$CSSJS" tables "$SPECFILE" I "$(cssfile apps/web/src/app.css)")
  b=$(nodebin "$CSSJS" tables "$SPECFILE" I "$(cssfile apps/web/src/app.css 's/font-size: 15px/font-size: 16px/')")
  set -- $b
  echo "T27A $a mutated $3 $4"
}
t27b() {
  local m a
  doc apps/web/src/main.tsx > "$BASE/main.tsx"
  m=$(awk '/^import / { n++; if ($0 ~ /base\.css/) b = n; if ($0 ~ /app\.css/) a = n; if ($0 !~ /^import "/ && !c) c = n } END { print (a == b + 1 ? 1 : 0), (c && a < c ? 1 : 0) }' "$BASE/main.tsx")
  a=$(perl -0pe 's/(import "\.\/app\.css";\n)(import "\@toki\/ui-web\/utilities\.css";\n)/$2$1/' "$BASE/main.tsx" | awk '/^import / { n++; if ($0 ~ /base\.css/) b = n; if ($0 ~ /app\.css/) a = n } END { print (a == b + 1 ? 1 : 0) }')
  echo "T27B right-after-base-css-and-before-code $m mutated $a"
}
t27c() {
  local tag c w s f
  tag=$(doc apps/web/index.html | tr '\n' ' ' | grep -oE '<meta[^>]*name="viewport"[^>]*>' | head -1)
  c=$(printf '%s' "$tag" | grep -oE 'content="[^"]*"' | head -1)
  parts() { printf '%s' "$1" | grep -c 'width=device-width' | tr -d '\n'; printf ' '; printf '%s' "$1" | grep -c 'initial-scale=1[,"]' | tr -d '\n'; printf ' '; printf '%s' "$1" | grep -c 'viewport-fit=cover' | tr -d '\n'; }
  echo "T27C tag $([ -n "$tag" ] && echo 1 || echo 0) parts $(parts "$c") mutated $(parts "${c/viewport-fit=cover/}")"
}
t28d() {
  local a b
  doc apps/web/src/main.tsx > "$BASE/main.tsx"
  a=$(awk '/applyAppearance\(\{ look: "device" \}\);/ { c = NR } /createRoot\(/ { r = NR } END { print (c ? 1 : 0), (c && r && c < r ? 1 : 0) }' "$BASE/main.tsx")
  b=$(perl -0pe 's/(applyAppearance\(\{ look: "device" \}\);\n)(.*)(createRoot\()/$2$3$1/s' "$BASE/main.tsx" | awk '/applyAppearance\(\{ look: "device" \}\);/ { c = NR } /createRoot\(/ { r = NR } END { print (c && r && c < r ? 1 : 0) }')
  echo "T28D call $a mutated $b"
}
t30b() {
  local deps files cfg ctl
  deps=$(doc apps/web/package.json | grep -cE 'router-plugin|router-vite-plugin|router-generator|router-cli' || true)
  files=$(git ls-tree -r --name-only "$V" -- apps/web | grep -cE '(^|/)(_app\.tsx|routeTree\.gen\.ts)$' || true)
  cfg=$(doc apps/web/vite.config.ts | grep -cE 'tanstackRouter|TanStackRouter|router-plugin|routeTree' || true)
  ctl=$({ doc apps/web/package.json; echo '"@tanstack/router-plugin": "1.0.0"'; } | grep -cE 'router-plugin|router-vite-plugin|router-generator|router-cli' || true)
  echo "T30B dependencies $deps generated-or-app-files $files config-references $cfg mutated $ctl"
}
nav_keys() { sed -n 's/^  \([A-Za-z]*\):.*/\1/p' | sort; }
t31a() {
  local en vi same has cnt m
  doc packages/i18n/src/messages/en/nav.ts | nav_keys > "$BASE/en.keys"; doc packages/i18n/src/messages/vi/nav.ts | nav_keys > "$BASE/vi.keys"
  cnt="$(grep -c . "$BASE/en.keys" || true) $(grep -c . "$BASE/vi.keys" || true)"
  same=$(cmp -s "$BASE/en.keys" "$BASE/vi.keys" && echo 1 || echo 0)
  has=$(grep -cx mainLabel "$BASE/en.keys" || true); has=$((has + $(grep -cx mainLabel "$BASE/vi.keys" || true)))
  m=$(grep -vx mainLabel "$BASE/en.keys" | grep -c . || true)
  echo "T31A keys $cnt same-keys $same mainLabel-in-both $([ "$has" = 2 ] && echo 1 || echo 0) mutated $m"
}
t31e() {
  local f u k
  f=$(doc apps/web/src/routes/app-layout.tsx)
  u=$(printf '%s\n' "$f" | grep -c 'from "@toki/i18n/react"' || true)
  k=$(printf '%s\n' "$f" | grep -cE 't\("nav\.mainLabel"\)|t\("nav\.conversations"\)|t\(row\.labelKey\)' || true)
  echo "T31E useTranslation-import $u t-calls $k mutated $(printf '%s\n' "$f" | grep -v 'useTranslation' | grep -c 'from "@toki/i18n/react"' || true)"
}
t32c() { local p; p=$(pathcount apps/web/src/shell-fixture "$FIXDIR"); echo "T32C files-at-src/shell-fixture ${p% *} files-at-scripts/shell-fixture ${p#* }"; }
t32d() {
  local l f
  l=$(doc apps/web/shell-fixture.html | tr '\n' ' ' | grep -cE '<link[^>]*rel="stylesheet"[^>]*href="/src/fonts/fonts\.css"' || true)
  f=$(git ls-tree --name-only "$V" -- apps/web/src/fonts/fonts.css | grep -c . || true)
  echo "T32D link-to-fonts-css $l fonts-css-file $f"
}
t32e() {
  local o p s ctl m
  m="$FIXDIR/main.tsx"
  o=$(doc "$m" | import_order)
  p=$(doc "$m" | grep -c 'applyAppearance({ look: params.get("look") === "focus" ? "focus" : "calm" })' || true)
  s=$({ doc "$FIXDIR/main.tsx"; doc "$FIXDIR/Fixture.tsx"; } | grep -cE 'localStorage|sessionStorage|indexedDB|document\.cookie' || true)
  ctl=$({ doc "$FIXDIR/main.tsx"; doc "$FIXDIR/Fixture.tsx"; echo 'localStorage.setItem("a", "b");'; } | grep -cE 'localStorage|sessionStorage|indexedDB|document\.cookie' || true)
  echo "T32E import-order-and-before-code $o look-from-address $p storage-references $s mutated $ctl"
}
t33a() {
  local r n=0 w t m
  doc e2e/app-shell.spec.ts > "$BASE/e2e-src.ts"; grep -vE 'test\(`R29\b' "$BASE/e2e-src.ts" > "$BASE/e2e-src2.ts"
  for r in 8 15 18 19 20 21 22 23 27 29; do
    [ "$(grep -cE 'test\(`[^`]*\bR'"$r"'\b' "$BASE/e2e-src.ts" || true)" -ge 1 ] && n=$((n + 1))
  done
  m=0; for r in 8 15 18 19 20 21 22 23 27 29; do
    [ "$(grep -cE 'test\(`[^`]*\bR'"$r"'\b' "$BASE/e2e-src2.ts" || true)" -ge 1 ] && m=$((m + 1))
  done
  w=$(grep -cE '^const WIDTHS = \[360, 719, 720, 800, 956, 1099, 1100, 1400\];' "$BASE/e2e-src.ts" || true)
  t=$(grep -cE '^const TOL = 1;' "$BASE/e2e-src.ts" || true)
  echo "T33A requirements $n widths-line $w tolerance-1px $t mutated $m"
}
t35g() {
  local f n=0 hits ctl
  : > "$BASE/src.all"
  for f in $(git ls-tree -r --name-only "$V" -- "$SHELLDIR" "$UI/src/appearance.ts" | grep -E '\.tsx?$'); do doc "$f" >> "$BASE/src.all"; n=$((n + 1)); done
  hits=$(grep -cE '\b(localStorage|sessionStorage|indexedDB|Notification|serviceWorker|AudioContext|new Audio)\b|<audio' "$BASE/src.all" || true)
  ctl=$({ cat "$BASE/src.all"; echo 'window.localStorage.setItem("a", "b");'; } | grep -cE '\b(localStorage|sessionStorage|indexedDB|Notification|serviceWorker|AudioContext|new Audio)\b|<audio' || true)
  echo "T35G sources $n banned-api-references $hits mutated $ctl"
}
t36b() {
  local u ctl
  u=$(doc apps/web/src/routes/app-layout.tsx | grep -c 'useSession' || true)
  ctl=$({ doc apps/web/src/routes/app-layout.tsx; echo 'const session = useSession();'; } | grep -c 'useSession' || true)
  echo "T36B useSession-in-AppShellRoute $u mutated $ctl"
}

# ---- rows of the unit probes (one line each; `mutated` shows the row's values with its own fault) ---------
defpu() { eval "$(printf '%s' "$1" | tr 'A-Z' 'a-z')() { prow ui $1 ${2:-}; }"; }
defpw() { eval "$(printf '%s' "$1" | tr 'A-Z' 'a-z')() { prow web $1 ${2:-}; }"; }
defpu T2B m; defpu T3A m; defpu T3B m; defpu T4A m; defpu T4B m
defpu T5A m; defpu T5B m; defpu T5C; defpu T5D m
defpu T6A m; defpu T6B m; defpu T6C
defpu T7A m
defpu T8A m; defpu T8B m; defpu T8C m; defpu T8D m
defpu T9A m
defpu T11A m; defpu T11B m
defpu T12A m
defpu T13A m
defpu T14A m; defpu T14B m
defpu T25A
defpu T28A m; defpu T28B m; defpu T28C m
defpu T29A m; defpu T29D m
defpu T34A m; defpu T34B m
defpw T30A m; defpw T30C m; defpw T30D m
defpw T31C m
defpw T36A m; defpw T36C m
t1a() {
  pu_ready T1A || return; tsc_run T1A || return
  set -- $(vals pu T1A); local t; t=$(tscrow T1A E6)
  echo "T1A found $1 of $2 type-errors ${t% *} unknown-type-error ${t#* } mutated found $(vals pum T1A | cut -d' ' -f1)"
}
t3c() { tsc_run T3C || return; local t; t=$(tscrow T3C E1); echo "T3C valid-file-errors ${t% *} panel-without-panelLabel-errors ${t#* }"; }
t5f() { tsc_run T5F || return; local t; t=$(tscrow T5F E5); echo "T5F valid-file-errors ${t% *} unknown-icon-name-errors ${t#* }"; }
t13b() { tsc_run T13B || return; local t; t=$(tscrow T13B E2); echo "T13B valid-file-errors ${t% *} no-aria-label-errors ${t#* }"; }
t34c() { tsc_run T34C || return; local a b; a=$(tscrow T34C E3); b=$(tscrow T34C E4); echo "T34C valid-file-errors ${a% *} SidePanel-ref-errors ${a#* } BottomTabs-ref-errors ${b#* }"; }

# ---- the browser: a Vite dev server of the worktree on a free port, driven by the cached Chromium ----------
WEBPORT=""
web_up() {
  cp "$DRIVER" "$WT/zz-qa-run.mjs"
  WEBPORT=$(freeport)
  ( cd "$WT/apps/web" && exec env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec vite --port "$WEBPORT" --strictPort --host 127.0.0.1 ) > "$BASE/vite.log" 2>&1 &
  local vp=$!; PIDS="$PIDS $vp"; ALLPIDS="$ALLPIDS $vp"
  local i
  for i in $(seq 1 60); do
    curl -s -o /dev/null "http://127.0.0.1:$WEBPORT/shell-fixture.html" && return 0
    kill -0 "$vp" 2>/dev/null || return 1
    sleep 1
  done
  return 1
}
web_down() {
  local p; for p in $PIDS; do kill_tree "$p"; wait "$p" 2>/dev/null; done
  PIDS=""; WEBPORT=""
  rm -f "$WT/zz-qa-run.mjs"
}
bdrive() { # <groups> <name>
  ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node zz-qa-run.mjs "http://127.0.0.1:$WEBPORT" "$1" ) > "$BASE/$2.json" 2> "$BASE/$2.err"
}
# bmut <group> <item>...: one run of a group with the mutations applied to the worktree, then restored
bmut() {
  local g="$1"; shift
  if apply_muts "$@"; then sleep 2; bdrive "$g" "brm-$g"; else echo "the mutations of $g did not apply" > "$BASE/brm-$g.err"; fi
  restore_muts; sleep 2
}
BR_DONE=""
browser_all() {
  [ -n "$BR_DONE" ] && return 0
  need "$1" || return 1
  web_up || { echo "$1 the dev server did not start (Blocked): $(first_error "$BASE/vite.log")"; web_down; return 1; }
  bdrive all br
  bmut g18 "$SHELLCSS|s/(\[data-eff=\"calm\"\] \.sidebar \{\s*width:) 272px/\$1 280px/" "$SHELLCSS|s/(\.sidebar\[data-has-list\] \{\s*width:) 356px/\$1 360px/" "$SHELLDIR/UserCard.tsx|s/size=\{36\}/size={30}/"
  bmut g19 "$SHELLCSS|s/\@media \(min-width: 720px\) and \(max-width: 1099px\)/\@media (min-width: 720px) and (max-width: 719px)/"
  bmut g20 "$SHELLCSS|s/(\.nav-items \{[^}]*?)overflow-y: auto;/\$1overflow-y: visible;/"
  bmut g21 "$SHELLCSS|s/--tabh: calc\(62px/--tabh: calc(30px/" "$SHELLCSS|s/min-height: 48px;/min-height: 30px;/"
  bmut g22 "$SHELLCSS|s/visibility: hidden;//g"
  bmut g23 "$SHELLDIR/AppShell.tsx|s/useToastAvoid\(navRef\);//" "$SHELLCSS|s/margin-right: calc\(var\(--shell-panel\) \+ 12px\)/margin-right: calc(var(--shell-panel) + 40px)/"
  bmut g15 "$SHELLCSS|s/(\.secbody \{[^}]*?)display: flex;/\$1display: block;/"
  bmut g27 "apps/web/src/app.css|s/font-size: 15px;/font-size: 14px;/"
  bmut g29 "$SHELLDIR/AppShell.tsx|s/if \(!narrow\) return;/return;/"
  web_down
  BR_DONE=1
}
# brow <ID> [group of the mutated run]
brow() {
  browser_all "$1" || return
  local e; e=$(jq -r '.error // empty' "$BASE/br.json" 2>/dev/null)
  if [ -n "$e" ] || [ "$(jq -r --arg k "$1" '.[$k] | length' "$BASE/br.json" 2>/dev/null)" -lt 1 ] 2>/dev/null; then
    [ -n "$e" ] || e=$(first_error "$BASE/br.err")
    echo "$1 the browser run produced no result (Blocked): $e"; return
  fi
  if [ -n "${2:-}" ]; then
    [ "$(jq -r --arg k "$1" '.[$k] | length' "$BASE/brm-$2.json" 2>/dev/null)" -ge 1 ] 2>/dev/null || { echo "$1 $(vals br "$1") the mutated copy could not be run (Blocked): $(first_error "$BASE/brm-$2.err")"; return; }
    echo "$1 $(vals br "$1") mutated $(vals "brm-$2" "$1")"
  else
    echo "$1 $(vals br "$1")"
  fi
}
defbr() { eval "$(printf '%s' "$1" | tr 'A-Z' 'a-z')() { brow $1 ${2:-}; }"; }
defbr T5E; defbr T6D; defbr T8E g18; defbr T11C
defbr T15B g15
defbr T18A g18; defbr T18B g18; defbr T18C; defbr T18D; defbr T18E; defbr T18F; defbr T18G
defbr T19A g19; defbr T19B; defbr T19C
defbr T20A g20; defbr T20B; defbr T20C
defbr T21A; defbr T21B g21; defbr T21C; defbr T21D
defbr T22A; defbr T22B g22; defbr T22C
defbr T23A g23; defbr T23B g23; defbr T23C; defbr T23D g23; defbr T23E
defbr T25B; defbr T25C
defbr T27D g27
defbr T29B g29; defbr T29C
defbr T32F; defbr T32G
defbr T36D

# ---- build, size and the fixture's place in the build ----------------------------------------------------
BUILD_DONE=""
build_run() {
  need "$1" || return 1
  [ -n "$BUILD_DONE" ] && return 0
  pnenv -- --filter ./apps/web build > "$BASE/build.log" 2>&1; BUILD_RC=$?
  BUILD_HTML=$(ls "$WT/apps/web/dist/"*.html 2>/dev/null | wc -l | tr -d ' ')
  BUILD_NAMED=$(grep -rlE 'shell-fixture|more-rows' "$WT/apps/web/dist" 2>/dev/null | wc -l | tr -d ' ')
  pnenv -- size > "$BASE/size.log" 2>&1; SIZE_RC=$?
  SIZE_BYTES=$(grep -oE 'size [0-9]+ bytes' "$BASE/size.log" | head -1 | grep -oE '[0-9]+')
  mutate tools/bundle-size/limit.json 's/200000/1000/' && { pnenv -- size > "$BASE/size2.log" 2>&1; SIZE2_RC=$?; restore tools/bundle-size/limit.json; } || SIZE2_RC=x
  BUILD2_RC=x; BUILD2_NAMES=0
  if mutate apps/web/vite.config.ts 's/plugins: \[react\(\)\],/plugins: [react()],\n    build: { rollupOptions: { input: { main: "index.html", fixture: "shell-fixture.html" } } },/'; then
    pnenv -- --filter ./apps/web build > "$BASE/build2.log" 2>&1; BUILD2_RC=$?
    BUILD2_NAMES=$(grep -c 'shell-fixture\.html' "$BASE/build2.log" || true)
    restore apps/web/vite.config.ts
  fi
  BUILD_DONE=1
}
t32a() {
  build_run T32A || return; browser_all T32A || return
  echo "T32A build-exit $BUILD_RC html-files-in-dist $BUILD_HTML dist-files-naming-the-fixture $BUILD_NAMED dev-server-status $(jq -r '.HTTP[0]' "$BASE/br.json" 2>/dev/null)"
}
t32b() {
  build_run T32B || return
  echo "T32B build-exit $BUILD_RC mutated-build-exit $([ "$BUILD2_RC" = x ] && echo x || echo "$([ "$BUILD2_RC" != 0 ] && echo 1 || echo 0)") names-the-file $(b01 "$BUILD2_NAMES")"
}
t35f() { build_run T35F || return; echo "T35F build-exit $BUILD_RC check-no-dev-pages-ok $(grep -c 'check:no-dev-pages: OK' "$BASE/build.log" || true)"; }
t35h() { build_run T35H || return; echo "T35H size-exit $SIZE_RC bytes-under-200000 $([ -n "$SIZE_BYTES" ] && [ "$SIZE_BYTES" -lt 200000 ] && echo 1 || echo 0) mutated-exit $([ "$SIZE2_RC" = x ] && echo x || echo "$([ "$SIZE2_RC" != 0 ] && echo 1 || echo 0)")"; }

# ---- commands of the repository, each with its exit code and a paired faulty copy -------------------------
t35a() {
  need T35A || return
  local rc rc2
  pnenv -- typecheck > "$BASE/t35a.log" 2>&1; rc=$?
  mutate "$SHELLDIR/derivePane.ts" 's/\z/export const zz: number = "a";\n/' || { echo "T35A the mutation did not apply (Blocked)"; return; }
  pnenv -- typecheck > "$BASE/t35a2.log" 2>&1; rc2=$?; restore "$SHELLDIR/derivePane.ts"
  echo "T35A typecheck-exit $rc mutated-exit-is-nonzero $([ "$rc2" != 0 ] && echo 1 || echo 0)"
}
t35c() {
  need T35C || return
  local rc rc2
  pnenv -- lint > "$BASE/t35c.log" 2>&1; rc=$?
  mutate "$SHELLDIR/derivePane.ts" 's/\z/var zz = 1;\n/' || { echo "T35C the mutation did not apply (Blocked)"; return; }
  pnenv -- lint > "$BASE/t35c2.log" 2>&1; rc2=$?; restore "$SHELLDIR/derivePane.ts"
  echo "T35C lint-exit $rc mutated-exit-is-nonzero $([ "$rc2" != 0 ] && echo 1 || echo 0)"
}
t35b() { need T35B || return; pnenv -- lint:boundaries > "$BASE/t35b.log" 2>&1; echo "T35B lint:boundaries-exit $?"; }
t35d() {
  need T35D || return
  local rc rc2
  pnenv -- format:check > "$BASE/t35d.log" 2>&1; rc=$?
  mutate "$SHELLDIR/derivePane.ts" 's/\z/export const   zz  =  1\n/' || { echo "T35D the mutation did not apply (Blocked)"; return; }
  pnenv -- format:check > "$BASE/t35d2.log" 2>&1; rc2=$?; restore "$SHELLDIR/derivePane.ts"
  echo "T35D format-check-exit $rc mutated-exit-is-nonzero $([ "$rc2" != 0 ] && echo 1 || echo 0)"
}
t35e() {
  ui_run T35E || return
  mutrun t35e "$SHELLDIR/derivePane.ts" 's/input\.section === "home"/input.section === "hom"/' tests/layout/derivePane.test.ts
  [ -s "$BASE/mut-t35e.json" ] || { echo "T35E the mutated copy could not be run (Blocked)"; return; }
  echo "T35E ui-web-tests-exit $UI_RC passed $(jq -r '.numPassedTests' "$BASE/ui.json") failed $(jq -r '.numFailedTests' "$BASE/ui.json") mutated failed-is-above-0 $(b01 "$(jq -r '.numFailedTests' "$BASE/mut-t35e.json")")"
}
t31b() {
  need T31B || return
  local rc rc2
  pnenv -- --filter @toki/i18n check > "$BASE/i18n.log" 2>&1; rc=$?
  local ok; ok=$(grep -c 'no problem' "$BASE/i18n.log" || true)
  mutate packages/i18n/src/messages/vi/nav.ts 's/\n  mainLabel: [^\n]*//' || { echo "T31B the mutation did not apply (Blocked)"; return; }
  pnenv -- --filter @toki/i18n check > "$BASE/i18n2.log" 2>&1; rc2=$?; restore packages/i18n/src/messages/vi/nav.ts
  echo "T31B check-exit $rc no-problem-line $ok mutated-exit-is-nonzero $([ "$rc2" != 0 ] && echo 1 || echo 0)"
}

# ---- the ticket's own browser test: ports 5173 and 3000 must be free ------------------------------------
need_e2e() { need "$1" || return 1; local p; for p in 5173 3000; do [ "$(portbusy $p)" = free ] || { echo "$1 port $p is busy (Blocked)"; return 1; }; done; }
E2E_DONE=""; E2E_RC=""
e2e_run() {
  [ -n "$E2E_DONE" ] && return 0
  need_e2e "$1" || return 1
  PLAYWRIGHT_JSON_OUTPUT_NAME="$BASE/pw.json" pnenv PLAYWRIGHT_JSON_OUTPUT_NAME="$BASE/pw.json" -- test:e2e --reporter=json > "$BASE/e2e.log" 2>&1; E2E_RC=$?
  E2E_DONE=1
  [ -s "$BASE/pw.json" ] || { echo "$1 the Playwright run produced no result (Blocked): $(grep -m1 -iE 'error|executable' "$BASE/e2e.log" | cut -c1-120)"; E2E_DONE=""; return 1; }
}
pwcount() { jq -r --arg f "$1" '[.. | objects | select(has("specs")) | .specs[] | select(.file | endswith($f))] | "\(map(select(.ok == true)) | length) \(map(select(.ok != true)) | length)"' "$BASE/${2:-pw}.json"; }
t33b() {
  e2e_run T33B || return
  set -- $(pwcount app-shell.spec.ts)
  echo "T33B app-shell-passed $1 failed $2"
}
t33c() {
  e2e_run T33C || return
  need_e2e T33C || return
  mutate "$SHELLCSS" 's/(\[data-eff="calm"\] \.sidebar \{\s*width:) 272px/$1 280px/' || { echo "T33C the mutation did not apply (Blocked)"; return; }
  PLAYWRIGHT_JSON_OUTPUT_NAME="$BASE/pw2.json" pnenv PLAYWRIGHT_JSON_OUTPUT_NAME="$BASE/pw2.json" -- exec playwright test e2e/app-shell.spec.ts -g "calm layout at 1100" --reporter=json > "$BASE/e2e2.log" 2>&1
  restore "$SHELLCSS"
  [ -s "$BASE/pw2.json" ] || { echo "T33C the mutated run produced no result (Blocked)"; return; }
  set -- $(pwcount app-shell.spec.ts pw); local a=$2; set -- $(pwcount app-shell.spec.ts pw2)
  echo "T33C unchanged-failed $a changed-table-value-failed-is-above-0 $(b01 "$2")"
}
t35i() {
  e2e_run T35I || return
  echo "T35I test:e2e-exit $E2E_RC passed $(jq -r '[.. | objects | select(has("specs")) | .specs[] | select(.ok == true)] | length' "$BASE/pw.json") failed $(jq -r '[.. | objects | select(has("specs")) | .specs[] | select(.ok != true)] | length' "$BASE/pw.json")"
}

# ---- manual rows: Blocked until the QA pastes the result ------------------------------------------------
manual() { echo "$1 manual row (Blocked): $2"; }
t18m() { manual T18M "the QA compares the shell with the prototype by eye (Calm and Focus, six widths, home and a panel open) and pastes the result"; }
t29m() { manual T29M "the QA runs the screen reader and keyboard pass on the fixture and pastes the result"; }

# ---- the fixture for the manual rows (not a row) ---------------------------------------------------------
serve_fixture() {
  need serve || return
  WEBPORT=$(freeport)
  ( cd "$WT/apps/web" && exec env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec vite --port "$WEBPORT" --strictPort --host 127.0.0.1 ) > "$BASE/vite.log" 2>&1 &
  PIDS="$PIDS $!"; ALLPIDS="$ALLPIDS $!"
  sleep 3
  echo "fixture for the manual rows: http://127.0.0.1:$WEBPORT/shell-fixture.html?look=calm (add look=focus, panel=1, section=activity, pane=list|main|side, role=member, toasts=1)"
  echo "the prototype is e2e/prototype/index.html on main; open it in a second window of the same size"
  read -r -p "press Enter to stop " _
}

rows="${*:-T1A T1B T1C T1D T2A T2B T3A T3B T3C T4A T4B T5A T5B T5C T5D T5E T5F T6A T6B T6C T6D T7A T8A T8B T8C T8D T8E T9A T10A T11A T11B T11C T12A T13A T13B T14A T14B T15A T15B T16A T16B T17A T17B T17C T17D T18A T18B T18C T18D T18E T18F T18G T18M T19A T19B T19C T20A T20B T20C T21A T21B T21C T21D T22A T22B T22C T23A T23B T23C T23D T23E T24A T25A T25B T25C T26A T26B T27A T27B T27C T27D T28A T28B T28C T28D T29A T29B T29C T29D T29M T30A T30B T30C T30D T31A T31B T31C T31E T32A T32B T32C T32D T32E T32F T32G T33A T33B T33C T34A T34B T34C T35A T35B T35C T35D T35E T35F T35G T35H T35I T36A T36B T36C T36D}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'A-Z' 'a-z')
  if [ "$fn" = serve ]; then serve_fixture
  elif declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
cleanup; WT=""
alive=0
for p in $ALLPIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
echo "CLEAN worktrees $([ "$(git worktree list | grep -c "$(basename "$BASE")" || true)" = 0 ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive temporary-folder $([ -e "$BASE" ] && echo left || echo removed)"
