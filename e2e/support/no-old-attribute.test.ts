import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// TOKI-143 R8: no code reads the attribute that carried a look and a scheme together. The word is
// built from two parts, so that this file does not contain it and does not match itself.
const root = resolve(import.meta.dirname, "../..");
const old = ["data", "eff"].join("-");

const SKIPPED = /^(docs\/|node_modules\/|.*\/dist\/)/;
const BINARY = /\.(png|jpg|jpeg|gif|webp|woff2?|ico|pdf|sha256)$/;

describe(`no file outside docs/ names the old attribute (TOKI-143 R8)`, () => {
  const files = execFileSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => f && !SKIPPED.test(f) && !BINARY.test(f));

  it("scans the tracked files of the repository", () => {
    expect(files.length).toBeGreaterThan(200);
    expect(files).toContain("packages/tokens/src/tokens.css");
  });

  it("finds the attribute in none of them", () => {
    const found = files.filter((f) => {
      try {
        return readFileSync(resolve(root, f), "utf8").includes(old);
      } catch {
        return false;
      }
    });
    expect(found).toEqual([]);
  });
});
