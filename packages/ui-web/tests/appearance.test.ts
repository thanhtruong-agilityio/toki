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

describe("applyAppearance (R28)", () => {
  beforeEach(() => {
    for (const a of ["data-eff", "data-accent", "data-density"])
      html().removeAttribute(a);
  });
  afterEach(() => vi.unstubAllGlobals());

  test("calm and focus set data-eff, accent defaults to teal, density is absent", () => {
    stubMatchMedia(true);
    applyAppearance({ look: "calm" });
    expect(html().dataset.eff).toBe("calm");
    expect(html().dataset.accent).toBe("teal");
    expect(html().hasAttribute("data-density")).toBe(false);
    applyAppearance({ look: "focus" });
    expect(html().dataset.eff).toBe("focus");
  });

  test("device follows prefers-color-scheme and changes with it", () => {
    const mq = stubMatchMedia(true);
    applyAppearance({ look: "device" });
    expect(html().dataset.eff).toBe("focus");
    mq.set(false);
    expect(html().dataset.eff).toBe("calm");
    mq.set(true);
    expect(html().dataset.eff).toBe("focus");
  });

  test("accent and density; an unknown value is the default", () => {
    stubMatchMedia(false);
    applyAppearance({ look: "calm", accent: "violet", density: "compact" });
    expect(html().dataset.accent).toBe("violet");
    expect(html().dataset.density).toBe("compact");
    applyAppearance({
      look: "calm",
      // @ts-expect-error not an accent
      accent: "pink",
      // @ts-expect-error not a density
      density: "huge",
    });
    expect(html().dataset.accent).toBe("teal");
    expect(html().hasAttribute("data-density")).toBe(false);
    applyAppearance({ look: "calm", density: "comfortable" });
    expect(html().dataset.density).toBe("comfortable");
  });

  test("the returned function stops the device listener", () => {
    const mq = stubMatchMedia(false);
    const stop = applyAppearance({ look: "device" });
    expect(mq.listeners.size).toBe(1);
    stop();
    expect(mq.listeners.size).toBe(0);
    mq.set(true);
    expect(html().dataset.eff).toBe("calm");
  });

  test("a second call replaces the first listener", () => {
    const mq = stubMatchMedia(false);
    applyAppearance({ look: "device" });
    applyAppearance({ look: "device" });
    expect(mq.listeners.size).toBe(1);
    applyAppearance({ look: "calm" });
    expect(mq.listeners.size).toBe(0);
  });

  test("without matchMedia, device means calm", () => {
    vi.stubGlobal("matchMedia", undefined);
    applyAppearance({ look: "device" });
    expect(html().dataset.eff).toBe("calm");
  });
});
