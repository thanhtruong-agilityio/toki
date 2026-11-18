// @vitest-environment node
import { describe, expect, test } from "vitest";
import { getPlatform, setPlatform } from "./index";
import type { Platform } from "./index";

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
  };
}

describe("the platform holder", () => {
  test("the interface entry loads where no DOM exists (R4)", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });

  test("getPlatform before setPlatform throws and names setPlatform (R2)", () => {
    expect(() => getPlatform()).toThrow(/setPlatform/);
  });

  test("getPlatform returns the object given to setPlatform, and a later one replaces it (R2)", () => {
    const p = fake();
    const q = fake();
    setPlatform(p);
    expect(getPlatform()).toBe(p);
    setPlatform(q);
    expect(getPlatform()).toBe(q);
  });
});
