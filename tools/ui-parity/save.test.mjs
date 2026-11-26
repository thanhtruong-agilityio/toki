import test from "node:test";
import assert from "node:assert/strict";
import { UsageError, parseSaveArgs, folderName } from "./save.mjs";

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
