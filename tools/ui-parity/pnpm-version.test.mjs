import test from "node:test";
import assert from "node:assert/strict";
import { pnpmVersion } from "./pnpm-version.mjs";

test("reads the version of the packageManager field", () => {
  assert.equal(pnpmVersion("pnpm@12.21.0"), "12.21.0");
});

test("drops the hash that corepack may add", () => {
  assert.equal(pnpmVersion("pnpm@12.21.0+sha512.abcdef"), "12.21.0");
});

test("refuses another package manager", () => {
  assert.throws(() => pnpmVersion("yarn@4.0.0"), /pnpm/);
});

test("refuses a missing field", () => {
  assert.throws(() => pnpmVersion(undefined), /packageManager/);
});
