// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import type { Platform } from "../src/index";

// The holder is module state, so every test loads a fresh copy of it and the
// tests do not depend on their order.
async function load() {
  vi.resetModules();
  return import("../src/index");
}

function fake(): Platform {
  return {
    notifications: {
      permission: () => "default",
      requestPermission: async () => "default",
    },
    storage: {
      device: { get: () => null, set: () => true, remove() {}, clear() {} },
      tab: { get: () => null, set: () => true, remove() {}, clear() {} },
    },
    files: { pick: async () => [] },
    sound: { play: async () => true },
    tabs: { post() {}, subscribe: () => () => {} },
  };
}

describe("the platform holder", () => {
  test("the interface entry loads where no DOM exists (R4)", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });

  test("getPlatform before setPlatform throws and names setPlatform (R2)", async () => {
    const { getPlatform } = await load();
    expect(() => getPlatform()).toThrow(/setPlatform/);
  });

  test("getPlatform returns the object given to setPlatform, and a later one replaces it (R2)", async () => {
    const { getPlatform, setPlatform } = await load();
    const p = fake();
    const q = fake();
    setPlatform(p);
    expect(getPlatform()).toBe(p);
    setPlatform(q);
    expect(getPlatform()).toBe(q);
  });
});
