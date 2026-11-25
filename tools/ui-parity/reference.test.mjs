import test from "node:test";
import assert from "node:assert/strict";
import { parseReferenceArgs } from "./container.mjs";

test("--all and --update", () => {
  assert.deepEqual(parseReferenceArgs(["--all", "--update"]), {
    all: true,
    ids: [],
    update: true,
  });
});

test("one screen id", () => {
  assert.deepEqual(parseReferenceArgs(["admin"]), {
    all: false,
    ids: ["admin"],
    update: false,
  });
});

test("several ids and --update in any place", () => {
  assert.deepEqual(parseReferenceArgs(["--update", "admin", "home"]), {
    all: false,
    ids: ["admin", "home"],
    update: true,
  });
});

test("without an id or --all it says what to give", () => {
  assert.throws(() => parseReferenceArgs([]), /give a screen id or --all/);
  assert.throws(
    () => parseReferenceArgs(["--update"]),
    /give a screen id or --all/,
  );
});

test("an unknown option is refused", () => {
  assert.throws(
    () => parseReferenceArgs(["--force", "admin"]),
    /unknown option --force/,
  );
});
