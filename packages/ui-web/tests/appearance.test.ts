import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { applyAppearance } from "../src/appearance";

type Listener = () => void;
function stubMatchMedia(dark: boolean) {
  const listeners = new Set<Listener>();
  const state = { dark };
  const mql = {
    get matches() {
      return state.dark;
    },
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
  return {
    set(value: boolean) {
      state.dark = value;
      listeners.forEach((l) => l());
    },
    listeners,
  };
}

const html = () => document.documentElement;
const attrs = () => [html().dataset.look, html().dataset.scheme];

// Watches the root element for the moment between two calls: no write may leave data-look without
// data-scheme or the other way round (TOKI-143 R5).
function watchPairs() {
  const seen: string[] = [];
  const observer = new MutationObserver(() => {
    if (html().hasAttribute("data-look") !== html().hasAttribute("data-scheme"))
      seen.push("apart");
  });
  observer.observe(html(), { attributes: true });
  return { seen, observer };
}

describe("applyAppearance (TOKI-143 R6)", () => {
  beforeEach(() => {
    for (const a of [
      "data-eff",
      "data-look",
      "data-scheme",
      "data-accent",
      "data-density",
    ])
      html().removeAttribute(a);
  });
  afterEach(() => vi.unstubAllGlobals());

  test.each([
    ["calm", "light"],
    ["calm", "dark"],
    ["focus", "light"],
    ["focus", "dark"],
    ["classic", "light"],
    ["classic", "dark"],
  ] as const)("%s and %s set both attributes", (look, scheme) => {
    stubMatchMedia(false);
    applyAppearance({ look, scheme });
    expect(attrs()).toEqual([look, scheme]);
    expect(html().dataset.accent).toBe("teal");
    expect(html().hasAttribute("data-density")).toBe(false);
    expect(html().hasAttribute("data-eff")).toBe(false);
  });

  test("device sets the scheme the device has and follows its setting", () => {
    const mq = stubMatchMedia(true);
    applyAppearance({ look: "focus", scheme: "device" });
    expect(attrs()).toEqual(["focus", "dark"]);
    mq.set(false);
    expect(attrs()).toEqual(["focus", "light"]);
    mq.set(true);
    expect(attrs()).toEqual(["focus", "dark"]);
  });

  test("a chosen scheme does not follow the device", () => {
    const mq = stubMatchMedia(false);
    applyAppearance({ look: "calm", scheme: "dark" });
    expect(mq.listeners.size).toBe(0);
    mq.set(true);
    mq.set(false);
    expect(html().dataset.scheme).toBe("dark");
  });

  test("accent and density; an unknown value is the default", () => {
    stubMatchMedia(false);
    applyAppearance({
      look: "calm",
      scheme: "light",
      accent: "violet",
      density: "compact",
    });
    expect(html().dataset.accent).toBe("violet");
    expect(html().dataset.density).toBe("compact");
    applyAppearance({
      look: "calm",
      scheme: "light",
      // @ts-expect-error not an accent
      accent: "pink",
      // @ts-expect-error not a density
      density: "huge",
    });
    expect(html().dataset.accent).toBe("teal");
    expect(html().hasAttribute("data-density")).toBe(false);
    applyAppearance({ look: "calm", scheme: "light", density: "comfortable" });
    expect(html().dataset.density).toBe("comfortable");
  });

  test("an unknown look is calm and an unknown scheme is device", () => {
    stubMatchMedia(true);
    applyAppearance({
      // @ts-expect-error not a look
      look: "loud",
      // @ts-expect-error not a scheme
      scheme: "sepia",
    });
    expect(attrs()).toEqual(["calm", "dark"]);
  });

  test("the returned function stops the device listener", () => {
    const mq = stubMatchMedia(false);
    const stop = applyAppearance({ look: "calm", scheme: "device" });
    expect(mq.listeners.size).toBe(1);
    stop();
    expect(mq.listeners.size).toBe(0);
    mq.set(true);
    expect(html().dataset.scheme).toBe("light");
  });

  test("a second call replaces the first listener", () => {
    const mq = stubMatchMedia(false);
    applyAppearance({ look: "calm", scheme: "device" });
    applyAppearance({ look: "focus", scheme: "device" });
    expect(mq.listeners.size).toBe(1);
    applyAppearance({ look: "calm", scheme: "light" });
    expect(mq.listeners.size).toBe(0);
  });

  test("without matchMedia, device means light", () => {
    vi.stubGlobal("matchMedia", undefined);
    applyAppearance({ look: "calm", scheme: "device" });
    expect(attrs()).toEqual(["calm", "light"]);
  });

  test("a call never leaves look without scheme or scheme without look", async () => {
    stubMatchMedia(true);
    const { seen, observer } = watchPairs();
    applyAppearance({ look: "classic", scheme: "device" });
    applyAppearance({ look: "calm", scheme: "dark" });
    await Promise.resolve();
    observer.disconnect();
    expect(seen).toEqual([]);
  });
});
