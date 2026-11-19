// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import * as pkg from "../../src";

const dir = `${import.meta.dirname}/../../src/sign-in`;
const files = readdirSync(dir).map((name) => join(dir, name));
const sources = files.filter(
  (f) => /\.tsx?$/.test(f) && !/\.examples\.tsx$/.test(f),
);
const css = files.filter((f) => f.endsWith(".css"));
const read = (f: string) => readFileSync(f, "utf8");

// Comments hold words and numbers that are not code.
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("the sign-in folder (R28, R34, R45)", () => {
  test("has sources to check", () => {
    expect(sources.length).toBeGreaterThanOrEqual(7);
    expect(css.length).toBeGreaterThanOrEqual(1);
  });

  test("calls no global timer and reads no system time (R45)", () => {
    for (const f of sources) {
      const text = code(read(f));
      expect(text, f).not.toMatch(/\bsetTimeout\b/);
      expect(text, f).not.toMatch(/\bsetInterval\b/);
      expect(text, f).not.toMatch(/\brequestAnimationFrame\b/);
      expect(text, f).not.toMatch(/Date\.now\(/);
      expect(text, f).not.toMatch(/new Date\(/);
      expect(text, f).not.toMatch(/performance\.now\(/);
    }
  });

  test("has no colour literal in sources or styles (R34)", () => {
    for (const f of [...sources, ...css]) {
      const text = code(read(f));
      expect(text, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, f).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    }
  });

  test("holds no literal user text: no text in JSX and no text attribute (R28)", () => {
    for (const f of sources.filter((s) => s.endsWith(".tsx"))) {
      const text = code(read(f));
      // Words right before a closing tag, or a line of capitalised words.
      expect(text, f).not.toMatch(/>\s*[A-Za-z][A-Za-z ,.'!?-]*<\//);
      expect(text, f).not.toMatch(/^\s+[A-Z][a-z]+( [A-Za-z]+)+[.!?]?\s*$/m);
      for (const attr of ["label", "placeholder", "aria-label", "title", "alt"])
        expect(text, f).not.toMatch(new RegExp(`\\b${attr}="[^"]*[A-Za-z]`));
    }
  });

  test("uses no storage, no console and no address of its own (R32, R35)", () => {
    for (const f of sources) {
      const text = code(read(f));
      expect(text, f).not.toMatch(
        /\b(localStorage|sessionStorage|indexedDB)\b/,
      );
      expect(text, f).not.toMatch(/\bconsole\./);
      expect(text, f).not.toMatch(/\blocation\b/);
    }
  });

  test("the styles use var() tokens for every colour property", () => {
    for (const f of css) {
      const text = code(read(f));
      for (const m of text.matchAll(
        /(?:^|[;{\s])(color|background|background-color|border(?:-color)?)\s*:\s*([^;}]+)/g,
      )) {
        const value = m[2]!.trim();
        expect(value, `${f}: ${m[1]}`).toMatch(/var\(--|transparent|none|^\d/);
      }
    }
  });
});

describe("the package exports (Layout)", () => {
  test.each([
    "SignInCard",
    "EmailStep",
    "CodeStep",
    "CodeField",
    "SignInTimeProvider",
    "SessionEndedModal",
  ])("exports %s", (name) => {
    expect((pkg as Record<string, unknown>)[name]).toBeDefined();
  });
});
