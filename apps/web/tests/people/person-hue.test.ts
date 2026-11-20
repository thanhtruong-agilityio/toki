import { describe, expect, test } from "vitest";
import { personHue } from "../../src/people/person-hue";

// TOKI-033 R28: FNV-1a 32-bit over the UTF-8 bytes of the lower-cased id,
// modulo 360. The values were computed apart from the function.
describe("personHue", () => {
  test.each([
    ["", 61],
    ["a", 340],
    ["Sam", 356],
    ["sam", 356],
    ["00000000-0000-4000-8000-000000000001", 2],
    ["ÉA", 304],
  ])("%j gives %i", (id, hue) => {
    expect(personHue(id)).toBe(hue);
  });

  test("is an integer from 0 to 359 and the same every time", () => {
    for (const id of ["x", "y", "a-long-id-0123456789"]) {
      const h = personHue(id);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(personHue(id)).toBe(h);
    }
  });
});
