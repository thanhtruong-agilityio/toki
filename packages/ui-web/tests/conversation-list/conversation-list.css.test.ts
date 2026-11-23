import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parseDeclarations, readCss } from "../support/css";

const SRC_DIR = `${import.meta.dirname}/../../src/conversation-list`;
const file = resolve(SRC_DIR, "conversation-list.css");
const tokensCss = resolve(SRC_DIR, "../../../tokens/src/tokens.css");

const WIDE = "(min-width:720px)";
const NARROW = "(max-width:719px)";
const HOVER = "(min-width:720px)and(hover:hover)and(pointer:fine)";

type Row = { media: string | null; selector: string; decl: string };
const C = (selector: string, decl: string): Row => ({
  media: null,
  selector,
  decl,
});
const D = (selector: string, decl: string): Row => ({
  media: WIDE,
  selector,
  decl,
});
const G = (selector: string, decl: string): Row => ({
  media: NARROW,
  selector,
  decl,
});
const H = (selector: string, decl: string): Row => ({
  media: HOVER,
  selector,
  decl,
});

// Table A of the conversation list spec, typed in (R12), in the order of the table and of the
// file. The Calm rule that hid `.cfilter .field` is not in the table and not in the file.
const table: Row[] = [
  C(
    ".ch",
    "display:flex; align-items:center; gap:8px; padding:6px 14px 6px 20px",
  ),
  C(
    ".ch h2",
    "margin:0; font-size:12px; font-weight:600; color:var(--muted); letter-spacing:.05em; text-transform:uppercase; flex:1",
  ),
  D('[data-eff="focus"] .ch', "padding:12px 14px 6px"),
  C(
    ".cfilter",
    "padding:2px 16px 8px; display:flex; flex-direction:column; gap:8px",
  ),
  C(".cfilter .chip", "height:26px"),
  C(
    ".clist",
    "flex:1; overflow-y:auto; padding:0 12px 12px; overscroll-behavior:contain; display:flex; flex-direction:column; min-height:0",
  ),
  C(".clist > .cgroup, .clist > .cr", "flex:none"),
  C(".sech", "display:flex; align-items:center; gap:2px"),
  C(
    ".sec",
    "display:flex; align-items:center; gap:4px; flex:1; min-width:0; padding:10px 8px 4px; font-size:12px; font-weight:600; color:var(--muted); letter-spacing:.04em; text-transform:uppercase; text-align:left",
  ),
  C(".sec:hover", "color:var(--ink)"),
  C(".sec .ic", "width:14px; height:14px; transition:transform .15s"),
  C(".sec.fold .ic", "transform:rotate(-90deg)"),
  C(".sec .sec-count", "margin-left:auto"),
  C(
    ".cr",
    "display:flex; align-items:center; gap:10px; width:100%; min-height:var(--row); padding:3px 10px; border-radius:var(--radius-sm); color:var(--ink-2); transition:background .15s; position:relative; text-decoration:none",
  ),
  C(".cr:hover", "background:var(--hover)"),
  C(
    '.cr[aria-current="page"]',
    "background:var(--accent-soft); color:var(--accent-text)",
  ),
  C(
    ".cr .gl",
    "width:24px; height:24px; display:grid; place-items:center; color:var(--muted); flex:none",
  ),
  C('.cr[aria-current="page"] .gl', "color:var(--accent-text)"),
  C(
    ".cr .nm",
    "flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis",
  ),
  C(".cr.un .nm", "font-weight:700; color:var(--ink)"),
  C('.cr[aria-current="page"].un .nm', "color:var(--accent-text)"),
  C(".cr.mutec .nm", "color:var(--muted)"),
  C(
    ".cr .star",
    "display:grid; place-items:center; width:14px; height:14px; color:var(--muted); flex:none",
  ),
  C('.cr[aria-current="page"] .star', "color:var(--accent-text)"),
  C(".cr .av", "--s:24px"),
  C(".cr .pdw", "position:relative; display:inline-grid; flex:none"),
  C(
    ".cr .pdw .pd",
    "position:absolute; right:-3px; bottom:-3px; width:10px; height:10px",
  ),
  C(".cr.browse", "color:var(--muted); margin-top:6px"),
  C(".cr.browse .nm", "font-weight:500"),
  D('[data-eff="calm"] .ch', "padding:8px 14px 4px 20px"),
  D('[data-eff="calm"] .cfilter', "padding-bottom:4px"),
  D('[data-eff="calm"] .cr', "min-height:32px; padding:2px 10px"),
  D('[data-eff="calm"] .sec', "padding:8px 8px 2px"),
  G(
    ".ch",
    "padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)); padding-top:max(14px,env(safe-area-inset-top,0px))",
  ),
  G(
    ".cfilter",
    "padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px))",
  ),
  G(
    ".clist",
    "padding-left:max(8px,env(safe-area-inset-left,0px)); padding-right:max(8px,env(safe-area-inset-right,0px))",
  ),
  G(".cr", "min-height:52px; padding:6px 10px"),
  G(".sec", "min-height:40px"),
  H(".sech .sec-add", "opacity:0"),
  H(
    ".sech:hover .sec-add, .sech:focus-within .sec-add, .sech .sec-add:focus-visible",
    "opacity:1",
  ),
];

const rules = readCss(file);
const text = readFileSync(file, "utf8");

describe("conversation-list.css (R12, Table A)", () => {
  test("holds exactly the rows typed in, in order, and no other rule", () => {
    expect(rules.map((r) => [r.media, r.selector])).toEqual(
      table.map((t) => [t.media, t.selector]),
    );
  });

  test.each(table.map((t, i) => [i, t] as const))(
    "row %i declares exactly what the table says",
    (i, row) => {
      expect(rules[i]!.declarations, row.selector).toEqual(
        parseDeclarations(row.decl),
      );
    },
  );

  test("only the three media conditions, no @container, no !important", () => {
    const used = new Set(rules.map((r) => r.media).filter(Boolean));
    expect([...used].sort()).toEqual([WIDE, NARROW, HOVER].sort());
    expect(text).not.toMatch(/@container/);
    expect(text).not.toMatch(/!\s*important/);
    const atRules = [...text.matchAll(/@([a-z-]+)/g)].map((m) => m[1]);
    expect(new Set(atRules)).toEqual(new Set(["media"]));
  });

  test("the Calm rule that hid the search field is not there", () => {
    expect(text).not.toMatch(/\.cfilter\s+\.field/);
  });
});

describe("the '+' is never hidden (R13)", () => {
  test("it is faded only on a hovering pointer and never display:none or visibility:hidden", () => {
    for (const r of rules) {
      expect(r.declarations.display, r.selector).not.toBe("none");
      expect(r.declarations.visibility, r.selector).toBeUndefined();
    }
    const fade = rules.filter((r) => r.declarations.opacity !== undefined);
    expect(fade.map((r) => r.media)).toEqual([HOVER, HOVER]);
  });

  test("every other :hover rule changes only background or color", () => {
    const hovers = rules.filter(
      (r) => r.selector.includes(":hover") && !r.selector.includes("sec-add"),
    );
    expect(hovers.length).toBeGreaterThan(0);
    for (const r of hovers)
      expect(
        Object.keys(r.declarations).every((p) =>
          ["background", "color"].includes(p),
        ),
        r.selector,
      ).toBe(true);
  });
});

describe("conversation-list.css uses the design system's names (R12)", () => {
  const tokenNames = new Set(
    [
      ...readFileSync(tokensCss, "utf8").matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm),
    ].map((m) => m[1]),
  );

  test("every var() names a token", () => {
    const found = [...text.matchAll(/var\(\s*(--[a-z0-9-]+)/g)];
    expect(found.length).toBeGreaterThan(0);
    for (const m of found) expect(tokenNames.has(m[1]!), m[1]).toBe(true);
  });

  test("no colour literal", () => {
    const literal =
      /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|color-mix\(|\b(white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|teal|navy|brown|cyan|magenta)\b/i;
    for (const r of rules)
      for (const [prop, value] of Object.entries(r.declarations))
        expect(value, `${r.selector} ${prop}`).not.toMatch(literal);
  });
});
