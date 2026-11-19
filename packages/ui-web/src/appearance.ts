// The one function that sets data-eff, data-accent and data-density on the
// page (TOKI-015 R28). It holds no text and reads no account: the caller gives
// the values, and TOKI-078 calls it with the saved ones.

export type Look = "calm" | "focus" | "device";
export type Accent = "teal" | "indigo" | "clay" | "violet";
export type Density = "comfortable" | "compact";

export type AppearanceOptions = {
  look: Look;
  accent?: Accent;
  density?: Density;
};

const accents: readonly Accent[] = ["teal", "indigo", "clay", "violet"];
const densities: readonly Density[] = ["comfortable", "compact"];

let stopCurrent: (() => void) | null = null;

export function applyAppearance(options: AppearanceOptions): () => void {
  stopCurrent?.();
  stopCurrent = null;

  const root = document.documentElement;
  const accent = accents.includes(options.accent as Accent)
    ? options.accent
    : "teal";
  root.setAttribute("data-accent", accent as string);
  if (densities.includes(options.density as Density))
    root.setAttribute("data-density", options.density as string);
  else root.removeAttribute("data-density");

  let stop = () => {};
  if (options.look === "focus") root.setAttribute("data-eff", "focus");
  else if (options.look === "device" && typeof matchMedia === "function") {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const set = () =>
      root.setAttribute("data-eff", query.matches ? "focus" : "calm");
    set();
    query.addEventListener("change", set);
    stop = () => query.removeEventListener("change", set);
  } else root.setAttribute("data-eff", "calm");

  const stopThis = () => {
    stop();
    if (stopCurrent === stopThis) stopCurrent = null;
  };
  stopCurrent = stopThis;
  return stopThis;
}
