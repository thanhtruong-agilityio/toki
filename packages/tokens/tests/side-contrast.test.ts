import { describe, expect, it } from "vitest";
import {
  accents,
  getSideColours,
  getTheme,
  schemes,
  type Scheme,
} from "../src/index";

// TOKI-144 R5: the text of the Classic sidebar is readable on its dark ground. The ratios are the
// WCAG ones, computed from the values; the limit is 4.5:1 for text.

const LIMIT = 4.5;

function channels(colour: string): [number, number, number] {
  const hex = colour.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = colour.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
  throw new Error(`cannot read the colour ${colour}`);
}

function luminance(colour: string): number {
  const [r, g, b] = channels(colour).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("the ratio", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(ratio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(ratio("#16201D", "#16201D")).toBe(1);
  });

  it("tells a low contrast apart: a dark grey on the sidebar ground is under the limit", () => {
    expect(ratio("#3A4541", "#16201D")).toBeLessThan(LIMIT);
  });
});

describe("the sidebar text is readable (TOKI-144 R5)", () => {
  for (const scheme of schemes) {
    const side = getSideColours(scheme);
    for (const [name, ground] of [
      ["--side-bg", side.sideBg],
      ["--side-rail", side.rail],
    ] as const) {
      for (const [textName, text] of [
        ["--side-ink", side.ink],
        ["--side-muted", side.muted],
      ] as const) {
        it(`${textName} on ${name} in ${scheme} is at least ${LIMIT}:1`, () => {
          expect(ratio(text, ground)).toBeGreaterThanOrEqual(LIMIT);
        });
      }
    }
  }

  for (const scheme of schemes as readonly Scheme[]) {
    for (const accent of accents) {
      it(`--on-accent on --accent, ${accent}, ${scheme}, is at least ${LIMIT}:1`, () => {
        const theme = getTheme("classic", scheme, accent);
        expect(ratio(theme.onAccent, theme.accent)).toBeGreaterThanOrEqual(
          LIMIT,
        );
      });
    }
  }
});
