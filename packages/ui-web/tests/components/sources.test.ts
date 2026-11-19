import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { readCss } from "../support/css";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../../src/components`;

const srcDir = resolve(SRC_DIR, "..");
const componentsDir = resolve(srcDir, "components");
const tokensCss = resolve(srcDir, "../../tokens/src/tokens.css");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// The folders of group 1 and 2 only; Menu, Modal and Sheet are TOKI-014's (R21).
const folders = readdirSync(componentsDir).filter(
  (name) =>
    statSync(join(componentsDir, name)).isDirectory() &&
    !["Menu", "Modal", "Sheet"].includes(name),
);
const files = folders.flatMap((f) => walk(join(componentsDir, f)));
// R6 of TOKI-012 is about its eight components. The CSS of group 2 holds
// hsl(var(--h) ...), the density size --av, its own --h and --s and one look
// selector (TOKI-013 R3, R9, R20), so it is checked by sources-group2.test.ts.
const group2 = ["Avatar", "PresenceDot", "EmptyState", "Toast"];
const cssFiles = files.filter(
  (f) =>
    f.endsWith(".css") &&
    !group2.some((name) => f.includes(`/components/${name}/`)),
);
const sources = files.filter(
  (f) =>
    /\.tsx?$/.test(f) &&
    !/\.test\.tsx?$/.test(f) &&
    !/\.examples\.tsx$/.test(f),
);

const tokenNames = new Set(
  [...readFileSync(tokensCss, "utf8").matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map(
    (m) => m[1],
  ),
);
const allRules = cssFiles.flatMap((file) =>
  readCss(file).map((rule) => ({ file, ...rule })),
);

describe("CSS of the components (R6, R7)", () => {
  test("a colour is always a var(); no literal colour (R6 a)", () => {
    const literal =
      /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|color-mix\(|\b(white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|teal|navy|brown|cyan|magenta)\b/i;
    for (const rule of allRules) {
      for (const [prop, value] of Object.entries(rule.declarations)) {
        if (prop === "content" || prop === "font-family") continue;
        expect(value, `${rule.file} ${rule.selector} ${prop}`).not.toMatch(
          literal,
        );
      }
    }
  });

  test("every var() names a property of tokens.css (R6 b)", () => {
    expect(tokenNames.size).toBeGreaterThan(20);
    for (const rule of allRules) {
      for (const value of Object.values(rule.declarations)) {
        for (const m of value.matchAll(/var\((--[a-z0-9-]+)/g)) {
          expect(tokenNames.has(m[1]!), `${rule.selector} uses ${m[1]}`).toBe(
            true,
          );
        }
      }
    }
  });

  test("no density variable and no look selector (R6 c, d)", () => {
    for (const rule of allRules) {
      expect(rule.selector).not.toMatch(/data-(eff|look|accent|density)/);
      for (const value of Object.values(rule.declarations))
        expect(value).not.toMatch(/var\(--(row|gap|av)\b/);
    }
  });

  test("font-family only in .cnt and .inp.code (R6 e)", () => {
    const withFont = allRules
      .filter((r) => "font-family" in r.declarations)
      .map((r) => r.selector);
    expect(withFont.sort()).toEqual([".cnt", ".inp.code"]);
    for (const r of allRules.filter((r) => "font-family" in r.declarations)) {
      expect(r.declarations["font-family"]).toBe('"JetBrains Mono",monospace');
    }
  });

  test("hover rules only change background, color, border-color, filter (R7)", () => {
    const hovers = allRules.filter((r) => r.selector.includes(":hover"));
    expect(hovers.length).toBeGreaterThan(0);
    for (const rule of hovers) {
      for (const prop of Object.keys(rule.declarations)) {
        expect(
          ["background", "color", "border-color", "filter"],
          `${rule.selector} ${prop}`,
        ).toContain(prop);
      }
    }
  });

  test("nothing is hidden (R7)", () => {
    for (const rule of allRules) {
      expect(rule.declarations.opacity, rule.selector).not.toBe("0");
      expect(rule.declarations.visibility, rule.selector).not.toBe("hidden");
      expect(rule.declarations.display, rule.selector).not.toBe("none");
    }
  });

  test("outline is set to 0 only on .inp and .field input (R21)", () => {
    const outlines = allRules
      .filter((r) => "outline" in r.declarations)
      .map((r) => [r.selector, r.declarations.outline]);
    expect(outlines.sort()).toEqual([
      [".field input", "0"],
      [".inp", "0"],
    ]);
  });
});

describe("sources of the components (R3, R7, R21, R28)", () => {
  test("no source sets tabindex, reads title or onMouseEnter", () => {
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/tabindex|onMouseEnter/i);
      expect(text, file).not.toMatch(/\btitle\s*=/);
    }
  });

  test("no source imports another package of the workspace (R3, R28)", () => {
    for (const file of [
      ...sources,
      ...walk(resolve(srcDir, "styles")).filter(
        (f) => !/\.test\.tsx?$/.test(f),
      ),
      resolve(srcDir, "internal/cx.ts"),
    ]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /@toki\/(platform|i18n|tokens|client-core|shared)/,
      );
    }
  });
});
