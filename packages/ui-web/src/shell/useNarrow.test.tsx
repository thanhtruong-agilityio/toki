import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useNarrow } from "./index";

type Listener = (event: { matches: boolean }) => void;

function stubMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    media: "",
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  const matchMedia = vi.fn((query: string) => {
    mql.media = query;
    return mql;
  });
  vi.stubGlobal("matchMedia", matchMedia);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });
  return {
    matchMedia,
    listeners,
    set(matches: boolean) {
      mql.matches = matches;
      for (const l of [...listeners]) l({ matches });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("useNarrow (R29)", () => {
  test("asks for (max-width: 719px) and returns true when it matches", () => {
    const stub = stubMatchMedia(true);
    const { result } = renderHook(() => useNarrow());
    expect(result.current).toBe(true);
    expect(stub.matchMedia).toHaveBeenCalledWith("(max-width: 719px)");
  });

  test("returns false when it does not match", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useNarrow());
    expect(result.current).toBe(false);
  });

  test("updates when the query changes and stops listening on unmount", () => {
    const stub = stubMatchMedia(false);
    const { result, unmount } = renderHook(() => useNarrow());
    expect(stub.listeners.size).toBe(1);
    act(() => stub.set(true));
    expect(result.current).toBe(true);
    act(() => stub.set(false));
    expect(result.current).toBe(false);
    unmount();
    expect(stub.listeners.size).toBe(0);
  });

  test("with no matchMedia it returns false", () => {
    Reflect.deleteProperty(window, "matchMedia");
    expect((window as { matchMedia?: unknown }).matchMedia).toBeUndefined();
    const { result } = renderHook(() => useNarrow());
    expect(result.current).toBe(false);
  });
});
