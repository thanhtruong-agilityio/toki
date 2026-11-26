# TOKI-135 Save the results of the UI parity check - implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A command `pnpm ui:save`, run by hand, that runs the UI parity check (or keeps its last run) and copies the report and the images into `docs/ui-parity/<UTC date>-<commit>/` with a `meta.json`, keeps a table of the kept runs, and prints the commands to remove old runs.

**Architecture:** One module, `tools/ui-parity/save.mjs`, in the style of `container.mjs`: pure functions (arguments, folder name, counts, `meta.json`, the table, the dirty count, listing and pruning) and one function `saveRun(options, deps)` that gets what touches the outside (read-only `git`, the check, the clock, the copy, the log) as `deps`, so that the tests use a real temporary folder and fakes and need no Docker. The command line at the bottom runs only when the file is run directly.

**Tech Stack:** Node 22 built-ins only (`node:fs`, `node:child_process`, `node:path`), `node:test` for the tests; no dependency.

**Spec:** `docs/specs/2026-11-25-ui-parity-save-design.md` (R1 to R18, concerns 1 to 5, all decided). Intent: `docs/intents/ui-parity-save.md`. Ticket: TOKI-135, issue 355.

## Global Constraints
- Kept runs live in `docs/ui-parity/<date>-<commit>/`: `<date>` is the UTC date of the save (`YYYY-MM-DD`), `<commit>` the first 7 characters of `HEAD`, and the name ends with `-dirty` when the working tree has uncommitted changes outside `docs/ui-parity/` (R5, R11).
- The list is `docs/ui-parity/index.md`, made again from the `meta.json` of every folder at each save, newest first (R12). Columns: Date (UTC), Commit (a link to the folder's `report.md`), Branch, Tree, Match, Differs, Known, No longer, Not run.
- `meta.json` keys: `date`, `commit`, `branch`, `dirty`, `dirtyFiles`, `ran`, `withImages`, `counts` (`match`, `differs`, `known`, `noLongerDifference`, `notRun`), `imageTag`, `prototypeSha256`. No name or address of a person (R7).
- The command only reads from `git` (`rev-parse`, `status`) and never changes the repository; it never runs `git add`, `commit` or `push`; `--prune` only prints (R15, R18).
- It deletes only `e2e/assets/parity/report.md`, `report.json` and `images/` (before a run, R2) and its own temporary folders; never a kept run (R10, R13, R18).
- Exit codes: 0 saved or listed, 1 no result or refused, 2 wrong usage.
- Node built-ins only; `.nvmrc` is 22. Source files are `.mjs`, tests are `node:test`, listed in the root `test` script like the other files of `tools/ui-parity/`.
- Branch `feat/toki-135-ui-parity-save`, never `main`; Conventional Commits with a lowercase subject; no attribution lines; no force-push; no merge.

## How This Plan Was Created
1. Spec provided: `docs/specs/2026-11-25-ui-parity-save-design.md`; analysis and design approved by Thanh Truong on 2026-11-26 (tier M).
2. Implementation plan: this document. Recommended execution: `cl-dev:executing-plans`.

---

## AC -> step -> test
| Req | Acceptance criterion (short) | Task / step | Test that proves it |
|---|---|---|---|
| R1 | Four options and no other; `--prune` alone; exit 2 with a usage line | T1 steps 1-4, T4 step 3 | `save.test.mjs` "parseSaveArgs ..." (6 tests) |
| R2 | Old `report.md`, `report.json`, `images/` deleted before the run | T3 steps 1-3 | "an old report is not kept when the check fails" |
| R3 | Runs `node tools/ui-parity/container.mjs test`, no further argument | T3 steps 1-3, T4 step 2 | "runs the whole check" (fake runner records the call) |
| R4 | No result keeps nothing: exit code, missing `report.json`, no row | T3 steps 1-3 | three tests "no result: ..." |
| R5 | Folder `<date>-<commit>`, `-dirty` suffix | T1 steps 1-4 | "folderName" (clean, dirty) |
| R6 | Folder holds `report.md`, `report.json`, `images/`, `meta.json` | T3 steps 1-3 | "keeps the report, the images and meta.json" |
| R7 | `meta.json` keys and values, no person | T1 steps 5-6, T3 | "buildMeta"; "meta.json of a saved run" |
| R8 | `--no-images`: no `images/`, `withImages: false` | T3 steps 1-3 | "--no-images keeps no images" |
| R9 | `--no-run`: nothing deleted, `ran: false`, prints summary and age | T3 steps 1-3 | "--no-run keeps the last report and says how old it is" |
| R10 | Existing folder refused (exit 1, unchanged); `--update` replaces as a whole | T3 steps 1-3 | "refuses to replace"; "--update replaces the folder as a whole" |
| R11 | Dirty: kept, marked, warned; `docs/ui-parity/` changes do not count | T1 steps 5-6, T3 | "dirtyFiles"; "a dirty tree is kept, marked and warned about" |
| R12 | Table made from the folders, newest first, bad `meta.json` left out | T1 steps 7-8, T2 steps 1-3 | "renderIndex"; "listRuns"; "index after a removal" |
| R13 | Temporary folder, then move; failed copy leaves nothing; leftovers removed | T3 steps 1-3 | "a copy that fails half way leaves no folder"; "--update keeps the old folder when the copy fails"; "removes leftovers" |
| R14 | Prints folder, counts and the next step; exit 0 | T3 steps 1-3 | "prints the folder, the counts and the next step" |
| R15 | Only `rev-parse` and `status` | T3 steps 1-3, T4 step 2 | every test uses a fake `git` that throws on any other command |
| R16 | README section and two `CLAUDE.md` rows | T5 | the files hold them (step 3 greps) |
| R17 | First kept run in the PR; the four commands pass | T6 | `docs/ui-parity/<folder>` in the diff; `format:check`, `lint`, `typecheck`, `test` |
| R18 | `--prune <n>` prints `git rm` commands, deletes nothing | T2 steps 4-6 | "pruneLines" (5 folders, n 2; n larger; bad n; nothing deleted) |

## Design
(Approved by Thanh Truong on 2026-11-26. Facts found in the analysis are in the tasks.)

**Module and interfaces.** `tools/ui-parity/save.mjs` exports: `UsageError`; `parseSaveArgs(argv) -> { run, images, update, prune }`; `folderName(iso, commit, dirty)`; `countRows(rows)`; `dirtyFiles(porcelain)`; `buildMeta(input)`; `renderIndex(entries)`; `listRuns(root) -> { runs, unreadable }`; `pruneLines(root, n) -> { keep, remove, unreadable }`; `saveRun(options, deps) -> exit code`; `main(argv, io)`. `deps` is `{ repo, git(args) -> string, runCheck() -> number, now() -> Date, copy?(from, to, options), log(line), warn(line) }`; the paths are derived from `repo`: output `<repo>/e2e/assets/parity`, kept runs `<repo>/docs/ui-parity`.

**A save.** Read `HEAD`, the branch and `git status --porcelain` (read-only). Without `--no-run`: delete the three old outputs, run the check, require exit 0. Read `report.json`; with no readable rows, stop (exit 1, nothing created). Work out the name; refuse when it exists without `--update`. Build the folder in `docs/ui-parity/.tmp-<random>`, move it into place (with `--update` the old folder is set aside as `.old-<random>` and removed only when the new one is in place, and put back when the move fails). Write `index.md` again from the folders. Print the folder, the counts and the next step.

**Files.**
| Task | Creates | Modifies |
|---|---|---|
| T1 | `tools/ui-parity/save.mjs`, `tools/ui-parity/save.test.mjs` | none |
| T2 | none | `save.mjs`, `save.test.mjs` |
| T3 | none | `save.mjs`, `save.test.mjs` |
| T4 | none | `save.mjs`, `package.json` (script `ui:save`, the test in the `test` script) |
| T5 | none | `e2e/parity/README.md`, `CLAUDE.md` |
| T6 | `docs/ui-parity/index.md`, `docs/ui-parity/<folder>/...` | none |

---

### Task 1: Arguments and the pure helpers
**Files:** Create `tools/ui-parity/save.mjs`, `tools/ui-parity/save.test.mjs`.

**Interfaces:**
- Produces: `UsageError`, `parseSaveArgs`, `folderName`, `countRows`, `dirtyFiles`, `buildMeta`, `renderIndex` (signatures in Design).
- `buildMeta({ now: Date, commit: string, branch: string, dirty: string[], ran: boolean, images: boolean, counts, imageTag: string, prototypeSha256: string }) -> Meta`.

**Acceptance Criteria:**
- [ ] The arguments, the name, the counts, the dirty count, `meta.json` and the table are right for the cases of R1, R5, R7, R11 and R12.

- [ ] **Step 1: Write the failing tests** (arguments and name) in `save.test.mjs`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  UsageError, parseSaveArgs, folderName, countRows, dirtyFiles, buildMeta, renderIndex,
} from "./save.mjs";

test("parseSaveArgs: defaults run and keep the images", () => {
  assert.deepEqual(parseSaveArgs([]), { run: true, images: true, update: false, prune: null });
});
test("parseSaveArgs: the three options", () => {
  assert.deepEqual(parseSaveArgs(["--no-run", "--no-images", "--update"]), { run: false, images: false, update: true, prune: null });
});
test("parseSaveArgs: --prune alone takes a whole number of at least 1", () => {
  assert.deepEqual(parseSaveArgs(["--prune", "3"]).prune, 3);
  for (const bad of [["--prune"], ["--prune", "0"], ["--prune", "-1"], ["--prune", "x"], ["--prune", "2.5"]]) {
    assert.throws(() => parseSaveArgs(bad), UsageError, bad.join(" "));
  }
});
test("parseSaveArgs: --prune cannot be combined", () => {
  for (const other of ["--no-run", "--no-images", "--update"]) {
    assert.throws(() => parseSaveArgs(["--prune", "2", other]), /another option/);
  }
});
test("parseSaveArgs: an unknown option or a positional argument is refused", () => {
  assert.throws(() => parseSaveArgs(["--force"]), /unknown argument --force/);
  assert.throws(() => parseSaveArgs(["admin"]), /unknown argument admin/);
});
test("folderName: UTC date and 7 characters of the commit; -dirty when dirty", () => {
  const sha = "b0a772df1234567890abcdef1234567890abcdef";
  assert.equal(folderName("2026-11-26T23:59:59.000Z", sha, false), "2026-11-26-b0a772d");
  assert.equal(folderName("2026-11-26T23:59:59.000Z", sha, true), "2026-11-26-b0a772d-dirty");
});
```
- [ ] **Step 2: Run** `node --test tools/ui-parity/save.test.mjs`. Expected: FAIL (`save.mjs` is missing).
- [ ] **Step 3: Implement** `parseSaveArgs`, `UsageError`, `folderName` in `save.mjs`:
```js
export class UsageError extends Error {}

export function parseSaveArgs(argv) {
  const o = { run: true, images: true, update: false, prune: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-run") o.run = false;
    else if (arg === "--no-images") o.images = false;
    else if (arg === "--update") o.update = true;
    else if (arg === "--prune") {
      const value = argv[(i += 1)];
      if (!/^[1-9][0-9]*$/.test(value ?? "")) throw new UsageError("--prune needs a whole number of at least 1");
      o.prune = Number(value);
    } else throw new UsageError(`unknown argument ${arg}`);
  }
  if (o.prune !== null && (!o.run || !o.images || o.update)) {
    throw new UsageError("--prune cannot be used with another option");
  }
  return o;
}

export const folderName = (iso, commit, dirty) =>
  `${iso.slice(0, 10)}-${commit.slice(0, 7)}${dirty ? "-dirty" : ""}`;
```
- [ ] **Step 4: Run the tests.** Expected: PASS. Commit: `test(tools): parse the arguments of ui:save and name a kept run (TOKI-135)`.
- [ ] **Step 5: Write the failing tests** (counts, dirty files, meta):
```js
test("countRows: counts the five statuses", () => {
  const rows = ["match", "match", "differs", "known", "stale-known", "not-run", "not-run"].map((status) => ({ status }));
  assert.deepEqual(countRows(rows), { match: 2, differs: 1, known: 1, noLongerDifference: 1, notRun: 2 });
});
test("dirtyFiles: lists changed paths and leaves out docs/ui-parity", () => {
  const porcelain = [" M tools/a.mjs", "?? new.txt", "A  docs/ui-parity/index.md", "R  old.txt -> renamed.txt", "?? docs/ui-parity/2026-11-26-abc1234/"].join("\n");
  assert.deepEqual(dirtyFiles(porcelain), ["tools/a.mjs", "new.txt", "old.txt", "renamed.txt"]);
});
test("dirtyFiles: nothing for an empty status or only kept runs", () => {
  assert.deepEqual(dirtyFiles(""), []);
  assert.deepEqual(dirtyFiles("?? docs/ui-parity/x/\n M docs/ui-parity/index.md\n"), []);
});
test("dirtyFiles: a quoted path loses its quotes", () => {
  assert.deepEqual(dirtyFiles('?? "a b.txt"'), ["a b.txt"]);
});
test("buildMeta: the keys of R7 and no person", () => {
  const meta = buildMeta({
    now: new Date("2026-11-26T08:03:25.000Z"), commit: "b".repeat(40), branch: "main", dirty: [],
    ran: true, images: true, counts: { match: 24, differs: 0, known: 6, noLongerDifference: 0, notRun: 0 },
    imageTag: "mcr.microsoft.com/playwright:v1.65.1-noble", prototypeSha256: "8afc",
  });
  assert.deepEqual(meta, {
    date: "2026-11-26T08:03:25.000Z", commit: "b".repeat(40), branch: "main", dirty: false, dirtyFiles: 0,
    ran: true, withImages: true, counts: { match: 24, differs: 0, known: 6, noLongerDifference: 0, notRun: 0 },
    imageTag: "mcr.microsoft.com/playwright:v1.65.1-noble", prototypeSha256: "8afc",
  });
});
test("buildMeta: a dirty tree is marked with the number of files", () => {
  const meta = buildMeta({ now: new Date(0), commit: "a".repeat(40), branch: "HEAD", dirty: ["x", "y"], ran: false, images: false,
    counts: {}, imageTag: "t", prototypeSha256: "h" });
  assert.equal(meta.dirty, true);
  assert.equal(meta.dirtyFiles, 2);
  assert.equal(meta.withImages, false);
  assert.equal(meta.ran, false);
});
```
- [ ] **Step 6: Run, see them fail; implement:**
```js
export function countRows(rows) {
  const c = { match: 0, differs: 0, known: 0, noLongerDifference: 0, notRun: 0 };
  for (const { status } of rows) {
    if (status === "match") c.match += 1;
    else if (status === "differs") c.differs += 1;
    else if (status === "known") c.known += 1;
    else if (status === "stale-known") c.noLongerDifference += 1;
    else if (status === "not-run") c.notRun += 1;
  }
  return c;
}

const unquote = (p) => (p.length >= 2 && p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p);

// `git status --porcelain`: "XY path" or "XY old -> new". The kept runs themselves do not count (R11).
export function dirtyFiles(porcelain) {
  return porcelain
    .split("\n")
    .filter((line) => line.length > 3)
    .flatMap((line) => line.slice(3).split(" -> ").map(unquote))
    .filter((path) => !path.startsWith("docs/ui-parity/"));
}

export function buildMeta({ now, commit, branch, dirty, ran, images, counts, imageTag, prototypeSha256 }) {
  return {
    date: now.toISOString(), commit, branch, dirty: dirty.length > 0, dirtyFiles: dirty.length,
    ran, withImages: images, counts, imageTag, prototypeSha256,
  };
}
```
Run: Expected PASS. Commit: `test(tools): count the rows and the dirty files of a kept run (TOKI-135)`.
- [ ] **Step 7: Write the failing test of the table:**
```js
const meta = (date, c = {}) => ({ date, commit: "c".repeat(40), branch: "main", dirty: false, dirtyFiles: 0, ran: true, withImages: true,
  counts: { match: 24, differs: 0, known: 6, noLongerDifference: 0, notRun: 0, ...c }, imageTag: "t", prototypeSha256: "h" });
test("renderIndex: a heading, a sentence and a table, newest first", () => {
  const md = renderIndex([
    { folder: "2026-11-24-aaaaaaa", meta: meta("2026-11-24T10:00:00.000Z") },
    { folder: "2026-11-26-bbbbbbb-dirty", meta: { ...meta("2026-11-26T09:00:00.000Z"), dirty: true, dirtyFiles: 3, branch: "feat/x" } },
  ]);
  const lines = md.split("\n").filter((l) => l.startsWith("|"));
  assert.equal(lines[0], "| Date (UTC) | Commit | Branch | Tree | Match | Differs | Known | No longer | Not run |");
  assert.match(lines[2], /^\| 2026-11-26 \| \[bbbbbbb\]\(2026-11-26-bbbbbbb-dirty\/report\.md\) \| feat\/x \| dirty \| 24 \| 0 \| 6 \| 0 \| 0 \|$/);
  assert.match(lines[3], /^\| 2026-11-24 \| \[aaaaaaa\]\(2026-11-24-aaaaaaa\/report\.md\) \| main \| clean \|/);
});
test("renderIndex: the same date is ordered by folder name, and the text is stable", () => {
  const a = { folder: "2026-11-26-aaaaaaa", meta: meta("2026-11-26T10:00:00.000Z") };
  const b = { folder: "2026-11-26-bbbbbbb", meta: meta("2026-11-26T10:00:00.000Z") };
  assert.equal(renderIndex([a, b]), renderIndex([b, a]));
  assert.ok(renderIndex([a, b]).indexOf("bbbbbbb") < renderIndex([a, b]).indexOf("aaaaaaa"));
});
test("renderIndex: no kept run gives the heading and an empty table", () => {
  assert.match(renderIndex([]), /\| Date \(UTC\) \|/);
});
```
- [ ] **Step 8: Run, see it fail; implement `renderIndex`:**
```js
const byNewest = (a, b) =>
  a.meta.date < b.meta.date ? 1 : a.meta.date > b.meta.date ? -1 : a.folder < b.folder ? 1 : a.folder > b.folder ? -1 : 0;

const cell = (value) => String(value).replace(/\|/g, "\\|");

export function renderIndex(entries) {
  const head = "| Date (UTC) | Commit | Branch | Tree | Match | Differs | Known | No longer | Not run |";
  const rows = [...entries].sort(byNewest).map(({ folder, meta: m }) => {
    const short = m.commit.slice(0, 7);
    const c = m.counts;
    return `| ${m.date.slice(0, 10)} | [${short}](${folder}/report.md) | ${cell(m.branch)} | ${m.dirty ? "dirty" : "clean"} | ${c.match} | ${c.differs} | ${c.known} | ${c.noLongerDifference} | ${c.notRun} |`;
  });
  return [
    "# UI parity: kept runs", "",
    "The runs that `pnpm ui:save` kept, newest first. This file is made again from the folders at every save; do not edit it by hand.", "",
    head, "| --- | --- | --- | --- | --- | --- | --- | --- | --- |", ...rows, "",
  ].join("\n");
}
```
Run: Expected PASS. Commit: `test(tools): render the list of kept runs (TOKI-135)`.

---

### Task 2: Listing the kept runs, the list file and `--prune`
**Files:** Modify `tools/ui-parity/save.mjs`, `tools/ui-parity/save.test.mjs`.

**Interfaces:**
- Consumes: `renderIndex`, `meta` shape (T1).
- Produces: `listRuns(root) -> { runs: { folder, meta }[], unreadable: string[] }` (only real folders not starting with `.`; a folder whose `meta.json` is missing, not JSON, or without a string `date` and an object `counts` is `unreadable`); `writeIndex(root) -> { unreadable }` (writes `index.md`); `pruneLines(root, n) -> { keep, remove, unreadable }` (folders, newest first).

**Acceptance Criteria:**
- [ ] The list follows the folders: a removed folder is gone at the next write; a bad `meta.json` is left out and named (R12). `--prune` lists what to remove and deletes nothing (R18).

- [ ] **Step 1: Write the failing tests** with a temporary root. The helpers and the tests (add `mkdtempSync`, `mkdirSync`, `writeFileSync`, `readFileSync`, `readdirSync`, `rmSync` from `node:fs`, `tmpdir` from `node:os` and `join` from `node:path` to the imports; `meta(date, counts)` is the helper of the table tests):
```js
const tmpRoot = () => mkdtempSync(join(tmpdir(), "ui-save-root-"));
function keep(root, folder, m) {
  mkdirSync(join(root, folder), { recursive: true });
  writeFileSync(join(root, folder, "meta.json"), JSON.stringify(m));
}
function five() {
  const root = tmpRoot();
  for (let d = 21; d <= 25; d += 1) keep(root, `2026-11-${d}-aaaaaa${d % 10}`, meta(`2026-11-${d}T10:00:00.000Z`));
  return root;
}

test("listRuns: reads the folders, names an unreadable one and ignores files and dot folders", () => {
  const root = tmpRoot();
  keep(root, "2026-11-24-aaaaaaa", meta("2026-11-24T10:00:00.000Z"));
  keep(root, "2026-11-26-bbbbbbb", meta("2026-11-26T10:00:00.000Z"));
  mkdirSync(join(root, "2026-11-25-ccccccc")); // no meta.json
  mkdirSync(join(root, "2026-11-25-ddddddd"));
  writeFileSync(join(root, "2026-11-25-ddddddd", "meta.json"), "{"); // not JSON
  mkdirSync(join(root, ".tmp-x"));
  writeFileSync(join(root, "index.md"), "x");
  const { runs, unreadable } = listRuns(root);
  assert.deepEqual(runs.map((r) => r.folder), ["2026-11-24-aaaaaaa", "2026-11-26-bbbbbbb"]);
  assert.deepEqual(unreadable, ["2026-11-25-ccccccc", "2026-11-25-ddddddd"]);
});

test("listRuns: a missing root is no run and no error", () => {
  assert.deepEqual(listRuns(join(tmpRoot(), "nope")), { runs: [], unreadable: [] });
});

test("writeIndex: the list follows the folders, so a removed run is gone at the next write", () => {
  const root = tmpRoot();
  keep(root, "2026-11-24-aaaaaaa", meta("2026-11-24T10:00:00.000Z"));
  keep(root, "2026-11-26-bbbbbbb", meta("2026-11-26T10:00:00.000Z"));
  mkdirSync(join(root, "2026-11-01-bad"));
  assert.deepEqual(writeIndex(root).unreadable, ["2026-11-01-bad"]);
  assert.match(readFileSync(join(root, "index.md"), "utf8"), /aaaaaaa/);
  rmSync(join(root, "2026-11-24-aaaaaaa"), { recursive: true });
  writeIndex(root);
  const md = readFileSync(join(root, "index.md"), "utf8");
  assert.doesNotMatch(md, /aaaaaaa/);
  assert.doesNotMatch(md, /bad/);
  assert.match(md, /bbbbbbb/);
});

test("pruneLines: keeps the newest n and names the older ones, newest first", () => {
  const r = pruneLines(five(), 2);
  assert.deepEqual(r.keep, ["2026-11-25-aaaaaa5", "2026-11-24-aaaaaa4"]);
  assert.deepEqual(r.remove, ["2026-11-23-aaaaaa3", "2026-11-22-aaaaaa2", "2026-11-21-aaaaaa1"]);
});

test("pruneLines: n larger than the number of folders removes nothing", () => {
  const r = pruneLines(five(), 9);
  assert.equal(r.remove.length, 0);
  assert.equal(r.keep.length, 5);
});

test("pruneLines: an unreadable folder is not counted and is named", () => {
  const root = five();
  mkdirSync(join(root, "2026-11-26-zzzzzzz"));
  const r = pruneLines(root, 2);
  assert.deepEqual(r.unreadable, ["2026-11-26-zzzzzzz"]);
  assert.equal(r.keep.length + r.remove.length, 5);
});
```
- [ ] **Step 2: Run, see them fail** (`listRuns` is not a function).
- [ ] **Step 3: Implement:**
```js
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function listRuns(root) {
  const runs = [];
  const unreadable = [];
  let names = [];
  try { names = readdirSync(root); } catch { return { runs, unreadable }; }
  for (const folder of names.sort()) {
    if (folder.startsWith(".")) continue;
    if (!statSync(join(root, folder)).isDirectory()) continue;
    try {
      const meta = JSON.parse(readFileSync(join(root, folder, "meta.json"), "utf8"));
      if (typeof meta.date !== "string" || typeof meta.counts !== "object" || meta.counts === null || typeof meta.commit !== "string") throw new Error("bad meta");
      runs.push({ folder, meta });
    } catch { unreadable.push(folder); }
  }
  return { runs, unreadable };
}

export function writeIndex(root) {
  const { runs, unreadable } = listRuns(root);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "index.md"), renderIndex(runs));
  return { unreadable };
}

export function pruneLines(root, n) {
  const { runs, unreadable } = listRuns(root);
  const sorted = [...runs].sort(byNewest).map((r) => r.folder);
  return { keep: sorted.slice(0, n), remove: sorted.slice(n), unreadable };
}
```
- [ ] **Step 4: Run, see them pass. Commit:** `test(tools): list the kept runs and write their table (TOKI-135)`.
- [ ] **Step 5: Write the failing tests of the `--prune` command** (`prune(root, n, io) -> 0` prints, for the older runs, `git rm -r docs/ui-parity/<folder>`, says that the next save makes `index.md` again, names an unreadable folder, says so when there is nothing older, and deletes no file):
```js
function io() {
  const logs = [];
  const warns = [];
  return { logs, warns, log: (l) => logs.push(l), warn: (l) => warns.push(l) };
}

test("prune: prints the git rm commands for the runs older than the newest n and deletes nothing", () => {
  const root = five();
  const before = readdirSync(root).sort();
  const o = io();
  assert.equal(prune(root, 2, o), 0);
  assert.deepEqual(o.logs.filter((l) => l.startsWith("git rm")), [
    "git rm -r docs/ui-parity/2026-11-23-aaaaaa3",
    "git rm -r docs/ui-parity/2026-11-22-aaaaaa2",
    "git rm -r docs/ui-parity/2026-11-21-aaaaaa1",
  ]);
  assert.ok(o.logs.some((l) => /makes index\.md again/.test(l)));
  assert.deepEqual(readdirSync(root).sort(), before);
});

test("prune: says that nothing is older when n is larger than the number of folders", () => {
  const o = io();
  assert.equal(prune(five(), 9, o), 0);
  assert.ok(o.logs.some((l) => /nothing is older/.test(l)));
  assert.equal(o.logs.filter((l) => l.startsWith("git rm")).length, 0);
});

test("prune: names a folder with no readable meta.json", () => {
  const root = five();
  mkdirSync(join(root, "2026-11-26-zzzzzzz"));
  const o = io();
  prune(root, 2, o);
  assert.ok(o.warns.some((l) => l.includes("2026-11-26-zzzzzzz")));
});
```
- [ ] **Step 6: Run, see them fail; implement:**
```js
export function prune(root, n, io) {
  const { keep, remove, unreadable } = pruneLines(root, n);
  for (const folder of unreadable) io.warn(`not counted, no readable meta.json: docs/ui-parity/${folder}`);
  if (remove.length === 0) { io.log(`nothing is older than the newest ${n} kept runs (${keep.length} kept)`); return 0; }
  io.log(`keeping the newest ${n}; to remove the ${remove.length} older runs, run:`);
  for (const folder of remove) io.log(`git rm -r docs/ui-parity/${folder}`);
  io.log("then run `pnpm ui:save` next time: it makes index.md again from the folders");
  return 0;
}
```
Run: Expected PASS. Commit: `test(tools): print what --prune would remove (TOKI-135)`.

---

### Task 3: The save
**Files:** Modify `tools/ui-parity/save.mjs`, `tools/ui-parity/save.test.mjs`.

**Interfaces:**
- Consumes: T1 and T2 functions; `playwrightVersion`, `imageTag` from `./container.mjs`.
- Produces: `saveRun(options, deps) -> number` (exit code), `options` as returned by `parseSaveArgs`; `deps` as in Design.

**Acceptance Criteria:**
- [ ] R2, R3, R4, R6 to R10, R13, R14 and R15 hold, proved with a real temporary folder, a fake runner and a fake `git`.

- [ ] **Step 1: Write the failing tests.** A helper builds the world:
```js
function world({ rows, images = ["a-reference.png", "a-app.png", "a-diff.png"], porcelain = "", runCode = 0, writeOnRun = true } = {}) {
  const repo = mkdtempSync(join(tmpdir(), "ui-save-"));
  const out = join(repo, "e2e/assets/parity");
  const writeReport = () => {
    mkdirSync(join(out, "images"), { recursive: true });
    writeFileSync(join(out, "report.md"), "# UI parity report\n");
    writeFileSync(join(out, "report.json"), JSON.stringify({ summary: "checked 3 · match 2 · differs 1", rows }));
    for (const name of images) writeFileSync(join(out, "images", name), "png");
  };
  mkdirSync(join(repo, "e2e/parity"), { recursive: true });
  writeFileSync(join(repo, "e2e/parity/prototype.sha256"), "8afc\n");
  writeFileSync(join(repo, "pnpm-lock.yaml"), "      '@playwright/test':\n        specifier: 1.65.1\n        version: 1.65.1\n");
  const logs = []; const warns = []; const gitCalls = []; const runs = [];
  const deps = {
    repo,
    git: (args) => {
      gitCalls.push(args.join(" "));
      if (args[0] === "rev-parse" && args[1] === "HEAD") return "b0a772df".padEnd(40, "0") + "\n";
      if (args[0] === "rev-parse") return "feat/x\n";
      if (args[0] === "status") return porcelain;
      throw new Error(`git ${args.join(" ")} is not a command that reads`);
    },
    runCheck: () => { runs.push("node tools/ui-parity/container.mjs test"); if (writeOnRun) writeReport(); return runCode; },
    now: () => new Date("2026-11-26T08:03:25.000Z"),
    log: (l) => logs.push(l), warn: (l) => warns.push(l),
  };
  return { repo, out, deps, logs, warns, gitCalls, runs, writeReport };
}
const ROWS = ["match", "match", "differs"].map((status, i) => ({ kind: "token", name: `r${i}`, status, detail: {} }));
```
and the tests (add `cpSync`, `existsSync`, `utimesSync` from `node:fs` and `saveRun` to the imports):
```js
const OPTS = { run: true, images: true, update: false, prune: null };
const NAME = "2026-11-26-b0a772d";
const read = (...p) => readFileSync(join(...p), "utf8");
const dotFiles = (dir) => readdirSync(dir).filter((n) => n.startsWith("."));

test("runs the whole check, once, with no further argument (R3)", () => {
  const w = world({ rows: ROWS });
  assert.equal(saveRun(OPTS, w.deps), 0);
  assert.deepEqual(w.runs, ["node tools/ui-parity/container.mjs test"]);
});

test("an old report is not kept when the check fails (R2, R4)", () => {
  const w = world({ rows: ROWS, runCode: 1, writeOnRun: false });
  w.writeReport(); // the old report of an earlier run
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity")), false);
  assert.equal(existsSync(join(w.out, "report.json")), false); // deleted before the run (R2)
  assert.match(w.warns.join("\n"), /code 1/);
});

test("no result: the check ends with a code other than 0 even when a report was written (R4)", () => {
  const w = world({ rows: ROWS, runCode: 2 });
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity")), false);
});

test("no result: report.json is missing (R4)", () => {
  const w = world({ rows: ROWS, writeOnRun: false });
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.match(w.warns.join("\n"), /report\.json/);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity")), false);
});

test("no result: report.json holds no row, and nothing is written (R4)", () => {
  const w = world({ rows: [] });
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.match(w.warns.join("\n"), /no row/);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity")), false);
});

test("keeps the report, the images and meta.json (R6, R7)", () => {
  const w = world({ rows: ROWS });
  saveRun(OPTS, w.deps);
  const dir = join(w.repo, "docs/ui-parity", NAME);
  assert.deepEqual(readdirSync(dir).sort(), ["images", "meta.json", "report.json", "report.md"]);
  assert.deepEqual(readdirSync(join(dir, "images")).sort(), ["a-app.png", "a-diff.png", "a-reference.png"]);
  assert.deepEqual(JSON.parse(read(dir, "meta.json")), {
    date: "2026-11-26T08:03:25.000Z", commit: "b0a772df".padEnd(40, "0"), branch: "feat/x",
    dirty: false, dirtyFiles: 0, ran: true, withImages: true,
    counts: { match: 2, differs: 1, known: 0, noLongerDifference: 0, notRun: 0 },
    imageTag: "mcr.microsoft.com/playwright:v1.65.1-noble", prototypeSha256: "8afc",
  });
});

test("keeps only the .png files of images/ (R6)", () => {
  const w = world({ rows: ROWS, images: ["a-app.png", "notes.txt"] });
  saveRun(OPTS, w.deps);
  assert.deepEqual(readdirSync(join(w.repo, "docs/ui-parity", NAME, "images")), ["a-app.png"]);
});

test("--no-images keeps no images (R8)", () => {
  const w = world({ rows: ROWS });
  saveRun({ ...OPTS, images: false }, w.deps);
  const dir = join(w.repo, "docs/ui-parity", NAME);
  assert.equal(existsSync(join(dir, "images")), false);
  assert.equal(JSON.parse(read(dir, "meta.json")).withImages, false);
});

test("--no-run keeps the last report and says how old it is (R9)", () => {
  const w = world({ rows: ROWS, writeOnRun: false });
  w.writeReport();
  const hourAgo = new Date(w.deps.now().getTime() - 3600_000);
  utimesSync(join(w.out, "report.json"), hourAgo, hourAgo);
  assert.equal(saveRun({ ...OPTS, run: false }, w.deps), 0);
  assert.deepEqual(w.runs, []);
  assert.equal(existsSync(join(w.out, "report.md")), true); // nothing was deleted (R9)
  assert.ok(w.logs.some((l) => l.includes("checked 3") && l.includes("1 h 0 min ago")));
  assert.equal(JSON.parse(read(w.repo, "docs/ui-parity", NAME, "meta.json")).ran, false);
});

test("--no-run with no report keeps nothing (R4, R9)", () => {
  const w = world({ rows: ROWS, writeOnRun: false });
  assert.equal(saveRun({ ...OPTS, run: false }, w.deps), 1);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity")), false);
});

test("a dirty tree is kept, marked and warned about (R11)", () => {
  const w = world({ rows: ROWS, porcelain: " M tools/a.mjs\n" });
  assert.equal(saveRun(OPTS, w.deps), 0);
  const meta = JSON.parse(read(w.repo, "docs/ui-parity", `${NAME}-dirty`, "meta.json"));
  assert.equal(meta.dirty, true);
  assert.equal(meta.dirtyFiles, 1);
  assert.equal(w.warns.filter((l) => /uncommitted/.test(l)).length, 1);
  assert.match(w.warns.join("\n"), /1 uncommitted/);
});

test("changes only under docs/ui-parity do not make the tree dirty (R11)", () => {
  const w = world({ rows: ROWS, porcelain: "?? docs/ui-parity/old/\n M docs/ui-parity/index.md\n" });
  saveRun(OPTS, w.deps);
  assert.equal(existsSync(join(w.repo, "docs/ui-parity", NAME)), true);
  assert.equal(w.warns.length, 0);
});

test("refuses to replace a kept run, and leaves it as it was (R10)", () => {
  const w = world({ rows: ROWS });
  saveRun(OPTS, w.deps);
  const dir = join(w.repo, "docs/ui-parity", NAME);
  writeFileSync(join(dir, "mark.txt"), "mine");
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.match(w.warns.join("\n"), new RegExp(NAME));
  assert.equal(read(dir, "mark.txt"), "mine");
});

test("--update replaces the folder as a whole (R10)", () => {
  const w = world({ rows: ROWS });
  saveRun(OPTS, w.deps);
  const dir = join(w.repo, "docs/ui-parity", NAME);
  writeFileSync(join(dir, "old-only.txt"), "x");
  assert.equal(saveRun({ ...OPTS, update: true }, w.deps), 0);
  assert.equal(existsSync(join(dir, "old-only.txt")), false);
  assert.equal(existsSync(join(dir, "report.md")), true);
  assert.deepEqual(dotFiles(join(w.repo, "docs/ui-parity")), []);
});

test("a copy that fails half way leaves no folder and no temporary folder (R13)", () => {
  const w = world({ rows: ROWS });
  let calls = 0;
  w.deps.copy = (from, to, options) => {
    calls += 1;
    if (calls === 2) throw new Error("disk full");
    cpSync(from, to, options);
  };
  assert.equal(saveRun(OPTS, w.deps), 1);
  assert.match(w.warns.join("\n"), /disk full/);
  assert.deepEqual(readdirSync(join(w.repo, "docs/ui-parity")), []);
});

test("--update keeps the old folder when the copy fails (R13)", () => {
  const w = world({ rows: ROWS });
  saveRun(OPTS, w.deps);
  const dir = join(w.repo, "docs/ui-parity", NAME);
  writeFileSync(join(dir, "mark.txt"), "mine");
  w.deps.copy = () => {
    throw new Error("disk full");
  };
  assert.equal(saveRun({ ...OPTS, update: true }, w.deps), 1);
  assert.equal(read(dir, "mark.txt"), "mine");
  assert.deepEqual(dotFiles(join(w.repo, "docs/ui-parity")), []);
});

test("removes the leftovers of an earlier crash (R13)", () => {
  const w = world({ rows: ROWS });
  const root = join(w.repo, "docs/ui-parity");
  mkdirSync(join(root, ".tmp-dead"), { recursive: true });
  mkdirSync(join(root, ".old-lost"), { recursive: true }); // its folder is missing: put it back
  writeFileSync(join(root, ".old-lost", ".target"), "2026-11-20-aaaaaaa");
  writeFileSync(join(root, ".old-lost", "meta.json"), JSON.stringify(meta("2026-11-20T10:00:00.000Z")));
  mkdirSync(join(root, ".old-two"), { recursive: true }); // its folder is there by then: remove it
  writeFileSync(join(root, ".old-two", ".target"), "2026-11-20-aaaaaaa");
  assert.equal(saveRun(OPTS, w.deps), 0);
  assert.deepEqual(readdirSync(root).sort(), ["2026-11-20-aaaaaaa", NAME, "index.md"].sort());
  assert.equal(existsSync(join(root, "2026-11-20-aaaaaaa", ".target")), false);
});

test("prints the folder, the counts and the next step, and exits 0 (R14)", () => {
  const w = world({ rows: ROWS });
  assert.equal(saveRun(OPTS, w.deps), 0);
  assert.ok(w.logs.includes(`kept docs/ui-parity/${NAME}`));
  assert.ok(w.logs.some((l) => l.startsWith("match 2 · differs 1 · known 0")));
  assert.ok(w.logs.includes("next: git add docs/ui-parity"));
});

test("only commands of git that read are used (R15)", () => {
  const w = world({ rows: ROWS, porcelain: " M x\n" });
  saveRun(OPTS, w.deps);
  assert.ok(w.gitCalls.length >= 3);
  assert.ok(w.gitCalls.every((c) => c.startsWith("rev-parse") || c.startsWith("status")));
});

test("the list follows the folders after a save, and names a bad folder (R12)", () => {
  const w = world({ rows: ROWS });
  mkdirSync(join(w.repo, "docs/ui-parity/2026-11-01-bad"), { recursive: true }); // no meta.json
  saveRun(OPTS, w.deps);
  assert.match(read(w.repo, "docs/ui-parity/index.md"), /b0a772d/);
  assert.doesNotMatch(read(w.repo, "docs/ui-parity/index.md"), /2026-11-01-bad/);
  assert.ok(w.warns.some((l) => l.includes("2026-11-01-bad")));
  rmSync(join(w.repo, "docs/ui-parity", NAME), { recursive: true });
  saveRun(OPTS, { ...w.deps, now: () => new Date("2026-11-27T08:00:00.000Z") });
  const md = read(w.repo, "docs/ui-parity/index.md");
  assert.match(md, /2026-11-27/);
  assert.doesNotMatch(md, /2026-11-26/);
});
```
- [ ] **Step 2: Run, see them fail** (`saveRun` is not a function).
- [ ] **Step 3: Implement `saveRun`:**
```js
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { imageTag, playwrightVersion } from "./container.mjs";

const ago = (ms) => {
  const minutes = Math.max(0, Math.round(ms / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

export function saveRun(options, deps) {
  const { repo, git, runCheck, now, log, warn } = deps;
  const copy = deps.copy ?? cpSync;
  const out = join(repo, "e2e/assets/parity");
  const root = join(repo, "docs/ui-parity");
  const reportPath = join(out, "report.json");

  const commit = git(["rev-parse", "HEAD"]).trim();
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const dirty = dirtyFiles(git(["status", "--porcelain"]));

  if (options.run) {
    for (const name of ["report.md", "report.json"]) rmSync(join(out, name), { force: true });
    rmSync(join(out, "images"), { recursive: true, force: true });
    const code = runCheck();
    if (code !== 0) { warn(`nothing kept: the check ended with code ${code}`); return 1; }
  }
  let report;
  try { report = JSON.parse(readFileSync(reportPath, "utf8")); }
  catch { warn(`nothing kept: ${reportPath} is missing or cannot be read`); return 1; }
  if (!Array.isArray(report.rows) || report.rows.length === 0) { warn("nothing kept: report.json holds no row"); return 1; }
  if (!options.run) log(`${report.summary} (report written ${ago(now().getTime() - statSync(reportPath).mtimeMs)} ago)`);

  const when = now();
  const name = folderName(when.toISOString(), commit, dirty.length > 0);
  const target = join(root, name);
  if (existsSync(target) && !options.update) { warn(`${target} exists; use --update to replace it`); return 1; }
  if (dirty.length > 0) warn(`the working tree has ${dirty.length} uncommitted file(s): the commit does not say what code this run came from`);

  const meta = buildMeta({
    now: when, commit, branch, dirty, ran: options.run, images: options.images, counts: countRows(report.rows),
    imageTag: imageTag(playwrightVersion(readFileSync(join(repo, "pnpm-lock.yaml"), "utf8"))),
    prototypeSha256: readFileSync(join(repo, "e2e/parity/prototype.sha256"), "utf8").trim(),
  });
  mkdirSync(root, { recursive: true });
  cleanLeftovers(root);
  const id = randomBytes(4).toString("hex");
  const tmp = join(root, `.tmp-${id}`);
  const old = join(root, `.old-${id}`);
  try {
    mkdirSync(tmp);
    for (const file of ["report.md", "report.json"]) copy(join(out, file), join(tmp, file));
    // Every .png file of images/ and nothing else (R6).
    if (options.images) copy(join(out, "images"), join(tmp, "images"), { recursive: true, filter: (src) => src.endsWith(".png") || statSync(src).isDirectory() });
    writeFileSync(join(tmp, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
    const replacing = existsSync(target);
    if (replacing) {
      renameSync(target, old);
      writeFileSync(join(old, ".target"), name); // so that a crash from here on can put it back
    }
    try { renameSync(tmp, target); }
    catch (error) {
      if (replacing) { rmSync(join(old, ".target")); renameSync(old, target); }
      throw error;
    }
    if (replacing) rmSync(old, { recursive: true, force: true });
  } catch (error) {
    rmSync(tmp, { recursive: true, force: true });
    warn(`nothing kept: ${error.message}`);
    return 1;
  }
  for (const folder of writeIndex(root).unreadable) warn(`left out of index.md, no readable meta.json: docs/ui-parity/${folder}`);
  const c = meta.counts;
  log(`kept docs/ui-parity/${name}`);
  log(`match ${c.match} · differs ${c.differs} · known ${c.known} · no longer a difference ${c.noLongerDifference} · not run ${c.notRun}`);
  log("next: git add docs/ui-parity");
  return 0;
}

// An earlier crash can leave `.tmp-*` (removed) or `.old-*`: the folder that `--update` set aside, with the
// name it had in `.target`. It is put back when that name is missing, and removed when it is there.
function cleanLeftovers(root) {
  for (const entry of readdirSync(root).sort()) {
    const path = join(root, entry);
    if (entry.startsWith(".tmp-")) rmSync(path, { recursive: true, force: true });
    else if (entry.startsWith(".old-")) {
      let target = null;
      try { target = readFileSync(join(path, ".target"), "utf8").trim(); }
      catch { /* no .target: nothing to put back */ }
      if (target && !existsSync(join(root, target))) {
        rmSync(join(path, ".target"));
        renameSync(path, join(root, target));
      } else rmSync(path, { recursive: true, force: true });
    }
  }
}
```
- [ ] **Step 4: Run the tests. Expected: PASS.** If "a copy that fails half way" or the `--update` test fails, fix `saveRun`, not the test.
- [ ] **Step 5: Commit:** `test(tools): keep the results of a run of the parity check (TOKI-135)`.

---

### Task 4: The command line and the script
**Files:** Modify `tools/ui-parity/save.mjs`, `package.json`.

**Interfaces:**
- Produces: `main(argv, io) -> number` where `io = { repo, git, runCheck, now, log, warn }` has defaults for the real thing; the file runs `process.exit(main(process.argv.slice(2)))` only when run directly (`process.argv[1] === fileURLToPath(import.meta.url)`).

**Acceptance Criteria:**
- [ ] `pnpm ui:save` runs the real thing; a usage error exits 2 with the usage line; the script and its test are registered.

- [ ] **Step 1: Write the failing tests of `main`:** `main(["--prune", "0"], io)` returns 2 and `io.warn` gets the usage line; `main(["--prune", "2"], io)` on a temporary `repo` with five folders returns 0 and lists three commands; `main(["--no-run"], io)` on a repo with a fake report saves it.
- [ ] **Step 2: Implement:**
```js
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = "usage: pnpm ui:save [--no-run] [--no-images] [--update]   |   pnpm ui:save --prune <n>";

export function main(argv, io = {}) {
  const repo = io.repo ?? resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const deps = {
    repo,
    git: io.git ?? ((args) => {
      const r = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr.trim()}`);
      return r.stdout;
    }),
    runCheck: io.runCheck ?? (() => spawnSync(process.execPath, ["tools/ui-parity/container.mjs", "test"], { cwd: repo, stdio: "inherit" }).status ?? 1),
    now: io.now ?? (() => new Date()),
    log: io.log ?? ((l) => console.log(l)),
    warn: io.warn ?? ((l) => console.error(l)),
  };
  let options;
  try { options = parseSaveArgs(argv); }
  catch (error) {
    if (!(error instanceof UsageError)) throw error;
    deps.warn(`${error.message}\n${USAGE}`);
    return 2;
  }
  if (options.prune !== null) return prune(join(repo, "docs/ui-parity"), options.prune, deps);
  return saveRun(options, deps);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
```
- [ ] **Step 3: Register:** in `package.json` add `"ui:save": "node tools/ui-parity/save.mjs"` after `ui:reference`, and add `tools/ui-parity/save.test.mjs` to the `node --test` list of the `test` script.
- [ ] **Step 4: Run** `node --test tools/ui-parity/save.test.mjs` and `node tools/ui-parity/save.mjs --prune 0; echo $?` (Expected: the usage line and `2`). Commit: `feat(tools): add the ui:save command (TOKI-135)`.

---

### Task 5: The README and `CLAUDE.md`
**Files:** Modify `e2e/parity/README.md`, `CLAUDE.md`.

**Acceptance Criteria:**
- [ ] R16: the README has "Keep the results"; `CLAUDE.md` has the two command rows and the `docs/ui-parity/` row.

- [ ] **Step 1: README.** Add a section "Keep the results": what `pnpm ui:save` does (runs the check, copies the report and all images into `docs/ui-parity/<date>-<commit>/` with `meta.json`, remakes `docs/ui-parity/index.md`); the options `--no-run`, `--no-images`, `--update`; `--prune <n>` prints the `git rm` commands and deletes nothing; that a tree with uncommitted changes is kept with `-dirty`; that the builder commits the folder in a pull request; and that git stores identical files once, so a run of an unchanged app adds almost nothing. Also say that `pnpm ui:save` deletes the last report of `e2e/assets/parity` before it runs the check (R2), so that a failed run leaves no report to keep by mistake, and that `--no-run` records `ran: false` and prints the age of the report but not its date in `meta.json` (decided by Thanh Truong on 2026-11-26, grilling questions 1 and 2).
- [ ] **Step 2: `CLAUDE.md`.** In "Common commands" add `pnpm ui:save [--no-run] [--no-images] [--update]` and `pnpm ui:save --prune <n>`; in "Where documents live" add `docs/ui-parity/` ("The kept runs of the UI parity check, one folder each, and `index.md`, the list made by `pnpm ui:save`").
- [ ] **Step 3: Check:** `grep -n "ui:save" CLAUDE.md e2e/parity/README.md` shows the rows; `pnpm format:check` passes (the README is formatted by Prettier, `docs/` and `CLAUDE.md` are ignored).
- [ ] **Step 4: Commit:** `docs(tools): say how to keep the results of the parity check (TOKI-135)`.

---

### Task 6: The first kept run and the checks
**Files:** Create `docs/ui-parity/index.md`, `docs/ui-parity/<date>-<commit>/` (made by the command).

**Acceptance Criteria:**
- [ ] R17: the pull request holds the first kept run, made by `pnpm ui:save` on a clean tree, and the four commands pass.

- [ ] **Step 1:** make sure the tree is clean (`git status --short` empty) and Docker runs. Run `pnpm install --frozen-lockfile` first if `node_modules` is missing.
- [ ] **Step 2: Run the command for real:** `pnpm ui:save`. Expected: the check runs in the container (about 30 s once the image is there), the command prints `kept docs/ui-parity/<date>-<commit>`, the counts `match 24 · differs 0 · known 6`, and `next: git add docs/ui-parity`; exit 0. Read `meta.json` (`dirty: false`, `ran: true`, `withImages: true`) and `index.md`.
- [ ] **Step 3: Negative checks, run for real and recorded in the pull request:** run `pnpm ui:save` again (Expected: exit 1, "exists; use --update", the folder unchanged); `pnpm ui:save --prune 1` with one folder (Expected: "nothing is older"); `pnpm ui:save --nope` (Expected: usage line, exit 2); a dirty save (touch an untracked file, run with `--no-run`, Expected: a folder ending `-dirty` and a warning; remove that folder and the file afterwards).
- [ ] **Step 4:** `git add docs/ui-parity && git commit -m "docs(ui-parity): keep the first run of the parity check (TOKI-135)"`.
- [ ] **Step 5: Verify:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `node --test tools/ui-parity/*.test.mjs tools/bundle-size/check.test.mjs apps/web/scripts/check-no-dev-pages.test.mjs`, and `pnpm exec vitest run` (the `server-db` files need `TEST_DATABASE_URL`, as for every pull request). Expected: all exit 0 except the database files.

## Risks and the riskiest step
1. **Riskiest: Task 3 and the first real run (Task 6 step 2).** `saveRun` deletes files and renames folders; every case is proved first with a temporary folder, and the real run is on a clean tree so that a mistake costs one folder, which `git status` shows.
2. **`git status --porcelain` forms.** Renames (`R  a -> b`), quoted paths and the collapsed `?? dir/` are in the tests of `dirtyFiles`; a form that is not covered gives a wrong `dirty` count, not a failure.
3. **The check needs Docker and arm64** (TOKI-109); the tests of this ticket do not.
4. **Crash between the two renames of `--update`**: covered by the `.old-*` leftover test.
