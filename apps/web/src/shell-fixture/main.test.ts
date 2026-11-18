import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

// R32: the fixture's entry imports the four style sheets before every non-CSS
// import (TOKI-012 R29), links no fonts.css yet (TOKI-010 is not on main), and
// the page is a second entry that only the development server serves.
const dir = import.meta.dirname;
const main = readFileSync(resolve(dir, "main.tsx"), "utf8");
const imports = [
  ...main.matchAll(/^import\s+(?:[^"']*from\s+)?["']([^"']+)["'];?$/gm),
].map((m) => m[1]!);

describe("the shell fixture entry (R32)", () => {
  test("imports tokens, base, app and utilities first, in this order", () => {
    expect(imports.slice(0, 4)).toEqual([
      "@toki/tokens/tokens.css",
      "@toki/ui-web/base.css",
      "../app.css",
      "@toki/ui-web/utilities.css",
    ]);
    expect(imports.slice(4).some((source) => source.endsWith(".css"))).toBe(
      false,
    );
  });

  test("calls applyAppearance from the address and sets no storage", () => {
    expect(main).toContain("applyAppearance");
    expect(main).toContain('params.get("look")');
    expect(main).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });

  test("the page loads the entry and links no style sheet", () => {
    const html = readFileSync(resolve(dir, "../../shell-fixture.html"), "utf8");
    expect(html).toContain('src="/src/shell-fixture/main.tsx"');
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
  });
});
