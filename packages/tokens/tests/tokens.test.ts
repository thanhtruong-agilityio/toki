import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import { toCss } from "../src/css";
import {
  accentColors,
  accents,
  lookDensity,
  densities,
  densityValues,
  getTheme,
  looks,
  palettes,
  schemes,
  radii,
  shadows,
} from "../src/index";
import type { Look, Scheme } from "../src/index";

const SRC_URL = new URL(
  "../src/tokens.test.ts",
  `file://${import.meta.dirname}/`,
);

// The tests hold their own copy of Tables A to E of the spec
// (docs/specs/2026-11-16-tokens-package-design.md), typed in from the spec.
// The package is compared with this copy, never with itself.

type LookName = "calm" | "focus" | "classic";
type SchemeName = "light" | "dark";
type AccentName = "teal" | "indigo" | "clay" | "violet";
type DensityName = "comfortable" | "compact";
type Layer = {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
};

// Table A: the 32 properties' colours and avatar tints of the six states (TOKI-143 R2).
// Calm light and Focus dark are the values of today; the other four are Table A of the spec of
// TOKI-143 (the prototype's blocks); Classic has the values of Focus in the same scheme.
const calmLight: Record<string, string | number> = {
  bg: "#F2F4EF",
  surface: "#FFFFFF",
  surface2: "#F7F8F5",
  ink: "#16201D",
  ink2: "#3A4541",
  muted: "#5A6662",
  line: "#E0E5DF",
  mentionBg: "#FDF0C4",
  mentionInk: "#5C4400",
  danger: "#B42318",
  dangerSoft: "#FCE8E6",
  live: "#C2410C",
  onLive: "#FFFFFF",
  idea: "#6D4AC7",
  ideaSoft: "#ECE6FA",
  hover: "rgba(22,32,29,0.055)",
  scrim: "rgba(22,32,29,0.38)",
  avatarBgSaturation: 45,
  avatarBgLightness: 88,
  avatarTextSaturation: 55,
  avatarTextLightness: 28,
};
const focusDark: Record<string, string | number> = {
  bg: "#0E1214",
  surface: "#161B1E",
  surface2: "#1D2327",
  ink: "#E8EDEB",
  ink2: "#C9D1CE",
  muted: "#96A29D",
  line: "#283035",
  mentionBg: "rgba(250,204,21,0.12)",
  mentionInk: "#FDE68A",
  danger: "#F97066",
  dangerSoft: "#3A1614",
  live: "#FB923C",
  onLive: "#1A0B02",
  idea: "#B9A2F5",
  ideaSoft: "#2A2145",
  hover: "rgba(232,237,235,0.07)",
  scrim: "rgba(0,0,0,0.55)",
  avatarBgSaturation: 35,
  avatarBgLightness: 24,
  avatarTextSaturation: 70,
  avatarTextLightness: 86,
};
const calmDark: Record<string, string | number> = {
  ...focusDark,
  bg: "#0B0F10",
  surface2: "#1B2125",
  line: "#263035",
  avatarBgSaturation: 45,
  avatarBgLightness: 88,
  avatarTextSaturation: 55,
  avatarTextLightness: 28,
};
const focusLight: Record<string, string | number> = {
  ...calmLight,
  bg: "#EEF1EC",
  surface2: "#F4F6F2",
  line: "#DDE3DC",
  avatarBgSaturation: 35,
  avatarBgLightness: 24,
  avatarTextSaturation: 70,
  avatarTextLightness: 86,
};
const tableA: Record<
  LookName,
  Record<SchemeName, Record<string, string | number>>
> = {
  calm: { light: calmLight, dark: calmDark },
  focus: { light: focusLight, dark: focusDark },
  classic: { light: focusLight, dark: focusDark },
};

// Table B: the accent values of a scheme (a light scheme has Calm's today, a dark scheme Focus's).
const accentsLight: Record<AccentName, Record<string, string>> = {
  teal: {
    accent: "#0F766E",
    onAccent: "#FFFFFF",
    accentSoft: "#DCEFEA",
    accentText: "#0B5D56",
  },
  indigo: {
    accent: "#4F46E5",
    onAccent: "#FFFFFF",
    accentSoft: "#E3E5FB",
    accentText: "#3730A3",
  },
  clay: {
    accent: "#B4532A",
    onAccent: "#FFFFFF",
    accentSoft: "#F6E3DA",
    accentText: "#8A3A17",
  },
  violet: {
    accent: "#7C3AED",
    onAccent: "#FFFFFF",
    accentSoft: "#EBE3FB",
    accentText: "#5B21B6",
  },
};
const accentsDark: Record<AccentName, Record<string, string>> = {
  teal: {
    accent: "#5EEAD4",
    onAccent: "#04201C",
    accentSoft: "#123B36",
    accentText: "#7EF0DE",
  },
  indigo: {
    accent: "#A5B4FC",
    onAccent: "#1E1B4B",
    accentSoft: "#25285A",
    accentText: "#C7D2FE",
  },
  clay: {
    accent: "#FDBA8C",
    onAccent: "#3B1405",
    accentSoft: "#4A2415",
    accentText: "#FED7BF",
  },
  violet: {
    accent: "#C4B5FD",
    onAccent: "#2E1065",
    accentSoft: "#34205E",
    accentText: "#DDD6FE",
  },
};
const tableB: Record<
  LookName,
  Record<SchemeName, Record<AccentName, Record<string, string>>>
> = {
  calm: { light: accentsLight, dark: accentsDark },
  focus: { light: accentsLight, dark: accentsDark },
  classic: { light: accentsLight, dark: accentsDark },
};

const tableC: Record<
  DensityName,
  { avatarSize: number; messageGap: number; rowHeight: number }
> = {
  comfortable: { avatarSize: 36, messageGap: 14, rowHeight: 36 },
  compact: { avatarSize: 30, messageGap: 8, rowHeight: 32 },
};

const tableD: Record<LookName, { radius: number; radiusSm: number }> = {
  calm: { radius: 16, radiusSm: 10 },
  focus: { radius: 10, radiusSm: 8 },
  classic: { radius: 10, radiusSm: 8 },
};

const layer = (
  x: number,
  y: number,
  blur: number,
  spread: number,
  color: string,
): Layer => ({
  x,
  y,
  blur,
  spread,
  color,
});

type ShadowPair = { shadow: Layer[]; pop: Layer[] };
const calmLightShadows: ShadowPair = {
  shadow: [
    layer(0, 1, 2, 0, "rgba(22,32,29,0.06)"),
    layer(0, 8, 24, 0, "rgba(22,32,29,0.06)"),
  ],
  pop: [
    layer(0, 4, 8, 0, "rgba(22,32,29,0.08)"),
    layer(0, 16, 40, 0, "rgba(22,32,29,0.16)"),
  ],
};
const focusDarkShadows: ShadowPair = {
  shadow: [],
  pop: [layer(0, 0, 0, 1, "#283035"), layer(0, 16, 40, 0, "rgba(0,0,0,0.5)")],
};
const calmDarkShadows: ShadowPair = {
  shadow: [
    layer(0, 1, 2, 0, "rgba(0,0,0,0.4)"),
    layer(0, 8, 24, 0, "rgba(0,0,0,0.3)"),
  ],
  pop: focusDarkShadows.pop,
};
const focusLightShadows: ShadowPair = {
  shadow: [],
  pop: [
    layer(0, 0, 0, 1, "#DDE3DC"),
    layer(0, 16, 40, 0, "rgba(22,32,29,0.16)"),
  ],
};
const tableE: Record<LookName, Record<SchemeName, ShadowPair>> = {
  calm: { light: calmLightShadows, dark: calmDarkShadows },
  focus: { light: focusLightShadows, dark: focusDarkShadows },
  classic: { light: focusLightShadows, dark: focusDarkShadows },
};

const lookList: LookName[] = ["calm", "focus", "classic"];
const schemeList: SchemeName[] = ["light", "dark"];
const accentList: AccentName[] = ["teal", "indigo", "clay", "violet"];
const densityList: DensityName[] = ["comfortable", "compact"];
const lookDensityExpected: Record<LookName, DensityName> = {
  calm: "comfortable",
  focus: "compact",
  classic: "compact",
};

// Object key -> CSS variable and the form the variable takes in tokens.css (R10, R15).
type Kind = "color" | "px" | "pct" | "shadow";
const variables: Record<string, { name: string; kind: Kind }> = {
  bg: { name: "--bg", kind: "color" },
  surface: { name: "--surface", kind: "color" },
  surface2: { name: "--surface-2", kind: "color" },
  ink: { name: "--ink", kind: "color" },
  ink2: { name: "--ink-2", kind: "color" },
  muted: { name: "--muted", kind: "color" },
  line: { name: "--line", kind: "color" },
  accent: { name: "--accent", kind: "color" },
  onAccent: { name: "--on-accent", kind: "color" },
  accentSoft: { name: "--accent-soft", kind: "color" },
  accentText: { name: "--accent-text", kind: "color" },
  mentionBg: { name: "--mention-bg", kind: "color" },
  mentionInk: { name: "--mention-ink", kind: "color" },
  danger: { name: "--danger", kind: "color" },
  dangerSoft: { name: "--danger-soft", kind: "color" },
  live: { name: "--live", kind: "color" },
  onLive: { name: "--on-live", kind: "color" },
  idea: { name: "--idea", kind: "color" },
  ideaSoft: { name: "--idea-soft", kind: "color" },
  hover: { name: "--hover", kind: "color" },
  scrim: { name: "--scrim", kind: "color" },
  avatarBgSaturation: { name: "--av-s", kind: "pct" },
  avatarBgLightness: { name: "--av-l", kind: "pct" },
  avatarTextSaturation: { name: "--av-ts", kind: "pct" },
  avatarTextLightness: { name: "--av-tl", kind: "pct" },
  avatarSize: { name: "--av", kind: "px" },
  messageGap: { name: "--gap", kind: "px" },
  rowHeight: { name: "--row", kind: "px" },
  radius: { name: "--radius", kind: "px" },
  radiusSm: { name: "--radius-sm", kind: "px" },
  shadow: { name: "--shadow", kind: "shadow" },
  pop: { name: "--pop", kind: "shadow" },
};
const allKeys = Object.keys(variables);
const allNames = Object.values(variables).map((v) => v.name);

function expectedTheme(
  look: LookName,
  scheme: SchemeName,
  accent: AccentName,
  density?: DensityName,
) {
  return {
    ...tableA[look][scheme],
    ...tableB[look][scheme][accent],
    ...tableC[density ?? lookDensityExpected[look]],
    ...tableD[look],
    ...tableE[look][scheme],
  };
}

// The CSS form of one value (R15), written here independently of css.ts.
function cssForm(kind: Kind, value: unknown): string {
  if (kind === "px") return `${value as number}px`;
  if (kind === "pct") return `${value as number}%`;
  if (kind === "shadow") {
    const layers = value as Layer[];
    if (layers.length === 0) return "none";
    return layers
      .map((l) => `${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${l.color}`)
      .join(", ");
  }
  return value as string;
}

describe("R1 names and lists", () => {
  it("lists hold exactly the values, in order", () => {
    expect(looks).toEqual(lookList);
    expect(schemes).toEqual(schemeList);
    expect(accents).toEqual(accentList);
    expect(densities).toEqual(["comfortable", "compact"]);
  });
  it("Look and Scheme are the values of the lists (TOKI-143 R1)", () => {
    expectTypeOf<Look>().toEqualTypeOf<"calm" | "focus" | "classic">();
    expectTypeOf<Scheme>().toEqualTypeOf<"light" | "dark">();
  });
});

describe("R2 palettes", () => {
  for (const look of lookList) {
    for (const scheme of schemeList) {
      it(`palettes.${look}.${scheme} holds exactly the Table A values`, () => {
        expect(palettes[look][scheme]).toEqual(tableA[look][scheme]);
      });
    }
  }
  it("Classic has the values of Focus in the same scheme", () => {
    for (const scheme of schemeList) {
      expect(palettes.classic[scheme]).toEqual(palettes.focus[scheme]);
    }
  });
  it("keeps the values of Calm light and Focus dark as they were", () => {
    expect(palettes.calm.light.bg).toBe("#F2F4EF");
    expect(palettes.focus.dark.bg).toBe("#0E1214");
  });
});

describe("R3 accent colours", () => {
  for (const look of lookList) {
    for (const scheme of schemeList) {
      for (const accent of accentList) {
        it(`accentColors.${look}.${scheme}.${accent} holds the Table B values`, () => {
          expect(accentColors[look][scheme][accent]).toEqual(
            tableB[look][scheme][accent],
          );
        });
      }
    }
  }
});

describe("R4 density", () => {
  it("densityValues holds Table C", () => {
    expect(densityValues).toEqual(tableC);
  });
  it("lookDensity is comfortable for calm and compact for focus and classic", () => {
    expect(lookDensity).toEqual(lookDensityExpected);
  });
});

describe("R5 radii and R6 shadows", () => {
  it("radii holds Table D", () => {
    expect(radii).toEqual(tableD);
  });
  it("shadows holds Table E, an empty list for no shadow", () => {
    expect(shadows).toEqual(tableE);
    expect(shadows.focus.dark.shadow).toEqual([]);
    expect(shadows.focus.light.shadow).toEqual([]);
  });
});

describe("R7 getTheme", () => {
  for (const look of lookList) {
    for (const scheme of schemeList) {
      for (const accent of accentList) {
        for (const density of [...densityList, undefined]) {
          it(`${look} ${scheme} ${accent} ${density ?? "default density"}`, () => {
            const theme = getTheme(look, scheme, accent, density);
            expect(Object.keys(theme).sort()).toEqual([...allKeys].sort());
            expect(theme).toEqual(expectedTheme(look, scheme, accent, density));
          });
        }
      }
    }
  }
});

describe("getTheme isolation", () => {
  it("does not share shadow layers with the tokens", () => {
    const theme = getTheme("calm", "light", "teal");
    theme.shadow.push({ x: 1, y: 1, blur: 1, spread: 1, color: "#000000" });
    theme.pop[0]!.blur = 99;
    expect(shadows.calm.light).toEqual(tableE.calm.light);
  });
});

describe("R8 values usable in React Native", () => {
  const colour = /^(#[0-9A-F]{6}|rgba\(\d+,\d+,\d+,\d*\.?\d+\))$/;
  const forbidden = /var\(|calc\(|\d(px|%|rem|em)\b/;

  function check(key: string, value: unknown) {
    const kind = variables[key]?.kind;
    expect(kind, `unknown key ${key}`).toBeDefined();
    if (kind === "color") {
      expect(typeof value, key).toBe("string");
      expect(value as string, key).toMatch(colour);
    } else if (kind === "px") {
      expect(Number.isFinite(value), key).toBe(true);
      expect(typeof value, key).toBe("number");
    } else if (kind === "pct") {
      expect(typeof value, key).toBe("number");
      expect(value as number, key).toBeGreaterThanOrEqual(0);
      expect(value as number, key).toBeLessThanOrEqual(100);
    } else {
      expect(Array.isArray(value), key).toBe(true);
      for (const l of value as Layer[]) {
        expect(Object.keys(l).sort(), key).toEqual([
          "blur",
          "color",
          "spread",
          "x",
          "y",
        ]);
        for (const n of [l.x, l.y, l.blur, l.spread])
          expect(typeof n, key).toBe("number");
        expect(l.color, key).toMatch(colour);
      }
    }
    expect(JSON.stringify(value), key).not.toMatch(forbidden);
  }

  it("every value of every look, accent and density has the right form", () => {
    for (const look of lookList) {
      for (const scheme of schemeList) {
        for (const accent of accentList) {
          for (const density of densityList) {
            const theme = getTheme(look, scheme, accent, density);
            for (const [key, value] of Object.entries(theme)) check(key, value);
          }
        }
      }
    }
  });
});

// ---- tokens.css ---------------------------------------------------------

const cssPath = new URL("./tokens.css", SRC_URL);
const generateCommand = "pnpm --filter @toki/tokens generate";

type Block = {
  media?: string;
  selector: string;
  decls: Record<string, string>;
};

function parseDecls(body: string): Record<string, string> {
  const decls: Record<string, string> = {};
  for (const part of body.split(";")) {
    const text = part.trim();
    if (text === "") continue;
    const colon = text.indexOf(":");
    decls[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
  }
  return decls;
}

function parseCss(text: string): Block[] {
  const source = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: Block[] = [];
  const walk = (s: string, media?: string) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf("{", i);
      if (open < 0) break;
      const prelude = s.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (depth > 0) {
        if (s[j] === "{") depth++;
        else if (s[j] === "}") depth--;
        j++;
      }
      const body = s.slice(open + 1, j - 1);
      if (prelude.startsWith("@media")) walk(body, prelude);
      else blocks.push({ media, selector: prelude, decls: parseDecls(body) });
      i = j;
    }
  };
  walk(source);
  return blocks;
}

// Specificity of one selector of the kinds the file uses, or -1 when it does
// not match an element with these attributes. Every token counts one.
function matchSpecificity(
  selector: string,
  attrs: Record<string, string>,
): number {
  const token = /:root|\[data-([a-z]+)="([^"]+)"\]|:not\(\[data-([a-z]+)\]\)/g;
  let count = 0;
  let rest = selector;
  for (const m of selector.matchAll(token)) {
    count++;
    rest = rest.replace(m[0], "");
    if (m[1] !== undefined && attrs[m[1]] !== m[2]) return -1;
    if (m[3] !== undefined && attrs[m[3]] !== undefined) return -1;
  }
  expect(
    rest.trim(),
    `selector ${selector} has a part this test cannot read`,
  ).toBe("");
  return count;
}

// What tokens.css gives to an element: blocks that match, by specificity and
// then by file order. `dark` says whether the device asks for dark.
function resolve(
  blocks: Block[],
  attrs: Record<string, string>,
  dark: boolean,
) {
  const winner: Record<string, { spec: number; value: string }> = {};
  for (const b of blocks) {
    if (
      b.media !== undefined &&
      !(dark && b.media.includes("prefers-color-scheme: dark"))
    )
      continue;
    let best = -1;
    for (const s of b.selector.split(","))
      best = Math.max(best, matchSpecificity(s.trim(), attrs));
    if (best < 0) continue;
    for (const [prop, value] of Object.entries(b.decls)) {
      const cur = winner[prop];
      if (cur === undefined || best >= cur.spec)
        winner[prop] = { spec: best, value };
    }
  }
  return Object.fromEntries(
    Object.entries(winner).map(([p, w]) => [p, w.value]),
  );
}

describe("tokens.css", () => {
  const text = readFileSync(cssPath, "utf8");
  const blocks = parseCss(text);
  const plain = blocks.filter((b) => b.media === undefined);
  const pairSelector = (look: LookName, scheme: SchemeName) =>
    look === "calm" && scheme === "light"
      ? `:root, :root[data-look="calm"][data-scheme="light"]`
      : `:root[data-look="${look}"][data-scheme="${scheme}"]`;
  const pairs = lookList.flatMap((look) =>
    schemeList.map((scheme) => ({ look, scheme })),
  );
  const pairBlock = (look: LookName, scheme: SchemeName) =>
    plain.find((x) => x.selector === pairSelector(look, scheme))!;
  const accentSelector = (look: LookName, scheme: SchemeName, accent: string) =>
    `:root[data-look="${look}"][data-scheme="${scheme}"][data-accent="${accent}"]`;
  const densitySelectors = [
    ':root:root[data-density="compact"]',
    ':root:root[data-density="comfortable"]',
  ];

  it("R17 starts with a comment that says it is generated and names the command", () => {
    expect(text.startsWith("/*")).toBe(true);
    const header = text.slice(0, text.indexOf("*/"));
    expect(header).toMatch(/generated/i);
    expect(header).toContain(generateCommand);
  });

  it("R17 equals what the script would write", () => {
    expect(text, `tokens.css is stale: run ${generateCommand}`).toBe(toCss());
  });

  it("R10 declares exactly the 32 custom properties and no other", () => {
    const names = new Set<string>();
    for (const b of blocks) {
      for (const p of Object.keys(b.decls))
        if (p !== "color-scheme") names.add(p);
    }
    expect([...names].sort()).toEqual([...allNames].sort());
    expect(allNames).toHaveLength(32);
  });

  it("R11 has six blocks, one for each look and scheme, with all 32 properties and color-scheme", () => {
    const pairBlocks = plain.filter(
      (b) =>
        b.selector.includes("data-scheme") &&
        !b.selector.includes("data-accent"),
    );
    expect(pairBlocks).toHaveLength(6);
    for (const { look, scheme } of pairs) {
      const b = pairBlock(look, scheme);
      expect(b, `block for ${look} ${scheme}`).toBeDefined();
      const props = Object.keys(b.decls).filter((p) => p !== "color-scheme");
      expect(props.sort()).toEqual([...allNames].sort());
      expect(b.decls["color-scheme"]).toBe(scheme);
    }
  });

  it("R12 has one dark-device block that is the block of Calm dark", () => {
    const media = blocks.filter((b) => b.media !== undefined);
    expect(media).toHaveLength(1);
    expect(media[0]!.media).toMatch(
      /^@media\s*\(prefers-color-scheme:\s*dark\)$/,
    );
    expect(media[0]!.selector).toBe(":root:not([data-scheme])");
    expect(media[0]!.decls).toEqual(pairBlock("calm", "dark").decls);
    expect(media[0]!.decls["color-scheme"]).toBe("dark");
  });

  it("R13 has eighteen accent blocks with four properties each and none for teal", () => {
    const accentBlocks = plain.filter((b) =>
      b.selector.includes("data-accent"),
    );
    const expected = pairs.flatMap(({ look, scheme }) =>
      (["indigo", "clay", "violet"] as const).map((accent) =>
        accentSelector(look, scheme, accent),
      ),
    );
    expect(accentBlocks).toHaveLength(18);
    expect(accentBlocks.map((b) => b.selector).sort()).toEqual(
      [...expected].sort(),
    );
    for (const b of accentBlocks) {
      expect(Object.keys(b.decls).sort()).toEqual(
        ["--accent", "--accent-soft", "--accent-text", "--on-accent"].sort(),
      );
    }
    expect(text).not.toContain('data-accent="teal"');
  });

  it("R14 has two density blocks with three properties each, after every look block, as strong as a look block", () => {
    const densityBlocks = plain.filter((b) =>
      b.selector.includes("data-density"),
    );
    expect(densityBlocks.map((b) => b.selector).sort()).toEqual(
      [...densitySelectors].sort(),
    );
    for (const b of densityBlocks) {
      expect(Object.keys(b.decls).sort()).toEqual(["--av", "--gap", "--row"]);
      expect(blocks.indexOf(b)).toBeGreaterThan(
        Math.max(
          ...pairs.map(({ look, scheme }) =>
            blocks.findIndex((x) => x.selector === pairSelector(look, scheme)),
          ),
        ),
      );
    }
    for (const b of blocks.filter((x) => x.media !== undefined)) {
      expect(blocks.indexOf(b)).toBeLessThan(blocks.indexOf(densityBlocks[0]!));
    }
  });

  it("R10-R14 the blocks stand in the fixed order of the file", () => {
    expect(blocks.map((b) => b.selector)).toEqual([
      pairSelector("calm", "light"),
      ...pairs
        .filter(({ look, scheme }) => !(look === "calm" && scheme === "light"))
        .map(({ look, scheme }) => pairSelector(look, scheme)),
      ":root:not([data-scheme])",
      ...pairs.flatMap(({ look, scheme }) =>
        (["indigo", "clay", "violet"] as const).map((accent) =>
          accentSelector(look, scheme, accent),
        ),
      ),
      ...densitySelectors,
    ]);
    expect(blocks[6]!.media).toBeDefined();
  });

  it("R15 gives the worked examples exactly as the file holds them", () => {
    const calm = pairBlock("calm", "light");
    const focus = pairBlock("focus", "dark");
    expect(calm.decls["--shadow"]).toBe(
      "0px 1px 2px 0px rgba(22,32,29,0.06), 0px 8px 24px 0px rgba(22,32,29,0.06)",
    );
    expect(focus.decls["--pop"]).toBe(
      "0px 0px 0px 1px #283035, 0px 16px 40px 0px rgba(0,0,0,0.5)",
    );
    expect(focus.decls["--shadow"]).toBe("none");
    expect(calm.decls["--radius"]).toBe("16px");
    expect(calm.decls["--av-s"]).toBe("45%");
    expect(pairBlock("calm", "dark").decls["--shadow"]).toBe(
      "0px 1px 2px 0px rgba(0,0,0,0.4), 0px 8px 24px 0px rgba(0,0,0,0.3)",
    );
    expect(pairBlock("focus", "light").decls["--pop"]).toBe(
      "0px 0px 0px 1px #DDE3DC, 0px 16px 40px 0px rgba(22,32,29,0.16)",
    );
  });

  it("R15 every length ends in px, every avatar tint in %, every shadow layer has four lengths", () => {
    const colourText = "(#[0-9A-F]{6}|rgba\\(\\d+,\\d+,\\d+,\\d*\\.?\\d+\\))";
    const layerForm = new RegExp(`^(-?\\d+px ){3}-?\\d+px ${colourText}$`);
    for (const b of blocks) {
      for (const [prop, value] of Object.entries(b.decls)) {
        const entry = Object.values(variables).find((v) => v.name === prop);
        if (entry === undefined) continue;
        if (entry.kind === "px") expect(value, prop).toMatch(/^\d+px$/);
        if (entry.kind === "pct") expect(value, prop).toMatch(/^\d+%$/);
        if (entry.kind === "color")
          expect(value, prop).toMatch(new RegExp(`^${colourText}$`));
        if (entry.kind === "shadow" && value !== "none") {
          for (const l of value.split(", ")) expect(l, prop).toMatch(layerForm);
        }
      }
    }
  });

  it("R15 writes px, %, none and shadow layers in the documented form", () => {
    for (const [key, { name, kind }] of Object.entries(variables)) {
      for (const { look, scheme } of pairs) {
        const value = pairBlock(look, scheme).decls[name]!;
        const expected = cssForm(
          kind,
          expectedTheme(look, scheme, "teal")[
            key as keyof ReturnType<typeof expectedTheme>
          ],
        );
        expect(value, `${look} ${scheme} ${name}`).toBe(expected);
      }
    }
  });

  function expectSame(
    got: Record<string, string>,
    theme: ReturnType<typeof getTheme>,
    label: string,
  ) {
    for (const [key, { name, kind }] of Object.entries(variables)) {
      expect(got[name], `${label} ${name}`).toBe(
        cssForm(kind, theme[key as keyof typeof theme]),
      );
    }
  }

  it("R16a gives each look, scheme, accent and density the values of getTheme, on a light and a dark device", () => {
    let states = 0;
    for (const { look, scheme } of pairs) {
      for (const accent of accentList) {
        for (const density of [...densityList, undefined]) {
          const attrs: Record<string, string> = {
            look,
            scheme,
            accent,
          };
          if (density !== undefined) attrs.density = density;
          for (const dark of [false, true]) {
            const got = resolve(blocks, attrs, dark);
            expectSame(
              got,
              getTheme(look, scheme, accent, density),
              `${look} ${scheme} ${accent} ${density ?? "none"} dark=${dark}`,
            );
            expect(got["color-scheme"]).toBe(scheme);
          }
          states++;
        }
      }
    }
    expect(states).toBe(72);
  });

  it("R16b gives a page with no attribute but a density the values of Calm in the scheme of the device", () => {
    let states = 0;
    for (const dark of [false, true]) {
      for (const density of [...densityList, undefined]) {
        const attrs: Record<string, string> = {};
        if (density !== undefined) attrs.density = density;
        const scheme = dark ? "dark" : "light";
        const got = resolve(blocks, attrs, dark);
        expectSame(
          got,
          getTheme("calm", scheme, "teal", density),
          `calm ${scheme} ${density ?? "none"}`,
        );
        expect(got["color-scheme"]).toBe(scheme);
        states++;
      }
    }
    expect(states).toBe(6);
  });

  it("R12 shows Calm in the scheme of the device before data-scheme is set", () => {
    const light = resolve(blocks, {}, false);
    const dark = resolve(blocks, {}, true);
    expect(light["--bg"]).toBe(tableA.calm.light.bg);
    expect(light["color-scheme"]).toBe("light");
    expect(dark["--bg"]).toBe(tableA.calm.dark.bg);
    expect(dark["color-scheme"]).toBe("dark");
    // Once data-look and data-scheme are set, only the attributes count.
    expect(
      resolve(blocks, { look: "calm", scheme: "light" }, true)["--bg"],
    ).toBe(tableA.calm.light.bg);
  });

  it("a chosen density wins over the density of the look in each of the six pairs", () => {
    for (const { look, scheme } of pairs) {
      for (const density of densityList) {
        const got = resolve(blocks, { look, scheme, density }, false);
        expect(got["--av"], `${look} ${scheme} ${density}`).toBe(
          `${tableC[density].avatarSize}px`,
        );
        expect(got["--row"]).toBe(`${tableC[density].rowHeight}px`);
      }
    }
  });
});

describe("package files", () => {
  const root = fileURLToPath(new URL("..", SRC_URL));
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    exports: Record<string, string>;
    dependencies?: unknown;
  };

  it("R9 exports tokens.css beside the main entry, and the file exists", () => {
    expect(pkg.exports).toEqual({
      ".": "./src/index.ts",
      "./tokens.css": "./src/tokens.css",
    });
    for (const target of Object.values(pkg.exports)) {
      expect(existsSync(join(root, target)), target).toBe(true);
    }
  });

  it("R19 has no dependencies entry", () => {
    expect(pkg.dependencies).toBeUndefined();
  });

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      if (name === "node_modules") return [];
      const full = join(dir, name);
      return statSync(full).isDirectory() ? files(full) : [full];
    });
  }

  it("R18 uses none of the Meet call screen names in src and scripts", () => {
    const names = [
      "stage",
      "stage-bar",
      "stage-ink",
      "stage-line",
      "stage-muted",
      "tile",
    ].map((n) => `--${n}`);
    const scanned = [
      ...files(join(root, "src")),
      ...files(join(root, "scripts")),
    ].filter((f) => !f.endsWith("tokens.test.ts"));
    for (const file of scanned) {
      const content = readFileSync(file, "utf8");
      for (const name of names) {
        // A longer name that starts the same way is not one of the six.
        expect(
          new RegExp(`${name}(?![\\w-])`).test(content),
          `${name} in ${file}`,
        ).toBe(false);
      }
    }
  });

  it("R19 source files use no browser global and import nothing but relative files", () => {
    const src = join(root, "src");
    for (const file of files(src).filter(
      (f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f),
    )) {
      const content = readFileSync(file, "utf8");
      expect(content, file).not.toMatch(
        /\b(window|document|localStorage|sessionStorage|navigator|process|require)\b/,
      );
      for (const m of content.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
        expect(m[1]!.startsWith("."), `${file} imports ${m[1]}`).toBe(true);
      }
    }
  });
});
