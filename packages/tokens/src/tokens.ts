// The design values of the Toki prototype, typed once. tokens.css and getTheme
// are built from these objects. Source: docs/specs/2026-11-16-tokens-package-design.md
// (Tables A to E). A length is a number of pixels; a colour is #RRGGBB or rgba().

export type Look = "calm" | "focus" | "classic";
export type Scheme = "light" | "dark";
export type Accent = "teal" | "indigo" | "clay" | "violet";
export type Density = "comfortable" | "compact";

export const looks: readonly Look[] = ["calm", "focus", "classic"];
export const schemes: readonly Scheme[] = ["light", "dark"];
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

// The colours of a scheme and the avatar tints of a look. Calm light and Focus dark are the
// values of the prototype from the start; Calm dark and Focus light are Table A of
// docs/specs/2026-11-27-look-and-scheme-in-the-app-design.md (the blocks of the prototype).
type Colours = Omit<
  Palette,
  | "avatarBgSaturation"
  | "avatarBgLightness"
  | "avatarTextSaturation"
  | "avatarTextLightness"
>;
type Tints = Pick<
  Palette,
  | "avatarBgSaturation"
  | "avatarBgLightness"
  | "avatarTextSaturation"
  | "avatarTextLightness"
>;

const lightColours: Colours = {
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
};
const darkColours: Colours = {
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
};
const calmDarkColours: Colours = {
  ...darkColours,
  bg: "#0B0F10",
  surface2: "#1B2125",
  line: "#263035",
};
const focusLightColours: Colours = {
  ...lightColours,
  bg: "#EEF1EC",
  surface2: "#F4F6F2",
  line: "#DDE3DC",
};

const calmTints: Tints = {
  avatarBgSaturation: 45,
  avatarBgLightness: 88,
  avatarTextSaturation: 55,
  avatarTextLightness: 28,
};
const focusTints: Tints = {
  avatarBgSaturation: 35,
  avatarBgLightness: 24,
  avatarTextSaturation: 70,
  avatarTextLightness: 86,
};

// Classic has the colours, the tints, the radii and the shadows of Focus: it holds the same
// objects.
const focusPalettes: Record<Scheme, Palette> = {
  light: { ...focusLightColours, ...focusTints },
  dark: { ...darkColours, ...focusTints },
};
export const palettes: Record<Look, Record<Scheme, Palette>> = {
  calm: {
    light: { ...lightColours, ...calmTints },
    dark: { ...calmDarkColours, ...calmTints },
  },
  focus: focusPalettes,
  classic: focusPalettes,
};

// A light scheme has the accents of Calm and a dark scheme those of Focus, in all three looks.
const lightAccents: Record<Accent, AccentValues> = {
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
const darkAccents: Record<Accent, AccentValues> = {
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
export const accentColors: Record<
  Look,
  Record<Scheme, Record<Accent, AccentValues>>
> = {
  calm: { light: lightAccents, dark: darkAccents },
  focus: { light: lightAccents, dark: darkAccents },
  classic: { light: lightAccents, dark: darkAccents },
};

export const densityValues: Record<Density, DensityValues> = {
  comfortable: { avatarSize: 36, messageGap: 14, rowHeight: 36 },
  compact: { avatarSize: 30, messageGap: 8, rowHeight: 32 },
};

// With no density chosen, Calm shows Comfortable and Focus shows Compact.
export const lookDensity: Record<Look, Density> = {
  calm: "comfortable",
  focus: "compact",
  classic: "compact",
};

export const radii: Record<Look, Radii> = {
  calm: { radius: 16, radiusSm: 10 },
  focus: { radius: 10, radiusSm: 8 },
  classic: { radius: 10, radiusSm: 8 },
};

// A shadow is a list of layers; "no shadow" is an empty list.
const calmLightShadows: Shadows = {
  shadow: [
    { x: 0, y: 1, blur: 2, spread: 0, color: "rgba(22,32,29,0.06)" },
    { x: 0, y: 8, blur: 24, spread: 0, color: "rgba(22,32,29,0.06)" },
  ],
  pop: [
    { x: 0, y: 4, blur: 8, spread: 0, color: "rgba(22,32,29,0.08)" },
    { x: 0, y: 16, blur: 40, spread: 0, color: "rgba(22,32,29,0.16)" },
  ],
};
const focusDarkShadows: Shadows = {
  shadow: [],
  pop: [
    { x: 0, y: 0, blur: 0, spread: 1, color: "#283035" },
    { x: 0, y: 16, blur: 40, spread: 0, color: "rgba(0,0,0,0.5)" },
  ],
};
const calmDarkShadows: Shadows = {
  shadow: [
    { x: 0, y: 1, blur: 2, spread: 0, color: "rgba(0,0,0,0.4)" },
    { x: 0, y: 8, blur: 24, spread: 0, color: "rgba(0,0,0,0.3)" },
  ],
  pop: focusDarkShadows.pop,
};
const focusLightShadows: Shadows = {
  shadow: [],
  pop: [
    { x: 0, y: 0, blur: 0, spread: 1, color: "#DDE3DC" },
    { x: 0, y: 16, blur: 40, spread: 0, color: "rgba(22,32,29,0.16)" },
  ],
};
export const shadows: Record<Look, Record<Scheme, Shadows>> = {
  calm: { light: calmLightShadows, dark: calmDarkShadows },
  focus: { light: focusLightShadows, dark: focusDarkShadows },
  classic: { light: focusLightShadows, dark: focusDarkShadows },
};

// The colours of the Classic sidebar (TOKI-144 R1): a dark rail and a dark column in both schemes.
// They are not among the 32 properties: only the two Classic blocks of tokens.css declare them.
// Source: docs/specs/2026-11-27-classic-sidebar-frame-design.md, Table A (the prototype's blocks).
export type SideColours = {
  rail: string;
  sideBg: string;
  ink: string;
  muted: string;
  line: string;
  hover: string;
};

export const sideColours: Record<Scheme, SideColours> = {
  light: {
    rail: "#0F1719",
    sideBg: "#16201D",
    ink: "#E4EBE8",
    muted: "#9AA8A3",
    line: "#26332F",
    hover: "rgba(255,255,255,0.07)",
  },
  dark: {
    rail: "#0A0E0F",
    sideBg: "#12181A",
    ink: "#E8EDEB",
    muted: "#96A29D",
    line: "#232C30",
    hover: "rgba(255,255,255,0.07)",
  },
};
