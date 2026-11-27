import { getSideColours, getTheme, type Theme } from "./theme";
import {
  accents,
  densityValues,
  looks,
  schemes,
  type Density,
  type Look,
  type Scheme,
} from "./tokens";

// Builds the text of tokens.css from the token objects. Pure: no file access.
// The order of the blocks is fixed (see the spec, Design): the six pairs of a
// look and a scheme (Calm light first), the device block, the eighteen accent
// blocks, the two density blocks.

type Kind = "color" | "px" | "pct" | "shadow";

// Object key -> CSS variable, in the order the file lists them.
const variables: [keyof Theme, string, Kind][] = [
  ["bg", "--bg", "color"],
  ["surface", "--surface", "color"],
  ["surface2", "--surface-2", "color"],
  ["ink", "--ink", "color"],
  ["ink2", "--ink-2", "color"],
  ["muted", "--muted", "color"],
  ["line", "--line", "color"],
  ["accent", "--accent", "color"],
  ["onAccent", "--on-accent", "color"],
  ["accentSoft", "--accent-soft", "color"],
  ["accentText", "--accent-text", "color"],
  ["mentionBg", "--mention-bg", "color"],
  ["mentionInk", "--mention-ink", "color"],
  ["danger", "--danger", "color"],
  ["dangerSoft", "--danger-soft", "color"],
  ["live", "--live", "color"],
  ["onLive", "--on-live", "color"],
  ["idea", "--idea", "color"],
  ["ideaSoft", "--idea-soft", "color"],
  ["hover", "--hover", "color"],
  ["scrim", "--scrim", "color"],
  ["avatarBgSaturation", "--av-s", "pct"],
  ["avatarBgLightness", "--av-l", "pct"],
  ["avatarTextSaturation", "--av-ts", "pct"],
  ["avatarTextLightness", "--av-tl", "pct"],
  ["avatarSize", "--av", "px"],
  ["messageGap", "--gap", "px"],
  ["rowHeight", "--row", "px"],
  ["radius", "--radius", "px"],
  ["radiusSm", "--radius-sm", "px"],
  ["shadow", "--shadow", "shadow"],
  ["pop", "--pop", "shadow"],
];

function format(kind: Kind, value: Theme[keyof Theme]): string {
  if (kind === "px") return `${value as number}px`;
  if (kind === "pct") return `${value as number}%`;
  if (kind === "shadow") {
    const layers = value as Theme["shadow"];
    if (layers.length === 0) return "none";
    return layers
      .map((l) => `${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${l.color}`)
      .join(", ");
  }
  return value as string;
}

function declarations(
  theme: Theme,
  names: readonly string[],
  indent: string,
): string[] {
  return variables
    .filter(([, name]) => names.includes(name))
    .map(
      ([key, name, kind]) => `${indent}${name}: ${format(kind, theme[key])};`,
    );
}

function block(selector: string, lines: string[], indent = ""): string {
  return [`${indent}${selector} {`, ...lines, `${indent}}`].join("\n");
}

const allNames = variables.map(([, name]) => name);
const accentNames = [
  "--accent",
  "--on-accent",
  "--accent-soft",
  "--accent-text",
];

function pairLines(look: Look, scheme: Scheme, indent: string): string[] {
  const lines = [
    `${indent}color-scheme: ${scheme};`,
    ...declarations(getTheme(look, scheme, "teal"), allNames, indent),
  ];
  // The six sidebar colours: in the two Classic blocks only (TOKI-144 R1).
  if (look === "classic") {
    const side = getSideColours(scheme);
    lines.push(
      `${indent}--side-rail: ${side.rail};`,
      `${indent}--side-bg: ${side.sideBg};`,
      `${indent}--side-ink: ${side.ink};`,
      `${indent}--side-muted: ${side.muted};`,
      `${indent}--side-line: ${side.line};`,
      `${indent}--side-hover: ${side.hover};`,
    );
  }
  return lines;
}

const pairSelector = (look: Look, scheme: Scheme) =>
  `:root[data-look="${look}"][data-scheme="${scheme}"]`;

function densityLines(density: Density, indent: string): string[] {
  const v = densityValues[density];
  return [
    `${indent}--av: ${v.avatarSize}px;`,
    `${indent}--gap: ${v.messageGap}px;`,
    `${indent}--row: ${v.rowHeight}px;`,
  ];
}

export function toCss(): string {
  const parts: string[] = [
    "/* Generated from src/tokens.ts. Do not edit by hand.\n   Rewrite it with: pnpm --filter @toki/tokens generate */",
  ];
  parts.push(
    block(
      `:root, ${pairSelector("calm", "light")}`,
      pairLines("calm", "light", "  "),
    ),
  );
  for (const look of looks) {
    for (const scheme of schemes) {
      if (look === "calm" && scheme === "light") continue;
      parts.push(
        block(pairSelector(look, scheme), pairLines(look, scheme, "  ")),
      );
    }
  }
  // A page that has not set data-scheme yet: Calm in the scheme of the device.
  parts.push(
    block("@media (prefers-color-scheme: dark)", [
      block(
        ":root:not([data-scheme])",
        pairLines("calm", "dark", "    "),
        "  ",
      ),
    ]),
  );
  for (const look of looks) {
    for (const scheme of schemes) {
      for (const accent of accents) {
        if (accent === "teal") continue;
        parts.push(
          block(
            `${pairSelector(look, scheme)}[data-accent="${accent}"]`,
            declarations(getTheme(look, scheme, accent), accentNames, "  "),
          ),
        );
      }
    }
  }
  // Three attributes strong, like a pair block, and after it: a chosen density
  // wins over the density of the look in every look and scheme.
  for (const density of ["compact", "comfortable"] as const) {
    parts.push(
      block(
        `:root:root[data-density="${density}"]`,
        densityLines(density, "  "),
      ),
    );
  }
  return parts.join("\n\n") + "\n";
}
