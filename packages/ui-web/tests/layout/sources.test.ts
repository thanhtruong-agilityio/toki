import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../../src/layout`;

const dir = SRC_DIR;
const sources = readdirSync(dir).filter(
  (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
);

describe("shell sources (R2)", () => {
  test("there are sources to read", () => {
    expect(sources).toEqual(expect.arrayContaining(["AppShell.tsx"]));
  });
  test.each(sources)("%s imports no i18n, platform or client-core", (file) => {
    const text = readFileSync(resolve(dir, file), "utf8");
    expect(text).not.toMatch(/@toki\/(i18n|platform|client-core)/);
  });
});
