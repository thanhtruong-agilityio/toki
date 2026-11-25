#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-014.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile`; nothing else leaves the machine (the pages are served on 127.0.0.1).
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-014.checks.sh [T1 T2 ...]
# It reads files of the commit V with `git show`. Rows that run code use ONE temporary worktree of V made
# under one temporary folder (BASE, made in the current shell, exported as TMPDIR and given to every
# process through `env -i`) with an install made in it. The browser rows write a throw-away page, a Vite
# server on a free loopback port and a Playwright script into that worktree (the preview page of TOKI-016
# does not exist at the Version) and drive the Chromium that Playwright cached. A check that must fail is
# paired with a run that must pass: a file of the temporary worktree is changed, the check is run again and
# the file is restored. Everything is removed when the script ends, even when a row fails: the worktree,
# the processes, the ports and BASE; the repository itself is not changed. It prints one line for each
# row: counts, ids, exit codes and words; no tool output and no value of a secret. No `.env` file is read
# or created. Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
# A row that cannot be shown prints "Blocked" and the reason, never a pass. The row T66 is a manual row:
# it is Blocked until the QA pastes the result.
set -uo pipefail
V="${V:-HEAD}"
doc() { git show "$V:$1" 2>/dev/null; }
UI="packages/ui-web/src"

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
reset_wt() { ( cd "$WT" && git checkout -q -- . && git clean -fdq ); }
freeport() { nodebin -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
portbusy() { nodebin -e 'const s=require("net").connect(Number(process.argv[1]),"127.0.0.1");s.on("connect",()=>{console.log("busy");process.exit(0)});s.on("error",()=>{console.log("free");process.exit(0)})' "$1" 2>/dev/null; }
# mut <relative file> <perl substitution>: changes a file of the worktree; fails when nothing changed
mut() { perl -0pi -e "$2" "$WT/$1" 2>/dev/null; ( cd "$WT" && ! git diff --quiet -- "$1" ); }

# ---- the probes (files written into the temporary worktree only) -----------------------------
put_probe() {
  mkdir -p "$WT/$UI/zz-qa"
  cat > "$WT/$UI/zz-qa/probe.test.tsx" <<'ZZ_PROBE'
// @ts-nocheck
import { createRef, useRef, type ReactNode } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import postcss from "postcss";
import { afterAll, expect, test } from "vitest";
import * as Pkg from "../index";
import * as Comp from "../components";
import { componentExamples } from "../examples";
import { Menu, MenuGroup, MenuItem, MenuSeparator, Modal, Sheet, useMenuTrigger, computeMenuPosition, dialogBackdrops, dialogCloseReasons, menuAligns, menuItemVariants, menuCloseReasons } from "../index";

const out: Record<string, unknown> = {};
const src = resolve(import.meta.dirname, "..");
afterAll(() => writeFileSync(process.env.QA_OUT!, JSON.stringify(out)));

const VALUES = ["Menu", "MenuItem", "MenuGroup", "MenuSeparator", "menuAligns", "menuItemVariants", "menuCloseReasons", "useMenuTrigger", "computeMenuPosition", "Modal", "Sheet", "dialogBackdrops", "dialogCloseReasons"];
test("exports (R1)", () => {
  out.r1 = {
    values: VALUES.filter((n) => n in Pkg).length,
    fromComponents: VALUES.filter((n) => n in Comp).length,
    dialogExported: ("Dialog" in Pkg ? 1 : 0) + ("Dialog" in Comp ? 1 : 0),
    forwardRef: [Menu, MenuItem, MenuGroup, MenuSeparator, Modal, Sheet].filter((c) => c.$$typeof === Symbol.for("react.forward_ref")).length,
    tail: componentExamples.slice(-3).map((c) => c.component).join(","),
    afterToast: componentExamples.findIndex((c) => c.component === "Menu") - componentExamples.findIndex((c) => c.component === "Toast"),
    lists: [menuAligns.join("/"), menuItemVariants.join("/"), menuCloseReasons.join("/"), dialogBackdrops.join("/"), dialogCloseReasons.join("/")].join(" "),
  };
});

const shape = (el: Element): string => el.tagName.toLowerCase() + (el.getAttribute("role") ? `[${el.getAttribute("role")}]` : "") + (el.children.length ? `(${[...el.children].map(shape).join(",")})` : "");
test("conventions and DOM (R2, R5, R6, R7)", () => {
  const r: Record<string, unknown> = {};
  const noop = () => {};
  // R5 (a)
  const { unmount } = render(<Modal open title="T" closeLabel="Close" footer={<button>F</button>} onRequestClose={noop} className="zz" data-x="1" role="alert" aria-modal="false" tabIndex={5}><p>body</p></Modal>);
  const kids = [...document.body.children];
  const scrim = document.body.lastElementChild as HTMLElement;
  const panel = scrim.firstElementChild as HTMLElement;
  r.a_scrimLastChild = scrim.className === "scrim" && scrim.children.length === 1 ? 1 : 0;
  r.a_ownedAttrs = [panel.getAttribute("role") === "dialog", panel.getAttribute("aria-modal") === "true", panel.getAttribute("tabindex") === "-1"].filter(Boolean).length;
  r.a_className = panel.className;
  r.a_passes = panel.getAttribute("data-x") === "1" ? 1 : 0;
  const hd = panel.children[0], bd = panel.children[1], ft = panel.children[2];
  r.a_order = [...panel.children].map((c) => c.className).join(",");
  const h2 = hd.querySelector("h2")!;
  r.a_h2 = (h2.textContent === "T" && h2.id !== "" ? 1 : 0) + "/" + (panel.getAttribute("aria-labelledby") === h2.id ? 1 : 0);
  const btn = hd.querySelector("button")!;
  r.a_close = (btn.getAttribute("aria-label") === "Close" ? 1 : 0) + "/" + (btn.className.split(" ").includes("sm") ? 1 : 0) + "/" + hd.querySelectorAll("button").length;
  r.a_footer = ft?.textContent;
  unmount();
  // without closeLabel and footer
  const u2 = render(<Modal open title="T" onRequestClose={noop}>x</Modal>);
  const p2 = document.body.lastElementChild!.firstElementChild!;
  r.a_noClose = p2.querySelectorAll("button").length + "/" + p2.querySelectorAll(".mft").length;
  u2.unmount();
  // R5 (b)
  const u3 = render(<Modal open aria-label="L" onRequestClose={noop}><span id="c1">1</span><span id="c2">2</span></Modal>);
  const p3 = document.body.lastElementChild!.firstElementChild!;
  r.b = [p3.getAttribute("aria-label") === "L" ? 1 : 0, p3.children.length, p3.querySelectorAll(".mhd,.mbd,.mft").length, p3.firstElementChild!.id === "c1" ? 1 : 0].join("/");
  const u3b = u3; u3.unmount();
  const u3c = render(<Modal open aria-labelledby="zz-id" onRequestClose={noop}>x</Modal>);
  r.b_labelledby = document.body.lastElementChild!.firstElementChild!.getAttribute("aria-labelledby");
  u3c.unmount();
  // R6 Sheet
  const m = render(<Modal open title="T" closeLabel="C" footer="F" onRequestClose={noop}>b</Modal>);
  const ms = shape(document.body.lastElementChild!);
  const mc = document.body.lastElementChild!.className;
  m.unmount();
  const s = render(<Sheet open title="T" closeLabel="C" footer="F" onRequestClose={noop} className="zz">b</Sheet>);
  const ss = shape(document.body.lastElementChild!);
  r.sheet = [document.body.lastElementChild!.className, document.body.lastElementChild!.firstElementChild!.className, ss === ms ? 1 : 0, mc].join("|");
  s.unmount();
  // R7 backdrop default and opaque
  const d = render(<Modal open title="T" onRequestClose={noop}>x</Modal>);
  const dflt = document.body.lastElementChild!.className;
  d.unmount();
  const o = render(<Modal open title="T" backdrop="opaque" onRequestClose={noop}>x</Modal>);
  r.backdrops = dialogBackdrops.join("/") + "|" + dflt + "|" + document.body.lastElementChild!.className;
  o.unmount();
  // refs
  const rm = createRef(), ri = createRef(), rg = createRef(), rs = createRef(), rd = createRef(), rsh = createRef();
  const anchor = createRef();
  const q = render(<><button ref={anchor} /><Menu open anchorRef={anchor} onClose={noop} aria-label="M" ref={rm} className="zz" data-x="1" role="x"><MenuItem ref={ri} className="zz" variant="danger" type="submit" role="x" tabIndex={3}>I</MenuItem><MenuGroup ref={rg} label="G"><MenuItem>J</MenuItem></MenuGroup><MenuSeparator ref={rs} /></Menu><Modal open title="T" onRequestClose={noop} ref={rd}>x</Modal><Sheet open title="T" onRequestClose={noop} ref={rsh}>x</Sheet></>);
  r.refs = [rm.current?.className === "menu zz" ? 1 : 0, ri.current?.tagName === "BUTTON" ? 1 : 0, rg.current?.getAttribute("role") === "group" ? 1 : 0, rs.current?.tagName === "HR" ? 1 : 0, rd.current?.getAttribute("role") === "dialog" ? 1 : 0, rsh.current?.getAttribute("role") === "dialog" ? 1 : 0].join("");
  r.menuAttrs = [rm.current?.getAttribute("role"), rm.current?.hasAttribute("data-menu") ? 1 : 0, rm.current?.getAttribute("aria-orientation"), rm.current?.getAttribute("data-x"), rm.current?.parentElement === document.body ? 1 : 0].join("/");
  const it = ri.current as HTMLButtonElement;
  r.itemAttrs = [it.type, it.getAttribute("role"), it.getAttribute("tabindex"), it.className, it.children.length, it.lastElementChild?.tagName].join("/");
  q.unmount();
  const q2 = render(<><button ref={anchor} /><Menu open anchorRef={anchor} onClose={noop} aria-label="M"><MenuItem icon="edit" disabled>One</MenuItem><MenuItem>Two</MenuItem><MenuGroup label="Grp"><MenuItem>Three</MenuItem></MenuGroup><MenuSeparator /></Menu></>);
  const menu = document.querySelector(".menu")!;
  const items = [...menu.querySelectorAll("button")];
  r.item1 = [items[0].children[0].tagName.toLowerCase(), items[0].children[1].tagName.toLowerCase(), items[0].children[1].textContent, items[0].getAttribute("aria-disabled"), items[0].hasAttribute("disabled") ? 1 : 0, items[1].className === "" ? 1 : 0, items[1].children.length].join("/");
  const g = menu.querySelector("[role=group]")!;
  const mt = g.querySelector(".mt")!;
  r.group = [g.tagName.toLowerCase(), g.getAttribute("aria-labelledby") === mt.id && mt.id !== "" ? 1 : 0, mt.textContent, g.children[0] === mt ? 1 : 0, menu.querySelectorAll("hr").length, menu.lastElementChild!.tagName.toLowerCase()].join("/");
  q2.unmount();
  out.dom = r;
});

test("empty text (R3)", () => {
  const noop = () => {};
  const a = createRef();
  const res: number[] = [];
  const m = render(<Modal open title="" closeLabel="" onRequestClose={noop} />); res.push(document.body.lastElementChild!.textContent!.length); m.unmount();
  const s = render(<Sheet open title="" closeLabel="" onRequestClose={noop} />); res.push(document.body.lastElementChild!.textContent!.length); s.unmount();
  const mm = render(<><button ref={a} /><Menu open anchorRef={a} onClose={noop} aria-label=""><MenuGroup label=""><MenuItem /></MenuGroup><MenuSeparator /></Menu></>); res.push(document.querySelector(".menu")!.textContent!.length); mm.unmount();
  out.r3 = { rendered: res.length, lengths: res.join(",") };
});

test("computeMenuPosition (R23)", () => {
  const v = { width: 1000, height: 800 }, m = { width: 200, height: 300 };
  const c = (anchor, align, menu = m) => computeMenuPosition({ anchor, menu, viewport: v, align });
  const cases = [
    [c({ left: 700, top: 100, right: 760, bottom: 130 }, "end"), [560, 134]],
    [c({ left: 700, top: 100, right: 760, bottom: 130 }, "start"), [700, 134]],
    [c({ left: 700, top: 600, right: 760, bottom: 630 }, "end"), [560, 296]],
    [c({ left: 0, top: 50, right: 20, bottom: 80 }, "end"), [8, 84]],
    [c({ left: 950, top: 50, right: 990, bottom: 80 }, "start"), [792, 84]],
    [c({ left: 100, top: 70, right: 160, bottom: 100 }, "start", { width: 200, height: 900 }), [100, 8]],
    [c({ left: 0, top: 0, right: 0, bottom: 0 }, "end"), [8, 4]],
  ];
  out.r23 = { cases: cases.length, matched: cases.filter(([g, w]) => g.left === w[0] && g.top === w[1]).length };
});

test("useMenuTrigger (R24)", () => {
  let api;
  function T() { api = useMenuTrigger<HTMLButtonElement>(); return <button {...api.triggerProps} />; }
  const u = render(<T />);
  const b = u.container.querySelector("button")!;
  const r: Record<string, unknown> = {};
  r.triggerKeys = Object.keys(api.triggerProps).sort().join(",");
  r.menuKeys = Object.keys(api.menuProps).sort().join(",");
  r.attrs = b.getAttribute("aria-haspopup") + "/" + b.getAttribute("aria-expanded");
  fireEvent.click(b); r.afterClick = b.getAttribute("aria-expanded");
  fireEvent.click(b); r.afterSecondClick = b.getAttribute("aria-expanded");
  fireEvent.keyDown(b, { key: "ArrowDown" }); r.down = b.getAttribute("aria-expanded") + "/" + api.menuProps.openFocus;
  api.menuProps.onClose("escape");
  fireEvent.keyDown(b, { key: "ArrowUp" }); r.up = b.getAttribute("aria-expanded") + "/" + api.menuProps.openFocus;
  out.r24 = r;
  u.unmount();
});

// ---------- CSS (R25 to R28) ----------
const css = (f: string) => readFileSync(join(src, "components", f), "utf8");
const norm = (v: string) => v.trim().replace(/'/g, '"').replace(/\s*,\s*/g, ",").replace(/\s+/g, " ").replace(/(^|[^\d])\.(\d)/g, "$10.$2").replace(/\s*!\s*important/g, "!important");
function parse(file: string) {
  const rules: { sel: string; media: string | null; d: Record<string, string> }[] = [];
  postcss.parse(css(file)).walkRules((rule) => {
    const d: Record<string, string> = {};
    rule.each((n) => { if (n.type === "decl") d[n.prop] = norm(n.value); });
    const p = rule.parent;
    rules.push({ sel: rule.selector.replace(/\s+/g, " ").trim(), media: p && p.type === "atrule" ? p.params.replace(/\s+/g, "") : null, d });
  });
  return rules;
}
const decl = (s: string) => Object.fromEntries(s.split(";").map((x) => x.trim()).filter(Boolean).map((x) => { const i = x.indexOf(":"); return [x.slice(0, i).trim(), norm(x.slice(i + 1))]; }));
const TABLE: [string, string, string | null, string][] = [
  ["Modal.css", ".scrim", null, "position:fixed; inset:0; z-index:20; background:var(--scrim); display:grid; place-items:center; padding:16px"],
  ["Modal.css", ".scrim.opaque", null, "background:var(--bg)"],
  ["Modal.css", ".modal", null, "background:var(--surface); border-radius:var(--radius); box-shadow:var(--pop); width:min(520px,100%); max-height:100%; overflow:auto; border:1px solid var(--line); overscroll-behavior:contain"],
  ["Modal.css", ".modal:focus-visible", null, "outline:0"],
  ["Modal.css", ".modal .mhd", null, "display:flex; align-items:center; padding:16px 18px 6px; gap:8px; position:sticky; top:0; z-index:1; background:var(--surface)"],
  ["Modal.css", ".modal .mhd h2", null, 'margin:0; font-size:17px; flex:1; font-family:"Bricolage Grotesque",sans-serif'],
  ["Modal.css", ".modal .mbd", null, "padding:6px 18px 12px"],
  ["Modal.css", ".modal .mft", null, "display:flex; justify-content:flex-end; gap:8px; padding:10px 18px 16px"],
  ["Sheet.css", ".scrim.sheet", null, "place-items:end center; padding:0"],
  ["Sheet.css", ".scrim.sheet .modal", null, "width:min(520px,100%); max-height:calc(100% - 48px); border-radius:var(--radius) var(--radius) 0 0; border-bottom:0; padding-bottom:env(safe-area-inset-bottom,0px)"],
  ["Menu.css", ".menu", null, "position:fixed; min-width:200px; max-width:min(300px,92%); background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-sm); box-shadow:var(--pop); padding:4px; z-index:30; max-height:calc(100% - 16px); overflow-y:auto"],
  ["Menu.css", ".menu button", null, "display:flex; align-items:center; gap:10px; width:100%; padding:7px 10px; border-radius:7px; color:var(--ink); min-height:32px"],
  ["Menu.css", ".menu button:hover", null, "background:var(--hover)"],
  ["Menu.css", ".menu button:focus-visible", null, "background:var(--hover); outline-offset:-2px"],
  ["Menu.css", ".menu button.dng", null, "color:var(--danger)"],
  ["Menu.css", '.menu button[aria-disabled="true"]', null, "opacity:0.5; cursor:not-allowed"],
  ["Menu.css", ".menu hr", null, "border:0; height:1px; background:var(--line); margin:4px 0"],
  ["Menu.css", ".menu .mt", null, "font-size:11.5px; color:var(--muted); padding:6px 10px 2px; font-weight:600"],
  ["Modal.css", ".scrim", "(max-width:719px)", "padding:12px"],
  ["Modal.css", ".modal", "(max-width:719px)", "width:100%"],
  ["Menu.css", ".menu button", "(max-width:719px)", "min-height:40px"],
];
const NAMED = "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" ");
test("css (R25 to R28)", () => {
  const files = ["Modal.css", "Sheet.css", "Menu.css"].map((f) => [f, join("Menu", f)]);
  const all = [["Modal.css", parse("Modal/Modal.css")], ["Sheet.css", parse("Sheet/Sheet.css")], ["Menu.css", parse("Menu/Menu.css")]] as const;
  const rules = all.flatMap(([f, rs]) => rs.map((r) => ({ f, ...r })));
  let matched = 0, decls = 0, bad = 0;
  for (const [f, sel, media, ds] of TABLE) {
    const hit = rules.filter((r) => r.f === f && r.sel === sel && r.media === media);
    const want = decl(ds);
    if (hit.length === 1) {
      const have = hit[0].d;
      const same = Object.keys(want).length === Object.keys(have).length && Object.entries(want).every(([k, v]) => have[k] === v);
      if (same) matched++; else bad++;
      decls += Object.keys(want).length;
    } else bad++;
  }
  const mediaBlocks = all.map(([f]) => css(f === "Modal.css" ? "Modal/Modal.css" : f === "Sheet.css" ? "Sheet/Sheet.css" : "Menu/Menu.css").split("@media").length - 1).join("/");
  const r25 = { tableRules: TABLE.length, matched, mismatched: bad, extra: rules.length - TABLE.length, decls, media: mediaBlocks };
  out.r25 = r25;
  const tokens = new Set([...readFileSync(resolve(src, "../../tokens/src/tokens.css"), "utf8").matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
  const values = rules.flatMap((r) => Object.entries(r.d).map(([p, v]) => [p, v, r.sel] as const));
  const colors = values.filter(([, v]) => /#|rgb\(|rgba\(|hsl\(|hsla\(|color-mix\(/.test(v) || v.split(/[^a-z]+/).some((w) => NAMED.includes(w))).length;
  const used = new Set(values.flatMap(([, v]) => [...v.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1])));
  const hover = rules.filter((r) => r.sel.includes(":hover"));
  const toastPath = join(src, "components/Toast/Toast.css");
  const toast = existsSync(toastPath) ? postcss.parse(readFileSync(toastPath, "utf8")) : null;
  let toastZ = "none";
  toast?.walkRules((rule) => { if (rule.selector.trim() === ".toasts") rule.each((n) => { if (n.type === "decl" && n.prop === "z-index") toastZ = n.value.trim(); }); });
  const z = (f: string, sel: string) => rules.find((r) => r.f === f && r.sel === sel && r.media === null)?.d["z-index"];
  out.r26 = {
    colours: colors, tokenCount: tokens.size, varsUsed: used.size, unknownVars: [...used].filter((n) => !tokens.has(n)).length,
    dataSelectors: rules.filter((r) => /data-(eff|look|accent|density)/.test(r.sel)).length,
    fontFamily: values.filter(([p]) => p === "font-family").map(([, , s]) => s).join("+"),
    motion: values.filter(([p]) => /^(transition|animation)/.test(p)).length,
  };
  out.r27 = {
    hoverRules: hover.length, hoverOnlyBackground: hover.filter((r) => Object.keys(r.d).join() === "background").length,
    hiding: values.filter(([p, v]) => (p === "opacity" && /^0(\.0+)?$/.test(v)) || (p === "visibility" && v === "hidden") || (p === "display" && v === "none")).length,
  };
  out.r28 = { scrim: z("Modal.css", ".scrim"), menu: z("Menu.css", ".menu"), toasts: toastZ };
});

// ---------- the sources (R3, R27, R31) ----------
function walk(d: string): string[] { return readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
test("sources (R3, R27, R31)", () => {
  const files = ["components/Menu", "components/Modal", "components/Sheet", "internal/overlays"].flatMap((d) => walk(join(src, d))).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/\.examples\.tsx$/.test(f));
  const text = files.map((f) => readFileSync(f, "utf8"));
  const code = text.map((t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""));
  const imports = code.flatMap((t) => [...t.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)].map((m) => m[1]));
  const lits = code.flatMap((t) => [...t.matchAll(/(aria-label|title|label|placeholder|alt)=["']([^"']+)["']/g)]).length;
  const jsxText = code.flatMap((t) => [...t.matchAll(/>\s*([A-Za-z][A-Za-z ,.!?']{2,})\s*</g)]).length;
  const banned = /\b(Notification|localStorage|sessionStorage|indexedDB|serviceWorker|AudioContext|caches)\b|\bnew Audio\b|document\.cookie|<audio/;
  out.src = {
    files: files.length,
    imports: imports.length,
    bannedImports: imports.filter((i) => /^@toki\/(platform|i18n|tokens|client-core|shared)(\/|$)/.test(i)).length,
    i18n: imports.filter((i) => i.includes("@toki/i18n")).length,
    literalProps: lits, jsxText,
    bannedApis: code.filter((t) => banned.test(t)).length,
    onMouseEnter: code.filter((t) => t.includes("onMouseEnter")).length,
    titleAttr: code.filter((t) => /\btitle=\{[^}]*\}/.test(t) && /<(button|div|span|h2|hr)[^>]*\btitle=/.test(t)).length,
  };
});
ZZ_PROBE
  cat > "$WT/$UI/zz-qa/types.tsx" <<'ZZ_TYPES'
import { Button, IconButton, useMenuTrigger } from "../index";
import type { MenuProps, MenuItemProps, MenuGroupProps, MenuSeparatorProps, MenuCloseReason, ModalProps, SheetProps, DialogCloseReason } from "../index";
import type { MenuProps as M2, ModalProps as P2, SheetProps as S2 } from "../components";

export type Used = [MenuProps, MenuItemProps, MenuGroupProps, MenuSeparatorProps, MenuCloseReason, ModalProps, SheetProps, DialogCloseReason, M2, P2, S2];
export function Trigger() {
  const t = useMenuTrigger<HTMLButtonElement>();
  return (
    <>
      <IconButton icon="x" label="Demo" {...t.triggerProps} />
      <Button {...t.triggerProps}>Demo</Button>
      <button {...t.triggerProps} />
    </>
  );
}
ZZ_TYPES
  cat > "$WT/$UI/zz-qa/errors.tsx" <<'ZZ_ERRORS'
import { createRef } from "react";
import { Menu, MenuGroup, MenuItem, Modal } from "../index";

const noop = () => {};
const anchor = createRef<HTMLElement>();

// @ts-expect-error neither title nor a name
export const e1 = <Modal open onRequestClose={noop} />;
// @ts-expect-error title and aria-label together
export const e2 = <Modal open title="T" aria-label="L" onRequestClose={noop} />;
// @ts-expect-error closeLabel with no title
export const e3 = <Modal open aria-label="L" closeLabel="C" onRequestClose={noop} />;
// @ts-expect-error no onRequestClose
export const e4 = <Modal open title="T" />;
// @ts-expect-error footer with no title
export const e5 = <Modal open aria-label="L" footer="F" onRequestClose={noop} />;
// @ts-expect-error backdrop is dim or opaque
export const e6 = <Modal open title="T" backdrop="dark" onRequestClose={noop} />;
// @ts-expect-error Menu without a name
export const e7 = <Menu open anchorRef={anchor} onClose={noop} />;
// @ts-expect-error Menu without anchorRef
export const e8 = <Menu open aria-label="M" onClose={noop} />;
// @ts-expect-error align is end or start
export const e9 = <Menu open anchorRef={anchor} onClose={noop} aria-label="M" align="center" />;
// @ts-expect-error variant is default or danger
export const e10 = <MenuItem variant="loud" />;
// @ts-expect-error a group needs its label
export const e11 = <MenuGroup />;
ZZ_ERRORS
}
put_browser() {
  cat > "$WT/apps/web/zz-qa.html" <<'ZZ_HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="data:," />
    <title>qa</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/zz-qa.tsx"></script>
  </body>
</html>
ZZ_HTML
  cat > "$WT/apps/web/src/zz-qa.tsx" <<'ZZ_PAGE'
// @ts-nocheck
import "@toki/tokens/tokens.css";
import "@toki/ui-web/base.css";
import { createRoot } from "react-dom/client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Button, Menu, MenuGroup, MenuItem, MenuSeparator, Modal, Sheet,
  ToastProvider, useToasts, useMenuTrigger, computeMenuPosition,
} from "@toki/ui-web";
import { componentExamples } from "@toki/ui-web/examples";

const q = new URLSearchParams(location.search);
const S = q.get("s") ?? "lab";
const w = window as any;
w.__log = [] as string[];
w.__react = 0;
const log = (s: string) => w.__log.push(s);
const act = () => (document.activeElement as HTMLElement)?.id || document.activeElement?.tagName;
w.__cmp = computeMenuPosition;
w.__ids = Object.fromEntries(
  ["Menu", "Modal", "Sheet"].map((n) => [n, componentExamples.find((c) => c.component === n)?.examples.map((e) => e.id) ?? []]),
);
if (q.get("look")) document.documentElement.dataset.eff = q.get("look")!;
if (q.get("bodyov")) document.body.style.overflow = q.get("bodyov")!;
const paras = (n: number) => Array.from({ length: n }, (_, i) => <p key={i}>Demo paragraph {i + 1}</p>);

function Toaster() {
  const api = useToasts();
  w.__toast = () => api.show({ text: "Demo toast", action: { label: "Undo", onPress() {} } });
  return null;
}

function Lab() {
  const bd = (q.get("bd") ?? "dim") as "dim" | "opaque";
  const ignore = (q.get("ignore") ?? "").split(",");
  const alldis = q.get("alldis") === "1";
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  const [x, setX] = useState(false);
  const [swap, setSwap] = useState(false);
  const [showA, setShowA] = useState(true);
  const t = useMenuTrigger<HTMLButtonElement>();
  const p = useMenuTrigger<HTMLButtonElement>();
  w.__lab = { setA, setB, setShowA, setX };
  const req = (name: string, set: (v: boolean) => void) => (r: string) => {
    log(`${name}:${r}`);
    if (!ignore.includes(name)) set(false);
  };
  return (
    <ToastProvider>
      <Toaster />
      <div id="labwrap" onKeyDown={() => { w.__react++; }}>
      <div id="pageA">
        <button id="openA" onClick={() => setA(true)}>open A</button>
        <input id="outside-input" aria-label="outside" />
        <button id="pg-btn">page</button>
        <button id="pt" {...p.triggerProps}>page menu</button>
      </div>
      <div id="skipwrap">
        <div id="pane">pane</div>
        <div id="toastreg" data-layer-skip>toast</div>
      </div>
      <div id="pre" aria-hidden="false">pre</div>
      <div id="preinert" inert>pre-inert</div>
      <div id="blank" style={{ height: 60 }}>blank</div>
      {showA && (
        <Modal open={a} title="A" closeLabel="Close" backdrop={bd} onRequestClose={req("A", setA)}>
          <button id="a-first">a1</button>
          <input id="a-input" aria-label="a input" />
          <button id="openB" onClick={() => setB(true)}>open B</button>
          <button id="a-last">a3</button>
        </Modal>
      )}
      <Modal open={b} title="B" closeLabel="Close" backdrop={(q.get("bdb") ?? "dim") as any} onRequestClose={req("B", setB)}>
        <button id="b-first">b1</button>
        <button id="mt" {...t.triggerProps}>menu</button>
      </Modal>
      <Menu {...t.menuProps} aria-label="M" onClose={(r) => { log(`M:${r}`); t.menuProps.onClose(r); }}>
        <MenuItem id="m1">M one</MenuItem>
        <MenuItem id="m2">M two</MenuItem>
      </Menu>
      <Menu {...p.menuProps} aria-label="P" onClose={(r) => { log(`P:${r}:${act()}`); p.menuProps.onClose(r); }}>
        {swap ? (
          <>
            <MenuItem id="q1" disabled>Q one</MenuItem>
            <MenuItem id="q2">Q two</MenuItem>
          </>
        ) : (
          <>
            <MenuItem id="p1" icon="edit" disabled={true} onClick={() => log("p1:click")}>P one</MenuItem>
            <MenuItem id="p2" disabled={alldis} onClick={() => log(`p2:click:${act()}`)}>P two</MenuItem>
            <MenuSeparator />
            <MenuGroup label="Group">
              <MenuItem id="p3" disabled={alldis} variant="danger" icon="trash">P three</MenuItem>
              <MenuItem id="p4" disabled={alldis} onClick={(e) => { e.preventDefault(); log(`p4:click:${act()}`); if (q.get("swap") === "1") setSwap(true); }}>P four</MenuItem>
            </MenuGroup>
            <MenuItem id="p5" disabled={alldis} onClick={() => { log(`p5:click:${act()}`); setX(true); }}>P five</MenuItem>
          </>
        )}
      </Menu>
      <Modal open={x} title="X" closeLabel="Close" onRequestClose={req("X", setX)}>
        <button id="x1">x1</button>
      </Modal>
      </div>
    </ToastProvider>
  );
}

function Gen() {
  const v = q.get("v")!;
  const [open, setOpen] = useState(false);
  const [mopen, setMopen] = useState(false);
  const [showOpener, setShowOpener] = useState(true);
  const opener = useRef(null);
  const chosen = useRef(null);
  const anchor = useRef(null);
  w.__gen = { setOpen, hide: () => setShowOpener(false), blur: () => (document.activeElement as HTMLElement)?.blur() };
  const ign = ["notab", "onebtn", "ignore"].includes(v);
  const onReq = (r: string) => { log(`G:${r}`); if (!ign) setOpen(false); };
  useLayoutEffect(() => { if (v === "moved" && !open && w.__wasOpen) document.getElementById("out")!.focus(); w.__wasOpen = open; }, [open]);
  const common = { open, onRequestClose: onReq, returnFocus: v !== "norf", returnFocusRef: v === "retref" ? opener : undefined, backdrop: v === "opaque" ? "opaque" : "dim" };
  let dlg;
  if (["initial", "auto", "first", "trap", "retref", "norf", "removed", "plain", "opaque", "ignore", "outfocus", "moved"].includes(v)) {
    dlg = (
      <Modal {...common} title="G" closeLabel={v === "first" || v === "moved" || v === "plain" || v === "retref" || v === "norf" || v === "removed" || v === "opaque" ? "Close" : undefined} initialFocusRef={v === "initial" ? chosen : undefined}>
        {v === "trap" || v === "outfocus" ? (<><button id="t1">t1</button><button id="t2">t2</button><button id="t3">t3</button></>) : (
          <><button id="x1">x1</button><button id="x2" ref={chosen} data-autofocus={v === "auto" ? "" : undefined}>x2</button></>
        )}
      </Modal>
    );
  } else if (v === "panel") {
    dlg = <Modal {...common} aria-label="G"><p>Demo text only.</p></Modal>;
  } else if (v === "texttab") {
    dlg = <Modal {...common} aria-label="G" initialFocusRef={chosen}><p id="t" tabIndex={-1} ref={chosen}>text</p></Modal>;
  } else if (v === "notab") {
    dlg = <Modal {...common} aria-label="G" returnFocus={false} initialFocusRef={chosen}><p id="t" tabIndex={-1} ref={chosen}>text</p></Modal>;
  } else if (v === "onebtn") {
    dlg = <Modal {...common} aria-label="G" returnFocus={false} initialFocusRef={chosen}><p id="t" tabIndex={-1} ref={chosen}>text</p><button id="b1">b1</button></Modal>;
  } else if (v === "same") {
    dlg = (
      <Modal {...common} title="G" closeLabel="Close">
        <button id="sa" ref={anchor}>anchor</button>
        <Menu open={mopen} anchorRef={anchor} aria-label="S" onClose={(r) => { log(`S:${r}`); setMopen(false); }}>
          <MenuItem id="s1">S one</MenuItem>
        </Menu>
      </Modal>
    );
  }
  return (
    <div>
      {showOpener && <button id="open" ref={opener} onClick={() => { setOpen(true); if (v === "same") setMopen(true); }}>open</button>}
      <button id="out">out</button>
      <div id="blank" style={{ height: 40 }}>blank</div>
      {dlg}
    </div>
  );
}

function Lay() {
  const kind = q.get("kind")!;
  const [open, setOpen] = useState(true);
  const t = useMenuTrigger<HTMLButtonElement>();
  useEffect(() => { if (kind === "menu") t.setOpen(true); }, []);
  if (kind === "modal") return <Modal open={open} title="Long" closeLabel="Close" onRequestClose={() => {}}>{paras(60)}</Modal>;
  if (kind === "sheet") return <Sheet open={open} title="Long" closeLabel="Close" onRequestClose={() => {}}>{paras(60)}</Sheet>;
  const pos = q.get("pos") === "bottom" ? { left: 40, bottom: 10 } : { right: 2, top: 60 };
  return (
    <>
      <button id="mt" {...t.triggerProps} style={{ position: "fixed", ...pos }}>anchor</button>
      <Menu {...t.menuProps} aria-label="L">
        <MenuItem>Demo one</MenuItem><MenuItem>Demo two</MenuItem><MenuItem>Demo three</MenuItem>
      </Menu>
    </>
  );
}

function Examples() {
  return (
    <div>
      {["Menu", "Modal", "Sheet"].flatMap((n) =>
        componentExamples.find((c) => c.component === n)!.examples.map((e) => (
          <figure key={n + e.id} data-c={n} data-id={e.id} style={{ margin: 8 }}>{e.element}</figure>
        )),
      )}
    </div>
  );
}

const Root = { lab: Lab, gen: Gen, lay: Lay, examples: Examples }[S]!;
function Ready() { useEffect(() => { w.__ready = 1; }, []); return null; }
createRoot(document.getElementById("root")!).render(<><Root /><Ready /></>);
ZZ_PAGE
  cat > "$WT/zz-browser.mjs" <<'ZZ_DRIVER'
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const [base, out] = process.argv.slice(2);
const R = {};
let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  R.blocked = String(e.message).split("\n")[0].slice(0, 120);
  writeFileSync(out, JSON.stringify(R));
  process.exit(0);
}
const INIT = () => {
  const live = new Map();
  const key = (t, o) => t + "|" + (typeof o === "object" ? !!(o && o.capture) : !!o);
  const add = document.addEventListener.bind(document);
  const rem = document.removeEventListener.bind(document);
  document.addEventListener = (t, l, o) => { const k = key(t, o); if (!live.has(k)) live.set(k, new Set()); live.get(k).add(l); return add(t, l, o); };
  document.removeEventListener = (t, l, o) => { live.get(key(t, o))?.delete(l); return rem(t, l, o); };
  window.__listeners = () => ["keydown", "pointerdown", "focusin"].map((t) => [...live].filter(([k]) => k.startsWith(t + "|")).reduce((n, [, s]) => n + s.size, 0));
  window.__seen = 0;
  add("keydown", (e) => { if (e.key === "Escape") window.__seen++; });
};
async function open(params, vp = { width: 1100, height: 700 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  page.__errors = 0;
  page.on("pageerror", () => page.__errors++);
  await page.addInitScript(INIT);
  await page.goto(`${base}/zz-qa.html?${params}`);
  await page.waitForFunction(() => window.__ready === 1);
  await page.waitForTimeout(60);
  return page;
}
const act = (p) => p.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName);
const log = (p) => p.evaluate(() => window.__log.join(","));
const press = async (p, k, n = 1) => { for (let i = 0; i < n; i++) await p.keyboard.press(k); };
const count = (p, sel) => p.locator(sel).count();

// ---------------- stack, Esc, outside (R8, R9, R10) ----------------
{
  const p = await open("s=lab");
  const r = {};
  await p.click("#openA"); await p.click("#openB"); await p.click("#mt");
  r.layers = await count(p, ".scrim, .menu");
  await press(p, "Escape", 3);
  r.escOrder = await log(p);
  r.seenWhileOpen = await p.evaluate(() => window.__seen);
  r.reactSaw = await p.evaluate(() => window.__react);
  r.stackedOpenAfter = await count(p, ".scrim, .menu");
  await press(p, "Escape");
  r.seenEmpty = await p.evaluate(() => window.__seen);
  // composition
  await p.click("#openA");
  await p.evaluate(() => { window.__log.length = 0; window.__ev = []; document.addEventListener("keydown", (e) => window.__ev.push(e.defaultPrevented ? 1 : 0)); });
  await p.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true, cancelable: true })));
  await p.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 229, bubbles: true, cancelable: true })));
  r.imeRequests = (await log(p)) === "" ? 0 : 1;
  r.imeStillOpen = await count(p, ".scrim");
  r.imeNotStopped = await p.evaluate(() => window.__ev.join(""));
  await press(p, "Escape");
  r.afterImeEsc = await log(p);
  R.r9 = r;
  await p.close();
}
{
  // reasons and outside
  const p = await open("s=lab");
  const r = {};
  await p.click("#openA");
  const scrim = await p.locator(".scrim").boundingBox();
  const panel = await p.locator(".modal").boundingBox();
  await p.evaluate(() => (window.__log.length = 0));
  // press and release on the panel: no request
  await p.mouse.click(panel.x + panel.width / 2, panel.y + panel.height / 2);
  r.panelPress = await log(p);
  // begin in the panel, end on the scrim
  await p.mouse.move(panel.x + 20, panel.y + panel.height / 2); await p.mouse.down();
  await p.mouse.move(scrim.x + 3, scrim.y + 3); await p.mouse.up();
  r.dragOut = await log(p);
  r.openAfterDragOut = await count(p, ".scrim");
  // outside
  await p.mouse.click(scrim.x + 3, scrim.y + 3);
  r.outside = await log(p);
  await p.click("#openA"); await p.evaluate(() => (window.__log.length = 0));
  await p.click(".modal .mhd button");
  r.close = await log(p);
  r.escape = await (async () => { await p.click("#openA"); await p.evaluate(() => (window.__log.length = 0)); await press(p, "Escape"); return log(p); })();
  R.r8 = r;
  await p.close();
}
{
  // R10: menu over a modal; press outside the menu on the scrim
  const p = await open("s=lab");
  const r = {};
  await p.click("#openA"); await p.click("#openB"); await p.click("#mt");
  await p.evaluate(() => (window.__log.length = 0));
  const scrims = p.locator(".scrim");
  const sb = await scrims.nth(1).boundingBox();
  await p.mouse.click(sb.x + 3, sb.y + 3);
  r.first = await log(p);
  r.menuLeft = await count(p, ".menu");
  r.modalsLeft = await count(p, ".scrim");
  await p.evaluate(() => (window.__log.length = 0));
  await p.mouse.click(sb.x + 3, sb.y + 3);
  r.second = await log(p);
  R.r10 = r;
  await p.close();
}
{
  // dialog that is not dismissed
  const p = await open("s=lab&ignore=A");
  const r = {};
  await p.click("#openA"); await p.fill("#a-input", "typed");
  const sb = await p.locator(".scrim").boundingBox();
  await press(p, "Escape"); await p.mouse.click(sb.x + 3, sb.y + 3); await press(p, "Tab", 2); await press(p, "a");
  r.open = await count(p, ".scrim");
  r.value = await p.inputValue("#a-input");
  r.requests = await log(p);
  R.r8ignore = r;
  await p.close();
}

// ---------------- scroll lock, isolation, cleanup (R4, R14, R15, R34) ----------------
{
  const p = await open("s=lab&bodyov=scroll");
  const r = {};
  const base0 = await p.evaluate(() => ({ kids: document.body.children.length, ls: window.__listeners(), ov: document.body.style.overflow, inert: document.querySelectorAll("[inert]").length }));
  await p.click("#openA");
  r.ov1 = await p.evaluate(() => document.body.style.overflow);
  r.openListeners = await p.evaluate(() => window.__listeners().join("/"));
  await p.click("#openB");
  r.ov2 = await p.evaluate(() => document.body.style.overflow);
  await press(p, "Escape");
  r.ovAfterOne = await p.evaluate(() => document.body.style.overflow);
  await press(p, "Escape");
  r.ovAfterAll = await p.evaluate(() => document.body.style.overflow);
  r.base = base0;
  r.after = await p.evaluate(() => ({ kids: document.body.children.length, ls: window.__listeners(), ov: document.body.style.overflow, inert: document.querySelectorAll("[inert]").length }));
  r.sameAfter = JSON.stringify(base0) === JSON.stringify(r.after) ? 1 : 0;
  // unmount while open
  await p.click("#openA");
  await p.evaluate(() => window.__lab.setShowA(false));
  await p.waitForTimeout(150);
  r.unmounted = await p.evaluate(() => ({ kids: document.body.children.length, ls: window.__listeners(), ov: document.body.style.overflow, inert: document.querySelectorAll("[inert]").length }));
  r.sameAfterUnmount = JSON.stringify(base0) === JSON.stringify(r.unmounted) ? 1 : 0;
  // menu does not lock
  await p.evaluate(() => (document.body.style.overflow = "scroll"));
  await p.click("#pt");
  r.menuOpen = await count(p, ".menu");
  r.ovMenu = await p.evaluate(() => document.body.style.overflow);
  r.lsMenu = await p.evaluate(() => window.__listeners().join("/"));
  await press(p, "Escape");
  await p.waitForTimeout(100);
  r.lsMenuClosed = await p.evaluate(() => window.__listeners().join("/"));
  r.menuClosedCount = await count(p, ".menu");
  R.r4 = r;
  await p.close();
}
for (const bd of ["opaque", "dim"]) {
  const p = await open(`s=lab&bd=${bd}`);
  const r = {};
  const snap = () => p.evaluate(() => {
    const f = (id) => { const e = document.getElementById(id); return e.hasAttribute("inert") + "/" + e.getAttribute("aria-hidden"); };
    return { pageA: f("pageA"), pane: f("pane"), toastreg: f("toastreg"), skipwrap: f("skipwrap"), root: f("root"), pre: f("pre"), preinert: f("preinert") };
  });
  r.before = await snap();
  await p.click("#openA");
  r.during = await snap();
  r.duringPortal = await p.evaluate(() => document.querySelector(".scrim").hasAttribute("inert") + "/" + document.querySelector(".scrim").getAttribute("aria-hidden"));
  r.scrimOpaque = await p.evaluate(() => document.querySelector(".scrim").classList.contains("opaque") + "/" + getComputedStyle(document.querySelector(".scrim")).backgroundColor + "/" + getComputedStyle(document.body).backgroundColor);
  // a layer that opens later is not inert and is interactive
  await p.click("#openB");
  r.laterInert = await p.evaluate(() => [...document.querySelectorAll(".scrim")].slice(1).map((e) => e.hasAttribute("inert")).join(""));
  await p.click("#mt");
  r.menuInert = await p.evaluate(() => document.querySelector(".menu").hasAttribute("inert"));
  r.menuFocus = await act(p);
  await press(p, "Escape", 3);
  r.after = await snap();
  r.restored = JSON.stringify(r.before) === JSON.stringify(r.after) ? 1 : 0;
  R["r15_" + bd] = r;
  await p.close();
}
{
  // R34: stand-in region stays outside the trap
  const p = await open("s=lab&bd=opaque");
  await p.click("#openA");
  await p.evaluate(() => { const t = document.getElementById("toastreg"); t.innerHTML = '<button id="tbtn">Undo</button>'; });
  const seen = [];
  for (let i = 0; i < 6; i++) { await press(p, "Tab"); seen.push(await act(p)); }
  R.r34 = { tabLandedInRegion: seen.includes("tbtn") ? 1 : 0, regionVisible: await p.evaluate(() => { const e = document.getElementById("tbtn"); return e.getBoundingClientRect().width > 0 ? 1 : 0; }) };
  await p.close();
}

// ---------------- focus (R11, R12, R13, R16, R33) ----------------
const gen = async (v, extra = "") => {
  const p = await open(`s=gen&v=${v}${extra}`);
  return p;
};
{
  const r = {};
  for (const v of ["initial", "auto", "first", "panel", "texttab"]) {
    const p = await gen(v);
    await p.click("#open");
    r[v] = await p.evaluate(() => { const a = document.activeElement; return a.getAttribute("role") === "dialog" ? "panel" : a.id || a.getAttribute("aria-label") || a.tagName; });
    if (v === "first") r[v] = await p.evaluate(() => document.activeElement.getAttribute("aria-label"));
    await p.close();
  }
  R.r11 = r;
}
{
  const r = {};
  let p = await gen("trap");
  await p.click("#open");
  r.first = await act(p);
  await p.focus("#t3"); await press(p, "Tab"); r.lastTab = await act(p);
  await press(p, "Shift+Tab"); r.firstShiftTab = await act(p);
  await p.evaluate(() => document.querySelector("[role=dialog]").focus()); await press(p, "Tab"); r.panelTab = await act(p);
  await p.evaluate(() => document.querySelector("[role=dialog]").focus()); await press(p, "Shift+Tab"); r.panelShiftTab = await act(p);
  await p.close();
  p = await gen("outfocus");
  await p.click("#open");
  await p.evaluate(() => document.getElementById("out").focus());
  await p.waitForTimeout(50);
  r.outside = await p.evaluate(() => { const a = document.activeElement; return document.querySelector("[role=dialog]").contains(a) ? 1 : 0; });
  await p.close();
  p = await gen("notab");
  await p.click("#open");
  r.notabStart = await act(p);
  await press(p, "Tab"); r.notabTab = await act(p);
  await press(p, "Shift+Tab"); r.notabShiftTab = await act(p);
  await press(p, "Escape"); const sb = await p.locator(".scrim").boundingBox(); await p.mouse.click(sb.x + 3, sb.y + 3);
  r.notabOpen = await count(p, ".scrim");
  await p.close();
  p = await gen("onebtn");
  await p.click("#open");
  r.oneStart = await act(p);
  await press(p, "Tab"); r.oneTab = await act(p);
  await press(p, "Tab"); r.oneTab2 = await act(p);
  await p.focus("#t"); await press(p, "Shift+Tab"); r.oneShift = await act(p);
  await press(p, "Escape");
  r.oneOpen = await count(p, ".scrim");
  await p.close();
  p = await open("s=lab");
  await p.click("#openA"); await p.click("#openB"); await p.click("#mt");
  r.menuStart = await act(p);
  await press(p, "ArrowDown"); r.menuArrow = await act(p);
  await p.close();
  R.r12 = r;
}
{
  const r = {};
  let p = await gen("plain");
  await p.click("#open"); await press(p, "Escape");
  r.normal = await act(p);
  await p.close();
  p = await gen("norf");
  await p.click("#open"); await press(p, "Escape");
  r.norf = await act(p);
  await p.close();
  p = await gen("plain");
  await p.click("#open");
  await p.evaluate(() => window.__gen.hide());
  await press(p, "Escape");
  r.removed = (await act(p)) + "/" + p.__errors;
  await p.close();
  p = await gen("plain");
  await p.evaluate(() => { document.activeElement.blur(); document.getElementById("open").click(); });
  r.bodyOpen = await count(p, ".scrim");
  await press(p, "Escape");
  r.bodyNoRef = await act(p);
  await p.close();
  p = await gen("retref");
  await p.evaluate(() => { document.activeElement.blur(); document.getElementById("open").click(); });
  await press(p, "Escape");
  r.bodyRef = await act(p);
  await p.close();
  p = await gen("moved");
  await p.click("#open"); await press(p, "Escape");
  r.moved = await act(p);
  await p.close();
  // stacked: close B returns into A's element
  p = await open("s=lab");
  await p.click("#openA"); await p.click("#openB");
  await press(p, "Escape"); r.stackB = await act(p);
  await press(p, "Escape"); r.stackA = await act(p);
  await p.close();
  // hidden opener
  p = await gen("plain");
  await p.click("#open");
  await p.evaluate(() => (document.getElementById("open").style.visibility = "hidden"));
  await press(p, "Escape");
  r.hidden = (await act(p)) + "/" + p.__errors;
  await p.close();
  R.r13 = r;
}
{
  // R16 dialog that cannot be dismissed, ignore: Esc, outside, keys; no close button
  const p = await gen("ignore");
  await p.click("#open");
  const sb = await p.locator(".scrim").boundingBox();
  await press(p, "Escape"); await p.mouse.click(sb.x + 3, sb.y + 3); await press(p, "a");
  R.r16 = { open: await count(p, ".scrim"), requests: await log(p), closeButtons: await count(p, ".modal .mhd button") };
  await p.close();
  // R9 same commit: a Menu that is a child of the Modal
  const p2 = await gen("same");
  await p2.click("#open");
  await p2.evaluate(() => (window.__log.length = 0));
  await press(p2, "Escape", 2);
  R.r9same = await log(p2);
  await p2.close();
  // R33 opaque dialog over a dim dialog: focus returns into the dim one
  const p3 = await open("s=lab&bd=dim&bdb=opaque");
  await p3.click("#openA");
  await p3.click("#openB");
  R.r33 = {};
  R.r33.dimInertWhileOpaque = await p3.evaluate(() => document.querySelectorAll(".scrim")[0].hasAttribute("inert") ? 1 : 0);
  await press(p3, "Escape");
  R.r33.afterB = await act(p3);
  R.r33.dimInertAfter = await p3.evaluate(() => document.querySelectorAll(".scrim")[0].hasAttribute("inert") ? 1 : 0);
  await p3.close();
  const p4 = await open("s=lab&bd=opaque");
  await p4.click("#openA");
  R.r33.opaqueFocusIn = await p4.evaluate(() => document.querySelector("[role=dialog]").contains(document.activeElement) ? 1 : 0);
  await press(p4, "Escape");
  R.r33.opaqueReturn = await act(p4);
  await p4.close();
}

// ---------------- Menu (R17 to R22, R24) ----------------
{
  const p = await open("s=lab");
  const r = {};
  const seq = async (keys) => { const o = []; for (const k of keys) { await press(p, k); o.push(await act(p)); } return o.join(","); };
  await p.click("#pt");
  r.clickOpen = await act(p);
  r.expanded = await p.getAttribute("#pt", "aria-expanded");
  r.keys = await seq(["ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowUp", "Home", "End", "ArrowDown", "ArrowUp"]);
  r.other = await seq(["a", "x"]);
  // Esc
  await press(p, "Escape");
  r.escape = (await log(p)) + "|" + (await act(p));
  // ArrowDown / ArrowUp on the trigger
  await p.evaluate(() => (window.__log.length = 0));
  await p.focus("#pt"); await press(p, "ArrowDown"); r.trigDown = await act(p);
  await press(p, "Escape");
  await p.focus("#pt"); await press(p, "ArrowUp"); r.trigUp = await act(p);
  // Tab
  await p.evaluate(() => (window.__log.length = 0));
  await press(p, "Tab");
  r.tab = (await log(p)) + "|" + (await act(p)) + "|" + (await count(p, ".menu"));
  // choose: onClick first with focus on the item, then onClose select with focus on the anchor
  await p.evaluate(() => (window.__log.length = 0));
  await p.click("#pt"); await p.click("#p2");
  r.choose = (await log(p)) + "|" + (await act(p)) + "|" + (await count(p, ".menu"));
  // preventDefault keeps it open and arrow keys keep working
  await p.evaluate(() => (window.__log.length = 0));
  await p.click("#pt"); await p.click("#p4");
  r.keep = (await log(p)) + "|" + (await act(p)) + "|" + (await count(p, ".menu"));
  await press(p, "ArrowUp"); r.keepArrow = await act(p);
  // disabled item: nothing, still open
  await p.evaluate(() => (window.__log.length = 0));
  await p.click("#p1", { force: true });
  r.disabled = (await log(p)) + "|" + (await count(p, ".menu"));
  await press(p, "Escape");
  // Enter and Space press the focused item
  await p.evaluate(() => (window.__log.length = 0));
  await p.click("#pt"); await press(p, "Enter");
  r.enter = await log(p);
  await p.evaluate(() => (window.__log.length = 0));
  await p.click("#pt"); await press(p, "Space");
  r.space = await log(p);
  // opens a dialog: the dialog returns focus to the anchor
  await p.evaluate(() => (window.__log.length = 0));
  await p.click("#pt"); await p.click("#p5");
  r.dialogOpen = await count(p, ".scrim");
  await press(p, "Escape");
  r.dialogReturn = await act(p);
  // outside press, not on the anchor
  await p.evaluate(() => (window.__log.length = 0));
  await p.click("#pt");
  await p.click("#pg-btn");
  r.outside = (await log(p)) + "|" + (await act(p));
  // outside press on a non-focusable place: body then focus to the anchor
  await p.evaluate(() => (window.__log.length = 0));
  await p.click("#pt");
  await p.evaluate(() => document.getElementById("blank").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })));
  await p.waitForTimeout(100);
  r.outsideBlank = (await log(p)) + "|" + (await act(p));
  // a press on the anchor is not an outside press
  await p.evaluate(() => (window.__log.length = 0));
  await p.click("#pt"); await p.click("#pt");
  r.anchorToggle = (await log(p)) + "|" + (await count(p, ".menu"));
  // anchor that cannot take focus
  await p.click("#pt");
  await p.evaluate(() => { document.getElementById("pt").style.visibility = "hidden"; (window.__log.length = 0); });
  const e0 = p.__errors;
  await press(p, "Escape");
  await p.waitForTimeout(100);
  r.hiddenAnchor = (p.__errors - e0) + "|" + (await count(p, ".menu")) + "|" + (await log(p)).split(":").slice(0, 2).join(":");
  await p.close();
  R.menu = r;
  // all disabled: focus goes to the first
  const q3 = await open("s=lab&swap=1");
  await q3.click("#pt"); await q3.click("#p4");
  await q3.waitForTimeout(100);
  R.menuSwap = await act(q3);
  await q3.close();
  const q2 = await open("s=lab&alldis=1");
  await q2.click("#pt");
  R.menuAllDisabled = await act(q2);
  await q2.close();
}

// ---------------- position (R23) and layout (R29) ----------------
const WIDTHS = [[360, 560], [719, 700], [720, 700], [1099, 700], [1100, 700]];
const LOOKS = ["calm", "focus"];
{
  // R23 in the browser: left/top equal computeMenuPosition and change after a resize
  const p = await open("s=lay&kind=menu&pos=bottom", { width: 800, height: 600 });
  const r = {};
  const read = () => p.evaluate(() => {
    const m = document.querySelector(".menu"), a = document.getElementById("mt").getBoundingClientRect();
    const mr = m.getBoundingClientRect();
    const want = window.__cmp({ anchor: { left: a.left, top: a.top, right: a.right, bottom: a.bottom }, menu: { width: mr.width, height: mr.height }, viewport: { width: innerWidth, height: innerHeight }, align: "end" });
    return { l: Math.round(mr.left), t: Math.round(mr.top), wl: Math.round(want.left), wt: Math.round(want.top), a: Math.round(a.top), b: Math.round(mr.bottom) };
  });
  const a = await read();
  r.sameBefore = a.l === a.wl && a.t === a.wt ? 1 : 0;
  await p.setViewportSize({ width: 500, height: 400 });
  await p.waitForTimeout(100);
  const b = await read();
  r.sameAfterResize = b.l === b.wl && b.t === b.wt ? 1 : 0;
  r.changed = a.t !== b.t || a.l !== b.l ? 1 : 0;
  r.inlineLeftTop = await p.evaluate(() => { const s = document.querySelector(".menu").style; return s.left !== "" && s.top !== "" ? 1 : 0; });
  R.r23browser = r;
  await p.close();
}
const combos = [];
for (const look of LOOKS) for (const [w, h] of WIDTHS) combos.push({ look, w, h });
const L = { modal: [], sheet: [], menuItems: [], menuPlace: [] };
for (const c of combos) {
  const vp = { width: c.w, height: c.h };
  const narrow = c.w <= 719;
  for (const kind of ["modal", "sheet"]) {
    const p = await open(`s=lay&kind=${kind}&look=${c.look}`, vp);
    const m = await p.evaluate(async () => {
      const el = document.querySelector(".modal"), h = el.querySelector(".mhd"), btn = h.querySelector("button");
      const rect = (e) => e.getBoundingClientRect();
      const o = { overscroll: getComputedStyle(el).overscrollBehavior, scroll: el.scrollHeight > el.clientHeight ? 1 : 0, panelH: rect(el).height, vh: innerHeight, vw: innerWidth, sticky: getComputedStyle(h).position };
      o.closeH = rect(btn).height;
      el.scrollTop = 400;
      await new Promise((r) => requestAnimationFrame(r));
      const e = rect(el), hh = rect(h), bb = rect(btn);
      o.headerAtTop = Math.abs(hh.top - e.top) <= 2 ? 1 : 0;
      o.closeInView = bb.top >= e.top && bb.bottom <= e.bottom ? 1 : 0;
      o.bodyScrolled = el.scrollTop > 0 ? 1 : 0;
      o.panelRight = Math.round(e.right); o.panelLeft = Math.round(e.left); o.panelBottom = Math.round(e.bottom); o.panelW = Math.round(e.width);
      return o;
    });
    await p.close();
    L[kind].push({ ...c, ...m });
  }
  // menu from the bottom edge and from the right edge
  {
    const p = await open(`s=lay&kind=menu&pos=bottom&look=${c.look}`, vp);
    const m = await p.evaluate(() => { const mr = document.querySelector(".menu").getBoundingClientRect(), a = document.getElementById("mt").getBoundingClientRect(); return { above: mr.bottom <= a.top ? 1 : 0, inside: mr.top >= 8 && mr.left >= 8 && mr.right <= innerWidth - 8 && mr.bottom <= innerHeight - 8 ? 1 : 0 }; });
    await p.close();
    const p2 = await open(`s=lay&kind=menu&pos=right&look=${c.look}`, vp);
    const m2 = await p2.evaluate(() => { const mr = document.querySelector(".menu").getBoundingClientRect(); return { gap: Math.round(innerWidth - mr.right), minItem: Math.round(Math.min(...[...document.querySelectorAll(".menu button")].map((b) => b.getBoundingClientRect().height))) }; });
    await p2.close();
    L.menuPlace.push({ ...c, ...m, ...m2 });
  }
}
R.layout = L;
{
  // the 14-row menu (groups example)
  const out = [];
  for (const look of LOOKS) for (const [w, h] of [[360, 560], [360, 420]]) {
    const p = await open(`s=examples&look=${look}`, { width: w, height: h });
    await p.click('figure[data-c="Menu"][data-id="groups"] button >> nth=0');
    const m = await p.evaluate(async () => {
      const el = document.querySelector(".menu");
      const rows = el.querySelectorAll('button[role=menuitem], .mt, hr').length;
      const o = { rows, mh: Math.round(el.getBoundingClientRect().height), overflow: el.scrollHeight > el.clientHeight ? 1 : 0 };
      el.scrollTop = el.scrollHeight;
      await new Promise((r) => requestAnimationFrame(r));
      const items = el.querySelectorAll("button"); const last = items[items.length - 1].getBoundingClientRect(), e = el.getBoundingClientRect();
      o.lastReachable = last.bottom <= e.bottom + 1 ? 1 : 0;
      return o;
    });
    await p.close();
    out.push({ look, w, vh: h, ...m });
  }
  R.menu14 = out;
}

// ---------------- the 13 examples (R30) ----------------
{
  const p = await open("s=examples");
  const ids = await p.evaluate(() => window.__ids);
  const r = { ids, figures: await count(p, "figure[data-c]"), firstBtn: 0, opened: 0, escBack: 0, escCases: 0, btnBack: 0, btnCases: 0 };
  for (const c of ["Menu", "Modal", "Sheet"]) for (const id of ids[c]) {
    const btn = p.locator(`figure[data-c="${c}"][data-id="${id}"] button`).first();
    if (await btn.evaluate((e) => e.classList.contains("btn"))) r.firstBtn++;
    await btn.click();
    if ((await count(p, '[role="dialog"],[role="menu"]')) >= 1) r.opened++;
    const back = async () => (await count(p, '[role="dialog"],[role="menu"]')) === 0 && (await btn.evaluate((e) => e === document.activeElement));
    if (id === "opaque" || id === "no-close") {
      r.btnCases++;
      for (let i = 0; i < 4; i++) { const inside = await p.evaluate(() => { const a = document.activeElement; return a.tagName === "BUTTON" && !!a.closest('[role="dialog"]') && /Done/.test(a.textContent) ? 1 : 0; }); if (inside) break; await press(p, "Tab"); }
      await press(p, "Enter");
      if (await back()) r.btnBack++;
    } else {
      r.escCases++;
      await press(p, "Escape");
      if (await back()) r.escBack++;
    }
  }
  R.r30 = r;
  await p.close();
}

// ---------------- z-order (R28) ----------------
{
  const p = await open("s=lab");
  await p.click("#openA"); await p.click("#openB"); await p.click("#mt");
  await p.evaluate(() => window.__toast());
  await p.waitForSelector(".toast");
  R.r28 = await p.evaluate(() => {
    const z = (sel) => getComputedStyle(document.querySelector(sel)).zIndex;
    const t = document.querySelector(".toast").getBoundingClientRect();
    const top = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
    let ctx = 0;
    for (let e = document.querySelector(".toasts").parentElement; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if ((s.position !== "static" && s.zIndex !== "auto") || s.transform !== "none" || Number(s.opacity) < 1 || s.filter !== "none" || s.isolation === "isolate" || (s.contain && s.contain !== "none")) ctx++;
    }
    return { scrim: z(".scrim"), menu: z(".menu"), toasts: z(".toasts"), toastOnTop: top && top.closest(".toast") ? 1 : 0, ctx, position: getComputedStyle(document.querySelector(".scrim")).position };
  });
  await p.close();
}
await browser.close();
writeFileSync(out, JSON.stringify(R));
ZZ_DRIVER
}

# ---- runs, each made once ---------------------------------------------------------------------
VT0=""; VTM=""
rm_probe() { rm -rf "${WT:?}/${UI:?}/zz-qa"; }
vtrun() { # $1 output file
  put_probe
  pnenv QA_OUT="$1" -- --filter @toki/ui-web exec vitest run src/zz-qa/probe.test.tsx >"$BASE/vt.log" 2>&1
  rm_probe
}
vt() { # $1 row: the probe of the unchanged tree
  need "$1" || return 1
  [ -z "$VT0" ] && { vtrun "$BASE/vt0.json"; VT0=1; }
  [ -s "$BASE/vt0.json" ] && return 0
  echo "$1 the probe did not run (Blocked)"; return 1
}
vtm() { # the probe of a changed tree (R3, R23, R25 to R28, R31), once
  [ -z "$VTM" ] || return 0
  VTM=1
  mut "$UI/components/Menu/menuPlace.ts" 's/anchor\.bottom \+ 4/anchor.bottom + 40/' || { VTM="no"; return 1; }
  mut "$UI/components/Modal/Modal.css" 's/z-index:\s*20/z-index: 21/' || { VTM="no"; reset_wt; return 1; }
  mut "$UI/components/Menu/Menu.css" 's/(\.menu hr \{[^}]*?)background: var\(--line\)/$1background: #cccccc/' || { VTM="no"; reset_wt; return 1; }
  mut "$UI/components/Menu/Menu.css" 's/(font-weight: 600;)/$1\n  transition: opacity 1s;\n  font-family: serif;/' || { VTM="no"; reset_wt; return 1; }
  mut "$UI/components/Menu/Menu.css" 's/(\.menu button:hover \{\s*background: var\(--hover\);)/$1\n  opacity: 0;/' || { VTM="no"; reset_wt; return 1; }
  printf 'import "@toki/i18n";\nexport const zz = window.localStorage;\n' > "$WT/$UI/internal/overlays/zz-extra.ts"
  vtrun "$BASE/vtm.json"
  reset_wt
}
vj() { jq -r "$1" "$BASE/vt0.json"; }
vm() { if [ "$VTM" = 1 ] && [ -s "$BASE/vtm.json" ]; then jq -r "$1" "$BASE/vtm.json"; else echo "none"; fi; }

BR0=""; BRA=""; BRB=""
browser_run() { # $1 output file
  local out="$1" port vp i=0
  put_browser
  port=$(freeport)
  ( cd "$WT" && exec env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm --filter @toki/web exec vite --host 127.0.0.1 --port "$port" --strictPort ) >"$BASE/vite.log" 2>&1 &
  vp=$!; PIDS="$PIDS $vp"
  while [ "$(portbusy "$port")" != busy ] && [ "$i" -lt 80 ]; do sleep 0.5; i=$((i + 1)); done
  if [ "$(portbusy "$port")" = busy ]; then
    ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node zz-browser.mjs "http://127.0.0.1:$port" "$out" ) >"$BASE/drv.log" 2>&1
  fi
  kill_tree "$vp"; wait "$vp" 2>/dev/null
  rm -f "${WT:?}/apps/web/zz-qa.html" "${WT:?}/apps/web/src/zz-qa.tsx" "${WT:?}/zz-browser.mjs"
}
br() { # $1 row: the browser run of the unchanged tree
  need "$1" || return 1
  [ -z "$BR0" ] && { browser_run "$BASE/br0.json"; BR0=1; }
  if [ ! -s "$BASE/br0.json" ]; then echo "$1 the browser run produced no result (Blocked)"; return 1; fi
  if [ "$(jq -r '.blocked // empty' "$BASE/br0.json")" != "" ]; then echo "$1 Chromium could not start: $(jq -r '.blocked' "$BASE/br0.json") (Blocked)"; return 1; fi
  return 0
}
bra() { # the browser run of a tree with changed files (R4, R10, R15, R29, R34), once
  [ -z "$BRA" ] || return 0
  BRA=1
  mut "$UI/internal/overlays/stack.ts" 's/document\.removeEventListener\("keydown", onKeyDown, true\);/\/\* mutated \*\//' || { BRA="no"; return 1; }
  mut "$UI/internal/overlays/isolate.ts" 's/element\.setAttribute\("inert", ""\);/\/\/ mutated/' || { BRA="no"; reset_wt; return 1; }
  mut "$UI/internal/overlays/isolate.ts" 's/if \(child\.hasAttribute\("data-layer-skip"\)\) continue;/\/\/ mutated/' || { BRA="no"; reset_wt; return 1; }
  mut "$UI/components/Modal/Modal.css" 's/position:\s*sticky/position: static/' || { BRA="no"; reset_wt; return 1; }
  mut "$UI/components/Modal/Modal.css" 's/z-index:\s*20/z-index: 21/' || { BRA="no"; reset_wt; return 1; }
  mut "$UI/components/Menu/Menu.css" 's/min-height: 40px/min-height: 30px/' || { BRA="no"; reset_wt; return 1; }
  mut "$UI/components/Menu/Menu.tsx" 's/\n\s*markPressHandled\(event\);/\n/' || { BRA="no"; reset_wt; return 1; }
  browser_run "$BASE/bra.json"
  reset_wt
}
brb() { # the browser run with the order of the stack reversed (R9), once
  [ -z "$BRB" ] || return 0
  BRB=1
  mut "$UI/internal/overlays/stack.ts" 's/a\.order - b\.order/b.order - a.order/' || { BRB="no"; return 1; }
  browser_run "$BASE/brb.json"
  reset_wt
}
bj() { jq -r "$1" "$BASE/br0.json"; }
ba() { if [ "$BRA" = 1 ] && [ -s "$BASE/bra.json" ]; then jq -r "$1" "$BASE/bra.json"; else echo "none"; fi; }
bb() { if [ "$BRB" = 1 ] && [ -s "$BASE/brb.json" ]; then jq -r "$1" "$BASE/brb.json"; else echo "none"; fi; }

tsc_ui() { pnenv -- --filter @toki/ui-web exec tsc --noEmit >/dev/null 2>&1; }
# the full run of the package's own tests, once
FULL=""; FULL_RC=""
full_run() {
  need "$1" || return 1
  if [ -z "$FULL" ]; then
    reset_wt
    pnenv -- --filter @toki/ui-web run test --reporter=json --outputFile="$BASE/full.json" >"$BASE/full.log" 2>&1; FULL_RC=$?
    FULL=1
  fi
  [ -s "$BASE/full.json" ] && return 0
  echo "$1 the tests of the package did not report (Blocked)"; return 1
}
list_added_tests() { git diff --name-status --diff-filter=A "$V^1" "$V" -- "$UI" | awk '{print $2}' | grep -E '\.test\.tsx?$'; }
sc() { jq -r "[.testResults[] | select(.name | endswith(\"$1\")) | .assertionResults | length] | add // 0" "$BASE/full.json"; }

# ---- R1 -----------------------------------------------------------------------------------------
t1() {
  vt T1 || return
  put_probe
  local ok=0 pair=0
  tsc_ui && ok=8
  printf 'import type { NoSuchTypeZz } from "../index";\nexport type Zz = NoSuchTypeZz;\n' >> "$WT/$UI/zz-qa/types.tsx"
  tsc_ui || pair=1
  rm_probe
  echo "T1 $(vj '.r1.values') $(vj '.r1.fromComponents') $ok $(vj '.r1.dialogExported') $pair"
}
t2() {
  local n e have=0 css=0 help=0 c
  for n in Menu Modal Sheet; do
    for e in tsx css test.tsx examples.tsx; do git cat-file -e "$V:$UI/components/$n/$n.$e" 2>/dev/null && have=$((have + 1)); done
    git cat-file -e "$V:$UI/components/$n/index.ts" 2>/dev/null && have=$((have + 1))
    c=$(git ls-tree --name-only "$V" "$UI/components/$n/" | grep -c '\.css$'); [ "$c" = 1 ] && css=$((css + 1))
  done
  for e in Menu/MenuItem.tsx Menu/MenuGroup.tsx Menu/useMenuTrigger.ts Menu/menuPlace.ts Modal/Dialog.tsx; do git cat-file -e "$V:$UI/components/$e" 2>/dev/null && help=$((help + 1)); done
  doc "$UI/components/Menu/MenuGroup.tsx" | grep -q 'MenuSeparator' || help=$((help - 1))
  echo "T2 $have $css $help"
}
t3() {
  local idx ex_imp ex_ent other
  idx=$(git diff --numstat "$V^1" "$V" -- "$UI/components/index.ts" | awk '{print $1, $2}')
  ex_imp=$(git diff "$V^1" "$V" -- "$UI/examples.ts" | grep -cE '^\+import .*components/(Menu|Modal|Sheet)/')
  ex_ent=$(git diff "$V^1" "$V" -- "$UI/examples.ts" | grep -cE '^\+  \{ component: "(Menu|Modal|Sheet)"')
  other=$(git diff --name-status "$V^1" "$V" -- "$UI" | awk '$1 == "M" {print $2}' | grep -v -E "components/index\.ts$|src/examples\.ts$|src/examples\.test\.tsx$" | wc -l | tr -d ' ')
  echo "T3 $idx $ex_imp $ex_ent $other"
}
# ---- R2 -----------------------------------------------------------------------------------------
t4() { vt T4 || return; echo "T4 $(vj '.r1.forwardRef') $(vj '.dom.refs | split("") | map(select(. == "1")) | length')"; }
t5() {
  vt T5 || return
  local n=0
  [ "$(vj '.dom.refs[0:1]')" = 1 ] && n=$((n + 1))
  [ "$(vj '.dom.a_className')" = "modal zz" ] && n=$((n + 1))
  [ "$(vj '.dom.sheet | split("|")[1]')" = "modal zz" ] && n=$((n + 1))
  [ "$(vj '.dom.itemAttrs | split("/")[3]')" = "dng zz" ] && n=$((n + 1))
  echo "T5 $n"
}
t6() {
  vt T6 || return
  local mo=0 it=0 pa=0
  [ "$(vj '.dom.menuAttrs | split("/")[0]')" = menu ] && mo=$((mo + 1))
  [ "$(vj '.dom.menuAttrs | split("/")[2]')" = vertical ] && mo=$((mo + 1))
  [ "$(vj '.dom.itemAttrs | split("/")[0]')" = button ] && it=$((it + 1))
  [ "$(vj '.dom.itemAttrs | split("/")[1]')" = menuitem ] && it=$((it + 1))
  [ "$(vj '.dom.itemAttrs | split("/")[2]')" = "-1" ] && it=$((it + 1))
  [ "$(vj '.dom.a_passes')" = 1 ] && pa=$((pa + 1))
  [ "$(vj '.dom.menuAttrs | split("/")[3]')" = 1 ] && pa=$((pa + 1))
  echo "T6 $(vj '.dom.a_ownedAttrs') $mo $it $pa"
}
t7() {
  local f names
  names=$(for f in components/Modal/Dialog.tsx components/Menu/Menu.tsx components/Menu/MenuItem.tsx components/Menu/MenuGroup.tsx; do doc "$UI/$f" | grep -oE '^\s+on[A-Z][A-Za-z]+\??:' | tr -d ' ?:'; done | sort -u | tr '\n' ' ')
  echo "T7 $(printf '%s' "$names" | wc -w | tr -d ' ') $(printf '%s' "$names" | tr -s ' ' ',' | sed 's/,$//')"
}
# ---- R3 -----------------------------------------------------------------------------------------
t8() {
  vt T8 || return; vtm
  echo "T8 $(vj '.src.files') $(vj '.src.i18n') $(vj '.src.literalProps') $(vj '.src.jsxText') mut $(vm '.src.i18n')"
}
t9() { vt T9 || return; echo "T9 $(vj '.r3.rendered') $(vj '.r3.lengths | split(",") | map(select(. == "0")) | length')"; }
# ---- R4 -----------------------------------------------------------------------------------------
t10() {
  br T10 || return; bra
  echo "T10 $(bj '.r4.sameAfter') $(bj '.r4.sameAfterUnmount') $(bj '.r4.lsMenuClosed') $(bj '.r9.seenEmpty') while-open=$(bj '.r4.openListeners') mut $(ba '.r4.lsMenuClosed')"
}
# ---- R5, R6, R7 ---------------------------------------------------------------------------------
t11() { vt T11 || return; echo "T11 $(vj '.dom.a_scrimLastChild') $(vj '.dom.a_ownedAttrs') $(vj '.dom.a_order') $(vj '.dom.a_h2') $(vj '.dom.a_close') $(vj '.dom.a_footer') $(vj '.dom.a_noClose')"; }
t12() { vt T12 || return; echo "T12 $(vj '.dom.b') $(vj '.dom.b_labelledby')"; }
t13() { vt T13 || return; echo "T13 $(vj '.dom.sheet | split("|") | .[0] | gsub(" "; ".")') $(vj '.dom.sheet | split("|") | .[1] | gsub(" "; ".")') $(vj '.dom.sheet | split("|")[2]')"; }
t14() {
  vt T14 && br T14 || return
  echo "T14 $(vj '.dom.backdrops | split("|") | .[0]') $(vj '.dom.backdrops | split("|") | .[1] | gsub(" "; ".")') $(vj '.dom.backdrops | split("|") | .[2] | gsub(" "; ".")') $(bj '.r11.initial') $(bj '.r13.norf') $(bj '.r13.bodyRef') $(vj '.dom.a_footer')"
}
# ---- R8, R9, R10 --------------------------------------------------------------------------------
t15() {
  br T15 || return
  echo "T15 $(bj '[.r8.escape, .r8.outside, .r8.close] | map(split(":")[1]) | join(",")') $(bj '.r8.panelPress | length') $(bj '.r8.dragOut | length') $(bj '.r8.openAfterDragOut') $(bj '.r8ignore.open') $([ "$(bj '.r8ignore.value')" = typed ] && echo 1 || echo 0)"
}
t16() {
  br T16 || return; brb
  echo "T16 $(bj '.r9.escOrder') $(bj '.r9.escOrder | split(",") | length') $(bj '.r9.reactSaw') $(bj '.r9.seenWhileOpen') $(bj '.r9.seenEmpty') mut $(bb '.r9.escOrder')"
}
t17() { br T17 || return; echo "T17 $(bj '.r9.imeRequests') $(bj '.r9.imeStillOpen') $(bj '.r9.imeNotStopped') $(bj '.r9.afterImeEsc')"; }
t18() { br T18 || return; brb; echo "T18 $(bj '.r9same') mut $(bb '.r9same')"; }
t19() { br T19 || return; bra; echo "T19 $(bj '.r10.first') $(bj '.r10.menuLeft') $(bj '.r10.modalsLeft') $(bj '.r10.second') mut $(ba '.r10.first')"; }
# ---- R11, R12, R13, R16 -------------------------------------------------------------------------
t20() { br T20 || return; echo "T20 $(bj '[.r11.initial, .r11.auto, .r11.first, .r11.panel, .r11.texttab] | join(" ")')"; }
t21() { br T21 || return; echo "T21 $(bj '[.r12.lastTab, .r12.firstShiftTab, .r12.panelTab, .r12.panelShiftTab] | join(" ")')"; }
t22() { br T22 || return; echo "T22 $(bj '[.r12.notabStart, .r12.notabTab, .r12.notabShiftTab, .r12.notabOpen] | join(" ")')"; }
t23() { br T23 || return; echo "T23 $(bj '.r12.outside') $(bj '.r12.menuStart') $(bj '.r12.menuArrow')"; }
t24() { br T24 || return; echo "T24 $(bj '.r13.normal') $(bj '.r13.norf') $(bj '.r13.moved')"; }
t25() { br T25 || return; echo "T25 $(bj '.r13.removed') $(bj '.r13.hidden')"; }
t26() { br T26 || return; echo "T26 $(bj '.r13.bodyNoRef') $(bj '.r13.bodyRef')"; }
t27() { br T27 || return; echo "T27 $(bj '.r13.stackB') $(bj '.r13.stackA')"; }
# ---- R14, R15 -----------------------------------------------------------------------------------
t28() { br T28 || return; echo "T28 $(bj '[.r4.ov1, .r4.ov2, .r4.ovAfterOne, .r4.ovAfterAll, .r4.ovMenu] | join(" ")') $(bj '.layout.modal[0].overscroll')"; }
t29() {
  br T29 || return; bra
  local o='.r15_opaque'
  echo "T29 $(bj "$o.scrimOpaque | split(\"/\") | if .[0] == \"true\" and .[1] == .[2] then 1 else 0 end") $(bj "[$o.during.pageA, $o.during.pane] | map(select(. == \"true/true\")) | length") $(bj "[$o.duringPortal] | map(select(. != \"false/null\")) | length") $(bj "[$o.laterInert, ($o.menuInert | tostring)] | map(select(. != \"false\")) | length") $(bj "$o.restored") $(bj '.r15_dim | if .before == .during then 0 else 1 end') mut $(ba "[$o.during.pageA, $o.during.pane] | map(select(. == \"true/true\")) | length")"
}
t30() { br T30 || return; echo "T30 $(bj '.r16.open') $(bj '.r16.closeButtons') $(bj '.r13.norf') $(bj '.r11.texttab')"; }
t31() { br T31 || return; echo "T31 $(bj '[.r12.oneTab, .r12.oneTab2, .r12.oneShift, .r12.oneOpen] | join(" ")')"; }
# ---- R17 to R24 ---------------------------------------------------------------------------------
t32() { vt T32 || return; echo "T32 $(vj '.dom.menuAttrs | split("/") | [.[0], .[1], .[2], .[4]] | join(" ")') $(vj '.r1.lists | split(" ")[0]')"; }
t33() { vt T33 || return; echo "T33 $(vj '.dom.itemAttrs | split("/") | [.[0], .[1], .[2]] | join(" ")') $(vj '.dom.item1 | split("/") | [.[0], .[1], .[2], .[3], .[4]] | join(" ")')"; }
t34() { vt T34 || return; echo "T34 $(vj '.dom.group | split("/") | join(" ")')"; }
t35() { br T35 || return; echo "T35 $(bj '.menu.clickOpen') $(bj '.menu.trigUp') $(bj '.menuAllDisabled')"; }
t36() { br T36 || return; echo "T36 $(bj '.menu.keys') $(bj '.menu.other')"; }
t37() { br T37 || return; echo "T37 $(bj '.menu.enter | split(",") | map(select(startswith("p2:click"))) | length') $(bj '.menu.space | split(",") | map(select(startswith("p2:click"))) | length')"; }
t38() { br T38 || return; echo "T38 $(bj '.menu.choose | split("|") | join(" ")')"; }
t39() { br T39 || return; echo "T39 $(bj '.menu.keep | split("|") | join(" ")') $(bj '.menu.keepArrow')"; }
t40() { br T40 || return; echo "T40 $(bj '.menu.disabled | split("|") | .[0] | length') $(bj '.menu.disabled | split("|")[1]')"; }
t41() { br T41 || return; echo "T41 $(bj '.menu.dialogOpen') $(bj '.menu.dialogReturn')"; }
t42() { br T42 || return; echo "T42 $(bj '.menuSwap')"; }
t43() { br T43 || return; echo "T43 $(bj '.menu.escape | split("|") | join(" ")')"; }
t44() { br T44 || return; echo "T44 $(bj '.menu.tab | split("|") | join(" ")')"; }
t45() { br T45 || return; echo "T45 $(bj '.menu.outside | split("|") | join(" ")')"; }
t46() { br T46 || return; echo "T46 $(bj '.menu.anchorToggle | split("|") | .[0] | length') $(bj '.menu.anchorToggle | split("|")[1]')"; }
t47() { br T47 || return; echo "T47 $(bj '.menu.outsideBlank | split("|")[1]')"; }
t48() { br T48 || return; echo "T48 $(bj '.menu.hiddenAnchor | split("|") | .[0:2] | join(" ")')"; }
t49() {
  vt T49 && br T49 || return; vtm
  echo "T49 $(vj '.r23.cases') $(vj '.r23.matched') $(bj '[.r23browser.sameBefore, .r23browser.sameAfterResize, .r23browser.changed, .r23browser.inlineLeftTop] | join(" ")') mut $(vm '.r23.matched')"
}
t50() {
  vt T50 || return
  local k m f=0 n
  k=$(vj '.r24.triggerKeys'); m=$(vj '.r24.menuKeys')
  for n in children className type aria-label; do case ",$k," in *",$n,"*) f=$((f + 1));; esac; done
  echo "T50 $([ "$k" = "aria-expanded,aria-haspopup,onClick,onKeyDown,ref" ] && echo 5 || echo 0) $([ "$m" = "anchorRef,onClose,open,openFocus" ] && echo 4 || echo 0) $f"
}
t51() { vt T51 && br T51 || return; echo "T51 $(vj '[.r24.attrs, .r24.afterClick, .r24.afterSecondClick, .r24.down, .r24.up] | join(" ")') $(bj '.menu.trigDown') $(bj '.menu.trigUp')"; }
t52() {
  need T52 || return
  put_probe
  local ok=1 pair=0
  tsc_ui || ok=0
  printf 'export const Zz = () => { const t = useMenuTrigger<HTMLButtonElement>(); return <button {...t.menuProps} />; };\n' >> "$WT/$UI/zz-qa/types.tsx"
  tsc_ui || pair=1
  rm_probe
  echo "T52 $([ "$ok" = 1 ] && echo 0 || echo 1) $pair"
}
# ---- R25 to R28 ---------------------------------------------------------------------------------
t53() {
  vt T53 || return; vtm
  local imp=0
  doc "$UI/components/Menu/Menu.tsx" | grep -q 'import "./Menu.css";' && imp=$((imp + 1))
  doc "$UI/components/Modal/Modal.tsx" | grep -q 'import "./Modal.css";' && imp=$((imp + 1))
  doc "$UI/components/Modal/Dialog.tsx" | grep -q 'import "./Modal.css";' && imp=$((imp + 1))
  doc "$UI/components/Sheet/Sheet.tsx" | grep -q 'import "./Sheet.css";' && imp=$((imp + 1))
  doc "$UI/components/Sheet/Sheet.tsx" | grep -q 'import "../Modal/Modal.css";' && imp=$((imp + 1))
  echo "T53 $(vj '.r25.tableRules') $(vj '.r25.matched') $(vj '.r25.mismatched') $(vj '.r25.extra') $(vj '.r25.media') $imp mut $(vm '.r25.matched')"
}
t54() { vt T54 || return; vtm; echo "T54 $(vj '.r26.colours') mut $(vm '.r26.colours')"; }
t55() { vt T55 || return; echo "T55 $(vj '.r26.varsUsed') $(vj '.r26.unknownVars') $(vj '.r26.tokenCount')"; }
t56() { vt T56 || return; echo "T56 $(vj '.r26.dataSelectors')"; }
t57() { vt T57 || return; vtm; echo "T57 $(vj '.r26.fontFamily | gsub(" "; ".")') mut $(vm '.r26.fontFamily | gsub(" "; ".")')"; }
t58() { vt T58 || return; vtm; echo "T58 $(vj '.r26.motion') mut $(vm '.r26.motion')"; }
t59() { vt T59 || return; vtm; echo "T59 $(vj '.r27.hoverRules') $(vj '.r27.hoverOnlyBackground') $(vj '.r27.hiding') $(vj '.src.onMouseEnter') $(vj '.src.titleAttr') mut $(vm '.r27.hoverOnlyBackground')"; }
t60() {
  vt T60 && br T60 || return; bra
  echo "T60 $(vj '[.r28.scrim, .r28.menu, .r28.toasts] | join(" ")') $(bj '.r28 | [.scrim, .menu, .toasts] | join(" ")') $(bj '.r28.toastOnTop') $(bj '.r28.ctx') mut $(ba '.r28.scrim')"
}
# ---- R29 ----------------------------------------------------------------------------------------
t61() {
  br T61 || return; bra
  echo "T61 $(bj '[.layout.menuPlace[] | select(.w <= 719)] | length') $(bj '[.layout.menuPlace[] | select(.w <= 719 and .minItem >= 40)] | length') $(bj '[.layout.modal[], .layout.sheet[] | select(.w <= 719 and .closeH >= 40)] | length') mut $(ba '[.layout.menuPlace[] | select(.w <= 719 and .minItem >= 40)] | length')"
}
t62() {
  br T62 || return; bra
  echo "T62 $(bj '.layout.modal | length') $(bj '[.layout.modal[] | select(.scroll == 1 and .panelH <= .vh)] | length') $(bj '[.layout.modal[] | select(.headerAtTop == 1)] | length') $(bj '[.layout.modal[] | select(.closeInView == 1)] | length') $(bj '[.layout.modal[] | select(.panelH <= .vh)] | length') mut $(ba '[.layout.modal[] | select(.headerAtTop == 1)] | length')"
}
t63() { br T63 || return; echo "T63 $(bj '.layout.sheet | length') $(bj '[.layout.sheet[] | select(.panelBottom == .vh)] | length') $(bj '[.layout.sheet[] | select(.panelW == ([520, .vw] | min))] | length') $(bj '[.layout.sheet[] | select(.headerAtTop == 1 and .closeInView == 1)] | length')"; }
t64() { br T64 || return; echo "T64 $(bj '.layout.menuPlace | length') $(bj '[.layout.menuPlace[] | select(.above == 1)] | length') $(bj '[.layout.menuPlace[] | select(.inside == 1 and .gap == 8)] | length')"; }
t65() { br T65 || return; echo "T65 $(bj '.menu14[0].rows') $(bj '[.menu14[] | select(.vh == 560 and .overflow == 0 and .mh <= 544)] | length') $(bj '[.menu14[] | select(.vh == 420 and .overflow == 1)] | length') $(bj '[.menu14[] | select(.vh == 420 and .lastReachable == 1)] | length')"; }
t66() {
  if [ "${SERVE:-}" != 1 ]; then
    echo "T66 manual: the likeness to the prototype is compared by eye by the QA; run with SERVE=1 to serve the layers, then paste the result (Blocked until then)"
    return
  fi
  need T66 || return
  put_browser
  local port vp i=0
  port=$(freeport)
  ( cd "$WT" && exec env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm --filter @toki/web exec vite --host 127.0.0.1 --port "$port" --strictPort ) >"$BASE/vite.log" 2>&1 &
  vp=$!; PIDS="$PIDS $vp"
  while [ "$(portbusy "$port")" != busy ] && [ "$i" -lt 80 ]; do sleep 0.5; i=$((i + 1)); done
  echo "T66 serving http://127.0.0.1:$port/zz-qa.html?s=examples&look=calm (look=focus for Focus); resize the window to 360, 719, 720, 1099 and 1100 px; press Enter to stop (this line is not evidence)"
  read -r _ </dev/tty
  kill_tree "$vp"; wait "$vp" 2>/dev/null
}
# ---- R30 ----------------------------------------------------------------------------------------
t67() {
  br T67 || return
  local want='{"Menu":["default","start","groups","danger","disabled","icon"],"Modal":["with-footer","no-footer","label-only","opaque","no-close"],"Sheet":["rows","long-body"]}'
  echo "T67 $(bj '.r30.ids.Menu | length') $(bj '.r30.ids.Modal | length') $(bj '.r30.ids.Sheet | length') $(printf '%s' "$want" | jq -r --slurpfile g "$BASE/br0.json" 'if $g[0].r30.ids == . then 1 else 0 end') $(bj '[.r30.ids[] | length == (unique | length)] | all | if . then 1 else 0 end')"
}
t68() { br T68 || return; vt T68 || return; echo "T68 $(bj '.r30.figures') $(bj '.r30.firstBtn') $(bj '.r30.opened') $(bj '.r30.escBack') $(bj '.r30.escCases') $(bj '.r30.btnBack') $(bj '.r30.btnCases') $(vj '.r1.tail') $(vj '.r1.afterToast')"; }
# ---- R31 ----------------------------------------------------------------------------------------
t69() { vt T69 || return; vtm; echo "T69 $(vj '.src.files') $(vj '.src.imports') $(vj '.src.bannedImports') mut $(vm '.src.bannedImports')"; }
t70() { vt T70 || return; vtm; echo "T70 $(vj '.src.files') $(vj '.src.bannedApis') mut $(vm '.src.bannedApis')"; }
t71() {
  full_run T71 || return
  local nf=0 nt=0 f c
  for f in $(list_added_tests); do nf=$((nf + 1)); c=$(sc "$f"); nt=$((nt + c)); done
  echo "T71 $FULL_RC $(jq -r '.numTotalTests' "$BASE/full.json") $(jq -r '.numFailedTests' "$BASE/full.json") $nf $nt"
}
t72() {
  need T72 || return
  reset_wt
  local a b=0
  pnenv -- lint >/dev/null 2>&1; a=$?
  printf '\nvoid window.localStorage;\n' >> "$WT/$UI/components/Menu/Menu.tsx"
  pnenv -- lint >/dev/null 2>&1 && b=1
  reset_wt
  echo "T72 $a $([ "$b" = 0 ] && echo 1 || echo 0)"
}
t73() {
  need T73 || return
  local rc def=0
  pnenv -- lint:boundaries >/dev/null 2>&1; rc=$?
  [ "$(doc package.json | jq -r '.scripts["lint:boundaries"] // empty')" != "" ] && def=1
  echo "T73 $rc $def"
}
t74() {
  need T74 || return
  reset_wt
  local a b=0
  pnenv -- format:check >/dev/null 2>&1; a=$?
  printf '\nconst   zz   =   1 ;\n' >> "$WT/$UI/components/Menu/Menu.tsx"
  pnenv -- format:check >/dev/null 2>&1 && b=1
  reset_wt
  echo "T74 $a $([ "$b" = 0 ] && echo 1 || echo 0)"
}
t75() {
  need T75 || return
  reset_wt
  local a b=0
  pnenv -- typecheck >/dev/null 2>&1; a=$?
  printf '\nexport const zz: number = "x";\n' >> "$WT/$UI/components/Menu/Menu.tsx"
  pnenv -- typecheck >/dev/null 2>&1 && b=1
  reset_wt
  echo "T75 $a $([ "$b" = 0 ] && echo 1 || echo 0)"
}
t76() {
  need T76 || return
  reset_wt
  local d="$UI/components"
  pnenv -- exec eslint -f json "$d/Menu" "$d/Modal" "$d/Sheet" "$UI/internal/overlays" >"$BASE/e0.json" 2>/dev/null
  printf 'import { Icon } from "../../icons";\nexport const Zz = () => (\n  <button type="button">\n    <Icon name="x" />\n  </button>\n);\n' > "$WT/$d/Menu/zz-icon.tsx"
  pnenv -- exec eslint -f json "$d/Menu" "$d/Modal" "$d/Sheet" "$UI/internal/overlays" >"$BASE/e1.json" 2>/dev/null
  reset_wt
  local q='[.[].messages[] | select(.ruleId == "toki/icon-only-button-name")] | length'
  echo "T76 $(jq -r 'length' "$BASE/e0.json") $(jq -r "$q" "$BASE/e0.json") mut $(jq -r "$q" "$BASE/e1.json")"
}
# ---- R32 ----------------------------------------------------------------------------------------
t77() {
  need T77 || return
  reset_wt
  put_probe
  local f="$WT/$UI/zz-qa/errors.tsx" base=0 marks fail=0 ln
  tsc_ui || base=1
  marks=$(grep -c '@ts-expect-error' "$f")
  cp "$f" "$BASE/errors.bak"
  for ln in $(grep -n '@ts-expect-error' "$BASE/errors.bak" | cut -d: -f1); do
    perl -ni -e "print unless \$. == $ln" "$f"
    tsc_ui || fail=$((fail + 1))
    cp "$BASE/errors.bak" "$f"
  done
  rm_probe
  echo "T77 $base $marks $fail $(doc "$UI/components/Menu/Menu.test.tsx" | grep -c '@ts-expect-error') $(doc "$UI/components/Modal/Modal.test.tsx" | grep -c '@ts-expect-error') $(doc "$UI/components/Sheet/Sheet.test.tsx" | grep -c '@ts-expect-error')"
}
# ---- R33, R34 -----------------------------------------------------------------------------------
t78() { br T78 || return; echo "T78 $(bj '.r33.dimInertWhileOpaque') $(bj '.r33.afterB') $(bj '.r33.dimInertAfter') $(bj '.r33.opaqueFocusIn') $(bj '.r33.opaqueReturn')"; }
t79() {
  br T79 || return; bra
  local q='[.r15_opaque.during.toastreg, .r15_opaque.during.skipwrap, .r15_opaque.during.root] | map(select(endswith("/true"))) | length'
  echo "T79 $(bj "$q") $(bj '.r15_opaque.during.pane | if endswith("/true") then 1 else 0 end') $(bj '.r34.tabLandedInRegion') $(bj '.r34.regionVisible') $(bj '.r15_dim | if .before == .during then 0 else 1 end') mut $(ba "$q")"
}

rows="${*:-T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12 T13 T14 T15 T16 T17 T18 T19 T20 T21 T22 T23 T24 T25 T26 T27 T28 T29 T30 T31 T32 T33 T34 T35 T36 T37 T38 T39 T40 T41 T42 T43 T44 T45 T46 T47 T48 T49 T50 T51 T52 T53 T54 T55 T56 T57 T58 T59 T60 T61 T62 T63 T64 T65 T66 T67 T68 T69 T70 T71 T72 T73 T74 T75 T76 T77 T78 T79}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
alive=0
cleanup; WT=""
for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
echo "CLEAN worktrees $([ "$(git worktree list | grep -cF "$BASE")" = 0 ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive temporary-folder $([ -e "$BASE" ] && echo left || echo removed)"
