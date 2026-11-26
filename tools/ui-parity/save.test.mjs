import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  UsageError,
  parseSaveArgs,
  folderName,
  countRows,
  dirtyFiles,
  buildMeta,
  renderIndex,
  listRuns,
  writeIndex,
  pruneLines,
} from "./save.mjs";

test("parseSaveArgs: defaults run and keep the images", () => {
  assert.deepEqual(parseSaveArgs([]), {
    run: true,
    images: true,
    update: false,
    prune: null,
  });
});

test("parseSaveArgs: the three options", () => {
  assert.deepEqual(parseSaveArgs(["--no-run", "--no-images", "--update"]), {
    run: false,
    images: false,
    update: true,
    prune: null,
  });
});

test("parseSaveArgs: --prune alone takes a whole number of at least 1", () => {
  assert.deepEqual(parseSaveArgs(["--prune", "3"]).prune, 3);
  for (const bad of [
    ["--prune"],
    ["--prune", "0"],
    ["--prune", "-1"],
    ["--prune", "x"],
    ["--prune", "2.5"],
  ]) {
    assert.throws(() => parseSaveArgs(bad), UsageError, bad.join(" "));
  }
});

test("parseSaveArgs: --prune cannot be combined", () => {
  for (const other of ["--no-run", "--no-images", "--update"]) {
    assert.throws(
      () => parseSaveArgs(["--prune", "2", other]),
      /another option/,
    );
  }
});

test("parseSaveArgs: an unknown option or a positional argument is refused", () => {
  assert.throws(() => parseSaveArgs(["--force"]), /unknown argument --force/);
  assert.throws(() => parseSaveArgs(["admin"]), /unknown argument admin/);
});

test("folderName: UTC date and 7 characters of the commit; -dirty when dirty", () => {
  const sha = "b0a772df1234567890abcdef1234567890abcdef";
  assert.equal(
    folderName("2026-11-26T23:59:59.000Z", sha, false),
    "2026-11-26-b0a772d",
  );
  assert.equal(
    folderName("2026-11-26T23:59:59.000Z", sha, true),
    "2026-11-26-b0a772d-dirty",
  );
});

test("countRows: counts the five statuses", () => {
  const rows = [
    "match",
    "match",
    "differs",
    "known",
    "stale-known",
    "not-run",
    "not-run",
  ].map((status) => ({ status }));
  assert.deepEqual(countRows(rows), {
    match: 2,
    differs: 1,
    known: 1,
    noLongerDifference: 1,
    notRun: 2,
  });
});

test("dirtyFiles: lists changed paths and leaves out docs/ui-parity", () => {
  const porcelain = [
    " M tools/a.mjs",
    "?? new.txt",
    "A  docs/ui-parity/index.md",
    "R  old.txt -> renamed.txt",
    "?? docs/ui-parity/2026-11-26-abc1234/",
  ].join("\n");
  assert.deepEqual(dirtyFiles(porcelain), [
    "tools/a.mjs",
    "new.txt",
    "old.txt",
    "renamed.txt",
  ]);
});

test("dirtyFiles: nothing for an empty status or only kept runs", () => {
  assert.deepEqual(dirtyFiles(""), []);
  assert.deepEqual(
    dirtyFiles("?? docs/ui-parity/x/\n M docs/ui-parity/index.md\n"),
    [],
  );
});

test("dirtyFiles: a quoted path loses its quotes", () => {
  assert.deepEqual(dirtyFiles('?? "a b.txt"'), ["a b.txt"]);
});

test("buildMeta: the keys of R7 and no person", () => {
  const counts = {
    match: 24,
    differs: 0,
    known: 6,
    noLongerDifference: 0,
    notRun: 0,
  };
  const meta = buildMeta({
    now: new Date("2026-11-26T08:03:25.000Z"),
    commit: "b".repeat(40),
    branch: "main",
    dirty: [],
    ran: true,
    images: true,
    counts,
    imageTag: "mcr.microsoft.com/playwright:v1.65.1-noble",
    prototypeSha256: "8afc",
  });
  assert.deepEqual(meta, {
    date: "2026-11-26T08:03:25.000Z",
    commit: "b".repeat(40),
    branch: "main",
    dirty: false,
    dirtyFiles: 0,
    ran: true,
    withImages: true,
    counts,
    imageTag: "mcr.microsoft.com/playwright:v1.65.1-noble",
    prototypeSha256: "8afc",
  });
});

test("buildMeta: a dirty tree is marked with the number of files", () => {
  const meta = buildMeta({
    now: new Date(0),
    commit: "a".repeat(40),
    branch: "HEAD",
    dirty: ["x", "y"],
    ran: false,
    images: false,
    counts: {},
    imageTag: "t",
    prototypeSha256: "h",
  });
  assert.equal(meta.dirty, true);
  assert.equal(meta.dirtyFiles, 2);
  assert.equal(meta.withImages, false);
  assert.equal(meta.ran, false);
});

const meta = (date, c = {}) => ({
  date,
  commit: "c".repeat(40),
  branch: "main",
  dirty: false,
  dirtyFiles: 0,
  ran: true,
  withImages: true,
  counts: {
    match: 24,
    differs: 0,
    known: 6,
    noLongerDifference: 0,
    notRun: 0,
    ...c,
  },
  imageTag: "t",
  prototypeSha256: "h",
});

test("renderIndex: a heading, a sentence and a table, newest first", () => {
  const md = renderIndex([
    { folder: "2026-11-24-aaaaaaa", meta: meta("2026-11-24T10:00:00.000Z") },
    {
      folder: "2026-11-26-bbbbbbb-dirty",
      meta: {
        ...meta("2026-11-26T09:00:00.000Z"),
        dirty: true,
        dirtyFiles: 3,
        branch: "feat/x",
        commit: "b".repeat(40),
      },
    },
  ]);
  const lines = md.split("\n").filter((l) => l.startsWith("|"));
  assert.equal(
    lines[0],
    "| Date (UTC) | Commit | Branch | Tree | Match | Differs | Known | No longer | Not run |",
  );
  assert.match(
    lines[2],
    /^\| 2026-11-26 \| \[bbbbbbb\]\(2026-11-26-bbbbbbb-dirty\/report\.md\) \| feat\/x \| dirty \| 24 \| 0 \| 6 \| 0 \| 0 \|$/,
  );
  assert.match(
    lines[3],
    /^\| 2026-11-24 \| \[ccccccc\]\(2026-11-24-aaaaaaa\/report\.md\) \| main \| clean \|/,
  );
});

test("renderIndex: the same date is ordered by folder name, and the text is stable", () => {
  const a = {
    folder: "2026-11-26-aaaaaaa",
    meta: meta("2026-11-26T10:00:00.000Z"),
  };
  const b = {
    folder: "2026-11-26-bbbbbbb",
    meta: meta("2026-11-26T10:00:00.000Z"),
  };
  assert.equal(renderIndex([a, b]), renderIndex([b, a]));
  const md = renderIndex([a, b]);
  assert.ok(md.indexOf("bbbbbbb") < md.indexOf("aaaaaaa"));
});

test("renderIndex: a pipe in a branch name does not break the table", () => {
  const md = renderIndex([
    {
      folder: "2026-11-26-aaaaaaa",
      meta: { ...meta("2026-11-26T10:00:00.000Z"), branch: "a|b" },
    },
  ]);
  assert.ok(md.includes("a\\|b"));
});

test("renderIndex: no kept run gives the heading and an empty table", () => {
  assert.match(renderIndex([]), /\| Date \(UTC\) \|/);
});

const tmpRoot = () => mkdtempSync(join(tmpdir(), "ui-save-root-"));

function keep(root, folder, m) {
  mkdirSync(join(root, folder), { recursive: true });
  writeFileSync(join(root, folder, "meta.json"), JSON.stringify(m));
}

function five() {
  const root = tmpRoot();
  for (let d = 21; d <= 25; d += 1) {
    keep(
      root,
      `2026-11-${d}-aaaaaa${d % 10}`,
      meta(`2026-11-${d}T10:00:00.000Z`),
    );
  }
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
  assert.deepEqual(
    runs.map((r) => r.folder),
    ["2026-11-24-aaaaaaa", "2026-11-26-bbbbbbb"],
  );
  assert.deepEqual(unreadable, ["2026-11-25-ccccccc", "2026-11-25-ddddddd"]);
});

test("listRuns: a missing root is no run and no error", () => {
  assert.deepEqual(listRuns(join(tmpRoot(), "nope")), {
    runs: [],
    unreadable: [],
  });
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
  assert.deepEqual(r.remove, [
    "2026-11-23-aaaaaa3",
    "2026-11-22-aaaaaa2",
    "2026-11-21-aaaaaa1",
  ]);
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
