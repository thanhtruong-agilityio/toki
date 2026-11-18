import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseDeclarations, readCss } from "../test/css";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  exports: Record<string, string>;
};

// Table H of the app shell spec, typed in (R26). `.kbd` is TOKI-071's.
const tableH: Array<[string, string]> = [
  [
    ".mono, time, [data-timer]",
    'font-family:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace; font-variant-numeric:tabular-nums',
  ],
  [
    ".disp",
    'font-family:"Bricolage Grotesque","Be Vietnam Pro",system-ui,sans-serif; letter-spacing:-.01em',
  ],
  [".muted", "color:var(--muted)"],
  [".sm", "font-size:12.5px"],
  [".xs", "font-size:11.5px"],
  [".grow", "flex:1; min-width:0"],
  [".row", "display:flex; align-items:center; gap:8px"],
  [".ell", "white-space:nowrap; overflow:hidden; text-overflow:ellipsis"],
  [".scroll", "overflow-y:auto; overscroll-behavior:contain"],
  [
    ".title",
    'font-family:"Bricolage Grotesque",system-ui,sans-serif; font-weight:700; font-size:22px; letter-spacing:-.015em; margin:0',
  ],
];

describe("utilities.css (R26, Table H)", () => {
  const rules = readCss(resolve(root, "src/styles/utilities.css"));

  test("holds exactly the rules of Table H", () => {
    const top = rules.filter((r) => r.media === null);
    expect(top.map((r) => r.selector)).toEqual(tableH.map(([s]) => s));
    tableH.forEach(([selector, text], i) => {
      expect(top[i]!.declarations, selector).toEqual(parseDeclarations(text));
    });
    const media = rules.filter((r) => r.media !== null);
    expect(media).toHaveLength(1);
    expect(media[0]!.media).toBe("(max-width:719px)");
    expect(media[0]!.selector).toBe(".title");
    expect(media[0]!.declarations).toEqual({ "font-size": "24px" });
  });

  test("package.json exports the sheet", () => {
    expect(pkg.exports["./utilities.css"]).toBe("./src/styles/utilities.css");
  });

  test("no component imports it", () => {
    const entry = readFileSync(resolve(root, "src/index.ts"), "utf8");
    expect(entry).not.toMatch(/utilities\.css/);
  });
});
