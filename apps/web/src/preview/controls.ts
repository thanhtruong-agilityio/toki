import { accents, densities, looks, schemes } from "@toki/tokens";

// The four controls of the preview page (TOKI-016 R4, TOKI-143 R10). "own" is the look's
// own density: no data-density is set, so Calm shows Comfortable and Focus
// Compact (TOKI-009 R14).
export type Look = (typeof looks)[number];
export type Scheme = (typeof schemes)[number];
export type Accent = (typeof accents)[number];
export type DensityChoice = (typeof densities)[number] | "own";
export type Controls = {
  look: Look;
  scheme: Scheme;
  accent: Accent;
  density: DensityChoice;
};

export const DEFAULT_CONTROLS: Controls = {
  look: "calm",
  scheme: "light",
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
    scheme: pick(params, "scheme", schemes, DEFAULT_CONTROLS.scheme),
    accent: pick(params, "accent", accents, DEFAULT_CONTROLS.accent),
    density: pick(params, "density", densityChoices, DEFAULT_CONTROLS.density),
  };
}

// The page's own function: it does not call the app's applyAppearance
// (TOKI-016 R4). data-look and data-scheme are always set, together, so the
// device's light or dark setting never decides them; the look no longer
// brings a scheme with it, so ?look=focus alone is Focus in light.
export function applyControls(
  root: {
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
  },
  controls: Controls,
): void {
  root.setAttribute("data-look", controls.look);
  root.setAttribute("data-scheme", controls.scheme);
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
    scheme: controls.scheme,
    accent: controls.accent,
    density: controls.density,
  });
  history.replaceState(null, "", `${pathname}?${params.toString()}`);
}
