import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FEATURES } from "./support";

const css = readFileSync(join(FEATURES, "rows.css"), "utf8");
const tokens = readFileSync(
  join(import.meta.dirname, "../../../../packages/tokens/src/tokens.css"),
  "utf8",
);

type Rule = { media: string | null; selector: string; decl: string[] };

function parse(text: string): Rule[] {
  const rules: Rule[] = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const read = (source: string, media: string | null) => {
    for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      rules.push({
        media,
        selector: m[1]!.trim().replace(/\s+/g, " "),
        decl: m[2]!
          .split(";")
          .map((d) =>
            d
              .trim()
              .replace(/\s+/g, ""),
          )
          .filter(Boolean),
      });
    }
  };
  let rest = clean;
  for (const m of clean.matchAll(
    /@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g,
  )) {
    read(m[2]!, m[1]!.trim().replace(/\s+/g, " "));
    rest = rest.replace(m[0], "");
  }
  read(rest, null);
  return rules;
}

const NARROW = "(max-width: 719px)";
// Table A of the TOKI-034 spec, typed in.
const tableA: Array<[string | null, string, string]> = [
  [
    null,
    ".prow",
    "display:flex; align-items:center; gap:10px; padding:6px 8px; border-radius:var(--radius-sm); width:100%; text-align:left",
  ],
  [null, ".prow:hover", "background:var(--hover)"],
  [null, '.prow[aria-pressed="true"]', "background:var(--accent-soft)"],
  [
    null,
    ".prow .gl",
    "width:18px; display:grid; place-items:center; color:var(--muted); flex:none",
  ],
  [null, ".prow .sub", "display:block"],
  [
    null,
    ".mlist",
    "margin-top:8px; max-height:360px; overflow:auto; overscroll-behavior:contain",
  ],
  [null, ".mlist.people", "max-height:min(320px,40vh)"],
  [
    null,
    ".mlist.is-empty",
    "display:flex; flex-direction:column; height:240px",
  ],
  [null, ".mlist ul", "list-style:none; margin:0; padding:0"],
  [
    null,
    ".field.pk",
    "height:auto; min-height:36px; flex-wrap:wrap; gap:6px; padding:4px 10px",
  ],
  [null, ".field.pk input", "min-width:96px"],
  [NARROW, ".prow", "min-height:40px"],
  [NARROW, ".field.pk", "min-height:40px"],
];
const split = (decl: string) =>
  decl
    .split(";")
    .map((d) => d.replace(/\s+/g, ""))
    .filter(Boolean)
    .sort();

describe("rows.css (TOKI-034 R26, Table A)", () => {
  const rules = parse(css).sort(
    (a, b) => Number(a.media !== null) - Number(b.media !== null),
  );

  test("holds exactly the rules of Table A, value for value", () => {
    expect(rules.map((r) => [r.media, r.selector, [...r.decl].sort()])).toEqual(
      tableA.map(([media, selector, decl]) => [media, selector, split(decl)]),
    );
  });

  test("every colour is a variable and every variable is a token", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|color-mix\(/);
    const named =
      /\b(color|background|background-color|border-color)\s*:\s*(?!var\(|transparent\b|inherit\b|currentcolor\b)[a-z]+\s*[;}]/i;
    expect(css).not.toMatch(named);
    for (const m of css.matchAll(/var\(--([a-z0-9-]+)\)/g)) {
      expect(tokens, m[1]).toContain(`--${m[1]}:`);
    }
  });

  test("no look selector, no transition, no animation; a :hover rule sets only background", () => {
    expect(css).not.toMatch(/data-eff|data-look|data-accent|data-density/);
    expect(css).not.toMatch(/transition|animation/);
    for (const rule of rules.filter((r) => r.selector.includes(":hover"))) {
      expect(rule.decl.every((d) => d.startsWith("background:"))).toBe(true);
    }
  });

  test("uses prow and not mrow (R26)", () => {
    expect(css).not.toContain("mrow");
  });
});
