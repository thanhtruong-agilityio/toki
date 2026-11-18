import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceFiles } from "./source-files.js";

// R1: the mail module is reached through its index.ts only, and nodemailer is
// imported inside it only. TOKI-002's lint rule covers the first as well.
const root = new URL("../", import.meta.url).pathname;

const outside = sourceFiles(root, true)
  .map((path) => relative(root, path))
  .filter((path) => !path.startsWith("modules/mail/"))
  .map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));

describe("the mail module boundary (R1)", () => {
  it("is imported from outside through modules/mail/index.js only", () => {
    for (const file of outside) {
      const imports = [
        ...file.text.matchAll(/from\s+["']([^"']*modules\/mail[^"']*)["']/g),
      ].map((m) => m[1]);
      for (const target of imports) {
        expect(target, file.path).toMatch(/modules\/mail\/index\.js$/);
      }
    }
  });

  it("holds the only import of nodemailer", () => {
    for (const file of outside) {
      expect(file.text, file.path).not.toMatch(/["']nodemailer["']/);
    }
  });

  it("has the files of the spec's layout", () => {
    const names = readdirSync(join(root, "modules/mail"));
    for (const name of [
      "index.ts",
      "layer.ts",
      "render.ts",
      "classify.ts",
      "config.ts",
    ]) {
      expect(names).toContain(name);
    }
  });
});
