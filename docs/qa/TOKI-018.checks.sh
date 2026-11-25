#!/usr/bin/env bash
# Checks behind the rows of docs/qa/TOKI-018.md. No model. Network: the package registry through
# `pnpm install --frozen-lockfile`; connections to a Vite server and a PostgreSQL on 127.0.0.1. It writes
# nothing to GitHub, opens no pull request and calls no `gh`.
# Usage (from the repository root): V=<commit> bash docs/qa/TOKI-018.checks.sh [T1 T2 ...]
# It reads files of the commit V with `git show`. A row that runs a tool uses ONE temporary worktree of V,
# created on first use under one folder (BASE, made in the current shell, exported as TMPDIR and given to
# every process it starts through `env -i`), installed with `pnpm install --frozen-lockfile` under Node 22.
# The made-up files, probes and the page that the rows need are written inside that worktree or in BASE only.
# A row that changes a file of the worktree restores it with `git checkout` and is paired with a run that
# must pass. The browser rows drive the Chromium that Playwright has cached (the Playwright of V) against the
# dev server of apps/web in the worktree on a free loopback port; the page they open is made up and loads the
# web implementation of the package from that server; the browser profiles are folders of BASE. Row T73
# (`pnpm test`) starts a temporary PostgreSQL cluster made with `initdb` (user qa, trust authentication, a
# free loopback port), removed at the end; the development database and the Docker services are not touched.
# Everything the script started (worktree, folder, processes) is removed when it ends, even when a row fails.
# The repository itself is not changed. No `.env` file is read or created. It prints one line for each row:
# counts, exit codes and words; no value of a secret and no tool output. A row that loops prints how many
# items it checked. A row that cannot be shown prints "(Blocked)" and the reason; the manual row prints
# "(Blocked)" until the QA pastes a result. The last line, `CLEAN ...`, says that no worktree made by the
# script is left (other worktrees of the repository may come and go while it runs), that `git status` is as
# it was, how many processes it started are still alive and that the temporary folder is removed.
# Node 22 comes from PATH or from ~/.nvm/versions/node/v22*; pnpm runs through corepack.
set -uo pipefail
V="${V:-HEAD}"
doc() { git show "$V:$1" 2>/dev/null; }
exists() { git cat-file -e "$V:$1" 2>/dev/null; }
files() { git ls-tree -r --name-only "$V" -- "$@" 2>/dev/null; }

BASE=$(mktemp -d); export TMPDIR="$BASE"
before_status=$(git status --porcelain | shasum | cut -d' ' -f1)
WT=""; WTREAL=""; PIDS=""; PGBIN=""; PGPORT=""; PGDATA=""
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" >/dev/null 2>&1; wait "$1" 2>/dev/null; }
cleanup() {
  local p
  for p in $PIDS; do kill_tree "$p"; done
  PIDS=""
  [ -n "$PGPORT" ] && "$PGBIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1
  PGPORT=""
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
    WT="$BASE/wt0/wt"; WTREAL=$(cd "$WT" && pwd -P)
  fi
  if [ -z "$INSTALL_RC" ]; then pnenv -- install --frozen-lockfile >/dev/null 2>&1; INSTALL_RC=$?; fi
  [ "$INSTALL_RC" = 0 ]
}
need() { ensure && return 0; echo "$1 needs Node 22 and an installed worktree of $V (Blocked)"; return 1; }
reset_wt() { ( cd "$WT" && git checkout -q -- . && git clean -fdq ); }
freeport() { nodebin -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
portbusy() { nodebin -e 'const s=require("net").connect(Number(process.argv[1]),"127.0.0.1");s.on("connect",()=>{console.log("busy");process.exit(0)});s.on("error",()=>{console.log("free");process.exit(0)})' "$1" 2>/dev/null; }
firstline() { head -1 | tr -d '\r' | cut -c1-160; }
bool() { if [ "$1" = true ] || [ "$1" = 1 ]; then echo 1; else echo 0; fi; }

# ---- the throwaway sources ---------------------------------------------------------------------------------
KIT="$BASE/kit"
write_kit() {
  [ -d "$KIT" ] && return 0
  mkdir -p "$KIT"
  cat > "$KIT/ts.mjs" <<'TSMJS'
// Throwaway type checks of the QA of TOKI-018 (run at the root of the temporary worktree). Prints one JSON object.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const web = path.join(root, "apps/web");
const cfg = ts.readConfigFile(path.join(web, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, web);
const out = {};

function program(files) {
  return ts.createProgram({ rootNames: files, options: { ...parsed.options, noEmit: true, skipLibCheck: true, types: [] } });
}
function errors(p, file) {
  return ts.getPreEmitDiagnostics(p, p.getSourceFile(file)).filter((d) => d.category === ts.DiagnosticCategory.Error).length;
}

// the made-up files, written next to main.tsx of apps/web
const src = path.join(web, "src");
const mk = (name, text) => {
  const f = path.join(src, name);
  fs.writeFileSync(f, text);
  return f;
};
const fExports = mk(
  "zz-qa-exports.ts",
  `import { getPlatform, setPlatform } from "@toki/platform";
import type { NotificationPermissionState, PickedFile, Platform, SoundName, StorageArea } from "@toki/platform";
export const f: [typeof getPlatform, typeof setPlatform] = [getPlatform, setPlatform];
export type T = [NotificationPermissionState, PickedFile, Platform, SoundName, StorageArea];
`,
);
const fAssign = mk(
  "zz-qa-assign.ts",
  `import type { Platform } from "@toki/platform";
import { createWebPlatform } from "@toki/platform/web";
export const a: Platform = createWebPlatform();
export const b: Platform = createWebPlatform({ sounds: { notification: "/x.wav" } });
export const c: Platform = createWebPlatform({});
`,
);
const fAssignBad = mk(
  "zz-qa-assign-bad.ts",
  `import type { Platform } from "@toki/platform";
import { createWebPlatform } from "@toki/platform/web";
export const a: Platform & { tabs: unknown } = createWebPlatform();
export const b: Platform = { ...createWebPlatform(), sound: 1 };
export const c: Platform = createWebPlatform({ sounds: { notification: 1 } });
`,
);
const fExportsBad = mk(
  "zz-qa-exports-bad.ts",
  `import { getPlatform, createPlatform } from "@toki/platform";
import type { Platform, NoSuchType } from "@toki/platform";
export const f = [getPlatform, createPlatform];
export type T = [Platform, NoSuchType];
`,
);

const p = program([fExports, fAssign, fAssignBad, fExportsBad]);
const checker = p.getTypeChecker();

// the exports of the package entry, by name and kind
const entry = p.getSourceFile(path.join(root, "packages/platform/src/index.ts"));
const mod = checker.getSymbolAtLocation(entry);
const exps = checker.getExportsOfModule(mod).map((s) => {
  const r = s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s;
  const value = !!(r.flags & ts.SymbolFlags.Value);
  const type = !!(r.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface));
  return { name: s.name, value, type };
});
out.exportNames = exps.map((e) => e.name).sort();
out.typeNames = exps.filter((e) => e.type && !e.value).map((e) => e.name).sort();
out.valueNames = exps.filter((e) => e.value).map((e) => e.name).sort();

// the members of Platform and the methods of each member
const platformSym = checker.getExportsOfModule(mod).find((s) => s.name === "Platform");
const platformType = checker.getDeclaredTypeOfSymbol(checker.getAliasedSymbol(platformSym));
const members = {};
for (const m of checker.getPropertiesOfType(platformType)) {
  const t = checker.getTypeOfSymbolAtLocation(m, entry);
  members[m.name] = checker.getPropertiesOfType(t).map((x) => {
    const xt = checker.getTypeOfSymbolAtLocation(x, entry);
    return x.name + (xt.getCallSignatures().length ? "()" : "");
  }).sort();
}
out.members = members;
out.errExports = errors(p, fExports);
out.errAssign = errors(p, fAssign);
out.errAssignBad = errors(p, fAssignBad);
out.errExportsBad = errors(p, fExportsBad);

// the members of StorageArea, the exports of the web entry and the files that the interface entry loads
const areaSym = checker.getExportsOfModule(mod).find((s) => s.name === "StorageArea");
const areaType = checker.getDeclaredTypeOfSymbol(checker.getAliasedSymbol(areaSym));
out.area = checker.getPropertiesOfType(areaType).map((x) => x.name).sort();
const webEntry = p.getSourceFile(path.join(root, "packages/platform/src/web/index.ts"));
out.webValues = checker
  .getExportsOfModule(checker.getSymbolAtLocation(webEntry))
  .filter((s) => s.flags & ts.SymbolFlags.Value)
  .map((s) => s.name)
  .sort();
const only = program([path.join(root, "packages/platform/src/index.ts")]);
out.loaded = only
  .getSourceFiles()
  .map((f) => path.relative(root, f.fileName))
  .filter((f) => f.startsWith("packages/platform/src/"))
  .sort();

for (const f of [fExports, fAssign, fAssignBad, fExportsBad]) fs.rmSync(f);
console.log(JSON.stringify(out));
TSMJS
  cat > "$KIT/pw.mjs" <<'PWMJS'
// Throwaway Chromium checks of the QA of TOKI-018 (run at the root of the temporary worktree). Prints one JSON object.
// The page is a made-up one that the checks serve at the origin of the dev server of apps/web; it loads the web
// implementation of the package from that server (the dev app of the worktree). Values are fictitious.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ORIGIN = process.env.QA_URL;
const ROOT = process.env.QA_ROOT;
const TMP = process.env.QA_TMP;
const WAV = fs.readFileSync(process.env.QA_WAV);
const PLWEB = `/@fs${ROOT}/packages/platform/src/web/index.ts`;
const PLIDX = `/@fs${ROOT}/packages/platform/src/index.ts`;
const R = {};
// a watchdog: whatever the sections have seen is printed, and every browser process of this run goes with it
setTimeout(() => {
  (R.crash ??= []).push("the browser run took too long");
  process.stdout.write(JSON.stringify(R) + "\n", () => process.exit(0));
}, 300000).unref();
const sec = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    (R.crash ??= []).push(`${name}: ${String(e.message).split("\n")[0].slice(0, 90)}`);
  }
};
const closers = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HTML = `<!doctype html><title>qa</title><button id="btn">press</button><script type="module">
const m = await import(${JSON.stringify(PLWEB)});
window.__m = m;
const auto = new URLSearchParams(location.search).get("auto");
if (auto === "sound") window.__auto = m.createWebPlatform({ sounds: { notification: "/qa-sound.wav" } }).sound.play("notification");
if (auto === "pick") { window.__pl = m.createWebPlatform(); window.__auto = window.__pl.files.pick(); }
window.__ready = true;
console.log("qa-ready");
</script>`;

// counters that every page has from the start: the checks read them
const INIT = () => {
  const c = (window.__c = { perm: 0, audio: 0, play: 0, set: 0, ended: 0, els: [] });
  if (typeof Notification !== "undefined") {
    const o = Notification.requestPermission;
    Notification.requestPermission = function (...a) {
      c.perm++;
      return o.apply(this, a);
    };
  }
  const A = window.Audio;
  window.Audio = function (...a) {
    c.audio++;
    const e = new A(...a);
    e.addEventListener("ended", () => c.ended++);
    c.els.push(e);
    return e;
  };
  const P = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    c.play++;
    return P.apply(this, a);
  };
  try {
    const S = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...a) {
      c.set++;
      return S.apply(this, a);
    };
  } catch {}
};

const browser = await chromium.launch({
  channel: "chromium",
  args: ["--autoplay-policy=document-user-activation-required"],
});
R.version = browser.version().split(".")[0];

async function ctxOf(b, opts = {}) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(INIT);
  return ctx;
}
const reqs = new WeakMap();
async function open(ctx, auto, route = {}) {
  const p = await ctx.newPage();
  const seen = [];
  reqs.set(p, seen);
  p.__fc = 0;
  p.on("filechooser", () => p.__fc++);
  p.on("request", (r) => {
    if (/qa-(sound|missing)/.test(r.url())) seen.push(new URL(r.url()).pathname);
  });
  await p.route("**/qa.html*", (r) => r.fulfill({ contentType: "text/html", body: HTML }));
  await p.route("**/qa-sound.wav", (r) => r.fulfill({ contentType: "audio/wav", body: WAV }));
  await p.route("**/qa-missing.wav", (r) => r.fulfill({ status: 404, body: "no" }));
  const ready = new Promise((res) => p.on("console", (m) => m.text() === "qa-ready" && res(true)));
  await p.goto(`${ORIGIN}/qa.html${auto ? `?auto=${auto}` : ""}`);
  if (!(await Promise.race([ready, sleep(15000).then(() => false)]))) throw new Error("the page did not become ready");
  return p;
}
const seenOf = (p) => reqs.get(p);

// ---- the app: the call before the mount (R26) ----------------------------------------------------------------
await sec("app", async () => {
  const ctx = await ctxOf(browser);
  const p = await ctx.newPage();
  await p.goto(`${ORIGIN}/`);
  await p.waitForFunction(() => document.getElementById("root")?.childElementCount > 0, null, { timeout: 20000 });
  const urls = await p.evaluate(() => performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname));
  R.app = await p.evaluate(
    async (idx) => {
      const m = await import(idx);
      let ok = 0;
      let keys = 0;
      try {
        const pl = m.getPlatform();
        ok = 1;
        keys = Object.keys(pl).length;
      } catch {}
      return { mounted: document.getElementById("root").childElementCount > 0 ? 1 : 0, set: ok, keys };
    },
    PLIDX,
  );
  R.app.loaded = urls.includes(PLIDX) && urls.includes(PLWEB) ? 1 : 0;
  await ctx.close();
});

// ---- R5: createWebPlatform() has no visible effect ----------------------------------------------------------
await sec("r5", async () => {
  const ctx = await ctxOf(browser);
  const p = await open(ctx);
  await p.evaluate(() => {
    window.__mut = 0;
    new MutationObserver((r) => (window.__mut += r.length)).observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
    window.__count0 = document.getElementsByTagName("*").length;
    window.__c.perm = window.__c.audio = window.__c.set = window.__c.play = 0;
  });
  const before = seenOf(p).length;
  await p.evaluate(() => {
    window.__pl = window.__m.createWebPlatform({ sounds: { notification: "/qa-sound.wav" } });
  });
  await sleep(400);
  R.r5 = await p.evaluate(() => ({
    perm: window.__c.perm,
    set: window.__c.set,
    audio: window.__c.audio,
    local: localStorage.length,
    session: sessionStorage.length,
    mutations: window.__mut,
    elements: document.getElementsByTagName("*").length - window.__count0,
  }));
  R.r5.audioRequests = seenOf(p).length - before;
  // the same observers see a real effect (so zero above is not blindness)
  await p.evaluate(async () => {
    window.__pl.storage.device.set("r5.k", "v");
    await window.__pl.notifications.requestPermission();
    document.body.append(document.createElement("i"));
    document.getElementById("btn").onclick = () => window.__pl.sound.play("notification");
  });
  await p.click("#btn");
  await sleep(300);
  R.r5.proof = await p.evaluate(() => [window.__c.perm, window.__c.set, window.__c.audio, window.__mut > 0 ? 1 : 0, localStorage.length]);
  R.r5.proofReq = seenOf(p).length - before;
  await ctx.close();
});

// ---- storage: R6 to R9 ----------------------------------------------------------------------------------------
await sec("storage", async () => {
  const dir = path.join(TMP, "profile");
  const opts = { channel: "chromium", headless: true, args: [] };
  let pc = await chromium.launchPersistentContext(dir, opts);
  closers.push(() => pc.close());
  await pc.addInitScript(INIT);
  let p1 = await open(pc);
  R.st = await p1.evaluate(() => {
    const P = window.__m.createWebPlatform();
    const o = {};
    for (const [name, store, other] of [
      ["device", localStorage, sessionStorage],
      ["tab", sessionStorage, localStorage],
    ]) {
      const a = P.storage[name];
      const r = {};
      r.methods = ["get", "set", "remove", "clear"].filter((m) => typeof a[m] === "function").length;
      r.setTrue = a.set("sign-in.step", "two") === true ? 1 : 0;
      r.getBack = a.get("sign-in.step") === "two" ? 1 : 0;
      r.neverSet = a.get("never.set") === null ? 1 : 0;
      r.rawKey = store.getItem("toki:sign-in.step") === "two" ? 1 : 0;
      r.bareKey = store.getItem("sign-in.step") === null ? 0 : 1;
      r.otherArea = other.getItem("toki:sign-in.step") === null ? 0 : 1;
      a.remove("sign-in.step");
      r.removed = a.get("sign-in.step") === null && store.getItem("toki:sign-in.step") === null ? 1 : 0;
      a.set("a.one", "1");
      a.set("a.two", "2");
      a.set("a.three", "3");
      for (const k of ["other", "toki", "tokix:z"]) store.setItem(k, "x");
      r.prefBefore = Object.keys(store).filter((k) => k.startsWith("toki:")).length;
      a.clear();
      r.prefAfter = Object.keys(store).filter((k) => k.startsWith("toki:")).length;
      r.foreignKept = ["other", "toki", "tokix:z"].filter((k) => store.getItem(k) !== null).length;
      for (const k of ["other", "toki", "tokix:z"]) store.removeItem(k);
      o[name] = r;
    }
    // the values of the persistence checks
    P.storage.device.set("persist.k", "d1");
    P.storage.tab.set("persist.k", "t1");
    return o;
  });
  const q = (page) =>
    page.evaluate(() => {
      const s = window.__m.createWebPlatform().storage;
      return [s.device.get("persist.k"), s.tab.get("persist.k")];
    });
  const second = await p1.evaluate(() => {
    const s = window.__m.createWebPlatform().storage;
    return [s.device.get("persist.k"), s.tab.get("persist.k")];
  });
  const p2 = await open(pc);
  const other = await q(p2);
  const rd = new Promise((res) => p1.on("console", (m) => m.text() === "qa-ready" && res(true)));
  await p1.reload();
  await rd;
  const reloaded = await q(p1);
  R.r7 = { second: second[0] === "d1" ? 1 : 0, otherTab: other[0] === "d1" ? 1 : 0, tabOther: other[1] === null ? 1 : 0, deviceReload: reloaded[0] === "d1" ? 1 : 0, tabReload: reloaded[1] === "t1" ? 1 : 0 };
  await pc.close();
  pc = await chromium.launchPersistentContext(dir, opts);
  await pc.addInitScript(INIT);
  p1 = await open(pc);
  R.r7.restart = (await q(p1))[0] === "d1" ? 1 : 0;
  // R9: a real quota
  R.quota = await p1.evaluate(() => {
    const P = window.__m.createWebPlatform();
    const o = {};
    for (const [name, store] of [
      ["device", localStorage],
      ["tab", sessionStorage],
    ]) {
      const a = P.storage[name];
      store.clear();
      const chunk = "x".repeat(1024 * 1024);
      let hit = 0;
      try {
        for (let i = 0; i < 60; i++) store.setItem("fill" + i, chunk);
      } catch (e) {
        hit = e.name === "QuotaExceededError" ? 1 : 0;
      }
      const r = { hit };
      r.setFalse = a.set("big.key", "y".repeat(2 * 1024 * 1024)) === false ? 1 : 0;
      r.getNull = a.get("big.key") === null ? 1 : 0;
      let threw = 0;
      try { a.remove("big.key"); } catch { threw++; }
      try { a.clear(); } catch { threw++; }
      r.noThrow = threw === 0 ? 1 : 0;
      for (const k of Object.keys(store)) if (k.startsWith("fill")) store.removeItem(k);
      r.afterFree = a.set("big.key", "small") === true && a.get("big.key") === "small" ? 1 : 0;
      a.clear();
      o[name] = r;
    }
    return o;
  });
  await pc.close();
  // R9: storage the browser refuses to read (site data blocked: reading the storage object throws)
  const dir2 = path.join(TMP, "profile-blocked");
  fs.mkdirSync(path.join(dir2, "Default"), { recursive: true });
  fs.writeFileSync(path.join(dir2, "Default", "Preferences"), JSON.stringify({ profile: { default_content_setting_values: { cookies: 2 } } }));
  const bc = await chromium.launchPersistentContext(dir2, opts);
  closers.push(() => bc.close());
  await bc.addInitScript(INIT);
  const bp = await open(bc);
  R.blocked = await bp.evaluate(() => {
    const o = { refusesRead: 0 };
    try { localStorage.length; } catch (e) { o.refusesRead = e.name === "SecurityError" ? 1 : 0; }
    const P = window.__m.createWebPlatform();
    for (const name of ["device", "tab"]) {
      const a = P.storage[name];
      const r = {};
      try { r.get = a.get("k") === null ? 1 : 0; } catch { r.get = 0; }
      try { r.set = a.set("k", "v") === false ? 1 : 0; } catch { r.set = 0; }
      try { a.remove("k"); r.remove = 1; } catch { r.remove = 0; }
      try { a.clear(); r.clear = 1; } catch { r.clear = 0; }
      o[name] = r;
    }
    return o;
  });
  await bc.close();
});

// ---- notifications: R10 to R12 ---------------------------------------------------------------------------------
await sec("notifications", async () => {
  const ctx = await ctxOf(browser);
  const p = await open(ctx);
  const first = await p.evaluate(() => [window.__m.createWebPlatform().notifications.permission(), Notification.permission]);
  // every other method, then the count of prompts
  await p.evaluate(() => {
    const P = window.__m.createWebPlatform({ sounds: { notification: "/qa-sound.wav" } });
    P.notifications.permission();
    for (const a of [P.storage.device, P.storage.tab]) { a.set("n.k", "v"); a.get("n.k"); a.remove("n.k"); a.clear(); }
    P.files.pick();
    P.files.pick();
    P.sound.play("notification");
    window.__pl = P;
  });
  const askedBefore = await p.evaluate(() => window.__c.perm);
  const answer = await p.evaluate(async () => [await window.__pl.notifications.requestPermission(), Notification.permission, window.__c.perm]);
  const afterDenied = await p.evaluate(() => [window.__pl.notifications.permission(), Notification.permission]);
  const g = await ctxOf(browser);
  await g.grantPermissions(["notifications"], { origin: ORIGIN });
  const pg = await open(g);
  const granted = await pg.evaluate(async () => {
    const n = window.__m.createWebPlatform().notifications;
    return [n.permission(), Notification.permission, await n.requestPermission(), Notification.permission];
  });
  const u = await ctxOf(browser);
  await u.addInitScript(() => { delete window.Notification; });
  const pu = await open(u);
  const unsupported = await pu.evaluate(async () => {
    const n = window.__m.createWebPlatform().notifications;
    return [typeof Notification, n.permission(), await n.requestPermission()];
  });
  const fakes = await p.evaluate(async () => {
    const n = window.__m.createWebPlatform().notifications;
    const out = {};
    window.Notification = { permission: "denied", requestPermission() { throw new Error("made up"); } };
    try { out.thrown = await n.requestPermission(); } catch { out.thrown = "REJECTED"; }
    window.Notification = { permission: "granted", requestPermission() { return Promise.reject(new Error("made up")); } };
    try { out.rejected = await n.requestPermission(); } catch { out.rejected = "REJECTED"; }
    window.Notification = { permission: "default", requestPermission() { return Promise.resolve(undefined); } };
    try { out.empty = await n.requestPermission(); } catch { out.empty = "REJECTED"; }
    return out;
  });
  R.nt = { first, askedBefore, answer, afterDenied, granted, unsupported, fakes };
  await ctx.close(); await g.close(); await u.close();
});

// ---- files: R13 to R17 -----------------------------------------------------------------------------------------
await sec("files", async () => {
  const fd = path.join(TMP, "files");
  fs.mkdirSync(fd, { recursive: true });
  const mkf = (n, size) => { const f = path.join(fd, n); fs.writeFileSync(f, Buffer.alloc(size, 97)); return f; };
  const fPdf = mkf("c.pdf", 2048), fTxt = mkf("a.txt", 5), fPng = mkf("b.png", 100);
  const big = path.join(fd, "big.bin");
  fs.closeSync(fs.openSync(big, "w"));
  fs.truncateSync(big, 200 * 1024 * 1024);
  const smalls = Array.from({ length: 12 }, (_, i) => mkf(`m${String(i + 1).padStart(2, "0")}.txt`, 10));
  const ctx = await ctxOf(browser);
  const setup = (p, opts) =>
    p.evaluate((o) => {
      window.__pl = window.__m.createWebPlatform();
      window.__pend = [];
      window.__opts = o;
      document.getElementById("btn").onclick = () => window.__pend.push(window.__pl.files.pick(window.__opts));
    }, opts);
  const press = async (p) => {
    const [fc] = await Promise.all([p.waitForEvent("filechooser", { timeout: 4000 }), p.click("#btn")]);
    return fc;
  };
  const inputs = (p) => p.evaluate(() => document.querySelectorAll("input[type=file]").length);
  const resultOf = (p, i) =>
    p.evaluate(async (i) => {
      const v = await Promise.race([window.__pend[i], new Promise((r) => setTimeout(() => r("PENDING"), 3000))]);
      if (v === "PENDING") return "PENDING";
      return v.map((f) => ({ name: f.name, size: f.size, mime: f.mimeType, keys: Object.keys(f).join(","), file: f.handle instanceof File ? 1 : 0, handleName: f.handle.name }));
    }, i);
  const o = {};

  let p = await open(ctx);
  await setup(p, { multiple: true, accept: ["image/*", ".pdf"] });
  let fc = await press(p);
  o.opened = 1;
  o.multi = [fc.isMultiple() ? 1 : 0, await p.evaluate(() => document.querySelector("input[type=file]").getAttribute("accept"))];
  o.during = await inputs(p);
  await fc.setFiles([fPdf, fTxt, fPng]);
  o.res = await resultOf(p, 0);
  o.after = await inputs(p);

  p = await open(ctx);
  await setup(p, undefined);
  fc = await press(p);
  o.single = [fc.isMultiple() ? 1 : 0, await p.evaluate(() => document.querySelector("input[type=file]").getAttribute("accept"))];
  let two = "accepted";
  try { await fc.setFiles([fTxt, fPng]); } catch { two = "refused"; }
  o.twoOnSingle = two;
  await fc.setFiles([fTxt]);
  o.singleRes = await resultOf(p, 0);

  p = await open(ctx);
  await setup(p, {});
  fc = await press(p);
  o.emptyOpts = [fc.isMultiple() ? 1 : 0, await p.evaluate(() => document.querySelector("input[type=file]").getAttribute("accept"))];
  await p.evaluate(() => document.querySelector("input[type=file]").dispatchEvent(new Event("cancel")));
  o.cancel = await resultOf(p, 0);
  o.cancelInputs = await inputs(p);

  p = await open(ctx);
  await setup(p, undefined);
  const fc1 = await press(p);
  o.firstInputs = await inputs(p);
  const fc2 = await press(p);
  o.firstResolved = await resultOf(p, 0);
  o.secondInputs = await inputs(p);
  await fc2.setFiles([fTxt]);
  o.secondRes = await resultOf(p, 1);
  o.secondAfter = await inputs(p);
  void fc1;

  // a call that is not made from a press (page script at load, no user activation)
  p = await open(ctx, "pick");
  await sleep(1200);
  o.unpressed = await p.evaluate(async () => {
    const v = await Promise.race([window.__auto, new Promise((r) => setTimeout(() => r("PENDING"), 600))]);
    return [v === "PENDING" ? "PENDING" : "RESOLVED", document.querySelectorAll("input[type=file]").length];
  });
  o.unpressedChooser = p.__fc;
  await p.evaluate(() => { window.__pend = []; document.getElementById("btn").onclick = () => window.__pend.push(window.__pl.files.pick()); });
  const fcLater = await press(p);
  void fcLater;
  await sleep(300);
  o.unpressedLater = await p.evaluate(async () => {
    const v = await Promise.race([window.__auto, new Promise((r) => setTimeout(() => r("PENDING"), 2000))]);
    return v === "PENDING" ? "PENDING" : v.length;
  });

  // a click that throws
  p = await open(ctx);
  await setup(p, undefined);
  o.clickThrows = await p.evaluate(async () => {
    HTMLInputElement.prototype.click = () => { throw new Error("made up"); };
    try { const v = await window.__pl.files.pick(); return v.length; } catch { return "REJECTED"; }
  });

  // no limit: a 200 MB file and thirteen files
  p = await open(ctx);
  await setup(p, { multiple: true });
  fc = await press(p);
  await fc.setFiles([big, ...smalls]);
  const lim = await resultOf(p, 0);
  o.limit = lim === "PENDING" ? "PENDING" : { count: lim.length, big: lim.find((f) => f.name === "big.bin")?.size ?? 0 };
  o.limitAfter = await inputs(p);
  R.fl = o;
  await ctx.close();
});

// ---- sound: R18 to R20 -----------------------------------------------------------------------------------------
await sec("sound", async () => {
  const ctx = await ctxOf(browser);
  const o = {};
  // no interaction: a page script at load
  let p = await open(ctx, "sound");
  o.blocked = await p.evaluate(() => window.__auto);
  o.blockedPlays = await p.evaluate(() => window.__c.play);
  const setup = (p, sounds) =>
    p.evaluate((s) => {
      window.__pl = window.__m.createWebPlatform(s ? { sounds: s } : undefined);
      document.getElementById("btn").onclick = () => (window.__r = window.__pl.sound.play(window.__name || "notification"));
    }, sounds);

  p = await open(ctx);
  await setup(p, { notification: "/qa-sound.wav" });
  const before = await p.evaluate(() => {
    const P = window.__pl;
    P.notifications.permission();
    P.storage.device.get("x");
    return window.__c.audio;
  });
  o.beforeAudio = before;
  o.beforeReq = seenOf(p).length;
  await p.click("#btn");
  o.pressed = await p.evaluate(() => window.__r);
  await sleep(200);
  o.afterReq = seenOf(p).slice();
  o.pressedCounts = await p.evaluate(() => ({ audio: window.__c.audio, play: window.__c.play, loop: window.__c.els[0].loop ? 1 : 0, src: new URL(window.__c.els[0].src).pathname }));
  await sleep(2600);
  o.ended = await p.evaluate(() => [window.__c.ended, window.__c.play]);

  p = await open(ctx);
  await setup(p, { notification: "/qa-sound.wav" });
  await p.click("#btn");
  await p.evaluate(() => window.__r);
  await sleep(700);
  const t1 = await p.evaluate(() => window.__c.els[0].currentTime);
  await p.click("#btn");
  const r2 = await p.evaluate(async () => [await window.__r, window.__c.els[0].currentTime, window.__c.audio, window.__c.play, window.__c.els.length]);
  o.restart = { t1: t1 > 0.1 ? 1 : 0, reset: r2[1] < t1 ? 1 : 0, result: r2[0], audio: r2[2], play: r2[3] };

  p = await open(ctx);
  await setup(p, { notification: "/qa-missing.wav" });
  await p.click("#btn");
  o.missing = await p.evaluate(() => window.__r);
  o.missingReq = seenOf(p).length;

  p = await open(ctx);
  await setup(p, undefined);
  await p.click("#btn");
  o.noAddress = await p.evaluate(() => window.__r);
  o.noAddressAudio = await p.evaluate(() => window.__c.audio);

  p = await open(ctx);
  await setup(p, { notification: "/qa-sound.wav" });
  await p.evaluate(() => { window.__name = "other"; });
  await p.click("#btn");
  o.unknown = await p.evaluate(() => window.__r);
  o.unknownAudio = await p.evaluate(() => window.__c.audio);
  o.unknownReq = seenOf(p).length;
  R.sd = o;
  await ctx.close();
});

for (const c of closers) await c().catch(() => {});
await browser.close().catch(() => {});
process.stdout.write(JSON.stringify(R) + "\n", () => process.exit(0));
PWMJS
  cat > "$KIT/current.ts" <<'CURTS'
// Throwaway probe of the QA of TOKI-018 (R2, R4): a fresh Node process with no DOM imports the interface entry.
import * as P from "../../packages/platform/src/index";
const g = globalThis as Record<string, unknown>;
const out: Record<string, number> = {};
out.noDom = typeof g.window === "undefined" && typeof g.document === "undefined" ? 1 : 0;
out.imported = typeof P.getPlatform === "function" && typeof P.setPlatform === "function" ? 1 : 0;
let message = "";
try {
  P.getPlatform();
  out.threw = 0;
} catch (e) {
  out.threw = 1;
  message = String((e as Error).message);
}
out.names = message.includes("setPlatform") ? 1 : 0;
const p = { name: "p" } as never;
const q = { name: "q" } as never;
P.setPlatform(p);
out.same = P.getPlatform() === p ? 1 : 0;
out.notOther = P.getPlatform() !== q ? 1 : 0;
P.setPlatform(q);
out.replaced = P.getPlatform() === q ? 1 : 0;
out.notOld = P.getPlatform() !== p ? 1 : 0;
console.log(JSON.stringify(out));
CURTS
  cat > "$KIT/qa-platform.html" <<'QAHTML'
<!doctype html>
<meta charset="utf-8" />
<title>qa platform</title>
<h1>Platform package: by-hand checks (QA of TOKI-018)</h1>
<p>
  <button id="pick">Pick files (multiple)</button>
  <button id="pickimg">Pick images only</button>
  <button id="perm">Request permission</button>
  <button id="state">Read permission</button>
  <button id="play">Play</button>
  <button id="playt">Play in 3 s (timer)</button>
  <button id="setdev">Set device value</button>
  <button id="settab">Set tab value</button>
  <button id="read">Read values</button>
</p>
<pre id="log"></pre>
<script type="module">
  import { createWebPlatform } from "@toki/platform/web";
  const p = createWebPlatform({ sounds: { notification: "/qa-sound.wav" } });
  const $ = (id) => document.getElementById(id);
  const log = (t) => {
    $("log").textContent += t + "\n";
  };
  log("browser: " + navigator.userAgent);
  p.sound.play("notification").then((r) => log("play at load (no press): " + r));
  const show = (files) => log("pick: " + files.length + " file(s) " + files.map((f) => `${f.name} ${f.size} ${f.mimeType}`).join(", "));
  $("pick").onclick = async () => show(await p.files.pick({ multiple: true }));
  $("pickimg").onclick = async () => show(await p.files.pick({ accept: ["image/*"] }));
  $("perm").onclick = async () => log("requestPermission: " + (await p.notifications.requestPermission()));
  $("state").onclick = () => log("permission: " + p.notifications.permission());
  $("play").onclick = async () => log("play (press): " + (await p.sound.play("notification")));
  $("playt").onclick = () => setTimeout(async () => log("play (timer): " + (await p.sound.play("notification"))), 3000);
  $("setdev").onclick = () => log("device set: " + p.storage.device.set("qa.k", "device-value"));
  $("settab").onclick = () => log("tab set: " + p.storage.tab.set("qa.k", "tab-value"));
  $("read").onclick = () => log("device: " + p.storage.device.get("qa.k") + ", tab: " + p.storage.tab.get("qa.k"));
</script>
QAHTML
  python3 - "$KIT/qa-sound.wav" <<'PY'
import sys, wave
w = wave.open(sys.argv[1], "w"); w.setnchannels(1); w.setsampwidth(1); w.setframerate(8000)
w.writeframes(bytes([128]) * 8000 * 2); w.close()
PY
}

# ---- the type checks (the TypeScript compiler API over the real package) -------------------------------------
TSJ="$BASE/ts.json"; TS_DONE=""; TS_ERR=""
ts_run() {
  [ -n "$TS_DONE" ] && return 0
  TS_DONE=1
  need "$1" || { TS_ERR="no worktree"; return 1; }
  reset_wt; write_kit
  cp "$KIT/ts.mjs" "$WT/zz-qa-ts.mjs"
  nenv . -- zz-qa-ts.mjs > "$TSJ" 2> "$BASE/ts.err"
  reset_wt
  [ -s "$TSJ" ] || { TS_ERR="$(firstline < "$BASE/ts.err")"; return 1; }
  return 0
}
tsrow() { # tsrow <ID> <jq expression> ...: the values, joined by a space
  local id="$1" out="" v e; shift
  ts_run "$id" || { echo "$id the type checks could not run: ${TS_ERR:-unknown} (Blocked)"; return; }
  for e in "$@"; do v=$(jq -r "$e" "$TSJ" 2>/dev/null); if [ -z "$v" ] || [ "$v" = null ]; then echo "$id the type checks gave no value (Blocked)"; return; fi; out="$out $v"; done
  echo "$id$out"
}
CURJ="$BASE/cur.json"; CUR_DONE=""
cur_run() {
  [ -n "$CUR_DONE" ] && return 0
  CUR_DONE=1
  need "$1" || return 1
  reset_wt; write_kit
  cp "$KIT/current.ts" "$WT/apps/server/zz-qa-current.ts"
  nenv apps/server -- --import tsx zz-qa-current.ts > "$CURJ" 2> "$BASE/cur.err"
  reset_wt
  [ -s "$CURJ" ]
}
currow() {
  local id="$1" out="" v e; shift
  cur_run "$id" || { echo "$id the Node probe could not run: $(firstline < "$BASE/cur.err") (Blocked)"; return; }
  for e in "$@"; do v=$(jq -r "$e" "$CURJ" 2>/dev/null); if [ -z "$v" ] || [ "$v" = null ]; then echo "$id the Node probe gave no value (Blocked)"; return; fi; out="$out $v"; done
  echo "$id$out"
}

# ---- the browser (Playwright of V, the Chromium it has cached, the dev server of apps/web) ----------------------
PWJ="$BASE/pw.json"; PW_DONE=""; PW_ERR=""; VITE_PORT=""
web_start() { # starts the Vite server of apps/web in the worktree on a free port; sets VITE_PORT
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
  [ -d "$WT/node_modules/@playwright/test" ] || { PW_ERR="the worktree has no Playwright"; return 1; }
  reset_wt; write_kit
  web_start || { PW_ERR="the Vite server did not start: $(grep -m1 -iE 'error' "$BASE/vite.log" | firstline)"; return 1; }
  cp "$KIT/pw.mjs" "$WT/zz-qa-pw.mjs"
  nenv . QA_URL="http://127.0.0.1:$VITE_PORT" QA_ROOT="$WTREAL" QA_TMP="$BASE" QA_WAV="$KIT/qa-sound.wav" -- zz-qa-pw.mjs > "$PWJ" 2> "$BASE/pw.err"
  local p; for p in $PIDS; do kill_tree "$p"; done; PIDS=""
  reset_wt
  [ -s "$PWJ" ] || { PW_ERR="$(grep -m1 -E '[A-Za-z]' "$BASE/pw.err" | firstline)"; return 1; }
  return 0
}
brow() { # brow <ID> <jq expression> ...: the values, joined by a space
  local id="$1" out="" v e; shift
  pw_run "$id" || { echo "$id the browser rows could not run: ${PW_ERR:-unknown} (Blocked)"; return; }
  for e in "$@"; do
    v=$(jq -r "$e" "$PWJ" 2>/dev/null)
    if [ -z "$v" ] || [ "$v" = null ]; then echo "$id the browser section of this row did not finish: $(jq -r '(.crash // []) | join("; ")' "$PWJ" | cut -c1-120) (Blocked)"; return; fi
    out="$out $v"
  done
  echo "$id$out"
}

# ---- the lint runs and the lint-rule test ------------------------------------------------------------------------
BANNED=('import "@toki/platform/web";' 'import "@toki/platform/web/storage";' 'import "../../platform/src/web/index";' 'export const a = import("@toki/platform/web");' 'export const a = import(`@toki/platform/web`);')
ALLOWED='import { getPlatform } from "@toki/platform";
export const a = getPlatform;'
LINT_A=""; LINT_B=""
lint_a() { # banned imports and browser globals at made-up paths under the packages; one `pnpm lint`
  [ -n "$LINT_A" ] && return 0
  reset_wt
  local pkg i d u
  for pkg in client-core shared i18n tokens; do
    d="$WT/packages/$pkg/src"
    for i in 1 2 3 4 5; do printf '%s\n' "${BANNED[$((i - 1))]}" > "$d/zz-ban-$i.ts"; done
    printf '%s\n' "${BANNED[0]}" > "$d/zz-ban.test.ts"
  done
  d="$WT/packages/platform/src"
  printf 'export const a = localStorage;\nexport const b = window;\nimport "@toki/platform/web";\n' > "$d/zz-a.ts"
  printf 'export type A = { n: number };\nexport function f(a: A): number { return a.n; }\n' > "$d/zz-plain.ts"
  printf 'export const a = localStorage;\n' > "$d/web/zz-web.ts"
  printf 'export const a = localStorage;\n' > "$d/zz-case.test.ts"
  printf '\nexport const zzA = localStorage;\nexport const zzB = window;\nimport "@toki/platform/web";\n' >> "$d/index.ts"
  u="$WT/packages/ui-web/src"
  for i in 1 2 3 4 5; do printf '%s\n' "${BANNED[$((i - 1))]}" > "$u/zz-ui-$i.ts"; done
  printf '%s\n' "${BANNED[0]}" > "$u/zz-ui.test.ts"
  pnenv -- lint -f json -o "$BASE/lintA.json" >/dev/null 2>&1; LINT_A_RC=$?
  reset_wt
  LINT_A=1
  [ -s "$BASE/lintA.json" ]
}
lint_b() { # the allowed import in the four packages and in ui-web, on an otherwise unchanged tree
  [ -n "$LINT_B" ] && return 0
  reset_wt
  local pkg
  for pkg in client-core shared i18n tokens; do printf '%s\n' "$ALLOWED" > "$WT/packages/$pkg/src/zz-ok.ts"; done
  printf '%s\n' "$ALLOWED" > "$WT/packages/ui-web/src/zz-ui-ok.ts"
  pnenv -- lint -f json -o "$BASE/lintB.json" >/dev/null 2>&1; LINT_B_RC=$?
  reset_wt
  LINT_B=1
  [ -s "$BASE/lintB.json" ]
}
BND='(.ruleId == "@typescript-eslint/no-restricted-imports" or .ruleId == "no-restricted-syntax")'
# lq <A|B> <path regex> <message regex>: how many files match the path, and how many of those have a boundary message with that text
lq() {
  local f="$BASE/lint$1.json"
  jq -r --arg p "$2" --arg m "$3" '[.[] | select(.filePath | test($p))] as $f | [$f[] | select(any(.messages[]; '"$BND"' and (.message | test($m))))] as $r | "\($f | length) \($r | length)"' "$f"
}
# lr <ruleId> <path regex>: the messages of one rule at the matching files, and the number of files
lr() { jq -r --arg r "$1" --arg p "$2" '[.[] | select(.filePath | test($p))] | "\(length) \([.[].messages[] | select(.ruleId == $r)] | length)"' "$BASE/lint$3.json"; }
need_lint() { need "$1" || return 1; lint_a || { echo "$1 the lint run produced no result (Blocked)"; return 1; }; return 0; }

# the lint-rule test (node --test), baseline and with one change to eslint.config.js (restored afterwards)
LRB=""
lr_run() { # lr_run <tag>: sets LR_RC, LR_PASS, LR_FAIL; the failing cases are in $BASE/lr.<tag>.fail
  local tag="$1"
  nenv . -- --test --test-reporter=tap tools/lint-rules/platform-boundary.test.mjs > "$BASE/lr.$tag.tap" 2>&1; LR_RC=$?
  LR_PASS=$(grep -cE '^ *ok [0-9]+ ' "$BASE/lr.$tag.tap"); LR_FAIL=$(grep -cE '^ *not ok [0-9]+ ' "$BASE/lr.$tag.tap")
  grep -E '^ *not ok [0-9]+ ' "$BASE/lr.$tag.tap" > "$BASE/lr.$tag.fail"
}
lr_base() { [ -n "$LRB" ] && return 0; reset_wt; lr_run base; LRB="$LR_RC $LR_PASS $LR_FAIL"; }
mutate() { # mutate <perl script text>: applies it to eslint.config.js of the worktree; fails when nothing changed
  printf '%s\n' "$1" > "$BASE/mut.pl"
  reset_wt
  perl -0pi "$BASE/mut.pl" "$WT/eslint.config.js"
  ! ( cd "$WT" && git diff --quiet -- eslint.config.js )
}
M_BAN='s/const webPlatformImports = \[[^\]]*\];/const webPlatformImports = ["qa-nothing"];/;
s/source = webPlatformSource\) => \[/source = "\/^qa-nothing\$\/") => [/;'
M_UI='s/(group: )webPlatformImports(,\s*message: webPlatformMessage\("ui-web"\))/${1}["qa-nothing"]${2}/;
s/webPlatformSyntax\(webPlatformMessage\("ui-web"\)\)/webPlatformSyntax(webPlatformMessage("ui-web"), "\/^qa-nothing\$\/")/;'
M_WEBCOV='s/ignores: \[testFiles, platformWebSrc\],/ignores: [testFiles],/;'
M_NOCOV='s/files: \[`\$\{platformSrc\}\/\*\*\/\$\{sourceFiles\}`\],/files: [`\${platformSrc}\/zz\/**\/\${sourceFiles}`],/;'
# mutrow <ID> <perl script> <pattern of the case names that must fail> <pattern of the case names that must not>: base rc, mutated rc, failed, named, not named
mutrow() {
  local id="$1" named other
  need "$id" || return
  lr_base
  mutate "$2" || { reset_wt; echo "$id the change to eslint.config.js did not apply (Blocked)"; return; }
  lr_run mut
  reset_wt
  named=$(grep -cE "$3" "$BASE/lr.mut.fail"); other=$(grep -cE "$4" "$BASE/lr.mut.fail")
  echo "$id ${LRB%% *} $([ "$LR_RC" != 0 ] && echo 1 || echo 0) $LR_FAIL $named $other"
}

# ---- the temporary PostgreSQL (for `pnpm test`) -------------------------------------------------------------------
pg_ready() {
  [ -n "$PGPORT" ] && return 0
  local bin; bin=$(dirname "$(command -v initdb 2>/dev/null)")
  [ -x "$bin/initdb" ] || return 1
  PGBIN="$bin"; PGDATA="$BASE/pg"; PGPORT=$(freeport)
  "$PGBIN/initdb" -D "$PGDATA" -U qa -A trust -E UTF8 --no-locale >/dev/null 2>&1 || { PGPORT=""; return 1; }
  "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=" -l "$BASE/pg.log" -w start >/dev/null 2>&1 || { PGPORT=""; return 1; }
}
sql() { "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U qa -d "$1" -At -c "$2" 2>&1; }

# ===========================================================================================================
# R1
t1() { tsrow T1 '(.typeNames | length)' '(.valueNames | length)' '(.exportNames | length) - (.typeNames | length) - (.valueNames | length)' '.errExports' '.errExportsBad'; }
t2() { tsrow T2 '(.members | keys | length)' '(.members | keys | join(","))' '(.members | has("tabs") | if . then 1 else 0 end)'; }
t3() { tsrow T3 '(.members.notifications | length)' '(.members.files | length)' '(.members.sound | length)' '(.members.storage | length)' '(.area | length)' '(.members.notifications | map(sub("\\(\\)$"; "")) | join(","))' '(.members.files | map(sub("\\(\\)$"; "")) | join(","))' '(.members.sound | map(sub("\\(\\)$"; "")) | join(","))' '(.members.storage | map(sub("\\(\\)$"; "")) | join(","))' '(.area | join(","))'; }
# R2
t4() { currow T4 '.threw' '.names'; }
t5() { currow T5 '.same' '.replaced' '.notOld'; }
# R3
t6() { tsrow T6 '(.webValues | length)' '(.webValues | join(","))' '.errAssign' '.errAssignBad'; }
t7() { local pj; pj=$(doc packages/platform/package.json); echo "T7 $(printf '%s' "$pj" | jq -r '.exports | length') $(printf '%s' "$pj" | jq -r '[.exports | to_entries[] | .key + "=" + .value] | join(" ")')"; }
# R4
t8() { currow T8 '.noDom' '.imported'; }
t9() {
  ts_run T9 || { echo "T9 the type checks could not run: ${TS_ERR:-unknown} (Blocked)"; return; }
  local f n=0 bad=0 mut=0 list=()
  while IFS= read -r f; do list+=("$f"); done < <(jq -r '.loaded[]' "$TSJ")
  reset_wt
  pnenv -- exec eslint -f json -o "$BASE/t9.json" "${list[@]}" >/dev/null 2>&1; local rc=$?
  n=$(jq 'length' "$BASE/t9.json"); bad=$(jq '[.[].messages[]] | length' "$BASE/t9.json")
  printf '\nexport const zzW = window;\n' >> "$WT/packages/platform/src/index.ts"
  pnenv -- exec eslint -f json -o "$BASE/t9m.json" "${list[@]}" >/dev/null 2>&1
  mut=$(jq '[.[].messages[] | select(.ruleId == "toki/client-core-globals")] | length' "$BASE/t9m.json")
  reset_wt
  echo "T9 $rc $n $bad $mut"
}
# R5 to R9 (browser)
t10() { brow T10 '.r5.perm' '.r5.proof[0]'; }
t11() { brow T11 '.r5.set' '.r5.local' '.r5.session' '.r5.proof[1]' '.r5.proof[4]'; }
t12() { brow T12 '.r5.audio' '.r5.audioRequests' '.r5.proof[2]' '.r5.proofReq'; }
t13() { brow T13 '.r5.mutations' '.r5.elements' '.r5.proof[3]'; }
t14() { brow T14 '.st.device.methods' '.st.tab.methods'; }
t15() { brow T15 '.st.device.setTrue' '.st.device.getBack' '.st.tab.setTrue' '.st.tab.getBack'; }
t16() { brow T16 '.st.device.neverSet' '.st.device.removed' '.st.tab.neverSet' '.st.tab.removed'; }
# R7
t17() { brow T17 '.r7.second' '.r7.otherTab' '.r7.restart'; }
t18() { brow T18 '.r7.tabReload' '.r7.tabOther'; }
t19() { brow T19 '.st.device.rawKey' '.st.tab.rawKey' '.st.device.otherArea' '.st.tab.otherArea'; }
# R8
t20() { brow T20 '.st.device.rawKey' '.st.tab.rawKey' '.st.device.bareKey' '.st.tab.bareKey'; }
t21() { brow T21 '.st.device.prefBefore' '.st.device.prefAfter' '.st.device.foreignKept' '.st.tab.prefBefore' '.st.tab.prefAfter' '.st.tab.foreignKept'; }
# R9
t22() { brow T22 '.blocked.refusesRead' '.blocked.device.get' '.blocked.device.set' '.blocked.device.remove' '.blocked.device.clear' '.blocked.tab.get' '.blocked.tab.set' '.blocked.tab.remove' '.blocked.tab.clear'; }
t23() { brow T23 '.quota.device.hit' '.quota.device.setFalse' '.quota.device.getNull' '.quota.device.noThrow' '.quota.device.afterFree' '.quota.tab.hit' '.quota.tab.setFalse' '.quota.tab.getNull' '.quota.tab.noThrow' '.quota.tab.afterFree'; }
# R10 to R12
t24() { brow T24 '[.nt.first[0], .nt.afterDenied[0], .nt.granted[0], .nt.unsupported[1]] | map(select(. == "unsupported" or . == "default" or . == "granted" or . == "denied")) | length' '[.nt.first[0], .nt.afterDenied[0], .nt.granted[0], .nt.unsupported[1]] | unique | join(",")'; }
t25() { brow T25 '(.nt.unsupported[0] == "undefined" and .nt.unsupported[1] == "unsupported") | if . then 1 else 0 end' '[(.nt.first[0] == .nt.first[1]), (.nt.afterDenied[0] == .nt.afterDenied[1]), (.nt.granted[0] == .nt.granted[1])] | map(select(.)) | length'; }
t26() { brow T26 '[(.nt.answer[0] == .nt.answer[1]), (.nt.granted[2] == .nt.granted[3])] | map(select(.)) | length' '[.nt.answer[0], .nt.granted[2]] | join(",")'; }
t27() {
  local n
  n=$(files packages/platform/src/web | grep -vE '\.test\.ts$' | while read -r f; do doc "$f" | grep -qE 'requestPermission\(' && echo "$f"; done | wc -l | tr -d ' ')
  local line; line=$(brow T27 '.nt.askedBefore' '.nt.answer[2]')
  case "$line" in *Blocked*) echo "$line";; *) echo "$line $n";; esac
}
t28() { brow T28 '.nt.unsupported[2]'; }
t29() { brow T29 '.nt.fakes.thrown' '.nt.fakes.rejected'; }
# R13 to R17
t30() { brow T30 '.fl.opened'; }
t31() { brow T31 '(.fl.res | length)' '(if ((.fl.res | map(.name)) == ["c.pdf","a.txt","b.png"]) then 1 else 0 end)' '(if ((.fl.res | map(.keys) | unique) == ["name,size,mimeType,handle"]) then 1 else 0 end)' '(if ((.fl.res | map(.size)) == [2048,5,100]) then 1 else 0 end)' '(if ((.fl.res | map(.mime)) == ["application/pdf","text/plain","image/png"]) then 1 else 0 end)' '(if ((.fl.res | map(.file) | unique) == [1] and (.fl.res | map(.handleName)) == (.fl.res | map(.name))) then 1 else 0 end)'; }
t32() { brow T32 '.fl.multi[0]' '(.fl.res | length)'; }
t33() { brow T33 '.fl.single[0]' '.fl.twoOnSingle' '(.fl.singleRes | length)'; }
t34() { brow T34 '.fl.multi[1]'; }
t35() { brow T35 '(.fl.single[1] // "absent")' '(.fl.emptyOpts[1] // "absent")'; }
t36() { brow T36 '(.fl.cancel | length)' '.fl.cancelInputs'; }
t37() { brow T37 '(if .fl.clickThrows == 0 then "empty" else "other" end)'; }
t38() { brow T38 '.fl.firstInputs' '(.fl.firstResolved | length)' '.fl.secondInputs' '(.fl.secondRes | length)' '.fl.secondAfter'; }
t39() { brow T39 '.fl.unpressedChooser' '(.fl.unpressed[0] | ascii_downcase)' '.fl.unpressed[1]' '.fl.unpressedLater'; }
t40() { brow T40 '.fl.limit.count' '.fl.limit.big'; }
t41() { brow T41 '.fl.after' '.fl.cancelInputs' '.fl.unpressed[1]'; }
# R18 to R20
t42() { brow T42 '.sd.pressed' '.sd.pressedCounts.src' '.sd.pressedCounts.audio' '.sd.pressedCounts.play' '.sd.ended[0]' '.sd.pressedCounts.loop'; }
t43() { brow T43 '.sd.blocked' '.sd.blockedPlays'; }
t44() { brow T44 '.sd.missing' '.sd.missingReq'; }
t45() { brow T45 '.sd.noAddress' '.sd.noAddressAudio' '.sd.unknown' '.sd.unknownAudio' '.sd.unknownReq'; }
t46() { brow T46 '.sd.beforeAudio' '.sd.beforeReq' '(.sd.afterReq | length)'; }
t47() { brow T47 '.sd.restart.result' '.sd.restart.t1' '.sd.restart.reset' '.sd.restart.audio' '.sd.restart.play'; }
# R21, R22 (lint)
t48() {
  need_lint T48 || return
  local a b
  a=$(lq A '/packages/(client-core|shared|i18n|tokens)/src/zz-ban-[1-5]\.ts$' 'client-core boundary')
  b=$(lq A '/packages/(client-core|shared|i18n|tokens)/src/zz-ban\.test\.ts$' 'boundary')
  echo "T48 $([ "$LINT_A_RC" != 0 ] && echo 1 || echo 0) $a $b"
}
t49() {
  need T49 || return
  lint_b || { echo "T49 the lint run produced no result (Blocked)"; return; }
  local r; r=$(jq -r '[.[] | select(.filePath | test("/packages/(client-core|shared|i18n|tokens)/src/zz-ok\\.ts$"))] | "\(length) \([.[].messages[]] | length)"' "$BASE/lintB.json")
  echo "T49 $LINT_B_RC $r"
}
# R23
t50() {
  local pj; pj=$(doc package.json)
  local e=0 s=0 t=0
  exists tools/lint-rules/platform-boundary.test.mjs && e=1
  printf '%s' "$pj" | jq -r '.scripts["test:lint-rules"]' | grep -q 'platform-boundary.test.mjs' && s=1
  if printf '%s' "$pj" | jq -r '.scripts.test' | grep -q 'platform-boundary.test.mjs'; then t=1
  elif printf '%s' "$pj" | jq -r '.scripts.test' | grep -q 'test:lint-rules' && [ "$s" = 1 ]; then t=1; fi
  echo "T50 $e $s $t"
}
t51() {
  local pj; pj=$(doc package.json)
  echo "T51 $(printf '%s' "$pj" | jq -r '.scripts["test:lint-rules"]' | grep -c 'platform-boundary.test.mjs') $(printf '%s' "$pj" | jq -r '.scripts.test' | grep -c 'platform-boundary.test.mjs')"
}
t52() {
  need T52 || return
  reset_wt; lr_base
  pnenv -- test:lint-rules >/dev/null 2>&1; local rc=$?
  echo "T52 $rc $(echo "$LRB" | cut -d' ' -f2) $(echo "$LRB" | cut -d' ' -f3)"
}
t53() { mutrow T53 "$M_BAN" '\(R21\)' '\(R28\)'; }
# R24
t54() {
  need_lint T54 || return
  local i a plain
  i=$(lr toki/client-core-globals '/packages/platform/src/index\.ts$' A | cut -d' ' -f2); a=$(lr toki/client-core-globals '/packages/platform/src/zz-a\.ts$' A | cut -d' ' -f2)
  local ii ai
  ii=$(lr @typescript-eslint/no-restricted-imports '/packages/platform/src/index\.ts$' A | cut -d' ' -f2); ai=$(lr @typescript-eslint/no-restricted-imports '/packages/platform/src/zz-a\.ts$' A | cut -d' ' -f2)
  plain=$(jq -r '[.[] | select(.filePath | test("/packages/platform/src/zz-plain\\.ts$"))] | "\(length) \([.[].messages[] | select(.ruleId == "toki/client-core-globals" or .ruleId == "@typescript-eslint/no-restricted-imports" or .ruleId == "no-restricted-syntax")] | length)"' "$BASE/lintA.json")
  echo "T54 $i $ii $a $ai $plain"
}
t55() { need_lint T55 || return; echo "T55 $(lr toki/client-core-globals '/packages/platform/src/web/zz-web\.ts$' A)"; }
t56() { need_lint T56 || return; echo "T56 $(lr toki/client-core-globals '/packages/platform/src/zz-case\.test\.ts$' A)"; }
t57() {
  need T57 || return
  lr_base
  local a b an bn
  mutate "$M_WEBCOV" || { reset_wt; echo "T57 the change to eslint.config.js did not apply (Blocked)"; return; }
  lr_run mut; a=$LR_RC; an=$(grep -cE 'src/web is outside rule 1 \(R24\)' "$BASE/lr.mut.fail"); local af=$LR_FAIL
  mutate "$M_NOCOV" || { reset_wt; echo "T57 the second change to eslint.config.js did not apply (Blocked)"; return; }
  lr_run mut; b=$LR_RC; bn=$(grep -cE '\(R24\)' "$BASE/lr.mut.fail"); local bf=$LR_FAIL
  reset_wt
  echo "T57 ${LRB%% *} $([ "$a" != 0 ] && echo 1 || echo 0) $af $an $([ "$b" != 0 ] && echo 1 || echo 0) $bf $bn"
}
# R28
t58() {
  need_lint T58 || return
  echo "T58 $(lq A '/packages/ui-web/src/zz-ui-[1-5]\.ts$' 'ui-web boundary')"
}
t59() {
  need T59 || return
  lint_b || { echo "T59 the lint run produced no result (Blocked)"; return; }
  echo "T59 $(jq -r '[.[] | select(.filePath | test("/packages/ui-web/src/zz-ui-ok\\.ts$"))] | "\(length) \([.[].messages[]] | length)"' "$BASE/lintB.json")"
}
t60() { need_lint T60 || return; echo "T60 $(jq -r '[.[] | select(.filePath | test("/packages/ui-web/src/zz-ui\\.test\\.ts$"))] | "\(length) \([.[].messages[] | select(.ruleId == "@typescript-eslint/no-restricted-imports" or .ruleId == "no-restricted-syntax")] | length)"' "$BASE/lintA.json")"; }
t61() { mutrow T61 "$M_UI" '\(R28\)' '\(R21\)'; }
# R25
t62() { local pj; pj=$(doc packages/platform/package.json); echo "T62 $(printf '%s' "$pj" | jq -r 'has("dependencies") | if . then 1 else 0 end') $(printf '%s' "$pj" | jq -r '.devDependencies | length')"; }
t63() {
  local n=0 hit=0 proof=0 f
  for f in $(files packages/platform); do
    n=$((n + 1))
    doc "$f" | grep -qE '(from|import\(?|require\()[[:space:]]*["`'"'"']@toki/i18n' && hit=$((hit + 1))
    doc "$f" | grep -qE '^import ' && proof=$((proof + 1))
  done
  echo "T63 $n $hit $proof"
}
t64() {
  local n=0 sink=0 jsx=0 f
  for f in $(files packages/platform/src | grep -vE '\.test\.ts$'); do
    n=$((n + 1))
    doc "$f" | grep -qE 'textContent|innerText|innerHTML|insertAdjacentHTML|document\.title|\b(alert|confirm|prompt)\(|new Notification\(' && sink=$((sink + 1))
    case "$f" in *.tsx|*.jsx) jsx=$((jsx + 1));; esac
  done
  echo "T64 $n $sink $jsx"
}
# R26
t65() {
  local m calls cl ml imp=0
  m=$(doc apps/web/src/main.tsx)
  calls=$(printf '%s\n' "$m" | grep -c '^setPlatform(createWebPlatform());')
  cl=$(printf '%s\n' "$m" | grep -n '^setPlatform(createWebPlatform());' | head -1 | cut -d: -f1)
  ml=$(printf '%s\n' "$m" | grep -n 'createRoot(' | head -1 | cut -d: -f1)
  printf '%s\n' "$m" | grep -q '^import { setPlatform } from "@toki/platform";' && printf '%s\n' "$m" | grep -q '^import { createWebPlatform } from "@toki/platform/web";' && imp=1
  echo "T65 $calls $([ -n "$cl" ] && [ -n "$ml" ] && [ "$cl" -lt "$ml" ] && echo 1 || echo 0) $imp"
}
t66() { brow T66 '.app.mounted' '.app.set' '.app.keys' '.app.loaded'; }
t67() { echo "T67 $(doc apps/web/package.json | jq -r '.dependencies["@toki/platform"]')"; }
t68() {
  local n out="" outside=0 f
  n=$(files . | grep -E '\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$' | grep -vc '^docs/')
  for f in $(git grep -lE '(from|import\(?)[[:space:]]*["`'"'"']@toki/platform/web' "$V" -- '*.ts' '*.tsx' '*.mts' '*.cts' '*.js' '*.jsx' '*.mjs' '*.cjs' ':!docs' | sed "s#^$V:##"); do
    case "$f" in packages/platform/*|tools/lint-rules/*.test.mjs) ;; *) outside=$((outside + 1)); out="$out $f";; esac
  done
  echo "T68 $n $outside${out:- none}"
}
# R27
t69() { need T69 || return; reset_wt; pnenv -- typecheck >/dev/null 2>&1; echo "T69 $?"; }
t70() { need T70 || return; reset_wt; pnenv -- lint >/dev/null 2>&1; echo "T70 $?"; }
t71() { need T71 || return; reset_wt; pnenv -- test:lint-rules >/dev/null 2>&1; echo "T71 $?"; }
t72() { need T72 || return; reset_wt; pnenv -- format:check >/dev/null 2>&1; echo "T72 $?"; }
t73() {
  need T73 || return
  pg_ready || { echo "T73 could not start a temporary PostgreSQL (Blocked)"; return; }
  reset_wt
  local dev="postgres://qa@127.0.0.1:$PGPORT/qa_dev" tst="postgres://qa@127.0.0.1:$PGPORT/toki_qa_test"
  sql postgres "create database qa_dev" >/dev/null
  pnenv DATABASE_URL="$dev" -- --filter @toki/server run db:migrate >/dev/null 2>&1 || { echo "T73 the migration of the temporary database failed (Blocked)"; return; }
  pnenv NODE_ENV=development DATABASE_URL="$dev" TEST_DATABASE_URL="$tst" -- test > "$BASE/t73.log" 2>&1; local rc=$?
  reset_wt
  if [ "$rc" = 0 ]; then echo "T73 0"; else echo "T73 $rc (failed test files: $(sed -E 's/\x1b\[[0-9;]*m//g' "$BASE/t73.log" | grep -E '^ *(FAIL|❯) ' | grep -oE '[A-Za-z0-9_./-]+\.test\.[a-z]+' | sort -u | tr '\n' ' '))"; fi
}
# the manual row
t74() { echo "T74 (Blocked) manual row: the QA pastes the result of the by-hand checks in Chrome, Safari and Firefox into the record"; }

# ---- SERVE: the page for the manual row ---------------------------------------------------------------------------
# `V=<commit> bash docs/qa/TOKI-018.checks.sh SERVE` starts the dev server of apps/web in the worktree, prints the
# address of a made-up page with one button for each by-hand check, and waits for Enter. It is not a row and
# prints no evidence. The page lives only in the temporary worktree.
serve() {
  need SERVE || return
  reset_wt; write_kit
  cp "$KIT/qa-sound.wav" "$WT/apps/web/public/qa-sound.wav" 2>/dev/null || { mkdir -p "$WT/apps/web/public"; cp "$KIT/qa-sound.wav" "$WT/apps/web/public/qa-sound.wav"; }
  cp "$KIT/qa-platform.html" "$WT/apps/web/qa-platform.html"
  web_start || { echo "SERVE the Vite server did not start (Blocked)"; return; }
  echo "SERVE http://127.0.0.1:$VITE_PORT/qa-platform.html"
  echo "SERVE press Enter to stop and clean up"
  read -r _ || true
}

if [ "${1:-}" = SERVE ]; then serve; else
rows="${*:-$(seq -f 'T%g' 1 74 | tr '\n' ' ')}"
for r in $rows; do
  fn=$(printf '%s' "$r" | tr 'A-Z' 'a-z')
  if declare -F "$fn" >/dev/null; then "$fn"; else echo "$r is not a row" >&2; fi
done
fi
alive=0
for p in $PIDS; do kill_tree "$p"; done
sleep 0.3
for p in $PIDS; do kill -0 "$p" 2>/dev/null && alive=$((alive + 1)); done
cleanup
echo "CLEAN worktrees $([ "$(git worktree list | grep -cF "$BASE")" = 0 ] && echo same || echo changed) status $([ "$(git status --porcelain | shasum | cut -d' ' -f1)" = "$before_status" ] && echo same || echo changed) processes $alive temporary-folder $([ -d "$BASE" ] && echo kept || echo removed)"
