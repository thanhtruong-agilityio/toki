import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { readCss } from "../test/css";

const srcDir = resolve(import.meta.dirname, "..");
const folders = ["Menu", "Modal", "Sheet"].map((n) =>
  resolve(srcDir, "components", n),
);
const tokensCss = resolve(srcDir, "../../tokens/src/tokens.css");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = [...folders, resolve(srcDir, "internal/overlays")].flatMap(walk);
const cssFiles = files.filter((f) => f.endsWith(".css"));
// Test and examples files are excepted (R3).
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
const rules = cssFiles.flatMap((file) =>
  readCss(file).map((rule) => ({ file, ...rule })),
);

describe("the files of the overlays", () => {
  test("there are three CSS files and the sources are found", () => {
    expect(cssFiles.map((f) => f.split("/").pop()).sort()).toEqual([
      "Menu.css",
      "Modal.css",
      "Sheet.css",
    ]);
    expect(sources.length).toBeGreaterThanOrEqual(12);
    expect(tokenNames.size).toBeGreaterThan(20);
    expect(rules.length).toBeGreaterThan(15);
  });

  test("each component imports its CSS file; Sheet and Dialog import Modal.css (R25)", () => {
    const text = (path: string) => readFileSync(resolve(srcDir, path), "utf8");
    expect(text("components/Menu/Menu.tsx")).toContain('import "./Menu.css";');
    expect(text("components/Modal/Modal.tsx")).toContain(
      'import "./Modal.css";',
    );
    expect(text("components/Modal/Dialog.tsx")).toContain(
      'import "./Modal.css";',
    );
    expect(text("components/Sheet/Sheet.tsx")).toContain(
      'import "./Sheet.css";',
    );
    expect(text("components/Sheet/Sheet.tsx")).toContain(
      'import "../Modal/Modal.css";',
    );
  });
});

describe("CSS of the overlays (R26)", () => {
  test("a colour is always a var(); transparent is allowed (a)", () => {
    const literal =
      /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|color-mix\(|\b(white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|teal|navy|brown|cyan|magenta)\b/i;
    for (const rule of rules) {
      for (const [prop, value] of Object.entries(rule.declarations)) {
        if (prop === "font-family") continue;
        expect(value, `${rule.selector} ${prop}`).not.toMatch(literal);
      }
    }
  });

  test("every var() names a property of tokens.css (b)", () => {
    for (const rule of rules) {
      for (const value of Object.values(rule.declarations)) {
        for (const m of value.matchAll(/var\((--[a-z0-9-]+)/g)) {
          expect(tokenNames.has(m[1]!), `${rule.selector} uses ${m[1]}`).toBe(
            true,
          );
        }
      }
    }
  });

  test("no look, effect, accent or density selector (c)", () => {
    for (const rule of rules)
      expect(rule.selector).not.toMatch(/data-(eff|look|accent|density)/);
  });

  test("font-family only in .modal .mhd h2 (d)", () => {
    expect(
      rules
        .filter((r) => "font-family" in r.declarations)
        .map((r) => r.selector),
    ).toEqual([".modal .mhd h2"]);
  });

  test("no transition and no animation (e)", () => {
    for (const rule of rules) {
      for (const prop of Object.keys(rule.declarations))
        expect(prop, rule.selector).not.toMatch(/^(transition|animation)/);
    }
  });
});

describe("nothing is hover-only (R27)", () => {
  test("every :hover rule declares only background", () => {
    const hovers = rules.filter((r) => r.selector.includes(":hover"));
    expect(hovers.length).toBeGreaterThan(0);
    for (const rule of hovers)
      expect(Object.keys(rule.declarations), rule.selector).toEqual([
        "background",
      ]);
  });

  test("nothing is hidden", () => {
    for (const rule of rules) {
      expect(rule.declarations.opacity, rule.selector).not.toBe("0");
      expect(rule.declarations.visibility, rule.selector).not.toBe("hidden");
      expect(rule.declarations.display, rule.selector).not.toBe("none");
    }
  });

  test("no source reads title or onMouseEnter", () => {
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/\btitle=|onMouseEnter/);
    }
  });
});

describe("layers and z-order (R28)", () => {
  const z = (file: string, selector: string) =>
    rules.find((r) => r.file.endsWith(file) && r.selector === selector)
      ?.declarations["z-index"];

  test("the scrim is 20 and the menu is 30", () => {
    expect(z("Modal.css", ".scrim")).toBe("20");
    expect(z("Menu.css", ".menu")).toBe("30");
  });

  const toast = resolve(srcDir, "components/Toast/Toast.css");
  // Skipped, not failed, while TOKI-013 is not merged.
  test.skipIf(!existsSync(toast))("the toast region is 40", () => {
    const toasts = readCss(toast).find((r) => r.selector === ".toasts");
    expect(toasts?.declarations["z-index"]).toBe("40");
  });
});

describe("sources of the overlays (R3, R31)", () => {
  test("no source imports another package of the workspace", () => {
    for (const file of sources) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /@toki\/(platform|i18n|tokens|client-core|shared)/,
      );
    }
  });

  test("no source uses the notification, storage, service worker or audio API", () => {
    for (const file of sources) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /\bNotification\b|localStorage|sessionStorage|indexedDB|serviceWorker|\bnew Audio\b|AudioContext/,
      );
    }
  });
});
