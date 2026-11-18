import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../src`;

const root = join(SRC_DIR, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  exports: Record<string, string>;
  dependencies?: unknown;
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : [path];
  });
}

describe("package.json", () => {
  test("has exactly the two entry points of R3", () => {
    expect(pkg.exports).toEqual({
      ".": "./src/index.ts",
      "./web": "./src/web/index.ts",
    });
  });

  test("has no dependencies entry (R25)", () => {
    expect(pkg.dependencies).toBeUndefined();
  });

  test("no file imports @toki/i18n (R25)", () => {
    const own = join(SRC_DIR, "package.test.ts");
    const offenders = sources(join(root, "src"))
      .filter((file) => file !== own)
      .filter((file) => readFileSync(file, "utf8").includes("@toki/i18n"));
    expect(offenders).toEqual([]);
  });
});
