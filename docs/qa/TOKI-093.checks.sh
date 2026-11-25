#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-093.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile` (served from the pnpm store when it is warm); connections to a Vite server on
# 127.0.0.1. It writes nothing to GitHub, opens no pull request and calls no `gh`.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-093.checks.sh [T1 T2 ...]
#   V=<commit> bash docs/qa/TOKI-093.checks.sh SERVE   starts the preview page of the temporary worktree for the
#                                                      manual row, prints its two addresses (Calm and Focus) and
#                                                      waits for Enter.
# It reads files of the commit V with `git show`. A row that runs a tool uses ONE temporary worktree of V, created on
# first use under one folder (BASE, made in the current shell, exported as TMPDIR and given to every process it starts
# through `env -i`), installed with `pnpm install --frozen-lockfile` under Node 22. The throwaway tests, type cases,
# scripts and page measurements that some rows need are written inside that worktree (or BASE) only. A row that changes
# a file of the worktree restores it with `git checkout` and is paired with an unchanged run; a check on text is paired
# with a changed copy of the text made in memory. Everything the script started (worktree, folder, processes) is removed
# when it ends, even when a row fails. The repository itself is not changed. No `.env` file is read or created. It prints
# one line for each row: counts, exit codes and words; no value of a secret and no tool output. A row that loops prints
# how many items it checked. A row that cannot be shown prints "(Blocked)" and the reason.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack. The browser is the Chromium that
# Playwright has cached on the machine (the Playwright of the commit under test, 1.65.1).
set -uo pipefail
V="${V:-HEAD}"
doc() { git show "$V:$1" 2>/dev/null; }
exists() { git cat-file -e "$V:$1" 2>/dev/null; }
files() { git ls-tree -r --name-only "$V" -- "$@" 2>/dev/null; }
# cnt <text> <ERE>: how many lines of the text match (a count, also when it is 0)
cnt() { local n; n=$(printf '%s\n' "$1" | grep -cE -- "$2"); echo "${n:-0}"; }
SPEC="docs/specs/2026-11-16-destructive-patterns-design.md"
TSPEC="docs/specs/2026-11-16-tokens-package-design.md"
UI="packages/ui-web"
CD="$UI/src/components/ConfirmDialog"
PAT="apps/web/src/patterns"

BASE=$(mktemp -d); export TMPDIR="$BASE"
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; PIDS=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; wait "$1" 2>/dev/null; }
cleanup() {
  local p alive=0 wtleft=0 stleft=same
  for p in $PIDS; do kill_tree "$p"; done
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
  WT=""
  for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
  alive=$((alive + $(pgrep -f "$(basename "$BASE")" 2>/dev/null | wc -l | tr -d ' ')))
  wtleft=$(git worktree list --porcelain | grep -c "$(basename "$BASE")")
  rm -rf "$BASE"
  git worktree prune >/dev/null 2>&1
  [ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] || stleft=changed
  echo "CLEAN worktrees $([ "$wtleft" = 0 ] && echo same || echo left) status $stleft processes $alive temporary-folder $([ -e "$BASE" ] && echo left || echo removed)"
}
trap cleanup EXIT

N22=""; NEED22=0
NODEV=$(node --version 2>/dev/null)
case "$NODEV" in
  v22.*) ;;
  *) N22=$(ls -d "$HOME"/.nvm/versions/node/v22*/bin 2>/dev/null | tail -1); [ -n "$N22" ] || NEED22=1 ;;
esac
NODEPATH="${N22:+$N22:}$PATH"
nodebin() { PATH="$NODEPATH" node "$@"; }
# pnenv <VAR=value ...> -- <pnpm args>: runs pnpm in the worktree with only those variables
pnenv() { local envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift; ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" NO_COLOR=1 ${envs[@]+"${envs[@]}"} corepack pnpm "$@" ); }
# pnin <dir> <VAR=value ...> -- <pnpm args>: the same in a folder of the worktree
pnin() { local d="$1"; shift; local envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift; ( cd "$WT/$d" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" NO_COLOR=1 ${envs[@]+"${envs[@]}"} corepack pnpm "$@" ); }
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
firstline() { head -1 | tr -d '\r' | cut -c1-160; }
# jrow <file> <ID> <key...>: prints "ID v1 v2 ..." from a JSON file of numbers; a key that was not recorded prints ?
jrow() {
  local f="$1" id="$2"; shift 2
  [ -s "$f" ] || { echo "$id (Blocked) the throwaway test of the temporary worktree wrote no result"; return; }
  nodebin -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log([process.argv[2],...process.argv.slice(3).map(k=>r[k]===undefined?"?":r[k])].join(" "))' "$f" "$id" "$@"
}
# nums <ID> <v...>: prints the ID and the values
nums() { echo "$*"; }

# ---- the throwaway sources, written into BASE only (and copied into the temporary worktree by the runners) ------------
write_kit() {
  [ -d "$KIT" ] && return 0
  mkdir -p "$KIT/types-web" "$KIT/types-ui"
  cat > "$KIT/qa.ui.test.tsx" <<'QA_KIT_0'
// @ts-nocheck
// Throwaway test of the QA checks (TOKI-131). It lives only in the temporary worktree, records counts in a JSON
// file (QA_OUT) and asserts nothing: the checks script reads the counts.
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { writeFileSync } from "node:fs";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ConfirmDialog } from "../components/ConfirmDialog";
import * as Entry from "../index";
import { componentExamples } from "../examples";

const R: Record<string, number> = {};
// chk: counts how many times the condition held; every call makes sure the key exists
const chk = (key: string, ok: unknown) => {
  R[key] = (R[key] ?? 0) + (ok ? 1 : 0);
};
const num = (key: string, value: number) => {
  R[key] = value;
};
const sec = async (label: string, fn: () => Promise<void> | void) => {
  try {
    await fn();
  } catch (e) {
    R["crash"] = (R["crash"] ?? 0) + 1;
    R["crash:" + label] = 1;
  } finally {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  }
};
const panel = () => document.querySelector(".modal") as HTMLElement | null;
const scrim = () => document.querySelector(".scrim") as HTMLElement | null;
const base = (over = {}) => ({
  open: true,
  title: "Delete this message?",
  description: "It will be removed for everyone.",
  target: "Lan's message",
  confirmLabel: "Delete",
  cancelLabel: "Cancel",
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  ...over,
});
afterEach(() => {
  vi.useRealTimers();
});

test("collect", async () => {
  const user = userEvent.setup();

  await sec("exports", () => {
    chk("e1", typeof Entry.ConfirmDialog === "function");
    chk("e2", Array.isArray(Entry.confirmVariants) && Entry.confirmVariants.join() === "danger,primary");
    chk("e3", Array.isArray(Entry.confirmCancelReasons) && Entry.confirmCancelReasons.join() === "cancel,escape,outside");
    num("e4", Entry.confirmVariants.length);
  });

  await sec("T19 R3 empty texts", () => {
    render(<ConfirmDialog {...base({ title: "", description: "", confirmLabel: "", cancelLabel: "", target: "X" })} />);
    chk("t19a", panel()?.textContent === "X");
    cleanup();
    render(<ConfirmDialog {...base({ title: "Hi", description: "", confirmLabel: "", cancelLabel: "", target: "X" })} />);
    chk("t19b", panel()?.textContent !== "X");
  });

  await sec("R4 markup", () => {
    render(<ConfirmDialog {...base()} />);
    const p = panel()!;
    num("m_panels", document.querySelectorAll(".modal.cfm").length);
    num("m_modals", document.querySelectorAll(".modal").length);
    chk("m_role", p.getAttribute("role") === "dialog");
    chk("m_title", !!screen.queryByRole("heading", { name: "Delete this message?" }));
    num("m_buttons", p.querySelectorAll("button").length);
    num("m_mbd", p.querySelectorAll(".mbd").length);
    num("m_mft", p.querySelectorAll(".mft").length);
    const body = p.querySelector(".mbd")!;
    const foot = p.querySelector(".mft")!;
    chk("m_sibling", foot.parentElement === p && body.parentElement === p);
    chk("m_infoot", body.contains(foot));
    const txt = p.querySelector("p.cfm-text") as HTMLElement;
    chk("d_ptr", !!txt && !!txt.id && p.getAttribute("aria-describedby") === txt.id);
    chk("d_id", !!txt?.id);
    chk("c_order", Array.from(body.children).map((c) => c.className).join() === "cfm-text,cfm-target");
    chk("c_strong", p.querySelector("p.cfm-target > strong")?.textContent === "Lan's message");
    const btns = Array.from(p.querySelectorAll(".mft button"));
    chk("b_order", btns.map((b) => b.textContent).join() === "Cancel,Delete");
    num("b_btn", btns.filter((b) => b.classList.contains("btn")).length);
    chk("b_danger", btns[1].classList.contains("danger"));
    chk("b_cancelplain", !btns[0].classList.contains("danger") && !btns[0].classList.contains("primary"));
    cleanup();
    render(<ConfirmDialog {...base({ description: undefined })} />);
    num("d_attr_none", panel()!.hasAttribute("aria-describedby") ? 1 : 0);
    num("c_only", panel()!.querySelectorAll("p.cfm-text").length);
    chk("c_target_only", panel()!.querySelectorAll(".mbd > p.cfm-target").length === 1);
    cleanup();
    render(<ConfirmDialog {...base({ variant: "primary" })} />);
    const b2 = Array.from(panel()!.querySelectorAll(".mft button"));
    chk("b_primary", b2[1].classList.contains("primary") && !b2[1].classList.contains("danger"));
  });

  await sec("R4 description is one string", () => {
    const { rerender } = render(<ConfirmDialog {...base({ description: "One. Two." })} />);
    num("s_two", panel()!.querySelectorAll("p.cfm-text").length);
    chk("s_two_text", panel()!.querySelector("p.cfm-text")!.textContent === "One. Two.");
    rerender(<ConfirmDialog {...base({ description: "One.\nTwo." })} />);
    num("s_nl", panel()!.querySelectorAll("p.cfm-text").length);
    rerender(<ConfirmDialog {...base({ description: "<b>x</b> a<br>b" })} />);
    num("s_b", panel()!.querySelectorAll("p.cfm-text b, p.cfm-text br").length);
  });

  await sec("R4 never closes itself", async () => {
    const p = base();
    render(<ConfirmDialog {...p} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    chk("n_open", !!panel());
    await user.keyboard("{Escape}");
    chk("n_open", !!panel());
    await user.click(scrim()!);
    chk("n_open", !!panel());
    await user.click(screen.getByRole("button", { name: "Delete" }));
    chk("n_open", !!panel());
  });

  await sec("R5 target", () => {
    render(<ConfirmDialog {...base({ title: "Delete this?", description: "It goes.", target: "Zed file" })} />);
    const t = panel()!.querySelectorAll("p.cfm-target");
    chk("g1", t.length === 1 && t[0].querySelector("strong")?.textContent === "Zed file");
    chk("g1b", !"Delete this?It goes.".includes("Zed file"));
    cleanup();
    render(<ConfirmDialog {...base({ title: "Do you want to continue?", description: "Any member can read it.", target: "An" })} />);
    const a = panel()!.querySelectorAll("p.cfm-target");
    num("g2n", a.length);
    chk("g2s", a[0]?.querySelector("strong")?.textContent === "An");
    cleanup();
    render(<ConfirmDialog {...base({ title: "Delete Lan's message?", target: "Lan's message" })} />);
    num("g3n", panel()!.querySelectorAll("p.cfm-target").length);
  });

  await sec("R5 blank in test", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const target of ["", "   "]) {
      let thrown: any = null;
      try {
        render(<ConfirmDialog {...base({ target })} />);
      } catch (e) {
        thrown = e;
      }
      chk("g4thrown", thrown instanceof Error);
      chk("g4msg", thrown instanceof Error && /target/.test(thrown.message));
      cleanup();
    }
    let ok = null;
    try {
      render(<ConfirmDialog {...base()} />);
      ok = false;
    } catch {
      ok = true;
    }
    num("g4valid_throw", ok ? 1 : 0);
    err.mockRestore();
  });

  await sec("R5 blank in production", () => {
    vi.stubEnv("DEV", false);
    for (const target of ["", "   "]) {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      let threw = 0;
      try {
        render(<ConfirmDialog {...base({ target })} />);
      } catch {
        threw = 1;
      }
      R["g5threw"] = (R["g5threw"] ?? 0) + threw;
      chk("g5none", !scrim() && !panel());
      chk("g5err", err.mock.calls.length >= 1 && /target/.test(String(err.mock.calls[0]?.[0])));
      cleanup();
      err.mockRestore();
    }
  });

  await sec("R6 focus and reasons", async () => {
    const p = base();
    render(<ConfirmDialog {...p} />);
    chk("f1", document.activeElement === screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Enter}");
    num("f1_confirm", p.onConfirm.mock.calls.length);
    cleanup();
    const q = base();
    render(<ConfirmDialog {...q} />);
    await user.keyboard("{Escape}");
    chk("r_esc", q.onCancel.mock.calls.length === 1 && q.onCancel.mock.calls[0][0] === "escape");
    await user.click(scrim()!);
    chk("r_out", q.onCancel.mock.calls.length === 2 && q.onCancel.mock.calls[1][0] === "outside");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    chk("r_can", q.onCancel.mock.calls.length === 3 && q.onCancel.mock.calls[2][0] === "cancel");
    num("r_confirm_after", q.onConfirm.mock.calls.length);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    num("r_confirm_once", q.onConfirm.mock.calls.length);
    chk("r_confirm_cancels", q.onCancel.mock.calls.length === 3);
  });

  await sec("R7 busy", async () => {
    const p = base({ busy: true });
    render(<ConfirmDialog {...p} />);
    const bs = Array.from(panel()!.querySelectorAll(".mft button"));
    num("y_dis", bs.filter((b) => (b as HTMLButtonElement).disabled).length);
    chk("y_aria", panel()!.getAttribute("aria-busy") === "true");
    await user.keyboard("{Escape}");
    await user.click(scrim()!);
    num("y_cancel", p.onCancel.mock.calls.length);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    num("y_confirm", p.onConfirm.mock.calls.length);
    cleanup();
    const q = base();
    const { rerender } = render(<ConfirmDialog {...q} />);
    const dis = Array.from(panel()!.querySelectorAll(".mft button")).filter((b) => (b as HTMLButtonElement).disabled).length;
    num("y_free_dis", dis);
    chk("y_free_aria", !panel()!.hasAttribute("aria-busy"));
    chk("y_focus_before", document.activeElement === screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");
    await user.click(scrim()!);
    num("y_free_cancel", q.onCancel.mock.calls.length);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    num("y_free_confirm", q.onConfirm.mock.calls.length);
    q.onCancel.mockClear();
    await act(async () => {
      rerender(<ConfirmDialog {...q} busy />);
    });
    chk("y_focus_panel", document.activeElement === panel());
  });

  await sec("R9 examples", async () => {
    const entry = componentExamples[componentExamples.length - 1];
    chk("x_last", entry.component === "ConfirmDialog");
    const list = entry.examples;
    const ids = ["delete-message", "archive-channel", "notify-channel", "busy", "long-target"];
    num("x_ids", list.filter((e, i) => e.id === ids[i]).length);
    num("x_count", list.length);
    chk("x_unique", new Set(list.map((e) => e.id)).size === list.length);
    let variantsCovered = 0;
    let busyCovered = 0;
    for (const e of list) {
      const view = render(<div>{e.element}</div>);
      const opener = view.container.querySelector("button") as HTMLButtonElement;
      chk("x_first_is_opener", !!opener && !panel());
      await user.click(opener);
      chk("x_opened", !!panel());
      const p = panel();
      if (p) {
        const conf = p.querySelector(".mft button:last-child") as HTMLElement;
        if (e.id === "delete-message") {
          chk("x_dm_danger", conf.classList.contains("danger"));
          chk("x_dm_title", !!screen.queryByRole("heading", { name: "Delete this message?" }));
          variantsCovered += conf.classList.contains("danger") ? 1 : 0;
        }
        if (e.id === "archive-channel") {
          chk("x_ac_danger", conf.classList.contains("danger"));
          const d = p.querySelector("p.cfm-text")?.textContent ?? "";
          const tg = p.querySelector("p.cfm-target strong")?.textContent ?? "";
          chk("x_ac_names", tg.startsWith("#") && /\d+\s+members/.test(d));
        }
        if (e.id === "notify-channel") {
          chk("x_nc_primary", conf.classList.contains("primary"));
          variantsCovered += conf.classList.contains("primary") ? 1 : 0;
        }
        if (e.id === "busy") {
          chk("x_busy", p.getAttribute("aria-busy") === "true");
          busyCovered += p.getAttribute("aria-busy") === "true" ? 1 : 0;
          await new Promise((r) => setTimeout(r, 3300));
        }
        if (e.id === "long-target") {
          num("x_lt_len", (p.querySelector("p.cfm-target strong")?.textContent ?? "").length);
        }
      }
      // close on each reason, then check that focus returns to this demo's own opener
      for (const how of ["cancel", "escape", "outside", "confirm"]) {
        if (!panel()) {
          await user.click(opener);
          if (e.id === "busy") await new Promise((r) => setTimeout(r, 3300));
        }
        if (how === "cancel") await user.click(screen.getByRole("button", { name: "Cancel" }));
        if (how === "escape") await user.keyboard("{Escape}");
        if (how === "outside") await user.click(scrim()!);
        if (how === "confirm") await user.click(panel()!.querySelector(".mft button:last-child") as HTMLElement);
        chk("x_closed_" + how, !panel());
        if (how === "escape") chk("x_focus_back", document.activeElement === opener);
      }
      cleanup();
    }
    num("x_variants_cov", variantsCovered);
    num("x_busy_cov", busyCovered);
  });

  writeFileSync(`${process.env.QA_DIR}/ui.json`, JSON.stringify(R));
  expect(true).toBe(true);
}, 120000);
QA_KIT_0
  cat > "$KIT/qa.web.test.tsx" <<'QA_KIT_1'
// @vitest-environment jsdom
// @ts-nocheck
// Throwaway test of the QA checks (TOKI-131). It lives only in the temporary worktree, records counts in a JSON
// file (QA_OUT) and asserts nothing: the checks script reads the counts.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { writeFileSync } from "node:fs";
import { useEffect, useRef, useState } from "react";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import { Providers } from "../test/providers";
import * as Patterns from "../patterns";
import { actionPatterns } from "../patterns/actions";
import { ConfirmAction } from "../patterns/ConfirmAction";
import { hasFormContent } from "../patterns/formContent";
import { setConnectionCheck } from "../patterns/online";
import { useOnlineGate } from "../patterns/useOnlineGate";
import { UNDO_KEY_LIMIT, rememberToastKey, useUndo } from "../patterns/useUndo";

const R: Record<string, number> = {};
const chk = (key: string, ok: unknown) => {
  R[key] = (R[key] ?? 0) + (ok ? 1 : 0);
};
const num = (key: string, value: number) => {
  R[key] = value;
};
const sec = async (label: string, fn: () => Promise<void> | void) => {
  try {
    await fn();
  } catch (e) {
    R["crash"] = (R["crash"] ?? 0) + 1;
    R["crash:" + label + ":" + String(e?.message ?? e).split("\n")[0].slice(0, 60)] = 1;
  } finally {
    cleanup();
    setConnectionCheck(null);
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
};

let run: any;
let gate: any;
let runs: any[] = [];
function Harness() {
  const api = useUndo();
  const g = useOnlineGate();
  run = api.run;
  gate = g.ensureOnline;
  runs.push(api.run);
  return null;
}
function Unmountable({ show }: { show: boolean }) {
  return show ? <Harness /> : null;
}
const mount = () =>
  render(
    <Providers>
      <Harness />
    </Providers>,
  );
const undoBtn = () => screen.queryAllByRole("button", { name: "Undo" });
const has = (t: string) => screen.queryAllByText(t).length;
const TXT = "Pinned to conversation";
const start = async (args = {}) => {
  let out: any;
  await act(async () => {
    out = await run({ action: "pinMessage", text: TXT, perform: vi.fn(), undo: vi.fn(), ...args });
  });
  return out;
};
const FAIL = "That did not work. Try again.";
const UFAIL = "Could not undo. Try again.";
const OFF = "You are offline. Try again when the connection is back.";
const UOFF = "You are offline, so this was not undone.";
const adv = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  runs = [];
});
afterEach(() => {
  setConnectionCheck(null);
});

const T = (label: string, fn: any) => test(label, () => sec(label, fn), 40000);
  // ---- R11 (c): a wrong id, cast past the types
  T("R11c run", async () => {
    vi.useFakeTimers();
    mount();
    for (const [id, pat] of [["deleteOwnMessage", "confirm"], ["deleteUnsentMessage", "none"], ["nopeAction", "unknown"]]) {
      const perform = vi.fn();
      let thrown: any = null;
      let returned: any = "unset";
      try {
        returned = run({ action: id, text: "x", perform, undo: vi.fn() });
      } catch (e) {
        thrown = e;
      }
      chk("w1_sync", thrown instanceof Error && returned === "unset");
      chk("w1_id", thrown instanceof Error && thrown.message.includes(id));
      chk("w1_pat", thrown instanceof Error && thrown.message.includes(pat));
      num("w1_perform", (R["w1_perform"] ?? 0) + perform.mock.calls.length);
      num("w1_toast", (R["w1_toast"] ?? 0) + has("x"));
    }
    let ok: any;
    await act(async () => {
      ok = run({ action: "pinMessage", text: "x", perform: vi.fn(), undo: vi.fn() });
      await ok;
    });
    chk("w1_valid", ok instanceof Promise);
  });

  T("R11c ConfirmAction", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [id, pat] of [["pinMessage", "undo"], ["deleteUnsentMessage", "none"], ["nopeAction", "unknown"]]) {
      let thrown: any = null;
      try {
        render(
          <Providers>
            <ConfirmAction action={id} open title="T" target="Z" confirmLabel="Go" onConfirm={vi.fn()} onCancel={vi.fn()} />
          </Providers>,
        );
      } catch (e) {
        thrown = e;
      }
      chk("w2_throw", thrown instanceof Error);
      chk("w2_id", thrown instanceof Error && thrown.message.includes(id));
      chk("w2_pat", thrown instanceof Error && thrown.message.includes(pat));
      cleanup();
    }
    let thrown2 = false;
    try {
      render(
        <Providers>
          <ConfirmAction action="deleteOwnMessage" open title="T" target="Z" confirmLabel="Go" onConfirm={vi.fn()} onCancel={vi.fn()} />
        </Providers>,
      );
    } catch {
      thrown2 = true;
    }
    num("w2_valid_throw", thrown2 ? 1 : 0);
  });

  // ---- R12
  T("R12 done and order", async () => {
    vi.useFakeTimers();
    mount();
    const order: string[] = [];
    let seenBefore = -1;
    const perform = vi.fn(() => {
      order.push("perform");
      seenBefore = has(TXT);
    });
    const out = await start({ perform });
    chk("u1_out", out === "done");
    num("u1_perform", perform.mock.calls.length);
    chk("u1_text", has(TXT) === 1);
    num("u1_undo", undoBtn().length);
    num("u1_before", seenBefore);
    // synchronous perform: called inside the call to run
    cleanup();
    mount();
    const p2 = vi.fn();
    let calledWithinCall = -1;
    await act(async () => {
      const pr = run({ action: "pinMessage", text: TXT, perform: p2, undo: vi.fn() });
      calledWithinCall = p2.mock.calls.length;
      await pr;
    });
    num("u2_sync", calledWithinCall);
    chk("u2_toast_before_timer", has(TXT) === 1 && vi.getTimerCount() > 0);
    // asynchronous perform: no toast before the server answered
    cleanup();
    mount();
    let finish: any;
    const slow = () => new Promise<void>((r) => (finish = r));
    let outcome: any;
    await act(async () => {
      void run({ action: "pinMessage", text: TXT, perform: slow, undo: vi.fn() }).then((o) => (outcome = o));
    });
    num("u3_before", has(TXT));
    await act(async () => finish());
    chk("u3_after", has(TXT) === 1 && outcome === "done");
  });

  T("R12 failed", async () => {
    vi.useFakeTimers();
    mount();
    let rejections = 0;
    const cases = [
      () => {
        throw new Error("boom");
      },
      () => Promise.reject(new Error("boom")),
    ];
    for (const perform of cases) {
      let out: any;
      await act(async () => {
        try {
          out = await run({ action: "pinMessage", text: TXT, perform, undo: vi.fn() });
        } catch {
          rejections++;
        }
      });
      chk("u4_out", out === "failed");
      chk("u4_toast", has(FAIL) === 1);
      num("u4_undo", (R["u4_undo"] ?? 0) + undoBtn().length);
      num("u4_text", (R["u4_text"] ?? 0) + has(TXT));
      cleanup();
      mount();
    }
    num("u4_rej", rejections);
  });

  T("R12 blocked", async () => {
    vi.useFakeTimers();
    mount();
    setConnectionCheck(() => false);
    const perform = vi.fn();
    const out = await start({ perform });
    chk("u5_out", out === "blocked");
    num("u5_perform", perform.mock.calls.length);
    num("u5_undo", undoBtn().length);
    num("u5_text", has(TXT));
    chk("u5_msg", has(OFF) === 1);
    // a check that throws never blocks
    setConnectionCheck(() => {
      throw new Error("x");
    });
    const out2 = await start({ perform });
    chk("u5_throw_done", out2 === "done");
  });

  // ---- R13
  T("R13 offline undo", async () => {
    vi.useFakeTimers();
        mount();
    const undo = vi.fn();
    await start({ undo });
    setConnectionCheck(() => false);
    await act(async () => {
      fireEvent.click(undoBtn()[0]);
    });
    num("o1_undo", undo.mock.calls.length);
    chk("o1_msg", has(UOFF) === 1);
    num("o1_blocked_text", has(OFF));
    num("o1_btn", undoBtn().length);
  });

  T("R13 online undo", async () => {
    vi.useFakeTimers();
        mount();
    const seen: number[] = [];
    let reject: any;
    const undo = vi.fn(() => {
      seen.push(undoBtn().length);
      return new Promise<void>((_, r) => (reject = r));
    });
    await start({ undo });
    await act(async () => {
      fireEvent.click(undoBtn()[0]);
    });
    num("o2_calls", undo.mock.calls.length);
    num("o2_btn_at_undo", seen[0] ?? -1);
    num("o2_before_reject", has(UFAIL));
    await act(async () => reject(new Error("late")));
    chk("o2_awaited", has(UFAIL) === 1);
  });

  T("R13 failing undo", async () => {
    vi.useFakeTimers();
        for (const undo of [
      () => {
        throw new Error("x");
      },
      () => Promise.reject(new Error("x")),
    ]) {
      mount();
      await start({ undo });
      await act(async () => {
        fireEvent.click(undoBtn()[0]);
      });
      chk("o3_toast", has(UFAIL) === 1);
      num("o3_btn", (R["o3_btn"] ?? 0) + undoBtn().length);
      cleanup();
    }
  });

  T("R13 good undo is quiet", async () => {
    vi.useFakeTimers();
        for (const undo of [vi.fn(), vi.fn(() => Promise.resolve())]) {
      mount();
      await start({ undo });
      await act(async () => {
        fireEvent.click(undoBtn()[0]);
      });
      await adv(10);
      num("o4_calls", (R["o4_calls"] ?? 0) + undo.mock.calls.length);
      num("o4_toasts", (R["o4_toasts"] ?? 0) + has(TXT) + has(UFAIL) + has(UOFF) + has(FAIL));
      cleanup();
    }
  });

  // ---- R14
  T("R14 time", async () => {
    vi.useFakeTimers();
    mount();
    await start();
    await adv(4999);
    chk("k1_at4999", has(TXT) === 1 && undoBtn().length === 1);
    await adv(1);
    chk("k1_at5000", has(TXT) === 0 && undoBtn().length === 0);
    cleanup();
    // paired: the button works before 5000
        mount();
    const undo = vi.fn();
    await start({ undo });
    await adv(4999);
    await act(async () => {
      fireEvent.click(undoBtn()[0]);
    });
    num("k1_early_press", undo.mock.calls.length);
    cleanup();
    mount();
    const undo2 = vi.fn();
    await start({ undo: undo2 });
    await adv(5001);
    num("k1_undo_after", undo2.mock.calls.length);
  });

  // ---- R15
  T("R15 key", async () => {
    vi.useFakeTimers();
    mount();
    await start({ key: "m1", text: "first" });
    await start({ key: "m1", text: "second" });
    num("q1_first", has("first"));
    num("q1_second", has("second"));
    cleanup();
    mount();
    await start({ key: "a", text: "ta" });
    await start({ key: "b", text: "tb" });
    num("q2_keys", has("ta") + has("tb"));
    cleanup();
    mount();
    await start({ text: "n1" });
    await start({ text: "n2" });
    num("q2_nokey", has("n1") + has("n2"));
    cleanup();
    mount();
    await start({ text: "s1" });
    await adv(2000);
    await start({ text: "s2" });
    await adv(2999);
    chk("q2_s_at_4999_both", has("s1") === 1 && has("s2") === 1);
    await adv(1);
    num("q2_s1_at5000", has("s1"));
    num("q2_s2_at5000", has("s2"));
    await adv(2000);
    num("q2_s2_at7000", has("s2"));
    cleanup();
    // 60 keys
    mount();
    let done = 0;
    for (let i = 0; i < 60; i++) {
      const o = await start({ key: "k" + i, text: "t" + i });
      if (o === "done") done++;
    }
    num("q3_done", done);
    await adv(6000);
    const o2 = await start({ key: "k59", text: "again" });
    chk("q3_after_expiry", o2 === "done" && has("again") === 1);
    const map = new Map();
    for (let i = 0; i < 60; i++) rememberToastKey(map, "k" + i, "id" + i);
    num("q3_size", map.size);
    num("q3_limit", UNDO_KEY_LIMIT);
    let recent = 0;
    for (let i = 10; i < 60; i++) if (map.has("k" + i)) recent++;
    num("q3_recent", recent);
    num("q3_old", Array.from({ length: 10 }, (_, i) => map.has("k" + i)).filter(Boolean).length);
  });

  // ---- R16
  T("R16 identity and unmount", async () => {
    vi.useFakeTimers();
        const view = render(
      <Providers>
        <Unmountable show />
      </Providers>,
    );
    const first = runs[0];
    view.rerender(
      <Providers>
        <Unmountable show />
      </Providers>,
    );
    await start({ text: "one" });
    view.rerender(
      <Providers>
        <Unmountable show />
      </Providers>,
    );
    num("i_renders", runs.length);
    chk("i_same", runs.every((r) => r === first));
    // the toast outlives the component
    const undo = vi.fn();
    await start({ text: "outlive", undo });
    view.rerender(
      <Providers>
        <Unmountable show={false} />
      </Providers>,
    );
    chk("i_toast_after_unmount", has("outlive") === 1 && undoBtn().length >= 1);
    await act(async () => {
      fireEvent.click(undoBtn()[undoBtn().length - 1]);
    });
    num("i_undo_after_unmount", undo.mock.calls.length);
  });

  // ---- R17
  T("R17 check", async () => {
    vi.useFakeTimers();
    mount();
    setConnectionCheck(() => true);
    chk("c_true", gate() === true);
    setConnectionCheck(() => false);
    let r: any;
    await act(async () => {
      r = gate();
    });
    chk("c_false", r === false);
    cleanup();
    mount();
    setConnectionCheck(() => {
      throw new Error("x");
    });
    let r3: any;
    await act(async () => {
      r3 = gate();
    });
    chk("c_throw", r3 === true);
    setConnectionCheck(() => false);
    setConnectionCheck(null);
    let r4: any;
    await act(async () => {
      r4 = gate();
    });
    chk("c_null", r4 === true);
  });

  T("R17 default", async () => {
    vi.useFakeTimers();
    mount();
    const on = (v: any) => {
      Object.defineProperty(window.navigator, "onLine", { value: v, configurable: true });
    };
    on(false);
    let a: any;
    await act(async () => {
      a = gate();
    });
    num("d_offline", a ? 1 : 0);
    on(true);
    await act(async () => {
      a = gate();
    });
    num("d_online", a ? 1 : 0);
    on(false);
    vi.stubGlobal("navigator", undefined);
    await act(async () => {
      a = gate();
    });
    num("d_nonav", a ? 1 : 0);
    vi.unstubAllGlobals();
    // null restores the default after a set
    on(false);
    setConnectionCheck(() => true);
    await act(async () => {
      a = gate();
    });
    const withFn = a ? 1 : 0;
    setConnectionCheck(null);
    await act(async () => {
      a = gate();
    });
    num("d_restore", withFn === 1 && !a ? 1 : 0);
    on(true);
  });

  T("R17 toasts", async () => {
    vi.useFakeTimers();
    mount();
    setConnectionCheck(() => false);
    await act(async () => {
      gate();
    });
    num("g_action_blocked", has(OFF));
    num("g_action_undotext", has(UOFF));
    num("g_action_buttons", screen.queryAllByRole("button").length);
    await adv(2799);
    chk("g_at2799", has(OFF) === 1);
    await adv(1);
    chk("g_at2800", has(OFF) === 0);
    await act(async () => {
      gate("undo");
    });
    num("g_undo_undotext", has(UOFF));
    num("g_undo_blocked", has(OFF));
    await adv(3000);
    setConnectionCheck(() => true);
    await act(async () => {
      gate();
      gate("undo");
    });
    num("g_online", has(OFF) + has(UOFF));
  });

  // ---- R18
  T("R18 ConfirmAction", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const props = { action: "deleteOwnMessage", open: true, title: "Delete?", description: "Gone.", target: "Lan's message", confirmLabel: "Delete", onConfirm, onCancel: vi.fn() };
    render(
      <Providers>
        <ConfirmAction {...props} />
      </Providers>,
    );
    chk("a_cancel_label", !!screen.queryByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    num("a_online_confirm", onConfirm.mock.calls.length);
    onConfirm.mockClear();
    setConnectionCheck(() => false);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    num("a_offline_confirm", onConfirm.mock.calls.length);
    chk("a_open", !!document.querySelector(".modal.cfm"));
    chk("a_toast", has(OFF) === 1);
    setConnectionCheck(null);
    cleanup();
  });

  T("R18 forwards", async () => {
    function Host() {
      const ref = useRef(null);
      const [open, setOpen] = useState(false);
      return (
        <Providers>
          <button ref={ref} onClick={() => setOpen(true)}>
            opener
          </button>
          <ConfirmAction action="archiveChannel" open={open} busy title="t" target="#x" confirmLabel="Go" returnFocusRef={ref} onConfirm={vi.fn()} onCancel={() => setOpen(false)} />
        </Providers>
      );
    }
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole("button", { name: "opener" }));
    const p = document.querySelector(".modal.cfm");
    num("b_disabled", Array.from(p.querySelectorAll(".mft button")).filter((b) => b.disabled).length);
    chk("b_aria", p.getAttribute("aria-busy") === "true");
    cleanup();
    function Host2() {
      const ref = useRef(null);
      const [open, setOpen] = useState(false);
      return (
        <Providers>
          <button ref={ref} onClick={() => setOpen(true)}>
            opener
          </button>
          <ConfirmAction action="archiveChannel" open={open} title="t" target="#x" confirmLabel="Go" returnFocusRef={ref} onConfirm={vi.fn()} onCancel={() => setOpen(false)} />
        </Providers>
      );
    }
    render(<Host2 />);
    const opener = screen.getByRole("button", { name: "opener" });
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    chk("b_return", document.activeElement === opener);
  });

  T("R18 every confirm id", () => {
    const ids = Object.keys(actionPatterns).filter((k) => actionPatterns[k].pattern === "confirm");
    num("z_ids", ids.length);
    for (const id of ids) {
      const target = "Sample " + id;
      render(
        <Providers>
          <ConfirmAction action={id} open title="Sure?" target={target} confirmLabel="Go" onConfirm={vi.fn()} onCancel={vi.fn()} />
        </Providers>,
      );
      chk("z_shown", document.querySelector(".modal.cfm p.cfm-target strong")?.textContent === target);
      cleanup();
    }
  });

  // ---- R19
  T("R19", () => {
    const yes = [{ a: "x" }, { a: " x " }, { a: [1] }, { a: new Set([1]) }, { a: new Map([[1, 1]]) }, { a: "", b: "x" }];
    for (const v of yes) chk("h_true", hasFormContent(v) === true);
    num("h_true_n", yes.length);
    const no = [{ a: "" }, { a: "   " }, { a: "\n\t" }, { a: [] }, { a: new Set() }, { a: new Map() }, { a: 0 }, { a: 1 }, { a: true }, { a: false }, { a: null }, { a: undefined }, { a: {} }, { a: { b: "x" } }, {}];
    for (const v of no) chk("h_false", hasFormContent(v) === false);
    num("h_false_n", no.length);
    chk("h_empty", hasFormContent({}) === false);
    let thrown = 0;
    let results = 0;
    const getter = Object.defineProperty({}, "a", { enumerable: true, get() { throw new Error("no"); } });
    const proxy = new Proxy({}, { ownKeys() { throw new Error("no"); } });
    for (const v of [getter, proxy]) {
      try {
        if (hasFormContent(v) === false) results++;
      } catch {
        thrown++;
      }
    }
    num("h_no_throw_false", results);
    num("h_thrown", thrown);
  });

  // ---- R10/R11 data from the module
  T("R1 patterns index", () => {
    const vals = ["actionPatterns", "useUndo", "useOnlineGate", "setConnectionCheck", "ConfirmAction", "useFormGuard", "hasFormContent", "GUARD_ESCAPE"];
    for (const v of vals) chk("pi", Patterns[v] !== undefined);
    num("pi_n", vals.length);
  });

  T("actions", () => {
    num("p_rows", Object.keys(actionPatterns).length);
  });

afterAll(() => {
  writeFileSync(`${process.env.QA_DIR}/web.json`, JSON.stringify(R));
});
QA_KIT_1
  cat > "$KIT/qa.guard.test.tsx" <<'QA_KIT_2'
// @vitest-environment jsdom
// @ts-nocheck
// Throwaway test of the QA checks (TOKI-131). It lives only in the temporary worktree, records counts in a JSON
// file (QA_OUT) and asserts nothing: the checks script reads the counts.
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, Modal } from "@toki/ui-web";
import { writeFileSync } from "node:fs";
import { isValidElement, useState } from "react";
import { afterAll, expect, test, vi } from "vitest";
import { Providers } from "../test/providers";
import { GUARD_ESCAPE } from "../patterns/guardEscape";
import { hasFormContent } from "../patterns/formContent";
import { useFormGuard } from "../patterns/useFormGuard";

const R: Record<string, number> = {};
const chk = (key: string, ok: unknown) => {
  R[key] = (R[key] ?? 0) + (ok ? 1 : 0);
};
const num = (key: string, value: number) => {
  R[key] = value;
};
const sec = async (label: string, fn: () => Promise<void> | void) => {
  try {
    await fn();
  } catch (e) {
    R["crash"] = (R["crash"] ?? 0) + 1;
    R["crash:" + label + ":" + String(e?.message ?? e).split("\n")[0].slice(0, 60)] = 1;
  } finally {
    cleanup();
    vi.restoreAllMocks();
  }
};
const T = (label: string, fn: any) => test(label, () => sec(label, fn), 40000);

let lastGuard: any = null;
function FormScreen({ initial = "", onClose, bodyFocus }: any) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState(initial);
  const guard = useFormGuard({
    hasContent: hasFormContent({ text }),
    formName: "Create channel",
    onClose: (reason) => {
      onClose(reason);
      setOpen(false);
    },
  });
  lastGuard = guard;
  return (
    <>
      <Modal open={open} title="Create channel" closeLabel="Close" onRequestClose={guard.onRequestClose} footer={<Button onClick={guard.requestClose}>Cancel form</Button>}>
        <div onFocusCapture={guard.trackFocus}>
          <input aria-label="Name" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </Modal>
      {guard.discardDialog}
    </>
  );
}
const mount = (initial = "") => {
  const onClose = vi.fn();
  const view = render(
    <Providers>
      <FormScreen initial={initial} onClose={onClose} />
    </Providers>,
  );
  return { onClose, ...view };
};
const QTITLE = "Discard what you typed?";
const question = () => screen.queryAllByText(QTITLE).length;
const formOpen = () => !!screen.queryByRole("dialog", { name: "Create channel" });
const scrimOf = (title: string) => screen.getByRole("dialog", { name: title }).parentElement as HTMLElement;
const inputEl = () => screen.getByRole("textbox", { name: "Name" });

T("R20 shape", async () => {
  mount("draft");
  const g = lastGuard;
  num("s_keys", Object.keys(g).length);
  num("s_wanted", ["onRequestClose", "requestClose", "discardDialog", "trackFocus"].filter((k) => k in g).length);
  num("s_functions", [g.onRequestClose, g.requestClose, g.trackFocus].filter((f) => typeof f === "function").length);
  chk("s_element", g.discardDialog === null || isValidElement(g.discardDialog));
  num("s_len", g.requestClose.length);
});

T("R20 requestClose", async () => {
  const user = userEvent.setup();
  const { onClose } = mount("");
  await act(async () => {
    lastGuard.requestClose();
  });
  chk("rc_empty", onClose.mock.calls.length === 1 && onClose.mock.calls[0][0] === "close" && question() === 0);
  cleanup();
  const b = mount("draft");
  await act(async () => {
    lastGuard.requestClose();
  });
  chk("rc_content_asks", question() === 1);
  num("rc_content_close", b.onClose.mock.calls.length);
});

T("R21 no content", async () => {
  for (const how of ["escape", "outside", "close"]) {
    const user = userEvent.setup();
    const { onClose, unmount } = mount("");
    if (how === "escape") await user.keyboard("{Escape}");
    if (how === "outside") await user.click(scrimOf("Create channel"));
    if (how === "close") await user.click(screen.getByRole("button", { name: "Close" }));
    chk("n_reason", onClose.mock.calls.length === 1 && onClose.mock.calls[0][0] === how);
    chk("n_noquestion", question() === 0);
    unmount();
  }
});

T("R21 content outside", async () => {
  const user = userEvent.setup();
  const { onClose } = mount("draft");
  inputEl().focus();
  await user.click(scrimOf("Create channel"));
  num("o_onclose", onClose.mock.calls.length);
  num("o_question", question());
  chk("o_open", formOpen());
  chk("o_text", inputEl().value === "draft");
  chk("o_focus", document.activeElement === inputEl());
});

T("R21 content close and escape", async () => {
  const user = userEvent.setup();
  const { onClose } = mount("draft");
  await user.click(screen.getByRole("button", { name: "Close" }));
  num("c_close_q", question());
  num("c_close_onclose", onClose.mock.calls.length);
  await user.click(screen.getByRole("button", { name: "Keep editing" }));
  await user.keyboard("{Escape}");
  num("c_esc_q", question());
  num("c_esc_onclose", onClose.mock.calls.length);
  chk("c_value_ask", GUARD_ESCAPE === "ask");
  await user.click(screen.getByRole("button", { name: "Keep editing" }));
  await user.click(screen.getByRole("button", { name: "Cancel form" }));
  num("c_cancelform_q", question());
});

T("R22 texts", async () => {
  const user = userEvent.setup();
  mount("draft");
  await act(async () => {
    lastGuard.requestClose();
  });
  const dlg = screen.getByRole("dialog", { name: QTITLE });
  chk("x_title", !!dlg);
  chk("x_desc", dlg.querySelector("p.cfm-text")?.textContent === 'What you typed in "Create channel" will be lost.');
  chk("x_target", dlg.querySelector("p.cfm-target strong")?.textContent === "Create channel");
  const btns = Array.from(dlg.querySelectorAll(".mft button"));
  chk("x_keep", btns[0]?.textContent === "Keep editing");
  chk("x_confirm", btns[1]?.textContent === "Discard");
  chk("x_danger", btns[1]?.classList.contains("danger"));
  chk("x_is_confirmdialog", dlg.classList.contains("cfm"));
  chk("x_first_focus", document.activeElement === btns[0]);
});

T("R22 keep editing, Esc, outside", async () => {
  for (const how of ["keep", "escape", "outside"]) {
    const user = userEvent.setup();
    const { onClose, unmount } = mount("draft");
    inputEl().focus();
    await act(async () => {
      lastGuard.requestClose();
    });
    chk("k_asked", question() === 1);
    if (how === "keep") await user.click(screen.getByRole("button", { name: "Keep editing" }));
    if (how === "escape") await user.keyboard("{Escape}");
    if (how === "outside") await user.click(scrimOf(QTITLE));
    chk("k_closed", question() === 0);
    chk("k_noclose", onClose.mock.calls.length === 0);
    chk("k_open_text", formOpen() && inputEl().value === "draft");
    chk("k_focus", document.activeElement === inputEl());
    unmount();
  }
});

T("R22 body had focus", async () => {
  const user = userEvent.setup();
  mount("draft");
  inputEl().focus();
  inputEl().blur();
  chk("b_body", document.activeElement === document.body);
  await act(async () => {
    lastGuard.requestClose();
  });
  await user.click(screen.getByRole("button", { name: "Keep editing" }));
  chk("b_return", document.activeElement === inputEl());
});

T("R22 discard", async () => {
  const user = userEvent.setup();
  const { onClose } = mount("draft");
  await act(async () => {
    lastGuard.requestClose();
  });
  await user.click(screen.getByRole("button", { name: "Discard" }));
  chk("d_closed", question() === 0);
  chk("d_once", onClose.mock.calls.length === 1 && onClose.mock.calls[0][0] === "discard");
  chk("d_form_closed", !formOpen());
});

T("R22 first Esc", async () => {
  const user = userEvent.setup();
  const { onClose } = mount("draft");
  await act(async () => {
    lastGuard.requestClose();
  });
  num("e_asked", question());
  await user.keyboard("{Escape}");
  num("e_q_after", question());
  chk("e_form", formOpen());
  num("e_onclose", onClose.mock.calls.length);
});

T("R23 unmount", async () => {
  const body = document.body;
  const user = userEvent.setup();
  const before = body.children.length;
  const addD = vi.spyOn(document, "addEventListener");
  const remD = vi.spyOn(document, "removeEventListener");
  const addW = vi.spyOn(window, "addEventListener");
  const remW = vi.spyOn(window, "removeEventListener");
  const view = mount("draft");
  await act(async () => {
    lastGuard.requestClose();
  });
  chk("u_asked", question() === 1);
  const net0 = (add, rem) => {
    const a = {};
    for (const [t] of add.mock.calls) a[t] = (a[t] ?? 0) + 1;
    for (const [t] of rem.mock.calls) a[t] = (a[t] ?? 0) - 1;
    return Object.values(a).filter((v) => v > 0).length;
  };
  num("u_listeners_open", net0(addD, remD) + net0(addW, remW));
  num("u_children_open", body.children.length - before);
  cleanup();
  num("u_children", body.children.length - before);
  num("u_inert", document.querySelectorAll("[inert]").length);
  num("u_ariahidden", document.querySelectorAll("[aria-hidden=true]").length);
  num("u_overflow", body.style.overflow === "" ? 0 : 1);
  const net = (add, rem) => {
    const a = {};
    for (const [t] of add.mock.calls) a[t] = (a[t] ?? 0) + 1;
    for (const [t] of rem.mock.calls) a[t] = (a[t] ?? 0) - 1;
    return Object.values(a).filter((v) => v > 0).length;
  };
  num("u_listeners", net(addD, remD) + net(addW, remW));
});

afterAll(() => {
  writeFileSync(`${process.env.QA_DIR}/guard.json`, JSON.stringify(R));
});
QA_KIT_2
  cat > "$KIT/qa.guardignore.test.tsx" <<'QA_KIT_3'
// @vitest-environment jsdom
// @ts-nocheck
// Throwaway test of the QA checks (TOKI-131). It replaces the module that holds GUARD_ESCAPE with the other value the
// type allows ("ignore"), records counts in a JSON file (QA_OUT) and asserts nothing.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@toki/ui-web";
import { writeFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { Providers } from "../test/providers";
import { useFormGuard } from "../patterns/useFormGuard";

vi.mock("../patterns/guardEscape", () => ({ GUARD_ESCAPE: "ignore" }));

function Screen({ onClose }) {
  const guard = useFormGuard({ hasContent: true, formName: "Form", onClose });
  return (
    <>
      <Modal open title="Form" closeLabel="Close" onRequestClose={guard.onRequestClose}>
        <input aria-label="Name" />
      </Modal>
      {guard.discardDialog}
    </>
  );
}

test("ignore", async () => {
  const R: Record<string, number> = {};
  const onClose = vi.fn();
  render(
    <Providers>
      <Screen onClose={onClose} />
    </Providers>,
  );
  const user = userEvent.setup();
  await user.keyboard("{Escape}");
  R.i_onclose = onClose.mock.calls.length;
  R.i_question = screen.queryAllByText("Discard what you typed?").length;
  R.i_form = screen.queryAllByRole("dialog", { name: "Form" }).length;
  // paired: the close button still asks, so the guard itself works with this value
  await user.click(screen.getByRole("button", { name: "Close" }));
  R.i_close_asks = screen.queryAllByText("Discard what you typed?").length;
  writeFileSync(`${process.env.QA_DIR}/gi.json`, JSON.stringify(R));
  expect(true).toBe(true);
});
QA_KIT_3
  cat > "$KIT/qa-browser.mjs" <<'QA_KIT_4'
// Throwaway Playwright script of the QA checks (TOKI-131). It lives only in the temporary worktree.
// Usage: node qa-browser.mjs <port> <real|unbroken>. It prints one JSON line of numbers.
import { chromium } from "@playwright/test";

const port = process.argv[2];
const mode = process.argv[3] ?? "real";
const base = `http://127.0.0.1:${port}/preview.html`;
const out = {};

async function open(page, look, example) {
  await page.goto(`${base}?look=${look}`, { waitUntil: "load" });
  const fig = page.locator(`figure[data-example="ConfirmDialog/${example}"]`);
  await fig.waitFor({ state: "attached", timeout: 20000 });
  await fig.locator("button").first().click();
  await page.waitForSelector(".modal.cfm", { timeout: 10000 });
  // the busy demo is busy for a moment; the geometry does not depend on it
}

async function measure(page) {
  return page.evaluate(() => {
    const p = document.querySelector(".modal.cfm");
    const r = p.getBoundingClientRect();
    const buttons = Array.from(p.querySelectorAll(".mft button")).map((b) => Math.round(b.getBoundingClientRect().height));
    const strong = p.querySelector("p.cfm-target strong");
    const t = p.querySelector("p.cfm-target");
    const sr = strong.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(t).lineHeight) || parseFloat(getComputedStyle(t).fontSize) * 1.4;
    const vw = document.documentElement.clientWidth;
    return {
      buttons,
      fits: r.left >= 0 && r.right <= vw + 0.5 ? 1 : 0,
      panelOverflow: p.scrollWidth > p.clientWidth + 1 ? 1 : 0,
      pageOverflow: document.documentElement.scrollWidth > vw + 1 ? 1 : 0,
      targetOverflow: sr.right > r.right + 0.5 || t.scrollWidth > t.clientWidth + 1 ? 1 : 0,
      lines: Math.round(sr.height / lh),
      len: (strong.textContent || "").length,
    };
  });
}

const browser = await chromium.launch({ headless: true });
try {
  if (mode === "real") {
    for (const [w, key] of [[360, "w360"], [719, "w719"], [720, "w720"], [1280, "w1280"]]) {
      for (const look of ["calm", "focus"]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
        const page = await ctx.newPage();
        await open(page, look, "delete-message");
        const m = await measure(page);
        out[`${key}_${look}_buttons`] = m.buttons;
        out[`${key}_${look}_fits`] = m.fits;
        out[`${key}_${look}_panelOverflow`] = m.panelOverflow;
        out[`${key}_${look}_pageOverflow`] = m.pageOverflow;
        await ctx.close();
      }
    }
    for (const [w, key] of [[360, "w360"], [1280, "w1280"]]) {
      for (const look of ["calm", "focus"]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
        const page = await ctx.newPage();
        await open(page, look, "long-target");
        const m = await measure(page);
        out[`lt_${key}_${look}`] = m;
        await ctx.close();
      }
    }
  } else {
    // a target of 120 characters with no break opportunity, put into the open dialog
    for (const w of [360, 1280]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      await open(page, "calm", "long-target");
      await page.evaluate(() => {
        document.querySelector(".modal.cfm p.cfm-target strong").textContent = "a".repeat(120);
      });
      out[`unbroken_w${w}`] = await measure(page);
      await ctx.close();
    }
  }
} catch (e) {
  out.error = String(e.message ?? e).split("\n")[0].slice(0, 120);
} finally {
  await browser.close();
}
console.log(JSON.stringify(out));
QA_KIT_4
  cat > "$KIT/qa-data.mjs" <<'QA_KIT_5'
// Throwaway Node script of the QA checks (TOKI-131). It reads files that the checks script copied out of the commit
// under test (nothing in the repository), compares them with the tables of the spec and prints one JSON line of numbers.
// Usage: node --experimental-strip-types qa-data.mjs <actions|css|i18n> <files...>
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [, , cmd, ...args] = process.argv;
const out = {};

const cells = (line) => line.split("|").slice(1, -1).map((c) => c.trim());
const strip = (c) => c.replace(/^`|`$/g, "");

if (cmd === "actions") {
  // args: spec text, actions.ts, work folder
  const [specFile, actionsFile, work] = args;
  const spec = readFileSync(specFile, "utf8");
  const start = spec.indexOf("Table A. Every phase 1 action");
  const end = spec.indexOf("A Source that says", start);
  const tableRows = spec
    .slice(start, end)
    .split("\n")
    .filter((l) => /^\| `\w+` \|/.test(l))
    .map(cells)
    .map((c) => ({ id: strip(c[0]), pattern: c[2], source: c[3], owner: c[4] }));
  out.specRows = tableRows.length;
  const text = readFileSync(actionsFile, "utf8");
  const load = async (t, name) => {
    const f = `${work}/${name}.ts`;
    writeFileSync(f, t);
    return (await import(pathToFileURL(f).href)).actionPatterns;
  };
  const compare = (ap) => {
    const r = { rows: Object.keys(ap).length, ids: 0, patterns: 0, sources: 0, owners: 0 };
    for (const t of tableRows) {
      const row = ap[t.id];
      if (!row) continue;
      r.ids++;
      if (row.pattern === t.pattern) r.patterns++;
      if (row.source === t.source) r.sources++;
      if (row.owner === t.owner) r.owners++;
    }
    return r;
  };
  const ap = await load(text, "actions-real");
  Object.assign(out, compare(ap));
  const patterns = Object.values(ap).map((r) => r.pattern);
  out.undo = patterns.filter((p) => p === "undo").length;
  out.confirm = patterns.filter((p) => p === "confirm").length;
  out.none = patterns.filter((p) => p === "none").length;
  const fmt = (o) => Object.values(o).filter((r) => /^TOKI-\d{3}$/.test(r.owner)).length;
  out.ownerFmt = fmt(ap);
  out.patternValid = patterns.filter((p) => ["undo", "confirm", "none"].includes(p)).length;
  out.sourceFilled = Object.values(ap).filter((r) => typeof r.source === "string" && r.source.trim() !== "").length;
  const keys = [...text.matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]);
  out.keyLines = keys.length;
  out.uniqueKeys = new Set(keys).size;
  // mutated copies: one pattern flipped, one owner broken, one id listed twice
  const flip = text.replace(/(pinMessage: \{ pattern: )"undo"/, '$1"confirm"');
  out.mutPattern = compare(await load(flip, "actions-mut1")).patterns;
  const own = text.replace('owner: "TOKI-035"', 'owner: "TOKI-35"');
  out.mutOwnerFmt = 18 - fmt(await load(own, "actions-mut2"));
  const dupText = text + '\n  pinMessage: { pattern: "confirm" }\n';
  const dupKeys = [...dupText.matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]);
  out.mutDup = dupKeys.length - new Set(dupKeys).size;
}

if (cmd === "css") {
  // args: spec text, css file
  const [specFile, cssFile] = args;
  const spec = readFileSync(specFile, "utf8");
  const start = spec.indexOf("Table C. `ConfirmDialog.css`");
  const rows = spec
    .slice(start, spec.indexOf("### What the prototype does", start))
    .split("\n")
    .filter((l) => /^\| `\./.test(l))
    .map(cells)
    .map((c) => ({ sel: strip(c[0]), decls: strip(c[1]) }));
  const norm = (d) =>
    d
      .split(";")
      .map((x) => x.trim().replace(/\s*:\s*/, ":").replace(/\s+/g, " "))
      .filter(Boolean)
      .join(";");
  const parse = (css) => {
    const t = css.replace(/\/\*[\s\S]*?\*\//g, "");
    return [...t.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().replace(/\s+/g, " "), decls: norm(m[2]) }));
  };
  const compare = (css) => {
    const rules = parse(css);
    let matched = 0;
    for (const r of rows) if (rules.some((x) => x.sel === r.sel && x.decls === norm(r.decls))) matched++;
    const extra = rules.filter((x) => !rows.some((r) => r.sel === x.sel && norm(r.decls) === x.decls)).length;
    return { rules: rules.length, matched, extra };
  };
  const css = readFileSync(cssFile, "utf8");
  const real = compare(css);
  out.rules = real.rules;
  out.table = rows.length;
  out.matched = real.matched;
  out.extra = real.extra;
  const mutExtra = compare(css + "\n.cfm-extra { margin: 0; }\n");
  const mutDecl = compare(css.replace("margin: 0;", "margin: 1px;"));
  out.mutExtra = mutExtra.extra;
  out.mutDecl = rows.length - mutDecl.matched;
}

if (cmd === "i18n") {
  // args: spec text, en common.ts, vi common.ts, work folder
  const [specFile, enFile, viFile, work] = args;
  const spec = readFileSync(specFile, "utf8");
  const start = spec.indexOf("Table B. Texts of this ticket");
  const rows = spec
    .slice(start, spec.indexOf("None of these takes a number", start))
    .split("\n")
    .filter((l) => /^\| `common\./.test(l))
    .map(cells)
    .map((c) => ({ key: strip(c[0]), en: c[1], vi: c[2] }));
  const flat = (o, p = "common") =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[`${p}.${k}`, v]] : flat(v, `${p}.${k}`)));
  const load = async (file, name) => {
    const f = `${work}/${name}.ts`;
    writeFileSync(f, readFileSync(file, "utf8"));
    return Object.fromEntries(flat((await import(pathToFileURL(f).href)).common));
  };
  const en = await load(enFile, "common-en");
  const vi = await load(viFile, "common-vi");
  out.table = rows.length;
  out.enKeys = Object.keys(en).length;
  out.viKeys = Object.keys(vi).length;
  out.enMatch = rows.filter((r) => en[r.key] === r.en).length;
  out.viMatch = rows.filter((r) => vi[r.key] === r.vi).length;
  out.enExtra = Object.keys(en).filter((k) => !rows.some((r) => r.key === k)).length;
  out.viExtra = Object.keys(vi).filter((k) => !rows.some((r) => r.key === k)).length;
}

console.log(JSON.stringify(out));
QA_KIT_5
  cat > "$KIT/types-web/types.bad10.tsx" <<'QA_KIT_6'
// Throwaway type cases of the QA checks (TOKI-131): the one line here must be a type error (a wrong claim).
import { type UndoActionId } from "../patterns/actions";
type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const ok = <T extends true>(_?: T) => {};
ok<Eq<UndoActionId, "pinMessage" | "deleteOwnMessage">>();
QA_KIT_6
  cat > "$KIT/types-web/types.bad11.tsx" <<'QA_KIT_7'
// Throwaway type cases of the QA checks (TOKI-131): both calls must be type errors (the two helpers, the wrong id).
import { ConfirmAction } from "../patterns/ConfirmAction";
import { useUndo } from "../patterns/useUndo";

export function Bad() {
  const { run } = useUndo();
  void run({ action: "deleteOwnMessage", text: "x", perform() {}, undo() {} });
  return <ConfirmAction action="pinMessage" open title="t" target="x" confirmLabel="c" onConfirm={() => {}} onCancel={() => {}} />;
}
QA_KIT_7
  cat > "$KIT/types-web/types.good.tsx" <<'QA_KIT_8'
// Throwaway type cases of the QA checks (TOKI-131): every line here must compile.
import { ConfirmAction } from "../patterns/ConfirmAction";
import { type ActionId, type ConfirmActionId, type UndoActionId } from "../patterns/actions";
import { useUndo } from "../patterns/useUndo";

type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const ok = <T extends true>(_?: T) => {};
type Undo5 = "leavePublicChannel" | "pinMessage" | "unpinMessage" | "markActivityDone" | "removeFromLater";
type Confirm12 =
  | "deleteOwnMessage" | "deleteMemberMessage" | "leavePrivateChannel" | "archiveChannel" | "removeFromChannel"
  | "deactivateMember" | "reactivateMember" | "changeRole" | "revokeInvitation" | "signOutDevice"
  | "signOutOtherDevices" | "notifyChannel";
ok<Eq<UndoActionId, Undo5>>();
ok<Eq<ConfirmActionId, Confirm12>>();
ok<Eq<ActionId, Undo5 | Confirm12 | "deleteUnsentMessage">>();

export function Good() {
  const { run } = useUndo();
  void run({ action: "pinMessage", text: "x", perform() {}, undo() {} });
  return <ConfirmAction action="deleteOwnMessage" open title="t" target="x" confirmLabel="c" onConfirm={() => {}} onCancel={() => {}} />;
}
QA_KIT_8
  cat > "$KIT/types-ui/types.badcancel.tsx" <<'QA_KIT_9'
// Throwaway type case of the QA checks (TOKI-131): onCancel is left out, which must be a type error.
import { ConfirmDialog } from "../components/ConfirmDialog";
export const Bad = () => <ConfirmDialog open title="t" target="x" confirmLabel="c" cancelLabel="d" onConfirm={() => {}} />;
QA_KIT_9
  cat > "$KIT/types-ui/types.badconfirm.tsx" <<'QA_KIT_10'
// Throwaway type case of the QA checks (TOKI-131): onConfirm is left out, which must be a type error.
import { ConfirmDialog } from "../components/ConfirmDialog";
export const Bad = () => <ConfirmDialog open title="t" target="x" confirmLabel="c" cancelLabel="d" onCancel={() => {}} />;
QA_KIT_10
  cat > "$KIT/types-ui/types.badtarget.tsx" <<'QA_KIT_11'
// Throwaway type case of the QA checks (TOKI-131): target is left out, which must be a type error.
import { ConfirmDialog } from "../components/ConfirmDialog";
export const Bad = () => <ConfirmDialog open title="t" confirmLabel="c" cancelLabel="d" onConfirm={() => {}} onCancel={() => {}} />;
QA_KIT_11
  cat > "$KIT/types-ui/types.good.tsx" <<'QA_KIT_12'
// Throwaway type cases of the QA checks (TOKI-131): this line must compile.
import { ConfirmDialog } from "../components/ConfirmDialog";
export const Good = () => (
  <ConfirmDialog open title="t" target="x" confirmLabel="c" cancelLabel="d" onConfirm={() => {}} onCancel={() => {}} />
);
QA_KIT_12
}

# ---- runners of the throwaway sources: they are written inside the temporary worktree only ---------------------------
KIT="$BASE/kit"
QA_DIR="$BASE/out"; mkdir -p "$QA_DIR"
UI_DONE=""; WEB_DONE=""; TY_DONE=""; BR_DONE=""; DATA_DONE=""

# run_ui: the throwaway test of the ConfirmDialog (jsdom, Vitest of @toki/ui-web); it records counts in $QA_DIR/ui.json
run_ui() {
  [ -n "$UI_DONE" ] && return; UI_DONE=1
  write_kit; reset_wt
  mkdir -p "$WT/$UI/src/__qa__"; cp "$KIT/qa.ui.test.tsx" "$WT/$UI/src/__qa__/"
  pnin "$UI" QA_DIR="$QA_DIR" -- exec vitest run src/__qa__ >"$BASE/ui.log" 2>&1
  reset_wt
}
# run_web: the three throwaway tests of the helpers (Vitest of @toki/web)
run_web() {
  [ -n "$WEB_DONE" ] && return; WEB_DONE=1
  write_kit; reset_wt
  mkdir -p "$WT/apps/web/src/__qa__"; cp "$KIT"/qa.web.test.tsx "$KIT"/qa.guard.test.tsx "$KIT"/qa.guardignore.test.tsx "$WT/apps/web/src/__qa__/"
  pnin apps/web QA_DIR="$QA_DIR" -- exec vitest run src/__qa__ >"$BASE/web.log" 2>&1
  reset_wt
}
# run_types: type cases that must compile and type cases that must be errors (one tsc run for each package)
run_types() {
  [ -n "$TY_DONE" ] && return; TY_DONE=1
  write_kit; reset_wt
  mkdir -p "$WT/apps/web/src/__qa__" "$WT/$UI/src/__qa__"
  cp "$KIT"/types-web/* "$WT/apps/web/src/__qa__/"; cp "$KIT"/types-ui/* "$WT/$UI/src/__qa__/"
  pnin apps/web -- exec tsc --noEmit >"$BASE/tsc-web.log" 2>&1
  pnin "$UI" -- exec tsc --noEmit >"$BASE/tsc-ui.log" 2>&1
  reset_wt
}
# tscerr <log> <file>: how many errors tsc reported in that file
tscerr() { local n; n=$(grep -cE "^src/__qa__/$2\([0-9]+,[0-9]+\): error TS" "$1"); echo "${n:-0}"; }
# run_data: the Node script that compares the tables of the spec with the code (nothing of the repository is changed)
run_data() {
  [ -n "$DATA_DONE" ] && return; DATA_DONE=1
  write_kit
  doc "$SPEC" > "$KIT/spec.md"
  doc "$PAT/actions.ts" > "$KIT/actions.ts"
  doc "$CD/ConfirmDialog.css" > "$KIT/c.css"
  doc packages/i18n/src/messages/en/common.ts > "$KIT/en.ts"
  doc packages/i18n/src/messages/vi/common.ts > "$KIT/vi.ts"
  ( cd "$KIT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node --experimental-strip-types qa-data.mjs actions spec.md actions.ts "$KIT" 2>/dev/null ) > "$QA_DIR/actions.json"
  ( cd "$KIT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node --experimental-strip-types qa-data.mjs css spec.md c.css 2>/dev/null ) > "$QA_DIR/css.json"
  ( cd "$KIT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node --experimental-strip-types qa-data.mjs i18n spec.md en.ts vi.ts "$KIT" 2>/dev/null ) > "$QA_DIR/i18n.json"
}

# ---- the browser rows: the Vite dev server of apps/web on a free port, then Playwright Chromium ----------------------
run_browser() {
  [ -n "$BR_DONE" ] && return; BR_DONE=1
  write_kit; reset_wt
  cp "$KIT/qa-browser.mjs" "$WT/qa-browser.mjs"
  local port pid i up=0 css="$WT/$CD/ConfirmDialog.css"
  port=$(freeport)
  ( cd "$WT/apps/web" && exec env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec vite --host 127.0.0.1 --port "$port" --strictPort >"$BASE/vite.log" 2>&1 ) &
  pid=$!; PIDS="$PIDS $pid"
  for i in $(seq 1 60); do
    [ "$(nodebin -e 'fetch(process.argv[1]).then(r=>console.log(r.status)).catch(()=>console.log(0))' "http://127.0.0.1:$port/preview.html")" = 200 ] && { up=1; break; }
    sleep 0.5
  done
  if [ "$up" = 1 ]; then
    ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node qa-browser.mjs "$port" real 2>"$BASE/br1.err" ) > "$QA_DIR/br_real.json"
    ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node qa-browser.mjs "$port" unbroken 2>"$BASE/br2.err" ) > "$QA_DIR/br_unb.json"
    # paired: the rule that wraps a name with no break opportunity is taken out of the CSS, then put back
    perl -0pi -e 's/\n  overflow-wrap: anywhere;//' "$css"
    ( cd "$WT" && env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" node qa-browser.mjs "$port" unbroken 2>"$BASE/br3.err" ) > "$QA_DIR/br_mut.json"
    ( cd "$WT" && git checkout -q -- "$CD/ConfirmDialog.css" )
  else
    : > "$QA_DIR/br_real.json"; : > "$QA_DIR/br_unb.json"; : > "$QA_DIR/br_mut.json"
  fi
  kill_tree "$pid"; PIDS=""
  reset_wt
}
# brrow <ID> <expression over r (real), u (unbroken, real css), m (unbroken, css without the rule)>
brrow() {
  local id="$1"
  [ -s "$QA_DIR/br_real.json" ] && [ -s "$QA_DIR/br_unb.json" ] && [ -s "$QA_DIR/br_mut.json" ] || { echo "$id (Blocked) the browser or the Vite server of the temporary worktree could not start"; return; }
  nodebin -e 'const fs=require("fs"),d=process.env.QA_DIR;const r=JSON.parse(fs.readFileSync(d+"/br_real.json","utf8")),u=JSON.parse(fs.readFileSync(d+"/br_unb.json","utf8")),m=JSON.parse(fs.readFileSync(d+"/br_mut.json","utf8"));if(r.error||u.error||m.error){console.log(process.argv[1]+" (Blocked) the browser stopped: "+(r.error||u.error||m.error));process.exit(0)}const out=eval(process.argv[2]);console.log(process.argv[1]+" "+out.join(" "))' "$id" "$2" 2>/dev/null || echo "$id (Blocked) the browser result could not be read"
}
export QA_DIR

# ---- the rows ---------------------------------------------------------------------------------------------------------
# R1 ---------------------------------------------------------------------------------------------------------------------
t1() { local n=0 f; for f in ConfirmDialog.tsx ConfirmDialog.css ConfirmDialog.test.tsx ConfirmDialog.examples.tsx index.ts; do exists "$CD/$f" && n=$((n + 1)); done; echo "T1 $n"; }
t2() {
  local ia ir ea er idx ex lastidx=0 lastex=0 other
  read -r ia ir _ < <(git diff --numstat "$V^1" "$V" -- "$UI/src/components/index.ts")
  read -r ea er _ < <(git diff --numstat "$V^1" "$V" -- "$UI/src/examples.ts")
  local imp ent
  imp=$(git diff "$V^1" "$V" -- "$UI/src/examples.ts" | grep -cE '^\+import .*ConfirmDialog')
  ent=$(git diff "$V^1" "$V" -- "$UI/src/examples.ts" | grep -cE '^\+  \{ component: "ConfirmDialog"')
  idx=$(doc "$UI/src/components/index.ts" | tail -1)
  [ "$idx" = 'export * from "./ConfirmDialog";' ] && lastidx=1
  ex=$(doc "$UI/src/examples.ts" | grep -n 'component: "ConfirmDialog"' | cut -d: -f1)
  [ -n "$ex" ] && [ "$(doc "$UI/src/examples.ts" | sed -n "$((ex + 1))p")" = "];" ] && lastex=1
  other=$(git diff --name-status "$V^1" "$V" -- "$UI/src" | awk '$1=="M"{print $2}' | grep -v '\.test\.' | grep -v "$UI/src/components/index.ts" | grep -vc "$UI/src/examples.ts")
  echo "T2 ${ia:-0} ${ir:-0} $imp $ent ${er:-0} $((lastidx + lastex)) ${other:-0}"
}
t3() {
  need T3 || return; run_ui
  local r1 r2 r3 ty
  ty=$(cnt "$(doc "$CD/index.ts")" 'ConfirmDialogProps')
  jrow "$QA_DIR/ui.json" T3 e1 e2 e3 | sed "s/\$/ $ty/"
}
t4() {
  local s=0 t=0 f
  for f in actions.ts online.ts useOnlineGate.ts useUndo.ts ConfirmAction.tsx useFormGuard.tsx formContent.ts index.ts; do
    exists "$PAT/$f" && s=$((s + 1))
    { exists "$PAT/${f%.*}.test.ts" || exists "$PAT/${f%.*}.test.tsx"; } && t=$((t + 1))
  done
  echo "T4 $s $t"
}
t5() {
  need T5 || return; run_web
  local idx ty; idx=$(doc "$PAT/index.ts")
  ty=$(cnt "$idx" '^  (ActionId|ActionPattern|ConfirmActionId|UndoActionId),$')
  jrow "$QA_DIR/web.json" T5 pi | sed "s/\$/ $ty/"
}
t6() {
  local refs key rem
  refs=$(doc apps/web/src/preview/references.ts)
  key=$(cnt "$refs" '^  ConfirmDialog:')
  rem=$(git diff --numstat "$V^1" "$V" -- apps/web/src/preview/references.ts | awk '{print $2}')
  echo "T6 $key ${rem:-0}"
}

# R2 ---------------------------------------------------------------------------------------------------------------------
t7() {
  local cfg c1 f txt n=0 out=0 r
  cfg=$(doc apps/web/vitest.config.ts); c1=$(cnt "$cfg" 'environment:[[:space:]]*"jsdom"')
  for f in $(files apps/web/src | grep -E '\.test\.tsx$'); do
    txt=$(doc "$f")
    [ "$(cnt "$txt" '@testing-library/react')" -ge 1 ] || continue
    n=$((n + 1))
    [ "$c1" -ge 1 ] || [ "$(cnt "$txt" '@vitest-environment jsdom')" -ge 1 ] || out=$((out + 1))
  done
  echo "T7 $c1 $n $out"
}
setup_scan() { local t="$1"; echo "$(cnt "$t" 'import "@testing-library/jest-dom/vitest"') $(cnt "$t" '^afterEach\(') $(cnt "$t" '^\s+cleanup\(\);') $(cnt "$t" 'IS_REACT_ACT_ENVIRONMENT\s*=\s*true')"; }
t8() {
  local s cfg a b c d wired cl mcl ma mb mc md
  s=$(doc apps/web/src/test/setup.ts); cfg=$(doc apps/web/vitest.config.ts)
  read -r a b c d <<<"$(setup_scan "$s")"
  wired=$(cnt "$cfg" 'setupFiles:.*src/test/setup\.ts')
  read -r ma mb mc md <<<"$(setup_scan "$(printf '%s\n' "$s" | grep -v 'cleanup();')")"
  cl=0; [ "$b" -ge 1 ] && [ "$c" -ge 1 ] && cl=1
  mcl=0; [ "$mb" -ge 1 ] && [ "$mc" -ge 1 ] && mcl=1
  echo "T8 $a $cl $d $wired $mcl"
}
t9() {
  local a b
  a=$(doc apps/web/package.json); b=$(doc packages/ui-web/package.json)
  A="$a" B="$b" nodebin -e 'const a=JSON.parse(process.env.A).devDependencies,b=JSON.parse(process.env.B).devDependencies;const n=["@testing-library/react","@testing-library/dom","@testing-library/user-event","@testing-library/jest-dom","jsdom"];console.log("T9",n.filter(k=>a[k]).length,n.filter(k=>a[k]&&a[k]===b[k]).length)'
}
t10() {
  need T10 || return; reset_wt
  local d g n
  d=$(git diff --numstat "$V^1" "$V" -- vitest.config.ts | wc -l | tr -d ' ')
  g=$(cnt "$(doc vitest.config.ts)" '"apps/\*"')
  pnenv -- exec vitest run --project @toki/web >"$BASE/t10.log" 2>&1
  n=$(grep -E '^ +Test Files' "$BASE/t10.log" | sed -E 's/.* ([0-9]+) passed.*/\1/')
  echo "T10 $d $g ${n:-0}"
}
t11() {
  need T11 || return; reset_wt
  pnenv -- --filter @toki/web test >"$BASE/t11.log" 2>&1; local rc=$? f t fl
  f=$(grep -E '^ +Test Files' "$BASE/t11.log" | sed -E 's/.* ([0-9]+) passed.*/\1/'); t=$(grep -E '^ +Tests ' "$BASE/t11.log" | sed -E 's/.* ([0-9]+) passed.*/\1/')
  fl=$(grep -E '^ +Test Files' "$BASE/t11.log" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+'); fl=${fl:-0}
  echo "T11 $rc ${f:-0} ${t:-0} $fl"
}
t12() {
  need T12 || return; reset_wt
  pnenv -- test >"$BASE/t12.log" 2>&1; local rc=$? f fl db
  f=$(grep -E '^ +Test Files' "$BASE/t12.log" | sed -E 's/.* ([0-9]+) passed.*/\1/')
  fl=$(grep -E '^ +Test Files' "$BASE/t12.log" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+'); fl=${fl:-0}
  db=$(grep -c 'TEST_DATABASE_URL is not set' "$BASE/t12.log")
  if [ "$rc" = 0 ]; then echo "T12 0 ${f:-0} $fl"
  elif [ "${db:-0}" -ge 1 ]; then echo "T12 (Blocked) pnpm test exits $rc: $fl server database test files cannot start because no PostgreSQL test database is set (TEST_DATABASE_URL), and the QA spec R5 lists no PostgreSQL; ${f:-0} other test files passed"
  else echo "T12 $rc ${f:-0} $fl"; fi
}
# a command that must exit 0, paired with the same command after a file that breaks it was added
paired_cmd() { # paired_cmd <ID> <bad file name> <bad file text> <pnpm args...>
  local id="$1" name="$2" text="$3"; shift 3
  need "$id" || return; reset_wt
  pnenv -- "$@" >"$BASE/$id.log" 2>&1; local rc=$?
  mkdir -p "$WT/apps/web/src/__qa__"; printf '%s\n' "$text" > "$WT/apps/web/src/__qa__/$name"
  pnenv -- "$@" >"$BASE/$id.bad.log" 2>&1; local bad=$?
  reset_wt
  echo "$id $rc $([ "$bad" != 0 ] && echo 1 || echo 0)"
}
t13() { paired_cmd T13 bad.ts 'export const n: number = "x";' typecheck; }
t14() { paired_cmd T14 bad.ts $'export const unused = 1;\nvar x = 2;\ndebugger;' lint; }
t15() {
  need T15 || return; reset_wt
  local def; def=$(A="$(doc package.json)" nodebin -e 'console.log(JSON.parse(process.env.A).scripts["lint:boundaries"]?1:0)')
  pnenv -- lint:boundaries >"$BASE/t15.log" 2>&1
  echo "T15 $? $def"
}
t16() { paired_cmd T16 bad.ts 'export const   a   =   1' format:check; }
I18N_RC=""
i18n_pair() {
  [ -n "$I18N_RC" ] && return
  need T17 || { I18N_RC="blocked"; return; }
  reset_wt
  pnenv -- i18n:check >"$BASE/i18n.log" 2>&1; I18N_RC=$?
  perl -0pi -e 's/\n  undo: "Hoàn tác",//' "$WT/packages/i18n/src/messages/vi/common.ts"
  pnenv -- i18n:check >"$BASE/i18n.bad.log" 2>&1; I18N_BAD=$?
  reset_wt
}
t17() { i18n_pair; [ "$I18N_RC" = blocked ] && return; echo "T17 $I18N_RC"; }

# R3 ---------------------------------------------------------------------------------------------------------------------
t18() {
  local f t n=0 hit=0 m=0 base pkg
  for f in $(files "$CD" | grep -E '\.(ts|tsx)$' | grep -vE '\.(test|examples)\.'); do
    t=$(doc "$f"); n=$((n + 1)); hit=$((hit + $(cnt "$t" "from [\"']@toki/(i18n|platform|tokens)")))
  done
  base=$(doc "$CD/ConfirmDialog.tsx")
  for pkg in i18n platform tokens; do
    [ "$(cnt "$base"$'\n'"import { x } from \"@toki/$pkg/y\";" "from [\"']@toki/(i18n|platform|tokens)")" -ge 1 ] && m=$((m + 1))
  done
  echo "T18 $n $hit $m"
}
t19() { need T19 || return; run_ui; jrow "$QA_DIR/ui.json" T19 t19a t19b; }
t20() {
  local css d lit mut
  css=$(doc "$CD/ConfirmDialog.css"); d=$(printf '%s\n' "$css" | grep -o ';' | wc -l | tr -d ' ')
  local re='#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|oklab\(|color-mix\(|:[[:space:]]*(white|black|red|green|blue|gray|grey|orange|yellow|purple)\b'
  lit=$(cnt "$css" "$re"); mut=$(cnt "$css"$'\n'"  color: #fff;" "$re")
  echo "T20 $d $lit $mut"
}
t21() {
  local css names vars unk mu mk
  css=$(doc "$CD/ConfirmDialog.css")
  names=$(doc "$TSPEC" | grep -E '^- R10\.' | grep -oE '`--[a-z0-9-]+`' | tr -d '`' | sort -u)
  # unknown <text>: how many var() uses name a property that is not one of the 32
  unk() { local u=0 v; for v in $(printf '%s\n' "$1" | grep -oE 'var\(--[a-zA-Z0-9-]+' | sed 's/var(//'); do printf '%s\n' "$names" | grep -qx -- "$v" || u=$((u + 1)); done; echo "$u"; }
  vars=$(printf '%s\n' "$css" | grep -oE 'var\(--[a-zA-Z0-9-]+' | wc -l | tr -d ' ')
  mu=$(unk "$css"$'\n'"  color: var(--nope);"); mk=$(unk "$css"$'\n'"  color: var(--bg);")
  echo "T21 $(printf '%s\n' "$names" | wc -l | tr -d ' ') $vars $(unk "$css") $mu $mk"
}
t22() {
  local css re hit mut
  css=$(doc "$CD/ConfirmDialog.css"); re='data-(eff|look|accent|density)'
  hit=$(cnt "$css" "$re"); mut=$(cnt "$css"$'\n'"[data-look=\"x\"] .cfm { margin: 0; }" "$re")
  echo "T22 4 $hit $mut"
}

# R4 to R7: the throwaway test of the dialog ----------------------------------------------------------------------------
t23() { need T23 || return; run_ui; jrow "$QA_DIR/ui.json" T23 m_modals m_panels m_role m_title m_buttons; }
t24() {
  need T24 || return; run_ui
  local src own mut
  src=$(doc "$CD/ConfirmDialog.tsx")
  own=$(cnt "$src" 'className="(mbd|mft)|class(Name)?=.*\b(mbd|mft)\b')
  mut=$(cnt "$src"$'\n''<div className="mbd">x</div>' 'className="(mbd|mft)|class(Name)?=.*\b(mbd|mft)\b')
  jrow "$QA_DIR/ui.json" T24 m_mbd m_mft m_sibling m_infoot | sed "s/\$/ $own $mut/"
}
t25() { need T25 || return; run_ui; jrow "$QA_DIR/ui.json" T25 d_ptr d_id d_attr_none; }
t26() { need T26 || return; run_ui; jrow "$QA_DIR/ui.json" T26 c_order c_strong c_target_only c_only; }
t27() { need T27 || return; run_ui; jrow "$QA_DIR/ui.json" T27 s_two s_two_text s_nl s_b; }
t28() { need T28 || return; run_ui; jrow "$QA_DIR/ui.json" T28 b_order b_btn b_danger b_cancelplain b_primary; }
t29() { need T29 || return; run_ui; jrow "$QA_DIR/ui.json" T29 n_open; }
t30() {
  need T30 || return; run_types
  echo "T30 $(tscerr "$BASE/tsc-ui.log" types.good.tsx) $(tscerr "$BASE/tsc-ui.log" types.badconfirm.tsx) $(tscerr "$BASE/tsc-ui.log" types.badcancel.tsx)"
}
t31() {
  need T31 || return; run_types
  echo "T31 $(tscerr "$BASE/tsc-ui.log" types.good.tsx) $(tscerr "$BASE/tsc-ui.log" types.badtarget.tsx)"
}
t32() { need T32 || return; run_ui; jrow "$QA_DIR/ui.json" T32 g1 g1b; }
t33() { need T33 || return; run_ui; jrow "$QA_DIR/ui.json" T33 g2n g2s; }
t34() { need T34 || return; run_ui; jrow "$QA_DIR/ui.json" T34 g3n; }
t35() { need T35 || return; run_ui; jrow "$QA_DIR/ui.json" T35 g4thrown g4msg g4valid_throw; }
t36() { need T36 || return; run_ui; jrow "$QA_DIR/ui.json" T36 g5none g5err g5threw; }
t37() { need T37 || return; run_ui; jrow "$QA_DIR/ui.json" T37 f1 f1_confirm; }
t38() { need T38 || return; run_ui; jrow "$QA_DIR/ui.json" T38 r_can r_esc r_out; }
t39() { need T39 || return; run_ui; jrow "$QA_DIR/ui.json" T39 r_confirm_after r_confirm_once r_confirm_cancels; }
t40() { need T40 || return; run_ui; jrow "$QA_DIR/ui.json" T40 y_dis y_aria y_free_dis y_free_aria; }
t41() { need T41 || return; run_ui; jrow "$QA_DIR/ui.json" T41 y_cancel y_free_cancel; }
t42() { need T42 || return; run_ui; jrow "$QA_DIR/ui.json" T42 y_focus_before y_focus_panel; }
t43() { need T43 || return; run_ui; jrow "$QA_DIR/ui.json" T43 y_free_confirm y_confirm; }

# R8 ---------------------------------------------------------------------------------------------------------------------
t44() { need T44 || return; run_data; jrow "$QA_DIR/css.json" T44 rules table matched extra mutExtra mutDecl; }
t45() {
  local css re
  css=$(doc "$CD/ConfirmDialog.css"); re=':hover|@media[[:space:]]*\(hover'
  echo "T45 $(cnt "$css" "$re") $(cnt "$css"$'\n'".cfm:hover { margin: 0; }" "$re")"
}
t46() {
  need T46 || return; run_browser
  brrow T46 'const n=(k,f)=>["calm","focus"].map(l=>r[`${k}_${l}_buttons`]).flat().filter(f).length;[n("w360",h=>h>=40),n("w719",h=>h>=40),n("w720",h=>h>=40),n("w1280",h=>h>=40)]'
}
t47() {
  need T47 || return; run_browser
  brrow T47 'const ks=[];for(const w of ["w360","w1280"])for(const l of ["calm","focus"])ks.push(`${w}_${l}`);const s=(f)=>ks.map(k=>r[`${k}_${f}`]).reduce((a,b)=>a+b,0);[ks.length,s("fits"),s("panelOverflow"),s("pageOverflow")]'
}

# R9 ---------------------------------------------------------------------------------------------------------------------
t49() { need T49 || return; run_ui; jrow "$QA_DIR/ui.json" T49 x_ids x_count x_unique x_last; }
t50() { need T50 || return; run_ui; jrow "$QA_DIR/ui.json" T50 x_opened x_closed_cancel x_closed_escape x_closed_outside x_closed_confirm; }
t51() { need T51 || return; run_ui; jrow "$QA_DIR/ui.json" T51 x_focus_back; }
t52() {
  need T52 || return; run_ui
  local proto
  proto=$(cnt "$(doc "$SPEC")" 'Delete this message\?'); [ "$proto" -ge 1 ] && proto=1
  jrow "$QA_DIR/ui.json" T52 x_dm_danger x_dm_title x_ac_danger x_ac_names x_nc_primary x_busy x_lt_len | sed "s/\$/ $proto/"
}
t53() {
  need T53 || return; reset_wt
  pnin "$UI" -- exec vitest run src/examples.test.tsx >"$BASE/t53.log" 2>&1; local rc=$? f t
  f=$(grep -E '^ +Test Files' "$BASE/t53.log" | sed -E 's/.* ([0-9]+) passed.*/\1/'); t=$(grep -E '^ +Tests ' "$BASE/t53.log" | sed -E 's/.* ([0-9]+) passed.*/\1/')
  run_ui
  local v b; v=$(jrow "$QA_DIR/ui.json" X x_variants_cov e4 | cut -d' ' -f2-); b=$(jrow "$QA_DIR/ui.json" X x_busy_cov | cut -d' ' -f2)
  echo "T53 $rc ${f:-0} ${t:-0} $v $b"
}
t54() {
  local refs v
  refs=$(doc apps/web/src/preview/references.ts)
  v=$(printf '%s\n' "$refs" | grep -A1 -E '^  ConfirmDialog:' | tr '\n' ' ' | sed -E 's/^ *ConfirmDialog: *//; s/^"//; s/",? *$//')
  echo "T54 $([ "$v" = 'none: the prototype draws an inline row (lines 1369 and 1452), no dialog' ] && echo 1 || echo 0) $(cnt "$v" '^none:')"
}
t55() {
  need T55 || return; run_browser
  brrow T55 'const ks=[];for(const w of ["w360","w1280"])for(const l of ["calm","focus"])ks.push(r[`lt_${w}_${l}`]);[ks[0].len,ks.filter(x=>x.lines>=2).length,ks.filter(x=>x.targetOverflow||x.panelOverflow||x.pageOverflow).length,[u.unbroken_w360,u.unbroken_w1280].filter(x=>x.targetOverflow).length,[m.unbroken_w360,m.unbroken_w1280].filter(x=>x.targetOverflow).length]'
}

t48() { echo "T48 (Blocked) manual: the look of the dialog at 360 px in Calm and in Focus is judged by eye (run SERVE for the two addresses); Blocked until the QA pastes the result"; }

# R10, R11 ---------------------------------------------------------------------------------------------------------------
t56() { need T56 || return; run_data; jrow "$QA_DIR/actions.json" T56 specRows rows ids patterns sources owners mutPattern; }
t57() { need T57 || return; run_data; jrow "$QA_DIR/actions.json" T57 rows ownerFmt patternValid sourceFilled mutOwnerFmt; }
t58() { need T58 || return; run_types; echo "T58 $(tscerr "$BASE/tsc-web.log" types.good.tsx) $(tscerr "$BASE/tsc-web.log" types.bad10.tsx)"; }
t59() {
  local t n=0 id
  t=$(doc "$PAT/actions.test.ts")
  for id in $(doc "$SPEC" | grep -oE '^\| `[a-zA-Z]+` \| [^|]+\| (undo|confirm|none) \|' | sed -E 's/^\| `([a-zA-Z]+)`.*/\1/'); do
    [ "$(cnt "$t" "\"$id\"")" -ge 1 ] && n=$((n + 1))
  done
  echo "T59 $n $([ "$(cnt "$t" 'toEqual|toStrictEqual')" -ge 1 ] && echo 1 || echo 0)"
}
t60() { need T60 || return; run_data; jrow "$QA_DIR/actions.json" T60 undo confirm none keyLines uniqueKeys mutDup; }
t61() {
  need T61 || return; run_types
  echo "T61 $(tscerr "$BASE/tsc-web.log" types.good.tsx) $(tscerr "$BASE/tsc-web.log" types.bad11.tsx) $(cnt "$(doc "$PAT/useUndo.test.tsx")" '@ts-expect-error') $(cnt "$(doc "$PAT/ConfirmAction.test.tsx")" '@ts-expect-error')"
}
t62() { need T62 || return; run_web; jrow "$QA_DIR/web.json" T62 w1_sync w1_id w1_pat w1_perform w1_toast w1_valid; }
t63() { need T63 || return; run_web; jrow "$QA_DIR/web.json" T63 w2_throw w2_id w2_pat w2_valid_throw; }
t64() {
  local f n=0 hit=0 t mut re
  re='import[^;]*\bConfirmDialog\b[^;]*from "@toki/ui-web"'
  for f in $(files apps/web/src | grep -E '\.(ts|tsx)$' | grep -vE '/patterns/|\.test\.|/test/'); do
    t=$(doc "$f" | tr '\n' ' '); n=$((n + 1)); [ "$(cnt "$t" "$re")" -ge 1 ] && hit=$((hit + 1))
  done
  mut=$(cnt "$(printf '%s' 'import { Button, ConfirmDialog } from "@toki/ui-web"; export const x = 1;')" "$re")
  echo "T64 $n $hit $mut"
}

# R12 to R16 -------------------------------------------------------------------------------------------------------------
t65() { need T65 || return; run_web; jrow "$QA_DIR/web.json" T65 u1_out u1_perform u1_text u1_undo u1_before u2_sync u2_toast_before_timer u3_before u3_after; }
t66() { need T66 || return; run_web; jrow "$QA_DIR/web.json" T66 u4_out u4_toast u4_undo u4_text u4_rej; }
t67() { need T67 || return; run_web; jrow "$QA_DIR/web.json" T67 u5_out u5_perform u5_undo u5_text u5_msg u5_throw_done; }
t68() { need T68 || return; run_web; jrow "$QA_DIR/web.json" T68 o1_undo o1_msg o1_blocked_text o1_btn; }
t69() { need T69 || return; run_web; jrow "$QA_DIR/web.json" T69 o2_calls o2_before_reject o2_awaited; }
t70() { need T70 || return; run_web; jrow "$QA_DIR/web.json" T70 o3_toast o3_btn; }
t71() { need T71 || return; run_web; jrow "$QA_DIR/web.json" T71 o4_calls o4_toasts; }
t72() {
  local s re
  s=$(doc "$PAT/useUndo.ts"); re='\b(setTimeout|setInterval|requestAnimationFrame)\b'
  echo "T72 3 $(cnt "$s" "$re") $(cnt "$s"$'\n'"setTimeout(() => {}, 10);" "$re")"
}
t73() { need T73 || return; run_web; jrow "$QA_DIR/web.json" T73 k1_at4999 k1_at5000 k1_undo_after k1_early_press; }
t74() { need T74 || return; run_web; jrow "$QA_DIR/web.json" T74 q1_first q1_second; }
t75() { need T75 || return; run_web; jrow "$QA_DIR/web.json" T75 q2_keys q2_nokey q2_s_at_4999_both q2_s1_at5000 q2_s2_at5000 q2_s2_at7000; }
t76() { need T76 || return; run_web; jrow "$QA_DIR/web.json" T76 q3_limit q3_size q3_recent q3_old q3_done q3_after_expiry; }
t77() { need T77 || return; run_web; jrow "$QA_DIR/web.json" T77 i_renders i_same; }
t78() { need T78 || return; run_web; jrow "$QA_DIR/web.json" T78 i_toast_after_unmount i_undo_after_unmount; }
t79() {
  local s re
  s=$(doc "$PAT/useUndo.ts"); re='[Pp]ause|[Ff]ocus|useStatus|useDnd'
  echo "T79 $(cnt "$s" "$re") $(cnt "$s"$'\n'"const paused = usePause();" "$re")"
}

# R17, R18 ---------------------------------------------------------------------------------------------------------------
t80() { need T80 || return; run_web; jrow "$QA_DIR/web.json" T80 c_true c_false c_throw c_null; }
t81() { need T81 || return; run_web; jrow "$QA_DIR/web.json" T81 d_offline d_online d_nonav d_restore; }
t82() { need T82 || return; run_web; jrow "$QA_DIR/web.json" T82 g_action_blocked g_action_undotext g_undo_undotext g_undo_blocked g_online g_action_buttons; }
t83() { need T83 || return; run_web; jrow "$QA_DIR/web.json" T83 g_at2799 g_at2800; }
t84() {
  local s lets hooks mut
  s=$(doc "$PAT/online.ts")
  lets=$(cnt "$s" '^(let|var) '); hooks=$(cnt "$s" 'useState|useRef|localStorage|sessionStorage|indexedDB')
  mut=$(cnt "$s"$'\n'"let other = 0;" '^(let|var) ')
  echo "T84 $lets $hooks $mut"
}
t85() { need T85 || return; run_web; jrow "$QA_DIR/web.json" T85 a_cancel_label a_online_confirm; }
t86() { need T86 || return; run_web; jrow "$QA_DIR/web.json" T86 a_offline_confirm a_open a_toast; }
t87() { need T87 || return; run_web; jrow "$QA_DIR/web.json" T87 b_disabled b_aria b_return; }
t88() { need T88 || return; run_web; jrow "$QA_DIR/web.json" T88 z_ids z_shown; }

# R19 to R23 -------------------------------------------------------------------------------------------------------------
t89() { need T89 || return; run_web; jrow "$QA_DIR/web.json" T89 h_true_n h_true; }
t90() { need T90 || return; run_web; jrow "$QA_DIR/web.json" T90 h_false_n h_false h_empty; }
t91() { need T91 || return; run_web; jrow "$QA_DIR/web.json" T91 h_no_throw_false h_thrown; }
t92() { need T92 || return; run_web; jrow "$QA_DIR/guard.json" T92 s_keys s_wanted s_functions s_element; }
t93() { need T93 || return; run_web; jrow "$QA_DIR/guard.json" T93 s_len rc_empty rc_content_asks rc_content_close; }
t94() { need T94 || return; run_web; jrow "$QA_DIR/guard.json" T94 n_reason n_noquestion; }
t95() { need T95 || return; run_web; jrow "$QA_DIR/guard.json" T95 o_onclose o_question o_open o_text o_focus; }
t96() { need T96 || return; run_web; jrow "$QA_DIR/guard.json" T96 c_close_q c_close_onclose c_cancelform_q; }
t97() { need T97 || return; run_web; jrow "$QA_DIR/guard.json" T97 c_value_ask c_esc_q c_esc_onclose; }
t98() {
  need T98 || return; run_web
  local ty; ty=$(cnt "$(doc "$PAT/guardEscape.ts")" 'GuardEscape = "ask" \| "ignore"')
  jrow "$QA_DIR/gi.json" T98 i_onclose i_question i_form i_close_asks | sed "s/\$/ $ty/"
}
t99() { need T99 || return; run_web; jrow "$QA_DIR/guard.json" T99 x_title x_desc x_target x_keep x_confirm x_danger; }
t100() { need T100 || return; run_web; jrow "$QA_DIR/guard.json" T100 k_asked k_closed k_noclose k_open_text k_focus; }
t101() { need T101 || return; run_web; jrow "$QA_DIR/guard.json" T101 b_body b_return; }
t102() { need T102 || return; run_web; jrow "$QA_DIR/guard.json" T102 d_closed d_once d_form_closed; }
t103() { need T103 || return; run_web; jrow "$QA_DIR/guard.json" T103 e_asked e_q_after e_form e_onclose; }
t104() { need T104 || return; run_web; jrow "$QA_DIR/guard.json" T104 u_asked u_children u_inert u_ariahidden u_overflow u_listeners u_children_open u_listeners_open; }
t105() {
  local s re
  s=$(doc "$PAT/useFormGuard.tsx"); re='\b(setTimeout|setInterval|requestAnimationFrame|localStorage|sessionStorage|indexedDB|FormData)\b|\.value\b|\.elements\b'
  echo "T105 9 $(cnt "$s" "$re") $(cnt "$s"$'\n'"setTimeout(() => {}, 1);" "$re")"
}

# R24 --------------------------------------------------------------------------------------------------------------------
t106() { need T106 || return; run_data; local t; t=$(cnt "$(doc packages/i18n/src/common.test.ts)" 'common\.'); [ "$t" -ge 1 ] && t=1; jrow "$QA_DIR/i18n.json" T106 table enKeys enMatch enExtra | sed "s/\$/ $t/"; }
t107() { need T107 || return; run_data; jrow "$QA_DIR/i18n.json" T107 table viKeys viMatch viExtra; }
t108() {
  local en vi
  en=$(doc packages/i18n/src/messages/en/index.ts); vi=$(doc packages/i18n/src/messages/vi/index.ts)
  echo "T108 $(cnt "$en" 'import \{ common \} from "\./common"') $(cnt "$en" 'export const en[^=]*= \{.*\bcommon\b') $(cnt "$vi" 'import \{ common \} from "\./common"') $(cnt "$vi" 'export const vi[^=]*= \{.*\bcommon\b')"
}
t109() { i18n_pair; [ "$I18N_RC" = blocked ] && return; echo "T109 $I18N_RC $([ "$I18N_BAD" != 0 ] && echo 1 || echo 0)"; }

# ---- main ----------------------------------------------------------------------------------------------------------------
SEL=("$@")
if [ "${SEL[0]:-}" = SERVE ]; then
  need SERVE || exit 0
  port=$(freeport)
  ( cd "$WT/apps/web" && exec env -i PATH="$NODEPATH" HOME="$HOME" TMPDIR="$BASE" corepack pnpm exec vite --host 127.0.0.1 --port "$port" --strictPort >"$BASE/vite.log" 2>&1 ) &
  PIDS="$PIDS $!"
  sleep 4
  echo "Calm : http://127.0.0.1:$port/preview.html?look=calm"
  echo "Focus: http://127.0.0.1:$port/preview.html?look=focus"
  echo "Open the entry ConfirmDialog, press the first button of each example, set the window to 360 px wide. Press Enter here to stop."
  read -r _
  exit 0
fi
want() { [ "${#SEL[@]}" -eq 0 ] && return 0; local s; for s in "${SEL[@]}"; do [ "$s" = "$1" ] && return 0; done; return 1; }
for n in $(seq 1 109); do
  want "T$n" || continue
  declare -F "t$n" >/dev/null && "t$n"
done
