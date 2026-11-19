import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as shared from "../../src/index.js";
import { cases } from "./cases.js";

describe("exports (R1)", () => {
  it("exports every permission function and DENY_REASONS from the package entry", () => {
    const entry: Record<string, unknown> = shared;
    for (const name of Object.keys(cases)) {
      expect(typeof entry[name], name).toBe("function");
    }
    expect(entry.DENY_REASONS).toHaveLength(11);
  });
});

describe("the module stands alone (R15)", () => {
  const dir = fileURLToPath(new URL("../../src/permissions/", import.meta.url));
  const files = readdirSync(dir).filter((file) => file.endsWith(".ts"));

  it("finds the source files", () => {
    expect(files.sort()).toEqual([
      "account.ts",
      "channel.ts",
      "checks.ts",
      "conversation.ts",
      "index.ts",
      "types.ts",
    ]);
  });

  // Every import stays inside the folder: no package, no Node built-in and
  // no other file of `shared`.
  it.each(files)("%s imports only from the module", (file) => {
    const source = readFileSync(`${dir}${file}`, "utf8");
    const paths = [
      ...source.matchAll(/\bfrom\s+["']([^"']+)["']/g),
      ...source.matchAll(/\bimport\s*\(?\s*["']([^"']+)["']/g),
      ...source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']/g),
    ].map((match) => match[1]!);
    for (const path of paths) {
      expect(path, `${file} imports ${path}`).toMatch(/^\.\/[^/]+\.js$/);
    }
  });
});
