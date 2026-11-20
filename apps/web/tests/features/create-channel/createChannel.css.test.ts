import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FOLDER, folderSources } from "./support";

const css = readFileSync(join(FOLDER, "createChannel.css"), "utf8");
const tokens = readFileSync(
  join(import.meta.dirname, "../../../../../packages/tokens/src/tokens.css"),
  "utf8",
);

type Rule = { media: string | null; selector: string; decl: string[] };

// A tiny reader for a file with plain rules and one level of @media.
function parse(text: string): Rule[] {
  const rules: Rule[] = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const read = (source: string, media: string | null) => {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    for (const m of source.matchAll(re)) {
      rules.push({
        media,
        selector: m[1]!.trim().replace(/\s+/g, " "),
        decl: m[2]!
          .split(";")
          .map((d) =>
            d
              .trim()
              .replace(/\s*:\s*/, ":")
              .replace(/\s+/g, " "),
          )
          .filter(Boolean),
      });
    }
  };
  const mediaRe = /@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;
  let rest = clean;
  for (const m of clean.matchAll(mediaRe)) {
    read(m[2]!, m[1]!.trim().replace(/\s+/g, " "));
    rest = rest.replace(m[0], "");
  }
  read(rest, null);
  return rules;
}

const NARROW = "(max-width: 719px)";
// Table A of the TOKI-098 spec, typed in.
const tableA: Array<[string | null, string, string]> = [
  [
    null,
    ".ccrow",
    "display:flex; align-items:center; gap:12px; padding:10px 0 0",
  ],
  [null, ".ccrow .grow", "flex:1; min-width:0"],
  [null, ".cchint", "margin:2px 0 4px; font-size:12px; color:var(--muted)"],
  [null, ".ccpeople", "border:0; margin:0; padding:0; min-width:0"],
  [null, ".ccfoot", "display:flex; flex-direction:column; gap:8px; width:100%"],
  [null, ".ccfoot .gerr", "margin-top:0"],
  [null, ".ccbtns", "display:flex; justify-content:flex-end; gap:8px"],
  [NARROW, ".ccrow", "min-height:40px"],
];
const split = (decl: string) =>
  decl
    .split(";")
    .map((d) => d.trim().replace(/\s*:\s*/, ":"))
    .filter(Boolean)
    .sort();

describe("createChannel.css (R20)", () => {
  // The media block is read first, so the plain rules are sorted before it.
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
    // A named colour in a colour property is refused too; `transparent` and `inherit` are allowed.
    const named =
      /\b(color|background|background-color|border-color)\s*:\s*(?!var\(|transparent\b|inherit\b|currentcolor\b)[a-z]+\s*[;}]/i;
    expect(css).not.toMatch(named);
    for (const m of css.matchAll(/var\(--([a-z0-9-]+)\)/g)) {
      expect(tokens, m[1]).toContain(`--${m[1]}:`);
    }
  });

  test("no transition, no animation, no :hover", () => {
    expect(css).not.toMatch(/transition|animation|:hover/);
  });

  test("is imported by CreateChannelDialog.tsx", () => {
    const dialog = folderSources().find(
      (f) => f.name === "CreateChannelDialog.tsx",
    )!;
    expect(dialog.text).toMatch(/import\s+["']\.\/createChannel\.css["']/);
  });
});
