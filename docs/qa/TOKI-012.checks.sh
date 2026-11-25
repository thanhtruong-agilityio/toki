#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-012.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile` and one `pnpm add -Dw @playwright/test` inside the temporary worktree
# (both are served from the pnpm store when it is warm); connections to a Vite server on 127.0.0.1.
# It writes nothing to GitHub, opens no pull request and calls no `gh`.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-012.checks.sh [T1 T2 ...]
#   V=<commit> bash docs/qa/TOKI-012.checks.sh SERVE   starts the examples page for the manual rows, prints
#                                                       its address and waits for Enter.
# It reads files of the commit V with `git show`. A row that runs a tool uses ONE temporary worktree of V,
# created on first use under one folder (BASE, made in the current shell, exported as TMPDIR and given to
# every process it starts through `env -i`), installed with `pnpm install --frozen-lockfile` under Node 22.
# The throwaway tests, scripts and page that some rows need are written inside that worktree only. A row
# that changes a file of the worktree restores it with `git checkout` and is paired with an unchanged run.
# Everything the script started (worktree, folder, processes) is removed when it ends, even when a row
# fails. The repository itself is not changed. No `.env` file is read or created. It prints one line for
# each row: counts, exit codes and words; no value of a secret and no tool output. A row that loops prints
# how many items it checked. A row that cannot be shown prints "(Blocked)" and the reason.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack. The browser is the
# Chromium that Playwright has cached on the machine.
set -uo pipefail
V="${V:-HEAD}"
doc() { git show "$V:$1" 2>/dev/null; }
exists() { git cat-file -e "$V:$1" 2>/dev/null; }
files() { git ls-tree -r --name-only "$V" -- "$@" 2>/dev/null; }
has() { local n; n=$(doc "$1" | grep -cE -- "$2"); [ "${n:-0}" -ge 1 ]; }
UI="packages/ui-web"
SPEC="docs/specs/2026-11-16-base-components-1-design.md"

BASE=$(mktemp -d); export TMPDIR="$BASE"
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; PIDS=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; wait "$1" 2>/dev/null; }
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

N22=""; NEED22=0
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  N22=$(ls -d "$HOME"/.nvm/versions/node/v22*/bin 2>/dev/null | tail -1)
  [ -n "$N22" ] || NEED22=1
fi
NODEPATH="${N22:+$N22:}$PATH"
nodebin() { PATH="$NODEPATH" node "$@"; }
# pnenv <VAR=value ...> -- <pnpm args>: runs pnpm in the worktree with only those variables
pnenv() { local envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift; ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" ${envs[@]+"${envs[@]}"} corepack pnpm "$@" ); }
# nenv <dir> <VAR=value ...> -- <node args>: runs node in a folder of the worktree with only those variables
nenv() { local d="$1"; shift; local envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift; ( cd "$WT/$d" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" ${envs[@]+"${envs[@]}"} node "$@" ); }
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
firstline() { head -1 | tr -d '\r' | cut -c1-160; }

# ---- the throwaway sources: written inside the temporary worktree only ------------------------------
KIT="$BASE/kit"
write_kit() {
  [ -d "$KIT" ] && return 0
  mkdir -p "$KIT"
  cat > "$KIT/dom.test.tsx" <<'DOMTEST'
// @ts-nocheck
// Throwaway test of the QA checks (TOKI-012). It lives only in the temporary worktree, records counts in a JSON
// file (QA_OUT) and asserts nothing: the checks script reads the counts.
import { createRef } from "react";
import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import * as Comp from "../components";
import * as Entry from "../index";
import * as Icons from "../icons";
import { componentExamples } from "../examples";
import { readCss } from "../test/css";

const { Button, IconButton, Chip, ChipGroup, Switch, Field, Select, Tag, Badge } = Comp;
const R: Record<string, { ok: number; total: number; bad: string[] }> = {};
const chk = (key: string, label: string, ok: unknown) => {
  const r = (R[key] ??= { ok: 0, total: 0, bad: [] });
  r.total++;
  if (ok) r.ok++;
  else r.bad.push(label);
};
const num = (key: string, value: number) => {
  R[key] = { ok: value, total: value, bad: [] };
};
const sec = async (label: string, fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (e) {
    chk("crash", `${label}: ${String((e as Error).message).split("\n")[0].slice(0, 70)}`, false);
  } finally {
    cleanup();
  }
};
const mount = (el) => render(el).container;
const cls = (e) => (e ? e.getAttribute("class") : null);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const noop = () => {};
const opts = [
  { value: "a", label: "A" },
  { value: "b", label: "B", disabled: true },
  { value: "c", label: "C" },
];

test("collect", async () => {
  const user = userEvent.setup();

  await sec("T1 R1: exports", async () => {
    const names9 = ["Button", "IconButton", "Chip", "ChipGroup", "Switch", "Field", "Select", "Tag", "Badge"];
    const consts = ["buttonVariants", "buttonSizes", "iconButtonSizes", "chipSizes", "fieldVariants", "badgeVariants"];
    for (const n of names9) chk("1a", n, Comp[n] != null);
    for (const n of names9) chk("1b", n, Entry[n] != null);
    for (const n of consts) chk("1c", n, Array.isArray(Comp[n]));
    for (const n of consts) chk("1c", n, Array.isArray(Entry[n]));
    num("1d", Object.keys(Comp).filter((k) => k.endsWith("Icon")).length +
      Object.keys(Entry).filter((k) => k.endsWith("Icon") && !(k in Icons)).length);
  });

  await sec("T3 R2 (a): the lists, in order", async () => {
    chk("3", "buttonVariants", eq(Comp.buttonVariants, ["default", "primary", "danger", "ghost", "link"]));
    chk("3", "buttonSizes", eq(Comp.buttonSizes, ["md", "sm"]));
    chk("3", "iconButtonSizes", eq(Comp.iconButtonSizes, ["md", "sm"]));
    chk("3", "chipSizes", eq(Comp.chipSizes, ["md", "sm"]));
    chk("3", "fieldVariants", eq(Comp.fieldVariants, ["default", "code", "search"]));
    chk("3", "badgeVariants", eq(Comp.badgeVariants, ["default", "mute", "mention"]));
  });

  await sec("T4 R2 (c): className after the own classes, and ref", async () => {
    const cases = [
      ["Button", (p) => <Button {...p}>x</Button>, (c) => c.querySelector("button.btn")],
      ["Button link", (p) => <Button variant="link" {...p}>x</Button>, (c) => c.querySelector("button.linkbtn")],
      ["IconButton", (p) => <IconButton icon="x" label="l" {...p} />, (c) => c.querySelector("button.ib")],
      ["Chip", (p) => <Chip {...p}>x</Chip>, (c) => c.querySelector("button.chip")],
      ["ChipGroup", (p) => <ChipGroup {...p} />, (c) => c.querySelector("div.chips")],
      ["Switch", (p) => <Switch checked onChange={noop} label="s" {...p} />, (c) => c.querySelector("button.sw")],
      ["Field input", (p) => <Field label="l" {...p} />, (c) => c.querySelector("input.inp")],
      ["Field textarea", (p) => <Field label="l" multiline {...p} />, (c) => c.querySelector("textarea.inp")],
      ["Field search", (p) => <Field variant="search" aria-label="s" {...p} />, null],
      ["Select", (p) => <Select aria-label="s" options={opts} {...p} />, (c) => c.querySelector("select.sel")],
      ["Tag", (p) => <Tag {...p}>x</Tag>, (c) => c.querySelector("span.tag")],
      ["Badge", (p) => <Badge {...p}>1</Badge>, (c) => c.querySelector("span.cnt")],
    ];
    for (const [name, make, find] of cases) {
      const plain = mount(make({}));
      const base = name === "Field search" ? cls(plain.querySelector("label.field")) : cls(find(plain));
      cleanup();
      const withClass = mount(make({ className: "zz" }));
      const target = name === "Field search" ? withClass.querySelector("label.field") : find(withClass);
      chk("4a", name, base != null && cls(target) === `${base} zz`);
      cleanup();
      const ref = createRef();
      const refd = mount(make({ ref }));
      const want = name === "Field search" ? refd.querySelector("label.field input") : find(refd);
      chk("4b", name, ref.current != null && ref.current === want);
      cleanup();
    }
    {
      const ref = createRef();
      const c = mount(<Badge ref={ref} label="l">1</Badge>);
      chk("4b", "Badge label", ref.current === c.querySelector("span.cnt"));
      cleanup();
    }
  });

  await sec("T5 R2 (d): owned attributes win over the spread, even by a cast", async () => {
    {
      let c = mount(<Button type="submit">x</Button>);
      chk("5a", "Button type prop", c.firstElementChild.getAttribute("type") === "submit");
      cleanup();
      c = mount(<Button>x</Button>);
      chk("5a", "Button type default", c.firstElementChild.getAttribute("type") === "button");
      cleanup();
      c = mount(<IconButton icon="x" label="L" {...({ type: "submit", "aria-label": "zz", "aria-pressed": "true" } as any)} />);
      let b = c.firstElementChild;
      chk("5a", "IconButton type", b.getAttribute("type") === "button");
      chk("5a", "IconButton aria-label", b.getAttribute("aria-label") === "L");
      chk("5a", "IconButton aria-pressed", !b.hasAttribute("aria-pressed"));
      cleanup();
      c = mount(<Chip {...({ type: "submit", "aria-pressed": "true" } as any)}>x</Chip>);
      b = c.firstElementChild;
      chk("5a", "Chip type", b.getAttribute("type") === "button");
      chk("5a", "Chip aria-pressed", !b.hasAttribute("aria-pressed"));
      cleanup();
      const spy = [];
      c = mount(<Switch checked={false} onChange={(v) => spy.push(["change", v])} label="L" {...({ type: "submit", role: "button", "aria-checked": "true", "aria-label": "zz", onClick: () => spy.push(["click"]) } as any)} />);
      b = c.firstElementChild;
      chk("5a", "Switch type", b.getAttribute("type") === "button");
      chk("5a", "Switch role", b.getAttribute("role") === "switch");
      chk("5a", "Switch aria-checked", b.getAttribute("aria-checked") === "false");
      chk("5a", "Switch aria-label", b.getAttribute("aria-label") === "L");
      await user.click(b);
      chk("5a", "Switch onClick", eq(spy, [["change", true]]));
      cleanup();
      c = mount(<ChipGroup {...({ role: "presentation" } as any)} />);
      chk("5a", "ChipGroup role", c.firstElementChild.getAttribute("role") === "group");
      cleanup();
      c = mount(<Field label="l" {...({ "aria-invalid": "true" } as any)} />);
      chk("5a", "Field aria-invalid", !c.querySelector("input").hasAttribute("aria-invalid"));
      cleanup();
      c = mount(<Field variant="search" aria-label="s" {...({ "aria-invalid": "true" } as any)} />);
      chk("5a", "Field search aria-invalid", !c.querySelector("input").hasAttribute("aria-invalid"));
      cleanup();
      c = mount(<Select aria-label="s" options={opts} {...({ "aria-invalid": "true" } as any)} />);
      chk("5a", "Select aria-invalid", !c.querySelector("select").hasAttribute("aria-invalid"));
      cleanup();
    }
  });

  await sec("T7 R3: no text without text props", async () => {
    {
      const empties = [
        <Button>{""}</Button>,
        <Button variant="link">{""}</Button>,
        <IconButton icon="x" label="l" />,
        <Chip>{""}</Chip>,
        <ChipGroup />,
        <Switch checked onChange={noop} label="s" />,
        <Field aria-label="a" />,
        <Field variant="search" aria-label="a" icon="x" />,
        <Field multiline aria-label="a" />,
        <Select aria-label="a" options={[]} />,
        <Tag />,
        <Badge />,
      ];
      for (const [i, el] of empties.entries()) {
        const c = mount(el);
        chk("7", `item ${i}`, c.textContent === "");
        cleanup();
      }
    }
  });

  await sec("T9 R4 Button", async () => {
    {
      for (const variant of ["default", "primary", "danger", "ghost"])
        for (const size of ["md", "sm"])
          for (const fullWidth of [false, true]) {
            const c = mount(<Button variant={variant} size={size} fullWidth={fullWidth}>x</Button>);
            const b = c.firstElementChild;
            const want = ["btn", variant !== "default" && variant, size === "sm" && "sm", fullWidth && "wide"].filter(Boolean).join(" ");
            chk("9a", `${variant} ${size} ${fullWidth}`, b.tagName === "BUTTON" && cls(b) === want);
            cleanup();
          }
      let c = mount(<Button variant="link">x</Button>);
      chk("9a", "link", c.firstElementChild.tagName === "BUTTON" && cls(c.firstElementChild) === "linkbtn");
      cleanup();
      c = mount(<Button variant="link" className="zz">x</Button>);
      chk("9a", "link className", cls(c.firstElementChild) === "linkbtn zz");
      cleanup();
      c = mount(<Button>x</Button>);
      chk("9b", "default attributes", eq([...c.firstElementChild.attributes].map((a) => a.name).sort(), ["class", "type"]));
      cleanup();
      c = mount(<Button disabled>x</Button>);
      chk("9b", "disabled attribute only when asked", c.firstElementChild.hasAttribute("disabled"));
      cleanup();
    }
  });

  await sec("T10 R4 IconButton", async () => {
    {
      const want = (p, w) => {
        const c = mount(<IconButton icon="x" label="l" {...p} />);
        const ok = cls(c.firstElementChild) === w && c.firstElementChild.tagName === "BUTTON";
        cleanup();
        return ok;
      };
      chk("10", "plain", want({}, "ib"));
      chk("10", "sm", want({ size: "sm" }, "ib sm"));
      chk("10", "pressed", want({ pressed: true }, "ib on"));
      chk("10", "pressed false", want({ pressed: false }, "ib"));
      chk("10", "sm pressed className", want({ size: "sm", pressed: true, className: "zz" }, "ib sm on zz"));
      const c = mount(<IconButton icon="x" label="l" />);
      const b = c.firstElementChild;
      chk("10", "attributes", eq([...b.attributes].map((a) => a.name).sort(), ["aria-label", "class", "type"]));
      chk("10", "child is the icon", b.children.length === 1 && b.firstElementChild.tagName.toLowerCase() === "svg" && b.childNodes.length === 1);
      cleanup();
    }
  });

  await sec("T11 R4 Chip, ChipGroup", async () => {
    {
      const q = (el, sel) => { const c = mount(el); const e = c.querySelector(sel); const r = [cls(e), e?.tagName, [...(e?.attributes ?? [])].map((a) => a.name).sort().join(",")]; cleanup(); return r; };
      chk("11", "chip", eq(q(<Chip>x</Chip>, "button"), ["chip", "BUTTON", "class,type"]));
      chk("11", "chip sm", cls(mount(<Chip size="sm">x</Chip>).firstElementChild) === "chip sm"); cleanup();
      chk("11", "chip pressed has no class", cls(mount(<Chip pressed>x</Chip>).firstElementChild) === "chip"); cleanup();
      chk("11", "chip className", cls(mount(<Chip className="zz">x</Chip>).firstElementChild) === "chip zz"); cleanup();
      chk("11", "group", eq(q(<ChipGroup />, "div"), ["chips", "DIV", "class,role"]));
      chk("11", "group className", cls(mount(<ChipGroup className="zz" />).firstElementChild) === "chips zz"); cleanup();
    }
  });

  await sec("T12 R4 Switch", async () => {
    {
      const c = mount(<Switch checked={false} onChange={noop} label="s" />);
      const b = c.firstElementChild;
      chk("12", "element", b.tagName === "BUTTON" && cls(b) === "sw");
      chk("12", "attributes", eq([...b.attributes].map((a) => a.name).sort(), ["aria-checked", "aria-label", "class", "role", "type"]));
      chk("12", "no children", b.childNodes.length === 0);
      cleanup();
      const d = mount(<Switch checked onChange={noop} labelledBy="t" className="zz" />).firstElementChild;
      chk("12", "labelledby", d.getAttribute("aria-labelledby") === "t" && !d.hasAttribute("aria-label") && cls(d) === "sw zz");
      cleanup();
    }
  });

  await sec("T13 R4 Field", async () => {
    {
      let c = mount(<Field label="L" />);
      chk("13", "a: label.lbl then input.inp", c.children.length === 2 && c.children[0].tagName === "LABEL" && cls(c.children[0]) === "lbl" && c.children[1].tagName === "INPUT" && cls(c.children[1]) === "inp");
      cleanup();
      c = mount(<Field label="L" variant="code" />);
      chk("13", "code class", cls(c.querySelector("input")) === "inp code");
      cleanup();
      c = mount(<Field label="L" error="E" variant="code" className="zz" />);
      chk("13", "order inp code invalid className", cls(c.querySelector("input")) === "inp code invalid zz");
      cleanup();
      c = mount(<Field label="L" multiline />);
      chk("13", "textarea.inp", c.children[1].tagName === "TEXTAREA" && cls(c.children[1]) === "inp");
      cleanup();
      c = mount(<Field aria-label="a" />);
      chk("13", "c: input.inp alone", c.children.length === 1 && c.children[0].tagName === "INPUT" && cls(c.children[0]) === "inp");
      cleanup();
      c = mount(<Field aria-label="a" multiline />);
      chk("13", "c: textarea.inp alone", c.children.length === 1 && c.children[0].tagName === "TEXTAREA" && cls(c.children[0]) === "inp");
      cleanup();
      c = mount(<Field variant="search" aria-label="a" icon="x" />);
      const lab = c.children[0];
      chk("13", "b: label.field > svg + input", c.children.length === 1 && lab.tagName === "LABEL" && cls(lab) === "field" && lab.children.length === 2 && lab.children[0].tagName.toLowerCase() === "svg" && lab.children[1].tagName === "INPUT");
      chk("13", "b: input has no class", !lab.children[1].hasAttribute("class"));
      cleanup();
      c = mount(<Field variant="search" aria-label="a" />);
      chk("13", "b: no icon", c.children[0].children.length === 1);
      cleanup();
      c = mount(<Field variant="search" aria-label="a" error="E" disabled readOnly className="zz" />);
      chk("13", "b: order field invalid disabled readonly className", cls(c.children[0]) === "field invalid disabled readonly zz");
      cleanup();
      c = mount(<Field variant="search" aria-label="a" />);
      chk("13", "b: plain class", cls(c.children[0]) === "field");
      cleanup();
    }
  });

  await sec("T14 R4 Select", async () => {
    {
      let c = mount(<Select label="L" options={opts} />);
      chk("14", "label.lbl then select.sel", c.children.length === 2 && cls(c.children[0]) === "lbl" && c.children[1].tagName === "SELECT" && cls(c.children[1]) === "sel");
      cleanup();
      c = mount(<Select aria-label="a" options={opts} />);
      chk("14", "alone", c.children.length === 1 && cls(c.children[0]) === "sel");
      cleanup();
      c = mount(<Select aria-label="a" options={opts} fullWidth />);
      chk("14", "wide", cls(c.children[0]) === "sel wide");
      cleanup();
      c = mount(<Select aria-label="a" options={opts} fullWidth error="E" className="zz" />);
      chk("14", "order sel wide invalid className", cls(c.children[0]) === "sel wide invalid zz");
      cleanup();
    }
  });

  await sec("T15 R4 Tag", async () => {
    {
      const c = mount(<Tag>abc</Tag>);
      const t = c.firstElementChild;
      chk("15", "span.tag", t.tagName === "SPAN" && cls(t) === "tag");
      chk("15", "children only", t.childNodes.length === 1 && t.textContent === "abc" && t.attributes.length === 1);
      cleanup();
      chk("15", "className", cls(mount(<Tag className="zz">x</Tag>).firstElementChild) === "tag zz");
      cleanup();
    }
  });

  await sec("T16 R4 Badge", async () => {
    {
      const k = (el) => { const c = mount(el); const r = cls(c.firstElementChild); cleanup(); return r; };
      chk("16", "default", k(<Badge>1</Badge>) === "cnt");
      chk("16", "mute", k(<Badge variant="mute">1</Badge>) === "cnt mute");
      chk("16", "mention", k(<Badge variant="mention">1</Badge>) === "cnt mn");
      chk("16", "className after variant", k(<Badge variant="mention" className="zz">1</Badge>) === "cnt mn zz");
      const c = mount(<Badge label="L">1</Badge>);
      chk("16", "label: inner span.sr", c.firstElementChild.tagName === "SPAN" && !!c.querySelector("span.cnt > span.sr"));
      cleanup();
      chk("16", "no label: no inner span", mount(<Badge>1</Badge>).firstElementChild.children.length === 0); cleanup();
    }
  });

  await sec("T33 R10 Button", async () => {
    {
      const calls = [];
      let c = mount(<Button onClick={() => calls.push(1)}>x</Button>);
      await user.click(c.firstElementChild);
      chk("33", "click calls once", calls.length === 1);
      cleanup();
      for (const t of ["button", "submit", "reset"]) {
        c = mount(<Button type={t}>x</Button>);
        chk("33", `type ${t}`, c.firstElementChild.getAttribute("type") === t);
        cleanup();
      }
      c = mount(<Button>x</Button>);
      chk("33", "type defaults to button", c.firstElementChild.getAttribute("type") === "button");
      cleanup();
      const dcalls = [];
      c = mount(<Button disabled onClick={() => dcalls.push(1)}>x</Button>);
      await user.click(c.firstElementChild);
      chk("33", "disabled attribute", c.firstElementChild.hasAttribute("disabled"));
      chk("33", "disabled receives no click", dcalls.length === 0);
      cleanup();
      for (const v of ["default", "primary", "danger", "ghost"]) {
        c = mount(<Button variant={v}>x</Button>);
        chk("33", `variant ${v}`, cls(c.firstElementChild) === (v === "default" ? "btn" : `btn ${v}`));
        cleanup();
      }
      c = mount(<Button size="sm">x</Button>); chk("33", "size sm", cls(c.firstElementChild) === "btn sm"); cleanup();
      c = mount(<Button fullWidth>x</Button>); chk("33", "fullWidth", cls(c.firstElementChild) === "btn wide"); cleanup();
      c = mount(<Button>text</Button>); chk("33", "children text", c.textContent === "text"); cleanup();
      c = mount(<Button><Icons.Icon name="x" /></Button>); chk("33", "children icon", !!c.querySelector("button > svg")); cleanup();
      c = mount(<Button><Icons.Icon name="x" />text</Button>); chk("33", "children icon and text", !!c.querySelector("button > svg") && c.textContent === "text"); cleanup();
    }
  });

  await sec("T34 R11 link button (the DOM part)", async () => {
    {
      let c = mount(<Button variant="link">x</Button>);
      num("34a", cls(c.firstElementChild) === "linkbtn" ? 1 : 0);
      num("34b", c.firstElementChild.classList.contains("btn") ? 1 : 0);
      cleanup();
      c = mount(<><Button variant="link" disabled>a</Button><Button>b</Button></>);
      await user.tab();
      num("34c", document.activeElement === c.children[1] ? 1 : 0);
      cleanup();
    }
  });

  await sec("T35 R12 IconButton", async () => {
    {
      for (const l of ["Close", "Mute", "Send"]) {
        const c = mount(<IconButton icon="x" label={l} />);
        const b = c.firstElementChild;
        chk("35", `label ${l}`, b.tagName === "BUTTON" && b.getAttribute("type") === "button" && b.getAttribute("aria-label") === l);
        cleanup();
      }
      let c = mount(<IconButton icon="plus" label="l" />);
      chk("35", "one Icon as only child", c.firstElementChild.childNodes.length === 1 && c.firstElementChild.firstElementChild.tagName.toLowerCase() === "svg");
      cleanup();
      c = mount(<IconButton icon="x" label="l" pressed />);
      chk("35", "pressed true", c.firstElementChild.getAttribute("aria-pressed") === "true" && c.firstElementChild.classList.contains("on")); cleanup();
      c = mount(<IconButton icon="x" label="l" pressed={false} />);
      chk("35", "pressed false", c.firstElementChild.getAttribute("aria-pressed") === "false" && !c.firstElementChild.classList.contains("on")); cleanup();
      c = mount(<IconButton icon="x" label="l" />);
      chk("35", "pressed absent", !c.firstElementChild.hasAttribute("aria-pressed")); cleanup();
      c = mount(<IconButton icon="x" label="l" size="sm" />);
      chk("35", "size sm", cls(c.firstElementChild) === "ib sm"); cleanup();
      c = mount(<IconButton icon="x" label="l" />);
      chk("35", "no title", !c.firstElementChild.hasAttribute("title")); cleanup();
    }
  });

  await sec("T36 R13 Chip, ChipGroup", async () => {
    {
      let c = mount(<Chip pressed>x</Chip>);
      chk("36", "type button", c.firstElementChild.getAttribute("type") === "button");
      chk("36", "pressed true", c.firstElementChild.getAttribute("aria-pressed") === "true");
      chk("36", "no class on", !c.firstElementChild.classList.contains("on"));
      cleanup();
      c = mount(<Chip pressed={false}>x</Chip>); chk("36", "pressed false", c.firstElementChild.getAttribute("aria-pressed") === "false"); cleanup();
      c = mount(<Chip>x</Chip>); chk("36", "pressed absent", !c.firstElementChild.hasAttribute("aria-pressed")); cleanup();
      c = mount(<Chip size="sm">x</Chip>); chk("36", "size sm", cls(c.firstElementChild) === "chip sm"); cleanup();
      c = mount(<ChipGroup aria-label="g" />);
      chk("36", "group div role class", c.firstElementChild.tagName === "DIV" && c.firstElementChild.getAttribute("role") === "group" && cls(c.firstElementChild) === "chips");
      chk("36", "group aria-label", c.firstElementChild.getAttribute("aria-label") === "g"); cleanup();
      c = mount(<ChipGroup aria-labelledby="t" />); chk("36", "group aria-labelledby", c.firstElementChild.getAttribute("aria-labelledby") === "t"); cleanup();
      c = mount(<ChipGroup />); chk("36", "group needs no name", !c.firstElementChild.hasAttribute("aria-label") && !c.firstElementChild.hasAttribute("aria-labelledby")); cleanup();
    }
  });

  await sec("T37 R14 Switch", async () => {
    {
      const got = [];
      let c = mount(<Switch checked={false} onChange={(v) => got.push(v)} label="s" />);
      chk("37", "role", c.firstElementChild.getAttribute("role") === "switch");
      chk("37", "aria-checked false", c.firstElementChild.getAttribute("aria-checked") === "false");
      await user.click(c.firstElementChild);
      chk("37", "click calls onChange(true) once", eq(got, [true]));
      chk("37", "no state of its own", c.firstElementChild.getAttribute("aria-checked") === "false");
      cleanup();
      const got2 = [];
      c = mount(<Switch checked onChange={(v) => got2.push(v)} label="s" />);
      chk("37", "aria-checked true", c.firstElementChild.getAttribute("aria-checked") === "true");
      await user.click(c.firstElementChild);
      chk("37", "click calls onChange(false) once", eq(got2, [false]));
      cleanup();
      const got3 = [];
      c = mount(<Switch checked disabled onChange={(v) => got3.push(v)} label="s" />);
      await user.click(c.firstElementChild);
      chk("37", "disabled calls nothing", got3.length === 0);
      cleanup();
      c = mount(<Switch checked onChange={noop} labelledBy="t" />);
      chk("37", "labelledBy", c.firstElementChild.getAttribute("aria-labelledby") === "t" && !c.firstElementChild.hasAttribute("aria-label")); cleanup();
      c = mount(<Switch checked onChange={noop} label="s" />);
      chk("37", "label", c.firstElementChild.getAttribute("aria-label") === "s"); cleanup();
      chk("37", "no children", mount(<Switch checked onChange={noop} label="s" />).firstElementChild.childNodes.length === 0); cleanup();
    }
  });

  await sec("T38 R15 forms (a) and (c)", async () => {
    {
      let c = mount(<Field label="Name" />);
      const lab = c.querySelector("label"); const inp = c.querySelector("input");
      chk("38", "a: htmlFor is the id", !!inp.id && lab.getAttribute("for") === inp.id);
      chk("38", "a: label before the control", lab.nextElementSibling === inp);
      cleanup();
      c = mount(<Field label="Note" multiline />);
      chk("38", "a: multiline textarea", !!c.querySelector("label.lbl + textarea.inp")); cleanup();
      c = mount(<Field label="C" variant="code" />);
      chk("38", "a: code", !!c.querySelector("label.lbl + input.inp.code")); cleanup();
      c = mount(<Field aria-label="x" />);
      chk("38", "c: no label element, input alone", !c.querySelector("label") && c.children.length === 1 && c.firstElementChild.getAttribute("aria-label") === "x"); cleanup();
      c = mount(<Field aria-labelledby="t" />);
      chk("38", "c: aria-labelledby", c.firstElementChild.getAttribute("aria-labelledby") === "t"); cleanup();
      c = mount(<Field aria-label="x" multiline />);
      chk("38", "c: textarea alone", c.children.length === 1 && c.firstElementChild.tagName === "TEXTAREA"); cleanup();
      c = mount(<><Field label="1" /><Field label="2" /></>);
      const ids = [...c.querySelectorAll("input")].map((i) => i.id);
      chk("38", "id from useId, unique", ids.length === 2 && ids[0] !== "" && ids[0] !== ids[1]); cleanup();
      c = mount(<Field label="1" id="mine" />);
      chk("38", "id from the caller", c.querySelector("input").id === "mine" && c.querySelector("label").getAttribute("for") === "mine"); cleanup();
    }
  });

  await sec("T39 R15 form (b)", async () => {
    {
      let c = mount(<Field variant="search" aria-label="S" icon="search" />);
      const lab = c.querySelector("label.field");
      chk("39", "label.field wraps icon and input", !!lab && !!lab.querySelector("svg") && !!lab.querySelector("input"));
      chk("39", "named by aria-label", lab.querySelector("input").getAttribute("aria-label") === "S");
      await user.click(lab.querySelector("svg"));
      chk("39", "click on the icon focuses the input", document.activeElement === lab.querySelector("input"));
      cleanup();
      c = mount(<Field variant="search" aria-labelledby="t" />);
      chk("39", "aria-labelledby", c.querySelector("input").getAttribute("aria-labelledby") === "t");
      chk("39", "without icon: no svg", !c.querySelector("svg"));
      chk("39", "no label text", c.querySelector("label.field").textContent === "");
      cleanup();
      c = mount(<Field variant="search" aria-label="S" id="mine" />);
      chk("39", "id on the input", c.querySelector("input").id === "mine"); cleanup();
    }
  });

  await sec("T40 R15 passthrough, ref, no script", async () => {
    {
      const got = [];
      let c = mount(<Field label="L" type="email" value="v@x" onChange={(e) => got.push(e.target.value)} placeholder="p" maxLength={20} inputMode="email" autoComplete="email" readOnly disabled />);
      const i = c.querySelector("input");
      chk("40", "type", i.getAttribute("type") === "email");
      chk("40", "value", i.value === "v@x");
      chk("40", "placeholder", i.getAttribute("placeholder") === "p");
      chk("40", "maxLength", i.getAttribute("maxlength") === "20");
      chk("40", "inputMode", i.getAttribute("inputmode") === "email");
      chk("40", "autoComplete", i.getAttribute("autocomplete") === "email");
      chk("40", "readOnly", i.hasAttribute("readonly"));
      chk("40", "disabled", i.hasAttribute("disabled"));
      cleanup();
      c = mount(<Field label="L" onChange={(e) => got.push(e.target.value)} />);
      await user.type(c.querySelector("input"), "ab");
      chk("40", "onChange receives the native event", eq(got, ["a", "ab"]));
      cleanup();
      c = mount(<Field label="L" multiline rows={4} />);
      chk("40", "rows", c.querySelector("textarea").getAttribute("rows") === "4");
      chk("40", "no script element", !c.querySelector("script"));
      cleanup();
      const r1 = createRef(); c = mount(<Field label="L" ref={r1} />);
      chk("40", "ref is the input", r1.current === c.querySelector("input")); cleanup();
      const r2 = createRef(); c = mount(<Field label="L" multiline ref={r2} />);
      chk("40", "ref is the textarea", r2.current === c.querySelector("textarea")); cleanup();
      const r3 = createRef(); c = mount(<Field variant="search" aria-label="S" ref={r3} />);
      chk("40", "ref is the search input", r3.current === c.querySelector("label.field input")); cleanup();
    }
  });

  await sec("T41 R16 Select", async () => {
    {
      const got = [];
      let c = mount(<Select label="L" options={opts} onChange={(e) => got.push(e.target.value)} />);
      const s = c.querySelector("select");
      const os = [...s.querySelectorAll("option")];
      chk("41", "one option each", os.length === 3 && eq(os.map((o) => o.value), ["a", "b", "c"]) && eq(os.map((o) => o.textContent), ["A", "B", "C"]));
      chk("41", "option disabled", os[1].disabled && !os[0].disabled);
      chk("41", "label.lbl linked", c.querySelector("label.lbl").getAttribute("for") === s.id && !!s.id);
      await user.selectOptions(s, "c");
      chk("41", "onChange is the native event", eq(got, ["c"]));
      cleanup();
      c = mount(<Select aria-label="N" options={opts} fullWidth />);
      chk("41", "fullWidth adds wide", c.querySelector("select").classList.contains("wide") && !c.querySelector("label"));
      chk("41", "aria-label name", c.querySelector("select").getAttribute("aria-label") === "N"); cleanup();
      c = mount(<Select aria-labelledby="t" options={opts} />); chk("41", "aria-labelledby", c.querySelector("select").getAttribute("aria-labelledby") === "t"); cleanup();
      c = mount(<Select aria-label="N" options={opts} value="c" onChange={noop} />); chk("41", "value", c.querySelector("select").value === "c"); cleanup();
      c = mount(<Select aria-label="N" options={opts} defaultValue="c" />); chk("41", "defaultValue", c.querySelector("select").value === "c"); cleanup();
      c = mount(<Select aria-label="N" options={opts} disabled />); chk("41", "disabled", c.querySelector("select").disabled); cleanup();
      const r = createRef(); c = mount(<Select aria-label="N" options={opts} ref={r} />); chk("41", "ref", r.current === c.querySelector("select")); cleanup();
    }
  });

  await sec("T42 R17 error", async () => {
    {
      const forms = {
        "a": (p) => <Field label="L" id="f" {...p} />,
        "a textarea": (p) => <Field label="L" multiline id="f" {...p} />,
        "b": (p) => <Field variant="search" aria-label="S" id="f" {...p} />,
        "c": (p) => <Field aria-label="S" id="f" {...p} />,
        "select": (p) => <Select aria-label="S" options={opts} id="f" {...p} />,
      };
      for (const [name, make] of Object.entries(forms)) {
        let c = mount(make({ error: "Bad", "aria-describedby": "hint" }));
        const ctl = c.querySelector("input, textarea, select");
        const box = c.querySelector("#f-error");
        chk("42a", `${name}: gerr div role alert, text`, !!box && box.tagName === "DIV" && cls(box) === "gerr" && box.getAttribute("role") === "alert" && box.textContent === "Bad");
        const after = name === "b" ? c.querySelector("label.field").nextElementSibling : ctl.nextElementSibling;
        chk("42a", `${name}: directly after the control`, after === box);
        chk("42b", `${name}: aria-invalid`, ctl.getAttribute("aria-invalid") === "true");
        chk("42b", `${name}: describedby caller first`, ctl.getAttribute("aria-describedby") === "hint f-error");
        const inv = name === "b" ? c.querySelector("label.field") : ctl;
        chk("42b", `${name}: class invalid`, inv.classList.contains("invalid"));
        cleanup();
        for (const e of [undefined, "", "   "]) {
          c = mount(make({ error: e }));
          const ctl2 = c.querySelector("input, textarea, select");
          const inv2 = name === "b" ? c.querySelector("label.field") : ctl2;
          chk("42c", `${name}: ${JSON.stringify(e)} renders nothing`, !c.querySelector(".gerr") && !ctl2.hasAttribute("aria-invalid") && !ctl2.hasAttribute("aria-describedby") && !inv2.classList.contains("invalid"));
          cleanup();
        }
        const { container, rerender } = render(make({ error: "A" }));
        rerender(make({ error: "B" }));
        chk("42d", `${name}: one message, replaced`, container.querySelectorAll(".gerr").length === 1 && container.querySelector(".gerr").textContent === "B");
        cleanup();
      }
    }
  });

  await sec("T43 R18 classes of form (b)", async () => {
    {
      let c = mount(<Field variant="search" aria-label="S" disabled />);
      chk("43", "disabled adds class disabled", c.querySelector("label.field").classList.contains("disabled") && !c.querySelector("label.field").classList.contains("readonly") && c.querySelector("input").disabled); cleanup();
      c = mount(<Field variant="search" aria-label="S" readOnly />);
      chk("43", "readOnly adds class readonly", c.querySelector("label.field").classList.contains("readonly") && !c.querySelector("label.field").classList.contains("disabled")); cleanup();
      c = mount(<Field variant="search" aria-label="S" />);
      chk("43", "neither by default", cls(c.querySelector("label.field")) === "field"); cleanup();
      c = mount(<Field label="L" disabled readOnly />);
      chk("43", "forms a: the attributes", c.querySelector("input").disabled && c.querySelector("input").readOnly); cleanup();
      c = mount(<Select aria-label="S" options={opts} disabled />);
      chk("43", "select disabled attribute", c.querySelector("select").disabled); cleanup();
    }
  });

  await sec("T44 R19 Tag", async () => {
    {
      const c = mount(<Tag>mixed Case</Tag>);
      chk("44", "span.tag with its children only", c.firstElementChild.tagName === "SPAN" && c.firstElementChild.className === "tag" && c.firstElementChild.textContent === "mixed Case");
      chk("44", "the capitals are not in the text", c.firstElementChild.textContent !== c.firstElementChild.textContent.toUpperCase());
      cleanup();
      const d = mount(<Tag><b>x</b></Tag>);
      chk("44", "children are kept", !!d.querySelector("span.tag > b")); cleanup();
    }
  });

  await sec("T45 R20 Badge", async () => {
    {
      for (const [v, w] of [["default", "cnt"], ["mute", "cnt mute"], ["mention", "cnt mn"]]) {
        const c = mount(<Badge variant={v}>3</Badge>);
        chk("45", `variant ${v}`, c.firstElementChild.tagName === "SPAN" && cls(c.firstElementChild) === w);
        cleanup();
      }
      for (const t of ["0", "1000", "12345", "999+", "1,234"]) {
        const c = mount(<Badge>{t}</Badge>);
        chk("45", `content ${t} shown as given`, c.textContent === t);
        cleanup();
      }
      let c = mount(<Badge>{0}</Badge>);
      chk("45", "0 is shown", c.textContent === "0"); cleanup();
      c = mount(<Badge label="3 unread">3</Badge>);
      const inner = c.querySelector("span.cnt > span[aria-hidden='true']");
      chk("45", "label: digits aria-hidden", !!inner && inner.textContent === "3");
      chk("45", "label: span.sr holds the label", c.querySelector("span.cnt > span.sr")?.textContent === "3 unread");
      cleanup();
      c = mount(<Badge>3</Badge>);
      chk("45", "no label: content read as it is", c.textContent === "3" && !c.querySelector("[aria-hidden]") && !c.querySelector(".sr")); cleanup();
    }
  });

  await sec("T46 R21 native controls, Tab order, disabled skipped", async () => {
    {
      const el = (
        <>
          <Button>b1</Button><Button disabled>b2</Button>
          <IconButton icon="x" label="i1" /><IconButton icon="x" label="i2" disabled />
          <Chip>c1</Chip><Chip disabled>c2</Chip>
          <Switch checked onChange={noop} label="s1" /><Switch checked onChange={noop} label="s2" disabled />
          <Field aria-label="f1" /><Field aria-label="f2" disabled />
          <Field variant="search" aria-label="f3" /><Field multiline aria-label="f4" />
          <Select aria-label="e1" options={opts} /><Select aria-label="e2" options={opts} disabled />
        </>
      );
      const c = mount(el);
      const controls = [...c.querySelectorAll("button, input, textarea, select")];
      const roots = [...c.children].filter((e) => e.tagName !== "LABEL");
      chk("46a", "every root control is a native control", roots.length === 13 && roots.every((e) => ["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(e.tagName)));
      chk("46a", "the search input is native", c.querySelectorAll("label.field input").length === 1);
      const enabled = controls.filter((e) => !e.disabled);
      const reached = new Set(); let disabledReached = 0;
      for (let i = 0; i < controls.length + 3; i++) {
        await user.tab();
        const a = document.activeElement;
        if (a && controls.includes(a)) { reached.add(a); if (a.disabled) disabledReached++; }
      }
      num("46b", enabled.length === 8 ? reached.size : -1);
      num("46c", controls.length - enabled.length === 6 ? disabledReached : -1);
      cleanup();
    }
  });

  await sec("T47 R21 keys", async () => {
    {
      const make = {
        Button: (f) => <Button onClick={f}>x</Button>,
        Chip: (f) => <Chip onClick={f}>x</Chip>,
        IconButton: (f) => <IconButton icon="x" label="l" onClick={f} />,
        Switch: (f) => <Switch checked={false} onChange={f} label="s" />,
      };
      for (const [name, mk] of Object.entries(make)) {
        let n = 0;
        mount(mk(() => { n++; }));
        await user.tab();
        await user.keyboard(" ");
        chk("47", `${name} Space`, n === 1);
        await user.keyboard("{Enter}");
        chk("47", `${name} Enter`, n === 2);
        cleanup();
      }
    }
  });

  await sec("T58..T61 R26 examples", async () => {
    {
      const files = import.meta.glob("../components/*/*.examples.tsx", { eager: true });
      const keys = Object.keys(files);
      num("58a", keys.filter((k) => Array.isArray(files[k].examples) && files[k].examples.length > 0).length);
      for (const k of keys) {
        const ex = files[k].examples;
        chk("58b", k, ex.every((e) => typeof e.id === "string" && typeof e.title === "string" && e.element && typeof e.element === "object") && new Set(ex.map((e) => e.id)).size === ex.length);
      }
      num("58c", componentExamples.reduce((n, e) => n + e.examples.length, 0));

      const entry = (name) => componentExamples.find((e) => e.component === name);
      const rendered = (name) => render(<>{entry(name).examples.map((e) => <div key={e.id}>{e.element}</div>)}</>).container;
      const has = (c, sel) => !!c.querySelector(sel);
      const need = {
        Button: [".btn:not(.primary):not(.danger):not(.ghost)", ".btn.primary", ".btn.danger", ".btn.ghost", ".linkbtn", ".btn:not(.sm)", ".btn.sm", ".btn[disabled]", ".btn.wide", ".linkbtn[disabled]"],
        IconButton: [".ib:not(.sm)", ".ib.sm", ".ib[aria-pressed='true']", ".ib[aria-pressed='false']", ".ib:not([aria-pressed])", ".ib[disabled]"],
        Chip: [".chip:not(.sm)", ".chip.sm", ".chip[aria-pressed='true']", ".chip[aria-pressed='false']", ".chip:not([aria-pressed])", ".chip[disabled]", ".chips[role='group']"],
        Switch: [".sw[aria-checked='true']", ".sw[aria-checked='false']", ".sw[disabled]"],
        Field: ["input.inp:not(.code)", "input.inp.code", "label.field svg", "textarea.inp", ".inp.invalid", ".gerr", "input[readonly]", "input[disabled]", "label.lbl + .inp", "label.field.invalid"],
        Select: [".sel:not(.wide)", ".sel.wide", ".lbl + .sel", ".sel.invalid", ".sel[disabled]"],
        Tag: [".tag"],
        Badge: [".cnt:not(.mute):not(.mn)", ".cnt.mute", ".cnt.mn", ".cnt .sr"],
      };
      for (const [name, sels] of Object.entries(need)) {
        const c = rendered(name);
        for (const s of sels) chk("59", `${name} ${s}`, has(c, s));
        if (name === "Field") {
          chk("59", "Field: search without an icon", [...c.querySelectorAll("label.field")].some((l) => !l.querySelector("svg")));
          chk("59", "Field: input without a visible label", [...c.querySelectorAll("input.inp")].some((i) => !c.querySelector(`label[for="${i.id}"]`)));
        }
        cleanup();
      }
      const nine = [["Button", ".btn .ic"], ["Button", ".btn.wide"], ["Button", ".linkbtn[disabled]"], ["Select", ".sel.wide"], ["Select", ".lbl + .sel"], ["Badge", ".cnt .sr"], ["Field", ".field.invalid"], ["Field", ".field.readonly"], ["Field", ".field.disabled"]];
      for (const [name, sel] of nine) { const c = rendered(name); chk("60", `${name} ${sel}`, has(c, sel)); cleanup(); }
      const order = componentExamples.map((e) => e.component).slice(0, 8);
      chk("61", "order", eq(order, ["Button", "IconButton", "Chip", "Switch", "Field", "Select", "Tag", "Badge"]));
      num("61b", order.length);
    }
  });

  await sec("T64 R27 act flag; T65 readCss", async () => {
    chk("64", "IS_REACT_ACT_ENVIRONMENT", globalThis.IS_REACT_ACT_ENVIRONMENT === true);
    {
      const f = `${process.env.QA_TMP}/qa.css`;
      writeFileSync(f, "a { color : red ; Margin-Top: 1px }\n@media (max-width: 719px) { .b { height: 40px } }\n");
      const rules = readCss(f);
      chk("65", "two rules", rules.length === 2);
      chk("65", "keys are selector, media, declarations", rules.every((r) => eq(Object.keys(r).sort(), ["declarations", "media", "selector"])));
      chk("65", "top-level media is null", rules[0].media === null);
      chk("65", "media text", rules[1].media === "(max-width:719px)");
      chk("65", "values trimmed", rules[0].declarations.color === "red");
      chk("65", "names as written", "Margin-Top" in rules[0].declarations);
      chk("65", "declarations of the media rule", rules[1].selector === ".b" && rules[1].declarations.height === "40px");
    }
  });

  writeFileSync(process.env.QA_OUT, JSON.stringify(R));
  expect(true).toBe(true);
});
DOMTEST
  cat > "$KIT/css.mjs" <<'CSSMJS'
// Throwaway CSS checks of the QA of TOKI-012. Lives only in the temporary worktree (packages/ui-web).
// Reads the tables of the spec given as the first argument and the CSS files of src; prints one JSON object.
import postcss from "postcss";
import { readFileSync } from "node:fs";

const spec = readFileSync(process.argv[2], "utf8");
const out = {};

const normSel = (s) => s.replace(/\s+/g, " ").trim();
const normVal = (v) =>
  v
    .trim()
    .replace(/\s*!\s*important/g, "!important")
    .replace(/(^|[^\d])\.(\d)/g, "$10.$2")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ");

function splitDecl(text) {
  const o = {};
  let depth = 0, quote = "", cur = "";
  const flush = () => {
    const i = cur.indexOf(":");
    if (i > 0) o[cur.slice(0, i).trim()] = normVal(cur.slice(i + 1));
    cur = "";
  };
  for (const ch of text) {
    if (quote) { if (ch === quote) quote = ""; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 0) { flush(); continue; }
    cur += ch;
  }
  flush();
  return o;
}

// The rows of "Table <letter>." of the spec: arrays of cells without the backticks.
function table(letter) {
  const m = new RegExp(`^Table ${letter}\\. `, "m").exec(spec);
  const at = m ? m.index : -1;
  if (at < 0) return [];
  const rows = [];
  let started = false;
  for (const line of spec.slice(at).split("\n").slice(1)) {
    if (!line.startsWith("|")) { if (started) break; else continue; }
    started = true;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (/^:?-+/.test(cells[0]) || cells[0] === "Selector" || cells[0] === "File" || cells[0] === "Case") continue;
    rows.push(cells.map((c) => c.replace(/^`|`$/g, "")));
  }
  return rows;
}

// Rules of a CSS file: { sel, media, decls } with one entry for each selector of a rule.
function readRules(file) {
  const root = postcss.parse(readFileSync(file, "utf8"));
  const rules = [];
  const blocks = new Set();
  root.walkRules((rule) => {
    const parent = rule.parent;
    const media = parent && parent.type === "atrule" ? parent.params.replace(/\s+/g, "") : null;
    if (parent && parent.type === "atrule") blocks.add(parent);
    const decls = {};
    rule.each((n) => { if (n.type === "decl") decls[n.prop] = normVal(n.important ? `${n.value}!important` : n.value); });
    for (const s of rule.selectors) rules.push({ sel: normSel(s), media, decls });
  });
  return { rules, mediaBlocks: [...blocks].map((b) => b.params.replace(/\s+/g, "")) };
}

// Compares a file with expected [{ sel, media, decls }]: counts matched selectors, matched declarations,
// problems (a missing or different declaration, a missing selector) and extra rules (a selector not expected).
function compare(file, expected, { mediaToo }) {
  const { rules } = readRules(file);
  const merged = new Map();
  for (const r of rules) {
    const k = `${r.media}||${r.sel}`;
    merged.set(k, { ...(merged.get(k) ?? {}), ...r.decls });
  }
  let matched = 0, declMatched = 0, problems = 0;
  const seen = new Set();
  const expMerged = new Map();
  for (const e of expected) { const k = `${e.media}||${e.sel}`; expMerged.set(k, { sel: e.sel, media: e.media, decls: { ...(expMerged.get(k)?.decls ?? {}), ...e.decls } }); }
  for (const e of expMerged.values()) {
    const k = `${e.media}||${e.sel}`;
    seen.add(k);
    const got = merged.get(k);
    if (!got) { problems++; continue; }
    matched++;
    for (const [p, v] of Object.entries(e.decls)) { if (got[p] === v) declMatched++; else problems++; }
    for (const p of Object.keys(got)) if (!(p in e.decls)) problems++;
  }
  let extra = 0;
  for (const k of merged.keys()) {
    if (seen.has(k)) continue;
    const isMedia = !k.startsWith("null||");
    if (isMedia && !mediaToo) continue;
    extra++;
  }
  return { matched, declMatched, problems, extra };
}

const expFrom = (rows, selCol, declCol, media = null) =>
  rows.flatMap((r) => r[selCol].split(",").map((s) => ({ sel: normSel(s), media, decls: splitDecl(r[declCol]) })));
const sum = (list) => list.reduce((a, r) => ({ matched: a.matched + r.matched, declMatched: a.declMatched + r.declMatched, problems: a.problems + r.problems, extra: a.extra + r.extra }), { matched: 0, declMatched: 0, problems: 0, extra: 0 });
const D = "src/components";
const files = {
  C: `${D}/Button/Button.css`, D: `${D}/IconButton/IconButton.css`, E: `${D}/Chip/Chip.css`, F: `${D}/Switch/Switch.css`,
  Badge: `${D}/Badge/Badge.css`, Tag: `${D}/Tag/Tag.css`, H: `${D}/Field/Field.css`,
};
const all = Object.values(files);

// Tables C to F: one file each (the media block is Table I and is compared apart).
out.cf = sum(["C", "D", "E", "F"].map((t) => compare(files[t], expFrom(table(t), 0, 1), { mediaToo: false })));
out.cfTables = ["C", "D", "E", "F"].map((t) => table(t).length);
// Table G: .tag in Tag.css, the other rows in Badge.css.
const g = table("G");
out.g = sum([
  compare(files.Badge, expFrom(g.filter((r) => r[0] !== ".tag"), 0, 1), { mediaToo: false }),
  compare(files.Tag, expFrom(g.filter((r) => r[0] === ".tag"), 0, 1), { mediaToo: false }),
]);
out.gTable = g.length;
out.h = compare(files.H, expFrom(table("H"), 0, 1), { mediaToo: false });
out.hTable = table("H").length;

// Table I: each file has exactly one media block (max-width: 719px) with the rows of its table.
const MQ = "(max-width:719px)";
const iRows = table("I");
const byFile = { "Button.css": files.C, "IconButton.css": files.D, "Chip.css": files.E, "Field.css": files.H, "Switch.css": files.F };
const iOut = { filesOneBlock: 0, filesExpected: Object.keys(byFile).length, noBlockElsewhere: 0, noBlockElsewhereOf: 2, rows: iRows.length, matched: 0, declMatched: 0, problems: 0 };
for (const [name, file] of Object.entries(byFile)) {
  const exp = expFrom(iRows.filter((r) => r[0] === name), 1, 2, MQ);
  const { rules, mediaBlocks } = readRules(file);
  if (mediaBlocks.length === 1 && mediaBlocks[0] === MQ) iOut.filesOneBlock++;
  const merged = new Map();
  for (const r of rules.filter((x) => x.media !== null)) merged.set(`${r.media}||${r.sel}`, { ...(merged.get(`${r.media}||${r.sel}`) ?? {}), ...r.decls });
  for (const e of exp) {
    const got = merged.get(`${e.media}||${e.sel}`);
    if (!got) { iOut.problems++; continue; }
    iOut.matched++;
    for (const [p, v] of Object.entries(e.decls)) { if (got[p] === v) iOut.declMatched++; else iOut.problems++; }
    for (const p of Object.keys(got)) if (!(p in e.decls)) iOut.problems++;
  }
  const expKeys = new Set(exp.map((e) => `${e.media}||${e.sel}`));
  for (const k of merged.keys()) if (!expKeys.has(k)) iOut.problems++;
}
for (const f of [files.Badge, files.Tag]) if (readRules(f).mediaBlocks.length === 0) iOut.noBlockElsewhere++;
out.i = iOut;

// Table J: base.css. The media row names its own three selectors.
{
  const j = table("J");
  const exp = [];
  for (const r of j) {
    if (r[0].startsWith("@media")) for (const s of ["*", "*::before", "*::after"]) exp.push({ sel: s, media: "(prefers-reduced-motion:reduce)", decls: splitDecl(r[1]) });
    else for (const s of r[0].split(",")) exp.push({ sel: normSel(s), media: null, decls: splitDecl(r[1]) });
  }
  out.j = { ...compare("src/styles/base.css", exp, { mediaToo: true }), expected: exp.length };
}

// ---- scans over the seven CSS files of the eight components
const tokensText = readFileSync("../tokens/src/tokens.css", "utf8");
const tokenNames = new Set([...tokensText.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
const NAMED = "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" ");
const namedRe = new RegExp(`(^|[^a-z0-9-])(${NAMED.join("|")})($|[^a-z0-9-])`, "i");
const literalRe = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\bhwb\(|\blab\(|\blch\(|\boklch\(|\boklab\(|color-mix\(|\bcolor\(/i;
const scan = { files: all.length, decls: 0, literal: 0, vars: 0, unknownVars: 0, tokenNames: tokenNames.size, density: 0, look: 0, fontRules: [], fontOk: 0, hover: 0, hoverBad: 0, hidden: 0, outline: [] };
for (const f of all) {
  const { rules } = readRules(f);
  for (const r of rules) {
    if (/data-(eff|look|accent|density)/.test(r.sel)) scan.look++;
    if (r.sel.includes(":hover")) {
      scan.hover++;
      for (const p of Object.keys(r.decls)) if (!["background", "color", "border-color", "filter"].includes(p)) scan.hoverBad++;
    }
    for (const [p, v] of Object.entries(r.decls)) {
      scan.decls++;
      const bare = v.replace(/"[^"]*"|'[^']*'/g, "").replace(/var\([^)]*\)/g, "");
      if (literalRe.test(bare) || namedRe.test(bare)) scan.literal++;
      for (const m of v.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
        scan.vars++;
        if (!tokenNames.has(m[1])) scan.unknownVars++;
        if (/^--(row|gap|av)$/.test(m[1])) scan.density++;
      }
      if (p === "font-family") { scan.fontRules.push(r.sel); if (v === '"JetBrains Mono",monospace') scan.fontOk++; }
      if ((p === "opacity" && /^0(\.0+)?$/.test(v)) || (p === "visibility" && v === "hidden") || (p === "display" && v === "none")) scan.hidden++;
      if (p === "outline" && /^(0|none)\b/.test(v)) scan.outline.push(r.sel);
    }
  }
}
scan.fontRules.sort();
scan.outline.sort();
out.scan = scan;

// R11: the link button has no height, border or padding
{
  const link = readRules(files.C).rules.filter((r) => r.sel === ".linkbtn" && r.media === null);
  out.linkForbidden = link.flatMap((r) => Object.keys(r.decls)).filter((p) => /^(height|min-height|border|padding)/.test(p)).length;
  out.linkRules = link.length;
}
// R18, R19 and R20 facts
{
  const h = readRules(files.H).rules.filter((r) => r.media === null);
  const get = (s) => h.find((r) => r.sel === s)?.decls ?? {};
  out.disabledOk = [".inp[disabled]", ".sel[disabled]", ".field.disabled"].filter((s) => get(s).opacity === "0.5" && get(s).cursor === "not-allowed").length;
  out.readonlyOk = [".inp[readonly]", ".field.readonly"].filter((s) => get(s).background === "var(--surface-2)").length;
  const tag = readRules(files.Tag).rules.find((r) => r.sel === ".tag");
  out.tagUpper = tag?.decls["text-transform"] === "uppercase" ? 1 : 0;
  const sr = readRules(files.Badge).rules.find((r) => r.sel === ".cnt .sr")?.decls ?? {};
  const base = readRules("src/styles/base.css").rules.find((r) => r.sel === ".sr")?.decls ?? {};
  out.badgeSrOwn = Object.keys(sr).length > 0 && JSON.stringify(sr) === JSON.stringify(base) ? 1 : 0;
}
console.log(JSON.stringify(out));
CSSMJS
  cat > "$KIT/lint.mjs" <<'LINTMJS'
// Throwaway lint checks of the QA of TOKI-012 (run at the root of the temporary worktree). Prints one JSON object.
import { ESLint } from "eslint";

const eslint = new ESLint({ cwd: process.cwd() });
const RULE = "toki/icon-only-button-name";
const FILE = "packages/ui-web/src/components/Zz/Zz.tsx";
const UI = 'import { XIcon, CheckIcon, Icon, Button, IconButton } from "@toki/ui-web";\n';
const exp = (jsx) => `${UI}export const a = ${jsx};`;
// [id, requirement (22 or 23), code, reported?]. The 36 cases of Table K of the spec.
const cases = [
  ["V1", 22, exp("<button><XIcon /></button>"), true],
  ["V2", 22, exp("<Button><XIcon /></Button>"), true],
  ["V3", 22, exp('<button><Icon name="x" /></button>'), true],
  ["V4", 23, exp('<IconButton icon="x" />'), true],
  ["V5", 23, exp('<IconButton icon="x" label="" />'), true],
  ["V6", 22, exp('<button aria-label=""><XIcon /></button>'), true],
  ["V7", 22, exp('<button title="Close"><XIcon /></button>'), true],
  ["V8", 22, 'import { XIcon as Close } from "@toki/ui-web";\nexport const a = <button><Close /></button>;', true],
  ["V9", 22, exp("(open) => <button>{open ? <XIcon /> : <CheckIcon />}</button>"), true],
  ["V10", 22, 'import * as Icons from "@toki/ui-web";\nexport const a = <button><Icons.XIcon /></button>;', true],
  ["V11", 22, exp("<button><span><XIcon /></span></button>"), true],
  ["V12", 22, exp("<button><XIcon /><CheckIcon /></button>"), true],
  ["V13", 22, 'import { XIcon } from "../../icons";\nexport const a = <button><XIcon /></button>;', true],
  ["V14", 22, exp('<button aria-label="   "><XIcon /></button>'), true],
  ["V15", 22, exp('<button aria-labelledby=""><XIcon /></button>'), true],
  ["V16", 22, exp("<button><><XIcon /></></button>"), true],
  ["V17", 22, 'import { Button as Btn, XIcon } from "@toki/ui-web";\nexport const a = <Btn><XIcon /></Btn>;', true],
  ["V18", 22, exp("(cond) => <button>{cond && <XIcon />}</button>"), true],
  ["V19", 22, exp("(cond) => <button>{cond ? <XIcon /> : null}</button>"), true],
  ["V20", 23, exp('<IconButton icon="x" label="   " />'), true],
  ["V21", 23, 'import { IconButton } from "../IconButton";\nexport const a = <IconButton icon="x" />;', true],
  ["A1", 22, exp('<button aria-label="Close"><XIcon /></button>'), false],
  ["A2", 22, exp('<button aria-labelledby="t"><XIcon /></button>'), false],
  ["A3", 22, exp('(t) => <button aria-label={t("x")}><XIcon /></button>'), false],
  ["A4", 22, exp("<button><XIcon />Close</button>"), false],
  ["A5", 22, exp("(label) => <button><XIcon />{label}</button>"), false],
  ["A6", 22, exp('<button><XIcon /><span className="sr">Close</span></button>'), false],
  ["A7", 23, exp('<IconButton icon="x" label="Close" />'), false],
  ["A8", 23, exp('(t) => <IconButton icon="x" label={t("x")} />'), false],
  ["A9", 22, exp("(props) => <button {...props}><XIcon /></button>"), false],
  ["A10", 22, 'import { MyIcon } from "other-lib";\nexport const a = <button><MyIcon /></button>;', false],
  ["A11", 22, exp('<button type="button" />'), false],
  ["A12", 23, exp('(props) => <IconButton icon="x" {...props} />'), false],
  ["A13", 22, exp("(cond) => <button>{cond || <XIcon />}</button>"), false],
  ["A14", 22, exp('(cond) => <button><XIcon />{cond && "Close"}</button>'), false],
  ["A15", 22, 'import { Button } from "other-lib";\nimport { XIcon } from "@toki/ui-web";\nexport const a = <Button><XIcon /></Button>;', false],
];
const out = { r22v: 0, r22a: 0, r23v: 0, r23a: 0, cases: cases.length, fatal: 0, msgOk: 0, msgTotal: 0 };
for (const [, req, code, reported] of cases) {
  const [res] = await eslint.lintText(code, { filePath: FILE });
  const hits = res.messages.filter((m) => m.ruleId === RULE);
  out.fatal += res.messages.filter((m) => m.fatal).length;
  const ok = reported ? hits.length >= 1 : hits.length === 0;
  if (ok) out[`r${req}${reported ? "v" : "a"}`]++;
  if (req === 23 && reported) {
    out.msgTotal++;
    const t = hits[0]?.message ?? "";
    if (/icon-only-button-name/.test(t) && /aria-label/.test(t) && /aria-labelledby/.test(t) && /label/.test(t)) out.msgOk++;
  }
}
// R24: the configuration of real paths, and the inline comment
const level = (c) => { const r = c.rules?.[RULE]; const s = Array.isArray(r) ? r[0] : r; return s === 2 || s === "error"; };
out.cfgOk = 0;
for (const p of ["packages/ui-web/src/components/IconButton/IconButton.tsx", "apps/web/src/main.tsx", "apps/web/src/routes/index.tsx", "packages/ui-web/src/components/Field/Field.tsx"]) {
  const c = await eslint.calculateConfigForFile(p);
  if (level(c) && c.linterOptions?.noInlineConfig === true) out.cfgOk++;
}
{
  const c = await eslint.calculateConfigForFile("packages/ui-web/src/components/Button/Button.test.tsx");
  out.testFileOutside = c.rules?.[RULE] === undefined ? 1 : 0;
}
{
  const code = `/* eslint-disable toki/icon-only-button-name */\n${exp("<button><XIcon /></button>")}`;
  const [res] = await eslint.lintText(code, { filePath: FILE });
  out.inlineStillReported = res.messages.filter((m) => m.ruleId === RULE).length >= 1 ? 1 : 0;
  out.inlineCommentReported = res.messages.some((m) => /noInlineConfig|no effect/i.test(m.message)) ? 1 : 0;
}
console.log(JSON.stringify(out));
LINTMJS
  cat > "$KIT/pw.mjs" <<'PWMJS'
// Throwaway Chromium checks of the QA of TOKI-012 (run at the root of the temporary worktree). Prints one JSON object.
import { chromium } from "@playwright/test";

const base = process.env.QA_URL;
const out = {};
const browser = await chromium.launch();
async function open(width, eff = "calm") {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${base}/qa-examples.html?eff=${eff}`);
  await page.waitForSelector("#qa .btn");
  return page;
}
async function measure(width) {
  const page = await open(width);
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".btn:not(.linkbtn), .ib, .chip, .inp, .sel, .field")];
    const heights = els.map((e) => e.getBoundingClientRect().height);
    const sw = document.querySelector(".sw");
    const before = getComputedStyle(sw, "::before");
    const link = document.querySelector(".linkbtn");
    return {
      n: els.length,
      under: heights.filter((h) => h < 39.99).length,
      btnMd: Math.round(document.querySelector(".btn:not(.sm):not(.wide):not(.linkbtn)").getBoundingClientRect().height),
      sw: Math.round(sw.getBoundingClientRect().height),
      swBefore: before.content === "none" ? "none" : Math.round(parseFloat(before.height)),
      linkHeight: Math.round(link.getBoundingClientRect().height),
    };
  });
  await page.close();
  return r;
}
out.w719 = await measure(719);
out.w720 = await measure(720);
// Tab from the top of the page: every enabled control is reached and no disabled one is
{
  const page = await open(1280);
  const info = await page.evaluate(() => {
    const all = [...document.querySelectorAll("#qa button, #qa input, #qa select, #qa textarea")];
    all.forEach((e, i) => { e.dataset.qaIdx = String(i); });
    return { enabled: all.filter((e) => !e.disabled).length, disabled: all.filter((e) => e.disabled).length };
  });
  const reached = new Set();
  let disabledReached = 0;
  for (let i = 0; i < info.enabled + info.disabled + 5; i++) {
    await page.keyboard.press("Tab");
    const a = await page.evaluate(() => { const e = document.activeElement; return e && e.dataset ? { idx: e.dataset.qaIdx ?? null, disabled: !!e.disabled } : { idx: null, disabled: false }; });
    if (a.idx !== null) { reached.add(a.idx); if (a.disabled) disabledReached++; }
  }
  out.tab = { ...info, reached: reached.size, disabledReached };
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out));
PWMJS
  cat > "$KIT/qa-examples.html" <<'EXHTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>QA examples</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/zz-qa-examples.tsx"></script>
  </body>
</html>
EXHTML
  cat > "$KIT/zz-qa-examples.tsx" <<'EXTSX'
// Throwaway page of the QA of TOKI-012: every example of the package, with the tokens and the base rules.
import "@toki/tokens/tokens.css";
import "@toki/ui-web/base.css";
import { createRoot } from "react-dom/client";
import { componentExamples } from "@toki/ui-web/examples";

const params = new URLSearchParams(window.location.search);
document.documentElement.dataset.eff = params.get("eff") ?? "calm";
createRoot(document.getElementById("root")!).render(
  <div id="qa" style={{ padding: 8 }}>
    {componentExamples.map((entry) => (
      <section key={entry.component} data-component={entry.component} style={{ marginBottom: 12 }}>
        <h3 style={{ margin: "4px 0" }}>{entry.component}</h3>
        {entry.examples.map((example) => (
          <div key={example.id} data-example={example.id} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, opacity: 0.6 }}>{example.title}</div>
            {example.element}
          </div>
        ))}
      </section>
    ))}
  </div>,
);
EXTSX
  cat > "$KIT/clean.test.tsx" <<'CLEANTEST'
// @ts-nocheck
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
test("first", () => { render(<button>qa</button>); expect(screen.getByRole("button")).toBeTruthy(); });
test("second", () => { render(<button>qa</button>); expect(screen.getByRole("button")).toBeTruthy(); });
CLEANTEST
}

# ---- JSON of the throwaway DOM test ---------------------------------------------------------------
DOMJ="$BASE/dom.json"; DOM_DONE=""
dom_run() {
  [ -n "$DOM_DONE" ] && return 0
  need "$1" || return 1
  write_kit; reset_wt
  mkdir -p "$WT/$UI/src/zz-qa"; cp "$KIT/dom.test.tsx" "$WT/$UI/src/zz-qa/dom.test.tsx"
  pnenv QA_OUT="$DOMJ" QA_TMP="$BASE" -- --filter @toki/ui-web exec vitest run src/zz-qa/dom.test.tsx >/dev/null 2>&1
  reset_wt
  DOM_DONE=1
  [ -s "$DOMJ" ] || { echo "$1 the throwaway test of the components did not write its counts (Blocked)"; DOM_DONE=""; return 1; }
}
dnum() { jq -r --arg k "$1" '.[$k].ok // 0' "$DOMJ"; }
dbad() { local k b out=""; for k in "$@" crash; do b=$(jq -r --arg k "$k" '(.[$k].bad // []) | join(",")' "$DOMJ"); [ -n "$b" ] && out="$out $k:$b"; done; printf '%s' "$out"; }
# drow <n> <keys...>: prints "T<n>" and the counts of the keys, and the names of the failed items, if any
drow() { local n="$1"; shift; dom_run "T$n" || return; local o="T$n" k; for k in "$@"; do o="$o $(dnum "$k")"; done; local bad; bad=$(dbad "$@"); echo "$o${bad:+ [failed:$bad]}"; }

# ---- JSON of the CSS checks --------------------------------------------------------------------------
CSSJ="$BASE/css.json"; CSS_DONE=""
css_run() {
  [ -n "$CSS_DONE" ] && return 0
  need "$1" || return 1
  write_kit; reset_wt
  doc "$SPEC" > "$BASE/spec.md"
  cp "$KIT/css.mjs" "$WT/$UI/zz-qa-css.mjs"
  nenv "$UI" -- zz-qa-css.mjs "$BASE/spec.md" > "$CSSJ" 2>/dev/null
  reset_wt
  [ -s "$CSSJ" ] || { echo "$1 the CSS checks did not run (Blocked)"; return 1; }
  CSS_DONE=1
}
cj() { jq -r "$1" "$CSSJ"; }

# ---- TypeScript: cases that must be errors, and cases that must not --------------------------------
TYPES_DONE=""
BAD_LABELS=(ib-type chip-type sw-type sw-onclick link-size link-wide ib-nolabel ib-arialabel sw-noname field-noname search-label icon-nosearch multi-search button-loud sw-native-onchange badge-loud button-live)
BAD_CODE=(
  '<IconButton icon="x" type="submit" label="l" />'
  '<Chip type="submit">c</Chip>'
  '<Switch checked onChange={() => {}} label="s" type="submit" />'
  '<Switch checked onChange={() => {}} label="s" onClick={() => {}} />'
  '<Button variant="link" size="sm">b</Button>'
  '<Button variant="link" fullWidth>b</Button>'
  '<IconButton icon="x" />'
  '<IconButton icon="x" label="l" aria-label="z" />'
  '<Switch checked onChange={() => {}} />'
  '<Field />'
  '<Field variant="search" label="l" aria-label="a" />'
  '<Field icon="x" label="l" />'
  '<Field variant="search" multiline aria-label="a" />'
  '<Button type="loud">b</Button>'
  '<Switch checked onChange={(e: React.ChangeEvent<HTMLInputElement>) => {}} label="s" />'
  '<Badge variant="loud">1</Badge>'
  '<Button variant="live">b</Button>'
)
OK_CODE=(
  '<Button>b</Button>'
  '<Button variant="link">b</Button>'
  '<Button variant="primary" size="sm" fullWidth type="submit">b</Button>'
  '<IconButton icon="x" label="l" size="sm" pressed />'
  '<Switch checked onChange={() => {}} label="s" />'
  '<Switch checked={false} onChange={(c: boolean) => {}} labelledBy="t" />'
  '<Field label="l" />'
  '<Field aria-label="a" multiline />'
  '<Field variant="search" aria-label="a" icon="x" />'
  '<Field variant="code" label="c" />'
  '<Badge variant="mention">1</Badge>'
  '<Chip pressed>c</Chip>'
)
TYPE_NAMES=(ButtonProps IconButtonProps ChipProps ChipGroupProps SwitchProps FieldProps SelectProps TagProps BadgeProps)
types_run() {
  [ -n "$TYPES_DONE" ] && return 0
  need "$1" || return 1
  reset_wt
  local d="$WT/$UI/src/zz-qa" i n
  mkdir -p "$d"
  local imp='import type React from "react"; import { Badge, Button, Chip, Field, IconButton, Switch } from "../index";'
  { echo "$imp"; i=0; for n in "${BAD_CODE[@]}"; do i=$((i + 1)); echo "export const b$i = $n;"; done; } > "$d/types-bad.tsx"
  { echo "$imp"; i=0; for n in "${OK_CODE[@]}"; do i=$((i + 1)); echo "export const o$i = $n;"; done; } > "$d/types-ok.tsx"
  { i=0; for n in "${TYPE_NAMES[@]}"; do i=$((i + 1)); echo "import type { $n as P$i } from \"../index\"; export type E$i = P$i;"; done; } > "$d/types-exp1.ts"
  { i=0; for n in "${TYPE_NAMES[@]}"; do i=$((i + 1)); echo "import type { $n as P$i } from \"../components\"; export type E$i = P$i;"; done; } > "$d/types-exp2.ts"
  pnenv -- --filter @toki/ui-web exec tsc --noEmit --pretty false > "$BASE/tsc.txt" 2>&1
  reset_wt
  TYPES_DONE=1
}
# tbad <label...>: how many of these labelled cases are reported as errors
tbad() {
  local l n=0 i idx
  for l in "$@"; do
    idx=0
    for i in "${!BAD_LABELS[@]}"; do [ "${BAD_LABELS[$i]}" = "$l" ] && idx=$((i + 2)); done
    [ "$idx" -gt 0 ] && [ "$(grep -c "types-bad\.tsx($idx," "$BASE/tsc.txt")" -ge 1 ] && n=$((n + 1))
  done
  echo "$n"
}
# tok <file> <total>: how many of the lines of the file have no error
tok() { local f="$1" total="$2" e=0 i; for i in $(seq 1 "$total"); do [ "$(grep -c "$f($i," "$BASE/tsc.txt")" -ge 1 ] && e=$((e + 1)); done; echo $((total - e)); }

# ---- the full run of the tests of ui-web ----------------------------------------------------------------
VTJ="$BASE/vt.json"; VT_DONE=""; VT_RC=""
vt_run() {
  [ -n "$VT_DONE" ] && return 0
  need "$1" || return 1
  reset_wt
  pnenv -- --filter @toki/ui-web exec vitest run --reporter=json --outputFile="$VTJ" >/dev/null 2>&1; VT_RC=$?
  VT_DONE=1
}

# ---- lint, format, typecheck on the clean tree --------------------------------------------------------
GATE_DONE=""; LINT_RC=""; FMT_RC=""; TC_RC=""; BND_RC=""; BND_HAS=""
gates() {
  [ -n "$GATE_DONE" ] && return 0
  need "$1" || return 1
  reset_wt
  pnenv -- lint >/dev/null 2>&1; LINT_RC=$?
  pnenv -- format:check >/dev/null 2>&1; FMT_RC=$?
  pnenv -- typecheck >/dev/null 2>&1; TC_RC=$?
  pnenv -- lint:boundaries >/dev/null 2>&1; BND_RC=$?
  [ "$(doc package.json | jq -r '.scripts | has("lint:boundaries")')" = true ] && BND_HAS=1 || BND_HAS=0
  GATE_DONE=1
}

# ---- the lint JSON ----------------------------------------------------------------------------------------
LINTJ="$BASE/lint.json"; LINT_DONE=""
lint_run() {
  [ -n "$LINT_DONE" ] && return 0
  need "$1" || return 1
  write_kit; reset_wt
  cp "$KIT/lint.mjs" "$WT/zz-qa-lint.mjs"
  nenv . -- zz-qa-lint.mjs > "$LINTJ" 2>/dev/null
  reset_wt
  [ -s "$LINTJ" ] || { echo "$1 the lint checks did not run (Blocked)"; return 1; }
  LINT_DONE=1
}
lj() { jq -r "$1" "$LINTJ"; }

# ---- the browser ---------------------------------------------------------------------------------------------
PWJ="$BASE/pw.json"; PW_DONE=""; PW_ERR=""; VITE_PORT=""
web_start() { # starts the Vite server of apps/web in the worktree on a free port; sets VITE_PORT
  write_kit
  cp "$KIT/qa-examples.html" "$WT/apps/web/qa-examples.html"; cp "$KIT/zz-qa-examples.tsx" "$WT/apps/web/src/zz-qa-examples.tsx"
  VITE_PORT=$(freeport)
  ( cd "$WT" && exec env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm --filter ./apps/web exec vite --host 127.0.0.1 --port "$VITE_PORT" --strictPort ) > "$BASE/vite.log" 2>&1 &
  PIDS="$PIDS $!"
  local i; for i in $(seq 1 120); do [ "$(portbusy "$VITE_PORT")" = busy ] && return 0; sleep 0.5; done
  return 1
}
pw_run() {
  [ -n "$PW_DONE" ] && return 0
  PW_DONE=1
  need "$1" || { PW_ERR="no worktree"; return 1; }
  reset_wt
  if ! pnenv -- add -Dw @playwright/test@1.65.1 > "$BASE/pwadd.log" 2>&1; then PW_ERR="$(firstline < "$BASE/pwadd.log")"; return 1; fi
  web_start || { PW_ERR="the Vite server did not start: $(grep -m1 -iE 'error' "$BASE/vite.log" | firstline)"; return 1; }
  cp "$KIT/pw.mjs" "$WT/zz-qa-pw.mjs"
  nenv . QA_URL="http://127.0.0.1:$VITE_PORT" -- zz-qa-pw.mjs > "$PWJ" 2> "$BASE/pw.err"
  local p; for p in $PIDS; do kill_tree "$p"; done; PIDS=""
  [ -s "$PWJ" ] || { PW_ERR="$(grep -m1 -E '[A-Za-z]' "$BASE/pw.err" | firstline)"; return 1; }
  return 0
}
pwj() { jq -r "$1" "$PWJ"; }
pw_blocked() { echo "$1 the browser rows could not run: ${PW_ERR:-unknown} (Blocked)"; }

# ===========================================================================================================
# R1
t1() { drow 1 1a 1b 1c 1d; }
t2() {
  local d="$UI/src/components" full=0 n f ok sel=0 cg=0 chips=0
  for n in Button IconButton Chip Switch Field Tag Badge; do
    ok=1; for f in "$n.tsx" "$n.css" "$n.test.tsx" "$n.examples.tsx" index.ts; do exists "$d/$n/$f" || ok=0; done
    full=$((full + ok))
  done
  [ "$(files "$d/Select" | wc -l | tr -d ' ')" = 4 ] && ! exists "$d/Select/Select.css" && has "$d/Select/Select.tsx" 'import "\.\./Field/Field\.css"' && sel=1
  [ "$(files "$d/ChipGroup" | wc -l | tr -d ' ')" = 0 ] && has "$d/Chip/Chip.tsx" 'export const ChipGroup' && cg=1
  has "$d/Chip/Chip.css" '^\.chips' && chips=1
  echo "T2 $full $sel $cg $chips"
}
# R2
t3() { drow 3 3; }
t4() { drow 4 4a 4b; }
t5() { dom_run T5 || return; types_run T5 || return; local bad; bad=$(dbad 5a); echo "T5 $(dnum 5a) $(tbad ib-type chip-type sw-type sw-onclick)${bad:+ [failed:$bad]}"; }
t6() { types_run T6 || return; echo "T6 $(tok types-exp1.ts 9) $(tok types-exp2.ts 9)"; }
# R3
t7() { drow 7 7; }
t8() {
  local f n=0 hits=0 c
  for f in $(files "$UI/src/components" | grep -E '\.tsx?$' | grep -vE '\.(test|examples)\.tsx?$'); do
    n=$((n + 1)); c=$(doc "$f" | grep -c '@toki/i18n'); hits=$((hits + c))
  done
  echo "T8 $n $hits"
}
# R4
t9() { drow 9 9a 9b; }
t10() { drow 10 10; }
t11() { drow 11 11; }
t12() { drow 12 12; }
t13() { drow 13 13; }
t14() { drow 14 14; }
t15() { drow 15 15; }
t16() { drow 16 16; }
# R5
t17() { css_run T17 || return; echo "T17 $(cj '.cf.matched') $(cj '.cf.declMatched') $(cj '.cf.problems') $(cj '.cf.extra')"; }
t18() { css_run T18 || return; echo "T18 $(cj '.g.matched') $(cj '.g.declMatched') $(cj '.g.problems') $(cj '.g.extra')"; }
t19() { css_run T19 || return; echo "T19 $(cj '.h.matched') $(cj '.h.declMatched') $(cj '.h.problems') $(cj '.h.extra')"; }
t20() {
  local d="$UI/src/components" n=0 c
  for c in Button IconButton Chip Switch Field Tag Badge; do has "$d/$c/$c.tsx" "^import \"\./$c\.css\";" && n=$((n + 1)); done
  has "$d/Select/Select.tsx" '^import "\.\./Field/Field\.css";' && n=$((n + 1))
  echo "T20 $n $(doc "$UI/package.json" | jq -r '(.sideEffects | index("**/*.css")) != null | if . then 1 else 0 end')"
}
# R6
t21() { css_run T21 || return; echo "T21 $(cj '.scan.decls') $(cj '.scan.literal')"; }
t22() { css_run T22 || return; echo "T22 $(cj '.scan.tokenNames') $(cj '.scan.vars') $(cj '.scan.unknownVars')"; }
t23() { css_run T23 || return; echo "T23 $(cj '.scan.decls') $(cj '.scan.density') $(cj '.scan.look')"; }
t24() { css_run T24 || return; echo "T24 $(cj '.scan.fontRules | length') $(cj '.scan.fontOk') $(cj '[.scan.fontRules[] | select(. != ".cnt" and . != ".inp.code")] | length')"; }
# R7
t25() { css_run T25 || return; echo "T25 $(cj '.scan.hover') $(cj '.scan.hoverBad') $(cj '.scan.hidden')"; }
t26() {
  local f n=0 hits=0 c
  for f in $(files "$UI/src/components" | grep -E '\.tsx?$' | grep -vE '\.(test|examples)\.tsx?$'); do
    n=$((n + 1)); c=$(doc "$f" | grep -cE 'onMouseEnter|\btitle\s*=|\.title\b'); hits=$((hits + c))
  done
  echo "T26 $n $hits"
}
# R8
t27() { css_run T27 || return; echo "T27 $(cj '.i.filesOneBlock') $(cj '.i.matched') $(cj '.i.declMatched') $(cj '.i.problems') $(cj '.i.noBlockElsewhere')"; }
t28() { pw_run T28 || { pw_blocked T28; return; }; echo "T28 $(pwj '.w719.n') $(pwj '.w719.under') $(pwj '.w720.under') $(pwj '.w720.btnMd')"; }
t29() { pw_run T29 || { pw_blocked T29; return; }; echo "T29 $(pwj '.w719.sw') $(pwj '.w719.swBefore') $(pwj '.w719.linkHeight') $(pwj '.w720.linkHeight') $(pwj '.w720.swBefore')"; }
# R9
t30() { css_run T30 || return; echo "T30 $(cj '.j.matched') $(cj '.j.declMatched') $(cj '.j.problems') $(cj '.j.extra')"; }
t31() {
  local p="$UI/package.json" n=0
  [ "$(doc "$p" | jq -r '.exports["."]')" = "./src/index.ts" ] && n=$((n + 1))
  [ "$(doc "$p" | jq -r '.exports["./base.css"]')" = "./src/styles/base.css" ] && n=$((n + 1))
  [ "$(doc "$p" | jq -r '.exports["./examples"]')" = "./src/examples.ts" ] && n=$((n + 1))
  echo "T31 $n"
}
t32() {
  local f n=0 foreign=0 base=0 own css name c
  c=$(doc "$UI/src/index.ts" | grep -c '\.css')
  for f in $(files "$UI/src" | grep -E '\.tsx?$' | grep -vE '\.(test|examples)\.tsx?$|\.d\.ts$'); do
    n=$((n + 1))
    [ "$(doc "$f" | grep -c 'base\.css')" -ge 1 ] && base=$((base + 1))
    case "$f" in "$UI/src/components/"*)
      name=$(basename "$f"); name=${name%.*}; own="./$name.css"; [ "$name" = Select ] && own="../Field/Field.css"
      foreign=$((foreign + $(doc "$f" | grep -E '^import ["'"'"'][^"'"'"']*\.css' | grep -vF "\"$own\"" | grep -c .)));; esac
  done
  echo "T32 $n $c $foreign $base"
}
# R10 to R20
t33() { dom_run T33 || return; types_run T33 || return; local bad; bad=$(dbad 33); echo "T33 $(dnum 33) $(tbad link-size link-wide)${bad:+ [failed:$bad]}"; }
t34() { dom_run T34 || return; css_run T34 || return; echo "T34 $(dnum 34a) $(dnum 34b) $(dnum 34c) $(cj '.linkForbidden')"; }
t35() { dom_run T35 || return; types_run T35 || return; local bad; bad=$(dbad 35); echo "T35 $(dnum 35) $(tbad ib-nolabel ib-arialabel)${bad:+ [failed:$bad]}"; }
t36() { drow 36 36; }
t37() { dom_run T37 || return; types_run T37 || return; local bad; bad=$(dbad 37); echo "T37 $(dnum 37) $(tbad sw-noname) $(tbad sw-onclick sw-native-onchange)${bad:+ [failed:$bad]}"; }
t38() { drow 38 38; }
t39() { drow 39 39; }
t40() { dom_run T40 || return; types_run T40 || return; local bad; bad=$(dbad 40); echo "T40 $(dnum 40) $(tbad field-noname search-label icon-nosearch multi-search) $(tok types-ok.tsx 12)${bad:+ [failed:$bad]}"; }
t41() { drow 41 41; }
t42() { drow 42 42a 42b 42c 42d; }
t43() { dom_run T43 || return; css_run T43 || return; local bad; bad=$(dbad 43); echo "T43 $(dnum 43) $(cj '.disabledOk') $(cj '.readonlyOk')${bad:+ [failed:$bad]}"; }
t44() { dom_run T44 || return; css_run T44 || return; local bad; bad=$(dbad 44); echo "T44 $(dnum 44) $(cj '.tagUpper')${bad:+ [failed:$bad]}"; }
t45() { dom_run T45 || return; css_run T45 || return; local bad; bad=$(dbad 45); echo "T45 $(dnum 45) $(cj '.badgeSrOwn')${bad:+ [failed:$bad]}"; }
# R21
t46() { drow 46 46a 46b 46c; }
t47() { drow 47 47; }
t48() {
  css_run T48 || return
  local f n=0 hits=0 c
  for f in $(files "$UI/src/components" | grep -E '\.tsx?$' | grep -vE '\.(test|examples)\.tsx?$'); do
    n=$((n + 1)); c=$(doc "$f" | grep -ciE 'tabindex'); hits=$((hits + c))
  done
  echo "T48 $n $hits $(cj '[.scan.outline[] | select(. == ".inp" or . == ".field input")] | length') $(cj '[.scan.outline[] | select(. != ".inp" and . != ".field input")] | length')"
}
t49() { pw_run T49 || { pw_blocked T49; return; }; echo "T49 $(pwj '.tab.enabled') $(pwj '.tab.reached') $(pwj '.tab.disabled') $(pwj '.tab.disabledReached')"; }
# R22 to R25
t50() { lint_run T50 || return; echo "T50 $(lj '.r22v') $(lj '.r22a') $(lj '.fatal')"; }
t51() { lint_run T51 || return; echo "T51 $(lj '.r23v') $(lj '.r23a') $(lj '.msgOk')"; }
t52() { lint_run T52 || return; echo "T52 $(lj '.cfgOk') $(lj '.testFileOutside') $(lj '.inlineStillReported') $(lj '.inlineCommentReported')"; }
t53() {
  gates T53 || return
  local rc rule=0
  mkdir -p "$WT/$UI/src/zz-qa"
  printf '%s\n' 'import { XIcon } from "../icons";' 'export const Bad = <button><XIcon /></button>;' > "$WT/$UI/src/zz-qa/Bad.tsx"
  pnenv -- lint >/dev/null 2>&1; rc=$?
  pnenv -- exec eslint -f json packages/ui-web/src/zz-qa/Bad.tsx 2>/dev/null > "$BASE/bad.json"
  [ "$(jq -r '[.[].messages[] | select(.ruleId == "toki/icon-only-button-name" and .severity == 2)] | length' "$BASE/bad.json" 2>/dev/null)" -ge 1 ] && rule=1
  reset_wt
  echo "T53 $([ "$rc" != 0 ] && echo 1 || echo 0) $rule $LINT_RC"
}
t54() {
  local f=0 reg=0
  exists tools/eslint-rules/index.js && f=1
  has eslint.config.js 'plugins: \{ toki \}' && reg=1
  echo "T54 $f $reg"
}
t55() {
  local n=0 f
  for f in violates allowed disabled; do exists "tools/lint-fixtures/icon-button-name/$f.tsx" && n=$((n + 1)); done
  local c=0; exists tools/lint-fixtures/check.mjs && c=1
  echo "T55 $n $c"
}
t56() { gates T56 || return; echo "T56 $BND_RC $BND_HAS"; }
t57() {
  gates T57 || return
  if [ "$BND_HAS" = 0 ]; then echo "T57 the script lint:boundaries does not exist at $V, so removing the rule and seeing it fail cannot be shown (Blocked)"
  else echo "T57 not run: lint:boundaries exists and this row has no run for it (Blocked)"; fi
}
# R26
t58() { dom_run T58 || return; local bad; bad=$(dbad 58b); echo "T58 $(dnum 58a) $(dnum 58b) $(dnum 58c)${bad:+ [failed:$bad]}"; }
t59() { drow 59 59; }
t60() { drow 60 60; }
t61() {
  dom_run T61 || return
  local f n=0 hits=0 c
  for f in $(files "$UI/src" | grep -E '\.tsx?$' | grep -vE '/examples\.ts$|\.examples\.tsx$'); do
    n=$((n + 1)); c=$(doc "$f" | grep -cE '^(import|export) .*["'"'"'][^"'"'"']*\.examples["'"'"']'); hits=$((hits + c))
  done
  echo "T61 $(dnum 61) $(dnum 61b) $n $hits"
}
# R27
t62() {
  vt_run T62 || return
  echo "T62 $VT_RC $(jq -r '[.testResults[] | select(.status == "passed")] | length' "$VTJ") $(jq -r '.numPassedTests' "$VTJ") $(jq -r '.numFailedTests' "$VTJ") $(jq -r '[.testResults[] | select((.name | endswith("src/icons/icons.test.tsx")) and .status == "passed")] | length' "$VTJ")"
}
t63() {
  local c="$UI/vitest.config.ts" s="$UI/src/test/setup.ts" a=0 p=0 setup=0 pragma=0 f
  has "$c" 'environment: "jsdom"' && a=$((a + 1))
  has "$c" 'globals: false' && a=$((a + 1))
  has "$c" 'setupFiles: \["\./src/test/setup\.ts"\]' && a=$((a + 1))
  has "$s" '@testing-library/jest-dom/vitest' && setup=$((setup + 1))
  has "$s" 'afterEach\(' && has "$s" 'cleanup\(\)' && setup=$((setup + 1))
  has "$s" 'IS_REACT_ACT_ENVIRONMENT *= *true' && setup=$((setup + 1))
  for f in $(files "$UI/src" | grep -E '\.test\.tsx?$'); do pragma=$((pragma + $(doc "$f" | grep -c '@vitest-environment'))); done
  echo "T63 $a $setup $pragma"
}
t64() {
  need T64 || return
  dom_run T64 || return
  write_kit; reset_wt
  mkdir -p "$WT/$UI/src/zz-qa"; cp "$KIT/clean.test.tsx" "$WT/$UI/src/zz-qa/clean.test.tsx"
  local rc1 rc2
  pnenv -- --filter @toki/ui-web exec vitest run src/zz-qa/clean.test.tsx >/dev/null 2>&1; rc1=$?
  perl -0pi -e 's/afterEach\(\(\) => \{\s*cleanup\(\);\s*\}\);//' "$WT/$UI/src/test/setup.ts"
  ( cd "$WT" && git diff --quiet -- "$UI/src/test/setup.ts" ) && { echo "T64 the mutation of setup.ts did not apply (Blocked)"; reset_wt; return; }
  pnenv -- --filter @toki/ui-web exec vitest run src/zz-qa/clean.test.tsx >/dev/null 2>&1; rc2=$?
  reset_wt
  echo "T64 $rc1 $([ "$rc2" != 0 ] && echo 1 || echo 0) $(dnum 64)"
}
t65() { drow 65 65; }
t66() {
  local p="$UI/package.json" n=0 k v lock one two same=0
  for k in jsdom postcss @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom; do
    v=$(doc "$p" | jq -r --arg k "$k" '.devDependencies[$k] // ""')
    printf '%s' "$v" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' && n=$((n + 1))
  done
  lock=$(doc pnpm-lock.yaml | awk '/^packages:/{f=1;next} /^snapshots:/{f=0} f')
  one=$(printf '%s\n' "$lock" | grep -cE "^  '?jsdom@"); two=$(printf '%s\n' "$lock" | grep -cE "^  '?vitest@")
  [ "$(doc "$p" | jq -r '.devDependencies.vitest')" = "$(doc packages/tokens/package.json | jq -r '.devDependencies.vitest')" ] && same=1
  echo "T66 $n $one $two $same"
}
# R28
t67() {
  local f n=0 imp=0 api=0 c
  for f in $(files "$UI/src/components" "$UI/src/styles" | grep -E '\.(tsx?|css)$'); do
    n=$((n + 1))
    c=$(doc "$f" | grep -cE "(from|import\(|require\() *[\"']@toki/(platform|i18n|tokens|client-core|shared)"); imp=$((imp + c))
    c=$(doc "$f" | grep -cE '\b(Notification|localStorage|sessionStorage|indexedDB|AudioContext)\b|navigator\.serviceWorker|document\.cookie|<audio'); api=$((api + c))
  done
  echo "T67 $n $imp $api"
}
t68() { gates T68 || return; echo "T68 $LINT_RC $FMT_RC $TC_RC"; }
t69() { gates T69 || return; echo "T69 $BND_RC"; }
# R29
t70() {
  local p=apps/web/package.json n=0 form
  form=$(doc "$p" | jq -r '.dependencies["@toki/shared"]')
  [ "$(doc "$p" | jq -r '.dependencies["@toki/tokens"]')" = "$form" ] && n=$((n + 1))
  [ "$(doc "$p" | jq -r '.dependencies["@toki/ui-web"]')" = "$form" ] && n=$((n + 1))
  echo "T70 $n $([ "$form" = "workspace:*" ] && echo 1 || echo 0) $(doc "$p" | jq -r '[.devDependencies["@toki/tokens"], .devDependencies["@toki/ui-web"]] | map(select(. != null)) | length')"
}
t71() {
  need T71 || return
  reset_wt
  local m="apps/web/src/main.tsx" order nonCss fonts rc1 rc2
  order=$(doc "$m" | nodebin -e '
    const s=require("fs").readFileSync(0,"utf8");
    const imps=[...s.matchAll(/^import\s+(?:[^"\x27]*from\s+)?["\x27]([^"\x27]+)["\x27];?$/gm)].map(m=>m[1]);
    const t=imps.indexOf("@toki/tokens/tokens.css"), b=imps.indexOf("@toki/ui-web/base.css");
    const last=Math.max(t,b);
    const before=imps.slice(0,last+1).filter(x=>!x.endsWith(".css")).length;
    const f=imps.findIndex(x=>/(^|\/)fonts\.css$/.test(x));
    console.log([t>=0&&b>t?1:0, before, f<0?"absent":(f<t?"before":"after")].join(" "));')
  pnenv -- --filter @toki/ui-web exec vitest run src/styles/order.test.ts >/dev/null 2>&1; rc1=$?
  perl -0pi -e 's/^/import { StrictMode as QaMutation } from "react";\n/' "$WT/$m"
  ( cd "$WT" && git diff --quiet -- "$m" ) && { echo "T71 the mutation of main.tsx did not apply (Blocked)"; reset_wt; return; }
  pnenv -- --filter @toki/ui-web exec vitest run src/styles/order.test.ts >/dev/null 2>&1; rc2=$?
  reset_wt
  echo "T71 $order $rc1 $([ "$rc2" != 0 ] && echo 1 || echo 0)"
}
BUILD_DONE=""; BUILD_RC=""
web_build() {
  [ -n "$BUILD_DONE" ] && return 0
  need "$1" || return 1
  reset_wt
  pnenv -- --filter ./apps/web build >/dev/null 2>&1; BUILD_RC=$?
  BUILD_DONE=1
}
t72() {
  web_build T72 || return
  local d="$WT/apps/web/dist" css tok=0 base=0
  css=$(ls "$d"/assets/*.css 2>/dev/null | wc -l | tr -d ' ')
  cat "$d"/assets/*.css > "$BASE/dist.css" 2>/dev/null
  [ "$(grep -c -- '--ink:' "$BASE/dist.css")" -ge 1 ] && tok=1
  [ "$(grep -c 'font-smoothing' "$BASE/dist.css")" -ge 1 ] && [ "$(grep -c 'outline-offset' "$BASE/dist.css")" -ge 1 ] && base=1
  echo "T72 $BUILD_RC $css $tok $base"
}
t73() {
  web_build T73 || return
  local tc size
  pnenv -- --filter ./apps/web typecheck >/dev/null 2>&1; tc=$?
  pnenv -- size >/dev/null 2>&1; size=$?
  echo "T73 $tc $size"
}
t74() {
  local all other
  all=$(git diff --name-only "$V^1" "$V" -- apps/web | wc -l | tr -d ' ')
  other=$(git diff --name-only "$V^1" "$V" -- apps/web | grep -cvE '^apps/web/(package\.json|src/main\.tsx)$')
  echo "T74 $all $other"
}
# R30
t75() { types_run T75 || return; echo "T75 $(tbad ib-nolabel ib-arialabel sw-noname field-noname search-label icon-nosearch multi-search link-size button-loud sw-native-onchange badge-loud button-live) $(tok types-ok.tsx 12)"; }
t76() { echo "T76 $(git grep -h '@ts-expect-error' "$V" -- "$UI/src" | wc -l | tr -d ' ')"; }
# R31
t77() {
  need T77 || return
  reset_wt
  local d="$WT/$UI/src" r1 r2 r3 r4 changed
  mk() { # $1 index line? $2 examples file? $3 entry?
    reset_wt
    mkdir -p "$d/components/Zz"
    printf 'export const Zz = () => <i />;\n' > "$d/components/Zz/Zz.tsx"
    printf '.zz { color: var(--ink); }\n' > "$d/components/Zz/Zz.css"
    printf 'import { expect, test } from "vitest";\ntest("zz", () => { expect(1).toBe(1); });\n' > "$d/components/Zz/Zz.test.tsx"
    printf 'export { Zz } from "./Zz";\n' > "$d/components/Zz/index.ts"
    [ "$2" = 1 ] && printf 'import type { Example } from "../../internal/example";\nexport const examples: Example[] = [];\n' > "$d/components/Zz/Zz.examples.tsx"
    [ "$1" = 1 ] && printf 'export * from "./Zz";\n' >> "$d/components/index.ts"
    if [ "$3" = 1 ]; then
      perl -0pi -e 's/(export type \{ Example \} from)/import { examples as zz } from ".\/components\/Zz\/Zz.examples";\n$1/; s/(\n\];\n?\s*)$/\n  { component: "Zz", examples: zz },$1/' "$d/examples.ts"
    fi
  }
  mk 1 1 1
  changed=$( cd "$WT" && git status --porcelain --untracked-files=no | wc -l | tr -d ' ' )
  pnenv -- --filter @toki/ui-web exec vitest run src/examples.test.tsx >/dev/null 2>&1; r1=$?
  mk 0 1 1; pnenv -- --filter @toki/ui-web exec vitest run src/examples.test.tsx >/dev/null 2>&1; r2=$?
  mk 1 0 0; pnenv -- --filter @toki/ui-web exec vitest run src/examples.test.tsx >/dev/null 2>&1; r3=$?
  mk 1 1 0; pnenv -- --filter @toki/ui-web exec vitest run src/examples.test.tsx >/dev/null 2>&1; r4=$?
  reset_wt
  echo "T77 $r1 $([ "$r2" != 0 ] && echo 1 || echo 0) $([ "$r3" != 0 ] && echo 1 || echo 0) $([ "$r4" != 0 ] && echo 1 || echo 0) $changed"
}
# manual rows
t78() { echo "T78 (Blocked) manual row: the QA pastes the result of the look comparison (Calm and Focus, 1280 px and 360 px) into the record"; }
t79() { echo "T79 (Blocked) manual row: the QA pastes the result of the comparison of the tables with the prototype into the record"; }
t80() { echo "T80 (Blocked) manual row: the QA pastes the result of the look at 360 px into the record"; }
t81() { echo "T81 (Blocked) manual row: the QA pastes the result of the screen-reader pass into the record"; }

# ---- SERVE: the examples page for the manual rows ------------------------------------------------------------
serve() {
  need SERVE || return
  write_kit; reset_wt
  web_start || { echo "SERVE the Vite server did not start (Blocked)"; return; }
  echo "SERVE Calm  http://127.0.0.1:$VITE_PORT/qa-examples.html?eff=calm"
  echo "SERVE Focus http://127.0.0.1:$VITE_PORT/qa-examples.html?eff=focus"
  echo "SERVE press Enter to stop and clean up"
  read -r _ || true
}

if [ "${1:-}" = SERVE ]; then serve; else
rows="${*:-$(seq -f 'T%g' 1 81 | tr '\n' ' ')}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'T' 't')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
fi
alive=0
for p in $PIDS; do kill_tree "$p"; done
sleep 0.3
for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
cleanup
echo "CLEAN worktrees $([ "$(git worktree list | grep -cF "$BASE")" = 0 ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive temporary-folder $([ -d "$BASE" ] && echo kept || echo removed)"
