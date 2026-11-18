import { accents, densities, looks } from "@toki/tokens";

// The three controls of the preview page (TOKI-016 R4). "own" is the look's
// own density: no data-density is set, so Calm shows Comfortable and Focus
// Compact (TOKI-009 R14).
export type Look = (typeof looks)[number];
export type Accent = (typeof accents)[number];
export type DensityChoice = (typeof densities)[number] | "own";
export type Controls = { look: Look; accent: Accent; density: DensityChoice };

export const DEFAULT_CONTROLS: Controls = {
  look: "calm",
  accent: "teal",
  density: "own",
};

export const densityChoices: readonly DensityChoice[] = ["own", ...densities];

function pick<T extends string>(
  params: URLSearchParams,
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  // A repeated name uses its first value; an unknown value gives the default.
  const value = params.get(name);
  return allowed.find((item) => item === value) ?? fallback;
}

export function readControls(search: string): Controls {
  const params = new URLSearchParams(search);
  return {
    look: pick(params, "look", looks, DEFAULT_CONTROLS.look),
    accent: pick(params, "accent", accents, DEFAULT_CONTROLS.accent),
    density: pick(params, "density", densityChoices, DEFAULT_CONTROLS.density),
  };
}

// The page's own function: it does not call the app's applyAppearance
// (TOKI-016 R4). data-eff is always set, so the device's light or dark
// setting never decides the look.
export function applyControls(
  root: {
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
  },
  controls: Controls,
): void {
  root.setAttribute("data-eff", controls.look);
  root.setAttribute("data-accent", controls.accent);
  if (controls.density === "own") root.removeAttribute("data-density");
  else root.setAttribute("data-density", controls.density);
}

export function writeAddress(
  history: {
    replaceState(state: unknown, title: string, url: string): void;
  },
  pathname: string,
  controls: Controls,
): void {
  const params = new URLSearchParams({
    look: controls.look,
    accent: controls.accent,
    density: controls.density,
  });
  history.replaceState(null, "", `${pathname}?${params.toString()}`);
}
