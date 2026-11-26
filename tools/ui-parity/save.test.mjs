import test from "node:test";
import assert from "node:assert/strict";
import {
  UsageError,
  parseSaveArgs,
  folderName,
  countRows,
  dirtyFiles,
  buildMeta,
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
