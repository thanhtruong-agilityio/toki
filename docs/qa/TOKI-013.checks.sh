#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-013.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile`. It writes nothing to GitHub and opens no pull request.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-013.checks.sh [T1A T2A ...]
# It reads files of the commit V with `git show`. Rows that run a tool use ONE temporary worktree of V,
# created on first use, with `pnpm install --frozen-lockfile` run there; the unit tests of `ui-web`, the
# TypeScript compiler, ESLint and Prettier run in it, and a Vite dev server on a free loopback port with
# the cached Chromium driven by Playwright serves the browser rows. The temporary page those rows need (a
# flex-column parent with an EmptyState; a test composer, bar and sidebar with three toasts), the probes
# and the driver exist only inside the temporary worktree and are deleted after use. Rows that change a
# file of the worktree restore it afterwards and are paired with the unchanged run; rows that read
# files only are paired with a changed copy of the text held in memory. No `.env` file is read or
# created: the worktree has none. Every temporary file lives under one folder made in the current shell
# (BASE, exported as TMPDIR and given to every process it starts) which the cleanup removes. It prints
# one line for each row: counts, exit codes and words; no tool output and no secret. The last line
# `CLEAN worktrees same ...` says that no worktree made by the script is left (other worktrees of the
# repository may come and go while it runs), that `git status` is as it was, that no process it started
# is alive and that the temporary folder is removed. A row that cannot
# be shown prints `Blocked` and the reason. The manual rows print `Blocked` until the QA pastes a result.
# `V=<commit> bash docs/qa/TOKI-013.checks.sh serve` starts the review page for the manual rows and waits
# for the Enter key; it is not a row and prints no evidence.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
P="packages/ui-web/src/components"
FOLDERS="Avatar PresenceDot EmptyState Toast"
TESTS="$P/Avatar/Avatar.test.tsx $P/PresenceDot/PresenceDot.test.tsx $P/EmptyState/EmptyState.test.tsx $P/Toast/Toast.test.tsx"
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
first_error() { grep -m1 -iE 'error|cannot|failed' "$1" 2>/dev/null | cut -c1-120; }

# ---- the CSS reader: a small parser, so a row reads declarations and not text ---------------------
CSSJS="$BASE/css.mjs"
cat > "$CSSJS" <<'JS'
import fs from "node:fs";
const norm = (v) => v.replace(/\s+/g, "").replace(/(^|[^\d])\.(\d)/g, "$10.$2");
function split(text) {
  const out = []; let depth = 0, q = "", cur = "";
  for (const ch of text) {
    if (q) { if (ch === q) q = ""; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}
function decls(body) {
  const d = {};
  for (const s of split(body)) { const i = s.indexOf(":"); if (i > 0) d[s.slice(0, i).trim()] = norm(s.slice(i + 1)); }
  return d;
}
function parse(text, ctx) {
  const rules = []; let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i); if (open < 0) break;
    const head = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < text.length && depth > 0) { if (text[j] === "{") depth++; else if (text[j] === "}") depth--; j++; }
    const body = text.slice(open + 1, j - 1);
    if (head.startsWith("@")) rules.push(...parse(body, head.replace(/\s+/g, "")));
    else rules.push({ selector: head.replace(/\s+/g, " "), media: ctx, decls: decls(body) });
    i = j;
  }
  return rules;
}
const read = (f) => parse(fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""), "");
const [mode, ...args] = process.argv.slice(2);
if (mode === "check") {
  // check <file> <selector> <media or -> <expected declarations>
  const [file, sel, media, expected] = args;
  const want = decls(expected);
  const have = {};
  for (const r of read(file)) if (r.selector === sel && r.media === (media === "-" ? "" : media)) Object.assign(have, r.decls);
  let matched = 0, off = 0;
  for (const k of Object.keys(want)) { if (have[k] === want[k]) matched++; else off++; }
  for (const k of Object.keys(have)) if (!(k in want)) off++;
  console.log(`${matched} ${off}`);
} else if (mode === "medias") {
  // medias <file>: the number of @media blocks and of rules in them
  const m = read(args[0]).filter((r) => r.media.startsWith("@media"));
  console.log(`${new Set(m.map((r) => r.media)).size} ${m.length}`);
} else if (mode === "scan") {
  // scan <allowed names file> <inject 0|1> <css files...>: declarations, colour literals, bad names
  const [allowedFile, inject, ...files] = args;
  const allowed = new Set(fs.readFileSync(allowedFile, "utf8").split(/\s+/).filter(Boolean));
  allowed.add("--h"); allowed.add("--s");
  let n = 0, lit = 0, bad = 0;
  const all = files.flatMap(read);
  if (inject === "1") all.push({ selector: ".zz", media: "", decls: { color: "#fff", background: "var(--zzz)" } });
  for (const r of all) for (const [p, v] of Object.entries(r.decls)) {
    n++;
    if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(\d/.test(v)) lit++;
    if (p.startsWith("--") && !allowed.has(p)) bad++;
    for (const m of v.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) if (!allowed.has(m[1])) bad++;
  }
  console.log(`${n} ${lit} ${bad}`);
} else if (mode === "looks") {
  // looks <inject 0|1> <css files...>: rules whose selector names a look, density or accent attribute
  const [inject, ...files] = args;
  const all = files.flatMap(read);
  if (inject === "1") all.push({ selector: "[data-look] .zz", media: "", decls: {} });
  const hit = all.filter((r) => /data-(eff|look|accent|density)/.test(r.selector)).map((r) => r.selector);
  console.log(`${hit.length} ${hit[0] === '[data-eff="focus"] .toast button' ? 1 : 0}`);
} else if (mode === "forbid") {
  // forbid <inject 0|1> <css files...>: declarations that would cut a text
  const [inject, ...files] = args;
  const all = files.flatMap(read);
  if (inject === "1") all.push({ selector: ".toast", media: "", decls: { "white-space": "nowrap" } });
  let n = 0, bad = 0;
  for (const r of all) for (const [p, v] of Object.entries(r.decls)) {
    n++;
    if (["overflow", "overflow-x", "text-overflow", "-webkit-line-clamp", "max-height"].includes(p) || (p === "white-space" && /nowrap/.test(v))) bad++;
  }
  console.log(`${n} ${bad}`);
}
JS
# csschk <file at V> <selector> <media or -> <expected> [perl substitution applied in memory first]
csschk() {
  local f="$BASE/c.$$.css"
  if [ -n "${5:-}" ]; then doc "$1" | perl -0pe "$5" > "$f"; else doc "$1" > "$f"; fi
  nodebin "$CSSJS" check "$f" "$2" "$3" "$4"
}
# off <output of csschk>: the number of differences
offof() { echo "${1#* }"; }

# ---- the probe: a Vitest file written into the worktree, run, and deleted ----------------------
write_probe() { cat > "$WT/packages/ui-web/src/zz-qa-probe.test.tsx" <<'TSX'
import { act, cleanup, render } from "@testing-library/react";
import { writeFileSync } from "node:fs";
import { createRef, type CSSProperties, type ReactElement } from "react";
import { test, vi } from "vitest";
import * as ui from "./index";
import { componentExamples } from "./examples";

const { Avatar, PresenceDot, EmptyState, Toast, ToastProvider, ToastRegion, getInitials, presenceStates } = ui;
const out: Record<string, number[]> = {};
const n = (x: boolean) => (x ? 1 : 0);
const mount = (el: ReactElement): HTMLElement => {
  cleanup();
  return render(el).container;
};
const root = (c: HTMLElement) => c.firstElementChild as HTMLElement;
const step = (key: string, fn: () => number[]) => {
  try {
    out[key] = fn();
  } catch {
    out[key] = [-1];
  }
};
const cast = (o: Record<string, unknown>) => o as unknown as object;
const safe = (s: string) => {
  try {
    return getInitials(s);
  } catch {
    return "THROW";
  }
};

test("probe", () => {
  const names15 = ["Avatar", "getInitials", "PresenceDot", "presenceStates", "EmptyState", "Toast", "ToastProvider", "ToastRegion", "useToasts", "useToastAvoid", "useToastAnchor", "computeToastBottom", "computeToastExtent", "TOAST_MS_WITH_ACTION", "TOAST_MS_PLAIN"];
  step("T2A", () => {
    const have = names15.filter((k) => (ui as Record<string, unknown>)[k] !== undefined).length;
    return [have, names15.length - have];
  });
  step("T3C", () => {
    const empties = [
      <Avatar name="" hue={0} />,
      <PresenceDot state="active" />,
      <EmptyState icon="users" title="" description="" />,
      <Toast text="" />,
      <ToastProvider />,
    ].map((el) => mount(el).textContent === "");
    return [empties.filter(Boolean).length, n(mount(<Toast text="x" />).textContent !== "")];
  });
  step("T4B", () => {
    const ok: boolean[] = [];
    const a = createRef<HTMLSpanElement>();
    let c = mount(<Avatar ref={a} name="Lan Nguyễn" hue={1} />);
    ok.push(a.current !== null && a.current === c.querySelector(".av"));
    const b = createRef<HTMLSpanElement>();
    c = mount(<Avatar ref={b} name="Lan Nguyễn" hue={1} presence="away" />);
    ok.push(b.current !== null && b.current === c.querySelector(".pdw"));
    const d = createRef<HTMLSpanElement>();
    c = mount(<PresenceDot ref={d} state="dnd" />);
    ok.push(d.current !== null && d.current === c.querySelector(".pd"));
    const e = createRef<HTMLDivElement>();
    c = mount(<EmptyState ref={e} icon="users" title="t" description="d" />);
    ok.push(e.current !== null && e.current === c.querySelector(".empty"));
    const f = createRef<HTMLDivElement>();
    c = mount(<Toast ref={f} text="t" />);
    ok.push(f.current !== null && f.current === c.querySelector(".toast"));
    const g = createRef<HTMLDivElement>();
    c = mount(<ToastProvider><ToastRegion ref={g} /></ToastProvider>);
    ok.push(g.current !== null && g.current.classList.contains("toasts") && g.current === c.querySelectorAll(".toasts")[0]);
    return [ok.filter(Boolean).length, ok.length];
  });
  step("T4C", () => {
    const extra = { className: "extra", "data-testid": "t" };
    const cases: Array<[ReactElement, string, (c: HTMLElement) => HTMLElement]> = [
      [<Avatar name="a" hue={1} {...extra} />, "av extra", root],
      [<Avatar name="a" hue={1} presence="away" {...extra} />, "pdw extra", root],
      [<PresenceDot state="active" {...extra} />, "pd extra", root],
      [<EmptyState icon="users" title="t" description="d" {...extra} />, "empty extra", root],
      [<Toast text="t" {...extra} />, "toast extra", root],
      [<ToastProvider><ToastRegion {...extra} /></ToastProvider>, "toasts extra", (c) => c.querySelectorAll(".toasts")[0] as HTMLElement],
    ];
    let cls = 0, attr = 0;
    for (const [el, want, pick] of cases) {
      const r = pick(mount(el));
      if (r.className === want) cls++;
      if (r.getAttribute("data-testid") === "t") attr++;
    }
    return [cls, attr];
  });
  step("T4D", () => {
    const ok: boolean[] = [];
    const hidden = cast({ "aria-hidden": "false" });
    ok.push(root(mount(<Avatar name="a" hue={1} {...hidden} />)).getAttribute("aria-hidden") === "true");
    ok.push(mount(<Avatar name="a" hue={1} presence="away" {...hidden} />).querySelector(".av")!.getAttribute("aria-hidden") === "true");
    const bad = cast({ "aria-hidden": "false", role: "button", "aria-label": "x" });
    let d = root(mount(<PresenceDot state="active" {...bad} />));
    ok.push(d.getAttribute("aria-hidden") === "true" && !d.hasAttribute("role") && !d.hasAttribute("aria-label"));
    d = root(mount(<PresenceDot state="active" label="Active" {...bad} />));
    ok.push(d.getAttribute("role") === "img" && d.getAttribute("aria-label") === "Active" && !d.hasAttribute("aria-hidden"));
    const role = cast({ role: "alert" });
    ok.push(!root(mount(<EmptyState icon="users" title="t" description="d" {...role} />)).hasAttribute("role"));
    ok.push(root(mount(<EmptyState icon="users" title="t" description="d" filtered {...role} />)).getAttribute("role") === "status");
    ok.push(!root(mount(<Toast text="t" {...role} />)).hasAttribute("role"));
    const live = cast({ "aria-live": "off" });
    ok.push(mount(<ToastProvider><ToastRegion {...live} /></ToastProvider>).querySelectorAll(".toasts")[0]!.getAttribute("aria-live") === "polite");
    return [ok.filter(Boolean).length, ok.length];
  });
  step("T6A", () => {
    const c = mount(<Avatar name="Lan Nguyễn" hue={172} />);
    const el = root(c);
    return [c.querySelectorAll("span").length, n(el.tagName === "SPAN" && c.children.length === 1), n(el.className === "av"), n(el.getAttribute("aria-hidden") === "true"), n(el.style.getPropertyValue("--h") === "172"), n(el.textContent === "LN"), n(el.childNodes.length === 1 && el.firstChild?.nodeType === 3)];
  });
  step("T6B", () => {
    const a = root(mount(<Avatar name="Lan" hue={1} size={46} />));
    const b = root(mount(<Avatar name="Lan" hue={1} />));
    return [n(a.style.getPropertyValue("--s") === "46px"), n(b.style.getPropertyValue("--s") === "")];
  });
  step("T6C", () => {
    const bad = cast({ "aria-label": "x", "aria-labelledby": "y", title: "z" });
    const gone = (el: HTMLElement) => ["aria-label", "aria-labelledby", "title"].filter((a) => !el.hasAttribute(a)).length;
    return [gone(root(mount(<Avatar name="a" hue={1} {...bad} />))), gone(root(mount(<Avatar name="a" hue={1} presence="away" {...bad} />)))];
  });
  step("T6E", () => {
    const style = { margin: "2px", "--h": "1" } as CSSProperties;
    const a = root(mount(<Avatar name="a" hue={172} style={style} />));
    const c = mount(<Avatar name="a" hue={172} presence="away" style={style} />);
    return [n(a.style.margin === "2px"), n(a.style.getPropertyValue("--h") === "172"), n(root(c).style.margin === "2px"), n((c.querySelector(".av") as HTMLElement).style.getPropertyValue("--h") === "172")];
  });
  step("T6F", () => {
    const ref = createRef<HTMLSpanElement>();
    const c = mount(<Avatar ref={ref} name="a" hue={1} />);
    return [n(ref.current === root(c))];
  });
  step("T7A", () => {
    const pairs: Array<[string, string]> = [["Lan Nguyễn", "LN"], ["Khoa Đỗ", "KĐ"], ["Toki Automations", "TA"], ["Minh Trần Quang", "MQ"], ["ß Test", "ST"]];
    return [pairs.filter(([a, b]) => safe(a) === b).length];
  });
  step("T7B", () => {
    const input = "Ông Ba";
    return [n(input.codePointAt(0) === 0x4f), n(safe(input) === "ÔB")];
  });
  step("T7C", () => [n(safe("Lan") === "L")]);
  step("T7D", () => {
    const empties = ["", "   ", "\t\n "].filter((s) => safe(s) === "").length;
    const throws = ["", "  ", "\uD800", "😀", "123", "(x)", "  "].filter((s) => safe(s) === "THROW").length;
    return [empties, throws];
  });
  step("T7E", () => {
    const ws = ["  Lan   Nguyễn ", "Lan  Nguyễn", "\tLan\nNguyễn\t"].filter((s) => safe(s) === "LN").length;
    return [ws, n(safe("\u{1D49C}b Cd") === "\u{1D49C}C")];
  });
  step("T8A", () => {
    const cases: Array<[number, string]> = [[-30, "330"], [360, "0"], [725, "5"], [Number.NaN, "0"], [Number.POSITIVE_INFINITY, "0"]];
    return [cases.filter(([h, w]) => root(mount(<Avatar name="a" hue={h} />)).style.getPropertyValue("--h") === w).length];
  });
  step("T8B", () => {
    const none = [0, -4, Number.NaN, Number.POSITIVE_INFINITY, "abc" as unknown as number].filter((s) => root(mount(<Avatar name="a" hue={1} size={s} />)).style.getPropertyValue("--s") === "").length;
    return [none, n(root(mount(<Avatar name="a" hue={1} size={12.5} />)).style.getPropertyValue("--s") === "12.5px")];
  });
  step("T10A", () => {
    const c = mount(<Avatar name="Lan Nguyễn" hue={172} presence="away" />);
    const w = root(c);
    const kids = [...w.children] as HTMLElement[];
    return [n(c.children.length === 1 && w.tagName === "SPAN" && w.className === "pdw"), n(kids[0]?.className === "av" && kids[0].getAttribute("aria-hidden") === "true" && kids[0].textContent === "LN"), n(kids[1]?.className === "pd away"), kids.length];
  });
  step("T10B", () => {
    const ref = createRef<HTMLSpanElement>();
    const c = mount(<Avatar ref={ref} name="Lan" hue={172} size={46} presence="dnd" className="x" style={{ margin: "2px" }} data-k="1" />);
    const w = root(c);
    const av = c.querySelector(".av") as HTMLElement;
    return [n(w.className === "pdw x"), n(w.style.margin === "2px"), n(ref.current === w), n(w.getAttribute("data-k") === "1"), n(av.style.getPropertyValue("--h") === "172"), n(av.style.getPropertyValue("--s") === "46px"), n(av.className === "av" && !av.hasAttribute("data-k"))];
  });
  step("T10C", () => {
    const c = mount(<Avatar name="Lan" hue={1} />);
    return [c.querySelectorAll(".pdw").length, c.querySelectorAll(".pd").length, n(root(c).className === "av")];
  });
  step("T10E", () => {
    const dot = mount(<Avatar name="Lan" hue={1} presence="away" />).querySelector(".pd")!;
    return [n(dot.getAttribute("aria-hidden") === "true"), n(!dot.hasAttribute("aria-label") && !dot.hasAttribute("role"))];
  });
  step("T11", () => [n(JSON.stringify(presenceStates) === '["active","away","dnd"]'), presenceStates.length, n((presenceStates as readonly string[]).includes("meet")), n((presenceStates as readonly string[]).includes("offline"))]);
  step("T12A", () => {
    const cls = (state: "active" | "away" | "dnd") => root(mount(<PresenceDot state={state} />));
    const a = cls("active"), b = cls("away"), c = cls("dnd");
    return [n(a.tagName === "SPAN" && a.className === "pd") + n(b.className === "pd away") + n(c.className === "pd dnd")];
  });
  step("T14A", () => {
    const d = root(mount(<PresenceDot state="away" label="Away" />));
    return [n(d.getAttribute("role") === "img"), n(d.getAttribute("aria-label") === "Away"), n(!d.hasAttribute("aria-hidden"))];
  });
  step("T14B", () => {
    const d = root(mount(<PresenceDot state="away" />));
    return [n(d.getAttribute("aria-hidden") === "true"), n(!d.hasAttribute("role")), n(!d.hasAttribute("aria-label"))];
  });
  step("T14C", () => {
    const dot = mount(<Avatar name="Lan" hue={1} presence="away" presenceLabel="Away" />).querySelector(".pd")!;
    return [n(dot.getAttribute("role") === "img"), n(dot.getAttribute("aria-label") === "Away")];
  });
  step("T15A", () => {
    const c = mount(<EmptyState icon="users" title="Nobody matches" description="Try a name or a job title." action={<button type="button">Open</button>} />);
    const el = root(c);
    const kids = [...el.children] as HTMLElement[];
    return [n(el.tagName === "DIV" && el.className === "empty"), n(kids.map((k) => k.tagName).join(" ") === "DIV B SPAN BUTTON"), n(kids[0]?.className === "eic" && kids[0].querySelector("svg") !== null), n(kids[1]?.textContent === "Nobody matches"), n(kids[2]?.textContent === "Try a name or a job title."), n(kids[3]?.textContent === "Open")];
  });
  step("T15B", () => {
    const eic = root(mount(<EmptyState icon="users" title="t" description="d" />)).querySelector(".eic") as HTMLElement;
    const svg = eic.querySelector("svg")!;
    const icon = mount(<ui.Icon name="users" size={26} />).innerHTML;
    return [n(svg.getAttribute("width") === "26"), n(svg.getAttribute("height") === "26"), n(eic.innerHTML === icon)];
  });
  step("T15C", () => [n(root(mount(<EmptyState icon="users" title="t" description="d" filtered />)).getAttribute("role") === "status"), n(!root(mount(<EmptyState icon="users" title="t" description="d" />)).hasAttribute("role"))]);
  step("T15E", () => {
    const el = root(mount(<EmptyState icon="users" title="t" description="d" />));
    return [el.children.length, n(el.lastElementChild?.tagName === "SPAN"), n(el.querySelector("b") !== null && el.querySelector("h1,h2,h3,h4,h5,h6") === null)];
  });
  step("T18A", () => {
    const el = root(mount(<EmptyState icon="users" title="" description="" />));
    return [n(el.textContent === ""), el.querySelectorAll("button").length];
  });
  step("T18C", () => {
    const ref = createRef<HTMLDivElement>();
    const c = mount(<EmptyState ref={ref} icon="users" title="t" description="d" />);
    return [n(ref.current === c.querySelector("div.empty") && ref.current !== null)];
  });
  step("T18D", () => {
    const role = cast({ role: "alert" });
    return [n(!root(mount(<EmptyState icon="users" title="t" description="d" {...role} />)).hasAttribute("role")), n(root(mount(<EmptyState icon="users" title="t" description="d" filtered {...role} />)).getAttribute("role") === "status")];
  });
  step("T19A", () => {
    const c = mount(<Toast text="Left #design" />);
    const el = root(c);
    return [n(el.tagName === "DIV" && el.className === "toast"), el.children.length, n(el.firstElementChild?.tagName === "SPAN" && el.firstElementChild.textContent === "Left #design"), n(!el.hasAttribute("role"))];
  });
  step("T19B", () => {
    const el = root(mount(<Toast text="Left #design" action={{ label: "Undo", onPress() {} }} />));
    const kids = [...el.children] as HTMLElement[];
    return [n(kids.map((k) => k.tagName).join(" ") === "SPAN BUTTON"), n(kids[1]?.getAttribute("type") === "button"), n(kids[1]?.textContent === "Undo")];
  });
  step("T19C", () => {
    vi.useFakeTimers();
    const c = mount(<Toast text="x" />);
    act(() => void vi.advanceTimersByTime(60000));
    const still = n(c.querySelector(".toast") !== null);
    const timers = vi.getTimerCount();
    vi.useRealTimers();
    return [still, timers];
  });
  const entry = (name: string) => componentExamples.find((e) => e.component === name)?.examples ?? [];
  const all = (name: string) => mount(<>{entry(name).map((e) => <div key={e.id}>{e.element}</div>)}</>);
  step("T30A", () => {
    const c = all("Avatar");
    const sizes = [...c.querySelectorAll<HTMLElement>(".av")].map((a) => a.style.getPropertyValue("--s"));
    const words = entry("Avatar").map((e) => ((e.element.props as { name: string }).name).trim().split(/\s+/).length);
    const pres = [".pdw .pd:not(.away):not(.dnd)", ".pdw .pd.away", ".pdw .pd.dnd"].filter((s) => c.querySelector(s) !== null).length;
    return [["", "46px", "18px", "24px", "30px", "64px"].filter((s) => sizes.includes(s)).length, pres, n(words.some((w) => w === 1)), n(words.some((w) => w >= 3))];
  });
  step("T30B", () => {
    const c = all("PresenceDot");
    return [c.querySelectorAll(".pd").length, c.querySelectorAll(".pd.away").length, c.querySelectorAll(".pd.dnd").length, c.querySelectorAll('.pd[role="img"]').length, c.querySelectorAll('.pd[aria-hidden="true"]').length];
  });
  step("T30C", () => {
    const e = [...all("EmptyState").querySelectorAll(".empty")];
    return [n(e.some((x) => x.querySelector(".btn") !== null)), n(e.some((x) => x.querySelector(".btn") === null))];
  });
  step("T30D", () => {
    const t = [...all("Toast").querySelectorAll(".toast")];
    return [n(t.some((x) => x.querySelector("button") === null)), n(t.some((x) => x.querySelector("button") !== null)), n(t.some((x) => (x.textContent ?? "").length > 80))];
  });
  step("T30E", () => {
    const unique = ["Avatar", "PresenceDot", "EmptyState", "Toast"].filter((name) => {
      const ids = entry(name).map((e) => e.id);
      return ids.length > 0 && new Set(ids).size === ids.length;
    }).length;
    return [unique, n(componentExamples.slice(8).map((e) => e.component).join(",") === "Avatar,PresenceDot,EmptyState,Toast"), componentExamples.length];
  });
  step("T27P", () => {
    const f = ui.computeToastBottom;
    const o = (top: number, left = 0, right = 100) => ({ top, left, right });
    const ok = [
      f(800, []) === 20,
      f(800, [o(738)]) === 76,
      f(800, [o(700), o(650)]) === 164,
      f(800, [o(800)]) === 20 && f(800, [o(900)]) === 20,
      f(800, [o(Number.NaN)]) === 20,
      f(800, [o(700, 10, 10)]) === 20,
      f(800, [o(790)]) === 24 && f(800, [o(799)]) === 20,
      f(800, [o(700, 0, 100)], { left: 100, right: 200 }) === 20,
      f(800, [o(700, 0, 100)], { left: 99, right: 200 }) === 114,
      f(800, [o(700, 0, 100)]) === 114,
    ];
    return [ok.filter(Boolean).length, ok.length];
  });
  step("T31P", () => {
    const f = ui.computeToastExtent;
    const a = f(360), b = f(1000), c = f(1000, { left: 100, right: 400 });
    const ok = [Math.abs(a.width - 331.2) < 1e-9, Math.abs(a.left - 14.4) < 1e-9, b.width === 480 && b.left === 260, c.width === 276 && c.left === 112];
    return [ok.filter(Boolean).length, ok.length];
  });
  writeFileSync(process.env.QA_OUT as string, JSON.stringify(out));
});
TSX
}
PROBE_RC=""
probe_run() { # $1 name of the result; writes $BASE/$1.json
  write_probe
  pnenv QA_OUT="$BASE/$1.json" -- --filter @toki/ui-web exec vitest run src/zz-qa-probe.test.tsx > "$BASE/$1.log" 2>&1; PROBE_RC=$?
  rm -f "$WT/packages/ui-web/src/zz-qa-probe.test.tsx"
}
probe_ok() { # $1 row id: the main probe ran and has this key
  need "$1" || return 1
  [ -f "$BASE/probe.json" ] || probe_run probe
  [ -f "$BASE/probe.json" ] || { echo "$1 the probe produced no result (Blocked): $(first_error "$BASE/probe.log")"; return 1; }
  [ "$(jq -r --arg k "$1" '.[$k] | length' "$BASE/probe.json" 2>/dev/null)" -ge 1 ] 2>/dev/null || { echo "$1 the probe has no result for this row (Blocked)"; return 1; }
}
pv() { jq -r --arg k "$1" '.[$k] | map(tostring) | join(" ")' "$BASE/probe.json"; } # the values of a row
# mutated probe: pmut <name> <file> <perl>; leaves $BASE/<name>.json, restores the file
pmut() {
  [ -f "$BASE/$1.json" ] && return 0
  mutate "$2" "$3" || { echo "mutation $1 did not apply" > "$BASE/$1.log"; return 1; }
  probe_run "$1"; restore "$2"
}
mv_() { jq -r --arg k "$2" --argjson i "$3" '.[$k][$i]' "$BASE/$1.json" 2>/dev/null; } # a value of a mutated probe row

# ---- the unit tests of the ticket: one run, read by test name ---------------------------------
UI_RC=""
ui_run() {
  [ -n "$UI_RC" ] && return 0
  need "$1" || return 1
  pnenv -- --filter @toki/ui-web test --reporter=json --outputFile="$BASE/ui.json" > "$BASE/ui.log" 2>&1; UI_RC=$?
  [ -s "$BASE/ui.json" ] || { echo "$1 the test run produced no result (Blocked): $(first_error "$BASE/ui.log")"; UI_RC=""; return 1; }
}
# ut <file> <regex on the full test name>: "passed failed" for the tests that match, from the run at V
ut() { jq -r --arg f "$1" --arg r "$2" '[.testResults[] | select(.name | endswith("/" + $f)) | .assertionResults[] | select(.fullName | test($r))] | "\(map(select(.status == "passed")) | length) \(map(select(.status != "passed")) | length)"' "$BASE/ui.json"; }
# a mutated run of the tests of one file: mutrun <key> <file> <perl> <test file>
mutrun() {
  [ -f "$BASE/mut-$1.json" ] && return 0
  mutate "$2" "$3" || { echo "mutation $1 did not apply" > "$BASE/mut-$1.log"; return 1; }
  pnenv -- --filter @toki/ui-web exec vitest run "$4" --reporter=json --outputFile="$BASE/mut-$1.json" > "$BASE/mut-$1.log" 2>&1
  restore "$2"
  [ "$(jq -r '.numTotalTests' "$BASE/mut-$1.json" 2>/dev/null)" -ge 1 ] 2>/dev/null || { rm -f "$BASE/mut-$1.json"; echo "the mutated run ran no test" >> "$BASE/mut-$1.log"; }
}
# mfail <key> <file> <regex>: how many of the named tests fail in the mutated run
mfail() { jq -r --arg f "$2" --arg r "$3" '[.testResults[] | select(.name | endswith("/" + $f)) | .assertionResults[] | select(.fullName | test($r)) | select(.status != "passed")] | length' "$BASE/mut-$1.json" 2>/dev/null || echo "-"; }
# utrow <row> <file> <regex> <mutation key or ->: prints "row passed failed [failed under the mutation]"
utrow() {
  ui_run "$1" || return
  local line; line=$(ut "$2" "$3")
  if [ "${4:-}" = "-" ] || [ -z "${4:-}" ]; then echo "$1 $line"; else
    [ -s "$BASE/mut-$4.json" ] || { echo "$1 $line the mutated copy could not be run (Blocked): $(first_error "$BASE/mut-$4.log")"; return; }
    echo "$1 $line $(mfail "$4" "$2" "$3")"
  fi
}

# ---- rows that read files only ---------------------------------------------------------------
helpers_of() { case "$1" in Avatar) echo getInitials.ts;; Toast) echo "ToastProvider.tsx ToastRegion.tsx toastPlace.ts";; esac; }
filediff() { # $1 file with the names present, $2 file with the names wanted: "missing extra"
  echo "$(comm -13 "$1" "$2" | grep -c . || true) $(comm -23 "$1" "$2" | grep -c . || true)"
}
t1a() {
  local f ok=0 miss=0 extra=0 d
  : > "$BASE/ctl.have"
  for f in $FOLDERS; do
    git ls-tree --name-only "$V" "$P/$f/" | sed "s#^$P/$f/##" | sort > "$BASE/have"
    printf '%s\n' "$f.tsx" "$f.css" "$f.test.tsx" "$f.examples.tsx" index.ts $(helpers_of "$f") | sort > "$BASE/want"
    [ -s "$BASE/have" ] && ok=$((ok + 1))
    d=$(filediff "$BASE/have" "$BASE/want"); miss=$((miss + ${d% *})); extra=$((extra + ${d#* }))
    cp "$BASE/have" "$BASE/ctl.have"; cp "$BASE/want" "$BASE/ctl.want"
  done
  echo "Extra.tsx" >> "$BASE/ctl.have"; sort -o "$BASE/ctl.have" "$BASE/ctl.have"
  d=$(filediff "$BASE/ctl.have" "$BASE/ctl.want")
  echo "T1A $ok $miss $extra ${d#* }"
}
t1b() {
  local idx f one=0 named=0 added
  idx=$(doc "$P/index.ts")
  for f in $FOLDERS; do
    [ "$(printf '%s\n' "$idx" | grep -cx "export \* from \"./$f\";" || true)" = 1 ] && one=$((one + 1))
    doc "$P/$f/index.ts" > "$BASE/idx.txt"
    [ "$(grep -c '^export \*' "$BASE/idx.txt" || true)" = 0 ] && [ "$(grep -c '^export {\|^export type {' "$BASE/idx.txt" || true)" -ge 1 ] && named=$((named + 1))
  done
  added=$(git diff "$V^1" "$V" -- "$P/index.ts" | grep -c '^+export \*' || true)
  printf '%s\n' "$idx" | grep -v 'from "./Avatar"' > "$BASE/idx.ctl"
  echo "T1B $one $added $named $(grep -cx 'export \* from "./Avatar";' "$BASE/idx.ctl" || true)"
}
t1c() {
  local a b
  a=$(git diff --numstat "$V^1" "$V" -- packages/ui-web/src/index.ts | awk '{s += $1 + $2} END {print s + 0}')
  b=$(git diff --numstat "$V^1" "$V" -- "$P/index.ts" | awk '{s += $1 + $2} END {print s + 0}')
  echo "T1C $a $b"
}
src_files() { git ls-tree -r --name-only "$V" -- $(for f in $FOLDERS; do echo "$P/$f"; done) | grep -E '\.tsx?$' | grep -vE '\.test\.tsx?$|\.examples\.tsx$'; }
t3a() {
  local f n=0 imp=0 api=0 i=0
  : > "$BASE/src.all"
  for f in $(src_files); do doc "$f" >> "$BASE/src.all"; n=$((n + 1)); done
  imp=$(grep -cE '@toki/(i18n|tokens|platform)' "$BASE/src.all" || true)
  api=$(grep -cE '\b(localStorage|sessionStorage|indexedDB|Notification|serviceWorker|AudioContext|Audio)\b' "$BASE/src.all" || true)
  { cat "$BASE/src.all"; echo 'import "@toki/i18n";'; echo 'localStorage.setItem("a", "b");'; } > "$BASE/src.ctl"
  echo "T3A $n $imp $api $(grep -cE '@toki/(i18n|tokens|platform)' "$BASE/src.ctl" || true) $(grep -cE '\b(localStorage|sessionStorage)\b' "$BASE/src.ctl" || true)"
}
css_all() { local f; mkdir -p "$BASE/css"; for f in $FOLDERS; do doc "$P/$f/$f.css" > "$BASE/css/$f.css"; done; echo "$BASE/css/Avatar.css $BASE/css/PresenceDot.css $BASE/css/EmptyState.css $BASE/css/Toast.css"; }
t3b() {
  local files names res ctl n lit bad
  files=$(css_all)
  doc docs/specs/2026-11-16-tokens-package-design.md | grep '^- R10\.' | grep -oE '`--[a-z0-9-]+`' | tr -d '`' | sort -u > "$BASE/names.txt"
  names=$(grep -c . "$BASE/names.txt" || true)
  res=$(nodebin "$CSSJS" scan "$BASE/names.txt" 0 $files); ctl=$(nodebin "$CSSJS" scan "$BASE/names.txt" 1 $files)
  set -- $res; n=$1; lit=$2; bad=$3
  set -- $ctl
  echo "T3B 4 $n $lit $bad $names $(($2 - lit)) $(($3 - bad))"
}
t4a() {
  local f ok=0
  for f in Avatar/Avatar.tsx PresenceDot/PresenceDot.tsx EmptyState/EmptyState.tsx Toast/Toast.tsx Toast/ToastRegion.tsx; do
    doc "$P/$f" > "$BASE/fr.txt"; [ "$(grep -c 'forwardRef' "$BASE/fr.txt" || true)" -ge 1 ] && ok=$((ok + 1))
  done
  doc "$P/Avatar/getInitials.ts" > "$BASE/fr.txt"
  echo "T4A $ok $(grep -c 'forwardRef' "$BASE/fr.txt" || true)"
}
depset() { jq -r '[(.dependencies // {}), (.devDependencies // {}), (.peerDependencies // {}), (.optionalDependencies // {})] | add | to_entries[] | "\(.key)@\(.value)"' | sort; }
t5a() {
  local pk=packages/ui-web/package.json total added ctl
  git show "$V^1:$pk" 2>/dev/null | depset > "$BASE/dep.a"
  doc "$pk" | depset > "$BASE/dep.b"
  total=$(grep -c . "$BASE/dep.b" || true)
  added=$(comm -13 "$BASE/dep.a" "$BASE/dep.b" | grep -c . || true)
  { cat "$BASE/dep.b"; echo "zz-added@1"; } | sort > "$BASE/dep.c"
  ctl=$(comm -13 "$BASE/dep.a" "$BASE/dep.c" | grep -c . || true)
  echo "T5A $total $added $ctl"
}
t9() {
  local E='--s:var(--av);width:var(--s);height:var(--s);flex:none;border-radius:30%;display:inline-grid;place-items:center;font-weight:700;font-size:calc(var(--s)*.38);letter-spacing:.01em;background:hsl(var(--h) var(--av-s) var(--av-l));color:hsl(var(--h) var(--av-ts) var(--av-tl));position:relative;user-select:none'
  local a b; a=$(csschk "$P/Avatar/Avatar.css" .av - "$E"); b=$(csschk "$P/Avatar/Avatar.css" .av - "$E" 's/border-radius: 30%/border-radius: 31%/')
  echo "T9 $a $(offof "$b")"
}
t10d() {
  local F="$P/Avatar/Avatar.css" E='position:absolute;right:-3px;bottom:-3px' a b c d
  a=$(csschk "$F" '.av .pd' - "$E"); b=$(csschk "$F" .pdw - 'position:relative;display:inline-grid;flex:none'); c=$(csschk "$F" '.pdw .pd' - "$E")
  d=$(csschk "$F" '.pdw .pd' - "$E" 's/right: -3px/right: -4px/g')
  echo "T10D $a $b $c $(offof "$d")"
}
t13() {
  local F="$P/PresenceDot/PresenceDot.css" a b c d
  a=$(csschk "$F" .pd - 'width:11px;height:11px;border-radius:50%;border:2px solid var(--surface);background:var(--accent);display:inline-block;flex:none;box-sizing:border-box')
  b=$(csschk "$F" .pd.away - 'background:var(--surface);border-color:var(--muted)')
  c=$(csschk "$F" .pd.dnd - 'background:var(--danger)')
  d=$(csschk "$F" .pd.dnd - 'background:var(--danger)' 's/var\(--danger\)/var(--accent)/')
  echo "T13 $a $b $c $(offof "$d")"
}
t16() {
  local F="$P/EmptyState/EmptyState.css" a b c d e
  a=$(csschk "$F" .empty - 'display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:56px 24px;color:var(--muted);flex:1')
  b=$(csschk "$F" '.empty .eic' - 'width:56px;height:56px;border-radius:18px;background:var(--accent-soft);color:var(--accent-text);display:grid;place-items:center')
  c=$(csschk "$F" '.empty .eic .ic' - 'width:26px;height:26px')
  d=$(csschk "$F" '.empty b' - 'color:var(--ink);font-size:15px')
  e=$(csschk "$F" '.empty b' - 'color:var(--ink);font-size:15px' 's/font-size: 15px/font-size: 16px/')
  echo "T16 $a $b $c $d $(offof "$e")"
}
t20a() {
  local F="$P/Toast/Toast.css" a b c d e
  a=$(csschk "$F" .toast - 'pointer-events:auto;display:flex;align-items:center;gap:12px;background:var(--ink);color:var(--surface);padding:9px 12px 9px 14px;border-radius:var(--radius-sm);box-shadow:var(--pop);animation:tin .18s ease-out;font-weight:500')
  b=$(csschk "$F" '.toast button' - 'color:var(--accent-soft);font-weight:700;padding:2px 6px')
  c=$(csschk "$F" '[data-eff="focus"] .toast button' - 'color:var(--accent)')
  d=$(csschk "$F" from @keyframestin 'transform:translateY(8px);opacity:0')
  e=$(csschk "$F" '.toast button' - 'color:var(--accent-soft);font-weight:700;padding:2px 6px' 's/var\(--accent-soft\)/var(--accent)/')
  echo "T20A $a $b $c $d $(offof "$e")"
}
t20c() {
  local files a b; files=$(css_all)
  a=$(nodebin "$CSSJS" forbid 0 "$BASE/css/Toast.css"); b=$(nodebin "$CSSJS" forbid 1 "$BASE/css/Toast.css")
  echo "T20C ${a% *} ${a#* } ${b#* }"
}
t20d() {
  local files a b; files=$(css_all)
  a=$(nodebin "$CSSJS" looks 0 $files); b=$(nodebin "$CSSJS" looks 1 $files)
  echo "T20D $a ${b%% *}"
}
t21b() {
  local F="$P/Toast/Toast.css" a b
  a=$(csschk "$F" .toasts - 'position:fixed;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;z-index:40;width:min(480px,92%)')
  b=$(csschk "$F" .toasts - 'position:fixed;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;z-index:40;width:min(480px,92%)' 's/z-index: 40/z-index: 41/')
  echo "T21B $a $(offof "$b")"
}
t32() {
  local F="$P/Toast/Toast.css" a b m
  a=$(csschk "$F" '.toast button' '@media(max-width:719px)' 'min-height:40px')
  b=$(csschk "$F" '.toast button' '@media(max-width:719px)' 'min-height:40px' 's/min-height: 40px/min-height: 39px/')
  doc "$F" > "$BASE/t32.css"; m=$(nodebin "$CSSJS" medias "$BASE/t32.css")
  echo "T32 $a $m $(offof "$b")"
}
t33() {
  local a b c d
  a=$(csschk "$P/Toast/Toast.css" '.toast button:focus-visible' - 'outline-color:var(--surface)')
  b=$(csschk packages/ui-web/src/styles/base.css ':focus-visible' - 'outline:2px solid var(--accent);outline-offset:2px;border-radius:6px')
  c=$(csschk "$P/Toast/Toast.css" '.toast button:focus-visible' - 'outline-color:var(--surface)' 's/outline-color: var\(--surface\)/outline-color: var(--accent)/')
  echo "T33 $a $b $(offof "$c")"
}

# ---- rows that run a tool in the worktree --------------------------------------------------------
t5b() { need T5B || return; echo "T5B $INSTALL_RC"; }
t5c() { need T5C || return; pnenv -- typecheck > "$BASE/t5c.log" 2>&1; echo "T5C $?"; }
t5d() {
  need T5D || return
  local rc rc2
  pnenv -- lint > "$BASE/t5d.log" 2>&1; rc=$?
  mutate packages/ui-web/src/components/Avatar/getInitials.ts 's/\A/const zz = 1;\n/' || { echo "T5D the mutation did not apply (Blocked)"; return; }
  pnenv -- lint > "$BASE/t5d2.log" 2>&1; rc2=$?
  restore packages/ui-web/src/components/Avatar/getInitials.ts
  echo "T5D $rc $([ "$rc2" != 0 ] && echo 1 || echo 0)"
}
t5e() { need T5E || return; pnenv -- lint:boundaries > "$BASE/t5e.log" 2>&1; echo "T5E $?"; }
t5f() {
  need T5F || return
  local rc rc2
  pnenv -- format:check > "$BASE/t5f.log" 2>&1; rc=$?
  mutate packages/ui-web/src/components/Avatar/getInitials.ts 's/\A/const   zz  =  1\n/' || { echo "T5F the mutation did not apply (Blocked)"; return; }
  pnenv -- format:check > "$BASE/t5f2.log" 2>&1; rc2=$?
  restore packages/ui-web/src/components/Avatar/getInitials.ts
  echo "T5F $rc $([ "$rc2" != 0 ] && echo 1 || echo 0)"
}
t5g() {
  ui_run T5G || return
  echo "T5G $UI_RC $(jq -r '"\(.numPassedTests) \(.numFailedTests) \(.testResults | length)"' "$BASE/ui.json")"
}
t4e() {
  need T4E || return
  local rc rc2 n
  pnenv -- --filter @toki/ui-web typecheck > "$BASE/t4e.log" 2>&1; rc=$?
  n=0; for f in $TESTS; do n=$((n + $(doc "$f" | grep -c '@ts-expect-error' || true))); done
  mutate "$P/PresenceDot/PresenceDot.tsx" 's/"role" \| "aria-label" \| "aria-hidden" \| "children"/"children"/' || { echo "T4E the mutation did not apply (Blocked)"; return; }
  pnenv -- --filter @toki/ui-web typecheck > "$BASE/t4e2.log" 2>&1; rc2=$?
  restore "$P/PresenceDot/PresenceDot.tsx"
  echo "T4E $rc $n $([ "$rc2" != 0 ] && echo 1 || echo 0)"
}

# ---- the type probe: tsc against cases that must be refused -------------------------------------
write_types() { # $1 directive written at each marker: "ts-expect-error" or "case"
  local d="$1"
  { cat <<'TSX'
import { Avatar, PresenceDot, EmptyState, Toast, ToastRegion } from "./index";
import type { AvatarProps, PresenceDotProps, PresenceState, EmptyStateProps, ToastProps } from "./index";
//@@ T2B
import type { NotAType } from "./index";
export type Used = [AvatarProps, PresenceDotProps, PresenceState, EmptyStateProps, ToastProps, NotAType];
export const cases = [
//@@ T6D
  <Avatar key="a1" name="a" hue={1} title="x" />,
//@@ T6D
  <Avatar key="a2" name="a" hue={1} src="x" />,
//@@ T6D
  <Avatar key="a3" name="a" hue={1} alt="x" />,
//@@ T6D
  <Avatar key="a4" name="a" hue={1}>x</Avatar>,
//@@ T12B
  <PresenceDot key="p1" />,
//@@ T15D
  <EmptyState key="e1" icon="users" description="d" />,
//@@ T15D
  <EmptyState key="e2" icon="users" title="t" />,
//@@ T15D
  <EmptyState key="e3" icon="no-such-icon" title="t" description="d" />,
//@@ T18B
  <EmptyState key="e4" icon="users" title="t" description="d" role="status" />,
//@@ T18B
  <EmptyState key="e5" icon="users" title="t" description="d">x</EmptyState>,
//@@ T19D
  <Toast key="t1" />,
//@@ T19D
  <Toast key="t2" text="t" role="status" />,
//@@ T19D
  <Toast key="t3" text="t">x</Toast>,
//@@ T4F
  <PresenceDot key="p2" state="active" role="img" />,
//@@ T4F
  <PresenceDot key="p3" state="active">x</PresenceDot>,
//@@ T4F
  <ToastRegion key="r1">x</ToastRegion>,
];
TSX
  } | awk -v d="$d" '/^\/\/@@ /{ if (d == "ts-expect-error") print "// @ts-expect-error"; else print "// " $2; next } { print }' > "$WT/packages/ui-web/src/zz-qa-types.tsx"
}
TYPES_DONE=""
types_run() {
  [ -n "$TYPES_DONE" ] && return 0
  need "$1" || return 1
  local v f="$WT/packages/ui-web/src/zz-qa-types.tsx"
  for v in A B; do
    if [ "$v" = A ]; then write_types ts-expect-error; else write_types case; fi
    pnenv -- --filter @toki/ui-web exec tsc --noEmit --pretty false > "$BASE/types.$v.log" 2>&1
    cp "$f" "$BASE/types.$v.tsx"
  done
  rm -f "$f"
  # the line of a case and the line of its marker, with the group named by the marker in version B
  awk '/^\/\/ T[0-9]+[A-Z]$/ { sub(/^\/\/ /, ""); print NR, $0; print NR + 1, $0 }' "$BASE/types.B.tsx" > "$BASE/types.map"
  TYPES_DONE=1
}
elines() { grep 'zz-qa-types.tsx(' "$BASE/types.$1.log" | sed -E 's/.*zz-qa-types\.tsx\(([0-9]+),.*/\1/'; }
tcount() { # $1 version, $2 group: errors reported on the lines of that group
  elines "$1" | awk -v g="$2" 'NR == FNR { m[$1] = $2; next } ($1 in m) && m[$1] == g { c++ } END { print c + 0 }' "$BASE/types.map" -
}
tungrouped() { elines "$1" | awk 'NR == FNR { m[$1] = $2; next } !($1 in m) { c++ } END { print c + 0 }' "$BASE/types.map" -; }
trow() { # <row>: errors with the directive in place, errors without it
  types_run "$1" || return
  echo "$1 $(tcount A "$1") $(tcount B "$1")"
}
t2b() {
  types_run T2B || return
  echo "T2B $(tungrouped B) $(tcount B T2B) $(tcount A T2B)"
}
t6d() { trow T6D T6D; }
t12b() { trow T12B T12B; }
t15d() { trow T15D T15D; }
t18b() { trow T18B T18B; }
t19d() { trow T19D T19D; }
t4f() { trow T4F T4F; }

# ---- rows read from the probe ------------------------------------------------------------------
prow() { probe_ok "$1" || return; echo "$1 $(pv "$1")"; }
t2a() { prow T2A; }
t3c() { prow T3C; }
t4b() { prow T4B; }
t4c() { prow T4C; }
t4d() { prow T4D; }
t6a() { prow T6A; }
t6b() { prow T6B; }
t6c() { prow T6C; }
t6e() { prow T6E; }
t6f() { prow T6F; }
t7a() {
  probe_ok T7A || return
  pmut mut-t7a packages/ui-web/src/components/Avatar/getInitials.ts 's/words\[words\.length - 1\]!/words[1]!/' || { echo "T7A the mutation did not apply (Blocked)"; return; }
  echo "T7A $(pv T7A) $((5 - $(mv_ mut-t7a T7A 0)))"
}
t7b() {
  probe_ok T7B || return
  pmut mut-t7b packages/ui-web/src/components/Avatar/getInitials.ts 's/\.normalize\("NFC"\)//' || { echo "T7B the mutation did not apply (Blocked)"; return; }
  echo "T7B $(pv T7B) $((1 - $(mv_ mut-t7b T7B 1)))"
}
t7c() { prow T7C; }
t7d() {
  probe_ok T7D || return
  pmut mut-t7d packages/ui-web/src/components/Avatar/getInitials.ts 's/if \(words\.length === 0\) return "";//' || { echo "T7D the mutation did not apply (Blocked)"; return; }
  echo "T7D $(pv T7D) $([ "$(mv_ mut-t7d T7D 1)" -gt 0 ] && echo 1 || echo 0)"
}
t7e() { prow T7E; }
t8a() { prow T8A; }
t8b() {
  probe_ok T8B || return
  pmut mut-t8b packages/ui-web/src/components/Avatar/Avatar.tsx 's/size > 0/size >= 0/' || { echo "T8B the mutation did not apply (Blocked)"; return; }
  echo "T8B $(pv T8B) $([ "$(mv_ mut-t8b T8B 0)" -lt 5 ] && echo 1 || echo 0)"
}
t10a() { prow T10A; }
t10b() { prow T10B; }
t10c() { prow T10C; }
t10e() { prow T10E; }
t11() { prow T11; }
t12a() { prow T12A; }
t14a() { prow T14A; }
t14b() { prow T14B; }
t14c() { prow T14C; }
t15a() { prow T15A; }
t15b() { prow T15B; }
t15c() { prow T15C; }
t15e() { prow T15E; }
t18a() { prow T18A; }
t18c() { prow T18C; }
t18d() { prow T18D; }
t19a() { prow T19A; }
t19b() { prow T19B; }
t19c() { prow T19C; }
t30a() { prow T30A; }
t30b() { prow T30B; }
t30c() { prow T30C; }
t30d() { prow T30D; }
t30e() { prow T30E; }

# ---- rows read from the tests of the ticket -------------------------------------------------------
TP="packages/ui-web/src/components/Toast"
t2c() { utrow T2C exports-group2.test.tsx 'exports of group 2' -; }
t21a() { utrow T21A Toast.test.tsx 'the region is in the document with no toast|the region holds no other live role' -; }
t22a() { utrow T22A Toast.test.tsx 'show adds a toast at once and returns an id|dismiss of an unknown id' -; }
t22b() { utrow T22B Toast.test.tsx 'useToasts outside a provider throws an error that names ToastProvider' -; }
t22c() { utrow T22C Toast.test.tsx 'show and dismiss keep their identity and a caller does not render again' -; }
t23a() { ui_run T23A || return; mutrun 23a "$TP/toastPlace.ts" 's/TOAST_MS_WITH_ACTION = 5000/TOAST_MS_WITH_ACTION = 5001/' "src/components/Toast/Toast.test.tsx"; utrow T23A Toast.test.tsx 'a toast with an action goes at 5000 ms' 23a; }
t23b() { ui_run T23B || return; mutrun 23b "$TP/toastPlace.ts" 's/TOAST_MS_PLAIN = 2800/TOAST_MS_PLAIN = 2801/' "src/components/Toast/Toast.test.tsx"; utrow T23B Toast.test.tsx 'a toast without an action goes at 2800 ms' 23b; }
t23c() { utrow T23C Toast.test.tsx 'each toast has its own timer' -; }
t23d() { utrow T23D Toast.test.tsx 'the timer stops while the pointer is over|the timer stops while focus is inside|the timer stays stopped while either|a pause on one toast' -; }
t23e() { utrow T23E Toast.test.tsx 'the constants are 5000 and 2800 ms' -; }
t24() { ui_run T24 || return; mutrun 24 "$TP/ToastRegion.tsx" 's/api\.dismiss\(item\.id\);//' "src/components/Toast/Toast.test.tsx"; utrow T24 Toast.test.tsx 'pressing the button removes the toast first' 24; }
t25a() { utrow T25A Toast.test.tsx 'the region follows toasts in the order of show' -; }
t25b() { ui_run T25B || return; mutrun 25 "$TP/toastPlace.ts" 's/TOAST_MAX = 3/TOAST_MAX = 4/' "src/components/Toast/Toast.test.tsx"; utrow T25B Toast.test.tsx 'at most three toasts show|an evicted toast with an action' 25; }
t25c() { utrow T25C Toast.test.tsx 'equal texts are not merged' -; }
t26() { ui_run T26 || return; mutrun 26 "$TP/ToastProvider.tsx" 's/live\.forEach\(\(entry\) => clearTimeout\(entry\.handle\)\);//' "src/components/Toast/Toast.test.tsx"; utrow T26 Toast.test.tsx 'every timer is cleared and nothing is set afterwards' 26; }
t27() {
  probe_ok T27P || return
  ui_run T27 || return
  mutrun 27 "$TP/toastPlace.ts" 's/ABOVE_OBSTACLE = 14/ABOVE_OBSTACLE = 15/' "src/components/Toast/Toast.test.tsx"
  echo "T27 $(pv T27P) $(ut Toast.test.tsx 'computeToastBottom') $(mfail 27 Toast.test.tsx 'computeToastBottom')"
}
t28a() { ui_run T28A || return; mutrun 27 "$TP/toastPlace.ts" 's/ABOVE_OBSTACLE = 14/ABOVE_OBSTACLE = 15/' "src/components/Toast/Toast.test.tsx"; utrow T28A Toast.test.tsx 'useToastAvoid \(R28\) (with nothing registered|a registered composer lifts)' 27; }
t28b() { ui_run T28B || return; mutrun 28b "$TP/ToastRegion.tsx" 's/window\.addEventListener\("resize", measure\);//' "src/components/Toast/Toast.test.tsx"; utrow T28B Toast.test.tsx 'it measures again on a resize of the window' 28b; }
t28c() { ui_run T28C || return; mutrun 28c "$TP/ToastProvider.tsx" 's/if \(event\.target === el\) notify\(\);//' "src/components/Toast/Toast.test.tsx"; utrow T28C Toast.test.tsx 'it measures again on transitionend' 28c; }
t28d() { ui_run T28D || return; mutrun 28d "$TP/ToastRegion.tsx" 's/setPlace\(\(now\) => keep\(now, measurePlace\(registry\)\)\);\n    \}, \[registry, items\]\);/}, [registry, items]);/' "src/components/Toast/Toast.test.tsx"; utrow T28D Toast.test.tsx 'it measures again when the element changes size' 28d; }
t28e() { ui_run T28E || return; mutrun 28e "$TP/ToastRegion.tsx" 's/return rect\.width > 0 && rect\.height > 0 \? rect : undefined;/return rect;/' "src/components/Toast/Toast.test.tsx"; utrow T28E Toast.test.tsx 'it falls back to 20 px' 28e; }
t28f() { utrow T28F Toast.test.tsx 'with no ToastProvider above, the hooks do nothing' -; }
t30f() {
  ui_run T30F || return
  echo "T30F $(ut examples.test.tsx 'folders|ids are unique within a component') $(ut exports-group2.test.tsx 'examples of group 2')"
}
t31a() { ui_run T31A || return; probe_ok T31P || return; mutrun 31 "$TP/toastPlace.ts" 's/WIDTH_SHARE = 0\.92/WIDTH_SHARE = 0.9/' "src/components/Toast/Toast.test.tsx"; echo "T31A $(pv T31P) $(ut Toast.test.tsx 'computeToastExtent \(R31\)') $(mfail 31 Toast.test.tsx 'computeToastExtent \(R31\)')"; }
t31b() { utrow T31B Toast.test.tsx 'useToastAnchor \(R31\)' -; }
t31c() { utrow T31C Toast.test.tsx 'with no ToastProvider above, the hooks do nothing' -; }
t34a() { utrow T34A Toast.test.tsx 'the on-screen keyboard \(R34\) (toasts stay at least 20|with the keyboard shut|the offset of the visual viewport|it follows resize and scroll|it stops listening)' -; }
t34b() {
  ui_run T34B || return
  mutrun 34 "$TP/ToastRegion.tsx" 's/const bottom = Math\.max\(/const bottom = ((...a: number[]) => a.reduce((x, y) => x + y, 0))(/' "src/components/Toast/Toast.test.tsx"
  utrow T34B Toast.test.tsx 'it is the larger of the composer value and the keyboard value' 34
}

# ---- browser rows ----------------------------------------------------------------------------------
write_pages() {
  cat > "$WT/apps/web/qa-toast.html" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>qa</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/qa-toast.tsx"></script>
  </body>
</html>
HTML
  cat > "$WT/apps/web/src/qa-toast.tsx" <<'TSX'
import "@toki/tokens/tokens.css";
import "@toki/ui-web/base.css";
import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { EmptyState, ToastProvider, useToastAnchor, useToastAvoid, useToasts } from "@toki/ui-web";

const q = new URLSearchParams(location.search);
const eff = q.get("eff") ?? "calm";
document.documentElement.dataset.eff = eff;
document.body.style.margin = "0";
const page = q.get("page") ?? "empty";
const register = q.get("register") !== "0";
const parent = q.get("parent") ?? "flex";
const side = eff === "focus" ? 68 : 272;
const LONG = "Your message could not be sent because the connection was lost, and it will be sent again when you are back online. We keep it in the outbox until then.";

function Empty() {
  return (
    <div id="parent" style={{ display: parent === "flex" ? "flex" : "block", flexDirection: "column", height: 600 }}>
      <EmptyState icon="users" title="Nobody matches" description="Try a name or a job title." />
    </div>
  );
}

function Layout() {
  const main = useRef<HTMLElement>(null);
  const composer = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  if (register) {
    useToastAnchor(main);
    useToastAvoid(composer);
    useToastAvoid(bar);
  }
  const api = useToasts();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__qa = {
      show: () => {
        api.show({ text: "Left #design" });
        api.show({ text: "Message deleted", action: { label: "Undo", onPress() {} } });
        api.show({ text: LONG });
      },
      hide: (h: boolean) => setHidden(h),
    };
  }, [api]);
  return (
    <>
      <div id="sidebar" style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: side, background: "#aaa" }} />
      <main id="main" ref={main} style={{ position: "fixed", left: side, right: 0, top: 0, bottom: 0 }}>
        <div id="composer" ref={composer} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 56, background: "#ccc" }} />
      </main>
      <nav id="bar" ref={bar} style={{ position: "fixed", left: side, right: 0, bottom: 0, height: 90, background: "#bbb", transform: hidden ? "translateY(100%)" : "none", transition: "transform 0.18s" }} />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  page === "empty" ? <Empty /> : (
    <ToastProvider>
      <Layout />
    </ToastProvider>
  ),
);
TSX
  cat > "$WT/zz-qa-run.mjs" <<'JS'
import { chromium } from "@playwright/test";
const base = process.argv[2];
const mode = process.argv[3];
const widths = mode === "empty" ? [360, 720, 1100] : [360, 720, 800, 1099, 1100];
const variants = mode === "empty" ? [{ parent: "flex" }, { parent: "block" }] : [{ register: "1" }, { register: "0" }];
let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (e) {
  console.log(JSON.stringify({ error: String(e.message).split("\n")[0].slice(0, 160) }));
  process.exit(0);
}
const measureEmpty = () => {
  const p = document.querySelector("#parent").getBoundingClientRect();
  const kids = [...document.querySelector(".empty").children].map((k) => k.getBoundingClientRect());
  const l = Math.min(...kids.map((k) => k.left)), r = Math.max(...kids.map((k) => k.right));
  const t = Math.min(...kids.map((k) => k.top)), b = Math.max(...kids.map((k) => k.bottom));
  return { dx: (l + r) / 2 - (p.left + p.right) / 2, dy: (t + b) / 2 - (p.top + p.bottom) / 2, kids: kids.length };
};
const measureToast = () => {
  const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  return {
    vh: innerHeight,
    toasts: [...document.querySelectorAll(".toast")].map(box),
    composer: box(document.querySelector("#composer")),
    bar: box(document.querySelector("#bar")),
    side: box(document.querySelector("#sidebar")),
  };
};
const rows = [];
for (const eff of ["calm", "focus"]) for (const w of widths) for (const v of variants) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/qa-toast.html?${new URLSearchParams({ page: mode, eff, ...v })}`);
  if (mode === "empty") {
    await page.waitForSelector(".empty");
    await page.waitForTimeout(200);
    rows.push({ eff, w, ...v, ...(await page.evaluate(measureEmpty)) });
  } else {
    await page.waitForFunction(() => window.__qa);
    await page.evaluate(() => window.__qa.show());
    await page.waitForTimeout(400);
    const s1 = await page.evaluate(measureToast);
    await page.evaluate(() => window.__qa.hide(true));
    await page.waitForTimeout(500);
    const s2 = await page.evaluate(measureToast);
    rows.push({ eff, w, ...v, s1, s2 });
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify({ rows }));
JS
}
WEBPORT=""
web_up() {
  write_pages
  WEBPORT=$(freeport)
  ( cd "$WT/apps/web" && exec env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec vite --port "$WEBPORT" --strictPort --host 127.0.0.1 ) > "$BASE/vite.log" 2>&1 &
  local vp=$!; PIDS="$PIDS $vp"; ALLPIDS="$ALLPIDS $vp"
  local i
  for i in $(seq 1 60); do
    curl -s -o /dev/null "http://127.0.0.1:$WEBPORT/qa-toast.html" && return 0
    kill -0 "$vp" 2>/dev/null || return 1
    sleep 1
  done
  return 1
}
web_down() {
  local p; for p in $PIDS; do kill_tree "$p"; wait "$p" 2>/dev/null; done
  PIDS=""; WEBPORT=""
  rm -f "$WT/apps/web/qa-toast.html" "$WT/apps/web/src/qa-toast.tsx" "$WT/apps/web/qa-review.html" "$WT/apps/web/src/qa-review.tsx" "$WT/zz-qa-run.mjs"
}
bdrive() { # <mode> <output name>
  ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node zz-qa-run.mjs "http://127.0.0.1:$WEBPORT" "$1" ) > "$BASE/$2.json" 2> "$BASE/$2.err"
}
BR_DONE=""
browser_all() {
  [ -n "$BR_DONE" ] && return 0
  need "$1" || return 1
  web_up || { echo "$1 the dev server did not start (Blocked): $(first_error "$BASE/vite.log")"; web_down; return 1; }
  bdrive empty br-empty
  mutate "$P/EmptyState/EmptyState.css" 's/justify-content: center/justify-content: flex-start/' && { bdrive empty br-empty-mut; restore "$P/EmptyState/EmptyState.css"; }
  bdrive toast br-toast
  mutate "$TP/toastPlace.ts" 's/bottom = Math\.max\(bottom, viewportHeight - top \+ ABOVE_OBSTACLE\);/bottom = bottom;/' && { bdrive toast br-toast-mut; restore "$TP/toastPlace.ts"; }
  web_down
  BR_DONE=1
}
bjson() { # <row> <name>: the file has rows, or the row is Blocked
  if [ "$(jq -r '.rows | length' "$BASE/$2.json" 2>/dev/null)" -ge 1 ] 2>/dev/null; then return 0; fi
  local e; e=$(jq -r '.error // empty' "$BASE/$2.json" 2>/dev/null); [ -n "$e" ] || e=$(first_error "$BASE/$2.err")
  echo "$1 the browser run produced no result (Blocked): $e"; return 1
}
t17a() {
  browser_all T17A || return; bjson T17A br-empty || return
  jq -r '[.rows[] | select(.parent == "flex")] | "T17A \(length) \(map(select((.dx | fabs) <= 1)) | length)"' "$BASE/br-empty.json"
}
t17b() {
  browser_all T17B || return; bjson T17B br-empty || return
  local m=0; bjson T17B br-empty-mut >/dev/null 2>&1 && m=$(jq -r '[.rows[] | select(.parent == "flex") | select((.dy | fabs) > 1)] | length' "$BASE/br-empty-mut.json")
  jq -r --arg m "$m" '[.rows[] | select(.parent == "flex")] | "T17B \(length) \(map(select((.dy | fabs) <= 1)) | length) \($m)"' "$BASE/br-empty.json"
}
t17c() {
  browser_all T17C || return; bjson T17C br-empty || return
  jq -r '[.rows[] | select(.parent == "block")] | "T17C \(length) \(map(select((.dy | fabs) > 1)) | length)"' "$BASE/br-empty.json"
}
# the three toast tests, as jq programs over one case: s1 is while the bar is shown, s2 after the transform
JQ_COMMON='def inter(a; b): ((([a.r, b.r] | min) - ([a.l, b.l] | max)) > 0.5) and ((([a.b, b.b] | min) - ([a.t, b.t] | max)) > 0.5);
def three: (.toasts | length) == 3;
def above: . as $s | three and (.toasts | all(.b <= $s.composer.t + 0.5 and ($s.bar.t >= $s.vh or .b <= $s.bar.t + 0.5)));
def clear: . as $s | three and (.toasts | all((inter(.; $s.composer) or ($s.bar.t < $s.vh and inter(.; $s.bar)) or inter(.; $s.side)) | not));
def low: (.vh - ([.toasts[].b] | max));
def down: . as $c | ($c.s2 | three) and ($c.s2.bar.t >= $c.s2.vh - 0.5) and ((($c.s2 | low) - 70 | fabs) <= 1 or (($c.s2 | low) - 20 | fabs) <= 1) and (($c.s2 | low) < ($c.s1 | low) - 0.5);'
t29a() {
  browser_all T29A || return; bjson T29A br-toast || return
  local m=0; bjson T29A br-toast-mut >/dev/null 2>&1 && m=$(jq -r "$JQ_COMMON"' [.rows[] | select(.register == "1") | select(.s1 | above)] | length' "$BASE/br-toast-mut.json")
  jq -r --arg m "$m" "$JQ_COMMON"' "T29A \([.rows[] | select(.register == "1")] | length) \([.rows[] | select(.register == "1") | select(.s1 | above)] | length) \($m) \([.rows[] | select(.register == "0") | select(.s1 | above | not)] | length)"' "$BASE/br-toast.json"
}
t29b() {
  browser_all T29B || return; bjson T29B br-toast || return
  local m=0; bjson T29B br-toast-mut >/dev/null 2>&1 && m=$(jq -r "$JQ_COMMON"' [.rows[] | select(.register == "1") | select(.s1 | clear)] | length' "$BASE/br-toast-mut.json")
  jq -r --arg m "$m" "$JQ_COMMON"' "T29B \([.rows[] | select(.register == "1")] | length) \([.rows[] | select(.register == "1") | select(.s1 | clear)] | length) \($m) \([.rows[] | select(.register == "0") | select(.s1 | clear | not)] | length)"' "$BASE/br-toast.json"
}
t29c() {
  browser_all T29C || return; bjson T29C br-toast || return
  local m=0; bjson T29C br-toast-mut >/dev/null 2>&1 && m=$(jq -r "$JQ_COMMON"' [.rows[] | select(.register == "1") | select(down)] | length' "$BASE/br-toast-mut.json")
  jq -r --arg m "$m" "$JQ_COMMON"' "T29C \([.rows[] | select(.register == "1")] | length) \([.rows[] | select(.register == "1") | select(down)] | length) \($m)"' "$BASE/br-toast.json"
}

# ---- manual rows: Blocked until the QA pastes the result ----------------------------------------
manual() { echo "$1 manual row (Blocked): $2"; }
t9m() { manual T9M "the QA compares the avatar with the prototype by eye and pastes the result"; }
t13m() { manual T13M "the QA compares the presence dot with the prototype by eye and pastes the result"; }
t16m() { manual T16M "the QA compares the empty state with the prototype by eye and pastes the result"; }
t20m() { manual T20M "the QA compares the toast with the prototype by eye and pastes the result"; }
t19m() { manual T19M "the QA checks a toast announced once with VoiceOver and NVDA and pastes the result"; }
t34m() { manual T34M "the QA checks the toasts above the keyboard on a phone or an emulator and pastes the result"; }

# ---- the review page for the manual rows (not a row) -----------------------------------------------
serve_review() {
  need serve || return
  cat > "$WT/apps/web/qa-review.html" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TOKI-013 review</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/qa-review.tsx"></script>
  </body>
</html>
HTML
  cat > "$WT/apps/web/src/qa-review.tsx" <<'TSX'
import "@toki/tokens/tokens.css";
import "@toki/ui-web/base.css";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { componentExamples } from "@toki/ui-web/examples";
import { ToastProvider, useToasts } from "@toki/ui-web";

const shown = ["Avatar", "PresenceDot", "EmptyState", "Toast"];
function Buttons() {
  const api = useToasts();
  return (
    <p>
      <button onClick={() => api.show({ text: "Left #design" })}>Toast</button>{" "}
      <button onClick={() => api.show({ text: "Message deleted", action: { label: "Undo", onPress() {} } })}>Toast with Undo</button>{" "}
      <button onClick={() => { for (const t of ["one", "two", "three", "four"]) api.show({ text: t }); }}>Four toasts</button>
    </p>
  );
}
function App() {
  const [eff, setEff] = useState("calm");
  const [accent, setAccent] = useState("teal");
  const [density, setDensity] = useState("comfortable");
  const root = document.documentElement;
  root.dataset.eff = eff;
  if (accent === "teal") delete root.dataset.accent; else root.dataset.accent = accent;
  root.dataset.density = density;
  const sel = (v: string, set: (s: string) => void, opts: string[]) => (
    <select value={v} onChange={(e) => set(e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
  );
  return (
    <ToastProvider>
      <div style={{ padding: 16 }}>
        <p>Look {sel(eff, setEff, ["calm", "focus"])} accent {sel(accent, setAccent, ["teal", "indigo", "clay", "violet"])} density {sel(density, setDensity, ["comfortable", "compact"])}</p>
        <Buttons />
        {componentExamples.filter((c) => shown.includes(c.component)).map((c) => (
          <section key={c.component}>
            <h3>{c.component}</h3>
            {c.examples.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
                <code style={{ width: 160 }}>{e.title}</code>
                <div style={{ display: "flex", flexDirection: "column", minHeight: 80, minWidth: 260 }}>{e.element}</div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </ToastProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
TSX
  WEBPORT=$(freeport)
  ( cd "$WT/apps/web" && exec env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec vite --port "$WEBPORT" --strictPort --host 127.0.0.1 ) > "$BASE/vite.log" 2>&1 &
  PIDS="$PIDS $!"; ALLPIDS="$ALLPIDS $!"
  sleep 3
  echo "review page for the manual rows: http://127.0.0.1:$WEBPORT/qa-review.html (the prototype is e2e/prototype/index.html on main)"
  read -r -p "press Enter to stop " _
}

rows="${*:-T1A T1B T1C T2A T2B T2C T3A T3B T3C T4A T4B T4C T4D T4E T4F T5A T5B T5C T5D T5E T5F T5G T6A T6B T6C T6D T6E T6F T7A T7B T7C T7D T7E T8A T8B T9 T9M T10A T10B T10C T10D T10E T11 T12A T12B T13 T13M T14A T14B T14C T15A T15B T15C T15D T15E T16 T16M T17A T17B T17C T18A T18B T18C T18D T19A T19B T19C T19D T19M T20A T20C T20D T20M T21A T21B T22A T22B T22C T23A T23B T23C T23D T23E T24 T25A T25B T25C T26 T27 T28A T28B T28C T28D T28E T28F T29A T29B T29C T30A T30B T30C T30D T30E T30F T31A T31B T31C T32 T33 T34A T34B T34M}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'A-Z' 'a-z')
  if [ "$fn" = serve ]; then serve_review
  elif declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
cleanup; WT=""
alive=0
for p in $ALLPIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
echo "CLEAN worktrees $([ "$(git worktree list | grep -c "$(basename "$BASE")" || true)" = 0 ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive temporary-folder $([ -e "$BASE" ] && echo left || echo removed)"
