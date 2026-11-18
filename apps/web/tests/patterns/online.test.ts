import { afterEach, describe, expect, it, vi } from "vitest";
import { isOnline, setConnectionCheck } from "../../src/patterns/online";

afterEach(() => {
  setConnectionCheck(null);
  vi.unstubAllGlobals();
});

describe("the connection check (R17)", () => {
  it("uses the check that was set", () => {
    setConnectionCheck(() => false);
    expect(isOnline()).toBe(false);
    setConnectionCheck(() => true);
    expect(isOnline()).toBe(true);
  });

  it("treats a check that throws as online, so a broken check never blocks", () => {
    setConnectionCheck(() => {
      throw new Error("boom");
    });
    expect(isOnline()).toBe(true);
  });

  it("null restores the default, which follows navigator.onLine", () => {
    setConnectionCheck(() => false);
    setConnectionCheck(null);
    vi.stubGlobal("navigator", { onLine: true });
    expect(isOnline()).toBe(true);
    vi.stubGlobal("navigator", { onLine: false });
    expect(isOnline()).toBe(false);
  });

  it("the default is online when there is no navigator", () => {
    vi.stubGlobal("navigator", undefined);
    expect(isOnline()).toBe(true);
  });
});
