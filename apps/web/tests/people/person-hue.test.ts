import { describe, expect, test } from "vitest";
import { personHue } from "../../src/people/person-hue";

// Independent FNV-1a 32-bit over the UTF-8 bytes, written out for the expected values.
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash;
}

describe("personHue (R28)", () => {
  test("the same id gives the same number every time", () => {
    expect(personHue("user-1")).toBe(personHue("user-1"));
  });

  test("the result is an integer in 0..359 for 1000 random ids", () => {
    for (let i = 0; i < 1000; i += 1) {
      const id = `${Math.random().toString(36).slice(2)}-${i}`;
      const hue = personHue(id);
      expect(Number.isInteger(hue)).toBe(true);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThanOrEqual(359);
    }
  });

  test("ids that differ only in letter case give the same number", () => {
    expect(personHue("AbC-123")).toBe(personHue("abc-123"));
    expect(personHue("USER-ID")).toBe(personHue("user-id"));
  });

  test("three ids have a fixed expected output", () => {
    // Known FNV-1a 32-bit values: "" = 0x811c9dc5, "a" = 0xe40c292c.
    expect(personHue("")).toBe(0x811c9dc5 % 360);
    expect(personHue("a")).toBe(0xe40c292c % 360);
    expect(personHue("A")).toBe(0xe40c292c % 360);
    expect(personHue("Ngọc")).toBe(fnv1a("ngọc") % 360);
    expect(personHue("Ngọc")).toBe(personHue("ngọc"));
  });
});
