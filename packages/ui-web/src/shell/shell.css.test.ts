import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parseDeclarations, readCss } from "../test/css";

const file = resolve(import.meta.dirname, "shell.css");
const tokensCss = resolve(
  import.meta.dirname,
  "../../../tokens/src/tokens.css",
);

const WIDE = "(min-width:720px)";
const NARROW = "(max-width:719px)";
const OVERLAY = "(min-width:720px)and(max-width:1099px)";
const BESIDE = "(min-width:956px)and(max-width:1099px)";
const MONO = '"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace';

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
const O = (selector: string, decl: string): Row => ({
  media: OVERLAY,
  selector,
  decl,
});
const B = (selector: string, decl: string): Row => ({
  media: BESIDE,
  selector,
  decl,
});
const G = (selector: string, decl: string): Row => ({
  media: NARROW,
  selector,
  decl,
});

// Tables C to G of the app shell spec, typed in (R16), in the order of the
// file: Tables C, D, E, Table F (Focus, the overlay, the toast anchor), G. The
// keyframes of
// Table G are read by postcss as a rule whose "media" is the animation name.
const tables: Row[] = [
  // Table C
  C(
    ".app",
    "position:fixed; inset:0; display:grid; background:var(--bg); overflow:clip; grid-template-rows:minmax(0,1fr)",
  ),
  C(".app > *", "min-width:0; min-height:0"),
  C(".sidebar", "min-height:0; min-width:0"),
  C(
    ".main",
    "grid-area:main; display:flex; flex-direction:column; position:relative; background:var(--surface); min-height:0; min-width:0; overflow:hidden",
  ),
  C(
    ".convs",
    "grid-area:convs; display:flex; flex-direction:column; min-height:0",
  ),
  C(
    ".side",
    "grid-area:side; display:flex; flex-direction:column; width:var(--shell-panel); background:var(--surface); min-height:0",
  ),
  C(".toast-anchor", "grid-area:main; pointer-events:none; visibility:hidden"),
  C(
    ".sh",
    "display:flex; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid var(--line); min-height:52px",
  ),
  C(".sh h2", "margin:0; font-size:15px; font-weight:700; flex:1"),
  C(
    ".sb",
    "padding:14px 16px; overflow-y:auto; flex:1; min-height:0; display:flex; flex-direction:column",
  ),
  C(
    ".sb h3",
    "font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:18px 0 8px; font-weight:600",
  ),
  C(".sb h3:first-child", "margin-top:0"),
  C(
    ".sechead",
    "display:flex; align-items:center; gap:12px; padding:18px 24px 10px; flex-wrap:wrap",
  ),
  C(".sechead .title", "flex:1; display:flex; align-items:center; gap:10px"),
  C(
    ".secbody",
    "flex:1; min-height:0; overflow-y:auto; padding:0 24px 24px; display:flex; flex-direction:column",
  ),
  C(
    ".toolbar",
    "display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:0 24px 12px",
  ),
  C(
    ".tabs",
    "display:flex; gap:2px; padding:6px 16px 0; border-bottom:1px solid var(--line); overflow-x:auto; scrollbar-width:none",
  ),
  C(
    ".tab",
    "padding:8px 12px; font-weight:500; color:var(--muted); border-bottom:2px solid transparent; margin-bottom:-1px; white-space:nowrap; display:flex; align-items:center; gap:6px; transition:color .15s",
  ),
  C(".tab:hover", "color:var(--ink)"),
  C(
    '.tab[aria-selected="true"]',
    "color:var(--ink); border-color:var(--accent); font-weight:600",
  ),
  C(".ws", "display:flex; align-items:center; gap:10px; padding:4px 8px 10px"),
  C(
    ".ws .wsl",
    'width:34px; height:34px; border-radius:10px; background:var(--accent); color:var(--on-accent); display:grid; place-items:center; font-family:"Bricolage Grotesque",sans-serif; font-weight:700; font-size:16px',
  ),
  C(
    ".ws .wsn",
    'font-family:"Bricolage Grotesque",sans-serif; font-weight:700; font-size:17px; letter-spacing:-.01em; line-height:1.1',
  ),
  C(".ws .wss", "font-size:11.5px; color:var(--muted)"),
  C(
    ".srch",
    "display:flex; align-items:center; gap:8px; height:36px; padding:0 10px; border-radius:var(--radius-sm); background:var(--surface); border:1px solid var(--line); color:var(--muted); margin-bottom:8px; width:100%; transition:border-color .15s",
  ),
  C(".srch:hover", "border-color:var(--muted)"),
  C(
    ".srch .kbd",
    `margin-left:auto; font-family:${MONO}; font-variant-numeric:tabular-nums; font-size:11px; border:1px solid var(--line); border-radius:5px; padding:0 5px; background:var(--surface-2)`,
  ),
  C(
    ".nav-items",
    "display:flex; flex-direction:column; gap:1px; flex:0 1 auto; min-height:0; overflow-y:auto",
  ),
  C(
    ".ni",
    "flex:none; display:flex; align-items:center; gap:10px; height:var(--row); padding:0 10px; border-radius:var(--radius-sm); color:var(--ink-2); font-weight:500; width:100%; transition:background .15s,color .15s; position:relative; text-decoration:none",
  ),
  C(".ni:hover", "background:var(--hover); color:var(--ink)"),
  C(
    '.ni[aria-current="page"]',
    "background:var(--accent-soft); color:var(--accent-text); font-weight:600",
  ),
  C(".ni .cnt", "margin-left:auto"),
  C(".ni .lb", "white-space:nowrap"),
  C(".nav-tabs", "display:none"),
  C(".usercard", "grid-area:user; padding:8px 12px 12px"),
  C(
    ".ucard",
    "display:flex; align-items:center; gap:10px; padding:8px; border-radius:var(--radius-sm); width:100%; transition:background .15s",
  ),
  C(".ucard:hover", "background:var(--hover)"),
  C(".ucard .un", "font-weight:600; line-height:1.2; display:block"),
  C(".ucard .us", "font-size:12px; color:var(--muted); display:block"),
  C(".ucard .uct", "flex:1; min-width:0"),
  C(".app", "--shell-panel:360px; --shell-convs-min:240px"),
  C(
    ".convs:focus-visible, .main:focus-visible, .side:focus-visible",
    "outline:none",
  ),
  // Table D
  D(
    ".app",
    'grid-template-columns:auto minmax(0,1fr) auto; grid-template-areas:"sidebar main side"',
  ),
  D(".sidebar", "grid-area:sidebar; display:grid"),
  D(".sh .back-side", "display:none"),
  // Table E (Calm)
  D(
    '[data-eff="calm"] .sidebar',
    'width:272px; grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(0,1fr) auto; grid-template-areas:"nav" "user"',
  ),
  D(
    '[data-eff="calm"] .sidebar[data-has-list]',
    'grid-template-rows:minmax(0,max-content) minmax(var(--shell-convs-min),1fr) auto; grid-template-areas:"nav" "convs" "user"',
  ),
  D(
    '[data-eff="calm"] .nav',
    "grid-area:nav; display:flex; flex-direction:column; gap:2px; padding:10px 12px 4px; min-height:0",
  ),
  D('[data-eff="calm"] .ws', "padding:2px 8px 8px"),
  D('[data-eff="calm"] .srch', "height:34px; margin-bottom:6px"),
  D('[data-eff="calm"] .ni', "height:30px; font-size:13.5px"),
  D('[data-eff="calm"] .ni[data-calm-hidden]', "display:none"),
  D('[data-eff="calm"] .ni .ic', "width:17px; height:17px"),
  D(
    '[data-eff="calm"] .usercard',
    "padding:4px 0 10px; margin:0 12px; border-top:1px solid var(--line)",
  ),
  D(
    '[data-eff="calm"] .main',
    "margin:12px 12px 12px 0; border-radius:var(--radius); box-shadow:var(--shadow)",
  ),
  D(
    '[data-eff="calm"] .side',
    "margin:12px 12px 12px 0; border-radius:var(--radius); box-shadow:var(--shadow); overflow:hidden",
  ),
  D('[data-eff="calm"] .toast-anchor', "margin:12px 12px 12px 0"),
  // Table F, Focus rows
  D(
    '[data-eff="focus"] .sidebar',
    'width:68px; grid-template-columns:68px; grid-template-rows:minmax(0,1fr) auto; grid-template-areas:"nav" "user"',
  ),
  D(
    '[data-eff="focus"] .app[data-section="home"] .sidebar[data-has-list]',
    'width:356px; grid-template-columns:68px 288px; grid-template-areas:"nav convs" "user convs"',
  ),
  D(
    '[data-eff="focus"] .app:not([data-section="home"]) .convs',
    "display:none",
  ),
  D(
    '[data-eff="focus"] .nav',
    "grid-area:nav; display:flex; flex-direction:column; gap:4px; padding:10px 8px 0; background:var(--bg); border-right:1px solid var(--line); align-items:stretch; min-height:0; overflow:hidden",
  ),
  D('[data-eff="focus"] .nav-items', "flex:1 1 auto; min-height:0"),
  D(
    '[data-eff="focus"] .ws',
    "padding:0; justify-content:center; margin-bottom:6px",
  ),
  D('[data-eff="focus"] .wst', "display:none"),
  D(
    '[data-eff="focus"] .srch',
    "height:36px; justify-content:center; padding:0; background:transparent; border-color:transparent; margin-bottom:6px",
  ),
  D('[data-eff="focus"] .srch:hover', "background:var(--hover)"),
  D(
    '[data-eff="focus"] .srch .t, [data-eff="focus"] .srch .kbd',
    "display:none",
  ),
  D(
    '[data-eff="focus"] .ni',
    "flex-direction:column; justify-content:center; gap:3px; height:50px; padding:0; font-size:10.5px; font-weight:500",
  ),
  D('[data-eff="focus"] .ni .ic', "width:20px; height:20px"),
  D(
    '[data-eff="focus"] .ni .cnt',
    "position:absolute; top:4px; right:auto; left:calc(50% + 5px); margin:0; min-width:16px; height:16px; font-size:10px; box-shadow:0 0 0 2px var(--bg)",
  ),
  D(
    '[data-eff="focus"] .ni .cnt.mute',
    "background:var(--accent); color:var(--on-accent)",
  ),
  D(
    '[data-eff="focus"] .usercard',
    "grid-area:user; padding:6px 8px 10px; background:var(--bg); border-right:1px solid var(--line)",
  ),
  D('[data-eff="focus"] .ucard', "justify-content:center; padding:6px"),
  D('[data-eff="focus"] .ucard .uct', "display:none"),
  D(
    '[data-eff="focus"] .convs',
    "border-right:1px solid var(--line); background:var(--bg)",
  ),
  D('[data-eff="focus"] .side', "border-left:1px solid var(--line)"),
  D('[data-eff="focus"] .sechead', "padding:14px 20px 8px"),
  D('[data-eff="focus"] .secbody', "padding:0 20px 20px"),
  D('[data-eff="focus"] .toolbar', "padding:0 20px 10px"),
  // Table F, the overlay and the toast anchor beside it
  O(
    ".app[data-panel] .side",
    "grid-area:auto; position:absolute; top:0; right:0; bottom:0; z-index:6; width:min(var(--shell-panel),100%); box-shadow:var(--pop)",
  ),
  B(
    '[data-eff="calm"] .app[data-panel] .toast-anchor',
    "margin-right:calc(var(--shell-panel) + 12px)",
  ),
  B(
    '[data-eff="focus"] .app[data-panel] .toast-anchor',
    "margin-right:var(--shell-panel)",
  ),
  // Table G
  G(
    ".app",
    "display:block; background:var(--bg); --tabh:calc(62px + env(safe-area-inset-bottom,0px))",
  ),
  G(".toast-anchor", "position:absolute; inset:0"),
  G(".sidebar", "display:block"),
  G(
    ".convs, .main, .side",
    "position:absolute; left:0; right:0; top:0; bottom:var(--tabh); margin:0; border-radius:0; box-shadow:none; width:auto; border:0; background:var(--surface); transition:transform .18s ease,visibility .18s; visibility:hidden; display:flex",
  ),
  G(".convs", "background:var(--bg)"),
  G(
    '.app[data-pane="list"] .convs, .app[data-pane="main"] .main, .app[data-pane="side"] .side',
    "visibility:visible",
  ),
  G('.app[data-pane="side"] .side', "z-index:6"),
  G('.app[data-pane="list"] .main', "transform:translateX(100%)"),
  G('.app:not([data-pane="list"]) .convs', "transform:translateX(-24%)"),
  G(".app[data-chat-open] .main, .side", "bottom:0"),
  G(".side", "animation:shell-slide-in .18s ease-out"),
  {
    media: "shell-slide-in",
    selector: "from",
    decl: "transform:translateX(100%)",
  },
  G(
    ".nav",
    "display:block; position:absolute; left:0; right:0; bottom:0; height:var(--tabh); padding:0; background:var(--surface); border-top:1px solid var(--line); z-index:5; transition:transform .18s,visibility .18s",
  ),
  G(
    '.app[data-chat-open] .nav, .app[data-pane="side"] .nav',
    "transform:translateY(100%); visibility:hidden",
  ),
  G(".nav .ws, .nav .srch, .nav-items, .usercard", "display:none"),
  G(
    ".nav-tabs",
    "display:flex; height:100%; padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px)); overflow-x:auto; scrollbar-width:none",
  ),
  G(
    ".nt",
    "flex:1 0 64px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; min-height:48px; border-radius:12px; font-size:11px; font-weight:500; color:var(--muted); position:relative; text-align:center; text-decoration:none",
  ),
  G('.nt[aria-current="page"]', "color:var(--accent-text); font-weight:700"),
  G('.nt[aria-current="page"] .ic', "stroke-width:2.2"),
  G(
    ".nt .cnt",
    "position:absolute; top:2px; left:calc(50% + 4px); min-width:16px; height:16px; font-size:10px",
  ),
  G(
    ".tabs",
    "padding-left:max(10px,env(safe-area-inset-left,0px)); padding-right:max(10px,env(safe-area-inset-right,0px))",
  ),
  G(".tab", "min-height:40px"),
  G(
    ".sechead, .secbody, .toolbar",
    "padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px))",
  ),
  G(".sechead", "padding-top:max(14px,env(safe-area-inset-top,0px))"),
  G(
    ".sb, .sh",
    "padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px))",
  ),
  G(".sh", "padding-top:max(12px,env(safe-area-inset-top,0px))"),
  G(".sh .back-side", "display:inline-grid"),
  G(".sh .closex", "display:none"),
];

const rules = readCss(file);

describe("shell.css (R16, Tables C to G)", () => {
  test("holds exactly the rows typed in, in order, and no other rule", () => {
    expect(rules.map((r) => [r.media, r.selector])).toEqual(
      tables.map((t) => [t.media, t.selector]),
    );
  });

  test.each(tables.map((t, i) => [i, t] as const))(
    "row %i declarations match",
    (i, row) => {
      expect(rules[i]!.declarations, row.selector).toEqual(
        parseDeclarations(row.decl),
      );
    },
  );

  test("only the allowed media conditions, no @container, no !important", () => {
    const allowed = new Set([
      null,
      "(min-width:720px)",
      "(max-width:719px)",
      OVERLAY,
      BESIDE,
      "shell-slide-in",
    ]);
    for (const r of rules) expect(allowed.has(r.media), r.selector).toBe(true);
    const text = readFileSync(file, "utf8");
    expect(text).not.toMatch(/@container/);
    expect(text).not.toMatch(/!\s*important/);
  });
});

describe("shell.css uses the design system's names (R17)", () => {
  const tokenNames = new Set(
    [
      ...readFileSync(tokensCss, "utf8").matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm),
    ].map((m) => m[1]),
  );
  const own = new Set(["--tabh", "--shell-panel", "--shell-convs-min"]);

  test("every var() names a token or one of the three own properties", () => {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
      expect(tokenNames.has(m[1]!) || own.has(m[1]!), m[1]).toBe(true);
    }
  });

  test("no colour literal", () => {
    const literal =
      /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|color-mix\(|\b(white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|teal|navy|brown|cyan|magenta)\b/i;
    for (const r of rules)
      for (const [prop, value] of Object.entries(r.declarations)) {
        if (prop === "font-family") continue;
        expect(value, `${r.selector} ${prop}`).not.toMatch(literal);
      }
  });

  test("the font-family lines are those of Table C", () => {
    const families = rules.flatMap((r) =>
      r.declarations["font-family"]
        ? [[r.selector, r.declarations["font-family"]]]
        : [],
    );
    expect(families).toEqual([
      [
        ".ws .wsl",
        parseDeclarations('font-family:"Bricolage Grotesque",sans-serif')[
          "font-family"
        ],
      ],
      [
        ".ws .wsn",
        parseDeclarations('font-family:"Bricolage Grotesque",sans-serif')[
          "font-family"
        ],
      ],
      [".srch .kbd", parseDeclarations(`font-family:${MONO}`)["font-family"]],
    ]);
  });

  test("no selector names data-look, data-accent or data-density", () => {
    for (const r of rules)
      expect(r.selector).not.toMatch(/data-(look|accent|density)/);
  });

  test("nothing is hover-only (D-067)", () => {
    for (const r of rules.filter((x) => /:hover/.test(x.selector))) {
      expect(
        Object.keys(r.declarations).every((p) =>
          ["background", "color", "border-color"].includes(p),
        ),
        r.selector,
      ).toBe(true);
    }
  });

  test("--tabh is defined only on .app, only under 720 px (R24)", () => {
    const defs = rules.filter((r) => "--tabh" in r.declarations);
    expect(defs.map((r) => [r.media, r.selector])).toEqual([[NARROW, ".app"]]);
    expect(defs[0]!.declarations["--tabh"]).toBe(
      "calc(62px + env(safe-area-inset-bottom,0px))",
    );
  });

  test("--tabh is read only by rules that begin with .app or style an element inside it (R24)", () => {
    // The panes, the bar and the rules of Table G; never a toast or an overlay.
    const inside = /^\.(app|convs|main|side|nav)\b/;
    const readers = rules.filter((r) =>
      Object.entries(r.declarations).some(
        ([prop, value]) => prop !== "--tabh" && /var\(\s*--tabh/.test(value),
      ),
    );
    expect(readers.map((r) => r.selector)).toEqual([
      ".convs, .main, .side",
      ".nav",
    ]);
    for (const r of readers) {
      expect(r.media, r.selector).toBe(NARROW);
      for (const part of r.selector.split(","))
        expect(part.trim(), r.selector).toMatch(inside);
    }
  });

  test("no other style sheet of the app reads or defines --tabh (R24)", () => {
    const roots = [
      resolve(import.meta.dirname, ".."),
      resolve(import.meta.dirname, "../../../../apps/web/src"),
    ];
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = resolve(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".css") && p !== file)
          if (readFileSync(p, "utf8").includes("--tabh")) found.push(p);
      }
    };
    for (const r of roots) walk(r);
    expect(found).toEqual([]);
  });

  test("the narrow rules never name a look (R17)", () => {
    for (const r of rules.filter((x) => x.media === NARROW))
      expect(r.selector).not.toMatch(/data-eff/);
  });
});
