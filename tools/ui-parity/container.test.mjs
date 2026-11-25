import test from "node:test";
import assert from "node:assert/strict";
import { playwrightVersion, imageTag, dockerArgs } from "./container.mjs";

const lock = `      '@playwright/test':\n        specifier: 1.65.1\n        version: 1.65.1\n`;

test("reads the version from the lockfile", () => {
  assert.equal(playwrightVersion(lock), "1.65.1");
});

test("throws when the lockfile has no entry", () => {
  assert.throws(() => playwrightVersion("x"), /@playwright\/test/);
});

test("tag", () => {
  assert.equal(
    imageTag("1.65.1"),
    "mcr.microsoft.com/playwright:v1.65.1-noble",
  );
});

test("docker args mount the repo read-only, pass the user and force arm64", () => {
  const a = dockerArgs({
    repo: "/r",
    out: "/o",
    ref: "/f",
    cache: "/c",
    uid: 501,
    gid: 20,
    tag: "img",
    mode: "test",
    env: {},
  });
  assert.ok(a.includes("--user") && a.includes("501:20"));
  assert.ok(a.join(" ").includes("--platform linux/arm64"));
  assert.ok(
    a.includes("/r:/repo:ro") && a.includes("/o:/out") && a.includes("/f:/ref"),
  );
  assert.ok(a.includes("TOKI_PARITY_CONTAINER=1"));
  // The pnpm store is a folder of the user (a named volume would belong to root, and the container
  // runs as the user).
  assert.ok(a.includes("/c:/pnpm-store"));
  assert.ok(!a.some((x) => x.startsWith("toki-parity-pnpm-store")));
});
