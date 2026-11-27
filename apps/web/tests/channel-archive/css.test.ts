import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parseDeclarations, readCss } from "../support/css";

const WEB = resolve(import.meta.dirname, "../..");
const file = resolve(WEB, "src/channel-archive/archive.css");

type Row = { media: string | null; selector: string; decl: string };

// Table A of the TOKI-101 spec, typed in (R4), in the order of the table and of the file.
const table: Row[] = [
  { media: null, selector: ".dp-archive", decl: "margin-top:16px" },
  {
    media: null,
    selector: ".dp-archive .archive",
    decl: "color:var(--danger)",
  },
  {
    media: null,
    selector: ".arch-page",
    decl: "display:flex; flex-direction:column; flex:1; min-height:0",
  },
  {
    media: null,
    selector: ".arch-body",
    decl: "display:flex; flex-direction:column; flex:1; min-height:0",
  },
  {
    media: null,
    selector: ".arch-notice",
    decl: "margin:0 20px 16px; padding:12px 14px; border:1px solid var(--line); border-radius:var(--radius); background:var(--surface); color:var(--muted); text-align:center",
  },
  {
    media: "(min-width:720px)",
    selector: ':is([data-look="focus"], [data-look="classic"]) .arch-notice',
    decl: "margin:0 16px 12px",
  },
  {
    media: "(max-width:719px)",
    selector: ".arch-notice",
    decl: "margin:0 max(12px,env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px))",
  },
];

const rules = readCss(file);
const source = readFileSync(file, "utf8");

describe("archive.css holds exactly Table A (R4)", () => {
  test("the selector list, with the media of each, equals the table", () => {
    expect(rules.map((r) => `${r.media ?? ""} ${r.selector}`)).toEqual(
      table.map((r) => `${r.media ?? ""} ${r.selector}`),
    );
  });

  test.each(table.map((r) => [`${r.media ?? ""} ${r.selector}`, r] as const))(
    "%s",
    (_name, row) => {
      const rule = rules.find(
        (r) => r.selector === row.selector && r.media === row.media,
      );
      expect(rule?.declarations).toEqual(parseDeclarations(row.decl));
    },
  );

  test("no colour literal, !important, :hover or style attribute", () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    expect(source).not.toMatch(/!\s*important/);
    expect(source).not.toMatch(/:hover/);
  });

  test("every var() names a token that exists", () => {
    const tokens = readFileSync(
      resolve(WEB, "../../packages/tokens/src/tokens.css"),
      "utf8",
    );
    const used = new Set(
      [...source.matchAll(/var\(--([a-z0-9-]+)/g)].map((m) => m[1]),
    );
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) expect(tokens).toContain(`--${name}:`);
  });

  test("writes no selector of conversation.css", () => {
    for (const r of rules) {
      expect(r.selector).not.toMatch(/\.(mh|dp-leave|mrow|later-ic)\b/);
    }
  });
});
