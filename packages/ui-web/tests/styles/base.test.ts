import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseDeclarations, readCss } from "../support/css";

const SRC_URL = new URL(
  "../../src/styles/base.test.ts",
  `file://${import.meta.dirname}/`,
);

const here = dirname(fileURLToPath(SRC_URL));
const root = resolve(here, "..", "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  exports: Record<string, string>;
};

// Table J of the spec, typed in. The `body` font-family is TOKI-010's and is not here.
const tableJ: Array<[string, string]> = [
  ["html, body", "height:100%"],
  ["*", "box-sizing:border-box"],
  [
    "body",
    "background:var(--bg); color:var(--ink); font-size:14px; line-height:1.45; -webkit-font-smoothing:antialiased",
  ],
  ["button, input, select, textarea", "font:inherit; color:inherit"],
  [
    "button",
    "background:none; border:0; padding:0; cursor:pointer; text-align:left",
  ],
  ["a", "color:var(--accent-text)"],
  [".ic", "flex:none"],
  [
    ":focus-visible",
    "outline:2px solid var(--accent); outline-offset:2px; border-radius:6px",
  ],
  [
    ".sr",
    "position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0)",
  ],
];
const reduced =
  "animation-duration:.01ms!important; animation-iteration-count:1!important; transition-duration:.01ms!important";

describe("base.css (R9, Table J)", () => {
  const rules = readCss(resolve(root, "src/styles/base.css"));

  test("holds exactly the rules of Table J", () => {
    const top = rules.filter((r) => r.media === null);
    expect(top.map((r) => r.selector)).toEqual(tableJ.map(([s]) => s));
    tableJ.forEach(([selector, text], i) => {
      expect(top[i]!.declarations, selector).toEqual(parseDeclarations(text));
    });
    const media = rules.filter((r) => r.media !== null);
    expect(media).toHaveLength(1);
    expect(media[0]!.media).toBe("(prefers-reduced-motion:reduce)");
    expect(media[0]!.selector).toBe("*, *::before, *::after");
    expect(media[0]!.declarations).toEqual(parseDeclarations(reduced));
  });

  test("package.json exports the sheet and the examples beside the entry", () => {
    expect(pkg.exports["."]).toBe("./src/index.ts");
    expect(pkg.exports["./base.css"]).toBe("./src/styles/base.css");
    expect(pkg.exports["./examples"]).toBe("./src/examples.ts");
  });

  test("the package entry imports no CSS file itself", () => {
    const index = readFileSync(resolve(root, "src/index.ts"), "utf8");
    expect(index).not.toMatch(/\.css["']/);
  });
});
