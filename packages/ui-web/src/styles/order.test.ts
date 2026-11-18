import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

// R29: base.css must be the first style sheet that can reach a component. Its
// :focus-visible rule has the same specificity as Table H and the component
// classes, which win only by coming later.
const main = readFileSync(
  resolve(import.meta.dirname, "../../../../apps/web/src/main.tsx"),
  "utf8",
);
const imports = [
  ...main.matchAll(/^import\s+(?:[^"']*from\s+)?["']([^"']+)["'];?$/gm),
].map((m) => m[1]!);

const tokens = "@toki/tokens/tokens.css";
const base = "@toki/ui-web/base.css";

describe("the style imports of apps/web/src/main.tsx (R29)", () => {
  test("tokens.css then base.css are imported", () => {
    expect(imports).toContain(tokens);
    expect(imports).toContain(base);
    expect(imports.indexOf(tokens)).toBeLessThan(imports.indexOf(base));
  });

  test("the fonts sheet, when there is one, comes before them", () => {
    const fonts = imports.findIndex((source) =>
      /(^|\/)fonts\.css$/.test(source),
    );
    if (fonts !== -1) expect(fonts).toBeLessThan(imports.indexOf(tokens));
  });

  test("no import that is not a style sheet precedes one of them", () => {
    const lastStyle = Math.max(imports.indexOf(tokens), imports.indexOf(base));
    expect(lastStyle).toBeGreaterThanOrEqual(0);
    const before = imports.slice(0, lastStyle + 1);
    expect(before.filter((source) => !source.endsWith(".css"))).toEqual([]);
  });
});
