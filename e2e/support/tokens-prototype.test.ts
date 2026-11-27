import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  accents,
  getSideColours,
  getTheme,
  looks,
  schemes,
  type Accent,
  type Look,
  type Scheme,
} from "../../packages/tokens/src/index";

// TOKI-143 R13: the 32 values of each state of the tokens are the values of the prototype. This
// is the assertion; the parity check (e2e/parity/tokens.spec.ts) reports the same comparison in the
// browser and never fails a run (TOKI-109). The prototype's CSS is read as text, so no browser is
// needed, and the values are put in one normal form (shadows and colours spelled the same way).

const prototype = readFileSync(
  new URL("../prototype/index.html", import.meta.url),
  "utf8",
);

type Kind = "colour" | "length" | "percent" | "shadow";
const variables: Record<string, { name: string; kind: Kind }> = {
  bg: { name: "--bg", kind: "colour" },
  surface: { name: "--surface", kind: "colour" },
  surface2: { name: "--surface-2", kind: "colour" },
  ink: { name: "--ink", kind: "colour" },
  ink2: { name: "--ink-2", kind: "colour" },
  muted: { name: "--muted", kind: "colour" },
  line: { name: "--line", kind: "colour" },
  accent: { name: "--accent", kind: "colour" },
  onAccent: { name: "--on-accent", kind: "colour" },
  accentSoft: { name: "--accent-soft", kind: "colour" },
  accentText: { name: "--accent-text", kind: "colour" },
  mentionBg: { name: "--mention-bg", kind: "colour" },
  mentionInk: { name: "--mention-ink", kind: "colour" },
  danger: { name: "--danger", kind: "colour" },
  dangerSoft: { name: "--danger-soft", kind: "colour" },
  live: { name: "--live", kind: "colour" },
  onLive: { name: "--on-live", kind: "colour" },
  idea: { name: "--idea", kind: "colour" },
  ideaSoft: { name: "--idea-soft", kind: "colour" },
  hover: { name: "--hover", kind: "colour" },
  scrim: { name: "--scrim", kind: "colour" },
  avatarBgSaturation: { name: "--av-s", kind: "percent" },
  avatarBgLightness: { name: "--av-l", kind: "percent" },
  avatarTextSaturation: { name: "--av-ts", kind: "percent" },
  avatarTextLightness: { name: "--av-tl", kind: "percent" },
  avatarSize: { name: "--av", kind: "length" },
  messageGap: { name: "--gap", kind: "length" },
  rowHeight: { name: "--row", kind: "length" },
  radius: { name: "--radius", kind: "length" },
  radiusSm: { name: "--radius-sm", kind: "length" },
  shadow: { name: "--shadow", kind: "shadow" },
  pop: { name: "--pop", kind: "shadow" },
};

// ---- the normal form ----

function normColour(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/(^|[^\d])\.(\d)/g, "$10.$2");
}

function normShadow(v: string): string {
  const text = v.trim().toLowerCase();
  if (text === "none" || text === "") return "none";
  // the layers: split at the commas outside a bracket
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    else if (text[i] === "," && depth === 0) {
      layers.push(text.slice(start, i));
      start = i + 1;
    }
  }
  layers.push(text.slice(start));
  return layers
    .map((layer) => {
      const colour = layer.match(/(#[0-9a-f]{3,8}|rgba?\([^)]*\))/)![0];
      const lengths = layer
        .replace(colour, "")
        .trim()
        .split(/\s+/)
        .map((n) => String(Number.parseFloat(n)));
      while (lengths.length < 4) lengths.push("0");
      return `${lengths.join(" ")} ${normColour(colour)}`;
    })
    .join(", ");
}

export function normalise(kind: Kind, value: string): string {
  if (kind === "shadow") return normShadow(value);
  if (kind === "colour") return normColour(value);
  return String(Number.parseFloat(value));
}

// ---- reading the prototype ----

function declarations(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = prototype.match(
    new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`),
  );
  if (!m) throw new Error(`the prototype has no block ${selector}`);
  const out: Record<string, string> = {};
  for (const part of m[1]!.split(";")) {
    const text = part.trim();
    if (!text) continue;
    const colon = text.indexOf(":");
    out[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
  }
  return out;
}

// What the prototype gives to an element with a look, a scheme and an accent, density not chosen:
// the layout of the look, the colours of the pair, the accent preset of the scheme (teal has none:
// it is in the pair block).
export function prototypeValues(look: Look, scheme: Scheme, accent: Accent) {
  const layout =
    look === "calm"
      ? declarations(':root[data-look="calm"]')
      : declarations(':root[data-look="focus"],:root[data-look="classic"]');
  const pair = declarations(
    `:root[data-look="${look}"][data-scheme="${scheme}"]`,
  );
  const preset =
    accent === "teal"
      ? {}
      : declarations(`:root[data-scheme="${scheme}"][data-accent="${accent}"]`);
  return { ...layout, ...pair, ...preset };
}

// The differences between the values of getTheme and a set of prototype values.
export function differences(
  theme: ReturnType<typeof getTheme>,
  values: Record<string, string>,
): string[] {
  const out: string[] = [];
  for (const [key, { name, kind }] of Object.entries(variables)) {
    const ours = theme[key as keyof typeof theme];
    const ourText =
      kind === "shadow"
        ? (
            ours as Array<{
              x: number;
              y: number;
              blur: number;
              spread: number;
              color: string;
            }>
          )
            .map((l) => `${l.x} ${l.y} ${l.blur} ${l.spread} ${l.color}`)
            .join(", ") || "none"
        : String(ours);
    const theirs = values[name];
    if (theirs === undefined) {
      out.push(`${name}: not in the prototype`);
      continue;
    }
    if (normalise(kind, ourText) !== normalise(kind, theirs))
      out.push(
        `${name}: ${normalise(kind, ourText)} against ${normalise(kind, theirs)}`,
      );
  }
  return out;
}

describe("the normal form", () => {
  it("spells one shadow the same way in both files", () => {
    expect(
      normalise(
        "shadow",
        "0 1px 2px rgba(22,32,29,.06), 0 8px 24px rgba(22,32,29,.06)",
      ),
    ).toBe(
      normalise(
        "shadow",
        "0px 1px 2px 0px rgba(22,32,29,0.06), 0px 8px 24px 0px rgba(22,32,29,0.06)",
      ),
    );
    expect(normalise("shadow", "none")).toBe("none");
  });

  it("spells colours and lengths the same way", () => {
    expect(normalise("colour", "#0e1214")).toBe(normalise("colour", "#0E1214"));
    expect(normalise("colour", "rgba(232,237,235,.07)")).toBe(
      normalise("colour", "rgba(232, 237, 235, 0.07)"),
    );
    expect(normalise("length", "16px")).toBe(normalise("length", "16"));
    expect(normalise("percent", "45%")).toBe(normalise("percent", "45"));
  });

  it("tells two different values apart", () => {
    expect(normalise("colour", "#0E1214")).not.toBe(
      normalise("colour", "#0E1215"),
    );
    expect(normalise("shadow", "0 1px 2px #000")).not.toBe(
      normalise("shadow", "0 1px 3px #000"),
    );
  });
});

describe("the values of the tokens are the values of the prototype (TOKI-143 R13)", () => {
  for (const look of looks) {
    for (const scheme of schemes) {
      for (const accent of accents) {
        it(`${look} ${scheme} ${accent}`, () => {
          expect(
            differences(
              getTheme(look, scheme, accent),
              prototypeValues(look, scheme, accent),
            ),
          ).toEqual([]);
        });
      }
    }
  }

  it("a changed value is a difference", () => {
    const values = { ...prototypeValues("focus", "dark", "teal") };
    values["--bg"] = "#0E1215";
    expect(differences(getTheme("focus", "dark", "teal"), values)).toEqual([
      expect.stringContaining("--bg"),
    ]);
  });
});

describe("the sidebar colours are the prototype's (TOKI-144 R1)", () => {
  const names = {
    rail: "--side-rail",
    sideBg: "--side-bg",
    ink: "--side-ink",
    muted: "--side-muted",
    line: "--side-line",
    hover: "--side-hover",
  } as const;
  for (const scheme of schemes) {
    it(`Classic ${scheme}`, () => {
      const values = prototypeValues("classic", scheme, "teal");
      const side = getSideColours(scheme);
      for (const [key, name] of Object.entries(names)) {
        expect(
          normalise("colour", side[key as keyof typeof side]),
          `${scheme} ${name}`,
        ).toBe(normalise("colour", values[name]!));
      }
    });
  }

  it("Calm and Focus have no sidebar colours in the prototype", () => {
    for (const look of ["calm", "focus"] as const)
      expect(
        prototypeValues(look, "dark", "teal")["--side-bg"],
      ).toBeUndefined();
  });
});
