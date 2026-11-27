// The one function that sets data-look, data-scheme, data-accent and data-density on the
// page (TOKI-015 R28, TOKI-143 R6). It holds no text and reads no account: the caller gives
// the values, and TOKI-078 calls it with the saved ones.

export type Look = "calm" | "focus" | "classic";
export type Scheme = "light" | "dark" | "device";
export type Accent = "teal" | "indigo" | "clay" | "violet";
export type Density = "comfortable" | "compact";

export type AppearanceOptions = {
  look: Look;
  scheme: Scheme;
  accent?: Accent;
  density?: Density;
};

const looks: readonly Look[] = ["calm", "focus", "classic"];
const schemes: readonly Scheme[] = ["light", "dark", "device"];
const accents: readonly Accent[] = ["teal", "indigo", "clay", "violet"];
const densities: readonly Density[] = ["comfortable", "compact"];

let stopCurrent: (() => void) | null = null;

export function applyAppearance(options: AppearanceOptions): () => void {
  stopCurrent?.();
  stopCurrent = null;

  const root = document.documentElement;
  const look = looks.includes(options.look) ? options.look : "calm";
  const scheme = schemes.includes(options.scheme) ? options.scheme : "device";
  const accent = accents.includes(options.accent as Accent)
    ? options.accent
    : "teal";
  root.setAttribute("data-accent", accent as string);
  if (densities.includes(options.density as Density))
    root.setAttribute("data-density", options.density as string);
  else root.removeAttribute("data-density");

  // The look and the scheme are set together, in this one call, so a page never has one of
  // them without the other.
  let stop = () => {};
  if (scheme === "device" && typeof matchMedia === "function") {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const set = () =>
      root.setAttribute("data-scheme", query.matches ? "dark" : "light");
    root.setAttribute("data-look", look);
    set();
    query.addEventListener("change", set);
    stop = () => query.removeEventListener("change", set);
  } else {
    root.setAttribute("data-look", look);
    root.setAttribute("data-scheme", scheme === "dark" ? "dark" : "light");
  }

  const stopThis = () => {
    stop();
    if (stopCurrent === stopThis) stopCurrent = null;
  };
  stopCurrent = stopThis;
  return stopThis;
}
