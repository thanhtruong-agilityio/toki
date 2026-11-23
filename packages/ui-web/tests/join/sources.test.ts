// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const dir = `${import.meta.dirname}/../../src/join`;
const files = readdirSync(dir).map((name) => join(dir, name));
const sources = files.filter((f) => /\.tsx?$/.test(f));
const css = files.filter((f) => f.endsWith(".css"));
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (f: string) => code(readFileSync(f, "utf8"));

describe("the join folder (R39, R42, R43)", () => {
  test("has sources to check", () => {
    expect(sources.length).toBeGreaterThanOrEqual(2);
  });

  test("holds no literal user text: no text in JSX and no text attribute (R39)", () => {
    for (const f of sources.filter((s) => s.endsWith(".tsx"))) {
      const text = read(f);
      expect(text, f).not.toMatch(/>\s*[A-Za-z][A-Za-z ,.'!?-]*<\//);
      expect(text, f).not.toMatch(/^\s+[A-Z][a-z]+( [A-Za-z]+)+[.!?]?\s*$/m);
      for (const attr of ["label", "placeholder", "aria-label", "title", "alt"])
        expect(text, f).not.toMatch(new RegExp(`\\b${attr}="[^"]*[A-Za-z]`));
    }
  });

  test("has no colour literal, no storage, no console, no address of its own (R42, R43)", () => {
    for (const f of [...sources, ...css]) {
      const text = read(f);
      expect(text, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, f).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    }
    for (const f of sources) {
      const text = read(f);
      expect(text, f).not.toMatch(
        /\b(localStorage|sessionStorage|indexedDB)\b/,
      );
      expect(text, f).not.toMatch(/\bconsole\./);
      expect(text, f).not.toMatch(/\blocation\b/);
    }
  });
});
