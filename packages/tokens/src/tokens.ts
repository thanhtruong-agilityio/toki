// The design values of the Toki prototype, typed once. tokens.css and getTheme
// are built from these objects. Source: docs/specs/2026-11-16-tokens-package-design.md
// (Tables A to E). A length is a number of pixels; a colour is #RRGGBB or rgba().

export type Look = "calm" | "focus";
export type Accent = "teal" | "indigo" | "clay" | "violet";
export type Density = "comfortable" | "compact";

export const looks: readonly Look[] = ["calm", "focus"];
export const accents: readonly Accent[] = ["teal", "indigo", "clay", "violet"];
export const densities: readonly Density[] = ["comfortable", "compact"];

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  muted: string;
  line: string;
  mentionBg: string;
  mentionInk: string;
  danger: string;
  dangerSoft: string;
  live: string;
  onLive: string;
  idea: string;
  ideaSoft: string;
  hover: string;
  scrim: string;
  // Percentages from 0 to 100: the prototype colours an avatar as
  // hsl(<hue of the person> <saturation> <lightness>).
  avatarBgSaturation: number;
  avatarBgLightness: number;
  avatarTextSaturation: number;
  avatarTextLightness: number;
};

export type AccentValues = {
  accent: string;
  onAccent: string;
  accentSoft: string;
  accentText: string;
};

export type DensityValues = {
  avatarSize: number;
  messageGap: number;
  rowHeight: number;
};

export type Radii = { radius: number; radiusSm: number };

export type ShadowLayer = {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
};

export type Shadows = { shadow: ShadowLayer[]; pop: ShadowLayer[] };

export const palettes: Record<Look, Palette> = {
  calm: {
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
  },
  focus: {
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
  },
};

export const accentColors: Record<Look, Record<Accent, AccentValues>> = {
  calm: {
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
  },
  focus: {
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
  },
};

export const densityValues: Record<Density, DensityValues> = {
  comfortable: { avatarSize: 36, messageGap: 14, rowHeight: 36 },
  compact: { avatarSize: 30, messageGap: 8, rowHeight: 32 },
};

// With no density chosen, Calm shows Comfortable and Focus shows Compact.
export const defaultDensity: Record<Look, Density> = {
  calm: "comfortable",
  focus: "compact",
};

export const radii: Record<Look, Radii> = {
  calm: { radius: 16, radiusSm: 10 },
  focus: { radius: 10, radiusSm: 8 },
};

// A shadow is a list of layers; "no shadow" is an empty list.
export const shadows: Record<Look, Shadows> = {
  calm: {
    shadow: [
      { x: 0, y: 1, blur: 2, spread: 0, color: "rgba(22,32,29,0.06)" },
      { x: 0, y: 8, blur: 24, spread: 0, color: "rgba(22,32,29,0.06)" },
    ],
    pop: [
      { x: 0, y: 4, blur: 8, spread: 0, color: "rgba(22,32,29,0.08)" },
      { x: 0, y: 16, blur: 40, spread: 0, color: "rgba(22,32,29,0.16)" },
    ],
  },
  focus: {
    shadow: [],
    pop: [
      { x: 0, y: 0, blur: 0, spread: 1, color: "#283035" },
      { x: 0, y: 16, blur: 40, spread: 0, color: "rgba(0,0,0,0.5)" },
    ],
  },
};
