import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parseCss, parseDeclarations, readCss } from "../support/css";

const WEB = resolve(import.meta.dirname, "../..");
const file = resolve(WEB, "src/conversation/conversation.css");
const NARROW = "(max-width:719px)";

type Row = { media: string | null; selector: string; decl: string };
const C = (selector: string, decl: string): Row => ({
  media: null,
  selector,
  decl,
});
const G = (selector: string, decl: string): Row => ({
  media: NARROW,
  selector,
  decl,
});

// Table C of the TOKI-035 spec, typed in (R29), in the order of the table and of the file.
const table: Row[] = [
  C(
    ".mh",
    "display:flex; align-items:center; gap:10px; padding:14px 20px 0; min-height:56px",
  ),
  C(
    ':is([data-look="focus"], [data-look="classic"]) .mh',
    "padding:10px 16px 0; min-height:48px",
  ),
  C(".mh .back", "display:none"),
  C(
    ".mh h1",
    "margin:0; font-size:16px; font-weight:700; display:flex; align-items:center; gap:6px; min-width:0",
  ),
  C(".mh .topic", "font-size:12.5px; color:var(--muted); margin-top:1px"),
  C(".later-ic", "color:var(--accent-text)"),
  C(
    ".dp-name",
    "display:flex; align-items:center; gap:6px; font-weight:600; font-size:16px; margin-bottom:4px",
  ),
  C(".dp-topic", "color:var(--ink-2)"),
  C(".dp-empty", "text-align:center; padding:16px 0; color:var(--muted)"),
  C(".dp-actions", "display:flex; gap:8px; margin-top:8px"),
  C(
    ".mrow",
    "display:flex; align-items:center; gap:10px; padding:6px 8px; border-radius:var(--radius-sm); width:100%",
  ),
  C(
    ".mrow-main",
    "display:flex; align-items:center; gap:10px; flex:1; min-width:0",
  ),
  C(
    ".setrow",
    "display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--line)",
  ),
  C(".setrow:last-child", "border-bottom:0"),
  C(".opt", "display:flex; align-items:center; gap:10px; padding:8px 0"),
  C(".dp-leave", "margin-top:16px"),
  C(".dp-leave .leave", "color:var(--danger)"),
  G(
    ".mh",
    "padding-left:max(10px,env(safe-area-inset-left,0px)); padding-right:max(10px,env(safe-area-inset-right,0px)); padding-top:max(8px,env(safe-area-inset-top,0px)); min-height:56px",
  ),
  G(".mh .back", "display:inline-grid"),
  G(".mh .memb", "padding:0 6px"),
  G(".opt", "min-height:40px"),
];

const rules = readCss(file);

describe("conversation.css holds exactly Table C (R29)", () => {
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

  test("the file has no colour literal, no !important, no @container, no px token it should not", () => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    expect(source).not.toMatch(/!\s*important/);
    expect(source).not.toMatch(/@container/);
    expect(source).not.toMatch(/:hover/);
  });

  test("every var() names a token that exists", () => {
    const tokens = readFileSync(
      resolve(WEB, "../../packages/tokens/src/tokens.css"),
      "utf8",
    );
    const used = new Set(
      [...readFileSync(file, "utf8").matchAll(/var\(--([a-z0-9-]+)/g)].map(
        (m) => m[1],
      ),
    );
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) expect(tokens).toContain(`--${name}:`);
  });
});

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules") return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return path.endsWith(".css") ? [path] : [];
  });
}

describe("one definition of each selector (R29)", () => {
  test("no other css file defines .mrow, .mh, .dp-*, .later-ic, .setrow or .opt", () => {
    // `.dp-archive` is Table A of TOKI-101 (channel-archive/archive.css), not this ticket's.
    const own =
      /(^|[^\w-])\.(mh|mrow|mrow-main|dp-(?!archive\b)[a-z-]+|later-ic|setrow|opt)\b/;
    const others = [
      ...cssFiles(resolve(WEB, "src")),
      ...cssFiles(resolve(WEB, "../../packages/ui-web/src")),
    ].filter((p) => p !== file);
    const hits = others.filter((path) =>
      parseCss(readFileSync(path, "utf8")).some((r) => own.test(r.selector)),
    );
    expect(hits).toEqual([]);
  });
});
